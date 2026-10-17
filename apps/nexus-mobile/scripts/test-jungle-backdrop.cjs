/* global __dirname */
// Fundalul jungle: marca foarte estompată pe un câmp verde închis, pe ecranele fără media — și niciodată
// peste video, foto, story, cameră sau vizualizator. Verificările sunt pe sursă, fiindcă regula este o
// regulă de compoziție: un singur layer, static, memoizat, fără input și fără animație.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

const backdrop = read('src/components/JungleBackdrop.tsx');
const theme = read('src/theme/jungle.ts');

test('fundalul este un singur layer static, fără input și fără animație', () => {
  assert.match(backdrop, /export const JungleBackdrop = memo\(/);
  assert.match(backdrop, /pointerEvents="none"/);
  assert.match(backdrop, /jb-mark-512\.png/);
  assert.doesNotMatch(backdrop, /useState|useEffect|Animated|setInterval/, 'no state, no effect, no animation');
  assert.match(backdrop, /width \* 0\.9/, 'the mark is ~90 % of the screen wide');
  assert.match(theme, /canvas: '#02150D'/);
});

test('opacitatea rămâne între 6 % și 12 %', () => {
  const values = [...backdrop.matchAll(/opacity = (0\.\d+)/g)].map((match) => Number(match[1]));
  assert.ok(values.length > 0, 'the default opacity is declared');
  for (const value of values) assert.ok(value >= 0.06 && value <= 0.12, `default ${value} is inside 6–12 %`);
  // Fiecare apel pasează o valoare mică, niciodată peste 12 %.
  for (const file of ['src/app/index.tsx', 'src/screens/SettingsScreen.tsx', 'src/screens/WalletScreen.tsx',
    'src/screens/MonetizationScreen.tsx', 'src/components/ProfileMenuSheet.tsx',
    'src/components/SupportConfirmSheet.tsx', 'src/components/FeedDrawer.tsx', 'src/screens/MessagesScreen.tsx']) {
    for (const match of read(file).matchAll(/<JungleBackdrop opacity=\{(0\.\d+)\}/g)) {
      assert.ok(Number(match[1]) <= 0.12, `${file} uses ${match[1]}, above the watermark ceiling`);
    }
  }
});

test('fundalul nu ajunge peste conținutul media', () => {
  for (const media of ['src/components/PostMedia.tsx', 'src/components/MediaViewer.tsx', 'src/components/ReelsReader.tsx',
    'src/components/StoryViewer.tsx', 'src/app/camera.tsx', 'src/components/CaptureEditor.tsx']) {
    assert.doesNotMatch(read(media), /JungleBackdrop/, `${media} draws media and must keep black`);
  }
});
