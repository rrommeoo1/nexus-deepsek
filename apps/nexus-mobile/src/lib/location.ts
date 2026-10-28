/**
 * Where a page was written, as a place name the reader can understand — never as a coordinate.
 *
 * The composer asks the phone for one fix and the server for the name of that place:
 *
 * 1. `expo-location` asks Android for the *foreground* location permission and then for a position. A
 *    refused permission, a phone with the GPS switched off and a fix that never arrives are three
 *    different answers, and none of them blocks the page — a text post is never held hostage by a
 *    satellite.
 * 2. The fix travels to `GET /api/location/suggestions?kind=reverse`, the geocoder this product already
 *    serves (`apps/nexus-web/lib/api.js`, Nominatim behind a cache and a rate limit). That route answers
 *    `precise_location_stored: false` and hands back *labels* graded `exact`, `area` and `city`.
 * 3. The coordinate is rounded to four decimals (~11 m) before it leaves the phone, and it is never
 *    written into the draft: `publishing.location` is a string, and the page keeps the place name only.
 *    There is no coordinate in the draft file, in the publish body or in the database, so removing the
 *    location with the X in the composer removes it from the payload entirely.
 *
 * The device's own position is the only source. Nothing here derives a place from the network address:
 * an IP says where the provider's router is, which on a mobile phone is a different city.
 */

import type * as ExpoLocation from 'expo-location';
import { PUBLISHING_LIMITS } from './publishing';
import { nexusApi } from './nexusApi';

/** How the geocoder grades a label; the composer prefers the least precise name it is given. */
export type PlacePrecision = 'exact' | 'area' | 'city';

export type PlaceSuggestion = { label: string; type: string };

/**
 * The place name of a `LOCATION_*` answer, chosen for the precision the product stores.
 *
 * `area` is the default because a page says where it was written, not which doorway: the server's own
 * `locationPrecision` default is `area`, and the `exact` label carries a street and a house number that
 * the post has no use for.
 */
export function readablePlace(suggestions: readonly PlaceSuggestion[] | null | undefined,
  precision: PlacePrecision = 'area'): PlaceSuggestion | null {
  const order: PlacePrecision[] = precision === 'exact' ? ['exact', 'area', 'city']
    : precision === 'city' ? ['city', 'area', 'exact']
      : ['area', 'city', 'exact'];
  const clean = (suggestions ?? [])
    .filter((item): item is PlaceSuggestion => Boolean(item) && typeof item.label === 'string' && Boolean(item.label.trim()))
    .map((item) => ({ label: item.label.trim().slice(0, PUBLISHING_LIMITS.location), type: String(item.type || 'area') }));
  for (const level of order) {
    const match = clean.find((item) => item.type === level);
    if (match) return match;
  }
  return clean[0] ?? null;
}

/** What the composer is told: a name, a refusal, or silence. Silence is not an error. */
export type PlaceDetection =
  | { status: 'found'; label: string; type: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/** A fix is a fact about `now`: two minutes is already generous for a page being written. */
const MAX_FIX_AGE_MS = 2 * 60 * 1000;
/** A cold GPS on a phone in a pocket can take a while; the composer waits this long and then moves on. */
const FIX_DEADLINE_MS = 12000;

/**
 * The native module, asked for at call time.
 *
 * `expo-location` ships native code, so a development build from before this round does not contain it.
 * That absence is detected *before* the package is loaded: `requireOptionalNativeModule` answers null
 * instead of throwing, which keeps an unbuilt phone on the honest sentence „Aplicația instalată nu poate
 * citi locația" rather than on a red box from Metro (`expo-location` throws at module scope when its
 * native half is missing). The same guard is why this file can be unit-tested in Node with no native
 * runtime at all.
 */
async function locationModule(): Promise<typeof ExpoLocation | null> {
  try {
    const core = await import('expo-modules-core');
    if (!core.requireOptionalNativeModule('ExpoLocation')) return null;
    return await import('expo-location');
  } catch {
    return null;
  }
}

/** A promise that never settles must not leave the composer waiting: silence is an answer of its own. */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then((value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); });
  });
}

/** Four decimals, the precision the geocoder's own cache key already uses (`roundedLat` of `api.js`). */
export function roundCoordinate(value: number): string {
  return (Math.round(value * 10000) / 10000).toFixed(4);
}

/**
 * What the phone already thinks about location, without asking the owner anything.
 *
 * The composer reads this before it offers the place: a granted permission is detected silently, an
 * `undetermined` one gets one sentence and one button (the system dialog must belong to a press, never to
 * the opening of a composer), and a refusal is answered with the way back instead of a second prompt that
 * Android would not show anyway. `unavailable` is a build without the native module.
 */
export type LocationPermission = 'granted' | 'undetermined' | 'denied' | 'unavailable';

export async function readLocationPermission(): Promise<LocationPermission> {
  const Location = await locationModule();
  if (!Location) return 'unavailable';
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain === false ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/**
 * One detection: permission, fix, name.
 *
 * Nothing is thrown to the caller on purpose. A refused permission is `denied` (the composer explains why
 * it asked and offers the attempt again), the missing module, a dead GPS and an unanswered geocoder are
 * `unavailable` with a sentence to print, and a place that was found is a name of at most 120 characters.
 */
export async function detectPlace(precision: PlacePrecision = 'area'): Promise<PlaceDetection> {
  const Location = await locationModule();
  if (!Location) {
    return { status: 'unavailable', reason: 'Aplicația instalată nu poate citi locația. Instalează versiunea nouă de dezvoltare.' };
  }

  let permission: Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>;
  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch {
    return { status: 'unavailable', reason: 'Telefonul nu a răspuns la cererea de locație.' };
  }
  if (!permission.granted) return { status: 'denied' };

  const fix = await withDeadline((async () => {
    const last = await Location.getLastKnownPositionAsync({ maxAge: MAX_FIX_AGE_MS });
    if (last) return last;
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  })(), FIX_DEADLINE_MS);
  if (!fix) return { status: 'unavailable', reason: 'Locația nu a putut fi citită acum. Poți publica fără ea.' };

  const lat = roundCoordinate(fix.coords.latitude);
  const lon = roundCoordinate(fix.coords.longitude);
  let answer: { suggestions?: PlaceSuggestion[] };
  try {
    /**
     * `accept-language` is not decoration: the geocoder answers in the language it is asked in, and a page
     * written by a Romanian author read "Cracovia" (the Romanian exonym for Kraków) only after this header
     * was sent — the same coordinate asked with `pl` answers "Kraków". The server forwards this header
     * straight to Nominatim (`api.js`, `accept-language`).
     */
    answer = await nexusApi<{ suggestions?: PlaceSuggestion[] }>(
      `/api/location/suggestions?kind=reverse&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { timeoutMs: 9000, headers: { 'Accept-Language': 'ro,en' } },
    );
  } catch (reason) {
    return {
      status: 'unavailable',
      reason: reason instanceof Error && reason.message ? reason.message : 'Numele locului nu a putut fi citit.',
    };
  }
  const place = readablePlace(answer.suggestions, precision);
  if (!place) return { status: 'unavailable', reason: 'Locația nu are un nume cunoscut. Poți publica fără ea.' };
  return { status: 'found', label: place.label, type: place.type };
}
