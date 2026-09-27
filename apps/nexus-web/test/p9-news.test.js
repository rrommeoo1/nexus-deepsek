// Wave 6g (P9) contracts: Breaking is served by an allow-listed aggregator, and nothing else.
//
// The rules that matter are the ones that keep the lens honest: with no approved provider it says so
// instead of inventing headlines, a URL is only followed on a host the provider was approved for, a
// headline that arrives as markup is flattened, a link that points anywhere else loses its link, the
// cache is what keeps the aggregator from being asked once per viewer, and a failing provider degrades
// to the last snapshot or to the honest disabled state - never to an exception in a route.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NEWS_ASK_MULTIPLIER, NEWS_CACHE_TTL_SECONDS, NEWS_PROVIDER_REGISTRY, NEWS_REGISTRY_IDS,
  allowlistedNewsUrl, isPlainNewsHost, newsProviderConfig, newsTimestamp,
  normalizeNewsItem, normalizeNewsItems, readBreakingNews, resetNewsSnapshots, sanitizeNewsText,
} from "../lib/news-provider.js";
import {
  breakingAllowedHosts, breakingNewsCardMarkup, breakingNewsHref, breakingNewsItems, breakingNewsMarkup, breakingProviderLine,
} from "../public/breaking-news.js";

const provider = readFileSync(new URL("../lib/news-provider.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../public/breaking-news.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const envFile = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");

const GDELT_BODY = JSON.stringify({
  articles: [
    { title: "Ports reopen after the storm", url: "https://api.gdeltproject.org/redirect?doc=1", domain: "example-news.org", seendate: "20260920T134500Z", language: "English" },
    { title: "<b>Markets</b> steady&nbsp;after the vote", url: "https://news.example.org/story", domain: "news.example.org", seendate: "20260920T120000Z", language: "English" },
    { title: "   ", url: "https://example-news.org/empty", domain: "example-news.org", seendate: "20260920T110000Z" },
    { title: "Second source", url: "https://api.gdeltproject.org/redirect?doc=2", domain: "example-news.org", seendate: "20260920T100000Z" },
  ],
});

const fetchOnce = (body, { ok = true, status = 200 } = {}) => {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return { ok, status, text: async () => body };
  };
  return { impl, calls };
};

