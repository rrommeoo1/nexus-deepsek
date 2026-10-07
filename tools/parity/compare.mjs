// Comparația numerică web ↔ nativ, din text (nu din imagine).
//
//   web:    docs/web-ref/<ecran>/<stare>.dom.json   - geometrie în CSS px (dom-probe.mjs)
//   nativ:  docs/parity-report/<ecran>/native-<stare>.xml - `uiautomator dump --compressed`,
//           bounds în px fizici; se împart la DPR (implicit 2.6, tools/web-ref/device.json)
//
// Ieșirea este docs/parity-report/<ecran>/diff.md: pentru fiecare pereche de stări, fiecare element
// (etichetat după text/aria/content-desc) cu dreptunghiul web, dreptunghiul nativ, diferența pe fiecare
// axă și verdictul. Elementele fără pereche sunt listate separat, iar iconițele web care ajung text în
// nativ sunt marcate explicit ("iconiță vs text").
//
//   node tools/parity/compare.mjs <ecran> [--dpr=2.6]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const WEB = path.join(REPO, 'docs', 'web-ref');
const NATIVE = path.join(REPO, 'docs', 'parity-report');
const argv = process.argv.slice(2);
const area = argv.find((a) => !a.startsWith('--'));
const dpr = Number((argv.find((a) => a.startsWith('--dpr=')) || '--dpr=2.6').split('=')[1]) || 2.6;
/** Toleranța de geometrie din PARITY-MATRIX: ±2 CSS px (Yoga vs Chromium nu rotunjesc identic). */
const TOL = 2;
if (!area) {
  console.error('usage: node tools/parity/compare.mjs <ecran> [--dpr=2.6]');
  process.exit(2);
}

const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = (value) => norm(value).toLowerCase();

function readWebNodes(area_, state) {
  const file = path.join(WEB, area_, `${state}.dom.json`);
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return doc.nodes
    .map((node) => ({
      label: norm(node.text || node.aria || node.ph || node.alt),
      cls: norm(node.cls),
      rect: node.r,
      icon: Boolean(node.svg),
      text: norm(node.text),
    }))
    .filter((node) => node.label && node.rect[2] > 0 && node.rect[3] > 0);
}

function readNativeNodes(area_, state) {
  const file = path.join(NATIVE, area_, `native-${state}.xml`);
  if (!fs.existsSync(file)) return null;
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = [];
  for (const match of xml.matchAll(/<node\b[^>]*>/g)) {
    const tag = match[0];
    const attr = (name) => {
      const found = new RegExp(`${name}="([^"]*)"`).exec(tag);
      return found ? found[1] : '';
    };
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    if (!bounds) continue;
    const [x1, y1, x2, y2] = [1, 2, 3, 4].map((i) => Number(bounds[i]) / dpr);
    nodes.push({
      label: norm(attr('text') || attr('content-desc')),
      cls: norm(attr('class')),
      rect: [Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1)],
      icon: false,
      text: norm(attr('text')),
    });
  }
  return nodes;
}

function statesFor(area_) {
  const webDir = path.join(WEB, area_);
  const nativeDir = path.join(NATIVE, area_);
  if (!fs.existsSync(webDir)) return [];
  const web = fs.readdirSync(webDir).filter((f) => f.endsWith('.dom.json')).map((f) => f.replace('.dom.json', ''));
  if (!fs.existsSync(nativeDir)) return web.map((state) => ({ state, native: false }));
  const captured = new Set(fs.readdirSync(nativeDir)
    .filter((f) => /^native-.*\.xml$/.test(f))
    .map((f) => f.replace(/^native-/, '').replace(/\.xml$/, '')));
  return web.map((state) => ({ state, native: captured.has(state) }));
}

/** Potrivirea se face pe etichetă (text/aria), apoi pe cea mai apropiată poziție când sunt mai multe. */
function match(webNodes, nativeNodes) {
  const used = new Set();
  const rows = [];
  for (const web of webNodes) {
    const candidates = nativeNodes.filter((native) => !used.has(native) && key(native.label) === key(web.label));
    if (!candidates.length) { rows.push({ web, native: null }); continue; }
    const distance = (native) => Math.abs(native.rect[0] - web.rect[0]) + Math.abs(native.rect[1] - web.rect[1]);
    candidates.sort((a, b) => distance(a) - distance(b));
    used.add(candidates[0]);
    rows.push({ web, native: candidates[0] });
  }
  const extra = nativeNodes.filter((native) => !used.has(native) && native.label);
  return { rows, extra };
}
function verdict(web, native) {
  if (!native) return web.icon ? 'LIPSĂ (iconiță web)' : 'LIPSĂ';
  const dx = native.rect[0] - web.rect[0];
  const dy = native.rect[1] - web.rect[1];
  const dw = native.rect[2] - web.rect[2];
  const dh = native.rect[3] - web.rect[3];
  const worst = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dw), Math.abs(dh));
  const flag = worst <= TOL ? 'OK' : 'DIFERIT';
  const icon = web.icon && !native.icon && native.text ? ' · iconiță vs text' : '';
  return `${flag}${icon} (dx=${dx} dy=${dy} dw=${dw} dh=${dh})`;
}

const out = [];
out.push(`# Comparație numerică — ${area}`, '');
out.push(`DPR ${dpr} · toleranță ${TOL} CSS px · surse: docs/web-ref/${area}/*.dom.json și docs/parity-report/${area}/native-*.xml`, '');

for (const { state, native } of statesFor(area)) {
  out.push(`## ${state}`, '');
  if (!native) {
    out.push(`_Fără captură nativă: \`native-${state}.xml\` lipsește (lotul pe telefon încă nu a rulat)._`, '');
    continue;
  }
  const webNodes = readWebNodes(area, state) || [];
  const nativeNodes = readNativeNodes(area, state) || [];
  const { rows, extra } = match(webNodes, nativeNodes);
  const ok = rows.filter((row) => row.native && verdict(row.web, row.native).startsWith('OK')).length;
  const diff = rows.filter((row) => row.native && !verdict(row.web, row.native).startsWith('OK')).length;
  const missing = rows.filter((row) => !row.native).length;
  out.push(`Elemente web etichetate: **${rows.length}** · potrivite fără diferență: **${ok}** · potrivite cu diferență: **${diff}** · fără pereche în nativ: **${missing}** · în plus în nativ: **${extra.length}**`, '');
  out.push('| Element (etichetă) | Web [x,y,w,h] | Nativ [x,y,w,h] | Verdict |');
  out.push('|---|---|---|---|');
  for (const row of rows) {
    const label = row.web.label.slice(0, 48).replace(/\|/g, '/');
    const nativeRect = row.native ? `[${row.native.rect.join(',')}]` : '—';
    out.push(`| ${label} | [${row.web.rect.join(',')}] | ${nativeRect} | ${verdict(row.web, row.native)} |`);
  }
  out.push('');
  if (extra.length) {
    out.push('**În nativ, fără pereche în web:**', '');
    for (const nativeNode of extra.slice(0, 40)) {
      out.push(`- [${nativeNode.rect.join(',')}] ${nativeNode.cls.split('.').pop()} „${nativeNode.label.slice(0, 60)}"`);
    }
    out.push('');
  }
}

const dir = path.join(NATIVE, area);
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, 'diff.md');
fs.writeFileSync(target, out.join('\n'), 'utf8');
console.log(`scris ${path.relative(REPO, target)} (${out.length} linii)`);

