#!/usr/bin/env node
/**
 * Builds the Jungle Book mark — the letters alone, no field, no frame — from
 * apps/nexus-mobile/assets-src/jungle-book-logo.jpg, and proves it is clean.
 *
 * The pixel work lives in make-assets.ps1 (System.Drawing + C# through Add-Type, both of which ship
 * with Windows, so nothing is bought or installed). This entry:
 *
 *   1. removes every brand asset the current contract does not name (the old files that carried the
 *      green field, the square logo, the circular mask);
 *   2. runs the generator twice and refuses the result unless both runs wrote the same bytes;
 *   3. checks the report: transparent corners, opaque fruit bodies, the share of empty pixels, no
 *      isolated speck, an edge rope no wider than three pixels;
 *   4. writes assets/brand/stats.json, which scripts/test-brand-assets.cjs then enforces without
 *      regenerating anything.
 *
 * Usage: node tools/brand/make-assets.mjs
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const sourceRel = 'apps/nexus-mobile/assets-src/jungle-book-logo.jpg';
const source = join(repoRoot, sourceRel);
const outDir = join(repoRoot, 'apps', 'nexus-mobile', 'assets', 'brand');
const script = join(here, 'make-assets.ps1');

/**
 * Every file the app, the launcher and the splash refer to, with the size it must have.
 * `transparent` files must have empty corners; the others must be an opaque field.
 */
const expected = [
  { file: 'jb-mark-1024.png', width: 1024, height: 1024, transparent: true },
  { file: 'jb-mark-512.png', width: 512, height: 512, transparent: true },
  { file: 'jb-mark-header-1x.png', width: 52, height: 52, transparent: true },
  { file: 'jb-mark-header-2x.png', width: 104, height: 104, transparent: true },
  { file: 'jb-mark-header-3x.png', width: 156, height: 156, transparent: true },
  { file: 'jb-mark-nav-1x.png', width: 54, height: 54, transparent: true },
  { file: 'jb-mark-nav-2x.png', width: 108, height: 108, transparent: true },
  { file: 'jb-mark-nav-3x.png', width: 162, height: 162, transparent: true },
  { file: 'jb-splash-512.png', width: 512, height: 512, transparent: true },
  { file: 'jb-icon-foreground-1024.png', width: 1024, height: 1024, transparent: true },
  { file: 'jb-icon-monochrome-1024.png', width: 1024, height: 1024, transparent: true },
  { file: 'jb-icon-background-1024.png', width: 1024, height: 1024, transparent: false },
  { file: 'jb-icon-1024.png', width: 1024, height: 1024, transparent: false },
];

/** The numbers the brief asks for; the test reads them from stats.json and holds them to this. */
const limits = {
  transparentFractionMin: 0.25,
  transparentFractionMax: 0.6,
  edgeRampMaxPx: 3,
  hazeMaxFraction: 0.05,
  specksMax: 0,
};

function fail(message) {
  console.error(`make-assets: ${message}`);
  process.exit(1);
}

function pngInfo(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${path} is not a PNG`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function runPowerShell(args) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`powershell could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`powershell exited ${result.status}: ${(result.stderr || '').trim()}`);
  return (result.stdout || '').trim();
}

function generate() {
  const raw = runPowerShell(['-File', script, '-Source', source, '-OutDir', outDir]);
  const start = raw.indexOf('{');
  if (start < 0) fail(`the pixel script printed no report: ${raw.slice(0, 200)}`);
  const report = JSON.parse(raw.slice(start));
  const hashes = {};
  for (const item of expected) {
    const path = join(outDir, item.file);
    if (!existsSync(path)) fail(`missing ${item.file}`);
    hashes[item.file] = pngInfo(path).sha256;
  }
  return { report, hashes };
}

if (!existsSync(source)) {
  fail(`missing source ${source}; the mark cannot be invented`);
}
const header = readFileSync(source).subarray(0, 3).toString('hex');
if (header !== 'ffd8ff') fail(`source is not a JPEG (header ${header})`);
const sourceSha = createHash('sha256').update(readFileSync(source)).digest('hex');

// 1. the contract is the only list: anything else in the folder is an older drawing.
const keep = new Set([...expected.map((item) => item.file), 'stats.json']);
let removed = 0;
for (const name of readdirSync(outDir)) {
  if (keep.has(name)) continue;
  rmSync(join(outDir, name), { force: true });
  removed += 1;
}

