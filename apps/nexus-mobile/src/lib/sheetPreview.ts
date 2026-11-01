/**
 * Cât din pagină rămâne **deasupra** foii de comentarii, ca postarea să se poată potrivi întreagă acolo.
 *
 * Runda 47 (owner): „foaia de comentarii rămâne exact cum este — jumătate de ecran, deschidere, design,
 * înălțime. Numai previzualizarea postării din jumătatea de sus trebuie să arate postarea **întreagă**, nu
 * o porțiune tăiată." Până acum, foaia se ridica pur și simplu *peste* pagină: pagina își păstra înălțimea
 * întreagă a ferestrei, iar ce se vedea deasupra foii era partea de sus a unei compoziții dimensionate
 * pentru tot ecranul — un reel tăiat la mijlocul cadrului, un articol tăiat după primele rânduri.
 *
 * De aceea foaia își **raportează** înălțimea măsurată (nu o presupune nimeni: nici 52 %, nici 82 %, nici
 * o valoare pentru tastatură), iar pagina primește înapoi exact locul rămas. Modulul acesta este socoteala
 * aceea, singura, plus micul depozit prin care măsurătoarea ajunge la pagină — foaia și pagina stau în
 * arbori React diferiți (foaia e într-un `Modal`), deci nu se pot vorbi prin props.
 *
 * Modulul este **pur**: nu importează nimic, deci `scripts/test-sheet-preview.cjs` îl încarcă în Node simplu.
 */

/**
 * Cât de mică poate ajunge previzualizarea. Sub atât nu mai încape nici un cadru lizibil, iar o foaie care
 * ar lua tot ecranul ar lăsa postarea invizibilă — deci pagina se oprește aici, nu la zero.
 */
export const SHEET_PREVIEW_MIN = 120;

export type SheetPreviewRoomInput = {
  /** Înălțimea paginii (fereastra, sau pagina deschisă pe ruta ei). */
  pageHeight: number;
  /** Cât din fereastră ia foaia, măsurat de foaie (`onLayout`), plus bandă de tastatură dacă e deschisă. */
  sheetHeight: number;
  /** Locul cel mai mic pe care îl păstrăm pentru postare. */
  minimum?: number;
};

/**
 * Înălțimea pe care o primește compoziția cât timp foaia este deschisă.
 *
 * `0` înseamnă „nicio foaie deschisă pentru postarea asta": pagina își păstrează înălțimea ei, exact ca
 * înainte de runda 47. Altfel, pagina cedează partea luată de foaie, dar nu coboară sub `minimum` și nu
 * trece niciodată peste înălțimea ei.
 */
export function previewRoomOf(input: SheetPreviewRoomInput): number {
  const page = Math.max(0, Math.round(Number(input.pageHeight) || 0));
  const sheet = Math.max(0, Math.round(Number(input.sheetHeight) || 0));
  if (page <= 0) return 0;
  if (sheet <= 0) return page;
  const minimum = Math.max(0, Math.round(Number(input.minimum) || 0)) || SHEET_PREVIEW_MIN;
  return Math.min(page, Math.max(minimum, page - sheet));
}

/** Postarea a cărei foaie este deschisă acum; `0` = niciuna. */
let openPost = 0;
/** Cât ia foaia deschisă din fereastră, în puncte. */
let openHeight = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Foaia spune cât loc ia. Se scrie doar când valoarea chiar se schimbă: `useSyncExternalStore` cere ca
 * snapshot-ul să fie stabil, altfel randarea nu se termină niciodată.
 */
export function reportSheetPreview(postId: number, height: number): void {
  const id = Math.round(Number(postId) || 0);
  if (id <= 0) return;
  const next = Math.max(0, Math.round(Number(height) || 0));
  if (openPost === id && openHeight === next) return;
  openPost = id;
  openHeight = next;
  notify();
}

/**
 * Foaia s-a închis (sau s-a demonstrat): pagina își primește înapoi înălțimea întreagă.
 *
 * Cu `postId`, se șterge numai dacă foaia deschisă este chiar a acelei postări — o foaie care se
 * demontează după ce alta s-a deschis nu are voie să șteargă măsurătoarea noii foi.
 */
export function clearSheetPreview(postId?: number): void {
  const id = Math.round(Number(postId) || 0);
  if (id > 0 && openPost !== id) return;
  if (openPost === 0 && openHeight === 0) return;
  openPost = 0;
  openHeight = 0;
  notify();
}

export function sheetPreviewPostId(): number {
  return openPost;
}

export function sheetPreviewHeight(): number {
  return openHeight;
}

export function subscribeSheetPreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Starea de la zero, pentru teste: niciun ascultător, nicio foaie deschisă. */
export function resetSheetPreview(): void {
  openPost = 0;
  openHeight = 0;
  listeners.clear();
  pageSnapshot = { seq: 0, postId: 0, offset: 1 };
  pageListeners.clear();
}

/**
 * O cerere de filă pentru previzualizarea de deasupra foii (runda 49).
 *
 * Foaia este într-un `Modal`, iar stratul ei acoperă exact locul unde stă postarea: un deget care ar
 * frunzări articolul din previzualizare nu ajunge niciodată la pagerul lui. Deci gestul se ia **în foaie**
 * și se raportează aici, iar pagina (`PostCanvas` → `EditorialArticle` → `EditorialPage`) îl citește de
 * aici, prin `useCommentsPreviewPage`. `seq` este un număr care crește: două cereri identice la rând sunt
 * două file, nu una, fiindcă `seq` le deosebește.
 */
export type SheetPreviewPageRequest = {
  /** Crește la fiecare cerere; `0` înseamnă „nicio cerere încă". */
  seq: number;
  /** Postarea căreia îi este adresată cererea. */
  postId: number;
  /** `1` = fila următoare, `-1` = fila dinainte (`decideViewerGesture`). */
  offset: 1 | -1;
};

let pageSnapshot: SheetPreviewPageRequest = { seq: 0, postId: 0, offset: 1 };
const pageListeners = new Set<() => void>();

/**
 * Foaia cere fila următoare (sau dinainte) a articolului din previzualizare.
 *
 * Nu atinge nimic dacă nu există o foaie deschisă pentru postarea aceea: un gest rămas în urmă nu are voie
 * să întoarcă fila unei postări care nu mai este deschisă.
 */
export function requestSheetPreviewPage(postId: number, offset: number): void {
  const id = Math.round(Number(postId) || 0);
  if (id <= 0) return;
  if (openPost !== id) return;
  const step = Number(offset) < 0 ? -1 : 1;
  pageSnapshot = { seq: pageSnapshot.seq + 1, postId: id, offset: step };
  for (const listener of pageListeners) listener();
}

export function sheetPreviewPageRequest(): SheetPreviewPageRequest {
  return pageSnapshot;
}

export function subscribeSheetPreviewPage(listener: () => void): () => void {
  pageListeners.add(listener);
  return () => { pageListeners.delete(listener); };
}

