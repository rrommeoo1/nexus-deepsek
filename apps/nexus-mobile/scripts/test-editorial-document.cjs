/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function load(file, requireShim) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const documentModule = load('src/lib/editorialDocument.ts', () => {
  throw new Error('editorialDocument.ts nu are voie să importe nimic la rulare');
});
const flowModule = load('src/lib/editorialFlow.ts', (id) => {
  if (id === './editorialDocument') return documentModule;
  throw new Error(`editorialFlow.ts a cerut un modul neașteptat: ${id}`);
});

const {
  MAX_EDITORIAL_BLOCKS, TEXT_MAX_CHARS, normalizeEditorialDocument, readEditorialDocument,
  emptyEditorialDocument, paragraphBlock, headingBlock, mediaBlock, pageBreakBlock,
  documentPlainText, documentCharCount, documentHasMedia, documentMediaIndexes,
  applyPlainText, editorialTextMap, editorialPreview, documentFromPlainText,
  setMediaPlacement, setMediaWidth, setMediaWrap, setDocumentTypography, moveEditorialBlock,
  removeEditorialBlock, toggleHeadingBlock, remapMediaIndexes, appendMediaBlock,
  placeMediaBlockAt, placeMediaBlockAtStart, placeMediaBlockAtEnd, placeMediaBlockAtFraction,
} = documentModule;
const { flowEditorialDocument, measureTextWidth } = flowModule;

const name = (prefix, index) => `${prefix}-${index}`;
const para = (text, index) => paragraphBlock(text, name('p', index));

function wordsOf(text) {
  return String(text).match(/\S+/g) ?? [];
}

function options(overrides = {}) {
  return {
    pageWidth: 360,
    pageHeight: 640,
    fontSize: 20,
    lineHeight: 29,
    font: 'serif',
    marginX: 26,
    marginTop: 30,
    marginBottom: 30,
    aspectRatios: { 0: 16 / 9, 1: 3 / 4, 2: 16 / 9 },
    ...overrides,
  };
}

function assertNoOverlap(flow) {
  for (const page of flow.pages) {
    for (const line of page.lines) {
      for (const box of page.media) {
        const intersects = line.x < box.x + box.width
          && line.x + line.width > box.x
          && line.y < box.y + box.height
          && line.y + line.lineHeight > box.y;
        assert.equal(intersects, false, `line "${line.text}" overlaps media ${box.blockId}`);
      }
    }
    for (let index = 0; index < page.media.length; index++) {
      for (let other = index + 1; other < page.media.length; other++) {
        const a = page.media[index];
        const b = page.media[other];
        const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        assert.equal(intersects, false, `two media blocks overlap on page ${page.index}`);
      }
    }
  }
}

function wordsFromFlow(flow) {
  return flow.pages.flatMap((page) => page.lines).flatMap((line) => wordsOf(line.text));
}

test('documentul se validează strict și se citește înapoi identic', () => {
  const document = {
    version: 1,
    typography: 'auto',
    blocks: [
      para('Primul paragraf al paginii.', 1),
      headingBlock('Un titlu de ziar', 'h-1'),
      mediaBlock(0, { placement: 'left', widthFraction: 0.55, wrapText: true, mediaType: 'image' }, 'm-1'),
      pageBreakBlock('br-1'),
      mediaBlock(1, { placement: 'full', widthFraction: 1, wrapText: false, mediaType: 'video' }, 'm-2'),
      paragraphBlock('Ultimul paragraf.', 'p-2'),
    ],
  };
  assert.deepEqual(normalizeEditorialDocument(document), document);
  assert.deepEqual(normalizeEditorialDocument(JSON.parse(JSON.stringify(document))), document);
  assert.equal(documentCharCount(document), 27 + 16 + 17);
  assert.equal(documentHasMedia(document), true);
  assert.deepEqual(documentMediaIndexes(document), [0, 1]);
  assert.equal(documentPlainText(document), 'Primul paragraf al paginii.\n\nUn titlu de ziar\n\nUltimul paragraf.');
  assert.deepEqual(editorialTextMap(document).blocks.map((entry) => entry.id), ['p-1', 'h-1', 'p-2']);
});

