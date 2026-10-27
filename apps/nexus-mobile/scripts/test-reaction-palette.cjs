/* global __dirname */
// Al patrulea val (19 octombrie 2026), pe poza si pe cuvintele ownerului: panoul de reactii era o grila
// de opt glife, fiecare cu numele lui dedesubt, deschisa dintr-un tap, iar inimile (`\u2665` si `\u{1F497}`)
// se vedeau sterse. Ownerul cere un panou mai finut, ca bara din poza: se deschide cat timp tii apasat,
// emoji-ul de sub deget se mareste usor cand glisezi, iar la ridicare alegi.
//
// Al cincilea val, tot pe 19 octombrie, aduce trei corecturi ale ownerului si fiecare are testul ei:
//
//   anulare    "daca ridic degetul de pe reactie, vreau ca aceasta sa fie anulata ... sa nu fortez
//              utilizatorul sa selecteze o icoana": un deget departe de pastila nu mai poarta capatul
//              ei, ci nici o alegere, iar ridicarea de acolo inchide panoul fara reactie;
//   orizontal  "coloana de emoticoane trebuie sa se deschida orizontal, nu vertical": panoul este un
//              singur rand in ambele zone, iar la clipuri creste spre stanga, primul emoji sub deget;
//   fara negru "coloana de like nu trebuie sa aiba fundal negru ... deasupra lui e un avatar care nu e
//              nevoie": platca reactiei isi pierde discul intunecat, iar randul de actiuni isi pierde
//              emblema de avatar (autorul este deja pe pagina, cu mana si cu numele lui).
//
// Al saselea val, a doua zi: "dupa ce apasa odata apare like, dar daca vreau sa anulez mai apas odata,
// si trebuie sa ramana inima alba, nu rosie" si "ai scos fundalul dar a ramas un cerculet verde,
// scoate-l". Platca goala nu mai poarta inima rosie a lui LOVE (aceeasi glifa pe care o lasa un like
// pus), ci inima alba `REACTION_EMPTY_HEART`, iar inelul teal din jurul ei a plecat cu totul: emoji-ul
// este singura stare a platcii.
//
// Tot al cincilea val, a doua zi de corecturi: "paleta de reactii trebuie sa fie putin mai sus ... cand
// glisez cu degetul spre stanga, nu vad reactiile de deget". Randul de langa rail pluteste acum deasupra
// platcii, la 16dp de ea (o palma peste emoji-ul crescut), iar platca masurata intra in
// `pickerIndexAt` ca o casa a gestului — altfel ridicarea randului ar fi facut fiecare glisare o anulare.
//
// Ce se verifica aici:
//
//   masura     `lib/reactionPicker.ts`: un deget devine un index. Bara de sub o pagina de cuvinte se
//              citeste de la stanga, randul de langa un clip de la dreapta (acolo sta degetul care l-a
//              deschis), capetele sunt prinse inauntru, iar in afara pastilei nu exista index;
//   glifele    setul panoului este cel din poza (inima rosie, degetul in sus), nu glifele pale ale webului;
//   gestul     un tap scurt ramane like-ul de dinainte, o tinere de `PICKER_HOLD_MS` deschide panoul,
//              glisarea scrie indexul, ridicarea alege sau anuleaza, un scroll care ia gestul il inchide;
//   panoul     un singur rand fara nume sub emoji, cu emoji-ul de sub deget crescut si ridicat;
//   randul     platca reactiei nu are fundal negru, iar coloana clipului nu mai are avatar deasupra.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/** Sursa fara proza ei: un comentariu care numeste ce s-a scos nu este un control. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** Un modul TS fara importuri la rulare, compilat si rulat ca restul scripturilor aplicatiei. */
function load(relative, stubs = {}) {
  const compiled = ts.transpileModule(read(relative), {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`${relative} cere ${id} la rulare`);
  });
  return shim.exports;
}

const picker = load('src/lib/reactionPicker.ts');
const { PICKER_CELL, PICKER_EDGE, PICKER_HOLD_MS, PICKER_SLACK, pickerIndexAt, pickerPositionAt } = picker;
/**
 * `socialTypes.ts` is the app's own dictionary of the server's shapes; it reaches the API only inside
 * functions this test never calls, so it is loaded with those three modules stubbed to their empty
 * shape — the two glyph tables are plain data.
 */