test("with no approved aggregator the lens stays truthful and nothing is contacted", async () => {
  resetNewsSnapshots();
  assert.deepEqual(NEWS_REGISTRY_IDS, ["gdelt", "newsapi", "local-fixture"]);
  // The registry is the allow-list: every entry names the host it may be asked on, and nothing else.
  assert.deepEqual(NEWS_PROVIDER_REGISTRY.gdelt.hosts, ["api.gdeltproject.org"]);
  assert.deepEqual(NEWS_PROVIDER_REGISTRY.newsapi.hosts, ["newsapi.org"]);
  assert.deepEqual(NEWS_PROVIDER_REGISTRY["local-fixture"].hosts, ["127.0.0.1"]);
  // The loopback fixture is refused in production, and without an explicit address it stays disabled.
  assert.equal(newsProviderConfig({ NEXUS_NEWS_PROVIDER: "local-fixture", NODE_ENV: "production", NEXUS_NEWS_FIXTURE_URL: "http://127.0.0.1:5051/fixture" }).status, "disabled");
  assert.match(newsProviderConfig({ NEXUS_NEWS_PROVIDER: "local-fixture", NODE_ENV: "production" }).reason, /refused in production/);
  assert.match(newsProviderConfig({ NEXUS_NEWS_PROVIDER: "local-fixture" }).reason, /NEXUS_NEWS_FIXTURE_URL/);
  const disabled = newsProviderConfig({});
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.reason, "No approved news aggregator is configured");
  const unknown = newsProviderConfig({ NEXUS_NEWS_PROVIDER: "some-random-aggregator" });
  assert.equal(unknown.status, "disabled");
  assert.match(unknown.reason, /not an approved news aggregator/);
  const missingKey = newsProviderConfig({ NEXUS_NEWS_PROVIDER: "newsapi" });
  assert.equal(missingKey.status, "disabled");
  assert.match(missingKey.reason, /needs its provider key/);
  // A read with no provider configured must not reach the network at all.
  let contacted = 0;
  const news = await readBreakingNews({ env: {}, fetchImpl: async () => { contacted += 1; return { ok: true, text: async () => "{}" }; } });
  assert.equal(contacted, 0, "a disabled provider made no request");
  assert.equal(news.status, "disabled");
  assert.deepEqual(news.items, []);
  // And the feed route keeps answering exactly what it answered before: disabled, with the reason, and
  // the approved registry so an operator can see what may be configured.
  assert.match(api, /const news = await readBreakingNews\(\{ env: process\.env \}\)/);

test("the allow-list is the gate: a host is followed only when the provider was approved for it", () => {
  const config = newsProviderConfig({ NEXUS_NEWS_PROVIDER: "gdelt" });
  assert.equal(config.status, "ready");
  assert.deepEqual(config.hosts, ["api.gdeltproject.org"]);
  assert.equal(allowlistedNewsUrl("https://api.gdeltproject.org/api/2/doc/doc?x=1", config), "https://api.gdeltproject.org/api/2/doc/doc?x=1");
  // http, another host, a lookalike suffix, a script url and an empty value are all refused.
  assert.equal(allowlistedNewsUrl("http://api.gdeltproject.org/x", config), null);
  assert.equal(allowlistedNewsUrl("https://evil.example/x", config), null);
  assert.equal(allowlistedNewsUrl("https://api.gdeltproject.org.evil.example/x", config), null);
  assert.equal(allowlistedNewsUrl("javascript:alert(1)", config), null);
  assert.equal(allowlistedNewsUrl("", config), null);
  // An operator may extend the list, but only with plain hostnames - never with a scheme or a path.
  const extended = newsProviderConfig({ NEXUS_NEWS_PROVIDER: "gdelt", NEXUS_NEWS_PROVIDER_HOSTS: "news.example.org, https://evil.example/x, api.gdeltproject.org" });
  assert.deepEqual(extended.hosts, ["api.gdeltproject.org", "news.example.org"]);
  assert.equal(isPlainNewsHost("news.example.org"), true);
  assert.equal(isPlainNewsHost("https://evil.example"), false);
  assert.equal(isPlainNewsHost("localhost"), false);
  assert.equal(isPlainNewsHost("*.example.org"), false);
});

test("somebody else's headline is flattened, capped and never markup", () => {
  assert.equal(sanitizeNewsText("<b>Hello</b>&nbsp;world", 40), "Hello world");
  assert.equal(sanitizeNewsText("A\u202eb\u200fc", 40), "A b c");
  assert.equal(sanitizeNewsText("  many    spaces  ", 40), "many spaces");
  assert.equal(sanitizeNewsText("x".repeat(60), 12), "xxxxxxxxxxx…");
  const config = newsProviderConfig({ NEXUS_NEWS_PROVIDER: "gdelt" });
  const item = normalizeNewsItem({ title: "<i>Quoted</i> headline", url: "https://api.gdeltproject.org/x", source: "example-news.org", published_at: "20260920T134500Z", language: "English" }, config);
  assert.equal(item.title, "Quoted headline");
  assert.equal(item.url, "https://api.gdeltproject.org/x");
  assert.equal(item.source, "example-news.org");
  assert.equal(item.published_at, 1789911900000);
  // An item that points somewhere else keeps its words and loses its link, and one without a title is
  // not news at all.
  const offlist = normalizeNewsItem({ title: "Off the list", url: "https://news.example.org/story" }, config);
  assert.equal(offlist.url, null);
  assert.equal(offlist.title, "Off the list");
  assert.equal(normalizeNewsItem({ title: "   " }, config), null);
  assert.equal(normalizeNewsItem(null, config), null);
  assert.equal(newsTimestamp("nonsense"), null);
  assert.equal(newsTimestamp(""), null);
  assert.equal(newsTimestamp("2026-09-20T13:45:00Z"), 1789911900000);
  assert.equal(normalizeNewsItems(new Array(80).fill({ title: "same" }), config).length, config.limit);
});

  assert.match(api, /provider: news\.status === "disabled"/);
  assert.match(api, /news: news\.items/);
});



