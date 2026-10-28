/**
 * The one answer to "should this reader be offered a translation?".
 *
 * The rule the owner wrote on 30 October 2026 replaces the older one of 25 October: `Vezi traducerea`
 * was printed on almost every post because the composer publishes no language at all, and the old rule
 * read a missing language as "prove to me that this is readable" — which no page ever proved. The
 * reader is now asked only when the post is in a language that is *known* and different from the one
 * the app is in:
 *
 *   | device | post      | door |
 *   |--------|-----------|------|
 *   | ro     | ro        | no   |
 *   | ro     | en        | yes  |
 *   | pl     | pl        | no   |
 *   | pl     | ro        | yes  |
 *   | any    | unknown   | no   |
 *
 * Three layers, in this order, and never a network call:
 *
 *   1. the language the row itself declares (`posts.language`, `api.js:739`), normalized to its primary
 *      subtag — `ro-RO` and `ro` are the same reader and the same post;
 *   2. otherwise a local detection of the *caption* (`detectLanguage`), cached against the words that
 *      were scored, so a feed that re-renders sixty times a second scores each post once;
 *   3. otherwise nothing: no language means no door. A name, a hashtag, a link and an emoji-only post
 *      are not texts a reader can be told to translate.
 *
 * The module imports nothing, so `scripts/test-language.cjs` loads it with `typescript.transpileModule`
 * and runs it in plain Node.
 */

/** A language tag reduced to its primary subtag: `ro-RO`, `ro_RO` and ` RO ` all answer `ro`. */
export function languageCodeOf(value: unknown): string {
  if (typeof value !== 'string') return '';
  const tag = value.trim().toLowerCase().replace(/_/g, '-');
  if (!tag) return '';
  const primary = tag.split('-')[0];
  return /^[a-z]{2,3}$/.test(primary) ? primary : '';
}

/** A declared language that means "nobody said": the server's own `und` default. */
const UNDETERMINED = new Set(['und', 'zxx', 'mul', 'mis']);

/**
 * The language the app is reading in.
 *
 * The phone's locale cannot change while the bundle is alive, so it is measured once
 * (`Intl.DateTimeFormat().resolvedOptions().locale` — the platform's own answer, no dependency and no
 * network). An explicit choice can override it through `setReaderLanguage`, which is what makes the
 * decision follow the active language instead of the boot one; every subscriber is told, and the
 * surfaces that ask are re-rendered.
 */
let deviceLanguageCache: string | null = null;
let readerOverride: string | null = null;
const listeners = new Set<() => void>();