const { REACTION_EMPTY_HEART, REACTION_PICKER_GLYPHS, SOCIAL_REACTIONS, REACTION_GLYPHS } = load('src/lib/socialTypes.ts', {
  './apiOrigin': { API_ORIGIN: '' },
  './nexusApi': { mediaUrl: () => '' },
  './session': { mediaHeaders: () => ({}) },
});

const control = code(read('src/components/ReactionControl.tsx'));
const palette = code(read('src/components/ReactionPalette.tsx'));

/** Bara de sub o pagina de cuvinte, asa cum o masoara telefonul: opt celule de 46 si margini de 6. */
const BAR = { x: 36, y: 2400, width: 8 * PICKER_CELL + 2 * PICKER_EDGE, height: PICKER_CELL + 2 * PICKER_EDGE };
/** Randul de langa clip: aceeasi pastila, asezata la dreapta ecranului, sub degetul care a deschis-o. */
const CLIP = { x: 60, y: 1500, width: 8 * PICKER_CELL + 2 * PICKER_EDGE, height: PICKER_CELL + 2 * PICKER_EDGE };


test('degetul devine un index: bara orizontala se citeste de la stanga', () => {
  const count = SOCIAL_REACTIONS.length;
  assert.equal(count, 8, 'serverul are opt reactii si toate trebuie alese');
  const y = BAR.y + 20;
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + PICKER_EDGE + 1, y }, 'left', count), 0, 'primul emoji, sub margine');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + PICKER_EDGE + PICKER_CELL - 1, y }, 'left', count), 0, 'ultimul pixel al primei celule');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + PICKER_EDGE + PICKER_CELL, y }, 'left', count), 1, 'granita muta pe al doilea');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + PICKER_EDGE + PICKER_CELL * 2.5, y }, 'left', count), 2, 'mijlocul celei de-a treia');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + PICKER_EDGE + PICKER_CELL * 7 + 1, y }, 'left', count), 7, 'ultimul emoji');
});

test('randul de la clipuri creste spre stanga: primul emoji este sub degetul din dreapta', () => {
  const count = SOCIAL_REACTIONS.length;
  const y = CLIP.y + 20;
  const right = CLIP.x + CLIP.width - PICKER_EDGE;
  assert.equal(pickerIndexAt(CLIP, { x: right - 1, y }, 'right', count), 0, 'primul emoji, in dreapta randului');
  assert.equal(pickerIndexAt(CLIP, { x: right - PICKER_CELL, y }, 'right', count), 1, 'un pas in stanga');
  assert.equal(pickerIndexAt(CLIP, { x: right - PICKER_CELL * 3.2, y }, 'right', count), 3, 'al patrulea');
  assert.equal(pickerIndexAt(CLIP, { x: CLIP.x + PICKER_EDGE + 1, y }, 'right', count), 7, 'capatul din stanga este ultima reactie');
  // Degetul care a deschis panoul sta pe platca, cateva zeci de dp la dreapta primei celule: tot primul.
  assert.equal(pickerIndexAt(CLIP, { x: right + 30, y }, 'right', count), 0, 'degetul de pe platca ramane pe primul emoji');
  assert.equal(pickerIndexAt(CLIP, { x: right + 30, y: CLIP.y + CLIP.height + 30 }, 'right', count), 0,
    'si platca este sub rand, tot in palma pastilei');
});

