/* global __dirname */
// Compozitorul de TEXT, după runda a treia: o singură temă (Kindle), fără selectoare de temă sau de aliniere,
// cu două comutatoare segmentate — „Cine vede" (Public / Privat / Doar eu) și „Proveniență" —, cu titlul păstrat
// și cu locația citită din telefon. Testul citește sursa, fiindcă fiecare regulă de aici este o decizie despre
// ce *nu* mai are voie să existe pe ecran, iar un control scos nu se poate testa altfel decât prin absența lui.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Sursa fără proza ei: o propoziție dintr-un comentariu nu este un control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const composer = code(read('src/app/text.tsx'));

test('selectorul de temă și cel de aliniere au dispărut, iar pagina scrie tema Kindle implicită', () => {
  assert.doesNotMatch(composer, /TEXT_THEMES/, 'șase mostre de temă nu mai sunt importate');
  assert.doesNotMatch(composer, /TEMĂ/, 'secțiunea TEMĂ nu mai există');
  assert.doesNotMatch(composer, /pagePaletteOf/, 'mostrele nu mai pictează tema');
  assert.doesNotMatch(composer, /TEXT_ALIGNS/, 'selectorul de aliniere nu mai există');
  assert.doesNotMatch(composer, /ALINIERE/, 'secțiunea ALINIERE nu mai există');
  /** Nici urmele lor: un stil rămas fără control este spațiul gol pe care ownerul l-a cerut scos. */
  assert.doesNotMatch(composer, /themeRow/, 'rândul de teme a fost scos din stiluri');
  assert.doesNotMatch(composer, /themeDot/, 'punctul de accent al temelor a fost scos');
  assert.match(composer, /readTextStyle\(\{ \.\.\.stored\.style, theme: TEXT_DEFAULT_THEME \}\)/,
    'tema paginii este cea Kindle, implicită');
});

test('ce rămâne din tipografie este tot ce schimbă felul în care sunt așezate cuvintele', () => {
  /**
   * The three rows of chips left the scrolling column in the text-integrity round: a face, a measure and an
   * emoji live in one pinned toolbar under the page (`TextToolbar`), one panel at a time, so the author
   * chooses them without scrolling past the article. What stays in the composer is the *rule* each control
   * writes through — a face is a style, a measure is the page's own typography with an undo snapshot, an
   * emoji is a keystroke — and the lists themselves belong to the toolbar.
   */
  assert.match(composer, /<TextToolbar/, 'bara de tipografie stă sub pagină, lipită de deget');
  assert.match(composer, /onFont=\{\(next\) => applyStyle\(\{ font: next \}\)\}/, 'litera se scrie în stilul paginii');
  assert.match(composer, /onMeasure=\{\(next\) => applyDocument\(setDocumentTypography\(draft\.document, next\), true\)\}/,
    'mărimea se scrie în documentul paginii, cu instantaneu de undo');
  assert.match(composer, /onEmoji=\{insertEmoji\}/, 'emoji trec prin câmp, nu prin pagină');
  /** Nici urmele secțiunilor: un rând de chipuri rămas în coloană ar fi exact spațiul gol pe care ownerul l-a cerut scos. */
  assert.doesNotMatch(composer, /TEXT_FONTS/, 'lista de litere nu mai este scrisă în compozitor');
  assert.doesNotMatch(composer, /LITERĂ|MĂRIME|>EMOJI</, 'nici o secțiune de tipografie în coloana paginii');
  assert.doesNotMatch(composer, /emojiRow/, 'rândul de emoji a fost scos din stiluri');

  const toolbar = code(read('src/components/TextToolbar.tsx'));
  assert.match(toolbar, /TEXT_FONTS\.map/, 'familiile de litere rămân cele existente, plus cele trei noi');
  /**
   * Runda 47: ușa de mărime nu mai deschide un panou cu cinci chipuri (`auto`, `small`, `medium`, `large`,
   * `xlarge`), ci **ciclu** prin cele trei mărimi cerute de owner. Testul ține regula nouă, iar absența
   * listei vechi este parte din ea: o a patra mărime oferită ar contrazice „exact trei".
   */
  assert.match(toolbar, /nextEditorialTypography\(measure\)/, 'ușa de mărime trece la pasul următor al ciclului');
  assert.doesNotMatch(toolbar, /EDITORIAL_TYPOGRAPHIES\.map/,
    'mărimile nu mai sunt o listă de chipuri: ciclul are exact trei pași, iar „auto" nu este un al patrulea');
  assert.match(toolbar, /TEXT_EMOJI_GROUPS\.map/, 'emoji vin din grupurile locale, fără rețea');
  assert.match(toolbar, /fontFamilyFor\(entry\.id, Platform\.OS\)/,
    'fiecare chip de literă este scris în litera lui, nu într-o listă de nume');
  /** Patru uși într-un singur rând: litera, mărimea, emoji și tastatura. */
  for (const door of ['face', 'measure', 'emoji']) {
    assert.match(toolbar, new RegExp(`door\\('${door}'`), `ușa ${door} este în rând`);
  }
  assert.match(toolbar, /accessibilityLabel="Tastatură"/, 'tastatura este a patra ușă');
});

