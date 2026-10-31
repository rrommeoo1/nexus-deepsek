/* global __dirname */
/**
 * Gestul de reactie, verificat pe ce poate fi verificat fara telefon (runda 42).
 *
 * Ownerul a raportat ca glisarea degetului peste emoji merge pe o pagina de cuvinte si „se pierde" pe un
 * reel. Gestul este *unul singur* (`ReactionControl`), deci diferenta nu putea fi in panou: putea fi doar
 * in ce se intampla cu fluxul de atingere si cu firul JavaScript din jurul lui. Telefonul a raspuns la
 * ambele (vezi `HANDOFF.md` §0.42): gestul ajunge la control si pe un reel, iar ce diferea era ca un clip
 * rescria toata compozitia de opt-noua ori pe secunda, pentru bara lui de progres.
 *
 * Ce se tine aici:
 *
 *   urma       `lib/reactionTrace.ts` tine ultimele evenimente ale gestului, ca telefonul sa poata fi
 *              intrebat ce a facut cu degetul (grant / hold / aim / release / terminate);
 *   controlul  `ReactionControl` scrie in urma fiecare decizie si nici un pixel;
 *   ceasul     bara unui clip nu mai este stare React (`Animated.Value`), iar previzualizarea
 *              compozitorului isi primeste ceasul prin `PostCanvas.mediaClock`;
 *   bandă      randul editorului isi rezerva banda pe care pagina o cedeaza (`postPageTopInset`), deci
 *              `×` si `Next` nu mai stau peste avatarul autorului.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

function load(relative, overrides = {}) {
  const compiled = ts.transpileModule(read(relative), {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, (id) => {
    if (id in overrides) return overrides[id];
    throw new Error(`${relative} cere ${id} la rulare`);
  });
  return shim.exports;
}

const trace = load('src/lib/reactionTrace.ts');

test('urma tine ultimele evenimente, in ordine, si nu creste la nesfarsit', () => {
  trace.clearReactionTrace();
  assert.deepEqual(trace.reactionTrace(), [], 'se porneste de la zero');

  trace.traceReaction('grant', 'rail', { x: 1000.4, y: 700.6 });
  trace.traceReaction('hold', 'rail', { open: false });
  for (let index = 0; index <= trace.REACTION_TRACE_MAX + 5; index += 1) {
    trace.traceReaction('aim', 'rail', { cell: index, open: true });
  }
  const entries = trace.reactionTrace();
  assert.equal(entries.length, trace.REACTION_TRACE_MAX, 'inelul este marginit');
  assert.equal(entries.at(-1).kind, 'aim', 'ultimul eveniment ramane ultimul');
  assert.equal(entries.at(-1).cell, trace.REACTION_TRACE_MAX + 5);
  assert.ok(entries[0].seq < entries[1].seq, 'secventa creste');

  trace.clearReactionTrace();
  const first = trace.traceReaction('grant', 'row', { x: 10, y: 20 });
  assert.equal(first.x, 10);
  assert.equal(first.y, 20);
  assert.equal(first.variant, 'row');
});

test('o linie de jurnal spune ce s-a intamplat, intr-o singura proza', () => {
  trace.clearReactionTrace();
  const entry = trace.traceReaction('aim', 'rail', { cell: 2, open: true, x: 900, y: 700 });
  const line = trace.describeReactionTrace(entry);
  assert.match(line, /^\[reaction\] #1 aim@\d+ms variant=rail/);
  assert.match(line, /cell=2/);
  assert.match(line, /open=true/);
  assert.match(line, /\(page 900,700\)/);
});

test('ReactionControl scrie in urma fiecare decizie a gestului', () => {
  const control = read('src/components/ReactionControl.tsx');
  for (const kind of ['grant', 'hold', 'aim', 'release', 'terminate', 'request']) {
    assert.match(control, new RegExp(`note\\('${kind}'`), `gestul isi noteaza ${kind}`);
  }
  /** Un singur responder, de la apasare pana la ridicare: panoul nu este un al doilea gest. */
  assert.match(control, /onStartShouldSetResponderCapture: \(\) => true/);
  assert.match(control, /onResponderTerminationRequest: \(event: GestureResponderEvent\) => \{/);
  assert.match(control, /return kept;/);
});

test('ceasul unui clip nu mai redeseneaza compozitia', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /const watched = useRef\(new Animated\.Value\(0\)\)\.current;/, 'bara este animata, nu stare');
  assert.doesNotMatch(canvas, /setWatched/, 'nu mai exista stare pentru bara');
  assert.match(canvas, /watched\.setValue\(Math\.max\(0, Math\.min\(1, fraction\)\)\)/, 'progresul se scrie direct');
  assert.match(canvas, /mediaClock\?: \{ current:/, 'ceasul unui strat desenat de apelant are usa lui');
  assert.match(canvas, /mediaClock\.current = reportProgress;/, 'usi i se da chiar reporterul barei');
});

test('compozitorul isi primeste ceasul, banda randului si cadrul corect', () => {
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /const previewClock = useRef/, 'editorul tine un singur ceas pentru previzualizare');
  assert.match(editor, /mediaClock=\{previewClock\}/, 'Canvas-ul primeste ceasul');
  assert.match(editor, /clock=\{previewClock\}/, 'player-ul editorului scrie in el');
  assert.match(editor, /instance\.timeUpdateEventInterval = 0\.25;/, 'aceeasi rata de esantionare ca in reader');
  assert.match(editor, /topInset=\{postPageTopInset\(insets\.top\)\}/, 'pagina incepe sub randul editorului');
  assert.match(editor, /height: postPageTopInset\(insets\.top\)/, 'randul editorului are exact banda cedata');
  assert.match(editor, /const \[portraitVideo, setPortraitVideo\] = useState\(false\)/, 'un clip necunoscut nu este decupat');
});
