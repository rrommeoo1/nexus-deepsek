/* global __dirname */
// Runda 8, punctul 2: feedul este un singur flux, iar fiecare pagină este postarea însăși, la mărimea
// ecranului. Trei lucruri au fost scoase și nu au voie să se întoarcă:
//
//   filtrele   Toate · Postări · Reel-uri (și barul care le ținea) — un singur feed, cu toate tipurile;
//   benzile    postul nu mai stă într-o cutie 9:16 centrată pe un câmp negru; media merge de sub ceas până
//              la semnul de gesturi, iar cuvintele se feresc de hardware prin insete;
//   mărimea    pagina nu mai depinde de bara de jos. Când bara pleca, `reservedBottom` scădea, fiecare card
//              se recalculă în timpul gestului — „conținutul se restrânge sau se extinde” din sesizare.
//
// Verificările sunt pe sursă: geometria paginii este o regulă de compoziție și se vede exact în codul care
// o calculează, fără un dispozitiv.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/**
 * The source without its prose. A comment that names what was removed is documentation, not a control, so
 * every rule about what the app draws is checked against the code alone.
 */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const feed = code(read('src/screens/FeedScreen.tsx'));
const shell = code(read('src/app/index.tsx'));
const layout = code(read('src/app/_layout.tsx'));
const card = read('src/components/PostCard.tsx');
const canvas = read('src/components/PostCanvas.tsx');
const reel = read('src/components/ReelsReader.tsx');
const nav = read('src/components/AppNav.tsx');

test('filtrele feedului au fost scoase din produs', () => {
  assert.equal(existsSync(resolve(ROOT, 'src/components/FeedFilter.tsx')), false, 'FeedFilter.tsx is deleted');
  assert.equal(existsSync(resolve(ROOT, 'src/components/FeedHeader.tsx')), false, 'FeedHeader.tsx is deleted');
  assert.doesNotMatch(feed, /FeedFilter|FeedFilterId|onFilterChange/, 'the feed takes no filter any more');
  assert.doesNotMatch(feed, /Toate|Postări|Reel-uri/, 'no reading is offered as a slice');
  assert.doesNotMatch(shell, /feedFilter|FeedHeader|FeedFilter/, 'the shell holds no filter state');
});

test('un singur feed: fiecare tip trece prin aceeași listă', () => {
  assert.doesNotMatch(feed, /<ReelsReader/, 'the Reels-only reader is gone with the slice');
  assert.doesNotMatch(feed, /filter === 'reels'/, 'no branch renders a second list');
  assert.match(feed, /const visible = posts;/, 'the list is the page the server sent, whole');
  assert.match(feed, /<PostCard/, 'a post is drawn');
  assert.match(feed, /<ReelPage/, 'a clip is drawn');
});

test('pagina este ecranul: aceeași înălțime pentru orice post', () => {
  assert.match(feed, /<View style=\{\[styles\.page, \{ height: pageHeight \}\]\}>/);
  assert.doesNotMatch(feed, /paddingBottom: reservedBottom/, 'the page keeps no band of its own');
  assert.match(feed, /<PostCard[\s\S]*?height=\{pageHeight\}/, 'a post takes the whole page');
  assert.match(feed, /<ReelPage[\s\S]*?height=\{pageHeight\}/, 'a clip takes the same page');
  assert.match(feed, /snapToInterval=\{pageHeight \|\| undefined\}/, 'one snap per viewport');
});

test('bara de jos nu mai schimbă mărimea paginii în timpul gestului', () => {
  assert.match(feed, /const navReserve = appNavHeight\(insets\.bottom\);/, 'the band is measured once');
  assert.doesNotMatch(feed, /reservedBottom/, 'the page never reads the chrome\'s visibility');
  assert.doesNotMatch(shell, /reservedBottom=|chromeHidden \? insets\.bottom/, 'the shell passes no changing band');
  assert.match(nav, /export function appNavHeight\(bottomInset: number\)/, 'the bar owns its own height');
});

test('postul umple ecranul, iar cuvintele se feresc de notch și de semnul de gesturi', () => {
  assert.match(card, /topInset=\{topInset\}/, 'the page hands the notch to the composition');
  assert.match(card, /bottomInset=\{bottomInset\}/, 'the page hands the tab-bar band to the composition');
  assert.match(canvas, /const headTop = \(page \? 0 : metrics\.padB\) \+ topInset;/, 'the author starts under the status clock');
  assert.match(
    canvas,
    /paddingBottom: \(bottomActions \? Math\.round\(metrics\.padB \* 0\.4\) : metrics\.padB\) \+ bottomInset/,
    'the actions end above the bar and the gesture sign',
  );
  assert.match(
    canvas,
    /paddingTop: headTop, paddingBottom: metrics\.padB \+ bottomInset/,
    'a text page keeps the same insets',
  );
});

test('un reel umple pagina la fel ca un post', () => {
  assert.match(reel, /<PostStage fill>/, 'the reel is the page, not a 9:16 box inside it');
  assert.doesNotMatch(reel, /<PostStage bottomInset=/, 'the stage no longer reserves the bar');
  assert.match(reel, /bottomInset=\{band\}/, 'the canvas keeps the words above the bar');
  assert.match(reel, /const band = Math\.max\(0, overlayBottom\) \+ Math\.max\(0, bottomInset\);/, 'bar plus device inset, one floor');
  assert.match(reel, /bottom=\{RAIL_FOOT \+ band\}/, 'the rail sits above the bar, at the reel foot the web uses');
  /**
   * Runda 48: decorațiunile urmează potrivirea pozei de sub ele, în orice prezentare. Previzualizarea de
   * deasupra foii de comentarii nu schimbă `fit` (runda 47 îl schimbase în `contain`, iar ownerul a refuzat:
   * arăta părți din fotografie pe care Feed/Profil le ascund).
   *
   * Runda 49: primesc și micșorarea cutiei (`scale`), ca stickerul să se micșoreze **cu** compoziția.
   */
  assert.match(reel, /<PostDecorations post=\{post\} fit="cover" scale=\{previewFrame\?\.scale \?\? 1\} \/>/,
    'decorations follow the covering picture, at the size of the box');
});

test('nu mai există banda neagră de sub ceas', () => {
  assert.doesNotMatch(layout, /statusBand|showStatusBand/, 'the band is gone from the native shell');
  assert.match(shell, /edges=\{onFeed \? \[\] : \['top'\]\}/, 'the feed draws under the status bar');
  assert.match(shell, /onFeed \? null/, 'the feed wears no bar above the page');
});

test('media acoperă pagina, nu lasă câmp în jurul ei', () => {
  /**
   * Runda 48: `cover` este regula paginii **în orice prezentare**, inclusiv în previzualizarea de deasupra
   * foii de comentarii. Runda 47 ceruse acolo `contain`, ca postarea să se vadă întreagă; ownerul a refuzat
   * exact asta (fotografia arăta părți pe care Feed/Profil le ascund), deci previzualizarea micșorează cutia
   * și nu atinge potrivirea (`lib/commentsPreview.ts`).
   */
  assert.match(canvas, /<RemoteImage item=\{cover\} fit="cover" style=\{styles\.media\} onError=\{onError\} \/>/,
    'poza acoperă pagina, în orice prezentare');
  assert.match(canvas, /fit="portrait-cover"\s+style=\{styles\.media\}/,
    'și un clip acoperă pagina, în orice prezentare');
  assert.doesNotMatch(canvas, /'contain'/, 'nicio potrivire de împrumut pentru previzualizare');
  assert.match(canvas, /media: \{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 \}/);
});