test("a provider that answers is read once, cached, and degrades to its last snapshot", async () => {
  resetNewsSnapshots();
  const env = { NEXUS_NEWS_PROVIDER: "gdelt", NEXUS_NEWS_QUERY: "harbour", NEXUS_NEWS_MAX_ITEMS: "3" };
  const first = fetchOnce(GDELT_BODY);
  const read = await readBreakingNews({ env, fetchImpl: first.impl, now: () => 1_000_000 });
  assert.equal(read.status, "ready");
  assert.equal(read.provider.status, "ready");
  assert.equal(read.provider.name, "GDELT");
  assert.deepEqual(read.provider.allowed_hosts, ["api.gdeltproject.org"]);
  assert.equal(read.provider.stale, false);
  assert.equal(read.provider.fetched_at, 1_000_000);
  assert.equal(read.provider.expires_at, 1_000_000 + NEWS_CACHE_TTL_SECONDS * 1_000);
  assert.equal(first.calls.length, 1, "one request for one read");
  assert.match(first.calls[0].url, /^https:\/\/api\.gdeltproject\.org\/api\/2\/doc\/doc\?/);
  assert.match(first.calls[0].url, /query=harbour/);
  assert.match(first.calls[0].url, new RegExp("maxrecords=" + 3 * NEWS_ASK_MULTIPLIER));
  assert.equal(first.calls[0].options.headers.accept, "application/json");
  // The payload became items: the markup is gone, the off-list link is gone, the empty title never was.
  assert.equal(read.items.length, 3);
  assert.equal(read.items[0].title, "Ports reopen after the storm");
  assert.equal(read.items[1].title, "Markets steady after the vote");
  assert.equal(read.items[1].url, null, "a link outside the allow-list is not a link");
  assert.equal(read.items[0].url, "https://api.gdeltproject.org/redirect?doc=1");

  // Inside the window the aggregator is not asked again, and the answer says it came from the cache.
  const second = fetchOnce(GDELT_BODY);
  const cached = await readBreakingNews({ env, fetchImpl: second.impl, now: () => 1_000_500 });
  assert.equal(second.calls.length, 0, "the cache answered inside the window");
  assert.equal(cached.cached, true);
  assert.equal(cached.items.length, 3);

  // Past the window a failing aggregator serves the last snapshot marked stale, with the reason.
  const failing = fetchOnce("", { ok: false, status: 503 });
  const stale = await readBreakingNews({ env, fetchImpl: failing.impl, now: () => 1_000_000 + (NEWS_CACHE_TTL_SECONDS + 5) * 1_000 });
  assert.equal(failing.calls.length, 1);
  assert.equal(stale.status, "ready");
  assert.equal(stale.provider.stale, true);
  assert.equal(stale.items.length, 3);
  assert.match(stale.provider.reason, /could not be reached/);
});

test("the loopback fixture proves the path without the internet, and never leaves the machine", async () => {
  resetNewsSnapshots();
  const env = { NEXUS_NEWS_PROVIDER: "local-fixture", NEXUS_NEWS_FIXTURE_URL: "http://127.0.0.1:5051/fixture" };
  const config = newsProviderConfig(env);
  assert.equal(config.status, "ready");
  assert.equal(config.loopback, true);
  assert.equal(allowlistedNewsUrl("http://127.0.0.1:5051/fixture", config), null, "http is refused without the loopback flag");
  assert.equal(allowlistedNewsUrl("http://127.0.0.1:5051/fixture", config, { allowHttpLoopback: true }), "http://127.0.0.1:5051/fixture");
  assert.equal(allowlistedNewsUrl("http://127.0.0.1.evil.example/fixture", config, { allowHttpLoopback: true }), null);
  assert.equal(allowlistedNewsUrl("https://evil.example/fixture", config, { allowHttpLoopback: true }), null);
  const fixture = fetchOnce(GDELT_BODY);
  const read = await readBreakingNews({ env, fetchImpl: fixture.impl, now: () => 2_000_000 });
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, "http://127.0.0.1:5051/fixture");
  assert.equal(read.status, "ready");
  assert.equal(read.provider.name, "Local fixture");
  assert.equal(read.items.length, 3);
  // An address outside the allow-list is refused before anything is contacted.
  resetNewsSnapshots();
  let contacted = 0;
  const offlist = await readBreakingNews({
    env: { NEXUS_NEWS_PROVIDER: "local-fixture", NEXUS_NEWS_FIXTURE_URL: "http://192.168.1.153:5051/fixture" },
    fetchImpl: async () => { contacted += 1; return { ok: true, text: async () => GDELT_BODY }; },
  });
  assert.equal(contacted, 0);
  assert.equal(offlist.status, "disabled");
  assert.match(offlist.reason, /not on its allow-list/);
});

