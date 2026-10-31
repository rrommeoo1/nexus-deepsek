/**
 * How many media players this phone is holding at once (31 October 2026, round 43).
 *
 * The owner reported three `OutOfMemoryError` kills inside `MediaCodecRenderer`. That is not a JavaScript
 * heap problem: it is Android refusing to give a decoder one more buffer, which happens when too many
 * players are alive at the same time (or when one of them is never released). Neither a screenshot nor a
 * `dumpsys` answers "how many clips does the app think it is playing" — so every player announces when it
 * opens and when it closes, and a running count and peak are kept here.
 *
 * A player is opened by `RemoteVideo` (a clip's own decoder) and by `RemoteImageSound` (a Jamendo track
 * over a still); both release it when the component unmounts, because `expo-video` and `expo-audio` tie the
 * native player to the hook's lifetime. What this module adds is the *number*: the feed keeps three pages
 * mounted, a carousel keeps up to five attachments mounted (`MAX_MEDIA`), and only the sum of those tells
 * a reader whether a swipe is quietly stacking decoders.
 *
 * It is a diagnostic, not state: nothing is rendered from it, nothing is decided by it, and the lines are
 * printed only under `__DEV__` (`[player] +1 #7 video clip=… live=2 peak=3`), so a release build carries
 * the two integers and no logs.
 */
export type PlayerKind = 'video' | 'audio';

export type PlayerRecord = {
  /** The order in which this player was opened, so open and close can be paired in a log. */
  id: number;
  kind: PlayerKind;
  /** The clip's hash (`media_items[].hash`), or `still-sound` for a track over a picture. */
  clip: string;
  /** Milliseconds since the module was loaded. */
  at: number;
};

const live = new Map<number, PlayerRecord>();
let nextId = 0;
let peak = 0;
const started = Date.now();

/** Whether a log line is possible: `__DEV__` exists in the app and not in a Node test. */
const loud = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);

/**
 * A player came to life. Returns the ticket the caller must hand back to `playerClosed` — the ticket is
 * what makes the count a fact about *this* player and not about another one that looks the same.
 */
export function playerOpened(kind: PlayerKind, clip: string): number {
  const record: PlayerRecord = {
    id: ++nextId,
    kind,
    clip: String(clip || 'unknown'),
    at: Date.now() - started,
  };
  live.set(record.id, record);
  if (live.size > peak) peak = live.size;
  report('+1', record);
  return record.id;
}

/** A player is gone (its component unmounted, so the native player was released with it). */
export function playerClosed(id: number) {
  const record = live.get(id);
  if (!record) return;
  live.delete(id);
  report('-1', record);
}

/** How many players the app is holding right now, by kind. */
export function livePlayers(): { total: number; video: number; audio: number } {
  let video = 0;
  let audio = 0;
  for (const record of live.values()) {
    if (record.kind === 'video') video += 1;
    else audio += 1;
  }
  return { total: live.size, video, audio };
}

/** The most players that were alive at the same moment since the module was loaded. */
export function peakPlayers(): number {
  return peak;
}

/** Forget everything (a test, or the start of a new reading on the phone). */
export function clearPlayerTrace() {
  live.clear();
  nextId = 0;
  peak = 0;
}

function report(sign: '+1' | '-1', record: PlayerRecord) {
  if (!loud) return;
  console.log(`[player] ${sign} #${record.id} ${record.kind} clip=${record.clip} live=${live.size} peak=${peak}`);
}
