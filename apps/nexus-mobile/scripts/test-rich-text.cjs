/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

/**
 * `lib/richText.ts` is the whole formatting model of a caption: the renderer only maps the segments it
 * returns onto nested `<Text>` nodes. It therefore has to be pure, and it is tested the way every other
 * `lib` module is — through `typescript`, without React Native.
 */
const source = readFileSync(resolve(__dirname, '../src/lib/richText.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, () => {
  throw new Error('richText.ts nu are voie să importe nimic la rulare');
});
const { richTextSegments, captionTags } = moduleShim.exports;

const kinds = (segments) => segments.map((segment) => segment.kind);
const painted = (segments) => segments.filter((segment) => segment.kind !== 'text').map((segment) => segment.text);

test('un text fără semne este un singur segment, iar un text gol nu are niciunul', () => {
  assert.deepEqual(richTextSegments('o zi liniștită'), [{ text: 'o zi liniștită', kind: 'text' }]);
  assert.deepEqual(richTextSegments(''), []);
  assert.deepEqual(richTextSegments(null), []);
  assert.deepEqual(richTextSegments(undefined), []);
  assert.deepEqual(richTextSegments(42), []);
  assert.deepEqual(richTextSegments('   '), [{ text: '   ', kind: 'text' }]);
});

test('cele trei semne se recunosc și își păstrează textul', () => {
  const segments = richTextSegments('merg la #Brașov cu @ana prin https://nexus.ro/zi');
  assert.deepEqual(kinds(segments), ['text', 'hashtag', 'text', 'mention', 'text', 'link']);
  assert.deepEqual(painted(segments), ['#Brașov', '@ana', 'https://nexus.ro/zi']);
  assert.equal(segments.map((segment) => segment.text).join(''), 'merg la #Brașov cu @ana prin https://nexus.ro/zi');
});

test('segmentele lipite la loc dau exact textul de intrare', () => {
  const samples = [
    'salut',
    '#unu după #doi și @trei',
    'un link https://exemplu.ro/a/b?c=1#frag, apoi punct.',
    'ana@exemplu.ro nu este un nume',
    'C# nu este un hashtag, iar a#tag nici atât',
    'linia unu\nlinia doi #jos',
    '#doar',
    '@doar',
    'www.exemplu.ro',
    'text cu #două și @două și www.două.ro',
    '#'.repeat(3),
    '@'.repeat(2),
  ];
  for (const sample of samples) {
    const segments = richTextSegments(sample);
    assert.equal(segments.map((segment) => segment.text).join(''), sample, `pierdere de text: ${sample}`);
    for (const segment of segments) assert.ok(segment.text.length > 0, `segment gol în: ${sample}`);
  }
});

test('un semn începe un cuvânt, deci o adresă și un diez lipit rămân text', () => {
  assert.deepEqual(painted(richTextSegments('ana@exemplu.ro')), []);
  assert.deepEqual(richTextSegments('ana@exemplu.ro'), [{ text: 'ana@exemplu.ro', kind: 'text' }]);
  assert.deepEqual(painted(richTextSegments('C# și F#')), []);
  assert.deepEqual(painted(richTextSegments('vezi a#tag')), []);
  assert.deepEqual(painted(richTextSegments('(#tag)')), ['#tag']);
  assert.deepEqual(painted(richTextSegments('„@ana”')), ['@ana']);
});

test('punctuația de la capătul unei adrese rămâne în propoziție', () => {
  assert.deepEqual(richTextSegments('vezi https://nexus.ro/a.'), [
    { text: 'vezi ', kind: 'text' },
    { text: 'https://nexus.ro/a', kind: 'link' },
    { text: '.', kind: 'text' },
  ]);
  assert.deepEqual(painted(richTextSegments('(https://nexus.ro/a), iar apoi')), ['https://nexus.ro/a']);
  assert.deepEqual(richTextSegments('https://nexus.ro/a), iar apoi').at(-1), { text: '), iar apoi', kind: 'text' });
  // O adresă care este doar punctuație nu se pictează deloc, ca să nu rămână un link gol.
  assert.deepEqual(richTextSegments('https://...'), [{ text: 'https://...', kind: 'text' }]);
});

test('un hashtag mai lung de 60 de caractere este tăiat, nu pictat integral', () => {
  const longTag = `#${'a'.repeat(70)}`;
  const segments = richTextSegments(longTag);
  assert.equal(segments[0].kind, 'hashtag');
  // Diezul plus 60 de caractere: limita este a numelui, nu a semnului.
  assert.equal(segments[0].text.length, 61);
  assert.equal(segments.map((segment) => segment.text).join(''), longTag);
  assert.equal(segments[1].kind, 'text');
});

test('etichetele unui text se citesc fără diez și în ordinea autorului', () => {
  assert.deepEqual(captionTags('dimineață #Brașov, apoi #cod și iar #Brașov'), ['Brașov', 'cod', 'Brașov']);
  assert.deepEqual(captionTags('fără etichete'), []);
  assert.deepEqual(captionTags(null), []);
  // Un tag lipit de un cuvânt nu este un tag: `C#` rămâne text, ca să nu inventeze o etichetă.
  assert.deepEqual(captionTags('C# și F#'), []);
});
