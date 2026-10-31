/* global __dirname */
/**
 * Un singur sistem de citire: geometria scrim-urilor (`lib/readability.ts`) și faptul că o folosesc
 * suprafețele care pun cuvinte peste o imagine.
 *
 * Runda 43 (owner): „scrim-ul trebuie să crească odată cu textul" și „previzualizarea din compozitor să
 * arate exact ce se publică". Aici se ține partea care se poate dovedi fără telefon: înălțimea unui scrim
 * este **măsurătoarea** blocului de cuvinte plus o penumbră proporțională cu cadrul — niciodată `132`, un
 * număr care nu are legătură nici cu fontul cititorului, nici cu poza de sub el.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const compile = (relative) => ts.transpileModule(read(relative), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadModule(relative, overrides = {}) {
  const shim = { exports: {} };
  const requireShim = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
    throw new Error(`${relative} nu are voie să importe ${id} la rulare`);
  };
  new Function('module', 'exports', 'require', compile(relative))(shim, shim.exports, requireShim);
  return shim.exports;
}

/** Modulul este pur: fără importuri, deci se încarcă fără niciun shim. */
const readability = loadModule('src/lib/readability.ts');
const { READABILITY, descriptionScrim, headerScrim, scrimFeather, wordsScrim } = readability;

/** Telefonul de dezvoltare: 1220×2656 px la 2.6, adică ~469×1021 dp. */
const PHONE = { width: 469, height: 1021 };

test('penumbra este o parte din cadru, ținută între 20 și 44 de puncte', () => {
  assert.equal(scrimFeather(0), READABILITY.featherMin, 'un cadru fără înălțime primește tranziția minimă, nu zero');
  assert.equal(scrimFeather(275), 20, 'cardul din feed nu are nevoie de mai mult de 20');
  assert.equal(scrimFeather(800), 36);
  assert.equal(scrimFeather(PHONE.height), READABILITY.featherMax, 'telefonul ia plafonul, ca scrim-ul să nu mănânce poza');
  assert.equal(scrimFeather(100000), READABILITY.featherMax, 'și nu crește la nesfârșit');
  assert.equal(scrimFeather(Number.NaN), READABILITY.featherMin);
});

test('fără măsurătoare nu se desenează niciun scrim', () => {
  assert.equal(headerScrim({ block: 0, frame: PHONE.height }), null);
  assert.equal(headerScrim({ block: 96, frame: 0 }), null, 'un cadru nemăsurat nu primește un gradient ghicit');
  assert.equal(descriptionScrim({ block: 0, frame: PHONE.height }), null);
  assert.equal(descriptionScrim({ block: 210, frame: 0 }), null);
  assert.equal(headerScrim({ block: -40, frame: PHONE.height }), null, 'o măsurătoare negativă nu este o bandă');
});

test('scrim-ul capului este blocul măsurat plus penumbra, deschis la baza lui', () => {
  const scrim = headerScrim({ block: 96, frame: PHONE.height });
  assert.equal(scrim.height, 96 + READABILITY.featherMax, 'înălțimea este măsurătoarea plus tranziția, nu 132');
  assert.equal(scrim.stops.length, 4);
  assert.equal(scrim.stops[0].offset, 0);
  assert.equal(scrim.stops[0].opacity, READABILITY.header.top, 'aproape opac sub ceas');
  assert.equal(scrim.stops[3].offset, 1);
  assert.equal(scrim.stops[3].opacity, 0, 'și se termină în imagine: nicio margine tăiată');
  const solid = scrim.stops[2];
  assert.equal(solid.opacity, READABILITY.header.solid);
  assert.equal(solid.offset, Math.round((96 / scrim.height) * 1000) / 1000,
    'ultima oprire solidă cade exact sub ultima linie a capului');
  assert.ok(scrim.stops[1].offset < solid.offset, 'iar trecerea de la opac la solid se face între ele');
});

test('un cap mai înalt primește un scrim mai înalt, iar `above` îl mută la marginea cadrului', () => {
  const small = headerScrim({ block: 96, frame: PHONE.height });
  const large = headerScrim({ block: 143, frame: PHONE.height });
  assert.ok(large.height > small.height, 'fontul cititorului mai mare cere un scrim mai înalt');
  const paged = headerScrim({ block: 96, above: 47, frame: PHONE.height });
  assert.equal(paged.height, small.height + 47, '`above` acoperă `paddingTop`-ul paginii de lectură');
  assert.ok(Math.abs(paged.stops[2].offset - Math.round((143 / paged.height) * 1000) / 1000) < 0.002);
});