test('un deget departe de pastila nu alege nimic: ownerul nu forteaza o icoana', () => {
  const count = SOCIAL_REACTIONS.length;
  const y = CLIP.y + 20;
  // In afara pastilei, dar in palma ei (o celula): inca arata un emoji, capatul la care a ajuns.
  assert.equal(pickerIndexAt(CLIP, { x: CLIP.x + CLIP.width / 2, y: CLIP.y - PICKER_SLACK + 2 }, 'right', count), 4,
    'in slack-ul de deasupra, degetul arata tot un emoji');
  assert.equal(pickerIndexAt(CLIP, { x: CLIP.x - PICKER_SLACK + 2, y }, 'right', count), 7, 'in slack-ul din stanga, ultimul');
  // Dincolo de palma ei: nici o alegere, ca ridicarea sa poata anula.
  assert.equal(pickerIndexAt(CLIP, { x: CLIP.x + CLIP.width / 2, y: CLIP.y - PICKER_SLACK - 1 }, 'right', count), -1,
    'deasupra pastilei, in afara palmei: nimic');
  assert.equal(pickerIndexAt(CLIP, { x: CLIP.x + CLIP.width / 2, y: CLIP.y + CLIP.height + PICKER_SLACK + 1 }, 'right', count), -1,
    'sub pastila: nimic');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + 2, y: BAR.y - PICKER_SLACK - 40 }, 'left', count), -1,
    'la bara de jos, un deget urcat pe pagina nu alege');
  assert.equal(pickerIndexAt(BAR, { x: BAR.x + 2, y: BAR.y + BAR.height + PICKER_SLACK - 1 }, 'left', count), 0,
    'dar unul care doar s-a scurs putin sub bara inca arata primul emoji');
  assert.equal(PICKER_SLACK, PICKER_CELL, 'palma este o celula: platca sta la un deget de primul emoji');
});

test('un panou nemasurat nu muta nimic, iar o lista goala nu are index', () => {
  const empty = { x: 0, y: 0, width: 0, height: 0 };
  assert.equal(pickerIndexAt(empty, { x: 10, y: 10 }, 'left', 8), -1, 'fara masura nu indruma degetul');
  assert.equal(pickerIndexAt(BAR, { x: 100, y: 2400 }, 'left', 0), -1, 'fara reactii nu exista alegere');
  assert.equal(PICKER_CELL, 46, 'o celula este 46dp');
  assert.equal(PICKER_EDGE, 6, 'o margine de 6dp');
  assert.equal(PICKER_HOLD_MS, 240, 'tinerea este de 240ms: un tap ramane tap');
});

test('panoul are glifele din poza, nu inimile sterse ale webului', () => {
  for (const kind of SOCIAL_REACTIONS) {
    assert.ok(REACTION_PICKER_GLYPHS[kind], `${kind} nu are emoji in panou`);
  }
  assert.equal(REACTION_PICKER_GLYPHS.LOVE, '\u2764\uFE0F', 'inima rosie, cea din poza');
  assert.equal(REACTION_PICKER_GLYPHS.LIKE, '\u{1F44D}', 'degetul in sus, ca like-ul din poza');
  assert.equal(REACTION_PICKER_GLYPHS.HAHA, '\u{1F602}', 'rasul');
  assert.equal(REACTION_PICKER_GLYPHS.WOW, '\u{1F62E}', 'miratul');
  assert.equal(REACTION_PICKER_GLYPHS.SAD, '\u{1F622}', 'tristul');
  assert.equal(REACTION_PICKER_GLYPHS.ANGRY, '\u{1F621}', 'furiosul');
  // Glifele pe care ownerul le-a vazut sterse nu mai au voie in panou; rezumatul ramane al webului.
  for (const kind of SOCIAL_REACTIONS) {
    assert.notEqual(REACTION_PICKER_GLYPHS[kind], '\u2665', `${kind} nu mai este inima subtire`);
    assert.notEqual(REACTION_PICKER_GLYPHS[kind], '\u{1F497}', `${kind} nu mai este inima pala`);
  }
  assert.equal(REACTION_GLYPHS.LOVE, '\u{1F497}', 'rezumatul pastreaza setul webului, neatins');
  assert.equal(REACTION_GLYPHS.LIKE, '\u2665', 'rezumatul pastreaza setul webului, neatins');
});

