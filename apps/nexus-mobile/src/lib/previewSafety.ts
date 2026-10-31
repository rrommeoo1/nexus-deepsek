/**
 * Ghidajele de zonă sigură ale compozitorului: unde **nu** are ce să caute un text tras pe poză.
 *
 * Runda 43 (owner): „când trag text pe fotografie, cum știu că nu ajunge sub nume sau sub descriere?".
 * Răspunsul nu este o socoteală paralelă în editor, ci chiar măsurătoarea paginii publicate: `PostCanvas`
 * raportează prin `onChromeMeasure` cât loc ia capul și blocul de descriere (`onLayout`), iar aici acele
 * numere devin dreptunghiuri desenate peste previzualizare. Un ghidaj socotit separat ar putea să mintă
 * exact acolo unde contează — la un font mare sau la o descriere de doisprezece rânduri.
 *
 * Modulul este **pur** (fără importuri), deci `scripts/test-preview-safety.cjs` îl încarcă în Node simplu.
 */

/** Un dreptunghi în punctele cadrului, cu originea în colțul de sus-stânga al ecranului. */
export type GuideRect = { left: number; top: number; width: number; height: number };

/** Benzile care au însemnătate pentru autorul unei capturi. */
export type SafeZoneId = 'head' | 'description' | 'rail' | 'system' | 'tool';

export type SafeZone = {
  id: SafeZoneId;
  /** Ce acoperă banda, așa cum îi spune autorului. */
  label: string;
  /**
   * Se vede și în postarea publicată? Benzile editorului (`tool`) nu: ele sunt o unealtă a compozitorului,
   * dar tot fură loc din poză cât timp autorul o compune, deci intră în ghidaje.
   */
  published: boolean;
  rect: GuideRect;
};

/** O bandă măsurată de altcineva (bara de reacții, urma uneltelor editorului). */
export type MeasuredBand = { id: SafeZoneId; label: string; published?: boolean; rect: GuideRect };

/** Ce trebuie să știe ghidajele ca să fie adevărate. Toate numerele vin din măsurători. */
export type PreviewSafetyInput = {
  /** Cadrul: ecranul întreg, pentru că previzualizarea este `absoluteFill` pe el. */
  width: number;
  height: number;
  /** Marginea de jos a capului, în puncte de la marginea de sus a cadrului (0 = cap nemăsurat). */
  head: number;
  /** Înălțimea blocului de descriere, în puncte de la poale (0 = fără bloc de jos). */
  description: number;
  /** Banda pe care dispozitivul sau bara editorului o ține la poale. */
  foot: number;
  /** Banda de sus a telefonului (ceasul): capul o ține întotdeauna. */
  systemTop?: number;
  /** Banda de jos a telefonului (gesturile): se ține la poale, iar descrierea stă deasupra ei. */
  systemBottom?: number;
  /** Benzile pe care editorul le măsoară singur (reacțiile, uneltele lui). */
  measured?: MeasuredBand[];
};


