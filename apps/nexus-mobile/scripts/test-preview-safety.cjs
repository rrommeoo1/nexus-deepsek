/* global __dirname */
/**
 * Ghidajele de zonă sigură ale compozitorului (`lib/previewSafety.ts`).
 *
 * Runda 43 (owner): „când trag text pe fotografie, cum știu că nu ajunge sub nume sau sub descriere?".
 * Răspunsul are o singură condiție ca să fie adevărat: benzile sunt **măsurătorile paginii publicate**
 * (`PostCanvas.onChromeMeasure`), nu o socoteală paralelă în editor. Testul ține geometria (pură, fără
 * telefon) și faptul că editorul chiar consumă acele numere, plus drumul dus-întors dintre fracția din
 * dreptunghiul de conținut și punctul din cadru — același drum pe care îl face `PostOverlay` când desenează
 * o etichetă.
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
const safety = loadModule('src/lib/previewSafety.ts');
const { decorationSpot, fractionOfFrame, frameSpotOf, freeSpots, guideLabelPlacement, previewSafeZones, zonesAt } = safety;

/** Telefonul de dezvoltare: 1220×2656 px la 2.6, adică ~469×1021 dp. */
const PHONE = { width: 469, height: 1021 };
/** Ce raportează compoziția pe acest telefon: capul se termină la 128, descrierea are 196. */
const MEASURED = { head: 128, description: 196 };

test('benzile vin din măsurători, de sus în jos: cap, descriere, poale', () => {
  const zones = previewSafeZones({ ...PHONE, ...MEASURED, foot: 34, systemTop: 47, systemBottom: 24 });
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  assert.equal(byId.get('head').rect.height, 128, 'capul este marginea măsurată, nu un număr inventat');
  assert.equal(byId.get('head').rect.top, 0);
  assert.equal(byId.get('head').rect.width, PHONE.width, 'o bandă de cap ia toată lățimea');
  assert.equal(byId.get('system').rect.height, 34, 'banda de la poale ține cea mai înaltă dintre cea a paginii și cea a telefonului');
  assert.equal(byId.get('system').rect.top, PHONE.height - 34);
  assert.equal(byId.get('description').rect.height, 196);
  assert.equal(byId.get('description').rect.top, PHONE.height - 34 - 196,
    'descrierea este ancorată deasupra benzii de la poale, exact ca blocul de jos al paginii');
  assert.equal(byId.get('description').rect.top + byId.get('description').rect.height, byId.get('system').rect.top,
    'descrierea se termină unde începe banda de la poale: nu se calcă pe butoane');
  assert.equal(byId.get('description').rect.left, 0);
  assert.equal(zones.filter((zone) => zone.id === 'rail').length, 0, 'fără o urmă măsurată, reacțiile nu se ghicesc');
  assert.ok(zones.every((zone) => zone.published), 'toate benzile calculate se publică');
});

test('banda de sus a telefonului ține capul, banda de jos ține poalele — chiar fără descriere', () => {
  const zones = previewSafeZones({ ...PHONE, head: 0, description: 0, foot: 0, systemTop: 47, systemBottom: 24 });
  const head = zones.find((zone) => zone.id === 'head');
  assert.ok(head, 'ceasul stă tot acolo');
  assert.equal(head.rect.height, 47);
  assert.equal(zones.filter((zone) => zone.id === 'description').length, 0, 'fără bloc de jos nu se desenează o bandă goală');
  const system = zones.filter((zone) => zone.id === 'system');
  assert.equal(system.length, 1, 'poalele rămân, chiar dacă pagina nu are descriere');
  assert.equal(system[0].rect.height, 24, 'gestiunile telefonului, nu ceasul de sus');
});

test('o descriere mai înaltă decât locul rămas se taie la locul rămas, nu iese din cadru', () => {
  const zones = previewSafeZones({ ...PHONE, head: 0, description: 2000, foot: 34, systemBottom: 0 });
  const description = zones.find((zone) => zone.id === 'description');
  assert.equal(description.rect.top, 0);
  assert.equal(description.rect.height, PHONE.height - 34);
});

test('fără cadru măsurat nu se desenează nimic', () => {
  assert.deepEqual(previewSafeZones({ width: 0, height: 0, head: 128, description: 196, foot: 34 }), []);
  assert.deepEqual(previewSafeZones({ width: PHONE.width, height: 0, head: 128, description: 0, foot: 0 }), []);
});

test('o bandă măsurată este preluată ca atare, iar cea vidă se aruncă', () => {
  const zones = previewSafeZones({
    ...PHONE,
    head: 0,
    description: 0,
    foot: 0,
    measured: [
      { id: 'rail', label: 'Reacțiile', rect: { left: 411, top: 700, width: 44, height: 190 } },
      { id: 'tool', label: 'Uneltele editorului', published: false, rect: { left: 400, top: 128, width: 53, height: 240 } },
      { id: 'tool', label: 'Bandă vidă', rect: { left: 0, top: 0, width: 0, height: 40 } },
    ],
  });
  const rail = zones.find((zone) => zone.id === 'rail');
  assert.deepEqual(rail.rect, { left: 411, top: 700, width: 44, height: 190 });
  assert.equal(rail.published, true, 'o bandă măsurată se publică dacă nu spune altfel');
  const tools = zones.filter((zone) => zone.id === 'tool');
  assert.equal(tools.length, 1, 'o bandă fără lățime nu este un dreptunghi');
  assert.equal(tools[0].published, false, 'uneltele editorului nu fac parte din poză');
});

