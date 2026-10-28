/* global __dirname */
// Runda 8, punctul 2 — rescris în rundele 9 și 10 (20 octombrie 2026), când ownerul a scos piciorul paginii.
//
//   pagina     fiecare pagină a feedului este postarea însăși; ce fel de pagină este o hotărăște *media*,
//              nu tipul de conținut (`hasVisualMedia`), iar feedul desenează `ReelPage` pentru o poză sau un
//              clip și `PostCard` pentru cuvinte;
//   coloana    amândouă urcă aceeași coloană de cinci apăsări (`PostRail` → `ReactionControl variant="rail"`),
//              la același picior (`RAIL_FOOT`), cu banda barei adăugată de fiecare pagină;
//   piciorul   bara orizontală a unei pagini de cuvinte (`PostActionRow variant="bar"`, tokenul
//              `socialTokens.post.actionBar`) a fost citită ca footer și scoasă: nu mai există nici
//              varianta, nici tokenul, nici marca din capătul ei. Un card de listă are doar rândul mic.
//
// Regulile de compoziție se verifică pe sursă; clasificarea media e pură (`lib/postPresentation.ts`), așa
// că `hasVisualMedia` se încarcă și se rulează aici, nu doar se citește.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/** Sursa fără proza ei: un comentariu care numește ce s-a scos nu este un control. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const source = read('src/lib/postPresentation.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, () => {
  throw new Error('postPresentation.ts nu are voie să importe nimic la rulare');
});
const { hasVisualMedia, isAuthoredArticle } = moduleShim.exports;

const feed = code(read('src/screens/FeedScreen.tsx'));
const page = code(read('src/components/ReelsReader.tsx'));
const card = code(read('src/components/PostCard.tsx'));
const canvas = code(read('src/components/PostCanvas.tsx'));
const reading = code(read('src/components/PostReading.tsx'));
const articleMedia = code(read('src/components/ArticleMedia.tsx'));
const row = code(read('src/components/PostActionRow.tsx'));
const rail = code(read('src/components/PostRail.tsx'));
const reaction = code(read('src/components/ReactionControl.tsx'));

const picture = { kind: 'image', hash: 'a'.repeat(64), ext: 'jpg', position: 0 };
const clip = { kind: 'video', hash: 'b'.repeat(64), ext: 'mp4', position: 0 };
const track = { kind: 'audio', hash: 'c'.repeat(64), ext: 'mp3', position: 0 };
const post = (id, media) => (media ? { id, caption: `post ${id}`, media } : { id, caption: `post ${id}` });
const authoredPhoto = {
  id: 10, caption: 'un articol cu fotografie', kind: 'image', text_style: { theme: 'paper' }, media: picture,
};

test('o poză sau un clip fac pagina imersivă; un sunet singur nu', () => {
  assert.equal(hasVisualMedia(post(1, picture)), true, 'a picture fills the page');
  assert.equal(hasVisualMedia(post(2, clip)), true, 'a clip fills the page');
  assert.equal(hasVisualMedia(post(3, track)), false, 'a soundtrack alone has nothing to cover the page');
  assert.equal(hasVisualMedia(post(4)), false, 'a post of words has no page to cover');
  assert.equal(hasVisualMedia(null), false, 'a missing post is read as words');
});

