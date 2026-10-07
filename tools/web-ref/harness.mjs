// Offline web-reference extraction for 1:1 parity (Playwright-core + system Chrome).
// No secrets are written to disk: credentials arrive only as env vars (NEXUS_TEST_EMAIL / NEXUS_TEST_PASSWORD).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { DOM_PROBE } from './dom-probe.mjs';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(__dirname, '..', '..');
export const OUT = path.join(REPO, 'docs', 'web-ref');
export const BASE = process.env.NEXUS_WEB_BASE || 'https://nexus-deepsek-production.up.railway.app';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
export function chromePath() {
  for (const p of CHROME) if (fs.existsSync(p)) return p;
  throw new Error('Chrome not found on disk');
}

const DEV = JSON.parse(fs.readFileSync(path.join(__dirname, 'device.json'), 'utf8'));
export const METRICS = {
  viewport: DEV.cssViewport, // 469 x 1021 CSS px
  deviceScaleFactor: DEV.dpr, // 2.6
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; 22101316G Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.99 Mobile Safari/537.36',
};

export function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
export function saveJson(p, obj) {
  mkdir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8');
}
export function rel(p) {
  return path.relative(REPO, p).replace(/\\/g, '/');
}

export async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless,
    args: [
      '--hide-scrollbars',
      '--disable-lcd-text',
      '--font-render-hinting=none',
      '--disable-features=OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation',
      '--overscroll-history-navigation=0',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({
    viewport: METRICS.viewport,
    deviceScaleFactor: METRICS.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera', 'microphone', 'geolocation'],
    userAgent: METRICS.userAgent,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    colorScheme: 'dark',
  });
  return { browser, context };
}

export async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

export async function login(page, { email, password }) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#email-login-form', { timeout: 90000 });
  await page.fill('#nexus-login-email', email);
  await page.fill('#nexus-login-password', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
    page.click('#email-login-form button[type="submit"]'),
  ]);
  await page
    .waitForFunction(() => !!document.querySelector('#screenViewport'), null, { timeout: 90000 })
    .catch(() => {});
  await settle(page, 1500);
  return page.evaluate(() => !document.querySelector('#email-login-form'));
}

// ---------------------------------------------------------------- DOM + shots
export async function collectDom(page) {
  return page.evaluate(DOM_PROBE);
}

export async function snap(page, dir, name, { full = false, label = '', html = ['#phoneHeader', '#screenViewport', '#phoneNav'] } = {}) {
  mkdir(dir);
  const png = path.join(dir, name + '.png');
  await page.screenshot({ path: png, fullPage: full, scale: 'css', animations: 'disabled' });
  const dom = await collectDom(page);
  const json = path.join(dir, name + '.dom.json');
  saveJson(json, { label, url: page.url(), ...dom });
  if (html && html.length) {
    const markup = await page.evaluate((sels) => {
      const o = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        o[sel] = el ? el.outerHTML : null;
      }
      return o;
    }, html);
    saveJson(path.join(dir, name + '.html.json'), markup);
  }
  return { png: rel(png), json: rel(json), nodeCount: dom.nodeCount, textLines: dom.textLines.length, viewport: dom.viewport };
}

// ---------------------------------------------------------------- network log
const SECRET_KEY = /token|password|secret|cookie|authorization|signature|private|seed|mnemonic/i;
function shape(value, depth = 0) {
  if (depth > 3) return '…';
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth + 1), '…x' + value.length] : [];
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) o[k] = SECRET_KEY.test(k) ? '[redacted]' : shape(v, depth + 1);
    return o;
  }
  if (typeof value === 'string') return value.length > 120 ? value.slice(0, 120) + '…' : value;
  return value;
}

export function attachNetwork(page, dir) {
  mkdir(dir);
  const records = [];
  let step = 'boot';
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!url.startsWith(BASE)) return;
      const req = res.request();
      const kind = req.resourceType();
      if (kind === 'image' || kind === 'font') return;
      const rec = { step, method: req.method(), path: (url.replace(BASE, '') || '/').slice(0, 220), status: res.status(), kind };
      if (kind !== 'document') {
        const raw = req.postData();
        if (raw) {
          try {
            rec.post = shape(JSON.parse(raw));
          } catch {
            rec.post = '[non-json ' + raw.length + 'b]';
          }
        }
      }
      if (url.includes('/api/') && (res.headers()['content-type'] || '').includes('json')) {
        const body = await res.json().catch(() => null);
        if (body !== null) rec.res = shape(body);
      }
      records.push(rec);
    } catch (error) {
      records.push({ step, error: String((error && error.message) || error).slice(0, 160) });
    }
  });
  return {
    mark(name) {
      step = name;
    },
    dump(file = path.join(dir, 'requests.json')) {
      saveJson(file, records);
      return records.length;
    },
    records,
  };
}