test('un tap este like, o tinere deschide panoul, glisarea alege', () => {
  assert.match(control, /onStartShouldSetResponderCapture: \(\) => true/,
    'o singura mana: panoul si platca lui sunt acelasi responder');
  assert.match(control, /onResponderTerminationRequest: \(\) => !open/,
    'cat timp panoul este inchis, un scroll poate lua gestul');
  assert.match(control, /}, PICKER_HOLD_MS\);/, 'panoul se deschide dupa pragul de tinere');
  assert.match(control, /onResponderMove: \(event: GestureResponderEvent\) => \{/, 'glisarea este ascultata');
  assert.match(control, /const anchor: PickerAnchor = rail \? 'right' : 'left';/,
    'randul clipului creste spre stanga, randul unui card spre dreapta');
  assert.doesNotMatch(control, /barPalette/, 'panoul barei a plecat cu bara paginii');
  assert.match(control, /row && styles\.rowPalette/,
    'bara nu mosteneste `left: 0` de la rand: altfel pastila s-ar intinde intre margini');
  assert.match(control, /motion\.setValue\(at\);\s*aim\(pickerIndexAt\(box\.current, point, anchor, SOCIAL_REACTIONS\.length, plateBox\.current\)\);/,
    'degetul scrie si fractia care hraneste lupa, si celula care este aleasa — cu aceeasi regula la ambele zone');
  assert.match(control, /if \(Math\.abs\(pageX - press\.current\.x\) > 10 \|\| Math\.abs\(pageY - press\.current\.y\) > 10\) stopTimer\(\);/,
    'un deget care pleaca inainte de prag este scroll, nu alegere');
  assert.match(control, /const at = pickerPositionAt\(\s*box\.current, point, anchor, SOCIAL_REACTIONS\.length, plateBox\.current,\s*\);/,
    'panoul se deschide pe emoji-ul de sub deget, nu pe unul ales dinainte');
  assert.match(control, /motion\.setValue\(0\);/, 'randul se deschide cu primul emoji crescut, nu cu un rand in repaus');
  assert.match(control, /hoverRef\.current = 0;[\s\S]{0,80}setHover\(0\);/, 'primul emoji este cel de sub deget, in ambele zone');
  assert.match(control, /onReact\('LIKE', mine !== 'LIKE'\);/, 'tapul scurt ramane like-ul de dinainte');
  assert.match(control, /if \(press\.current\.opened\) setOpen\(false\);/, 'un scroll care ia gestul inchide panoul neales');
  assert.match(control, /collapsable=\{false\}/, 'panoul se poate masura in fereastra');
  assert.match(control, /onLayout=\{measure\}/, 'masura se ia cand panoul se aseaza');
  assert.match(control, /palette\.current\?\.measureInWindow/, 'degetul se citeste in aceleasi coordonate');
  assert.match(control, /<ReactionPalette anchor=\{anchor\}/, 'panoul primeste marginea pe care creste');
  assert.doesNotMatch(control, /optionTitle|optionGlyph|optionOn/, 'grila veche cu nume sub glife a plecat');
});