test('feedul alege pagina după media, nu după tipul de conținut', () => {
  assert.equal(isAuthoredArticle(authoredPhoto), true, 'text_style + poze = articol');
  assert.equal(isAuthoredArticle(post(11, picture)), false, 'o poza simpla nu este articol');
  assert.equal(hasVisualMedia(authoredPhoto), true, 'poza ramane vizibila in articol');
  assert.match(
    feed,
    /const immersive = hasVisualMedia\(item\) && !isAuthoredArticle\(item\);/,
    'un articol autorat nu este trimis la pagina imersiva',
  );
  assert.doesNotMatch(feed, /stageFor\(item\) === 'reel'/, 'the content type no longer decides which page is drawn');
  assert.match(feed, /\{immersive \? \(\s*<ReelPage/, 'a picture takes the page a clip takes');
  assert.match(feed, /<ReelPage[\s\S]{0,600}?height=\{pageHeight\}/, 'and it takes all of it');
  assert.match(feed, /<PostCard[\s\S]{0,600}?bottomInset=\{navReserve\}/, 'a page of words keeps its words above the bar');
});

test('fiecare pagină urcă aceeași coloană de gesturi, la același picior', () => {
  assert.match(rail, /export const RAIL_FOOT = 26;/, 'the rail foot is one token');
  assert.match(rail, /<ReactionControl variant="rail" summary=\{summary\}/, 'the column is the rail variant');
  assert.match(page, /<PostRail[\s\S]{0,900}?bottom=\{RAIL_FOOT \+ overlayBottom\}/, 'a reel ends its rail above the bar');
  assert.match(card, /<PostRail[\s\S]{0,500}?bottom=\{RAIL_FOOT \+ bottomInset\}/, 'a page of words ends it in the very same place');
  assert.match(page, /import \{ PostRail, PostDistributePanel, RAIL_FOOT \} from '\.\/PostRail';/);
  assert.match(card, /import \{ PostRail, PostDistributePanel, RAIL_FOOT \} from '\.\/PostRail';/);
});

test('bara de picior a unei pagini de text a fost scoasă din produs', () => {
  assert.match(row, /export function PostActionRow\(\{/, 'the card row still exists');
  assert.doesNotMatch(row, /'bar'|actionBar/, 'the bar variant is gone from the row');
  assert.match(row, /<ReactionControl key="reaction" variant="row"/, 'a card asks for the compact measure, and that is all');
  assert.doesNotMatch(row, /BrandLogo/, 'the mark left the row with the bar');
  assert.doesNotMatch(read('src/theme/social.ts'), /actionBar/, 'the bar token is gone too');
  assert.doesNotMatch(reaction, /'bar'/, 'no reaction surface is measured as a bar');
  assert.match(reaction, /variant\?: 'card' \| 'rail' \| 'whisper' \| 'row';/, 'four measures remain, and no bar among them');
  assert.match(card, /bottomActions=\{height \? undefined : \(/, 'a full page passes no row: only a 9:16 card keeps one');
});

test('un articol cu fotografii limiteaza blocul media si il deschide separat', () => {
  // Fotografia sta in prima pagina, cu tot cadrul (`contain`), nu ca fundal decupat.
  assert.match(articleMedia, /fit="contain"/, 'fotografia articolului pastreaza tot cadrul');
  assert.doesNotMatch(articleMedia, /fit="cover"/, 'fotografia nu este decupata ca un cover');
  assert.match(articleMedia, /<Modal/, 'atingerea deschide vizualizatorul, nu o a doua randare a postarii');
  assert.match(articleMedia, /accessibilityLabel=\{`Deschide fotografia \$\{index \+ 1\} din \$\{photos\.length\}`\}/, 'fotografia se anunta ca o usa');
  assert.match(articleMedia, /onRequestClose=\{closeViewer\}/, 'vizualizatorul se poate inchide cu butonul sistemului');

  // Cititorul rezerva o felie masurata si imparte textul cu capacitatea primei pagini.
  assert.match(reading, /Math\.min\(box\.height \* 0\.34, box\.width \* 0\.92, 420\)/, 'blocul media are un plafon masurat');
  assert.match(reading, /mediaLeadHeight\(baseLeadHeight, box\.width, box\.height, mediaFrame\)/, 'cadrul autorului intra in aceeasi masura');
  assert.match(reading, /textPagesWithLead\(text, firstCapacity, capacity, MAX_TEXT_PAGES\)/, 'prima pagina are capacitatea ei');
  assert.match(reading, /\{index === 0 && hasLead \? \(/, 'fotografia apare doar pe prima pagina');

  // Canvasul nu mai deseneaza cover-ul full-bleed atunci cand pagina este articol.
  assert.match(canvas, /stage !== 'article' && items\.length <= 1 && cover && !isVideo/, 'articolul nu primeste cover full-bleed');
  assert.match(canvas, /lead=\{stage === 'article' \? \(baseHeight\) => \(/, 'canvasul preda fotografia cititorului');
  assert.match(canvas, /frame=\{pageStyle\?\.media\}/, 'canvasul preda cadrul ales de autor');
  assert.match(canvas, /baseHeight=\{baseHeight\}/, 'canvasul preda plafonul masurat, nu marimea finala');
  assert.match(canvas, /!hasMedia \|\| stage === 'article'/, 'tema autorului ramane fundalul articolului');
});
test('cele șase apăsări ale cititorului poartă argintiul și grafitul, pe două terenuri', () => {
  /**
   * Ownerul, 28 octombrie 2026: „Butoanele astea — Editează profilul, Urmărește, like, comentariu, repost,
   * share — să fie un argintiu discret cu grafit, nu alb pe crem". Materialul e un singur token, cu două
   * terenuri, iar un teren are toate cele opt fețe: așa o placă nu poate împrumuta niciodată cerneala
   * celuilalt teren.
   */
  const social = read('src/theme/social.ts');
  const relation = code(read('src/components/RelationButton.tsx'));
  const material = social.slice(social.indexOf('controls: {'));
  const paper = material.slice(material.indexOf('paper: {'), material.indexOf('night: {'));
  const night = material.slice(material.indexOf('night: {'));
  assert.match(material, /radius: 18,/, 'one squircle radius serves both grounds');
  assert.match(social, /export type ControlTone = 'night' \| 'paper';/, 'a page is either paper or night, never a third thing');
  for (const [ground, block] of [['paper', paper], ['night', night]]) {
    for (const key of ['plate', 'edge', 'edgeStrong', 'ink', 'count', 'plateOn', 'edgeOn', 'inkOn']) {
      /** Round 31: a value is either a literal or a member of the one palette (`blackSilver.*`). */
      assert.match(block, new RegExp(`${key}: ('[^']+'|blackSilver\\.\\w+)`), `${ground} carries its own ${key}`);
    }
  }

  // Coloana citește materialul, iar pagina îi spune pe ce teren stă: cuvintele sunt crem, poza e noapte.
  assert.match(rail, /const controls = socialTokens\.post\.controls\[tone\];/, 'the rail takes every colour from the ground it is told');
  /**
   * Toate cele **patru** apăsări ale coloanei sunt fără placă (owner, 28 octombrie 2026 pentru reacție —
   * „fără fundal în spatele emoji-urilor" — și 29 octombrie 2026 pentru restul: „toate cele patru butoane
   * fără fundal"). Un glif nu are nevoie de o cutie, iar fundalul ascundea hârtia sau fotografia.
   */
  assert.doesNotMatch(rail, /groundPaper|groundNight|groundPaperOn|groundNightOn|railPlate/,
    'nicio placă în spatele comentariului, salvării și distribuirii: nici fundal, nici muchie, nici umbră');
  assert.doesNotMatch(rail, /inkOn/, 'fără placă nu există cerneală întoarsă: albul de pe crem ar dispărea');
  assert.match(rail, /cell: \{\s*width: RAIL_CELL, minWidth: RAIL_CELL, height: RAIL_CELL, minHeight: RAIL_CELL,/,
    'ținta fiecărei apăsări rămâne celula de 56×56, doar fundalul a fost scos');
  assert.equal((rail.match(/style=\{styles\.cell\}/g) ?? []).length, 3,
    'trei apăsări împart aceeași celulă goală: comentariu, salvare, distribuire');
  /**
   * Starea unei apăsări luate nu mai poate fi o placă întoarsă: este un punct de patru puncte în rândul de
   * sub glifă (`stateDot`), în cerneala terenului — citește pe crem și pe fotografie deopotrivă.
   */
  assert.match(rail, /stateDot: \{ width: 4, height: 4, borderRadius: 2 \}/, 'starea este o marcă, nu un fundal');
  assert.match(rail, /metricRow: \{ height: 14,/, 'rândul stării are înălțimea lui, deci glifa nu se mută');
  assert.match(rail, /\{saved[\s\S]{0,120}styles\.stateDot/, 'salvarea luată își pune punctul');
  assert.match(rail, /\{reposted \? <View style=\{\[styles\.stateDot, stateInk\]\} \/> : null\}/,
    'redistribuirea luată își pune același punct, lângă cifră');
  assert.match(reaction, /railButton: \{ width: 56, minWidth: 56, height: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1 \}/,
    'ținta reacției rămâne neatinsă: emoji-ul se atinge la fel de ușor');
  assert.match(reaction, /\{!mine && heart === 'mark'[\s\S]{0,160}kind="heartLine"[\s\S]{0,80}color=\{markInk\}/,
    'inima goală este un semn desenat, în aceeași cerneală ca celelalte trei apăsări');
  assert.match(reaction, /const markInk = socialTokens\.post\.controls\[tone\]\.mark;/,
    'cerneala inimii vine din teren, nu dintr-o a cincea nuanță');
  assert.match(read('src/components/ReelsReader.tsx'), /heart="emoji"/,
    'Reels păstrează emoji-ul alb pe care ownerul a cerut să nu-l atingem');
  assert.match(reaction, /const railInk = tone === 'paper' \? styles\.railPaperInk : styles\.railNightInk;/,
    'cifra de sub glifă citește cerneala terenului, în amândouă stările');
  assert.doesNotMatch(reaction, /railPaperInkOn|railNightInkOn|controls\.paper\.inkOn|controls\.night\.inkOn/,
    'o reacție luată nu mai tipărește o cifră albă pe hârtie: starea este glifa');
  assert.match(card, /const stage = stageFor\(post\);/, 'the page asks the same classifier the canvas asks');
  assert.match(card, /stage === 'text' \|\| stage === 'article' \? 'paper' : 'night'/, 'a page of words is cream, everything else is night');
  assert.match(card, /<PostRail[\s\S]{0,600}?tone=\{tone\}/, 'the rail is told by the page it stands on');
  assert.match(card, /<PostDistributePanel[\s\S]{0,600}?tone=\{tone\}/, 'the share menu is part of the same press');
  assert.match(card, /<RelationButton[\s\S]{0,400}?tone=\{tone\}/, 'the Follow beside the author is told too');

  // Nicio a doua culoare în coloană: starea e glifa (reacția) sau punctul ei (salvarea, redistribuirea).
  assert.doesNotMatch(rail, /#ff315f|#ffffff/i, 'the column keeps no raspberry and no white glyph');
  assert.doesNotMatch(reaction, /#ff315f|#ffffff/i, 'nor does the like press');

  // Ușa principală (Urmărește, Editează profilul) este un cip de argint plin pe amândouă terenurile (r. 31).
  assert.match(relation, /accentPaper: \{ backgroundColor: socialTokens\.post\.controls\.paper\.plateSolid, borderColor: socialTokens\.post\.controls\.paper\.edgeStrong \}/, 'the leading door on paper is the silver chip');
  assert.match(relation, /accentNight: \{ backgroundColor: socialTokens\.post\.controls\.night\.plateOn/, 'on a dark field the leading door is the solid silver chip');
  assert.match(relation, /const door = accent[\s\S]{0,200}?styles\.secondaryNight\)/, 'both grounds answer, and the second door is the quiet hairline');
});