test('scrim-ul descrierii este ancorat la poale și crește în sus odată cu textul', () => {
  const three = descriptionScrim({ block: 210, frame: PHONE.height });
  const twelve = descriptionScrim({ block: 470, frame: PHONE.height });
  assert.equal(three.height, 210 + READABILITY.featherMax);
  assert.equal(twelve.height, 470 + READABILITY.featherMax);
  assert.ok(twelve.height > three.height);
  assert.equal(three.stops[0].opacity, 0, 'marginea de sus a benzii este imagine curată');
  assert.equal(three.stops[three.stops.length - 1].opacity, READABILITY.description.body,
    'iar la poale textul are terenul lui solid');
  assert.ok(Math.abs(three.stops[1].offset - (READABILITY.featherMax / three.height)) < 0.002,
    'tranziția ocupă exact penumbra, restul benzii este solid');
});

test('opririle sunt ordonate, în 0–1, cu trei zecimale', () => {
  for (const geometry of [
    headerScrim({ block: 96, frame: PHONE.height }),
    headerScrim({ block: 22, frame: 275 }),
    descriptionScrim({ block: 210, frame: PHONE.height }),
    descriptionScrim({ block: 30, frame: 275 }),
  ]) {
    assert.ok(geometry.height > 0);
    for (let index = 0; index < geometry.stops.length; index += 1) {
      const stop = geometry.stops[index];
      assert.ok(stop.offset >= 0 && stop.offset <= 1, `offset ${stop.offset} în 0–1`);
      assert.ok(stop.opacity >= 0 && stop.opacity <= 1, `opacity ${stop.opacity} în 0–1`);
      if (index > 0) assert.ok(stop.offset >= geometry.stops[index - 1].offset, 'opririle nu se întorc');
    }
    assert.equal(geometry.stops[0].offset, 0);
    assert.equal(geometry.stops[geometry.stops.length - 1].offset, 1);
  }
});

test('un cadru scurt primește aceeași tranziție minimă, fără să-și piardă textul', () => {
  const card = headerScrim({ block: 88, frame: 275 });
  assert.equal(card.height, 88 + READABILITY.featherMin);
  assert.ok(card.height < 275 * 0.45, 'pe un card, capul plus scrim-ul rămân sub jumătatea cadrului');
});

/**
 * Runda 45 (owner): „ambele benzi lipsesc de pe postările de tip text". Regula veche — hârtia nu primește
 * niciun scrim — a fost chiar cauza, deci aici se ține regula nouă: aceeași bandă, altă greutate.
 */
test('hârtia primește aceleași benzi, cu greutatea ei, nu cu opacitatea unui cadru cu imagine', () => {
  const paperHead = headerScrim({ block: 96, frame: PHONE.height, ground: 'paper' });
  const nightHead = headerScrim({ block: 96, frame: PHONE.height });
  assert.ok(paperHead && nightHead);
  assert.equal(paperHead.height, 96, 'banda de hârtie se oprește la marginea de jos a capului');
  assert.equal(nightHead.height, 96 + READABILITY.featherMax, 'pe imagine se deschide în poză, ca înainte');
  assert.equal(paperHead.stops[0].opacity, READABILITY.paper.header.top);
  assert.ok(paperHead.stops[0].opacity > 0.2, 'se vede: nu este o bandă invizibilă');
  assert.ok(paperHead.stops[0].opacity < nightHead.stops[0].opacity, 'dar nu este nici placa unui clip');
  assert.equal(paperHead.stops[paperHead.stops.length - 1].opacity, 0, 'se stinge înainte de cuvinte');
  assert.equal(headerScrim({ block: 0, frame: PHONE.height, ground: 'paper' }), null, 'fără cap măsurat, nimic');
});

test('banda cuvintelor are exact înălțimea blocului măsurat, pe orice teren', () => {
  const paper = wordsScrim({ block: 210, frame: PHONE.height, ground: 'paper' });
  const night = wordsScrim({ block: 210, frame: PHONE.height, ground: 'night' });
  assert.equal(paper.height, 210, 'înălțimea este măsurătoarea, nu măsurătoarea plus o penumbră care ar ieși din pagină');
  assert.equal(night.height, 210);
  assert.equal(paper.stops[0].opacity, 0, 'primul rând rămâne pe hârtia lui');
  assert.equal(paper.stops[2].opacity, READABILITY.paper.description.body);
  assert.equal(night.stops[2].opacity, READABILITY.description.body);
  assert.ok(paper.stops[2].opacity > 0.1, 'banda de hârtie se vede');
  assert.ok(paper.stops[2].opacity < night.stops[2].opacity, 'și este mai blândă decât cea de pe imagine');
  assert.ok(paper.stops[1].offset > 0 && paper.stops[1].offset <= 0.6, 'tranziția încape în bandă');
  assert.equal(wordsScrim({ block: 0, frame: PHONE.height }), null);
  assert.equal(wordsScrim({ block: 210, frame: 0 }), null);
  const short = wordsScrim({ block: 18, frame: PHONE.height, ground: 'paper' });
  assert.equal(short.height, 18, 'un bloc de un rând rămâne o bandă de un rând');
  assert.ok(short.stops[1].offset <= 0.6);
});