function positive(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function bandHeight(value: unknown, height: number): number {
  return Math.max(0, Math.min(positive(value), height));
}

/**
 * Benzile cadrului, de sus în jos: capul (cu banda de sus a telefonului în el), descrierea și banda de la
 * poale, plus cele pe care editorul le măsoară singur (reacțiile, uneltele lui). Descrierea stă **deasupra**
 * benzii de la poale, fiindcă așa o așază și pagina publicată. O bandă cu înălțime zero nu se desenează —
 * nu este nimic de apărat acolo, iar un dreptunghi gol ar fi o linie fără rost.
 */
export function previewSafeZones(input: PreviewSafetyInput): SafeZone[] {
  const width = positive(input.width);
  const height = positive(input.height);
  if (!width || !height) return [];
  const zones: SafeZone[] = [];
  const head = bandHeight(Math.max(positive(input.head), positive(input.systemTop)), height);
  if (head > 0) {
    zones.push({
      id: 'head',
      label: 'Capul paginii',
      published: true,
      rect: { left: 0, top: 0, width, height: Math.round(head) },
    });
  }
  const foot = bandHeight(input.foot, height);
  const systemBottom = bandHeight(input.systemBottom, height);
  const bottomBand = Math.max(foot, systemBottom);
  if (bottomBand > 0) {
    zones.push({
      id: 'system',
      label: 'Poalele paginii',
      published: true,
      rect: { left: 0, top: Math.round(height - bottomBand), width, height: Math.round(bottomBand) },
    });
  }
  /**
   * Descrierea este ancorată **deasupra** benzii de la poale, pentru că așa stă și pe pagina publicată:
   * `PostCanvas` primește `bottomInset` și desenează blocul de jos deasupra lui. Ancorată la marginea
   * ecranului, ghidajul ar fi acoperit bara editorului și ar fi mințit exact acolo unde contează —
   * „textul stă deasupra butoanelor", nu peste ele.
   */
  const description = Math.min(bandHeight(input.description, height), Math.max(0, height - bottomBand));
  if (description > 0) {
    zones.push({
      id: 'description',
      label: 'Descrierea',
      published: true,
      rect: { left: 0, top: Math.round(height - bottomBand - description), width, height: Math.round(description) },
    });
  }
  for (const band of input.measured ?? []) {
    const rect = {
      left: Math.max(0, Math.round(Number(band.rect.left) || 0)),
      top: Math.max(0, Math.round(Number(band.rect.top) || 0)),
      width: Math.max(0, Math.round(Number(band.rect.width) || 0)),
      height: Math.max(0, Math.round(Number(band.rect.height) || 0)),
    };
    if (rect.width < 1 || rect.height < 1) continue;
    zones.push({ id: band.id, label: band.label, published: band.published !== false, rect });
  }
  return zones;
}

/** Punctul din cadru al unei poziții ținute ca fracție din dreptunghiul de conținut (`overlayFrame`). */
export function frameSpotOf(input: { rect: GuideRect; x: number; y: number }): { x: number; y: number } {
  const rect = input.rect;
  const clamp = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
  return {
    x: rect.left + clamp(Number(input.x)) * rect.width,
    y: rect.top + clamp(Number(input.y)) * rect.height,
  };
}

/**
 * Punctul din cadru al unei etichete **așa cum este ea stocată** (`studioManifest.decorationBase`).
 *
 * Aici stătea defectul care a ținut avertismentul de suprapunere nevăzut pe telefon două runde la rând:
 * manifestul scrie `x`/`y` ca **procente 0–100** (`overlayPercent`), dar `frameSpotOf` citește fracții 0–1
 * și le limitează — deci fiecare etichetă era socotită în colțul de jos-dreapta al dreptunghiului de
 * conținut, oriunde ar fi stat de fapt. Rezultatul: textul tras în banda descrierii nu declanșa nimic,
 * fiindcă punctul lui era cu totul altul.
 *
 * Conversia stă într-un singur loc, ca nimeni să nu mai poată citi un procent ca fracție.
 */
export function decorationSpot(rect: GuideRect, point: { x: number; y: number }): { x: number; y: number } {
  const asFraction = (value: unknown) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.5;
    return Math.max(0, Math.min(1, number / 100));
  };
  return frameSpotOf({ rect, x: asFraction(point.x), y: asFraction(point.y) });
}

/** Drumul invers: fracția din dreptunghiul de conținut a unui punct din cadru, ținută în 0–1. */
export function fractionOfFrame(input: {
  rect: GuideRect;
  point: { x: number; y: number };
}): { x: number; y: number } {
  const rect = input.rect;
  const fraction = (value: number, start: number, size: number) => {
    if (!(size > 0)) return 0.5;
    const raw = (Number(value) - start) / size;
    return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
  };
  return {
    x: fraction(input.point.x, rect.left, rect.width),
    y: fraction(input.point.y, rect.top, rect.height),
  };
}

/** Benzile în care cade un punct; gol dacă punctul nu este în vreuna. */
export function zonesAt(zones: SafeZone[], point: { x: number; y: number }): SafeZone[] {
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return zones.filter((zone) => (
    x >= zone.rect.left
    && x <= zone.rect.left + zone.rect.width
    && y >= zone.rect.top
    && y <= zone.rect.top + zone.rect.height
  ));
}

/** Un punct liber din cadru. */
export type FreeSpot = { x: number; y: number };

