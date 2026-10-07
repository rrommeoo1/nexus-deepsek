// Per-page driver: navigation by the bar's own marks, taps, CDP touch gestures, scroll and snapshots.
import path from 'node:path';
import { mkdir, saveJson, settle, snap as shot, BASE } from './harness.mjs';

export async function makeCtx(page, { root, net, log = [] }) {
  let cdp = null;
  const session = async () => (cdp ||= await page.context().newCDPSession(page));
  const note = (kind, detail) => log.push({ kind, detail, at: new Date().toISOString() });

  const api = {
    page,
    log,
    dir(area) {
      return mkdir(path.join(root, area));
    },
    mark: (name) => net.mark(name),
    async snap(area, name, opts = {}) {
      const info = await shot(page, path.join(root, area), name, opts);
      note('snap', area + '/' + name + ' nodes=' + info.nodeCount + ' text=' + info.textLines);
      return info;
    },
    async html(sel) {
      return page.evaluate((s) => document.querySelector(s)?.outerHTML || null, sel);
    },
    async dumpHtml(area, name, sels) {
      const o = await page.evaluate((list) => {
        const out = {};
        for (const s of list) out[s] = document.querySelector(s)?.outerHTML || null;
        return out;
      }, sels);
      saveJson(path.join(root, area, name + '.html.json'), o);
      return o;
    },
    async closeOverlays() {
      const seen = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const present = await page.evaluate(() =>
          [...document.querySelectorAll('.storyViewer, .mediaViewer, .reelViewer, .account-modal, .clipCommentsDrawer:not(.hidden), [data-feed-quick-layer]:not([hidden]), .profileSwitcherBackdrop, [role="dialog"]')]
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => e.className),
        );
        if (!present.length) break;
        seen.push(...present);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);
        const still = await page.evaluate(() => [...document.querySelectorAll('.storyViewer, .mediaViewer, .reelViewer, .account-modal, .clipCommentsDrawer:not(.hidden)')].filter((e) => e.getBoundingClientRect().width > 0).length);
        if (still) await page.goBack({ timeout: 5000 }).catch(() => {});
        await settle(page, 500);
      }
      await page.evaluate(() => document.querySelectorAll('#phoneNav[inert]').forEach((n) => n.removeAttribute('inert')));
      if (seen.length) note('closed-overlays', seen.join(','));
      return seen;
    },
    async ensureReady() {
      const url = page.url();
      const ok = url.startsWith(BASE) && (await page.evaluate(() => !!document.querySelector('#phoneNav')));
      if (ok) return true;
      note('recover', url);
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForSelector('#phoneNav', { timeout: 60000 }).catch(() => {});
      await settle(page, 1200);
      return false;
    },
    async slot(name) {
      await api.ensureReady();
      const sel = `#phoneNav [data-slot="${name}"]`;
      const inert = await page.evaluate(() => !!document.querySelector('#phoneNav[inert]'));
      if (inert) await api.closeOverlays();
      const ok = await api.domClick(sel, { label: 'slot ' + name });
      if (!ok) await api.domClick(sel, { label: 'slot retry ' + name });
      return ok;
    },
    async click(sel, { label = '', timeout = 5000 } = {}) {
      try {
        await page.click(sel, { timeout });
        await settle(page, 600);
        return true;
      } catch (e) {
        note('click-fail', (label || sel) + ': ' + e.message.split('\n')[0]);
        return false;
      }
    },
    async domClick(sel, { index = 0, label = '' } = {}) {
      const ok = await page.evaluate(
        ([s, i]) => {
          const el = document.querySelectorAll(s)[i];
          if (!el) return false;
          el.scrollIntoView({ block: 'center' });
          el.click();
          return true;
        },
        [sel, index],
      );
      if (!ok) note('domClick-fail', label || sel);
      await settle(page, 700);
      return ok;
    },
    async tapEl(sel, { index = 0, label = '' } = {}) {
      try {
        await page.locator(sel).nth(index).click({ force: true, timeout: 5000 });
        await settle(page, 600);
        return true;
      } catch (e) {
        note('tapEl-fail', (label || sel) + ': ' + e.message.split('\n')[0]);
        return false;
      }
    },
    async fill(sel, value) {
      try {
        await page.fill(sel, value, { timeout: 5000 });
        await settle(page, 900);
        return true;
      } catch (e) {
        note('fill-fail', sel + ': ' + e.message.split('\n')[0]);
        return false;
      }
    },
    async tapText(text, scope = 'button, a, [role="tab"], [role="button"]') {
      const ok = await page.evaluate(
        ([t, s]) => {
          const els = [...document.querySelectorAll(s)];
          const hit = els.find((e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim() === t) || els.find((e) => (e.innerText || '').replace(/\s+/g, ' ').trim().includes(t));
          if (!hit) return false;
          hit.scrollIntoView({ block: 'center' });
          hit.click();
          return true;
        },
        [text, scope],
      );
      if (!ok) note('clickText-fail', text);
      await settle(page, 600);
      return ok;
    },
    async drag({ from, dx = 0, dy = 0, steps = 14, stepMs = 14, settleMs = 700 }) {
      const start = from || { x: 234, y: Math.round((await page.evaluate(() => innerHeight)) * 0.5) };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(start.x + (dx * i) / steps, start.y + ((dy || 0) * i) / steps);
        await page.waitForTimeout(stepMs);
      }
      await page.mouse.up();
      await page.waitForTimeout(settleMs);
      await settle(page, 250);
    },
    async sweep({ axis = 'x', dist = 320, from = null, steps = 14 }) {
      const isX = axis === 'x';
      await api.drag({ from, dx: isX ? dist : 0, dy: isX ? 0 : dist, steps });
    },
    async tapAt(x, y) {
      const c = await session();
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await page.waitForTimeout(60);
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settle(page, 500);
    },
    async swipe({ from, dx = 0, dy = 0, steps = 14, hold = 12, settleMs = 700 }) {
      const c = await session();
      const start = from || { x: 234, y: Math.round((await page.evaluate(() => innerHeight)) * 0.5) };
      const pt = (x, y) => ({ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 6, radiusY: 6, force: 1 });
      try {
        await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(start.x, start.y)] });
        for (let i = 1; i <= steps; i++) {
          await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(start.x + (dx * i) / steps, start.y + ((dy || 0) * i) / steps)] });
          await page.waitForTimeout(hold);
        }
        await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } catch (error) {
        note('touch-fail', String(error.message).split('\n')[0]);
        await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {});
        await api.drag({ from: start, dx, dy, steps, settleMs });
        return;
      }
      await page.waitForTimeout(settleMs);
      await settle(page, 300);
    },
    async scroller() {
      return page.evaluate(() => {
        const prev = document.querySelector('[data-webref-scroll]');
        if (prev) prev.removeAttribute('data-webref-scroll');
        const cands = [...document.querySelectorAll('#screenViewport, #screenViewport *, .messengerShell, .profileScreen')].filter((el) => {
          const cs = getComputedStyle(el);
          return el.scrollHeight > el.clientHeight + 8 && ['auto', 'scroll', 'overlay'].includes(cs.overflowY);
        });
        if (!cands.length) return null;
        cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
        const el = cands[0];
        el.setAttribute('data-webref-scroll', '1');
        return { sel: el.id ? '#' + el.id : '.' + [...el.classList].join('.'), h: el.scrollHeight, c: el.clientHeight };
      });
    },
    async scroll({ top, by } = {}) {
      await api.scroller();
      return page.evaluate(
        ([t, b]) => {
          const el = document.querySelector('[data-webref-scroll]') || document.scrollingElement;
          if (typeof t === 'number') el.scrollTop = t;
          if (typeof b === 'number') el.scrollTop += b;
          return { sel: el.id ? '#' + el.id : el.className, top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight };
        },
        [top, by],
      );
    },
    async scrollSeries(area, name, { max = 4 } = {}) {
      const info = await api.scroller();
      if (!info) {
        return [await api.snap(area, `${name}-s0`, { label: 'no scroller' })];
      }
      const pages = Math.min(max, Math.max(1, Math.ceil(info.h / Math.max(1, info.c))));
      const out = [];
      for (let i = 0; i < pages; i++) {
        await api.scroll({ top: i * info.c });
        await page.waitForTimeout(400);
        out.push(await api.snap(area, `${name}-s${i}`, { label: `${info.sel} scroll ${i}` }));
      }
      return out;
    },
    async text() {
      return page.evaluate(() => [...new Set(document.body.innerText.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean))]);
    },
    async probe(sel) {
      return page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { sel: s, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], text: (el.innerText || '').slice(0, 200), cls: el.className };
      }, sel);
    },
    note,
  };
  return api;
}
