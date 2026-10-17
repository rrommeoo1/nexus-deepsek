#!/usr/bin/env node
/**
 * Builds the Jungle Book brand assets from apps/nexus-mobile/assets-src/jungle-book-logo.jpg.
 *
 * The pixel work lives in make-assets.ps1 (System.Drawing, which ships with Windows — no paid or
 * extra dependency): this entry verifies the source, runs the script, and refuses the result if any
 * file has the wrong size, an unexpected transparency, or a corner that is not the field colour the
 * script sampled. Running it twice writes the same bytes, so it is safe to re-run before a build.
 *
 * Usage: node tools/brand/make-assets.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const source = join(repoRoot, 'apps', 'nexus-mobile', 'assets-src', 'jungle-book-logo.jpg');
const outDir = join(repoRoot, 'apps', 'nexus-mobile', 'assets', 'brand');
const script = join(here, 'make-assets.ps1');

/** Every file the app references, with the size it must have. */
const expected = [
  { file: 'jb-logo-1024.png', width: 1024, height: 1024, transparentCorners: false },
  { file: 'jb-logo-circle-256.png', width: 256, height: 256, transparentCorners: true },
  { file: 'jb-logo-header-1x.png', width: 36, height: 36, transparentCorners: false },
  { file: 'jb-logo-header-2x.png', width: 72, height: 72, transparentCorners: false },
  { file: 'jb-logo-header-3x.png', width: 108, height: 108, transparentCorners: false },
  { file: 'jb-icon-foreground-1024.png', width: 1024, height: 1024, transparentCorners: true },
  { file: 'jb-icon-background-1024.png', width: 1024, height: 1024, transparentCorners: false },
  { file: 'jb-icon-1024.png', width: 1024, height: 1024, transparentCorners: false },
  { file: 'jb-icon-monochrome-1024.png', width: 1024, height: 1024, transparentCorners: true, centreOpaque: false },
  { file: 'jb-splash-1080x1920.png', width: 1080, height: 1920, transparentCorners: false },
];

function fail(message) {
  console.error(`make-assets: ${message}`);
  process.exit(1);
}

function pngSize(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length };
}

function runPowerShell(args) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) fail(`powershell could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`powershell exited ${result.status}: ${(result.stderr || '').trim()}`);
  return (result.stdout || '').trim();
}

if (!existsSync(source)) {
  fail(`missing source ${source}; the rest of the brand work can ship without the logo, but this file cannot be invented`);
}
const header = readFileSync(source).subarray(0, 3).toString('hex');
if (header !== 'ffd8ff') fail(`source is not a JPEG (header ${header})`);
if (statSync(source).size < 10_000) fail('source is suspiciously small');

const raw = runPowerShell(['-File', script, '-Source', source, '-OutDir', outDir]);
if (!raw.includes('{')) fail(`the pixel script printed no report: ${raw.slice(0, 200)}`);
const report = JSON.parse(raw.slice(raw.indexOf('{')));

if (report.source.width !== 784 || report.source.height !== 1168) {
  fail(`source changed size: ${report.source.width}x${report.source.height}`);
}
if (report.background.cornerSpread > 24) {
  fail(`the corners are not one colour (spread ${report.background.cornerSpread}); refusing to guess the field`);
}
if (report.crop.side < 400) fail(`the letters box is only ${report.crop.side}px; the crop would be blurry`);

let failures = 0;
for (const item of expected) {
  const path = join(outDir, item.file);
  if (!existsSync(path)) {
    console.error(`missing ${item.file}`);
    failures += 1;
    continue;
  }
  const size = pngSize(path);
  if (size.width !== item.width || size.height !== item.height) {
    console.error(`${item.file}: ${size.width}x${size.height}, expected ${item.width}x${item.height}`);
    failures += 1;
  }
  if (size.bytes < 1_000) {
    console.error(`${item.file}: ${size.bytes} bytes, expected a real drawing`);
    failures += 1;
  }
  const row = report.files.find((entry) => entry.file === item.file);
  if (!row) {
    console.error(`${item.file}: not measured by the pixel script`);
    failures += 1;
    continue;
  }
  if (item.transparentCorners && row.cornerAlpha !== 0) {
    console.error(`${item.file}: corner alpha ${row.cornerAlpha}, expected 0 (transparent)`);
    failures += 1;
  }
  if (!item.transparentCorners && row.cornerAlpha !== 255) {
    console.error(`${item.file}: corner alpha ${row.cornerAlpha}, expected 255 (opaque field)`);
    failures += 1;
  }
  if (item.centreOpaque !== false && row.centerAlpha !== 255) {
    console.error(`${item.file}: centre alpha ${row.centerAlpha}, expected 255`);
    failures += 1;
  }
  if (!item.transparentCorners) {
    const field = [report.background.r, report.background.g, report.background.b];
    const distance = Math.hypot(...row.cornerRgb.map((value, index) => value - field[index]));
    // The field is a JPEG with a soft vignette, so a corner may drift a few steps from the average.
    if (distance > 30) {
      console.error(`${item.file}: corner rgb(${row.cornerRgb}) is not the field ${report.background.hex}`);
      failures += 1;
    }
  }
}
if (failures) fail(`${failures} asset(s) are wrong`);

console.log(
  `source ${report.source.width}x${report.source.height} · field ${report.background.hex} ` +
  `(spread ${report.background.cornerSpread}) · letters ${report.lettersBox.width}x${report.lettersBox.height} ` +
  `· crop ${report.crop.side}px at ${report.crop.x},${report.crop.y}`,
);
console.log(`ok · ${expected.length} files in ${outDir.replace(repoRoot + '\\', '')}`);

