/**
 * Când se pune xPortal în față și ce citește un începător cât timp e acolo.
 *
 * Deciziile stau aici, nu în `XPortalSheet`, pentru un motiv măsurat: foaia răspundea la
 * „deschid xPortal acum?” din trei `useRef`-uri diferite, la trei locuri de apel, iar răspunsul
 * depinde de **starea autentificării**, nu de un cronometru. Un `setTimeout` singur nu poate ști că
 * aprobarea a venit deja (atunci xPortal trebuie readus pentru semnătură) sau că semnătura a fost
 * publicată deja (atunci un al doilea intent fură ecranul walletului).
 *
 * Cele patru fapte rămân separate, ca în `xportal-bridge.js`:
 * socket deschis ≠ sesiune aprobată ≠ cerere publicată ≠ semnătură primită.
 * `signature` este singurul stadiu în care readucerea xPortal în față are sens, iar
 * `authenticated` este singurul în care se poate scrie „reușit” — și numai după ce serverul a
 * confirmat sesiunea (`signInWithXPortalToken`), niciodată din stadiu sau din timp.
 */
import type { XPortalStage } from './xportalState';

/** Cât așteaptă foaia după `signature` înainte de a readuce xPortal în față (cererea e pe relay). */
export const SIGNATURE_REOPEN_DELAY_MS = 1200;

/**
 * Cât timp un wallet pus în față e considerat „deja deschis”. Android ignoră un al doilea intent
 * către aceeași activitate în acest interval, dar splash-ul lui xPortal poate dura ~10 s pe acest
 * telefon, deci fereastra acoperă doar lansarea imediată, nu încărcarea.
 */
export const WALLET_FRESH_LAUNCH_MS = 4000;

/** După atâta timp în care cititorul a rămas în Jungle Book, xPortal e considerat înghețat. */
export const UNSTUCK_DELAY_MS = 10000;

/** Un tap repetat pe „Deschide xPortal” nu are voie să trimită două intent-uri. */
export const READER_LAUNCH_MIN_GAP_MS = 1500;

/**
 * Cum pleacă linkul către xPortal: `NEW_TASK | SINGLE_TOP | CLEAR_TOP` (`0x34000000`).
 *
 * Măsurat pe telefon, nu ghicit. A doua fereastră (semnătura) pleacă din Jungle Book, adică din altă
 * aplicație decât cea care ține walletul. Cu `Linking.openURL` — care pune doar `NEW_TASK` — Android
 * pornește o **a doua** activitate `MVX` în procesul deja viu al xPortal, iar aceea rămâne neagră:
 * xPortal e o aplicație React Native cu un singur runtime, legat de prima activitate. Dovada, din
 * `dumpsys window`: două ferestre `com.elrond.maiar.wallet/com.maiar2.MainActivity.MVX`
 * (`34abe97` și `b1b16ee`) și un arbore de accesibilitate gol peste un minut.
 *
 * Cu `SINGLE_TOP | CLEAR_TOP` sistemul aduce în față task-ul existent și îl anunță pe cel care rulează
 * deja (`onNewIntent`) în loc să mai deschidă o activitate — măsurat: „its current task has been
 * brought to the front”, o singură fereastră `MVX`, iar ecranul de semnătură s-a randat
 * (`walletconnect-sign-token-screen-wrapper`, „Connection established. Proceed to log in?”).
 */
export const WALLET_INTENT_FLAGS = 0x10000000 | 0x20000000 | 0x04000000;

/** De ce se vrea xPortal în față. */
export type XPortalLaunchReason =
  /** Un pairing nou a apărut: prima fereastră din wallet. */
  | 'first-open'
  /** Pagina a publicat cererea de semnătură: a doua fereastră din wallet. */
  | 'signature'
  /** Cititorul a stat în Jungle Book și xPortal pare înghețat: o singură reîncercare. */
  | 'unstuck'
  /** Cititorul a apăsat „Deschide xPortal”. */
  | 'reader';

/** De ce NU se deschide; foaia scrie motivul în trace, ca o lansare lipsă să fie explicată. */
export type XPortalLaunchSkip =
  | ''
  | 'no-pairing'
  | 'finished'
  | 'wallet-in-front'
  | 'already-reopened'
  | 'not-signed-yet';

export type XPortalLaunchInput = {
  reason: XPortalLaunchReason;
  stage: XPortalStage;
  /** Există un `wc:` de deschis? Fără pairing nu e nimic de arătat walletului. */
  hasPairing: boolean;
  /** `Date.now()` la momentul deciziei. */
  now: number;
  /** Când a fost pus xPortal în față ultima dată (`0` = niciodată, în acest attempt). */
  openedAt?: number;
  /** Readucerea pentru semnătură a fost deja folosită în acest attempt. */
  autoReopened?: boolean;
  /** Reîncercarea pentru un xPortal înghețat a fost deja folosită. */
  unstuckUsed?: boolean;
};

