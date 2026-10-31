/**
 * Un singur sistem de citire pentru cuvintele care stau peste o imagine.
 *
 * Până la runda 43 fiecare suprafață își socotea singură „umbrela" de sub text: reel-ul avea un gradient
 * fix de `132 + topInset` desenat sub cap, cardul avea vălul de `0.92` la poale, pagina de cuvinte nu avea
 * niciunul, iar previzualizarea compozitorului nu putea spune ce va vedea cititorul. Un număr inventat
 * (`132`) nu are cum să acopere un cap care crește cu fontul cititorului și nici să nu acopere jumătate
 * dintr-o poză luminată; de aceea aici nu există niciun număr inventat:
 *
 *   · **capul** stă cât blocul lui *măsurat* (`onLayout`) plus o penumbră proporțională cu cadrul;
 *   · **descrierea** crește **în sus** de la poale, cât blocul ei măsurat (textul, rândul de acțiuni,
 *     ceasul clipului) plus aceeași penumbră, ancorată jos — așa scrim-ul crește odată cu textul, fără o
 *     înălțime maximă ghicită;
 *   · un cadru fără măsurătoare nu primește niciun scrim (`null`), pentru că un scrim desenat pe o
 *     presupunere este exact defectul pe care îl repară modulul.
 *
 * Modulul este **pur**: nu importă nimic, deci `scripts/test-readability.cjs` îl încarcă în Node simplu.
 * Culoarea nu se decide aici (un cadru de noapte și o pagină de hârtie au cerneală diferită); geometria, da.
 */

/** O oprire de gradient, cu `offset` în 0–1 și `opacity` în 0–1. */
export type ScrimStop = { offset: number; opacity: number };

/** Ce desenează un strat: înălțimea în puncte și opririle gradientului, de sus în jos. */
export type ScrimGeometry = { height: number; stops: ScrimStop[] };

/**
 * Numerele sistemului. Penumbra nu este un număr fix: este o parte din cadru, ținută între 20 și 44 de
 * puncte, pentru că un telefon de 1021 de puncte și un card de 275 nu au nevoie de aceeași tranziție.
 */
export const READABILITY = {
  /** Cât la sută din înălțimea cadrului este tranziția dintre scrim și imagine. */
  featherShare: 0.045,
  /** Cea mai mică tranziție, în puncte: sub atât marginea se vede ca o tăietură. */
  featherMin: 20,
  /** Cea mai mare tranziție, în puncte: peste atât scrim-ul mănâncă prea mult din poză. */
  featherMax: 44,
  /** Scrim-ul capului: aproape opac sub ceas, deschis la baza lui. */
  header: { top: 0.96, mid: 0.78, solid: 0.66 },
  /** Scrim-ul descrierii: opac la poale, zero la marginea de sus a benzii. */
  description: { body: 0.62 },
  /**
   * Hârtia: **aceeași formă, altă greutate** (runda 45).
   *
   * Până acum o pagină de cuvinte nu primea niciun strat, iar rezultatul se vedea pe telefon: un text
   * publicat nu avea nici banda capului, nici banda de sub cuvinte, deși un reel deschis în același loc
   * le avea pe amândouă. Regula veche („hârtia nu are nevoie de umbră") era o presupunere despre
   * contrast, nu o măsurătoare: pagina are nevoie de **aceeași delimitare** pe care o are un cadru cu
   * imagine, doar că pe cerneala deschisă a hârtiei o bandă de `0.96` ar fi fost o placă neagră.
   *
   * Aici stă singura diferență dintre cele două terenuri — cât de tare se vede banda. Geometria, penumbra
   * și măsurătoarea rămân exact aceleași funcții pentru amândouă.
   */
  paper: {
    /** Capul paginii: se vede, dar lasă hârtia să rămână hârtie. */
    header: { top: 0.26, mid: 0.16, solid: 0.09 },
    /** Cuvintele paginii: un văl cald, nu o placă. */
    description: { body: 0.13 },
  },
} as const;