test('ridicarea in afara pastilei anuleaza: ownerul nu forteaza o icoana', () => {
  assert.match(control, /const kind = hoverRef\.current >= 0 \? SOCIAL_REACTIONS\[hoverRef\.current\] : null;/,
    'ridicarea citeste emoji-ul aratat — sau nimic');
  assert.match(control, /if \(!kind\) \{\s*setOpen\(false\);\s*return;\s*\}/,
    'in afara pastilei panoul se inchide fara reactie');
  assert.match(control, /const aim = \(index: number\) => \{\s*if \(index === hoverRef\.current\) return;/,
    '`-1` este o pozitie: degetul plecat goleste cresterea');
});

test('panoul este un rand fin, cu emoji-ul de sub deget crescut', () => {
  // Al saptelea val (27 octombrie 2026): ownerul a respins din nou lupa — „emoji-ul de sub deget nu se
  // mareste". Cresterea era calculata si interpolata, dar lista de transformari ajungea la React Native
  // ca un element al listei de stiluri, iar `StyleSheet.flatten` o desfacea in trei proprietati
  // (`scaleX`, `scaleY`, `translateY`) pe care nici o vedere nu le citeste — deci nimic nu se desena.
  // Lupa este acum o cutie a ei (`Animated.View` + `{ transform }`), si creste ca o lupa.
  assert.ok(picker.PICKER_GROW >= 1.6 && picker.PICKER_GROW <= 1.85,
    'doar emoji-ul de sub deget creste, si creste ca o lupa');
  assert.ok(picker.PICKER_LIFT < 0, 'si iese putin din linie, ca in poza');
  assert.match(palette, /outputRange: \[1, PICKER_GROW, 1\]/, 'cresterea este a emoji-ului de sub deget');
  assert.match(palette, /outputRange: \[0, PICKER_LIFT, 0\]/, 'ridicarea este a aceluiasi emoji');
  // Forma care a fost defectul: transformarea ca element al listei de stiluri, pe un `<Text>`.
  assert.match(palette, /\{ transform \}/, 'transformarea este o proprietate de stil, nu un stil intreg');
  assert.doesNotMatch(palette, /<Animated\.Text/, 'lupa nu se mai deseneaza pe un <Text>');
  assert.match(palette, /<Animated\.View pointerEvents="none" style=\{\[styles\.glyphBox, \{ transform \}\]\}>/,
    'lupa este o cutie proprie, cu transformarea ei');
  assert.match(palette, /glyphBox: \{ width: PICKER_CELL, height: PICKER_CELL, alignItems: 'center', justifyContent: 'center' \}/,
    'cutia are exact o celula, ca sa aiba un centru din care sa creasca');
  assert.match(palette, /bottom: PICKER_CELL \+ PICKER_CROWN/,
    'numele sta deasupra fetei crescute, nu peste ea');
  assert.ok(picker.PICKER_CROWN > 0, 'fata crescuta iese deasupra celulei ei');
  assert.match(palette, /const order = anchor === 'right' \? \[\.\.\.SOCIAL_REACTIONS\]\.reverse\(\) : \[\.\.\.SOCIAL_REACTIONS\];/,
    'randul se deseneaza de la marginea degetului, ca primul emoji sa fie sub el');
  assert.match(palette, /REACTION_PICKER_GLYPHS\[kind\]/, 'pastila isi ia emoji-urile din setul panoului');
  assert.match(palette, /accessibilityLabel=\{REACTION_TITLES\[kind\] \?\? kind\}/, 'fiecare emoji isi spune numele');
  assert.match(palette, /styles\.cellOn/, 'reactia deja aleasa are celula ei');
  assert.doesNotMatch(palette, /optionTitle/, 'nici un nume tiparit sub emoji');
  // Ownerul a cerut rand, nu coloana: forma verticala nu mai exista in panou.
  assert.doesNotMatch(palette, /pillVertical|chipRowVertical|vertical=/, 'panoul nu mai are o varianta verticala');
  assert.doesNotMatch(palette, /chipRowVertical/, 'nici chip-ul asezat in lateral');
  assert.match(palette, /borderColor: 'rgba\(36,240,210,0\.3\)'/, 'o singura margine, cea a webului');
});

test('pastila incape in palma: opt celule si doua margini', () => {
  const width = SOCIAL_REACTIONS.length * PICKER_CELL + 2 * PICKER_EDGE;
  assert.equal(width, 380, 'randul este lat de 380dp, sub cei 441dp ai unei pagini');
  assert.ok(width <= 441, 'randul nu iese din pagina');
  assert.equal(SOCIAL_REACTIONS.length * PICKER_CELL + 2 * PICKER_EDGE, CLIP.width, 'randul clipului are exact aceeasi masura');
});

test('ridicarea alege emoji-ul aratat sau, fara emoji, inchide panoul fara reactie', () => {
  // Al cincilea val: `-1` este un raspuns, nu o lipsa de raspuns — ridicarea de acolo nu alege nimic.
  assert.match(control, /const kind = hoverRef\.current >= 0 \? SOCIAL_REACTIONS\[hoverRef\.current\] : null;/,
    'ridicarea citeste ultimul emoji aratat, nu pozitia bruta a degetului');
  assert.match(control, /if \(!kind\) \{\s*setOpen\(false\);\s*return;\s*\}/,
    'fara emoji, panoul se inchide si nu se cheama `onReact`');
  assert.match(control, /if \(!kind\) \{\s*setOpen\(false\);\s*return;\s*\}\s*choose\(kind\);/, 'cu emoji, alegerea pleaca mai departe');
  assert.doesNotMatch(control, /choose\(SOCIAL_REACTIONS\[hoverRef\.current\] \?\? 'LIKE'\)/,
    'nu se mai forteaza like-ul cand degetul nu arata nimic');
  assert.equal(
    /Animated\.spring\(pos, \{ toValue: hover/.test(palette), false,
    'cresterea nu mai arcuieste dupa un indice intreg: urmeaza fractia degetului',
  );
  assert.match(palette, /motion\.interpolate\(/, 'fiecare fata este o interpolare a pozitiei degetului');
  assert.match(control, /const motion = useRef\(new Animated\.Value\(0\)\)\.current;/, 'o singura valoare animata pentru rand');
  assert.match(control, /motion\.setValue\(at\)/, 'fiecare miscare scrie fractia, fara re-randare');
});

test('randul ridicat deasupra platcii: degetul de pe platca ramane pe alegere', () => {
  const count = SOCIAL_REACTIONS.length;
  /**
   * Geometria de pe telefon, in dp: platca railului este 56x56, iar randul sta cu piciorul la 16dp
   * deasupra ei; marginea lui dreapta cade 8dp in stanga marginii stangii a platcii. Deci centrul
   * platcii este 44dp sub pastila, iar coltul ei de jos 72dp — dincolo de palma de o celula.
   */
  const plate = { x: CLIP.x + CLIP.width + 8, y: 1700, width: 56, height: 56 };
  const lifted = { x: CLIP.x, y: plate.y - 16 - CLIP.height, width: CLIP.width, height: CLIP.height };
  const right = lifted.x + lifted.width - PICKER_EDGE;
  // Degetul care tine platca (orice punct de pe ea) este tot primul emoji, desi pastila e deasupra lui.
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 28, y: plate.y + 28 }, 'right', count, plate), 0,
    'centrul platcii arata primul emoji');
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 28, y: plate.y + 55 }, 'right', count, plate), 0,
    'si coltul de jos al platcii, care fara casa ar fi iesit din palma pastilei');
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 50, y: plate.y + 28 }, 'right', count, plate), 0,
    'si marginea din dreapta a platcii, dincolo de palma pastilei');
  // Glisarea spre stanga, la inaltimea platcii: indexul urmeaza degetul, nu pastila.
  assert.equal(pickerIndexAt(lifted, { x: right - PICKER_CELL * 2, y: plate.y + 50 }, 'right', count, plate), 2,
    'la inaltimea platcii, al treilea emoji de la dreapta');
  // Ownerul cerea explicit sa vada reactia pe care o alege: degetul de pe platca nu mai sta pe rand.
  const gap = plate.y - (lifted.y + lifted.height);
  assert.ok(gap >= 10 && gap <= 20, `randul sta la ${gap}dp deasupra platcii: ridicat, nu departe`);
  assert.ok(plate.y + 28 - (lifted.y + lifted.height) >= 30,
    'centrul degetului de pe platca ramane la peste 30dp sub rand, deci nu acopera emoji-ul crescut');
  // Un deget iesit din platca si din palma pastilei nu mai arata nimic: ridicarea anuleaza.
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 28, y: plate.y + 57 }, 'right', count, plate), -1,
    'un deget sub platca nu mai tine de alegere');
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 60, y: plate.y + 28 }, 'right', count, plate), -1,
    'nici unul in dreapta platcii');
  // Fara casa, aceeasi degete ar citi `-1`: de asta platca este masurata si dusa la `pickerIndexAt`.
  assert.equal(pickerIndexAt(lifted, { x: plate.x + 28, y: plate.y + 55 }, 'right', count), -1,
    'fara casa, coltul platcii ar fi iesit din alegere');
  // Bara unei pagini foloseste aceeasi regula, cu marginea din stanga.
  const barPlate = { x: 100, y: 2300, width: 120, height: 60 };
  const bar = { x: 100, y: 2300 - 16 - CLIP.height, width: CLIP.width, height: CLIP.height };
  assert.equal(pickerIndexAt(bar, { x: barPlate.x + 2, y: barPlate.y + 58 }, 'left', count, barPlate), 0,
    'si la bara de jos, platca ramane primul emoji');
});