export type XPortalLaunchDecision = {
  launch: boolean;
  skip: XPortalLaunchSkip;
  /** Cât să aștepte foaia înainte de a trimite intent-ul (`0` = acum). */
  waitMs: number;
};

function skip(skip: XPortalLaunchSkip, waitMs = 0): XPortalLaunchDecision {
  return { launch: false, skip, waitMs };
}

/**
 * Regula, într-un singur loc. Fiecare ramură spune *de ce* nu se deschide, pentru ca trace-ul să
 * poată arăta un attempt fără nicio lansare: un wallet care nu e deschis nu poate aproba nimic.
 */
export function xPortalLaunchDecision(input: XPortalLaunchInput): XPortalLaunchDecision {
  const { reason, stage, hasPairing, now, openedAt = 0, autoReopened = false, unstuckUsed = false } = input;
  if (!hasPairing) return skip('no-pairing');
  if (stage === 'idle' || stage === 'token' || stage === 'authenticated' || stage === 'failed') {
    return skip('finished');
  }
  if (reason === 'signature') {
    // `approved` nu e `signature`: cererea nu e încă pe relay, iar xPortal arată atunci un ecran gol.
    if (stage !== 'signature') return skip('not-signed-yet');
    if (autoReopened) return skip('already-reopened');
    return { launch: true, skip: '', waitMs: SIGNATURE_REOPEN_DELAY_MS };
  }
  if (reason === 'unstuck') {
    // O aprobare care a venit deja are propriul re-open; două intent-uri ar clipi între aplicații.
    if (autoReopened || unstuckUsed) return skip('already-reopened');
    const elapsed = openedAt ? now - openedAt : Number.POSITIVE_INFINITY;
    if (elapsed < UNSTUCK_DELAY_MS) return skip('wallet-in-front', UNSTUCK_DELAY_MS - elapsed);
    return { launch: true, skip: '', waitMs: 0 };
  }
  const gap = reason === 'reader' ? READER_LAUNCH_MIN_GAP_MS : WALLET_FRESH_LAUNCH_MS;
  if (openedAt && now - openedAt < gap) return skip('wallet-in-front', gap - (now - openedAt));
  return { launch: true, skip: '', waitMs: 0 };
}

/**
 * Cele cinci propoziții pe care le vede cititorul. Sunt scurte intenționat: fiecare spune un singur
 * lucru, iar propoziția se schimbă numai când se schimbă stadiul real al autentificării.
 */
export const XPORTAL_OPENING_SENTENCE = 'Se deschide xPortal…';
export const XPORTAL_CONNECT_SENTENCE = 'Confirmă conectarea în xPortal';
export const XPORTAL_PREPARING_SENTENCE = 'Pregătim autentificarea…';
export const XPORTAL_SIGNATURE_SENTENCE = 'Confirmă semnătura în xPortal';
export const XPORTAL_DONE_SENTENCE = 'Autentificare reușită';

/** Acțiunea de recuperare când xPortal nu s-a deschis singur. */
export const XPORTAL_OPEN_ACTION = 'Deschide xPortal';

/** Propoziția stadiului, sau `''` pentru stadiile care nu se anunță (idle, expirat, eșec). */
export function xPortalStageSentence(stage: XPortalStage): string {
  switch (stage) {
    case 'preparing': return XPORTAL_OPENING_SENTENCE;
    case 'pairing': return XPORTAL_CONNECT_SENTENCE;
    case 'approved': return XPORTAL_PREPARING_SENTENCE;
    case 'signature': return XPORTAL_SIGNATURE_SENTENCE;
    case 'authenticated': return XPORTAL_DONE_SENTENCE;
    default: return '';
  }
}

/**
 * Ce face cititorul dacă xPortal nu se întoarce singur.
 *
 * În `signature` walletul are cererea, iar întoarcerea în Jungle Book depinde de redirectul lui
 * (`metadata.redirect.native` = `nexusdev://`). Când Android sau xPortal nu îl onorează, singura
 * cale rămasă e cea pe care o poate urma un începător: lista de aplicații recente. Propoziția e
 * scrisă înainte de a pleca din aplicație, fiindcă după aceea nu mai putem scrie nimic pe ecran.
 */
export function xPortalReturnHint(stage: XPortalStage): string {
  if (stage === 'signature') {
    return 'După ce confirmi semnătura, revino în Jungle Book: dacă nu se întoarce singur, atinge Jungle Book în lista de aplicații recente.';
  }
  return '';
}
