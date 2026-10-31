/**
 * Cât din ecran acoperă tastatura — o singură socoteală, pentru toate suprafețele.
 *
 * Runda 46 (owner): „când se deschide tastatura ca să scriu, conținutul postării trebuie să se adapteze
 * înălțimii rămase". Pe telefonul de dezvoltare (Android 15, edge-to-edge) fereastra **nu** se mai
 * micșorează pentru tastatură — deci o măsurătoare `onLayout` rămâne înălțimea întreagă și conținutul stă
 * sub tastatură. Pe alte telefoane, fereastra *se* micșorează. O socoteală care ar scădea orbeste înălțimea
 * raportată ar număra tastatura de două ori pe al doilea fel de telefon, iar conținutul ar sări.
 *
 * De aceea aici nu se presupune niciun fel: se compară fereastra de acum cu cea mai înaltă fereastră
 * văzută în sesiune (`baseHeight`, măsurată înainte de prima tastatură). Ce a luat deja platforma se scade
 * din ce raportează tastatura, iar rezultatul este exact partea pe care suprafața trebuie să o cedeze.
 *
 * Modulul este **pur**: nu importă nimic, deci `scripts/test-keyboard-space.cjs` îl încarcă în Node simplu.
 */

export type KeyboardSpaceInput = {
  /** Cea mai înaltă fereastră văzută în sesiune: fereastra fără tastatură. */
  baseHeight: number;
  /** Fereastra de acum (`useWindowDimensions().height`). */
  windowHeight: number;
  /** Ce raportează tastatura (`Keyboard` evenimentul `keyboardDidShow`, sau `0` când e închisă). */
  keyboardHeight: number;
  /** Cât de mică poate ajunge zona de conținut, în puncte. Sub atât, tastatura acoperă oricum. */
  minimum?: number;
};

export type KeyboardSpace = {
  /** Partea din fereastră pe care tastatura o acoperă **fără** ca platforma să fi micșorat fereastra. */
  covered: number;
  /** Înălțimea rămasă pentru conținut, niciodată sub `minimum`. */
  available: number;
};

/** Cea mai mică zonă de conținut pe care o păstrăm: un rând de cuvinte și controalele lui. */
export const KEYBOARD_MIN_CONTENT = 220;

export function keyboardSpaceOf(input: KeyboardSpaceInput): KeyboardSpace {
  const base = Math.max(0, Number(input.baseHeight) || 0);
  const window = Math.max(0, Number(input.windowHeight) || 0);
  const keyboard = Math.max(0, Number(input.keyboardHeight) || 0);
  const minimum = Math.max(0, Number(input.minimum) || 0) || KEYBOARD_MIN_CONTENT;
  /**
   * `resized` este partea pe care platforma a luat-o deja din fereastră (`adjustResize`). Ea nu trebuie
   * scăzută a doua oară: tastatura raportează înălțimea ei întreagă indiferent de cine a cedat locul.
   */
  const resized = Math.max(0, base - window);
  const covered = Math.max(0, keyboard - resized);
  const room = (window > 0 ? window : base) - covered;
  return { covered, available: Math.max(minimum, Math.round(room)) };
}

/**
 * Cât de sus urcă tastatura, din două măsurători ale ei.
 *
 * Runda 47, citit de pe telefon cu `adb logcat` (31 octombrie 2026): pentru Gboard, evenimentul raporta
 * `endCoordinates.height = 399.5` dp, dar banda tastaturii începea la 578.5 dp pe un ecran de 1021.5 dp —
 * adică **443 dp**. Diferența de 43.5 dp este bara de unelte a tastaturii (iconițele, GIF, emoji,
 * microfon), care nu intră în cifra raportată. O foaie așezată după prima cifră lăsa câmpul de comentariu
 * exact în acea bandă, sub taste.
 *
 * De aceea se citesc amândouă: înălțimea raportată și muchia de sus (`screenY`), iar din ele se păstrează
 * **cea mai mare**. Muchia nu poate subestima tastatura, deci nimic nu rămâne sub ea; iar dacă o tastatură
 * nu raportează `screenY` (sau raportează o valoare absurdă), rămâne prima cifră.
 */
export function keyboardHeightOf(input: { reported: number; screenY: number; windowHeight: number }): number {
  const reported = Math.max(0, Math.round(Number(input.reported) || 0));
  const top = Math.round(Number(input.screenY) || 0);
  const window = Math.max(0, Math.round(Number(input.windowHeight) || 0));
  const fromEdge = top > 0 && window > 0 && top < window ? window - top : 0;
  return Math.max(reported, fromEdge);
}

/**
 * Insetul de jos care mai trebuie plătit când tastatura este deschisă.
 *
 * Bara de gesturi stă **sub** tastatură, nu lângă ea: dacă ecranul ar adăuga și `insets.bottom` peste
 * înălțimea tastaturii, ar lăsa o bandă moartă între câmp și tastatură. Când tastatura este închisă,
 * insetul rămâne al lui.
 */
export function bottomInsetWithKeyboard(inset: number, covered: number): number {
  const bottom = Math.max(0, Number(inset) || 0);
  return Math.max(0, Number(covered) || 0) > 0 ? 0 : bottom;
}

/**
 * Cât loc poate lua conținutul unei zone care are deja un cadru de sus și de jos.
 *
 * `chromeAbove` și `chromeBelow` sunt măsurate de suprafață (un antet, o bară de unelte), nu ghicite:
 * funcția doar le scade și ține rezultatul peste minim.
 */
export function contentBudget(input: { available: number; chromeAbove?: number; chromeBelow?: number; minimum?: number }): number {
  const available = Math.max(0, Number(input.available) || 0);
  const above = Math.max(0, Number(input.chromeAbove) || 0);
  const below = Math.max(0, Number(input.chromeBelow) || 0);
  const minimum = Math.max(0, Number(input.minimum) || 0) || KEYBOARD_MIN_CONTENT;
  return Math.max(minimum, Math.round(available - above - below));
}
