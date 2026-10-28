#!/usr/bin/env node
/**
 * The palette has to be readable, not just pretty — and it has to be *the* palette.
 *
 * Round 31 (31 October 2026) replaced the measured jungle (leaf green, banana, kiwi) with Matte Black +
 * Silver. This test is the contract of that palette as the app really paints it:
 *
 *   1. every text-on-surface pair of `jungle` clears WCAG AA (4.5:1), measured with the WCAG formula;
 *   2. the shape of the theme is the shape the owner asked for — matte black field, silver accent, a
 *      bright open tab and a quieter idle one, media still black;
 *   3. nothing branded is left in it: the five top-corner doors wear the metal (a low-alpha silver),
 *      never a fruit.
 *
 * Usage: node scripts/test-theme-contrast.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src/theme');

/** Load a theme module with the tiny `require` graph the modules really use. */
const loaded = new Map();
function load(name) {
  if (loaded.has(name)) return loaded.get(name);
  const compiled = ts.transpileModule(fs.readFileSync(path.join(SRC, `${name}.ts`), 'utf8'), {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  const localRequire = (request) => {
    const match = request.match(/^\.\/([\w-]+)$/);
    if (!match) throw new Error(`${name}.ts does not import ${request}`);
    return load(match[1]);
  };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, localRequire);
  loaded.set(name, shim.exports);
  return shim.exports;
}

const theme = load('jungle');
const palette = load('blackSilver');
const { jungle, fruitRing, fruitWash, TEXT_PAIRS, contrast } = theme;
const { blackSilver } = palette;

const failures = [];
const minimum = 4.5;

for (const pair of TEXT_PAIRS) {
  const ratio = contrast(pair.ink, pair.surface);
  const line = `${pair.name}: ${ratio.toFixed(2)}:1 (${pair.ink} pe ${pair.surface})`;
  if (ratio < minimum) failures.push(`${line} — sub pragul de ${minimum}:1`);
  else console.log(`ok · ${line}`);
}

// The shape of the palette, asserted rather than described.
const expect = (actual, wanted, label) => {
  if (String(actual).toUpperCase() !== String(wanted).toUpperCase()) failures.push(`${label}: ${actual}, expected ${wanted}`);
};
expect(jungle.canvas, blackSilver.matteBlack, 'canvas');
expect(jungle.surface, blackSilver.graphite, 'surface');
expect(jungle.surfaceRaised, blackSilver.elevated, 'surfaceRaised');
expect(jungle.sheet, blackSilver.graphite, 'sheet');
expect(jungle.primary, blackSilver.silver, 'the primary action is the metal');
expect(jungle.primaryPressed, blackSilver.bright, 'a pressed action is the lit metal');
expect(jungle.primaryInk, blackSilver.onSilver, 'the ink on the metal is matte black');
expect(jungle.navActive, blackSilver.bright, 'the open tab is the lit metal');
expect(jungle.navIdle, blackSilver.muted, 'an idle tab is the quiet metal');
expect(jungle.media, '#000000', 'media stays black: a video is not tinted by a theme');

// No fruit left in the chrome: the ring and the wash are the metal at low alpha.
const metallic = /^rgba\(196,199,203,0\.\d+\)$/;
for (const [door, colour] of Object.entries(fruitRing)) {
  if (!metallic.test(colour)) failures.push(`the ${door} ring is not the metal: ${colour}`);
}
for (const [door, colour] of Object.entries(fruitWash)) {
  if (!metallic.test(colour)) failures.push(`the ${door} wash is not the metal: ${colour}`);
}

if (failures.length) {
  console.error('\nThe palette does not hold:');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}

console.log(`\nok · ${TEXT_PAIRS.length} pairs ≥ ${minimum}:1 · matte-black field · silver accent · media stays black`);