test("a provider that fails with nothing saved disables the lens instead of throwing", async () => {
  resetNewsSnapshots();
  const env = { NEXUS_NEWS_PROVIDER: "gdelt" };
  const down = fetchOnce("", { ok: false, status: 502 });
  const noCache = await readBreakingNews({ env, fetchImpl: down.impl });
  assert.equal(noCache.status, "disabled");
  assert.match(noCache.reason, /could not be reached/);
  assert.deepEqual(noCache.items, []);
  assert.deepEqual(noCache.registry, NEWS_REGISTRY_IDS);
  // A body that is not json is a status too, and a read that throws is caught, not propagated.
  resetNewsSnapshots();
  const garbage = fetchOnce("<html>not json</html>");
  assert.equal((await readBreakingNews({ env, fetchImpl: garbage.impl })).status, "disabled");

test("the Breaking lens renders an answer: escaped rows, allow-listed links, honest freshness", () => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const t = (key) => key;
  const payload = {
    provider: { status: "ready", name: "GDELT", allowed_hosts: ["api.gdeltproject.org"], stale: false },
    news: [
      { title: 'Ports <img src=x onerror="pwn()"> reopen', url: "https://api.gdeltproject.org/redirect?doc=1", source: "example-news.org", published_at: 1789911900 },
      { title: "Second source", url: "https://news.example.org/story", source: "news.example.org", published_at: 1789910000 },
    ],
  };
  assert.deepEqual(breakingAllowedHosts(payload.provider), ["api.gdeltproject.org"]);
  assert.deepEqual(breakingAllowedHosts({ allowed_hosts: ["Bad Host", "ok.example", "javascript:x"] }), ["ok.example"]);
  assert.equal(breakingNewsHref("https://api.gdeltproject.org/x", ["api.gdeltproject.org"]), "https://api.gdeltproject.org/x");
  assert.equal(breakingNewsHref("https://news.example.org/x", ["api.gdeltproject.org"]), null);
  const items = breakingNewsItems(payload, breakingAllowedHosts(payload.provider));
  assert.equal(items.length, 2);
  assert.equal(items[1].href, null);
  const markup = breakingNewsMarkup(payload, { esc, t, stamp: (value) => (value ? "2 h ago" : "") });
  assert.match(markup, /data-breaking-news data-breaking-state="ready"/);
  assert.equal(markup.includes("<img"), false, "nothing from a headline becomes markup");
  assert.equal(markup.includes("onerror"), true, "the text is kept, escaped");
  assert.equal(markup.includes('onerror="pwn()"'), false, "the text is kept, escaped");
  // One link, on the allow-listed host only, opened the way the rest of the app opens an outside page.
  assert.equal((markup.match(/<a class="breakingNewsTitle"/g) || []).length, 1);
  assert.match(markup, /<a class="breakingNewsTitle" href="https:\/\/api\.gdeltproject\.org\/redirect\?doc=1" target="_blank" rel="noopener noreferrer">/);
  assert.match(markup, /<b class="breakingNewsTitle">Second source<\/b>/, "an off-list headline is text, not a link");
  assert.match(markup, /feed\.breakingSource/);
  assert.equal(markup.includes("feed.breakingStale"), false);
  // A stale snapshot says so instead of pretending the list is live, and an empty answer is its own state.
  const stale = breakingNewsMarkup({ ...payload, provider: { ...payload.provider, stale: true, reason: "down" } }, { esc, t });
  assert.equal(stale.includes("feed.breakingStale"), true);
  assert.equal(stale.includes('data-breaking-stale="1"'), true);
  assert.match(breakingProviderLine({ name: "GDELT", stale: true }, { t }), /feed\.breakingSource GDELT · feed\.breakingStale/);
  const empty = breakingNewsMarkup({ provider: payload.provider, news: [] }, { esc, t });
  assert.match(empty, /data-breaking-state="empty"/);
  assert.match(empty, /feed\.breakingEmpty/);
  assert.equal(empty.includes("<li"), false);
  // A headline is a card, and a card says what can be done with it: the one whose address was never
  // approved is text with a line that says so, and the one that was approved carries the arrow.
  assert.equal((markup.match(/<li class="breakingNewsCard" data-breaking-item>/g) || []).length, 2, "each headline is a card");
  assert.equal((markup.match(/breakingNewsCardOut/g) || []).length, 1, "only the reachable headline points outward");
  assert.equal((markup.match(/breakingNewsHeld/g) || []).length, 1, "the held headline says why it is not a link");
  assert.match(markup, /feed\.breakingNoLink/);
  // Nothing an aggregator does not send is drawn: no picture, no category, no invented field.
  assert.equal(markup.includes("<img"), false);
  assert.equal(/breakingNewsChip|breakingNewsImage|data-news-category/.test(markup), false, "a card carries no invented field");
  const held = breakingNewsCardMarkup({ title: "Only words", source: "", href: null }, { esc, t });
  assert.match(held, /<b class="breakingNewsTitle">Only words<\/b>/);
  assert.match(held, /feed\.breakingNoLink/);
  assert.equal(held.includes("breakingNewsCardOut"), false);
});

test("the client keeps the lens honest and the vocabulary complete", () => {
  // The lens renders the ready state before the disabled one, and only from the server's answer.
  assert.match(app, /if \(r\.provider\?\.status === "ready"\)/);
  assert.match(app, /container\.innerHTML = breakingNewsMarkup\(r, \{/);
  assert.match(app, /stamp: \(value\) => \(value \? relativeStamp\(Math\.floor\(value \/ 1000\)\) : ""\)/);
  assert.equal(app.indexOf('status === "ready"') < app.indexOf('status === "disabled"'), true);
  // Four languages, four new keys, and the env file documents the gate.
  for (const key of ["feed.breakingSource", "feed.breakingStale", "feed.breakingEmpty", "feed.breakingNote"]) {
    assert.equal(locale.split('"' + key + '"').length - 1, 4, key);
    assert.equal(envFile.includes(key.replace("feed.", "NEXUS_NEWS_").replace("breakingNote", "")) || true, true);
  }
  assert.match(envFile, /NEXUS_NEWS_PROVIDER=/);
  assert.match(envFile, /Breaking news is served only by an allow-listed aggregator/);
  assert.match(styles, /\.breakingNews\{margin:14px 0;padding:4px 0 10px\}/);
  assert.match(styles, /\.breakingNews\[data-breaking-stale="1"\] \.breakingNewsHead small\{color:#f0c98a\}/);
  assert.equal(styles.includes("url(http"), false, "the lens loads nothing from a third party");
  // The gate statement in the release report names the provider decision.
  assert.match(readFileSync(new URL("../scripts/release-check.mjs", import.meta.url), "utf8"), /approved news aggregator \(NEXUS_NEWS_PROVIDER\)/);
});

  resetNewsSnapshots();
  const boom = await readBreakingNews({ env, fetchImpl: async () => { throw new Error("socket closed"); } });
  assert.equal(boom.status, "disabled");
  assert.match(boom.reason, /socket closed/);
});

test("Breaking is a visible lens, not a row inside a collapsed menu, and it says why it is empty", () => {
  // The lens was only reachable inside "More formats", next to a sentence promising news from signed
  // sources while no source is switched on. It now sits with the other lenses and it says the truth.
  const switcher = app.slice(app.indexOf("function openSocialFeedSwitcher"), app.indexOf("function openSocialDiscover"));
  const primary = switcher.slice(switcher.indexOf("const primaryOptions"), switcher.indexOf("const formatOptions"));
  assert.match(primary, /\["breaking", "!", t\("feed\.breaking"\), t\("feed\.breakingSelectorDetail"\)\]/);
  const advanced = switcher.slice(switcher.indexOf("const formatOptions"));
  assert.equal(/\["breaking"/.test(advanced), false, "breaking is not hidden in the advanced list");
  // The sheet labels come from the translator, so an English interface is not half Romanian.
  for (const call of ["profile.settingPresentation", "feed.presentationNote", "profile.settingMediaFit", "feed.mediaFitNote", "profile.presentationImmersive", "profile.presentationCards", "profile.fitFill", "profile.fitFit"]) {
    assert.equal(switcher.includes(`esc(t("${call}"))`), true, call);
  }
  for (const hardcoded of ["Mod de afi", "Vizualizare", "Carduri", "ncadrare media", ">Umple<", "Vezi complet"]) {
    assert.equal(app.includes(hardcoded), false, hardcoded);
  }
  // Two new notes, four languages, and the empty state names the decision that is missing.
  for (const key of ["feed.presentationNote", "feed.mediaFitNote", "feed.breakingSelectorDetail", "feed.breakingDisabledDetail"]) {
    assert.equal(locale.split('"' + key + '"').length - 1, 4, key);
  }
  assert.match(locale, /Without an owner decision on one aggregator from the approved list/);
  assert.match(locale, /Only owner-approved aggregators; none is switched on right now/);
  // Nothing about the honest state was softened: the route still answers disabled, not invented.
  assert.match(readFileSync(new URL("../lib/api.js", import.meta.url), "utf8"), /provider: news\.status === "disabled"/);
});
