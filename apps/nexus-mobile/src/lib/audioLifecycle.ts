/**
 * `expo-audio` leagă fiecare player de un obiect nativ partajat, iar la demontarea ecranului obiectul
 * este eliberat. Un `pause()` chemat după eliberare nu e un no-op: aruncă
 * „Cannot use shared object that was already released”, iar în cleanup-ul unui efect acea excepție
 * devine Render Error pe tot ecranul. S-a văzut pe telefon pe 17 oct 2026, în `camera.tsx`:
 * `Call to function 'AudioPlayer.pause' has been rejected … received class java.lang.Integer`.
 *
 * Funcția nu repară playerul; doar hotărăște, fără să arunce, dacă mai are rost să-l atingi, și
 * întoarce ce a făcut, ca apelantul să poată scrie în jurnal dacă vrea.
 */
export type PausableAudio = { isLoaded?: boolean; pause: () => void } | null | undefined;

export type PauseOutcome = 'paused' | 'not-loaded' | 'released';

export function pauseIfAlive(player: PausableAudio): PauseOutcome {
  if (!player) return 'not-loaded';
  try {
    if (player.isLoaded === false) return 'not-loaded';
    player.pause();
    return 'paused';
  } catch {
    return 'released';
  }
}