test('panoul deschis opreste pagerul; randul orizontal nu are nevoie', () => {
  const feed = code(read('src/screens/FeedScreen.tsx'));
  const page = code(read('src/components/ReelsReader.tsx'));
  assert.match(control, /onPanelChange\?: \(open: boolean\) => void/,
    'panoul spune sus cand se deschide, ca pagina sa stea pe loc');
  assert.match(control, /useEffect\(\(\) => \{\s*onPanelChange\?\.\(open\);\s*\}, \[open, onPanelChange\]\);/,
    'anuntul pleaca o singura data pe schimbare, nu la fiecare deget');
  assert.match(page, /onPanelChange=\{onPanelChange\}/, 'pagina clipului duce anuntul mai sus');
  assert.match(feed, /scrollEnabled=\{!paletteOpen\}/, 'pagerul nu mai ia glisarea randului');
  assert.match(feed, /onPanelChange=\{setPaletteOpen\}/, 'feedul asculta panoul paginii');
  // Shorthand-ul `scale` nu exista in allowlist-ul driverului nativ al RN 0.86: se folosesc cele doua axe.
  assert.doesNotMatch(palette, /\{ scale \}/, 'fara `scale`: driverul nativ il refuza');
  assert.match(palette, /\{ scaleX: grow \}, \{ scaleY: grow \}/, 'cresterea se scrie pe cele doua axe');
});