/** Cât de înaltă este tranziția unui cadru înalt de `frame` puncte. */
export function scrimFeather(frame: number): number {
  const height = Math.max(0, Number(frame) || 0);
  const share = Math.round(height * READABILITY.featherShare);
  return Math.max(READABILITY.featherMin, Math.min(READABILITY.featherMax, share));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Trei zecimale: un gradient nu are nevoie de mai multă precizie decât are ecranul. */
function round(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function stopsOf(entries: readonly ScrimStop[]): ScrimStop[] {
  const clean = entries.map((stop) => ({ offset: round(stop.offset), opacity: round(stop.opacity) }));
  // Un gradient cu opriri care se întorc ar fi desenat altfel de fiecare motor: le ținem în ordine.
  for (let index = 1; index < clean.length; index += 1) {
    if (clean[index].offset < clean[index - 1].offset) clean[index].offset = clean[index - 1].offset;
  }
  return clean;
}

/**
 * Scrim-ul **capului**: banda solidă de sub ceas, care se deschide sub ultima linie a capului.
 *
 * `block` este înălțimea măsurată a blocului de autor (`onLayout` pe cap, care include deja `paddingTop`
 * pe un cadru în care capul este lipit de margine). `above` este partea pe care măsurătoarea nu o vede —
 * pe pagina de lectură capul stă într-un `View` cu `paddingTop` propriu —, ca scrim-ul să înceapă la
 * marginea cadrului, nu la marginea blocului.
 */
export function headerScrim(input: { block: number; above?: number; frame: number; ground?: ReadabilityGround }): ScrimGeometry | null {
  const block = Math.max(0, Number(input.block) || 0);
  const above = Math.max(0, Number(input.above) || 0);
  const frame = Math.max(0, Number(input.frame) || 0);
  const solid = block + above;
  // Fără măsurătoare nu se desenează nimic: un scrim pe o presupunere acoperă o poză în numele unui text
  // care poate să nu fie acolo.
  if (!(solid > 0) || !(frame > 0)) return null;
  const feather = scrimFeather(frame);
  /**
   * Pe hârtie banda se oprește **la marginea de jos a capului**: pagina începe chiar acolo, iar o
   * penumbră de 44 de puncte ar intra peste primele două rânduri de cuvinte și ar fi acoperită de hârtia
   * paginii, care se desenează după ea. Deci tranziția se face în interiorul benzii, nu după ea.
   */
  if (input.ground === 'paper') {
    const height = Math.round(solid);
    if (!(height > 0)) return null;
    const weights = READABILITY.paper.header;
    return {
      height,
      stops: stopsOf([
        { offset: 0, opacity: weights.top },
        { offset: 0.6, opacity: weights.mid },
        { offset: 0.88, opacity: weights.solid },
        { offset: 1, opacity: 0 },
      ]),
    };
  }
  const height = Math.round(solid + feather);
  const share = clamp01(solid / height);
  return {
    height,
    stops: stopsOf([
      { offset: 0, opacity: READABILITY.header.top },
      { offset: share * 0.62, opacity: READABILITY.header.mid },
      { offset: share, opacity: READABILITY.header.solid },
      { offset: 1, opacity: 0 },
    ]),
  };
}

/**
 * Scrim-ul **descrierii**: ancorat la poale, înalt cât blocul măsurat, deschis în sus.
 *
 * Blocul de jos al compoziției (numele autorului pe un reel, textul, `Citește tot`, rândul de acțiuni și
 * ceasul clipului) este singurul lucru care știe cât loc are nevoie; scrim-ul îl urmează, deci un text de
 * trei rânduri și unul de doisprezece rânduri primesc fiecare exact banda lor.
 */
export function descriptionScrim(input: { block: number; frame: number }): ScrimGeometry | null {
  const block = Math.max(0, Number(input.block) || 0);
  const frame = Math.max(0, Number(input.frame) || 0);
  if (!(block > 0) || !(frame > 0)) return null;
  const feather = scrimFeather(frame);
  const height = Math.round(block + feather);
  const fade = clamp01(feather / height);
  return {
    height,
    stops: stopsOf([
      { offset: 0, opacity: 0 },
      { offset: fade, opacity: READABILITY.description.body },
      { offset: 1, opacity: READABILITY.description.body },
    ]),
  };
}

/**
 * Ce fel de teren are cadrul — adică ce greutate au benzile lui.
 *
 *   `night` — un cadru cu imagine (sau cu placa de jungle sub cuvinte): capul și descrierea stau pe ceva
 *             ce nu este al lor, deci umbra este aproape opacă;
 *   `paper` — o pagină de cuvinte: **aceleași benzi**, cu greutatea din `READABILITY.paper`. Runda 44 le
 *             oprea de tot aici, iar pe telefon asta se vedea exact ca defectul raportat: un text
 *             publicat nu avea nici banda capului, nici banda de sub cuvinte. Hârtia nu are nevoie de o
 *             placă neagră, dar are nevoie de delimitarea pe care o are orice alt cadru.
 */
export type ReadabilityGround = 'night' | 'paper';

/**
 * Banda care se desenează **în interiorul** blocului de cuvinte, nu la marginea cadrului.
 *
 * Este forma de care are nevoie o pagină: cuvintele sunt așezate de flux la locul lor (nu lipite de poale),
 * deci o bandă ancorată la poale ar fi acoperit jumătate de pagină goală. Aici înălțimea este **exact**
 * blocul măsurat, iar tranziția se face în interiorul lui — un strat mai înalt decât părintele ar fi tăiat
 * de marginea paginii. Deci: zero la primul rând, cerneala la ultimul.
 *
 * `ground` schimbă doar cât de tare se vede (noaptea `0.62`, hârtia `0.13`); măsurătoarea este aceeași.
 */
export function wordsScrim(input: { block: number; frame: number; ground?: ReadabilityGround }): ScrimGeometry | null {
  const block = Math.max(0, Number(input.block) || 0);
  const frame = Math.max(0, Number(input.frame) || 0);
  if (!(block > 0) || !(frame > 0)) return null;
  const height = Math.round(block);
  if (!(height > 0)) return null;
  const body = input.ground === 'paper' ? READABILITY.paper.description.body : READABILITY.description.body;
  /** Tranziția nu poate fi mai mare decât banda: un bloc de două rânduri rămâne o bandă, nu o penumbră. */
  const fade = clamp01(Math.min(scrimFeather(frame), height * 0.6) / height);
  return {
    height,
    stops: stopsOf([
      { offset: 0, opacity: 0 },
      { offset: fade, opacity: body },
      { offset: 1, opacity: body },
    ]),
  };
}