/** The language the phone itself is set to, or `''` when the runtime cannot tell (a bare test runner). */
export function deviceLanguage(): string {
  if (deviceLanguageCache !== null) return deviceLanguageCache;
  try {
    deviceLanguageCache = languageCodeOf(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    deviceLanguageCache = '';
  }
  return deviceLanguageCache;
}

/** The language a post's body should be read in: the app's choice, or the phone's own. */
export function activeLanguage(): string {
  return languageCodeOf(readerOverride) || deviceLanguage();
}

/**
 * Choose the language the reader is in (`null` goes back to the phone's own).
 *
 * Nothing changes — and nobody is told — when the answer is the same, so a settings screen that sets
 * its own current value cannot loop a render.
 */
export function setReaderLanguage(value: string | null): void {
  const next = languageCodeOf(value) || null;
  if (next === readerOverride) return;
  readerOverride = next;
  for (const listener of Array.from(listeners)) listener();
}

/** Told when the active language changes (for `useSyncExternalStore`). */
export function subscribeReaderLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Whether `Vezi traducerea` is worth offering for a post in `postLanguage`.
 *
 * Unknown on either side answers `false`: the owner's rule is that a door nobody needs is worse than a
 * door that is missing, and a reader whose app cannot say what language it is in is not a reader who
 * can be told that this page is foreign.
 */
export function needsTranslation(postLanguage: unknown, readerLanguage: string = activeLanguage()): boolean {
  const post = languageCodeOf(postLanguage);
  if (!post || UNDETERMINED.has(post)) return false;
  const reader = languageCodeOf(readerLanguage);
  if (!reader) return false;
  return post !== reader;
}

/**
 * The words of each language this detector knows, scored by how often they appear.
 *
 * The lists are deliberately *function words*: an author writes about anything, but every language
 * spells its own `and`, `not`, `with` and `this`. Content words (`photograph`, `munte`) would score a
 * post about mountains in a language the author does not write, which is exactly the mistake this
 * module must not make.
 */
const PROFILES: Record<string, string> = {
  ro: 'și în nu cu la de al ale ai este sunt că pe pentru din se mai ca dar ce o un unei unui să fi fost am are avea eu tu el ea noi voi ei mă te îl ne vă îi lui care când cum unde dacă sau foarte acum aici acolo asta acest această toate tot după fără între sub peste iar numai doar azi mâine oameni fiind poate trebuie chiar despre către asupra lor meu mea tău ta său sa noastre vostru',
  pl: 'i w z na się nie że do to jest są jak co ale po od za przez dla tym tego które który która jako tak już jeszcze tylko bardzo też oraz lub gdy bo żeby można będzie był była było były mam masz ma mają mój moja twoje swoim swój ten ta te tych przy pod nad bez między kiedy gdzie dlaczego ponieważ więc jednak nawet wszystko coś ktoś nic dnia roku lat razem także czyli jeśli aby przed poza podczas',
  en: 'the a an and or but is are was were be been have has had do does did i you he she it we they my your his her our their this that these those to of in on at for with from by about as not no yes so if then than there here when where what who how why very just now today tomorrow because while all some any more most can could will would should may might must also only still ever never',
  de: 'der die das und ist sind nicht ich du er sie es wir ihr mit für auf aus bei nach von zu den dem des ein eine einen einem einer auch aber oder wenn dass wie was wer wo sehr noch nur schon immer heute morgen über unter zwischen durch gegen ohne um',
  fr: 'le la les un une des et est sont je tu il elle nous vous ils elles pas ne pour dans sur avec sans par au aux du de ce cette ces qui que quoi quand où mais ou si très plus moins aussi encore toujours jamais aujourd hui demain être avoir fait comme leur notre votre',
  es: 'el la los las un una unos unas y es son no yo tú él ella nosotros vosotros ellos con para por en de del al que qué como cuándo dónde pero o si muy más menos también todavía siempre nunca hoy mañana está están hay ser tener hecho porque cuando',
  it: 'il lo la i gli le un una e è sono non io tu lui lei noi voi loro con per in di del della che come quando dove ma o se molto più anche ancora sempre mai oggi domani essere avere fatto questo questa quello quella perché',
};

/** The letters a language spells that its neighbours do not — the strongest local signal there is. */
const LETTERS: Record<string, string> = {
  ro: 'ăâîșț',
  pl: 'ąćęłńóśźż',
  de: 'äöüß',
  fr: 'àâçéèêëîïôûùœ',
  es: 'ñáíóú¿¡',
  it: 'àèéìòù',
};

const STOPWORDS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(PROFILES).map(([code, words]) => [code, new Set(words.split(/\s+/))]),
);

/** What one text says about itself, before any decision is taken from it. */
export type LanguageReading = {
  /** The winner, or `''` when the text carries no recognisable word. */
  language: string;
  /** The winner's score. */
  score: number;
  /** The next language's score — a close second means a mixed page, which is not translated. */
  runnerUp: number;
  /** How many words were actually examined (letters only). */
  tokens: number;
  /** How many letters those words carried. */
  letters: number;
};

/**
 * The words a text is scored on: letters with their diacritics, never a link, a mention, a tag or a
 * number. `https://…`, `#munte` and `@ana` are names, not sentences, and counting them would let a post
 * of three hashtags vote for a language.
 *
 * One-letter words are kept: Polish spells `i` ("and"), `w` ("in") and `z` ("with") with a single
 * letter, so dropping them threw away the three strongest proofs a Polish page has.
 */