/**
 * Locurile libere din cadru, între cap și descriere.
 *
 * `count` puncte, așezate la jumătatea lățimii libere (departe de coloana de reacții) și distribuite egal pe
 * verticala rămasă, ca două etichete fără loc să nu fie puse una peste alta. Verticala se taie numai cu
 * benzile care o acoperă pe **toată lățimea**: o coloană de reacții nu ia toată înălțimea, iar punctele stau
 * la stânga ei. Fără bandă liberă întoarce o listă goală — atunci textul chiar nu are unde să stea, iar
 * editorul spune asta în loc să-l mute undeva la întâmplare.
 */
export function freeSpots(zones: SafeZone[], input: { width: number; height: number; count: number }): FreeSpot[] {
  const width = positive(input.width);
  const height = positive(input.height);
  const count = Math.max(1, Math.min(12, Math.round(positive(input.count) || 1)));
  if (!width || !height) return [];
  /**
   * Doar benzile care taie toată lățimea taie și verticala (o coloană de reacții nu ia toată înălțimea, iar
   * punctele stau la stânga ei). Limita de sus vine din benzile lipite de marginea de sus, cea de jos din
   * **orice** bandă care începe mai jos — descrierea nu atinge marginea de jos (stă deasupra benzii de la
   * poale), dar un punct sub ea ar fi tot ascuns de cuvinte.
   */
  const full = zones.filter((zone) => zone.rect.left <= 0 && zone.rect.left + zone.rect.width >= width);
  const top = full
    .filter((zone) => zone.rect.top <= 0)
    .reduce((lowest, zone) => Math.max(lowest, zone.rect.top + zone.rect.height), 0);
  const bottom = full
    .filter((zone) => zone.rect.top > 0)
    .reduce((highest, zone) => Math.min(highest, zone.rect.top), height);
  if (!(bottom > top)) return [];
  const rail = zones.find((zone) => zone.id === 'rail');
  const freeWidth = rail ? Math.max(0, rail.rect.left) : width;
  const x = Math.round(freeWidth / 2);
  return Array.from({ length: count }, (_, index) => ({
    x,
    y: Math.round(top + ((index + 1) / (count + 1)) * (bottom - top)),
  }));
}

/** Sub asta, o bandă nu încape cu eticheta în ea: coloana de reacții are 44 dp, uneltele 53 dp. */
export const NARROW_ZONE_WIDTH = 150;

/** Locul etichetei unei benzi, în puncte de cadru (nu în dreptunghiul benzii — vezi mai jos de ce). */
export type GuideLabelPlacement = {
  top: number;
  left?: number;
  right?: number;
  maxWidth: number;
  textAlign?: 'right';
};

/**
 * Unde stă eticheta unei benzi, ca să nu taie nici cuvintele, nici pe ea însăși.
 *
 * Regula veche — o pastilă cu `maxWidth: '96%'` în colțul benzii — a produs două etichete ciuntite pe
 * telefon („Uneltele …ui", „Reacțiil…"): o coloană de 44–53 dp nu are loc nici pentru un cuvânt. Și nu era
 * destul să mutăm pastila în stânga benzii cât timp rămânea *copil* al ei: un copil absolut poziționat este
 * măsurat în lățimea părintelui, deci textul se strâmba tot la 53 dp. De aceea etichetele se desenează
 * într-un strat propriu, peste tot cadrul, iar funcția întoarce coordonate de cadru:
 *
 *  · o bandă îngustă (`< NARROW_ZONE_WIDTH`) își ține eticheta **în stânga** ei, lipită de margine, cu
 *    toată lățimea rămasă până la marginea cadrului ca limită (`maxWidth` = `left`), ca să nu iasă din ecran;
 *  · o bandă care are loc deasupra (`top >= 22 dp`) își ține eticheta **deasupra** liniei, ca pastila să nu
 *    acopere primul rând de cuvinte al zonei pe care o apără (descrierea, poalele paginii);
 *  · altfel — capul paginii, lipit de marginea de sus — rămâne în interior, în colțul de sus-stânga.
 */
export function guideLabelPlacement(box: GuideRect, frameWidth: number): GuideLabelPlacement {
  const top = box.top >= 22 ? box.top - 18 : box.top + 3;
  if (box.width < NARROW_ZONE_WIDTH) {
    return {
      top,
      right: Math.max(0, Number(frameWidth) - box.left + 6),
      maxWidth: Math.max(72, box.left - 10),
      textAlign: 'right',
    };
  }
  return { top, left: box.left + 4, maxWidth: Math.max(72, box.width - 8) };
}

