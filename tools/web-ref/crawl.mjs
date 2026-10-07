// Systematic offline crawl of the web app (Railway) at the device's CSS viewport.
//   $env:NEXUS_TEST_EMAIL='...'; $env:NEXUS_TEST_PASSWORD='...'; node tools/web-ref/crawl.mjs [--only=a,b] [--headful]
// Output: docs/web-ref/<area>/<step>.{png,dom.json,html.json} + docs/web-ref/_network/requests.json + _run-log.json
import path from 'node:path';
import { launch, login, settle, attachNetwork, OUT, mkdir, saveJson } from './harness.mjs';
import { makeCtx } from './ctx.mjs';

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const headless = !argv.includes('--headful');
const email = process.env.NEXUS_TEST_EMAIL;
const password = process.env.NEXUS_TEST_PASSWORD;

const feedMode = () => document.querySelector('[data-feed-mode-active]')?.dataset.feedModeActive;

const steps = [
  {
    name: 'shell-home',
    run: async (c) => {
      c.mark('shell-home');
      await c.slot('primary');
      await c.snap('shell', 'home');
      await c.dumpHtml('shell', 'home', ['#phoneHeader', '#screenViewport', '#phoneNav', '.appHeader', 'nav.appNav']);
    },
  },
  {
    name: 'shell-nav-marks',
    run: async (c) => {
      const rows = await c.page.evaluate(() =>
        [...document.querySelectorAll('#phoneNav [data-slot]')].map((b) => {
          const r = b.getBoundingClientRect();
          return { slot: b.dataset.slot, aria: b.getAttribute('aria-label'), cls: b.className, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
        }),
      );
      saveJson(path.join(OUT, 'shell', 'nav-marks.json'), rows);
    },
  },
  {
    name: 'feed-reels-scroll',
    run: async (c) => {
      c.mark('feed-reels');
      await c.slot('primary');
      await c.snap('feed', 'reels-0', { label: 'Reels first fold' });
      await c.scrollSeries('feed', 'reels', { max: 3 });
    },
  },
  {
    name: 'feed-swipe-modes',
    run: async (c) => {
      c.mark('feed-swipe');
      await c.slot('primary');
      const seen = [];
      const read = async () =>
        c.page.evaluate(
          () =>
            (document.querySelector('[data-feed-mode-active]')?.dataset.feedModeActive || '?') +
            ' | ' +
            (document.querySelector('#pulsePosts article')?.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
        );
      seen.push('start: ' + (await read()));
      await c.swipe({ from: { x: 390, y: 520 }, dx: -320 });
      await c.snap('feed', 'swipe-left-1');
      seen.push('swipe-left-1: ' + (await read()));
      await c.swipe({ from: { x: 390, y: 520 }, dx: -320 });
      await c.snap('feed', 'swipe-left-2');
      seen.push('swipe-left-2: ' + (await read()));
      await c.swipe({ from: { x: 120, y: 520 }, dx: 320 });
      await c.snap('feed', 'swipe-right-1');
      seen.push('swipe-right-1: ' + (await read()));
      saveJson(path.join(OUT, 'feed', 'swipe-modes.json'), seen);
    },
  },
  {
    name: 'feed-drawer',
    run: async (c) => {
      c.mark('feed-drawer');
      await c.slot('primary');
      await c.click('#feedModules', { label: 'feed drawer opener' });
      await c.snap('feed', 'drawer-open', { label: 'feed quick drawer' });
      await c.dumpHtml('feed', 'drawer-open', ['[data-feed-quick-layer]']);
    },
  },
  {
    name: 'profile-own',
    run: async (c) => {
      c.mark('profile-own');
      await c.slot('account');
      await c.snap('profile', 'own-0', { label: 'own profile first fold' });
      await c.dumpHtml('profile', 'own-0', ['#screenViewport', '.profileScreen', '.appHeader']);
      await c.scrollSeries('profile', 'own', { max: 4 });
    },
  },
  {
    name: 'profile-tabs',
    run: async (c) => {
      c.mark('profile-tabs');
      await c.slot('account');
      const tabs = await c.page.evaluate(() =>
        [...document.querySelectorAll('[role="tab"], .profileTabs button, .profileTab')].map((b) => {
          const r = b.getBoundingClientRect();
          return { text: (b.innerText || '').replace(/\s+/g, ' ').trim(), aria: b.getAttribute('aria-label'), cls: b.className, sel: b.getAttribute('aria-selected'), r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
        }),
      );
      saveJson(path.join(OUT, 'profile', 'tabs.json'), tabs);
      for (let i = 0; i < Math.min(tabs.length, 6); i++) {
        await c.page.evaluate((idx) => document.querySelectorAll('[role="tab"], .profileTabs button, .profileTab')[idx]?.click(), i);
        await settle(c.page, 1200);
        await c.snap('profile', 'tab-' + i);
      }
    },
  },
  {
    name: 'profile-switcher',
    run: async (c) => {
      c.mark('profile-switcher');
      await c.ensureReady();
      await c.slot('account');
      await c.domClick('#modeBadge', { label: 'mode badge (persona switcher)' });
      await c.snap('profile', 'switcher-open');
      await c.dumpHtml('profile', 'switcher-open', ['#profileSwitcherBackdrop', '.profileSwitcher', '.appHeader']);
    },
  },
  {
    name: 'messages-inbox',
    run: async (c) => {
      c.mark('messages');
      await c.slot('inbox');
      await c.snap('messages', 'inbox-0', { label: 'messages inbox' });
      await c.dumpHtml('messages', 'inbox-0', ['#screenViewport', '.messengerShell, .appHeader']);
      await c.scrollSeries('messages', 'inbox', { max: 3 });
    },
  },
  {
    name: 'messages-thread',
    run: async (c) => {
      c.mark('messages-thread');
      await c.slot('inbox');
      const opened = await c.page.evaluate(() => {
        const row = document.querySelector('.conversationRow, [data-conversation-id], .messengerContact, .conversationListItem');
        if (!row) return null;
        row.click();
        return row.dataset.conversationId || row.className;
      });
      await settle(c.page, 2500);
      await c.snap('messages', 'thread-0', { label: 'thread ' + opened });
      await c.dumpHtml('messages', 'thread-0', ['#screenViewport', '.thread, .threadView, .appHeader']);
      c.note('thread-opened', String(opened));
    },
  },
  {
    name: 'search-initial',
    run: async (c) => {
      c.mark('search-initial');
      await c.slot('search');
      await c.snap('search', 'initial-0', { label: 'search empty state' });
      await c.dumpHtml('search', 'initial-0', ['#screenViewport', '.searchScreen, #phoneHeader']);
      const inputs = await c.page.evaluate(() => [...document.querySelectorAll('input')].map((i) => ({ id: i.id, name: i.name, type: i.type, ph: i.placeholder, aria: i.getAttribute('aria-label'), r: (() => { const b = i.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })() })));
      saveJson(path.join(OUT, 'search', 'inputs.json'), inputs);
    },
  },
  {
    name: 'search-typed',
    run: async (c) => {
      c.mark('search-typed');
      await c.slot('search');
      const target = await c.page.evaluate(() => {
        const i = [...document.querySelectorAll('input')].find((x) => x.type === 'search' || x.type === 'text' || x.type === '');
        return i ? (i.id ? '#' + i.id : 'input') : null;
      });
      if (target) {
        await c.fill(target, 'test');
        await c.snap('search', 'typed-test-0', { label: 'query=test' });
        await c.scrollSeries('search', 'typed-test', { max: 3 });
      } else note('no-search-input', 'none');
    },
  },
  {
    name: 'friends-switcher',
    run: async (c) => {
      c.mark('friends');
      await c.slot('friends');
      await c.snap('friends', 'switcher-open', { label: 'relations drawer' });
      await c.dumpHtml('friends', 'switcher-open', ['#screenViewport', '.profileSwitcher, [role="dialog"]', '.appHeader']);
      const rows = await c.page.evaluate(() => [...document.querySelectorAll('.profileSwitcher button, [role="dialog"] button')].map((b) => ({ text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80), data: b.getAttribute('data-relations') || '', cls: b.className })));
      saveJson(path.join(OUT, 'friends', 'rows.json'), rows);
    },
  },
  {
    name: 'live-screen',
    run: async (c) => {
      c.mark('live');
      await c.slot('utility');
      await c.snap('live', 'screen-0', { label: 'live screen' });
      await c.dumpHtml('live', 'screen-0', ['#screenViewport', '#phoneHeader']);
      await c.scrollSeries('live', 'screen', { max: 3 });
    },
  },
  {
    name: 'create-composer',
    run: async (c) => {
      c.mark('create');
      await c.slot('create');
      await settle(c.page, 2500);
      await c.snap('create', 'camera-0', { label: 'composer camera surface' });
      await c.dumpHtml('create', 'camera-0', ['#screenViewport', '.composer, .cameraSurface, body > div:last-child']);
      const text = await c.text();
      saveJson(path.join(OUT, 'create', 'camera-text.json'), text);
    },
  },
  {
    name: 'feed-drawer2',
    run: async (c) => {
      c.mark('feed-drawer2');
      await c.ensureReady();
      await c.slot('primary');
      await c.domClick('#feedModules', { label: 'drawer opener' });
      await c.snap('feed', 'drawer-open2');
      await c.dumpHtml('feed', 'drawer-open2', ['[data-feed-quick-layer]']);
    },
  },
  {
    name: 'reel-open',
    run: async (c) => {
      c.mark('reel-open');
      await c.ensureReady();
      await c.slot('primary');
      await c.tapEl('article video', { label: 'reel video' });
      await settle(c.page, 1500);
      await c.snap('viewer', 'reel-fullscreen');
      await c.dumpHtml('viewer', 'reel-fullscreen', ['.reelViewer', '#screenViewport', 'body > div:last-child']);
      await c.swipe({ from: { x: 234, y: 700 }, dy: -420 });
      await c.snap('viewer', 'reel-swipe-up');
      await c.swipe({ from: { x: 234, y: 400 }, dy: 420 });
      await c.snap('viewer', 'reel-swipe-down');
      await c.closeOverlays();
      await c.ensureReady();
    },
  },
  {
    name: 'comments-drawer',
    run: async (c) => {
      c.mark('comments');
      await c.ensureReady();
      await c.slot('primary');
      await c.domClick('[data-comments]', { label: 'comment button' });
      await settle(c.page, 1500);
      await c.snap('comments', 'drawer-open');
      await c.dumpHtml('comments', 'drawer-open', ['.clipCommentsDrawer', '.commentsDrawer', '#screenViewport', '[data-comments-scrim]']);
      await c.scrollSeries('comments', 'drawer', { max: 2 });
    },
  },
  {
    name: 'post-detail',
    run: async (c) => {
      c.mark('post-detail');
      await c.ensureReady();
      await c.slot('primary');
      const opened = await c.page.evaluate(() => {
        const card = document.querySelector('.clipBody, .whisperCard, .clipCaption, article .clipText, .pulseCard');
        if (!card) return false;
        card.click();
        return true;
      });
      await settle(c.page, 2000);
      await c.snap('post', 'detail-open', { label: 'post detail opened=' + opened });
      await c.dumpHtml('post', 'detail-open', ['#screenViewport', '.postDetail', '[role="dialog"]', '.appHeader']);
      await c.scrollSeries('post', 'detail', { max: 3 });
      await c.ensureReady();
    },
  },
  {
    name: 'profile-edit',
    run: async (c) => {
      c.mark('profile-edit');
      await c.slot('account');
      const opened = await c.page.evaluate(() => {
        const b = document.querySelector('[data-profile-edit], .profileEditButton, [aria-label*="ditare"], [aria-label*="Edit"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await settle(c.page, 1200);
      await c.snap('profile', 'edit-open', { label: 'edit opened=' + opened });
      await c.dumpHtml('profile', 'edit-open', ['#screenViewport', '.profileEditor', '[role="dialog"]']);
      await c.scrollSeries('profile', 'edit', { max: 3 });
      c.note('profile-edit-opened', String(opened));
    },
  },
  {
    name: 'profile-menu',
    run: async (c) => {
      c.mark('profile-menu');
      await c.ensureReady();
      await c.slot('account');
      const opened = await c.page.evaluate(() => {
        const b = document.querySelector('[data-profile-menu], .profileMenuButton, [aria-label*="meniu"], [aria-label*="Meniu"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await settle(c.page, 1000);
      await c.snap('profile', 'menu-open', { label: 'menu opened=' + opened });
      await c.dumpHtml('profile', 'menu-open', ['#screenViewport', '.profileMenu', '[role="menu"]', '[role="dialog"]']);
      c.note('profile-menu-opened', String(opened));
    },
  },
  {
    name: 'inbox-tabs',
    run: async (c) => {
      c.mark('inbox-tabs');
      await c.ensureReady();
      await c.slot('inbox');
      const tabs = await c.page.evaluate(() => [...document.querySelectorAll('.inboxFilters button, [data-inbox], .messengerTabs button')].map((b) => ({ text: (b.innerText || '').trim(), data: b.getAttribute('data-inbox') || b.dataset.inboxFilter || '', cls: b.className })));
      saveJson(path.join(OUT, 'messages', 'tabs.json'), tabs);
      for (let i = 0; i < tabs.length; i++) {
        await c.domClick('.inboxFilters button, [data-inbox], .messengerTabs button', { index: i });
        await settle(c.page, 1500);
        await c.snap('messages', 'tab-' + i);
      }
    },
  },
  {
    name: 'search-submit',
    run: async (c) => {
      c.mark('search-submit');
      await c.ensureReady();
      await c.slot('search');
      const inputSel = await c.page.evaluate(() => {
        const i = [...document.querySelectorAll('input')].find((x) => x.type === 'search' || x.type === 'text' || x.type === '');
        if (!i) return null;
        if (i.id) return '#' + i.id;
        i.setAttribute('data-webref-input', '1');
        return '[data-webref-input]';
      });
      if (inputSel) await c.fill(inputSel, 'test');
      const submitted = await c.page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim().toLowerCase() === 'caută');
        if (!btn) return false;
        btn.click();
        return true;
      });
      c.note('search-submitted', String(submitted));
      await settle(c.page, 2500);
      await c.snap('search', 'results-test-0', { label: 'results for test' });
      await c.dumpHtml('search', 'results-test-0', ['#screenViewport', '.searchScreen', '.searchResults']);
      await c.scrollSeries('search', 'results-test', { max: 3 });
    },
  },
  {
    name: 'story-viewer',
    run: async (c) => {
      c.mark('story');
      await c.ensureReady();
      await c.slot('primary');
      const opened = await c.page.evaluate(() => {
        const b = document.querySelector('.feedStories button, .storyRail button, [data-story-open], .storyAvatar, [aria-label*="Story"], [aria-label*="story"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await settle(c.page, 2000);
      await c.snap('viewer', 'story-viewer', { label: 'story viewer opened=' + opened });
      await c.dumpHtml('viewer', 'story-viewer', ['.storyViewer', '#screenViewport', '[role="dialog"]']);
      if (opened) {
        await c.tapAt(380, 500);
        await c.snap('viewer', 'story-next');
      }
      await c.closeOverlays();
      c.note('story-opened', String(opened));
    },
  },
  {
    name: 'media-viewer',
    run: async (c) => {
      c.mark('media-viewer');
      await c.ensureReady();
      await c.slot('primary');
      const opened = await c.page.evaluate(() => {
        const img = document.querySelector('#pulsePosts article img:not([src*="avatar"])');
        if (!img) return false;
        img.click();
        return true;
      });
      await settle(c.page, 1800);
      await c.snap('viewer', 'media-viewer', { label: 'media viewer opened=' + opened });
      await c.dumpHtml('viewer', 'media-viewer', ['.mediaViewer', '#screenViewport', '[role="dialog"]']);
      await c.closeOverlays();
      c.note('media-viewer-opened', String(opened));
    },
  },
  {
    name: 'friends-tabs',
    run: async (c) => {
      c.mark('friends-tabs');
      await c.ensureReady();
      await c.slot('friends');
      const tabs = await c.page.evaluate(() => [...document.querySelectorAll('.profileSwitcher [role="tab"], .profileSwitcher button')].map((b) => ({ text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), data: b.getAttribute('data-relations') || b.dataset.relationsTab || '', cls: b.className })));
      saveJson(path.join(OUT, 'friends', 'drawer-buttons.json'), tabs);
      const n = Math.min(tabs.length, 4);
      for (let i = 0; i < n; i++) {
        await c.domClick('.profileSwitcher [role="tab"], .profileSwitcher .relationsTab, .profileSwitcher button', { index: i });
        await settle(c.page, 1500);
        await c.snap('friends', 'tab-' + i);
      }
    },
  },
  {
    name: 'live-tabs',
    run: async (c) => {
      c.mark('live-tabs');
      await c.ensureReady();
      await c.slot('utility');
      const tabs = await c.page.evaluate(() => [...document.querySelectorAll('#screenViewport [role="tab"], #screenViewport button')].map((b) => ({ text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), cls: b.className })).filter((t) => t.text));
      saveJson(path.join(OUT, 'live', 'buttons.json'), tabs);
      for (let i = 0; i < Math.min(tabs.length, 4); i++) {
        await c.domClick('#screenViewport [role="tab"], #screenViewport button', { index: i });
        await settle(c.page, 1200);
        await c.snap('live', 'tab-' + i);
      }
      await c.domClick('#screenViewport button', { label: 'prepare live' });
      await settle(c.page, 1500);
      await c.snap('live', 'prepare-live');
      await c.dumpHtml('live', 'prepare-live', ['#screenViewport', '[role="dialog"]']);
    },
  },
  {
    name: 'feed-pull-refresh',
    run: async (c) => {
      c.mark('pull-refresh');
      await c.ensureReady();
      await c.slot('primary');
      await c.scroll({ top: 0 });
      await c.drag({ from: { x: 234, y: 260 }, dy: 190, steps: 12 });
      await c.snap('feed', 'pull-refresh');
      const t = await c.text();
      saveJson(path.join(OUT, 'feed', 'pull-refresh-text.json'), t);
    },
  },
  {
    name: 'search-result-open',
    run: async (c) => {
      c.mark('search-result-open');
      await c.ensureReady();
      await c.slot('search');
      await c.fill('#nexus-social-search-input, [data-webref-input]', 'test').catch(() => {});
      await c.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim().toLowerCase() === 'caută')?.click());
      await settle(c.page, 2500);
      const opened = await c.page.evaluate(() => {
        const card = document.querySelector('.searchResults article, .searchResultCard, #screenViewport article');
        if (!card) return false;
        card.click();
        return true;
      });
      await settle(c.page, 2000);
      await c.snap('search', 'result-opened', { label: 'result click opened=' + opened });
      await c.dumpHtml('search', 'result-opened', ['#screenViewport', '[role="dialog"]', '.postDetail']);
      await c.closeOverlays();
      c.note('search-result-opened', String(opened));
    },
  },
];

const main = async () => {
  if (!email || !password) {
    console.error('Need NEXUS_TEST_EMAIL / NEXUS_TEST_PASSWORD');
    process.exit(2);
  }
  const { browser, context } = await launch({ headless });
  const page = await context.newPage();
  const net = attachNetwork(page, mkdir(path.join(OUT, '_network')));
  const log = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push({ kind: 'console.error', detail: m.text().slice(0, 180) });
  });
  page.on('pageerror', (e) => log.push({ kind: 'pageerror', detail: String(e.message).slice(0, 300) }));
  const results = [];
  try {
    const ok = await login(page, { email, password });
    log.push({ kind: 'login', detail: String(ok) });
    console.log('login:', ok);
    const ctx = await makeCtx(page, { root: OUT, net, log });
    for (const step of steps) {
      if (only.length && !only.includes(step.name)) continue;
      const t0 = Date.now();
      try {
        await ctx.closeOverlays().catch(() => {});
        await step.run(ctx);
        results.push({ name: step.name, ok: true, ms: Date.now() - t0 });
      } catch (error) {
        results.push({ name: step.name, ok: false, ms: Date.now() - t0, error: String((error && error.message) || error).slice(0, 300) });
      }
      const last = results[results.length - 1];
      console.log(last.name, last.ok ? 'ok ' + last.ms + 'ms' : 'FAIL ' + last.error);
    }
    saveJson(path.join(OUT, '_run-log.json'), { results, notes: log });
  } catch (error) {
    console.error('RUN FAILED', error);
    saveJson(path.join(OUT, '_run-log.json'), { fatal: String((error && error.stack) || error).slice(0, 1200), notes: log });
    process.exitCode = 1;
  } finally {
    console.log('network records:', net.dump(path.join(OUT, '_network', 'requests.json')));
    await browser.close();
  }
};

await main();