test('poziția stocată a unei etichete este un procent, nu o fracție', () => {
  const rect = { left: -148, top: 0, width: 766, height: 1021 };
  /**
   * Ce se întâmpla înainte: procentul intra direct în `frameSpotOf`, care îl limitează la 1, deci orice
   * etichetă era socotită în colțul de jos-dreapta al dreptunghiului — avertismentul nu putea să apară.
   */
  assert.deepEqual(frameSpotOf({ rect, x: 50, y: 85 }), { x: rect.left + rect.width, y: 1021 }, 'procentul citit ca fracție ajunge la marginea de jos');
  const spot = decorationSpot(rect, { x: 50, y: 85 });
  assert.equal(Math.round(spot.x), Math.round(-148 + 0.5 * 766));
  assert.equal(Math.round(spot.y), Math.round(0.85 * 1021));
  /** Și punctul acela cade exact în banda descrierii unei pagini măsurate ca pe telefon. */
  const zones = previewSafeZones({ ...PHONE, ...MEASURED, foot: 34, systemTop: 47, systemBottom: 24 });
  assert.deepEqual(zonesAt(zones, spot).map((zone) => zone.id), ['description']);
  assert.equal(Math.round(decorationSpot(rect, { x: Number.NaN, y: Number.NaN }).y), Math.round(0.5 * rect.height),
    'o poziție nedefinită stă la mijloc, nu în colț');
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /const spot = decorationSpot\(previewRect, decoration\);/,
    'editorul citește poziția prin conversia procent → punct');
  assert.ok(!/frameSpotOf\(\{ rect: previewRect/.test(editor), 'și nu mai trece procentul direct în `frameSpotOf`');
});


test('un punct sub cap cade în banda capului, la margine inclusiv', () => {

  const zones = previewSafeZones({ ...PHONE, ...MEASURED, foot: 34, systemTop: 47, systemBottom: 24 });
  assert.deepEqual(zonesAt(zones, { x: 200, y: 40 }).map((zone) => zone.id), ['head']);
  assert.deepEqual(zonesAt(zones, { x: 200, y: 128 }).map((zone) => zone.id), ['head'], 'marginea de jos este încă în bandă');
  assert.deepEqual(zonesAt(zones, { x: 200, y: 129 }), []);
  assert.deepEqual(zonesAt(zones, { x: 200, y: PHONE.height - 60 }).map((zone) => zone.id), ['description']);
  assert.deepEqual(zonesAt(zones, { x: 200, y: PHONE.height - 10 }).map((zone) => zone.id), ['system']);
  assert.deepEqual(zonesAt(zones, { x: Number.NaN, y: 10 }), [], 'un punct nedefinit nu este într-o bandă');
});

test('fracția din dreptunghiul de conținut și punctul din cadru se întorc unul în altul', () => {
  const rect = { left: -37, top: 62, width: 543, height: 890 };
  for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 1], [0.25, 0.8]]) {
    const spot = frameSpotOf({ rect, x, y });
    const back = fractionOfFrame({ rect, point: spot });
    assert.ok(Math.abs(back.x - x) < 1e-9, `x ${x} → ${back.x}`);
    assert.ok(Math.abs(back.y - y) < 1e-9, `y ${y} → ${back.y}`);
  }
  assert.deepEqual(frameSpotOf({ rect, x: -4, y: 9 }), { x: rect.left, y: rect.top + rect.height }, 'fracțiile se țin în 0–1');
  assert.deepEqual(fractionOfFrame({ rect: { left: 0, top: 0, width: 0, height: 0 }, point: { x: 5, y: 5 } }), { x: 0.5, y: 0.5 });
});

test('locurile libere stau între cap și descriere, la stânga reacțiilor', () => {
  const zones = previewSafeZones({
    ...PHONE,
    ...MEASURED,
    foot: 34,
    systemTop: 47,
    systemBottom: 24,
    measured: [{ id: 'rail', label: 'Reacțiile', rect: { left: 411, top: 700, width: 44, height: 190 } }],
  });
  const descriptionTop = PHONE.height - 34 - 196;
  const spots = freeSpots(zones, { ...PHONE, count: 3 });
  assert.equal(spots.length, 3);
  for (const spot of spots) {
    assert.ok(spot.y > 128 && spot.y < descriptionTop, `y ${spot.y} între cap și descriere`);
    assert.ok(spot.x < 411, `x ${spot.x} la stânga reacțiilor`);
    assert.deepEqual(zonesAt(zones, spot).map((zone) => zone.id), [], 'un loc liber chiar este liber');
  }
  assert.ok(spots[0].y < spots[1].y && spots[1].y < spots[2].y, 'punctele nu se calcă unele pe altele');
  /** Nicio cantitate de etichete nu are voie să așeze una peste cuvinte: locurile se numără, nu se ghicesc. */
  for (let count = 1; count <= 12; count += 1) {
    for (const spot of freeSpots(zones, { ...PHONE, count })) {
      assert.deepEqual(zonesAt(zones, spot).map((zone) => zone.id), [], `count ${count}: ${spot.y} este liber`);
    }
  }
});

