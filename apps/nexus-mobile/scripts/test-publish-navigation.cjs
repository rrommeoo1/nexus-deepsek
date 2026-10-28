/* global __dirname */
// Publicarea unei pagini de TEXT se termină pe pagina scrisă, nu în vizorul camerei.
//
// Compozitorul este deschis de butonul „TEXT" al camerei (`camera.tsx` face `router.push('/text')`), deci
// `router.back()` după publicare întorcea autorul în cameră — exact ce a raportat ownerul. Reparația nu este o
// redirecționare „undeva în feed": se închide stiva (compozitorul *și* camera de sub el) și se deschide
// `post/:id` cu id-ul pe care serverul l-a confirmat.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const publish = (() => {
  const source = code(read('src/app/text.tsx'));
  const start = source.indexOf('async function publish()');
  assert.ok(start > 0, 'funcția de publicare există');
  return source.slice(start, source.indexOf('const accountNote', start));
})();

test('după publicare, compozitorul deschide postarea creată, cu id-ul confirmat de server', () => {
  assert.match(publish, /const result = await publishPost\(\{/, 'id-ul vine din răspunsul serverului');
  assert.match(publish, /setPublishedId\(result\.id\);/, 'id-ul confirmat este singurul folosit mai departe');
  assert.match(publish, /router\.push\(\{ pathname: '\/post\/\[id\]', params: \{ id: String\(result\.id\) \} \}\)/,
    'navigarea cere exact postarea creată');
  assert.match(publish, /if \(router\.canDismiss\(\)\) router\.dismissAll\(\);/, 'stiva este închisă înainte de a deschide postarea');
  // Ordinea contează: `push` fără `dismissAll` ar lăsa camera sub postare, iar Înapoi ar intra în vizor.
  assert.ok(publish.indexOf('router.dismissAll()') < publish.indexOf("pathname: '/post/[id]'"),
    'camera este scoasă din stivă înainte ca postarea să fie deschisă');
  // Nicio urmă de cameră în compozitor.
  assert.doesNotMatch(publish, /\/camera/, 'publicarea nu mai atinge camera');
  assert.doesNotMatch(publish, /router\.back\(\)/, 'publicarea nu se mai întoarce pe ecranul din spate');
});

test('o publicare nu poate fi trimisă de două ori, iar o eroare nu duce nicăieri', () => {
  assert.match(publish, /if \(busy \|\| publishedId !== null\) return;/, 'al doilea deget nu mai publică încă o dată');
  const catchAt = publish.indexOf('} catch (reason) {');
  assert.ok(catchAt > 0, 'publicarea are un drum de eșec');
  const failure = publish.slice(catchAt);
  assert.match(failure, /setError\(/, 'eșecul se spune pe ecran');
  assert.doesNotMatch(failure, /router\./, 'eșecul nu navighează: o postare care nu există nu se deschide');
  // Ciorna dispare doar după ce serverul a confirmat, niciodată înainte.
  const discardAt = publish.indexOf('discardTextDraft()');
  assert.ok(discardAt > publish.indexOf('await publishPost('), 'ciorna se șterge după confirmare, nu înainte');
  assert.ok(publish.indexOf('setPublishedId(result.id)') > discardAt, 'starea de publicat urmează confirmării');
});

test('ruta post/:id citește chiar postarea cerută, nu prima din feed', () => {
  const route = code(read('src/app/post/[id].tsx'));
  assert.match(route, /const id = Number\(pick\(params\.id\)\);/, 'id-ul din adresă este folosit ca atare');
  assert.match(route, /nexusApi<\{ ok: true; post: SocialPost \}>\(`\/api\/posts\/\$\{id\}`\)/,
    'postarea este citită de la server după id');
  assert.match(route, /<PostCard/, 'o pagină de cuvinte se citește cu pagina ei, nu cu un ecran gol');
  assert.ok(existsSync(resolve(ROOT, 'src/app/post/[id].tsx')), 'ruta există în arbore');
});

test('camera rămâne camera: TEXT se deschide din vizor, iar fluxurile photo/video nu se schimbă', () => {
  const camera = code(read('src/app/camera.tsx'));
  assert.match(camera, /router\.push\('\/text'\)/, 'butonul TEXT deschide compozitorul, ca înainte');
  // Compozitorul nu are voie să închidă camera ca efect secundar al publicării: doar stiva lui o face.
  const composer = code(read('src/app/text.tsx'));
  assert.doesNotMatch(composer, /from '\.\.\/app\/camera'|camera\.tsx/, 'compozitorul nu atinge camera');
});