test('un document rupt este refuzat de server și ignorat de cititor', () => {
  const valid = { version: 1, blocks: [para('O pagină.', 1)] };
  for (const broken of [
    null, [], 'pagina',
    { version: 2, blocks: [] },
    { version: 1, blocks: [], extra: true },
    { version: 1, blocks: [paragraphBlock('x', 'dup'), paragraphBlock('y', 'dup')] },
    { version: 1, blocks: [mediaBlock(0, { placement: 'centre' }, 'm-1')] },
    { version: 1, blocks: [mediaBlock(0, { widthFraction: 'wide' }, 'm-1')] },
    { version: 1, blocks: [mediaBlock(9, {}, 'm-1')] },
    { version: 1, blocks: [{ id: 'm-1', type: 'media', mediaIndex: 0, mediaType: 'image', placement: 'left', widthFraction: 0.5, wrapText: 'yes' }] },
    { version: 1, blocks: [{ id: 'bad id!', type: 'paragraph', text: 'x' }] },
    { version: 1, blocks: Array.from({ length: MAX_EDITORIAL_BLOCKS + 1 }, (_, index) => para(`p${index}`, index)) },
    { version: 1, blocks: [para('x'.repeat(TEXT_MAX_CHARS + 1), 1)] },
  ]) {
    assert.throws(() => normalizeEditorialDocument(broken), /EDITORIAL_DOCUMENT_INVALID/, JSON.stringify(broken));
    assert.equal(readEditorialDocument(broken), null);
  }
  assert.deepEqual(readEditorialDocument(valid), { ...valid, typography: 'auto' });
});

test('textul tastat păstrează blocurile media la locul lor', () => {
  const document = documentFromPlainText('unu\n\ndoi', [{ mediaType: 'image' }]);
  assert.deepEqual(document.blocks.map((block) => block.type), ['media', 'paragraph', 'paragraph']);
  const edited = applyPlainText(document, 'unu\n\nșters\n\ntrei\n\npatru');
  assert.deepEqual(edited.blocks.map((block) => block.type), ['media', 'paragraph', 'paragraph', 'paragraph', 'paragraph']);
  assert.equal(documentPlainText(edited), 'unu\n\nșters\n\ntrei\n\npatru');
  assert.equal(edited.blocks[0].mediaIndex, 0);
  assert.equal(applyPlainText(edited, '').blocks.filter((block) => block.type !== 'media').length, 0);
});

test('spațiul scris ultimul rămâne în editor, dar nu ajunge în postare', () => {
  const document = documentFromPlainText('unu', []);
  const typing = applyPlainText(document, 'unu ');
  assert.equal(typing.blocks[0].text, 'unu ', 'spațiul de la caret rămâne în bloc');
  assert.equal(documentCharCount(typing), 4);
  const word = applyPlainText(typing, 'unu doi');
  assert.equal(word.blocks[0].text, 'unu doi', 'al doilea cuvânt nu se lipește de primul');
  assert.equal(documentPlainText(word), 'unu doi');
  assert.equal(documentPlainText(typing), 'unu', 'postarea nu păstrează spațiul de la coadă');
  assert.equal(applyPlainText(typing, 'unu  ').blocks[0].text, 'unu ', 'spațiile de la coadă se strâng la unul');
  assert.deepEqual(applyPlainText(document, '   ').blocks, [], 'o pagină doar cu spații rămâne goală');
});

test('un scurt text cu o fotografie peisaj curge în jurul ei și continuă pe toată lățimea', () => {
  const article = 'Pădurea își deschide pagina și fiecare cuvânt găsește locul lui. '.repeat(8);
  const document = {
    version: 1, typography: 'auto', blocks: [
      mediaBlock(0, { placement: 'left', widthFraction: 0.5, wrapText: true }, 'm-1'),
      para(article.trim(), 1),
    ],
  };
  const flow = flowEditorialDocument(document, options());
  assert.ok(flow.pageCount >= 1);
  assert.equal(flow.pages[0].media.length, 1);
  const box = flow.pages[0].media[0];
  assert.ok(box.height < box.width, 'the landscape photo keeps its wide proportion');
  const beside = flow.pages[0].lines.filter((line) => line.y < box.y + box.height);
  assert.ok(beside.length > 0, 'words start beside the photo');
  assert.ok(beside.every((line) => line.x >= box.x + box.width), 'the first lines sit to the right of the photo');
  const after = flow.pages[0].lines.filter((line) => line.y >= box.y + box.height);
  assert.ok(after.some((line) => line.x === flow.marginX && line.width === flow.contentWidth), 'the words return to the full measure');
  assert.deepEqual(wordsFromFlow(flow), wordsOf(article));
  assertNoOverlap(flow);
});

