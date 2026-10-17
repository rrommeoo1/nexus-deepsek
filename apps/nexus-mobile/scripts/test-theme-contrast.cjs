#!/usr/bin/env node
/**
 * The jungle palette has to be readable, not just pretty.
 *
 * Every pair the app really paints — ink on surface, muted ink on the field, nav marks — is measured with
 * the WCAG formula (`luminance`/`contrast` of `theme/jungle.ts`) and must reach 4.5:1 for normal text.
 * One pair below the threshold fails the run: the theme is data, and this is its contract.
 *
 * It also holds the shape of the theme: the field is the leaf green the owner named (#02150D), media is
 * still black, and the primary action is kiwi rather than the old teal — so a later edit cannot quietly
 * put pure black back or bring a white rule with it.
 *
 * Usage: node scripts/test-theme-contrast.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'src/theme/jungle.ts');

const theme = (() => {
  const compiled = ts.transpileModule(fs.readFileSync(SOURCE, 'utf8'), {
    fileName: 'jungle.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, require);
  return shim.exports;
})();

const failures = [];
const minimum = 4.5;

for (const pair of theme.TEXT_PAIRS) {
  const ratio = theme.contrast(pair.ink, pair.surface);
  const line = `${pair.name}: ${ratio.toFixed(2)}:1 (${pair.ink} pe ${pair.surface})`;
  if (ratio < minimum) failures.push(`${line} — sub pragul de ${minimum}:1`);
  else console.log(`ok · ${line}`);
}

// The shape of the theme, asserted rather than described.
if (theme.jungle.canvas.toUpperCase() !== '#02150D') failures.push(`canvas is ${theme.jungle.canvas}, expected #02150D`);
if (theme.jungle.media.toUpperCase() !== '#000000') failures.push('media must stay black: a video is not tinted by a theme');
if (theme.jungle.primary.toUpperCase() !== '#8BD04A') failures.push('the primary action is kiwi (#8BD04A)');
if (!/^#[0-9A-F]{6}$/i.test(theme.jungle.navActive)) failures.push('the open nav mark needs a real colour');

const rings = Object.entries(theme.fruitRing);
if (rings.length !== 5) failures.push(`the five top-corner doors carry a ring; found ${rings.length}`);
for (const [door, colour] of rings) {
  if (!/^rgba\(\d+,\d+,\d+,0\.\d+\)$/.test(colour)) failures.push(`${door} ring is not a low-alpha fruit tint: ${colour}`);
}

if (failures.length) {
  console.error('\nThe jungle palette does not hold:');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}

console.log(`\nok · ${theme.TEXT_PAIRS.length} pairs ≥ ${minimum}:1 · tile palette · media stays black`);
