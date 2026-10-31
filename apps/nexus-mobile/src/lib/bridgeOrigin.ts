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

/**
 * Unde rulează pagina care vorbește cu walletul, când asta e o decizie separată de API.
 *
 * Până acum originea paginii era derivată din originea API-ului, iar asta avea două consecințe
 * măsurate pe telefon: (a) mutarea backendului pe alt PC schimba adresa din metadata WalletConnect,
 * deci walletul arăta „This dApp could not be verified” și fiecare mutare cerea altă allowlistă în
 * Reown; (b) pe un IP de LAN pagina nu are `crypto.subtle`, deci relay-ul refuză, iar loginul moare
 * fără să se vadă de ce.
 *
 * De aceea există acum **două** origini, cu roluri diferite:
 *
 *   · `EXPO_PUBLIC_NEXUS_API_URL` — unde stă backendul (feed, `/api/me`, `/auth/mvx/native`).
 *   · `EXPO_PUBLIC_NEXUS_WALLET_URL` — unde stă pagina cu WalletConnect (`xportal-bridge.html`) și,
 *     prin ea, metadata pe care o vede xPortal. O singură adresă publică https, care nu se schimbă
 *     când backendul se mută; walletul vede aceeași identitate, iar `nexusdev://` rămâne redirectul.
 *
 * Când a doua nu e configurată, rămâne regula veche (`secureBridgeOrigin`), ca un build de
 * dezvoltare să meargă fără nicio variabilă nouă. O valoare configurată dar imposibilă nu e
 * ignorată în tăcere: `problem` o spune, iar foaia o afișează.
 */
export type WalletOriginSource =
  /** `EXPO_PUBLIC_NEXUS_WALLET_URL`: adresa stabilă, publică (sau loopback). */
  | 'configured'
  /** API-ul e deja https: pagina stă pe aceeași origine. */
  | 'api-https'
  /** API-ul e loopback (`http://localhost:5000`): origine sigură prin definiție. */
  | 'api-loopback'
  /** API-ul e pe LAN prin http: pagina se mută pe loopback-ul telefonului (`adb reverse`). */
  | 'phone-loopback';

export type WalletOrigin = {
  origin: string;
  source: WalletOriginSource;
  /** Ce trebuie să știe operatorul despre originea aleasă ('' = nimic). */
  note: string;
  /** Originea configurată a fost refuzată; textul spune de ce ('' = nu a fost nimic de refuzat). */
  problem: string;
};

function loopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * O origine de wallet e folosibilă dacă e `https:` (public) sau `http:` pe loopback — exact
 * condiția în care un browser o consideră **secure context** și îi dă `crypto.subtle`. Orice cale,
 * query sau credențială e refuzată: pagina are o singură adresă (`/xportal-bridge.html`).
 */
export function normalizeWalletOrigin(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  if (parsed.username || parsed.password) return '';
  if (parsed.search || parsed.hash) return '';
  if (parsed.pathname && parsed.pathname !== '/') return '';
  if (parsed.protocol === 'http:' && !loopbackHost(parsed.hostname)) return '';
  return parsed.origin;
}

/** Originea paginii de WalletConnect: cea configurată, altfel derivata din API (regula veche). */
export function resolveWalletOrigin(options: { configured?: string | null; apiOrigin: string; devPort?: number } = { apiOrigin: '' }): WalletOrigin {
  const { configured = '', apiOrigin, devPort = 5000 } = options;
  const raw = String(configured ?? '').trim();
  if (raw) {
    const accepted = normalizeWalletOrigin(raw);
    if (accepted) return { origin: accepted, source: 'configured', note: '', problem: '' };
    const problem = `Adresa pentru wallet (${raw.slice(0, 80)}) nu poate fi folosită: e nevoie de un https:// public sau de un http://localhost. Se folosește adresa serverului.`;
    return { ...resolveFromApi(apiOrigin, devPort), problem };
  }
  return resolveFromApi(apiOrigin, devPort);
}

function resolveFromApi(apiOrigin: string, devPort: number): WalletOrigin {
  const origin = secureBridgeOrigin(apiOrigin, devPort);
  const parsed = new URL(origin);
  if (parsed.protocol === 'https:') return { origin, source: 'api-https', note: '', problem: '' };
  let apiHost = '';
  try { apiHost = new URL(String(apiOrigin)).hostname; } catch { apiHost = ''; }
  if (loopbackHost(apiHost)) return { origin, source: 'api-loopback', note: '', problem: '' };
  const port = parsed.port || String(devPort);
  return {
    origin,
    source: 'phone-loopback',
    note: `Pagina de conectare rulează pe telefon (${origin}) și ajunge la server prin adb reverse tcp:${port} tcp:${port}.`,
    problem: '',
  };
}