function wordsOf(text: string): string[] {
  return String(text)
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, ' ')
    .replace(/[#@][\p{L}\p{N}_]+/gu, ' ')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * Score a text against every profile. Exported because the test reads the *reading*, not only the
 * verdict: a rule about confidence cannot be checked from a single string.
 */
export function readLanguage(text: unknown): LanguageReading {
  const words = wordsOf(typeof text === 'string' ? text : '');
  const letters = words.reduce((total, word) => total + word.length, 0);
  const scores: Record<string, number> = {};
  for (const word of words) {
    for (const [code, stopwords] of Object.entries(STOPWORDS)) {
      if (stopwords.has(word)) scores[code] = (scores[code] ?? 0) + 1;
    }
    for (const [code, alphabet] of Object.entries(LETTERS)) {
      if (Array.from(word).some((letter) => alphabet.includes(letter))) {
        scores[code] = (scores[code] ?? 0) + 1.5;
      }
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const best = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  return {
    language: best ? best[0] : '',
    score: best ? best[1] : 0,
    runnerUp,
    tokens: words.length,
    letters,
  };
}

/**
 * The language of a text, or `''` when the reading is not trustworthy.
 *
 * A page has to earn its verdict: at least three words and twelve letters (a name, a hashtag and a
 * two-word greeting are not evidence), a winner worth two hits, a winner that owns at least a seventh
 * of the words, a lead over the second language of nearly 2× **and** at least two points of daylight.
 * Anything closer is a mixed page, and a mixed page keeps the door shut instead of guessing which half
 * is the original: a reader who is offered a translation of words already in their language is exactly
 * the defect this round exists to remove.
 */
export function detectLanguage(text: unknown): string {
  const reading = readLanguage(text);
  if (reading.tokens < 3 || reading.letters < 12) return '';
  if (reading.score < 2) return '';
  if (reading.score < reading.tokens * 0.15) return '';
  if (reading.runnerUp > 0 && reading.score < reading.runnerUp * 1.8) return '';
  if (reading.score - reading.runnerUp < 1.5) return '';
  /**
   * A winner that only owns half of its own page is a page written in two languages, even when the
   * other half is too short to be recognised. A monolingual paragraph matches a function word every
   * second word or so (English's `the/and/to/of`, Romanian's `și/cu/la/de`); a page that does not is
   * mixed, and a mixed page is not translated.
   */
  if (reading.runnerUp > 0 && reading.score < reading.tokens * 0.55) return '';
  return reading.language;
}

/**
 * The cache that keeps detection off the render path.
 *
 * The key is the scored excerpt, so the same words — the same post, the same re-render, a feed scrolled
 * away from and back — cost one pass. It is bounded because a session can read thousands of posts and a
 * detector that grows with them is a leak nobody would look for.
 */
const CACHE_LIMIT = 256;
const cache = new Map<string, string>();

function excerptOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

/** Detection for one caption, remembered against the excerpt it scored. */
export function detectCached(text: unknown): string {
  if (typeof text !== 'string') return '';
  const excerpt = excerptOf(text);
  if (!excerpt) return '';
  const known = cache.get(excerpt);
  if (known !== undefined) return known;
  const language = detectLanguage(excerpt);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(excerpt, language);
  return language;
}

/** The cache is a cache: a test clears it, the app never does. */
export function clearLanguageCache(): void {
  cache.clear();
}

/** How many texts have been scored and remembered — a diagnostic for the cache test, never for a screen. */
export function languageCacheSize(): number {
  return cache.size;
}

/**
 * The language of a post: what the row says, or what its words say, or `''`.
 *
 * A declared language always wins: it is the author's own metadata (or the server's), and a detector
 * does not get to overrule it. `und` is not a declaration — it is the server's way of saying that
 * nobody wrote one — so it falls through to the caption.
 */
export function postLanguageOf(post?: { language?: unknown; caption?: unknown } | null): string {
  const declared = languageCodeOf(post?.language);
  if (declared && !UNDETERMINED.has(declared)) return declared;
  return detectCached(post?.caption);
}

/**
 * The whole decision, for one post: is this page foreign to the reader in front of it?
 *
 * The mixed-language rule is the one written above — a page whose second language is within 1.8× of the
 * first is not translated at all — and the author's *profile* is never read: nationality and the place
 * an account was registered are not the language of a post.
 */
export function translationForPost(
  post?: { language?: unknown; caption?: unknown } | null,
  readerLanguage: string = activeLanguage(),
): boolean {
  return needsTranslation(postLanguageOf(post), readerLanguage);
}
