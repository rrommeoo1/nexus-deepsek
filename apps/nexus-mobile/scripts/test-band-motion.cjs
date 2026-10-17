/* global __dirname */
// The band's pause and resume (`MIGRATION.md` §20.2), as arithmetic rather than as animation.
//
// The owner's rule: the band travels always, a touch freezes it exactly where it stands, the next touch
// sends it on from there with the usual speed, and the system's animation settings have no say. With the
// native driver the animated value cannot be read back mid-flight, so the position is computed from a
// start point and a clock — which is exactly what can be tested without a phone:
//
//   * the position grows linearly with time, measured in pixels of the run;
//   * it wraps at the end of a run instead of overshooting it;
//   * a pause keeps the position it froze at, and the resume lasts the remaining share of the cycle;
//   * time spent in the background counts the same as time spent watching;
//   * new words are a new line and start from the beginning.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const source = readFileSync(resolve(ROOT, 'src/lib/bandMotion.ts'), 'utf8');
const code = ts.transpileModule(source, {
  fileName: 'bandMotion.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, require);
const { bandSpeed, bandWrap, bandPositionAt, bandResumePlan, bandSignature } = moduleShim.exports;

/** One run of 600px, one cycle of 48s: 12.5px a second, so a quarter of the cycle is a quarter of the run. */
const RUN = 600;
const CYCLE = 48000;

test('pozitia creste liniar cu timpul si porneste din punctul cerut', () => {
  assert.equal(bandSpeed(RUN, CYCLE), 600 / 48000);
  assert.equal(bandPositionAt({ from: 0, startedAt: 0 }, 0, RUN, CYCLE), 0);
  assert.equal(bandPositionAt({ from: 0, startedAt: 0 }, 12000, RUN, CYCLE), 150, 'un sfert din ciclu');
  assert.equal(bandPositionAt({ from: 0, startedAt: 0 }, 24000, RUN, CYCLE), 300, 'jumătate');
  assert.equal(bandPositionAt({ from: 100, startedAt: 0 }, 24000, RUN, CYCLE), 400, 'pornind din alt punct');
  assert.equal(bandPositionAt({ from: 0, startedAt: 5000 }, 15000, RUN, CYCLE), 125, 'ceasul de la mijloc');
});

test('pozitia se infasoara la capatul randului, nu il depaseste', () => {
  assert.equal(bandPositionAt({ from: 0, startedAt: 0 }, CYCLE, RUN, CYCLE), 0, 'un ciclu intreg aduce copia in loc');
  assert.equal(bandPositionAt({ from: 300, startedAt: 0 }, CYCLE, RUN, CYCLE), 300, 'si pornirea se pastreaza');
  assert.equal(bandPositionAt({ from: 0, startedAt: 0 }, CYCLE + 12000, RUN, CYCLE), 150, 'dupa un ciclu si un sfert');
  assert.equal(bandWrap(625, RUN), 25);
  assert.equal(bandWrap(-25, RUN), 575, 'inapoi sub zero se infasoara in sus');
  assert.equal(bandWrap(0, 0), 0);
});

test('pauza pastreaza exact pozitia, iar reluarea dureaza restul ciclului', () => {
  const running = { from: 0, startedAt: 0 };
  /** The finger lands at 12s: the line stands at 150px and stays there, however long the pause lasts. */
  const frozen = bandPositionAt(running, 12000, RUN, CYCLE);
  assert.equal(frozen, 150);
  assert.equal(bandPositionAt(running, 12000, RUN, CYCLE), frozen, 'aceeasi citire, aceeasi pozitie');

  const plan = bandResumePlan(frozen, RUN, CYCLE);
  assert.equal(plan.toValue, -RUN, 'reluarea merge pana la capatul randului');
  assert.equal(plan.duration, 36000, 'adica 3/4 din ciclu: exact cat mai avea de mers');
});

test('reluarea dintr-un capat de rand nu dureaza nimic si nu se blocheaza', () => {
  assert.deepEqual(bandResumePlan(0, RUN, CYCLE), { toValue: -RUN, duration: CYCLE }, 'de la zero: un ciclu');
  assert.deepEqual(bandResumePlan(RUN, RUN, CYCLE), { toValue: -RUN, duration: CYCLE }, 'capatul este inceputul');
  const almost = bandResumePlan(RUN - 1, RUN, CYCLE);
test('fundalul nu sare: timpul petrecut plecat se socoteste la fel', () => {
  /** Left running at 0, the app went away, came back 36s later: the line is at 450px, with 12s left. */
  const back = bandPositionAt({ from: 0, startedAt: 0 }, 36000, RUN, CYCLE);
  assert.equal(back, 450);
  assert.equal(bandResumePlan(back, RUN, CYCLE).duration, 12000);
  /** Gone for longer than a whole cycle: it wrapped while nobody watched, and resumes where it wrapped to. */
  const later = bandPositionAt({ from: 0, startedAt: 0 }, CYCLE + 6000, RUN, CYCLE);
  assert.equal(later, 75);
});

test('un ceas care da inapoi nu arunca banda inainte', () => {
  assert.equal(bandPositionAt({ from: 120, startedAt: 9000 }, 4000, RUN, CYCLE), 120, 'ramanem in punctul de plecare');
  assert.equal(bandPositionAt({ from: -50, startedAt: 0 }, 0, RUN, CYCLE), 550, 'o pozitie negativa se infasoara');
});

test('semnatura se schimba doar cand se schimba ce duce banda', () => {
  const line = [{ kind: 'bio', text: 'Ana' }, { kind: 'age', text: '25 ani' }];
  assert.equal(bandSignature(line), bandSignature([...line]), 'aceleasi cuvinte: aceeasi linie');
  assert.notEqual(bandSignature(line), bandSignature([{ kind: 'bio', text: 'Ana ' }, line[1]]), 'editare');
  assert.notEqual(bandSignature(line), bandSignature(line.slice(0, 1)), 'un rand lipsa');
  assert.notEqual(bandSignature(line), bandSignature([{ ...line[0], icon: '🔓' }, line[1]]), 'o pictograma noua');
  assert.notEqual(bandSignature([{ kind: 'a', text: 'b\u001fc' }]), bandSignature([{ kind: 'a\u001fb', text: 'c' }]),
    'niciun rand nu poate imita altul');
  assert.equal(bandSignature([]), '');
});

test('componenta: pauza pe ceas, fara setarea sistemului, cu usa de 44dp pentru foaie', () => {
  const component = readFileSync(resolve(ROOT, 'src/components/ProfileBand.tsx'), 'utf8');
  assert.ok(!component.includes('AccessibilityInfo'), 'sistemul nu mai decide daca banda se misca');
  assert.ok(!component.includes('reduceMotion'), 'nici macar ca nume');
  assert.match(component, /useNativeDriver: true/, 'translateX merge pe driverul nativ');
  assert.match(component, /bandPositionAt\(/, 'pauza citeste pozitia din ceas');
  assert.match(component, /bandResumePlan\(/, 'reluarea porneste din acelasi punct');
  assert.match(component, /bandSignature\(/, 'cuvintele noi repornesc banda');
  assert.match(component, /stopAnimation\(\)/, 'la pauza animatia este oprita');
  assert.match(component, /AppState\.addEventListener/, 'revenirea din fundal reancoreaza');
  assert.match(component, /accessibilityLabel="Detalii profil"/, 'pictograma isi spune numele');
  assert.match(component, /width: band\.infoSize/, 'si are tinta de 44dp');
  assert.match(component, /hitSlop=/, 'cu marja de atingere care rotunjeste tinta');
  assert.match(component, /LinearGradient/, 'fade-ul de sub pictograma');
  assert.match(component, /Banda este oprită din meniu/, 'cand setarea e oprita, banda este text static');
});

test('setarea "Banda derulantă" sta in sertar si este pornita implicit', () => {
  const drawer = readFileSync(resolve(ROOT, 'src/components/FeedDrawer.tsx'), 'utf8');
  assert.match(drawer, /accessibilityRole="switch"/, 'sertarul are comutatorul');
  assert.match(drawer, /accessibilityLabel="Banda derulantă"/);
  assert.match(drawer, /onBandScrolling/, 'si il raporteaza gazdei');
  const prefs = readFileSync(resolve(ROOT, 'src/lib/bandPrefs.ts'), 'utf8');
  assert.match(prefs, /BAND_SCROLLING_DEFAULT = true/, 'implicit pornita');
  assert.match(prefs, /moveSync/, 'scris ca sesiunea: fisier temporar, apoi redenumit');
  const index = readFileSync(resolve(ROOT, 'src/app/index.tsx'), 'utf8');
  assert.match(index, /bandScrolling=\{bandScrolling\}/, 'gazda paseaza starea');
  assert.match(index, /setBandScrolling/, 'si o salveaza');
});

  assert.equal(almost.duration, 80, 'un pixel mai are 80ms');
  assert.ok(bandResumePlan(RUN, RUN, CYCLE).duration >= 1);
  assert.deepEqual(bandResumePlan(300, 0, 0), { toValue: 0, duration: 1 }, 'fara latime nu se anima');
});
