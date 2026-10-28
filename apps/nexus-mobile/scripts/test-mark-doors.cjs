/* global __dirname */
// Un semn din cuvintele unui post este si o usa (regula ownerului, 19 octombrie 2026):
//
//   @nume      duce la profilul acelui creator — acelasi drum ca orice fata atinsa in aplicatie;
//   #subiect   duce la pagina tagului, exact cum face webul: `data-tag` -> `.tagPageLayer` ->
//              `GET /api/social/tags/hashtag/:tag` (`app.js:4032-4052`, `:4184`), cu numaratorile reale
//              din `repo.tagStats`.
//
// `lib/tagNavigation.ts` este singurul loc care stie adresa tagului, deci se poate rula aici: routerul
// este inlocuit cu unul care retine ce s-a cerut, iar fiecare cuvant care nu este tag nu deschide nimic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const pushed = [];
const source = read('src/lib/tagNavigation.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, (id) => {
  if (id !== 'expo-router') throw new Error(`tagNavigation.ts nu are voie sa importe ${id}`);
  return { router: { push: (target) => pushed.push(target) } };
});
const { isTag, normalizeTag, openTagPage } = moduleShim.exports;

test('adresa unui tag este cea pe care o accepta serverul: fara diez, fara majuscule, fara spatii', () => {
  assert.equal(normalizeTag('#Brașov'), 'brașov');
  assert.equal(normalizeTag('  #JUNGLE_2  '), 'jungle_2');
  assert.equal(normalizeTag(null), '');
  assert.equal(normalizeTag(undefined), '');
  assert.equal(isTag('#Brașov'), true);
  assert.equal(isTag('#doi cuvinte'), false, 'un tag nu are spatii');
  assert.equal(isTag('#a'), false, 'serverul cere cel putin doua caractere');
  assert.equal(isTag('#'), false);
  assert.equal(isTag('####'), false);
  assert.equal(isTag('#'.padEnd(52, 'a')), false, 'peste 50 de caractere nu este un tag');
});

test('un tag real deschide pagina lui; orice altceva nu deschide nimic', () => {
  pushed.length = 0;
  openTagPage('#Brașov');
  assert.deepEqual(pushed, [{ pathname: '/tag/[tag]', params: { tag: 'brașov' } }], 'tagul isi primeste pagina');
  pushed.length = 0;
  const dismissed = [];
  openTagPage('Jungle', () => dismissed.push('closed'));
  assert.deepEqual(pushed, [{ pathname: '/tag/[tag]', params: { tag: 'jungle' } }]);
  assert.deepEqual(dismissed, ['closed'], 'un panou deschis se inchide o singura data, cand pagina chiar se deschide');
  pushed.length = 0;
  for (const nothing of ['#', '#a', '#doi cuvinte', '!!!', '', null, undefined, '#'.repeat(60)]) {
    openTagPage(nothing);
  }
  assert.deepEqual(pushed, [], 'un cuvant care nu este tag nu inventeaza o pagina goala');
});
test('@nume deschide profilul, #tag deschide tagul, iar un link ramane proza subliniata', () => {
  const text = code(read('src/components/RichText.tsx'));
  assert.match(text, /onMention = openSocialProfile/, 'mentionarea este usa profilului, implicit');
  assert.match(text, /onHashtag = openTagPage/, 'tagul este usa paginii de tag, implicit');
  assert.match(text, /segment\.kind === 'mention'[\s\S]{0,120}?onMention\(segment\.text\.replace\(\/\^@\/, ''\)\)/, 'profilul primeste numele fara @');
  assert.match(text, /segment\.kind === 'hashtag'[\s\S]{0,160}?onHashtag\(segment\.text\.replace\(\/\^#\/, ''\)\)/, 'tagul primeste eticheta fara #');
  assert.match(text, /accessibilityRole=\{door \? 'link' : undefined\}/, 'o usa se anunta ca o usa');
  assert.match(text, /onPress=\{door\}/, 'apasarea sta pe <Text>-ul copil, deci propozitia ramane un paragraf');
  const door = text.slice(text.indexOf('const door'), text.indexOf('return (', text.indexOf('const door')));
  assert.doesNotMatch(door, /'link'/, 'un link nu are unde sa duca pe acest network');
});

test('pagina de cuvinte si captionul deseneaza aceleasi usi', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  const reading = code(read('src/components/PostReading.tsx'));
  assert.match(canvas, /<RichText[\s\S]{0,600}?mentionStyle=\{styles\.markMention\}/, 'textul paginii isi pastreaza cerneala de mentionare');
  assert.match(reading, /<RichText text=\{entry\} style=\{\[styles\.readingText, authoredWords\]\} \/>/, 'paginile unui text lung folosesc acelasi renderer');
  assert.match(reading, /<RichText text=\{preview\.text\} style=\{styles\.panelText\}/, 'un panou citat foloseste acelasi renderer');
});

test('pagina tagului citeste exact ruta tagului si isi numara postarile', () => {
  const route = code(read('src/app/tag/[tag].tsx'));
  assert.match(route, /\/api\/social\/tags\/hashtag\/\$\{encodeURIComponent\(tag\)\}\?limit=20\$\{cursor\}/, 'aceeasi ruta ca webul');
  assert.match(route, /page\.stats\?\.posts/, 'numaratorile vin din tagStats, nu se inventeaza');
  assert.match(route, /page\.stats\?\.authors/);
  assert.match(route, /next_before/, 'pagina urmatoare se citeste dupa cursorul serverului');
  assert.match(route, /`#\$\{tag\}`/, 'titlul este tagul, cu diezul lui');
});
