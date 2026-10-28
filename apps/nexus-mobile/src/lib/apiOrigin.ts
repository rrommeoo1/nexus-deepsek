import Constants from 'expo-constants';

/**
 * Where the backend is, decided in one place and never guessed quietly.
 *
 * The backend runs on this PC (`tools/local-backend`, port 5000, database and media under
 * `C:\Nexus\data`) and nowhere else: the app is developed and used on the home Wi-Fi or through
 * `adb reverse`, against `NEXUS_DATA_DIR`. That makes "which server?" a local question with a local
 * answer, and the three steps below are all of it.
 *
 * 1. `EXPO_PUBLIC_NEXUS_API_URL`, when the build or the shell sets it: the one value that changes when
 *    the PC's address changes (`apps/nexus-mobile/.env`), and the only one a release build relies on.
 * 2. The host that served this bundle, which Metro knows: a development build is served by the PC that
 *    also runs the backend, so the same machine, port 5000. This keeps the PC's current address out of
 *    the sources and out of every rebuild after the router hands out a new lease.
 * 3. `http://localhost:5000` — the phone's own loopback, which reaches the PC's backend through
 *    `adb reverse tcp:5000` (`tools/dev-start.ps1` opens it). This is the arrangement that survives a
 *    laptop changing network *and* changing address, which is why it is the fallback instead of a
 *    remote host. It is announced on the console, never silent.
 *
 * There is no hosted-deployment fallback any more, on purpose. Until round 34 a build whose environment
 * variable had been forgotten quietly read and wrote a Railway deployment while the PC sat idle — the
 * silent remote dependency this round closes (`JUNGLE_BOOK_PROGRESS.md` §34.2). A build that can name
 * no origin now talks to the PC through the tunnel; without the tunnel its requests fail visibly, which
 * is the only honest outcome. See `scripts/test-api-origin.cjs`, which fails if a remote origin ever
 * reappears in these sources.
 */
const FALLBACK_ORIGIN = 'http://localhost:5000';

/** Port the PC backend listens on (`C:\Nexus`, `apps/nexus-web`): the Metro host, one port over. */
const BACKEND_PORT = 5000;

function trimOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

/** `192.168.1.153:8081` (Metro's `hostUri`) → `http://192.168.1.153:5000`. */
function originOfPackager(hostUri?: string | null): string | null {
  const host = String(hostUri ?? '').split('/')[0].replace(/:\d+$/, '').trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return `http://${host}:${BACKEND_PORT}`;
}

function resolveOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_NEXUS_API_URL;
  if (configured) return trimOrigin(configured);
  const fromPackager = originOfPackager(Constants.expoConfig?.hostUri);
  if (fromPackager) return fromPackager;
  if (typeof console !== 'undefined') {
    // Says which origin is in use instead of letting a forgotten variable look like a working app.
    console.warn(
      `[api] no configured origin and no packager host: using ${FALLBACK_ORIGIN} `
      + `(needs "adb reverse tcp:${BACKEND_PORT} tcp:${BACKEND_PORT}")`,
    );
  }
  return FALLBACK_ORIGIN;
}

export const API_ORIGIN = resolveOrigin();

/**
 * What the shell prints next to its own version, so the backend a build talks to is never a guess:
 * `API: local` for a loopback or private-network origin (this PC, on the LAN or through `adb reverse`),
 * and anything else named by its host — the app is not supposed to reach a third server, and if a build
 * is pointed at one it must say which, not be given a friendly name it has not earned.
 */
export function apiOriginLabel(origin: string = API_ORIGIN): string {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
      || /^(10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return 'API: local';
    }
    return `API: ${host}`;
  } catch {
    return 'API: local';
  }
}