test('eticheta unei benzi înguste iese în stânga, în puncte de cadru', () => {
  const frameWidth = 469;
  const placement = guideLabelPlacement({ left: 391, top: 372, width: 44, height: 190 }, frameWidth);
  assert.equal(placement.right, frameWidth - 391 + 6, 'lipită la 6 dp în stânga benzii de reacții');
  assert.equal(frameWidth - placement.right, 385, 'marginea ei dreaptă stă chiar înaintea benzii');
  assert.equal(placement.left, undefined, 'nu se așază peste bandă');
  assert.ok(placement.maxWidth >= 72 && placement.maxWidth <= 391, 'are loc toată lățimea până la marginea cadrului');
  assert.equal(placement.textAlign, 'right', 'pastila crește spre stânga, de la marginea benzii');
  assert.ok(placement.top < 372, 'stă deasupra benzii, nu peste prima pictogramă');

  /** Coloana de unelte are 53 dp: aceeași regulă, altă bandă. */
  assert.equal(guideLabelPlacement({ left: 398, top: 122, width: 53, height: 240 }, frameWidth).right,
    frameWidth - 398 + 6);
  /** Capul paginii este lipit de marginea de sus: nu are loc deasupra, deci stă în interior. */
  const head = guideLabelPlacement({ left: 0, top: 0, width: 469, height: 128 }, frameWidth);
  assert.equal(head.top, 3);
  assert.equal(head.left, 4);
  assert.equal(head.maxWidth, 461);
  /** Descrierea și poalele au loc deasupra liniei, unde fotografia este liberă. */
  const description = guideLabelPlacement({ left: 0, top: 495, width: 469, height: 168 }, frameWidth);
  assert.equal(description.top, 477);
  assert.equal(description.left, 4);
});

test('fără bandă liberă, `freeSpots` nu inventează un loc', () => {
  const zones = previewSafeZones({ ...PHONE, head: 700, description: 700, foot: 0 });
  assert.deepEqual(freeSpots(zones, { ...PHONE, count: 2 }), [], 'când cuvintele umplu cadrul, editorul spune asta');
  assert.deepEqual(freeSpots([], { width: 0, height: 0, count: 2 }), []);
});

test('editorul desenează ghidajele pe măsurătoarea paginii și a coloanei, nu pe socoteli proprii', () => {
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /onChromeMeasure=\{measureChrome\}/, 'previzualizarea raportează benzile măsurate');
  assert.match(editor, /head: previewChrome\.head,\s*\n\s*description: previewChrome\.description,/,
    'ghidajele se hrănesc din ele');
  assert.match(editor, /foot: pageFoot/, 'banda de la poale este chiar cea dată paginii (`bottomInset={pageFoot}`)');
  assert.match(editor, /railBox \? \{ id: 'rail' as const/, 'reacțiile vin din `onLayout`-ul coloanei');
  assert.match(editor, /toolBox \? \{ id: 'tool' as const, label: 'Uneltele editorului', published: false/,
    'uneltele editorului intră în ghidaje, dar nu se publică');
  assert.match(editor, /<PostRail[\s\S]{0,400}onLayout=\{measureRail\}/, 'coloana își raportează urma');
  assert.match(editor, /freeSpots\(guideZones, \{ width: screenSize\.width, height: screenSize\.height, count: ids\.length \}\)/,
    'mutarea etichetelor folosește aceleași benzi');
  assert.match(editor, /pointerEvents="none" style=\{StyleSheet\.absoluteFill\}/, 'ghidajele nu fură atingerea de la tras');
  assert.match(editor, /numberOfLines=\{1\}\s*style=\{\[styles\.guideLabel, guideLabelPlacement\(zone\.rect, screenSize\.width\)\]\}/,
    'eticheta benzii își primește locul din măsurătoare, în puncte de cadru');
  assert.match(editor, /guideLabelPlacement, previewSafeZones/, 'funcția vine din modulul pur, ca să poată fi testată');
  assert.match(editor, /\{guideZones\.map\(\(zone\) => \(\s*<Text/, 'etichetele au stratul lor, nu sunt copii ai benzii');
  assert.ok(!/height: 132/.test(editor), 'editorul nu are voie să-și socotească singur înălțimea capului');
  const rail = read('src/components/PostRail.tsx');
  assert.match(rail, /<View style=\{\[styles\.rail, \{ bottom \}\]\} onLayout=\{onLayout\}>/, 'coloana raportează ce ocupă');
});