test('pagina de text nu are bandă sub cuvinte: banda se citește numai în cap (runda 46)', () => {
  /**
   * Ownerul (runda 46): „pe o postare de text, banda de lizibilitate se desenează **numai** în spatele
   * capului autorului; sub textul editorial nu se pune niciun văl". Aici se ține partea care nu are nevoie
   * de telefon: nicio pagină de cuvinte nu mai desenează un strat sub rândurile ei, iar capul își păstrează
   * banda pe amândouă terenurile.
   */
  const page = read('src/components/EditorialPage.tsx');
  assert.ok(!/nxPageBand-/.test(page), 'pagina scrisă în compozitor nu mai desenează un strat sub rânduri');
  assert.ok(!/wordsScrim/.test(page), 'și nu mai socotește o bandă pe care nu o desenează');
  assert.ok(!/wordBand/.test(page), 'nici stilul benzii nu a rămas în urmă');
  const legacy = read('src/components/PostReading.tsx');
  assert.match(legacy, /band=\{false\}/, 'o pagină moștenită (fără document) se citește la fel: fără văl sub cuvinte');
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /headerScrim\(\{\s*block: headBlock\.height[^}]*ground,/,
    'capul primește bandă pe orice teren, inclusiv pe hârtie și pe negru');
  assert.ok(!/headGeometry = ground === 'paper'/.test(canvas), 'hârtia nu este scoasă din sistemul de citire');
  assert.match(canvas, /id=\{`nxCanvasWords-\$\{post\.id\}`\}/);
  assert.match(canvas, /band=\{stage === 'quote' && !pageDrawsBand\}/,
    'numai un citat, care stă peste placa de jungle, își păstrează banda');
  assert.match(canvas, /const scrimInk = pagePalette \? pagePalette\.text : editorial\.fieldDeep;/);
  /** Banda de sub un citat rămâne desenată **înaintea** cuvintelor, deci nu poate acoperi un tag. */
  const words = canvas.indexOf('nxCanvasWords-');
  const band = canvas.indexOf('band={stage === \'quote\'');
  assert.ok(words > 0 && band > 0 && band > words, 'stratul citatului stă în blocul de cuvinte');
});

test('compoziția desenează ambele straturi prin `PostScrim`, măsurate pe benzi reale', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /import \{ PostScrim, WordsBand, useBlockHeight \} from '\.\/PostReadability';/);
  assert.match(canvas, /<PostScrim id=\{`nxCanvasHead-\$\{post\.id\}`\} geometry=\{headGeometry\}/);
  assert.match(canvas, /<PostScrim id=\{`nxCanvasFoot-\$\{post\.id\}`\} geometry=\{footGeometry\}[^/]*anchor="bottom"/);
  assert.match(canvas, /onLayout=\{headBlock\.onLayout\}/, 'capul se măsoară');
  assert.match(canvas, /onLayout=\{footBlock\.onLayout\}/, 'blocul de jos se măsoară');
  assert.ok(!canvas.includes('height={132 + topInset}'), 'înălțimea de 132 a capului a plecat: nu mai există un număr inventat');
  assert.ok(!canvas.includes('nxCanvasHeadOver'), 'și nici al doilea gradient al capului');
  // Scrim-ul de jos este desenat înaintea cuvintelor, deci nu poate acoperi `Citește tot` sau o reacție.
  const foot = canvas.indexOf('nxCanvasFoot-');
  assert.ok(foot > 0 && foot < canvas.indexOf('styles.bottom'), 'stratul descrierii stă sub blocul de jos');
  assert.ok(canvas.indexOf('{mediaOverlay}') < canvas.indexOf('nxCanvasHead-'),
    'și amândouă stau peste ce a scris autorul pe poză');
});

test('compozitorul își ia ghidajele din măsurătoarea paginii, nu dintr-o a doua socoteală', () => {
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /onChromeMeasure=/, 'previzualizarea raportează benzile măsurate');
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /onChromeMeasure\?\.\(\{ head: headBand, description: footBand \}\)/);
});

test('niciun ecran nu-și mai desenează singur un gradient de citire peste compoziție', () => {
  for (const relative of [
    'src/components/PostCard.tsx',
    'src/components/ReelsReader.tsx',
    'src/screens/FeedScreen.tsx',
    'src/components/PostMedia.tsx',
    'src/app/post/[id].tsx',
  ]) {
    const source = read(relative);
    assert.ok(!/LinearGradient/.test(source), `${relative} nu are voie să-și compună propriul scrim`);
    assert.ok(!/stopOpacity/.test(source), `${relative} nu are voie să pună opacități proprii de gradient`);
  }
});
