/**
 * Where the xPortal bridge page has to run from, so the wallet can actually sign.
 *
 * The bridge (`apps/nexus-web/public/xportal-bridge.js`) is a normal page: it fetches `/auth/mvx/init`
 * from **its own** origin, it imports the WalletConnect bundle, and the relay needs `crypto.subtle` to
 * derive its keys. `crypto.subtle` only exists in a **secure context**, and a browser treats exactly two
 * `http:` origins as secure: `localhost` and `127.0.0.1`. `http://192.168.1.153:5000` is therefore a dead
 * end for a wallet login even when the backend happily attests it — the page loads, the relay refuses.
 *
 * So the wallet keeps one rule: an `https:` or loopback origin is used as given; anything else (the LAN
 * address this app uses for every other request) is swapped for the phone's own loopback, which reaches
 * the PC's backend through `adb reverse tcp:5000 tcp:5000` (opened by `tools/dev-start.ps1`, or by hand).
 *
 * Nothing else moves: `/api/me`, the feed, media and `/auth/mvx/native` keep talking to the LAN address,
 * and the NativeAuth token minted at `http://localhost:5000` is accepted there because the development
 * Server callback accepts loopback origins (`lib/mvx.js` `isLocalDevelopmentOrigin`). In production the
 * API origin is already `https:`, so this function returns it unchanged.
 */
export function secureBridgeOrigin(origin: string, fallbackPort = 5000): string {
  let parsed: URL;
  try {
    parsed = new URL(String(origin));
  } catch {
    throw new Error('Adresa serverului nu este validă.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Pagina xPortal are nevoie de un server http(s).');
  }
  const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  if (parsed.protocol === 'https:' || loopback) return parsed.origin;
  const port = parsed.port || String(fallbackPort);
  return `http://localhost:${port}`;
}

/** The sentence the sheet shows when the bridge page itself cannot be reached. */
export function bridgeUnreachableSentence(origin: string): string {
  const target = (() => {
    try { return secureBridgeOrigin(origin); } catch { return 'http://localhost:5000'; }
  })();
  return `Pagina de conectare nu a putut fi încărcată de la ${target}. Deschide tunelul: adb reverse tcp:5000 tcp:5000.`;
}
