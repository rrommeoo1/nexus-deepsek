/* global __dirname */
/**
 * Mărimile textului, stickerelor și emoji-urilor (runda 46): trei preseturi, un ciclu de patru atingeri.
 *
 * Ownerul: „același ciclu previzibil de patru atingeri pentru text, stickere și emoji — prima atingere pune
 * mărimea normală, a doua pe cea medie, a treia pe cea mare, a patra se întoarce la normală". Deci ciclul
 * are **trei** mărimi, nu patru, iar a patra atingere nu este o mărime nouă. Aici se ține logica (pură) și
 * drumul ei până în postarea publicată: compozitorul scrie `scale` în manifest, iar randatorul cititorului
 * (`components/PostOverlay`) îl desenează — aceeași valoare în previzualizare și în pagină.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const code = ts.transpileModule(read('src/lib/overlayPresets.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shim = { exports: {} };
new Function('module', 'exports', 'require', code)(shim, shim.exports, (id) => {
  throw new Error(`overlayPresets.ts nu are voie să importe ${id} la rulare`);
});
const {
  OVERLAY_PRESETS, OVERLAY_PRESET_COUNT, presetAt, presetIndex, presetIndexForScale, presetLabel, presetScale,
  takePreset, withPresetScale,
} = shim.exports;

test('sunt exact trei mărimi vizibile, în intervalul pe care serverul îl acceptă', () => {
  assert.equal(OVERLAY_PRESET_COUNT, 3);
  assert.deepEqual(OVERLAY_PRESETS.map((entry) => entry.id), ['small', 'medium', 'large']);
  assert.deepEqual(OVERLAY_PRESETS.map((entry) => entry.scale), [1, 1.35, 1.8]);
  const server = read('../../apps/nexus-web/lib/creator-studio.js');
  assert.match(server, /item\.scale < \.4 \|\| item\.scale > 3/, 'serverul ține `scale` între 0.4 și 3');
  for (const preset of OVERLAY_PRESETS) {
    assert.ok(preset.scale >= 0.4 && preset.scale <= 3, `mărimea ${preset.id} trece de server`);
    assert.ok(preset.label.length >= 2);
  }
});

test('ciclul: normal → mediu → mare → normal, la nesfârșit', () => {
  let index = 0;
  const applied = [];
  for (let tap = 0; tap < 7; tap += 1) {
    const taken = takePreset(index);
    applied.push(taken.preset.id);
    index = taken.index;
  }
  assert.deepEqual(applied, ['small', 'medium', 'large', 'small', 'medium', 'large', 'small'],
    'a patra atingere nu este o a patra mărime, ci întoarcerea la prima');
  assert.equal(applied.filter((id) => id === 'small').length, 3);
});


test('un indice oarecare cade în ciclu, fără să arunce', () => {
  assert.equal(presetIndex(0), 0);
  assert.equal(presetIndex(3), 0);
  assert.equal(presetIndex(4), 1);
  assert.equal(presetIndex(-1), 2);
  assert.equal(presetIndex(Number.NaN), 0);
  assert.equal(presetAt(7).id, 'medium');
  assert.equal(presetScale(-2), 1.35);
  assert.equal(presetLabel(2), 'Mare');
});

test('o mărime citită dintr-un draft vechi se apropie de presetul cel mai apropiat', () => {
  assert.equal(presetIndexForScale(1), 0, 'un manifest vechi (`scale: 1`) se deschide pe mărimea normală');
  assert.equal(presetIndexForScale(undefined), 0);
  assert.equal(presetIndexForScale(0), 0);
  assert.equal(presetIndexForScale(1.35), 1);
  assert.equal(presetIndexForScale(1.8), 2);
  assert.equal(presetIndexForScale(2.9), 2, 'o valoare din altă versiune nu sare la o mărime inventată');
});

test('o mărime se scrie pe un singur element, nu pe toate', () => {
  const decorations = [
    { id: 'text-1', scale: 1 },
    { id: 'time-2', scale: 1 },
  ];
  const next = withPresetScale(decorations, 'time-2', 2);
  assert.equal(next[0].scale, 1, 'celelalte decorări rămân cum erau');
  assert.equal(next[1].scale, 1.8);
  assert.deepEqual(withPresetScale(decorations, 'nu-exista', 2), decorations, 'un id necunoscut nu inventează nimic');
});

test('compozitorul are un ciclu pentru fiecare instrument și un feedback discret', () => {
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /const \[textPreset, setTextPreset\] = useState\(\(\) => presetIndexForScale\(draft\.overlayScale\)\)/);
  assert.match(editor, /const \[stickerPreset, setStickerPreset\] = useState\(0\)/);
  assert.match(editor, /const \[emojiPreset, setEmojiPreset\] = useState\(0\)/);
  assert.match(editor, /function cycleTextPreset\(\)/, 'instrumentul Text parcurge ciclul');
  assert.match(editor, /const taken = takePreset\(stickerPreset\)/, 'fiecare sticker nou ia mărimea de acum');
  assert.match(editor, /const taken = takePreset\(emojiPreset\)/, 'emoji au ciclul lor');
  assert.match(editor, /function PresetRow\(/, 'cele trei mărimi se văd, fără o bară nouă');
  assert.ok((editor.match(/<PresetRow /g) ?? []).length >= 3, 'fiecare dintre cele trei panouri are rândul lui');
  assert.match(editor, /accessibilityRole="radio"/, 'mărimea se poate alege și direct, nu doar prin ciclu');
});

test('mărimea ajunge în postarea publicată prin același câmp și același randator', () => {
  assert.match(read('src/lib/localCapture.ts'), /overlayScale\?: number/);
  assert.match(read('src/lib/localCapture.ts'), /scale\?: number/, 'fiecare sticker își ține mărimea lui');
  const manifest = read('src/lib/studioManifest.ts');
  assert.match(manifest, /decorationBase\(id, 'TEXT', draft\.overlayX, draft\.overlayY, 0, readScale\(draft\.overlayScale\)\)/);
  assert.match(manifest, /readScale\(sticker\.scale\)/);
  assert.match(read('src/components/PostOverlay.tsx'), /scale: item\.scale/, 'randatorul citește aceeași valoare');
});

test('un draft scris înainte de mărimi se deschide neschimbat', () => {
  const capture = read('src/lib/localCapture.ts');
  assert.match(capture, /overlayScale: readScale\(draft\.overlayScale\) \?\? 1/, 'fără câmp → mărimea normală');
  assert.match(capture, /\.map\(\(entry\) => \(\{ \.\.\.entry, scale: readScale\(entry\.scale\) \?\? 1 \}\)\)/);
  assert.match(capture, /Math\.min\(3, Math\.max\(0\.4, number\)\)/, 'o valoare absurdă se taie în interval');
});
