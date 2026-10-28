/* global __dirname */
// Originea conținutului, așa cum o citește cititorul (runda 34, §34.6).
//
// Runda 33 a desenat prima dată declarația în antetul postării, cu un prefix „Declarat:” pe toate cele
// trei valori. Decizia proprietarului din runda 34 este mai îngustă: **doar** conținutul asistat ori
// generat de AI primește o linie, cu propoziția „Asistat de AI”, respectiv „Generat cu AI”. Un autor
// obișnuit, o captură de cameră și un post nedeclarat nu tipăresc nimic — altfel eticheta ar apărea pe
// aproape fiecare postare și nu ar spune nimic despre niciuna. Valoarea salvată și validarea ei rămân
// neatinse: s-a schimbat doar ce se vede.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Sursa fără proza ei: o propoziție dintr-un comentariu nu este un control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function load(file) {
  const out = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, () => {
    throw new Error(`${file} nu are voie să importe nimic la rulare`);
  });
  return moduleShim.exports;
}

const { originOf, POST_ORIGIN_LABELS, POST_ORIGIN_HINT } = load('src/lib/postOrigin.ts');

test('doar AI primește o etichetă: asistat și generat, cu propoziția cerută', () => {
  assert.equal(originOf({ provenance: 'AI_ASSISTED' }), 'Asistat de AI');
  assert.equal(originOf({ provenance: 'AI_GENERATED' }), 'Generat cu AI');
  /**
   * Captura de cameră a avut o etichetă în runda 33 („Declarat: cameră”). Proprietarul a cerut ca ea să
   * tacă: camera este felul obișnuit în care se face o postare aici, deci nu ascunde nimic cititorului.
   */
  assert.equal(originOf({ provenance: 'CAMERA_CAPTURED_DECLARED' }), '');
  /**
   * „Nu declar” este un răspuns în compozitor și o absență pe pagină: fiecare postare scrisă înainte de
   * compozitor, și fiecare postare a unui autor care a lăsat bifa implicită, o poartă.
   */
  assert.equal(originOf({ provenance: 'NOT_DECLARED' }), '');
  assert.equal(originOf({}), '');
  assert.equal(originOf(null), '');
  assert.equal(originOf(undefined), '');
  assert.equal(originOf({ provenance: null }), '');
test('eticheta este propoziția autorului, fără prefix și fără promisiunea unei verificări', () => {
  assert.deepEqual(
    Object.entries(POST_ORIGIN_LABELS).filter(([, label]) => label),
    [['AI_ASSISTED', 'Asistat de AI'], ['AI_GENERATED', 'Generat cu AI']],
    'exact cele două declarații care spun ceva au etichete',
  );
  for (const [value, label] of Object.entries(POST_ORIGIN_LABELS)) {
    if (!label) continue;
    // Prefixul „Declarat:” a fost scos la cererea proprietarului; rămâne propoziția, nu eticheta de produs.
    assert.doesNotMatch(label, /^Declarat/, `${value} nu mai poartă prefixul „Declarat:”`);
    // „Verificat”, „real”, „autentic” ar preface propoziția autorului în promisiunea Jungle Book.
    assert.doesNotMatch(label, /verificat|autentic|garantat/i, `${value} nu promite o verificare`);
    assert.ok(label.length <= 26, `${value} încape pe un rând de antet`);
  }
  assert.match(POST_ORIGIN_HINT, /Jungle Book nu verifică/, 'propoziția pentru cititorul de ecran spune și ce nu este');
});

test('antetul postului desenează declarația o singură dată, în afara ușii spre profil', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /import \{ originOf, POST_ORIGIN_HINT \} from '\.\.\/lib\/postOrigin';/,
    'eticheta vine din modulul pur, nu dintr-un șir scris în componentă');
  assert.match(canvas, /const origin = originOf\(post\);/, 'originea se citește o dată pe postare');
  assert.equal(canvas.match(/\{origin \? \(/g)?.length ?? 0, 1, 'o singură etichetă per postare');
  assert.match(canvas, /accessibilityLabel=\{`\$\{origin\}\. \$\{POST_ORIGIN_HINT\}`\}/,
    'cititorul de ecran aude și ce nu este declarația');
  assert.match(canvas, /numberOfLines=\{POST_HEAD\.originLines\}/, 'declarația are un număr de rânduri fix');
  assert.match(canvas, /marginLeft: head\.disc \+ 8/, 'se aliniază cu numele, oricare ar fi mărimea feței');
  /**
   * `{origin ? … : null}` este singura formă: fără etichetă goală, fără spațiu rezervat. Un post nedeclarat
   * ori o captură de cameră păstrează exact antetul pe care îl avea înainte de runda 33.
   */
  assert.match(canvas, /\{origin \? \([\s\S]{0,600}?\) : null\}/, 'fără declarație nu se desenează nimic');
});

test('declarația stă în afara butonului de profil și nu ajunge în celula de arhivă', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  /**
   * Ordinea din sursă este dovada: ușa spre profil se închide (`</Pressable>`) înainte ca eticheta să fie
   * desenată. „Asistat de AI” este o propoziție despre postare, nu un mod de a deschide un profil.
   */
  const door = canvas.indexOf('accessibilityLabel={`Profilul lui @');
  const label = canvas.indexOf('accessibilityLabel={`${origin}. ${POST_ORIGIN_HINT}`}');
  const doorEnd = canvas.indexOf('</Pressable>', door);
  assert.ok(door > 0, 'ușa profilului există');
  assert.ok(label > doorEnd, 'eticheta este după ușă, nu înăuntru');
  /**
   * Celula de 155px a arhivei nu are loc de o propoziție și nu este o suprafață de citire: ramura `tile`
   * se întoarce înainte de antet, deci eticheta nu ajunge acolo.
   */
  const tileBranch = canvas.slice(canvas.indexOf('if (tile) {'), canvas.indexOf('const hasMedia'));
  assert.ok(tileBranch.length > 0, 'ramura celulei există');
  assert.doesNotMatch(tileBranch, /originOf|origin \?/, 'celula de arhivă nu tipărește declarația');
});

test('tipul citit de ecrane are câmpul pe care îl citește eticheta, iar serverul îl trimite', () => {
  const types = code(read('src/lib/socialTypes.ts'));
  assert.match(types, /provenance\?: ContentProvenance \| string \| null;/, 'postarea poartă declarația primită');
  const web = read('../../apps/nexus-web/lib/api.js');
  // Dovada că serverul chiar o trimite: câmpul este în vederea postării (`socialPostView`), nu doar în bază.
  assert.match(web, /^\s*provenance: post\.provenance,$/m, 'vederea postării întoarce declarația');
  const moderation = read('../../apps/nexus-web/lib/moderation.js');
  assert.match(moderation, /NOT_DECLARED/, 'nedeclaratul este valoarea implicită a serverului');
  // Afișarea s-a schimbat, validarea nu: cele patru valori rămân singurele acceptate.
  assert.match(moderation, /"AI_GENERATED",\s*\n\s*"AI_ASSISTED",\s*\n\s*"CAMERA_CAPTURED_DECLARED",/,
    'serverul păstrează cele patru valori declarabile');
});

  assert.equal(originOf({ provenance: '   ' }), '');
  // O valoare pe care versiunea asta nu o cunoaște (un server mai nou, o grafie veche) nu se ghicește.
  assert.equal(originOf({ provenance: 'AI_GENERATED_MAYBE' }), '');
  assert.equal(originOf({ provenance: 'user' }), '');
  assert.equal(originOf({ provenance: 42 }), '');
});