test('o fotografie portret așezată la dreapta lasă textul în stânga', () => {
  const article = 'Un articol mediu, cu propoziții întregi, care trebuie să curgă pe lângă un portret înalt fără să piardă niciun cuvânt. '.repeat(5);
  const document = {
    version: 1, blocks: [
      mediaBlock(1, { placement: 'right', widthFraction: 0.45, wrapText: true }, 'm-1'),
      para(article.trim(), 1),
    ],
  };
  const flow = flowEditorialDocument(document, options());
  const box = flow.pages[0].media[0];
  assert.ok(box.height > box.width, 'the portrait keeps its tall proportion');
  const beside = flow.pages[0].lines.filter((line) => line.y < box.y + box.height);
  assert.ok(beside.length > 0);
  assert.ok(beside.every((line) => line.x + line.width <= box.x), 'the lines stay left of the portrait');
  assert.deepEqual(wordsFromFlow(flow), wordsOf(article));
  assertNoOverlap(flow);
});

test('două fotografii pot sta pe aceeași pagină, fără suprapunere', () => {
  const article = 'Două imagini împart pagina, iar textul umple spațiul dintre ele și continuă dedesubt. '.repeat(4);
  const document = {
    version: 1, blocks: [
      mediaBlock(0, { placement: 'left', widthFraction: 0.42, wrapText: true }, 'm-1'),
      mediaBlock(1, { placement: 'right', widthFraction: 0.42, wrapText: true }, 'm-2'),
      para(article.trim(), 1),
    ],
  };
  const flow = flowEditorialDocument(document, options());
  assert.equal(flow.pageCount, 1);
  assert.equal(flow.pages[0].media.length, 2);
  assertNoOverlap(flow);
  assert.deepEqual(wordsFromFlow(flow), wordsOf(article));
});

test('un articol lung cu mai multe fotografii se paginează fără să piardă un cuvânt', () => {
  const article = Array.from({ length: 260 }, (_, index) => `cuvant${index}`).join(' ');
  const document = {
    version: 1, blocks: [
      headingBlock('Titlul articolului', 'h-1'),
      mediaBlock(0, { placement: 'left', widthFraction: 0.5, wrapText: true }, 'm-1'),
      para(article, 1),
      mediaBlock(1, { placement: 'right', widthFraction: 0.4, wrapText: true }, 'm-2'),
      para('Un paragraf de închidere, după a doua fotografie.', 2),
      mediaBlock(2, { placement: 'full', widthFraction: 1, wrapText: false }, 'm-3'),
      para('Ultimul rând al paginii.', 3),
    ],
  };
  const flow = flowEditorialDocument(document, options());
  assert.ok(flow.pageCount >= 3, `the article spans ${flow.pageCount} pages`);
  assert.equal(flow.overflow, false);
  assert.equal(flow.pages.flatMap((page) => page.media).length, 3);
  assert.deepEqual(wordsFromFlow(flow), [
    ...wordsOf('Titlul articolului'), ...wordsOf(article),
    ...wordsOf('Un paragraf de închidere, după a doua fotografie.'),
    ...wordsOf('Ultimul rând al paginii.'),
  ]);
  assertNoOverlap(flow);
  for (const page of flow.pages) {
    assert.ok(page.lines.length || page.media.length, `page ${page.index} is not blank`);
  }
});

test('un clip este un bloc de lățime completă, cu text deasupra și dedesubt', () => {
  const document = {
    version: 1, blocks: [
      para('Textul de dinaintea clipului.', 1),
      mediaBlock(0, { placement: 'full', widthFraction: 1, wrapText: false, mediaType: 'video' }, 'm-1'),
      para('Textul de după clip.', 2),
    ],
  };
  const flow = flowEditorialDocument(document, options());
  const box = flow.pages[0].media[0];
  assert.equal(box.width, flow.contentWidth);
  assert.equal(box.placement, 'full');
  assert.ok(flow.pages[0].lines.some((line) => line.y < box.y));
  assert.ok(flow.pages[0].lines.some((line) => line.y >= box.y + box.height));
  assertNoOverlap(flow);
});

