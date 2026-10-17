#!/usr/bin/env node
/**
 * Checks the transparent mark the app ships, without regenerating it.
 *
 * `node tools/brand/make-assets.mjs` writes assets/brand/stats.json next to the pictures; this test
 * reads it, holds every number to the limits below, and then proves the pictures are the ones the
 * report describes: the PNGs are decoded here (zlib is in Node, so no dependency is added) and the
 * corners, the empty share of the square and the fruit probes are read from the pixels themselves.
 * A hand-edited PNG or a stale stats.json therefore fails, not just a dishonest number.
 *
 * Run with: npm run test:brand-assets
 */
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const zlib = require('node:zlib');

const ROOT = join(__dirname, '..');
const BRAND_DIR = join(ROOT, 'assets', 'brand');
const STATS = join(BRAND_DIR, 'stats.json');
const SOURCE = join(ROOT, 'assets-src', 'jungle-book-logo.jpg');

/** The contract of the mark: nothing softer, nothing emptier, nothing framed. */
const LIMITS = {
  transparentFractionMin: 0.25,
  transparentFractionMax: 0.6,
  edgeRampMaxPx: 3,
  hazeMaxFraction: 0.05,
  specksMax: 0,
  probeMinDepth: 4,
};

const problems = [];
const fail = (message) => problems.push(message);

if (!existsSync(STATS)) {
  console.error('test-brand-assets: assets/brand/stats.json is missing; run node tools/brand/make-assets.mjs');
  process.exit(1);
}
const stats = JSON.parse(readFileSync(STATS, 'utf8'));

if (!existsSync(SOURCE)) fail('assets-src/jungle-book-logo.jpg is missing');
else {
  const sha = createHash('sha256').update(readFileSync(SOURCE)).digest('hex');
  if (sha !== stats.source?.sha256) fail('the source photograph changed since the mark was generated');
}

/** Minimal PNG reader for the 8-bit RGBA files System.Drawing writes. */
function decodePng(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${path} is not a PNG`);
  let offset = 8;
  let header = null;
  const data = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colourType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!header) throw new Error(`${path} has no IHDR`);
  if (header.bitDepth !== 8 || header.colourType !== 6 || header.interlace !== 0) {
    throw new Error(`${path} is not 8-bit RGBA; this test only reads what the generator writes`);
  }
  const raw = zlib.inflateSync(Buffer.concat(data));
  const { width, height } = header;
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? line[i - 4] : 0;
      const up = previous[i];
      const upLeft = i >= 4 ? previous[i - 4] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[i] = value & 0xff;
    }
    line.copy(pixels, y * stride);
    previous = line;
  }
  return { width, height, pixels };
}

const alphaAt = (image, x, y) => image.pixels[(y * image.width + x) * 4 + 3];

// Every file the report names, read from disk.
const mark = stats.files?.find((row) => row.file === 'jb-mark-1024.png');
if (!mark) fail('stats.json does not describe jb-mark-1024.png');

for (const row of stats.files ?? []) {
  const path = join(BRAND_DIR, row.file);
  if (!existsSync(path)) {
    fail(`${row.file} is listed in stats.json but missing on disk`);
    continue;
  }
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (sha !== row.sha256) fail(`${row.file} is not the file the report describes (sha256 differs)`);

  const image = decodePng(path);
  if (image.width !== row.width || image.height !== row.height) {
    fail(`${row.file} is ${image.width}x${image.height}, the report says ${row.width}x${row.height}`);
    continue;
  }

  const corners = [
    alphaAt(image, 0, 0),
    alphaAt(image, image.width - 1, 0),
    alphaAt(image, 0, image.height - 1),
    alphaAt(image, image.width - 1, image.height - 1),
  ];
  const wanted = row.transparent ? 0 : 255;
  if (corners.some((alpha) => alpha !== wanted)) {
    fail(`${row.file} corners are ${corners.join(',')}, expected ${wanted}: the field is not gone`);
  }

  if (row.transparent) {
    if (row.specks > LIMITS.specksMax) fail(`${row.file} has ${row.specks} isolated specks`);
    if (row.edgeRampPx > LIMITS.edgeRampMaxPx) fail(`${row.file} edge rope is ${row.edgeRampPx}px, limit ${LIMITS.edgeRampMaxPx}`);
    if (row.hazeFraction > LIMITS.hazeMaxFraction) {
      fail(`${row.file} is ${(row.hazeFraction * 100).toFixed(2)}% translucent band, limit ${LIMITS.hazeMaxFraction * 100}%`);
    }
    let clear = 0;
    for (let i = 3; i < image.pixels.length; i += 4) if (image.pixels[i] === 0) clear += 1;
    const share = clear / (image.width * image.height);
    if (Math.abs(share - row.transparentFraction) > 0.01) {
      fail(`${row.file} is ${(share * 100).toFixed(1)}% empty on disk, the report says ${(row.transparentFraction * 100).toFixed(1)}%`);
    }
  } else {
    for (let i = 3; i < image.pixels.length; i += 4) {
      if (image.pixels[i] !== 255) {
        fail(`${row.file} is not fully opaque; the launcher layer must cover the whole icon`);
        break;
      }
    }
  }
}

// The letters themselves: the deepest pixel of each of the two fruit bodies must be solid.
if (mark) {
  const image = decodePng(join(BRAND_DIR, 'jb-mark-1024.png'));
  if (mark.transparentFraction < LIMITS.transparentFractionMin || mark.transparentFraction > LIMITS.transparentFractionMax) {
    fail(`jb-mark-1024.png is ${(mark.transparentFraction * 100).toFixed(1)}% empty, expected ` +
      `${LIMITS.transparentFractionMin * 100}-${LIMITS.transparentFractionMax * 100}%`);
  }
  if (!Array.isArray(mark.probes) || mark.probes.length < 2) fail('the report should carry two fruit probes');
  for (const probe of mark.probes ?? []) {
    if (probe.depth < LIMITS.probeMinDepth) fail(`probe at ${probe.x},${probe.y} is too close to the edge to be fruit`);
    const alpha = alphaAt(image, probe.x, probe.y);
    if (alpha !== 255) fail(`probe at ${probe.x},${probe.y} has alpha ${alpha} on disk, expected 255`);
  }
}

// The brand component is the only loader, and it must not paint a frame around the mark.
const logo = readFileSync(join(ROOT, 'src', 'components', 'BrandLogo.tsx'), 'utf8');
if (!logo.includes('jb-mark-header-1x.png') || !logo.includes('jb-mark-nav-1x.png') || !logo.includes('jb-mark-1024.png')) {
  fail('BrandLogo.tsx does not load the transparent mark');
}
if (/borderRadius|backgroundColor/.test(logo)) fail('BrandLogo.tsx draws a shape around the mark');

if (problems.length) {
  console.error(`test-brand-assets: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `test-brand-assets: ${stats.files.length} files, mark ${(mark.transparentFraction * 100).toFixed(1)}% empty, ` +
  `rope ${mark.edgeRampPx}px, haze ${(mark.hazeFraction * 100).toFixed(2)}%, ` +
  `${mark.probes.map((p) => `probe ${p.alpha} at ${p.x},${p.y}`).join(', ')}`,
);