test('randul clipului: fara avatar deasupra like-ului si fara disc negru sub el', () => {
  const page = code(read('src/components/ReelsReader.tsx'));
  // Ownerul: "deasupra lui e un avatar care nu e nevoie; exista deja un avatar pe ecran".
  assert.doesNotMatch(page, /railAvatar|clipRailAvatar/, 'randul de actiuni nu mai deseneaza emblema de avatar');
  assert.doesNotMatch(page, /styles\.railAvatar/, 'nici stilurile ei');
  assert.doesNotMatch(page, /RemoteImageSource|initialsFor|mediaSourceForPath/,
    'nici poza si nici iniţialele care o inlocuiau');
  assert.match(page, /<PostRail/, 'randul paginii este coloana pe care o urca si un reel');
  assert.match(read('src/components/PostRail.tsx'), /<ReactionControl variant="rail"/, 'si care incepe cu platca reactiei');
  // Ownerul: "coloana de like nu trebuie sa aiba fundal negru cum e acum".
  assert.match(control, /railDisc: \{ width: 36, minWidth: 36, height: 39, alignItems: 'center', justifyContent: 'center' \},/,
    'discul este doar o celula de 36x39: fara fundal si fara inel');
  assert.doesNotMatch(control, /railDiscOn|rgba\(127,240,230/,
    'cerculetul verde din jurul reactiei a plecat ("ai scos fundalul dar a ramas un cerculet verde, scoate-l")');
  assert.doesNotMatch(control, /backgroundColor: 'rgba\(8,14,20,0\.55\)'/, 'discul intunecat al like-ului a plecat');
  assert.match(control, /railPalette: \{ position: 'absolute', right: 64, bottom: 56 \+ 30,/,
    'randul pluteste la 30dp deasupra platcii de 56dp, ca degetul si emoji-ul crescut sa nu se acopere');
});

test('al doilea tap retrage like-ul: platca se intoarce la inima alba, nu la cea rosie', () => {
  // Ownerul: "dupa ce apasa odata apare like, dar daca vreau sa anulez mai apas odata, si trebuie sa
  // ramana inima alba, nu rosie". Inima rosie de pe platca goala era chiar glifa lui LOVE, deci un
  // like retras semana cu unul inca pus.
  assert.equal(REACTION_EMPTY_HEART, '\u{1F90D}', 'platca fara reactie poarta inima alba');
  assert.notEqual(REACTION_EMPTY_HEART, REACTION_PICKER_GLYPHS.LOVE,
    'si nu inima rosie a lui LOVE, aceeasi glifa pe care o lasa un like');
  assert.match(control, /: REACTION_EMPTY_HEART;/, 'platca goala deseneaza inima alba');
  assert.match(control, /onReact\('LIKE', mine !== 'LIKE'\)/, 'al doilea tap pe platca cere retragerea');
  // Paginile nu primesc o valoare de la copil: o recitesc din sumar, ca retragerea sa mearga si cand
  // reactia vine din panou. Acelasi emoji ales a doua oara este `false`, si ajunge la server.
  for (const source of ['src/components/ReelsReader.tsx', 'src/components/PostCard.tsx']) {
    const page = code(read(source));
    assert.match(page, /const nextActive = mine !== kind;/, `${source}: acelasi emoji, a doua oara, retrage reactia`);
    assert.match(page, /setPostReaction\(post\.id, kind, nextActive/, `${source}: serverul primeste retragerea`);
  }
});


// Al saptelea val (27 octombrie 2026): ownerul a cerut ca emoji-ul de sub deget sa creasca *continuu*
// cat timp degetul se apropie, nu doar cand a ajuns in celula urmatoare. Fractia care face asta este
// `pickerPositionAt`, iar testul de aici o citeste ca pe o functie, nu ca pe o linie de cod: jumatate de
// celula muta cresterea cu jumatate, aceeasi fractie da aceeasi celula ca `pickerIndexAt`, iar o glisare
// de la un capat la altul este monotona si se termina pe ultimul emoji.
//
// Al optulea val (aceeasi zi): probe pe telefon au aratat ca varful cresterii cadea pe *granita* dintre
// doua celule — fractia se masura de la marginea pastilei, deci degetul asezat pe mijlocul unei fete
// citea `k + 0.5` si lupa se impartea egal intre doi vecini. De atunci `0` este mijlocul primei fete, iar
// celula aleasa este fractia *rotunjita*, nu taiata: degetul trecut de granita numeste deja fata
// urmatoare, exact cum o citeste ochiul.
test('lupa urmeaza degetul continuu, iar celula aleasa ramane cea de sub el', () => {
  const count = SOCIAL_REACTIONS.length;
  const box = { x: 100, y: 300, width: PICKER_EDGE * 2 + PICKER_CELL * count, height: PICKER_CELL + PICKER_EDGE * 2 };
  const y = box.y + box.height / 2;
  const first = box.x + PICKER_EDGE;
  const at = (x) => pickerPositionAt(box, { x, y }, 'left', count);

  assert.equal(at(first), 0, 'marginea pastilei este un perete: tot primul emoji');
  assert.equal(at(first + PICKER_CELL / 2), 0, 'mijlocul primei fete este 0, nu marginea ei');
  assert.equal(at(first + PICKER_CELL * 1.5), 1, 'mijlocul celei de-a doua fete este 1');
  assert.equal(at(first + PICKER_CELL * 7.5), 7, 'mijlocul ultimei fete este ultimul emoji');
  assert.equal(at(first + PICKER_CELL * 1.25), 0.75, 'intre doua fete, fractia spune cat de aproape este');
  assert.equal(pickerIndexAt(box, { x: first + PICKER_CELL * 1.25, y }, 'left', count), 1,
    'celula aleasa este cea in care se afla degetul');

  /** O glisare lenta de la mijlocul primei fete la mijlocul ultimei: 41 de citiri, strict crescatoare. */
  const samples = Array.from({ length: 41 }, (_, index) => at(
    first + PICKER_CELL / 2 + (PICKER_CELL * (count - 1) * index) / 40,
  ));
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index] > samples[index - 1], 'fiecare milimetru apropie emoji-ul urmator');
    assert.ok(samples[index] - samples[index - 1] < 0.25, 'si nici un salt: cresterea este continua');
  }
  assert.equal(samples[0], 0);
  assert.equal(samples[samples.length - 1], count - 1);

  /** In afara pastilei nu exista fractie: aceeasi regula ca `pickerIndexAt`, ca ridicarea sa anuleze. */
  assert.equal(pickerPositionAt(box, { x: box.x - PICKER_SLACK - 1, y }, 'left', count), -1);
  assert.equal(pickerPositionAt(box, { x: first, y: box.y + box.height + PICKER_SLACK + 1 }, 'left', count), -1);

  /** Randul din dreapta se citeste oglindit: primul emoji este sub degetul din dreapta pastilei. */
  const clip = { x: 600, y: 900, width: PICKER_EDGE * 2 + PICKER_CELL * count, height: PICKER_CELL + PICKER_EDGE * 2 };
  const right = clip.x + clip.width - PICKER_EDGE;
  const mid = clip.y + clip.height / 2;
  assert.equal(pickerIndexAt(clip, { x: right - 1, y: mid }, 'right', count), 0);
  assert.equal(pickerPositionAt(clip, { x: right, y: mid }, 'right', count), 0, 'si aici marginea este un perete');
  assert.equal(pickerPositionAt(clip, { x: right - PICKER_CELL / 2, y: mid }, 'right', count), 0,
    'mijlocul primei fete, citit de la capatul din dreapta');
  assert.equal(pickerPositionAt(clip, { x: right - PICKER_CELL * 3, y: mid }, 'right', count), 2.5,
    'trei celule spre stanga sunt doua fete si jumatate');
});