test('o pagină doar cu text nu inventează media și își păstrează paragrafele', () => {
  const document = {
    version: 1, blocks: [para('Primul paragraf.', 1), para('Al doilea paragraf.', 2)],
  };
  const flow = flowEditorialDocument(document, options());
  assert.equal(flow.pages[0].media.length, 0);
  assert.deepEqual(wordsFromFlow(flow), ['Primul', 'paragraf.', 'Al', 'doilea', 'paragraf.']);
  assert.ok(flow.pages[0].lines.some((line) => line.text === 'Primul paragraf.'));
  assert.ok(flow.pages[0].lines.some((line) => line.text === 'Al doilea paragraf.'));
});

test('un salt de pagină forțează o pagină nouă', () => {
  const document = {
    version: 1, blocks: [para('Înainte.', 1), pageBreakBlock('br-1'), para('După.', 2)],
  };
  const flow = flowEditorialDocument(document, options());
  assert.equal(flow.pageCount, 2);
  assert.deepEqual(flow.pages[0].lines.map((line) => line.text), ['Înainte.']);
  assert.deepEqual(flow.pages[1].lines.map((line) => line.text), ['După.']);
});

test('comenzile de așezare mută și redimensionează fără să atingă textul', () => {
  const start = {
    version: 1, blocks: [mediaBlock(0, { placement: 'left', widthFraction: 0.5, wrapText: true }, 'm-1'), para('Text.', 1)],
  };
  const right = setMediaPlacement(start, 'm-1', 'right');
  assert.equal(right.blocks[0].placement, 'right');
  assert.equal(documentPlainText(right), 'Text.');
  const full = setMediaPlacement(start, 'm-1', 'full');
  assert.equal(full.blocks[0].widthFraction, 1);
  assert.equal(full.blocks[0].wrapText, false);
  const narrower = setMediaWidth(start, 'm-1', 0.3);
  assert.equal(narrower.blocks[0].widthFraction, 0.3);
  const wrapped = setMediaWrap(full, 'm-1', true);
  assert.equal(wrapped.blocks[0].wrapText, true);
  assert.equal(wrapped.blocks[0].placement, 'left');
  const moved = moveEditorialBlock(start, 'm-1', 1);
  assert.deepEqual(moved.blocks.map((block) => block.type), ['paragraph', 'media']);
  const heading = toggleHeadingBlock(start, 'p-1');
  assert.equal(heading.blocks[1].type, 'heading');
  const removed = removeEditorialBlock(start, 'm-1');
  assert.equal(documentHasMedia(removed), false);
  const typography = setDocumentTypography(start, 'large');
  assert.equal(typography.typography, 'large');
});

test('fotografia se așază pe cuvântul pe care o lasă autorul, fără să piardă nimic', () => {
  const sentence = 'Pădurea își ține pagina, iar cuvintele se așază pe ecran fără să fie tăiate.';
  const start = {
    version: 1,
    blocks: [mediaBlock(0, { placement: 'left', widthFraction: 0.5, wrapText: true }, 'm-1'), para(sentence, 1)],
  };
  const placed = placeMediaBlockAt(start, 'm-1', { blockId: 'p-1', offset: Math.round(sentence.length / 2) });
  assert.deepEqual(placed.blocks.map((block) => block.type), ['paragraph', 'media', 'paragraph']);
  assert.deepEqual(wordsOf(documentPlainText(placed)), wordsOf(sentence));
  const flow = flowEditorialDocument(placed, options());
  assert.deepEqual(wordsFromFlow(flow), wordsOf(sentence));
  assertNoOverlap(flow);
  /** The picture no longer sits above every word: the first page opens with text. */
  assert.ok(flow.pages[0].lines.length > 0);
  assert.equal(flow.pages[0].media.length, 1);
});

