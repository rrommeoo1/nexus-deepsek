/**
 * Cele două gesturi ale foii de comentarii (runda 49), ca socoteală pură.
 *
 * Până acum foaia se închidea **numai** prin ✕ sau printr-o atingere pe terenul stins, iar previzualizarea
 * de deasupra ei nu primea niciun gest: stratul care închide foaia acoperea exact locul unde stă postarea,
 * deci o pagină de articol cu mai multe file rămânea la prima filă cât timp foaia era deschisă.
 *
 * Ownerul a cerut două lucruri care se rezolvă împreună: foaia se trage în jos ca să se închidă, iar
 * articolul din previzualizare se frunzărește cu degetul pe orizontală. Amândouă sunt hotărâte aici, cu
 * numerele pe care le are deja gestul social (`lib/socialGesture.ts`: 48 px pentru un pas, 1,2 pentru axă),
 * ca foaia să nu-și inventeze propriile praguri.
 *
 * Modulul este **pur** la propriu: nu importează nimic (nici măcar `socialGesture`, ca să poată fi încărcat
 * într-un singur pas de test).
 */

/** Cât de jos trebuie tras mânerul ca foaia să se închidă, în puncte. */
export const SHEET_DISMISS_TRAVEL = 96;
/** Sau cât de repede: o aruncare scurtă în jos închide, fără să ceri 96 de puncte de deget. */
export const SHEET_DISMISS_VELOCITY = 1.1;
/** Cât de mult trebuie să miște degetul ca să fie un gest, nu o atingere. */
export const SHEET_DRAG_START = 6;
/** Cât de clar vertical trebuie să fie începutul ca să nu fure o derulare ori o filă. */
export const SHEET_DRAG_SLOPE = 1.2;
/** Cât de mult trebuie să călătorească un deget pe orizontală ca să întoarcă fila articolului. */
export const PREVIEW_PAGE_STEP = 48;
/** De la cât încolo o mișcare pe stratul de deasupra este un gest, nu o atingere. */
export const PREVIEW_GESTURE_SLOP = 12;
/** Sub atât, gestul este o atingere: aceeași atingere care închidea foaia până acum. */
export const TAP_SLOP = 8;

export type SheetDragDecision = { offset: number; dismiss: boolean };

/**
 * Ce face foaia cu o tragere: cât urmează degetul (`offset`, niciodată negativ — foaia nu urcă peste locul
 * ei) și dacă, la ridicare, se închide.
 *
 * O viteză necunoscută nu închide foaia: un `vy` care nu este număr nu are voie să ia o decizie în locul
 * degetului.
 */
export function sheetDragDecision({
  dy, vy, travel = SHEET_DISMISS_TRAVEL, velocity = SHEET_DISMISS_VELOCITY,
}: {
  dy?: number;
  vy?: number;
  travel?: number;
  velocity?: number;
}): SheetDragDecision {
  const distance = Number(dy);
  const speed = Number(vy);
  const limit = Number(travel) > 0 ? Number(travel) : SHEET_DISMISS_TRAVEL;
  const fast = Number(velocity) > 0 ? Number(velocity) : SHEET_DISMISS_VELOCITY;
  if (!Number.isFinite(distance)) return { offset: 0, dismiss: false };
  const offset = Math.max(0, distance);
  if (!Number.isFinite(speed)) return { offset, dismiss: offset >= limit };
  return { offset, dismiss: offset >= limit || speed >= fast };
}

/**
 * Dacă o mișcare a degetului pe mâner este o tragere a foii.
 *
 * Numai **în jos** și numai clar verticală: o filă orizontală sau o derulare a listei care începe pe mâner
 * trebuie să rămână a listei. `onStartShouldSetPanResponder` nu este folosit deloc, deci o atingere pe ✕
 * rămâne a butonului.
 */
export function sheetDragShouldStart({ dx, dy }: { dx?: number; dy?: number } = {}): boolean {
  const horizontal = Math.abs(Number(dx) || 0);
  const vertical = Number(dy);
  if (!Number.isFinite(vertical)) return false;
  return vertical > SHEET_DRAG_START && vertical > horizontal * SHEET_DRAG_SLOPE;
}

/** Ce face stratul care acoperă locul de deasupra foii (previzualizarea postării). */
export type PreviewBackdropDecision =
  | { action: 'none' }
  | { action: 'dismiss' }
  | { action: 'page'; offset: 1 | -1 };

/**
 * Ce face stratul cu un gest: o **atingere** închide foaia (ca până acum), o filă orizontală întoarce fila
 * articolului din previzualizare, o tragere în jos închide și ea, iar orice altceva nu face nimic.
 *
 * Atingerea se hotărăște aici, nu într-un `Pressable`: `PanResponder` trebuie să ceară atingerea **de la
 * început** (`onStartShouldSetPanResponder`), fiindcă un responder care așteaptă mișcarea nu mai primește
 * primul deget (aceeași lecție ca în `lib/profileDrag.ts`), iar un `Pressable` pus sub el n-ar mai primi
 * niciodată atingerea. De aceea stratul este un `View` cu acțiunea de accesibilitate `activate`, ca un
 * cititor cu TalkBack să poată închide foaia fără să gliseze.
 *
 * Un pas orizontal cere `PREVIEW_PAGE_STEP` puncte și o axă clară (1,2), exact ca fila din reader
 * (`decideViewerGesture` din `social-gesture.js`), ca o mișcare piezișă să nu schimbe fila din greșeală.
 */
export function previewBackdropDecision({ dx, dy }: { dx?: number; dy?: number } = {}): PreviewBackdropDecision {
  const horizontal = Number(dx);
  const vertical = Number(dy);
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return { action: 'none' };
  const across = Math.abs(horizontal);
  const down = Math.abs(vertical);
  if (across >= PREVIEW_PAGE_STEP && across > down * SHEET_DRAG_SLOPE) {
    return { action: 'page', offset: horizontal < 0 ? 1 : -1 };
  }
  if (vertical > SHEET_DISMISS_TRAVEL / 2 && down > across * SHEET_DRAG_SLOPE) {
    return { action: 'dismiss' };
  }
  if (across <= TAP_SLOP && down <= TAP_SLOP) return { action: 'dismiss' };
  return { action: 'none' };
}