test('titlul rămâne în compozitor, opțional, cu limita serverului', () => {
  assert.match(composer, /label="Titlu"/, 'titlul este încă acolo');
  assert.match(composer, /maxLength=\{PUBLISHING_LIMITS\.title\}/, 'titlul păstrează limita serverului');
  assert.match(composer, /publishing: \{ \.\.\.draft\.publishing, title: value \}/,
    'titlul se scrie în detaliile de publicare');
  assert.doesNotMatch(composer, /!draft\.publishing\.title/, 'titlul nu blochează publicarea: contractul rămâne opțional');
});


test('„Cine vede" este un comutator cu exact trei poziții, cu valorile din spatele lor', () => {
  assert.match(composer, /const VISIBILITY_CHOICES: readonly \{ id: PostVisibility; label: string; note: string \}\[\] = \[/,
    'pozițiile sunt date ca o listă de valori de backend');
  assert.match(composer, /\{ id: 'public', label: 'Public'/, 'prima poziție este Public');
  assert.match(composer, /\{ id: 'friends', label: 'Privat'/, 'a doua poziție este Privat, pe nivelul mutual');
  assert.match(composer, /\{ id: 'private', label: 'Doar eu'/, 'a treia poziție este Doar eu, pe nivelul owner-only');
  assert.equal((composer.match(/\{ id: '(public|followers|friends|private)', label:/g) ?? []).length, 3,
    'exact trei poziții de vizibilitate sunt oferite');
  assert.match(composer, /const LEGACY_VISIBILITY: \{ id: PostVisibility; label: string; note: string \} = \{\s*id: 'followers'/,
    'o ciornă cu „followers" își păstrează nivelul, vizibil');
  assert.match(composer, /draft\.visibility === 'followers'\s*\? \[LEGACY_VISIBILITY, \.\.\.VISIBILITY_CHOICES\]/,
    'poziția veche apare doar când ciorna o are');

test('„Proveniență" este un comutator cu toate cele patru valori acceptate de server', () => {
  assert.match(composer, /\{ id: 'NOT_DECLARED', label: 'Nu declar' \}/, 'nedeclaratul rămâne o poziție');
  assert.match(composer, /\{ id: 'CAMERA_CAPTURED_DECLARED', label: 'Făcut de mine' \}/, 'declarația camerei rămâne');
  assert.match(composer, /\{ id: 'AI_ASSISTED', label: 'AI asistat' \}/, 'asistatul de AI rămâne');
  assert.match(composer, /\{ id: 'AI_GENERATED', label: 'Generat de AI' \}/, 'generatul de AI rămâne');
  assert.equal(
    (composer.match(/\{ id: '(NOT_DECLARED|CAMERA_CAPTURED_DECLARED|AI_ASSISTED|AI_GENERATED)', label:/g) ?? []).length,
    4,
    'valorile sunt exact cele patru din `CONTENT_PROVENANCE`',
  );
  assert.match(composer, /onChange=\{\(value\) => edit\(\{ provenance: value \}\)\}/, 'alegerea se scrie în ciornă');
  assert.match(composer, /provenance: draft\.provenance,/, 'și pleacă la server în corpul publicării');
  assert.match(composer, /options=\{PROVENANCE_CHOICES\.map/, 'comutatorul de proveniență este cel comun');
  assert.match(composer, /scroll\s*\n\s*\/>/, 'rândul de proveniență este cel derulabil, nu cel cu trei poziții fixe');
});

test('comentariile și distribuirea rămân două întrerupătoare independente', () => {
  assert.match(composer, /label="Permite comentarii"/, 'comentariile au întrerupătorul lor');
  assert.match(composer, /value=\{draft\.publishing\.allowComments\}/, 'starea comentariilor vine din detaliile de publicare');
  assert.match(composer, /value=\{draft\.publishing\.allowRepost\}/, 'starea distribuirii vine din detaliile de publicare');
  assert.match(composer, /allowComments: value \}/, 'comutarea comentariilor se scrie în detaliile de publicare');
  assert.match(composer, /allowRepost: value \}/, 'comutarea distribuirii se scrie în detaliile de publicare');
  assert.match(composer, /<Switch/, 'sunt întrerupătoare, nu comutatoare cu poziții');
});

test('comutatorul segmentat este un singur control, folosit de amândouă întrebările', () => {
  assert.match(composer, /function Segment<T extends string>\(\{/, 'un singur comutator segmentat');
  assert.match(composer, /accessibilityRole="radio"/, 'fiecare poziție se anunță ca o alegere exclusivă');
  assert.match(composer, /accessibilityState=\{\{ selected: active, checked: active \}\}/,
    'cititorul de ecran aude care poziție este aleasă');

test('serverul aplică aceleași două comutatoare, nu doar ecranul', () => {
  // Un comutator care doar ascunde butonul de comentariu ar fi o promisiune goală: serverul are ultimul cuvânt.
  const repo = readFileSync(resolve(ROOT, '..', 'nexus-web', 'lib', 'repo.js'), 'utf8');
  const api = readFileSync(resolve(ROOT, '..', 'nexus-web', 'lib', 'api.js'), 'utf8');
  assert.match(repo, /if \(!publishingFromRow\(this\.getPostById\(postId\)\)\.allowComments\) throw new Error\('POST_COMMENTS_DISABLED'\)/,
    'comentariile oprite sunt refuzate de server, la scriere și la răspuns');
  assert.match(api, /POST_COMMENTS_DISABLED'\) return json\(res, 403/, 'refuzul ajunge la client ca 403, nu ca 500');
  assert.match(repo, /if \(active && !publishingFromRow\(this\.getPostById\(postId\)\)\.allowRepost\) throw new Error\('POST_REPOST_DISABLED'\)/,
    'distribuirea oprită este refuzată de server');
  assert.match(api, /allowRepost === false\) return json\(res, 403/, 'refuzul distribuirii este tot un 403');
});

  assert.match(composer, /if \(!active\) onChange\(option\.id\)/, 'o poziție deja aleasă nu mai trimite nimic');
  assert.match(composer, /minHeight: 44/, 'fiecare poziție este o țintă de 44dp pentru deget');
  assert.equal((composer.match(/<Segment\s/g) ?? []).length, 2, 'exact două comutatoare: vizibilitate și proveniență');
});

  assert.match(composer, /onChange=\{\(value\) => edit\(\{ visibility: value \}\)\}/, 'alegerea se scrie în ciornă');
  assert.match(composer, /visibility: draft\.visibility,/, 'și pleacă la server în corpul publicării');
});