// 2. twice, so a run that depends on anything but its input is refused here rather than in the app.
const first = generate();
const second = generate();
for (const item of expected) {
  if (first.hashes[item.file] !== second.hashes[item.file]) {
    fail(`${item.file} differs between two identical runs; the generator is not deterministic`);
  }
}

const { report } = first;
if (report.source.width !== 784 || report.source.height !== 1168) {
  fail(`source changed size: ${report.source.width}x${report.source.height}`);
}
if (report.field.sigma > 12) {
  fail(`the field is too noisy to separate (sigma ${report.field.sigma}); refusing to guess the edge`);
}
if (report.mask.crop.side < 400) fail(`the letters box is only ${report.mask.crop.side}px wide`);

// 3. the numbers.
const problems = [];
for (const item of expected) {
  const row = report.files.find((entry) => entry.file === item.file);
  if (!row) {
    problems.push(`${item.file}: not measured by the pixel script`);
    continue;
  }
  const info = pngInfo(join(outDir, item.file));
  if (info.width !== item.width || info.height !== item.height) {
    problems.push(`${item.file}: ${info.width}x${info.height}, expected ${item.width}x${item.height}`);
  }
  if (info.bytes < 500) problems.push(`${item.file}: ${info.bytes} bytes, expected a real drawing`);
  const wanted = item.transparent ? 0 : 255;
  if (row.cornerAlpha.some((alpha) => alpha !== wanted)) {
    problems.push(`${item.file}: corners ${JSON.stringify(row.cornerAlpha)}, expected ${wanted}`);
  }
  if (item.transparent) {
    if (row.specks > limits.specksMax) problems.push(`${item.file}: ${row.specks} isolated specks`);
    if (row.edgeRampPx > limits.edgeRampMaxPx) problems.push(`${item.file}: edge rope ${row.edgeRampPx}px wide`);
    if (row.hazeFraction > limits.hazeMaxFraction) {
      problems.push(`${item.file}: ${(row.hazeFraction * 100).toFixed(2)}% of the edge is a translucent band`);
    }
  }
}

const mark = report.files.find((entry) => entry.file === 'jb-mark-1024.png');
if (!mark) fail('the pixel script did not measure jb-mark-1024.png');
if (mark.transparentFraction < limits.transparentFractionMin || mark.transparentFraction > limits.transparentFractionMax) {
  problems.push(
    `jb-mark-1024.png is ${(mark.transparentFraction * 100).toFixed(1)}% transparent, expected ` +
    `${limits.transparentFractionMin * 100}-${limits.transparentFractionMax * 100}%`,
  );
}
if (!Array.isArray(mark.probes) || mark.probes.length < 2) {
  problems.push('jb-mark-1024.png: expected two fruit probes, one for each letter');
} else {
  for (const probe of mark.probes) {
    if (probe.alpha !== 255) problems.push(`probe at ${probe.x},${probe.y} has alpha ${probe.alpha}, expected 255`);
    if (probe.depth < 4) problems.push(`probe at ${probe.x},${probe.y} is ${probe.depth}px from the edge: not fruit`);
  }
}
if (problems.length) fail(`${problems.length} asset(s) are wrong:\n  ${problems.join('\n  ')}`);

const stats = {
  generator: 'tools/brand/make-assets.ps1',
  source: { path: sourceRel, sha256: sourceSha, width: report.source.width, height: report.source.height },
  field: report.field,
  mask: report.mask,
  limits,
  files: report.files.map((row) => ({
    ...row,
    sha256: first.hashes[row.file],
    transparent: expected.find((item) => item.file === row.file)?.transparent ?? false,
  })),
};
writeFileSync(join(outDir, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

console.log(
  `source ${report.source.width}x${report.source.height} · field ${report.field.hex} ` +
  `(sigma ${report.field.sigma}, cuts ${report.field.lowCut}/${report.field.highCut}) · ` +
  `letters ${report.mask.alphaBox.width}x${report.mask.alphaBox.height} · crop ${report.mask.crop.side}px`,
);
console.log(
  `mark ${(mark.transparentFraction * 100).toFixed(1)}% transparent · rope ${mark.edgeRampPx}px · ` +
  `${mark.specks} specks · probes ${mark.probes.map((p) => `alpha ${p.alpha} at ${p.x},${p.y}`).join(', ')}`,
);
console.log(`ok · ${expected.length} files · ${removed} stale file(s) removed · two runs byte-identical`);