test('început, mijloc și sfârșit: fotografia stă la locul cerut, nu după tot textul', () => {
  const text = `${'alfa beta gamma delta '.repeat(6)}omega`;
  const base = { version: 1, blocks: [para(text, 1), mediaBlock(0, {}, 'm-1')] };
  const words = wordsOf(text);
  const lead = placeMediaBlockAtFraction(base, 'm-1', 0);
  assert.equal(lead.blocks[0].id, 'm-1');
  const end = placeMediaBlockAtFraction(base, 'm-1', 1);
  assert.equal(end.blocks[end.blocks.length - 1].id, 'm-1');
  const half = placeMediaBlockAtFraction(base, 'm-1', 0.5);
  const at = half.blocks.findIndex((block) => block.id === 'm-1');
  assert.ok(at > 0 && at < half.blocks.length - 1, 'the picture stands inside the words');
  for (const document of [lead, end, half]) assert.deepEqual(wordsOf(documentPlainText(document)), words);
  const flow = flowEditorialDocument(half, options());
  assert.deepEqual(wordsFromFlow(flow), words);
  assertNoOverlap(flow);
  /**
   * Arranging a picture never invents a character: the cut takes the space between the two words with
   * it. The composer counts what the server counts, so the footer does not jump on a layout gesture.
   */
  assert.ok(documentCharCount(half) <= documentCharCount(base));
  assert.equal(documentCharCount(base) - documentCharCount(half), 1);
});

test('tăierea se face pe spațiu, iar aceeași așezare repetată nu mai taie nimic', () => {
  const document = { version: 1, blocks: [para('unu doi trei', 1), mediaBlock(0, {}, 'm-1')] };
  const placed = placeMediaBlockAt(document, 'm-1', { blockId: 'p-1', offset: 2 });
  assert.deepEqual(placed.blocks.map((block) => block.type), ['paragraph', 'media', 'paragraph']);
  assert.equal(placed.blocks[0].text, 'unu');
  assert.equal(placed.blocks[2].text, 'doi trei');
  const again = placeMediaBlockAt(placed, 'm-1', { blockId: placed.blocks[2].id, offset: 0 });
  assert.deepEqual(again.blocks.map((block) => block.id), placed.blocks.map((block) => block.id));
  assert.equal(placeMediaBlockAtStart(placed, 'm-1').blocks[0].id, 'm-1');
  assert.equal(placeMediaBlockAtEnd(placed, 'm-1').blocks[2].id, 'm-1');
});

test('ștergerea unui fișier remapează indicii și scoate blocul lui', () => {
  const document = {
    version: 1, blocks: [
      mediaBlock(0, {}, 'm-0'), mediaBlock(1, {}, 'm-1'), mediaBlock(2, {}, 'm-2'),
    ],
  };
  const next = remapMediaIndexes(document, 1);
  assert.deepEqual(next.blocks.map((block) => [block.id, block.mediaIndex]), [['m-0', 0], ['m-2', 1]]);
  assert.deepEqual(appendMediaBlock(emptyEditorialDocument(), 0, 'image').blocks.map((block) => block.type), ['media']);
});

test('o pagină de 20 000 de caractere se împarte fără pierdere și fără pagini goale', () => {
  const sentence = 'Pădurea își ține pagina, iar cuvintele se așază pe ecran fără să fie tăiate. ';
  const article = sentence.repeat(Math.ceil(TEXT_MAX_CHARS / sentence.length)).slice(0, TEXT_MAX_CHARS).trim();
  const document = { version: 1, blocks: [para(article, 1)] };
  const flow = flowEditorialDocument(document, options({ maxPages: 200 }));
  assert.equal(flow.overflow, false);
  assert.ok(flow.pageCount > 10);
  assert.deepEqual(wordsFromFlow(flow), wordsOf(article));
  for (const page of flow.pages) assert.ok(page.lines.length > 0, `page ${page.index} is blank`);
});

test('măsura unui rând este o funcție stabilă a literei și a mărimii', () => {
  assert.ok(measureTextWidth('mmmm', 20, 'serif') > measureTextWidth('iiii', 20, 'serif'));
  assert.equal(measureTextWidth('abcd', 20, 'mono'), measureTextWidth('wxyz', 20, 'mono'));
  assert.ok(measureTextWidth('Text', 24, 'serif') > measureTextWidth('Text', 20, 'serif'));
});

test('previzualizarea taie pe cuvânt, nu arată tot articolul și spune când mai e text', () => {
  const document = documentFromPlainText('un text lung '.repeat(40));
  const preview = editorialPreview(document, 60);
  assert.equal(preview.hasMore, true);
  assert.ok(preview.text.endsWith('\u2026'));
  assert.ok(preview.text.length <= 61);
  assert.equal(editorialPreview(documentFromPlainText('scurt'), 60).hasMore, false);
});

