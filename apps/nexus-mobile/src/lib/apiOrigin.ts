// The backend origin is configured explicitly (EXPO_PUBLIC_NEXUS_API_URL) and defaults to the
// owner's Railway deployment. The installed app never depends on localhost or adb reverse.
export const API_ORIGIN = (process.env.EXPO_PUBLIC_NEXUS_API_URL || 'https://nexus-deepsek-production.up.railway.app').replace(/\/+$/, '');

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
