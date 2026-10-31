/* global __dirname */
/**
 * Reelul deschis din profil se citește ca o postare de cuvinte, iar comanda lui nu se suprapune.
 *
 * Runda 41 (owner, 31 octombrie 2026), trei reclamații pe același ecran:
 *   · „un al doilea antet, cu același nume" — ruta desena un rând de 52 dp peste un reel care își scria
 *     deja autorul, iar pagina de cuvinte de alături nu-l mai avea din runda 31;
 *   · „se vede împins în jos" și „nu se termină la marginea ecranului" — banda de jos a paginii era `0`,
 *     deci captionul și coloana de acțiuni cădeau sub bara de navigare a telefonului;
 *   · „bara de progres intră peste butonul de sunet" — ceasul clipului se întindea pe toată lățimea
 *     blocului, adică până sub discul de 56 dp al coloanei.
 *
 * Testul ține aritmetica și faptul că ecranele o folosesc (o parte e verificată și în
 * `test-post-chrome.cjs`, pentru ruta care le așază).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const number = (source, pattern, what) => {
  const found = source.match(pattern);
  assert.ok(found, `nu am găsit ${what}`);
  return Number(found[1]);
};

const reel = read('src/components/ReelsReader.tsx');
const canvas = read('src/components/PostCanvas.tsx');
const route = read('src/app/post/[id].tsx');
const rail = read('src/components/PostRail.tsx');
const reader = read('src/lib/readerBar.ts');

test('reelul are capul sus și captionul jos, ca o pagină de cuvinte', () => {
  assert.match(reel, /const band = Math\.max\(0, overlayBottom\) \+ Math\.max\(0, bottomInset\);/,
    'o singură bandă la picior: bara suprafeței plus marginea telefonului');
  assert.match(reel, /const stacked = layout === 'post';/);
  assert.match(reel, /layout=\{layout\}[\s\S]{0,200}page=\{stacked\}/, 'canvasul primește felul paginii, nu o presupunere');
  assert.match(reel, /topInset=\{topInset\}/);
  assert.match(reel, /bottomInset=\{band\}/);
  assert.match(reel, /bottom=\{RAIL_FOOT \+ band\}/, 'coloana urcă exact cu banda pe care o ține canvasul');
  assert.match(reel, /bottom=\{214 \+ band\}/, 'meniul de distribuire urcă o dată cu ea');
  assert.match(reel, /authorAction=\{follow && authorId \? \(/, 'ușa autorului e aceeași componentă ca la o postare');
  assert.match(reel, /<RelationButton[\s\S]{0,200}variant="compact"/);
  assert.match(reel, /onTranslate=\{\(translate && !isVideo\) \?/, 'un clip nu oferă traducerea; o poză o păstrează');
  assert.match(route, /layout="post"[\s\S]{0,80}follow/,
    'ruta deschide un reel din profil cu cap sus și cu ușa autorului');
  assert.match(route, /bottomInset=\{bottomInsetFor\(entry\)\}/);
});

test('ceasul clipului nu mai trece pe sub discul de sunet', () => {
  assert.match(canvas, /const railFootGutter = Math\.max\(0, railGutter - metrics\.padH\);/);
  assert.match(canvas, /<View style=\{\[styles\.videoClock, \{ paddingRight: railFootGutter \}\]\}>/);

  /** Numerele reale: coloana stă la 10 dp de margine, are celule de 56, iar cuvintele păstrează 78. */
  const cell = number(rail, /export const RAIL_CELL = (\d+);/, 'celula coloanei');
  const edge = number(rail, /rail: \{ position: 'absolute', right: (\d+)/, 'marginea coloanei');
  const gutter = number(canvas, /feed: \{\s*name: 14, handle: 12, disc: 42, caption: 14, captionLine: 19,\s*reading: 20, readingLine: 29, quoteIntro: 16, quoteIntroLine: 22,\s*padH: 14, padB: 22, railGutter: (\d+)/, 'gutter-ul coloanei');
  assert.ok(gutter > edge + cell, `ceasul se termină la ${gutter} dp de margine, coloana începe la ${cell + edge}`);
  assert.ok(gutter - (edge + cell) >= 8, 'rămâne aer între bară și disc');
  assert.match(rail, /soundDisc: \{\s*width: RAIL_CELL, height: RAIL_CELL/, 'discul de sunet e celula coloanei');
});

test('footerul și marginea de jos sunt aceleași pentru un reel și pentru o pagină de cuvinte', () => {
  const air = number(reader, /air: (\d+),/, 'aerul paginii din profil');
  assert.equal(air, 10, 'o pagină din profil păstrează o fâșie de aer sub ea, nu banda unei uși');
  assert.match(reader, /export function profileReaderBottomInset[\s\S]{0,240}PROFILE_READER_FOOT\.air/,
    'aceeași funcție dă piciorul, oricare ar fi felul paginii');
  assert.match(route, /if \(profileOrigin\) return profileReaderBottomInset\(insets\.bottom\);/,
    'orice pagină deschisă din profil se termină în același loc');
  assert.match(route, /\{systemNavPlate \? <SystemNavBand height=\{insets\.bottom\} \/> : null\}/,
    'placa de metal (footerul gri) se montează pe pagina din profil');
  /** `RAIL_FOOT` rămâne constanta coloanei: banda se adaugă peste ea, niciodată în locul ei. */
  assert.match(reel, /bottom=\{RAIL_FOOT \+ band\}/);
});