/**
 * Owner, 27 October 2026: on a page of words the right of the screen was „o coloană goală pe toată
 * înălțimea, deasupra butoanelor" — a margin the full height of the page, kept for a rail that stands
 * only at its foot. The engine now takes the rail's own rectangle as a room and lays lines around it.
 */
const RAIL_ROOM = { width: 58, height: 236, bottom: 4 };

/** The rail, in the page's own points: flush with the right edge, its foot above the page's foot. */
function railRoom(pageWidth, pageHeight, room = RAIL_ROOM) {
  return {
    x: pageWidth - room.width,
    y: pageHeight - room.bottom - room.height,
    width: room.width,
    height: room.height,
  };
}

const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;

function articleOf(paragraphs) {
  const sentence = 'Pagina se așază pe hârtie și cuvintele curg în jurul lucrurilor care stau pe ea. ';
  const blocks = [headingBlock('Titlul paginii', 'h1')];
  for (let index = 0; index < paragraphs; index++) {
    blocks.push(para(sentence.repeat(3).trim(), index + 1));
  }
  blocks.splice(3, 0, mediaBlock(0, { placement: 'right', widthFraction: 0.5, wrapText: true }, 'm1'));
  blocks.splice(9, 0, mediaBlock(1, { placement: 'center', widthFraction: 0.7, wrapText: false }, 'm2'));
  return { version: 1, typography: 'auto', blocks };
}

test('bara de acțiuni nu ia o coloană: cuvintele se îngustează doar rândurile care o ating', () => {
  const document = articleOf(10);
  const plain = flowEditorialDocument(document, options());
  const room = railRoom(360, 640);
  const flow = flowEditorialDocument(document, options({ reserve: [room] }));
  assert.equal(flow.overflow, false);
  // Not one word was lost or invented by keeping the room; the page simply carries fewer lines.
  assert.deepEqual(wordsFromFlow(flow), wordsFromFlow(plain));
  assert.ok(flow.pageCount >= plain.pageCount);

  let aboveTheButtons = 0;
  for (const page of flow.pages) {
    for (const line of page.lines) {
      assert.equal(intersects(line, room), false, `rândul „${line.text}” intră sub butoane`);
      if (!intersects(line, room) && line.y + line.lineHeight <= room.y && line.x + line.width > room.x) {
        aboveTheButtons += 1;
      }
    }
    // A photograph is pushed below the room, never drawn under a button.
    for (const box of page.media) assert.equal(intersects(box, room), false, `fotografia ${box.blockId} intră sub butoane`);
  }
  // The whole point: the paper above the rail is words again, at the full measure of the page.
  assert.ok(aboveTheButtons > 0, 'niciun rând nu folosește lățimea de deasupra butoanelor');
  const widest = Math.max(...flow.pages.flatMap((page) => page.lines).map((line) => line.x + line.width));
  const plainWidest = Math.max(...plain.pages.flatMap((page) => page.lines).map((line) => line.x + line.width));
  assert.ok(widest > plainWidest - 6, 'rândurile de deasupra butoanelor păstrează toată măsura paginii');
  assert.ok(widest > room.x, 'și intră în banda pe care o coloană ar fi lăsat-o goală');
  assertNoOverlap(flow);
});

test('camera barei se cere pe fiecare pagină, nu doar pe cea dintâi', () => {
  // A pagebreak puts a fresh page under a reserve that starts at the foot of every page: if the room were
  // seeded once, the second page would let its last lines run under the buttons.
  const document = { version: 1, blocks: [para('un rând scurt', 1), pageBreakBlock('br'), para('alt rând scurt', 2)] };
  const room = railRoom(360, 640, { width: 58, height: 520, bottom: 4 });
  const flow = flowEditorialDocument(document, options({ reserve: [room] }));
  assert.equal(flow.pageCount, 2);
  for (const page of flow.pages) {
    for (const line of page.lines) assert.equal(intersects(line, room), false, `pagina ${page.index} intră sub butoane`);
  }
  // A room that is not a rectangle at all is simply not there.
  const none = flowEditorialDocument(document, options({ reserve: [{ x: 300, y: 400, width: 0, height: 236 }] }));
  assert.equal(none.pageCount, flowEditorialDocument(document, options()).pageCount);
});
