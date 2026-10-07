// Smoke run: log in, dump the post-login shell (geometry + text) so we can see what the web actually
// renders at the device's CSS viewport. Usage:
//   $env:NEXUS_TEST_EMAIL='...'; $env:NEXUS_TEST_PASSWORD='...'; node tools/web-ref/smoke.mjs
import path from 'node:path';
import { launch, login, snap, settle, attachNetwork, OUT, mkdir } from './harness.mjs';

const email = process.env.NEXUS_TEST_EMAIL;
const password = process.env.NEXUS_TEST_PASSWORD;
if (!email || !password) {
  console.error('Missing NEXUS_TEST_EMAIL / NEXUS_TEST_PASSWORD env vars.');
  process.exit(2);
}

const dir = mkdir(path.join(OUT, '_boot'));
const { browser, context } = await launch({ headless: true });
const page = await context.newPage();
const net = attachNetwork(page, path.join(OUT, '_network'));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200));
});

try {
  const ok = await login(page, { email, password });
  console.log('login ok:', ok, '| url:', page.url());
  net.mark('shell');
  await settle(page, 1500);
  const shot = await snap(page, dir, 'after-login', { full: false, label: 'post-login shell at 469x1021 CSS / DPR 2.6' });
  console.log('shot:', JSON.stringify(shot, null, 1));

  const probe = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, present: false };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { sel, present: true, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], display: cs.display, visibility: cs.visibility, position: cs.position, z: cs.zIndex, scrollH: el.scrollHeight, scrollTop: el.scrollTop };
    };
    return {
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      docScrollH: document.documentElement.scrollHeight,
      bodyText: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 80),
      els: ['.nexusDemo', '.showcaseHeader', '.demoStage', '.moduleRail', '.phone', '.phoneMetal', '.phoneScreen', '.dynamicIsland', '#phoneHeader', '#screenViewport', '#phoneNav', '.infoPanel', 'footer.showcaseFooter', '.appHeader', '#moduleRail', '.feedBar', '#feedModules'].map(pick),
    };
  });
  console.log('PROBE', JSON.stringify(probe, null, 1));
  console.log('network records:', net.dump());
} catch (error) {
  console.error('SMOKE FAILED:', error && error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
