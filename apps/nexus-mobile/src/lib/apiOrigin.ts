import Constants from 'expo-constants';

/**
 * Where the backend is, decided in one place and never guessed quietly.
 *
 * 1. `EXPO_PUBLIC_NEXUS_API_URL`, when the build or the shell sets it: the one value a deployment
 *    changes (`docs/` says so), and the only one a release build should rely on.
 * 2. The host that served this bundle, which Metro knows: a development build on the home Wi-Fi is
 *    served by the PC that also runs the backend, so the same machine, port 5000. This is what keeps
 *    the PC's current address out of the sources and out of every rebuild after the router hands out
 *    a new lease.
 * 3. The hosted deployment, for a release build that was compiled without either of the above.
 *
 * The product used to fall through to (3) in every case, so a development build whose environment
 * variable had been forgotten read production data while the PC sat idle — the silent Railway
 * dependency this project is closing. It can no longer happen while Metro is the bundle's source,
 * and when neither (1) nor (2) exists the build says out loud which origin it is using.
 */
const HOSTED_ORIGIN = 'https://nexus-deepsek-production.up.railway.app';

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
    console.warn(`[api] no configured origin and no packager host: using ${HOSTED_ORIGIN}`);
  }
  return HOSTED_ORIGIN;
}

export const API_ORIGIN = resolveOrigin();

/**
 * What the shell prints next to its own version, so the backend a build talks to is never a guess:
 * `API: Railway` for the hosted deployment, `API: local` for a loopback or private-network origin
 * (a laptop on the LAN, which is how a development build is pointed somewhere else). Anything else is
 * named by its host, because inventing "Railway" for a third server would be a lie.
 */
export function apiOriginLabel(origin: string = API_ORIGIN): string {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
      || /^(10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return 'API: local';
    }
    if (host === 'railway.app' || host.endsWith('.railway.app')) return 'API: Railway';
    return `API: ${host}`;
  } catch {
    return 'API: local';
  }
}
