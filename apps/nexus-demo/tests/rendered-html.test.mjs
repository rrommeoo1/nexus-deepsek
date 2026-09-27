import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Nexus interactive demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Nexus .* One life, many profiles<\/title>/i);
  assert.match(html, /NEXUS/);
  assert.match(html, /Pulse/);
  assert.match(html, /For You/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the reference-inspired responsive modules and zero-fund disclosure", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const moduleName of ["Pulse", "Profiles", "Market", "Messages", "Creator", "Privé", "Nexus Pay", "Dating", "Watch", "Kids", "Signal", "Work", "Stay", "Ride", "Beauty", "Music", "Wellbeing", "Node Network"]) {
    assert.match(page, new RegExp(moduleName));
  }
  assert.match(page, /0 real funds/i);
  assert.match(page, /Demo support receipt/i);
  assert.doesNotMatch(page, /Feature comparison|Feature parity|Build map/);
  assert.match(page, /Create in Social/);
  assert.match(page, /Create a market listing/);
  assert.match(page, /social:\[\["primary","◫","Pulse"\],\["inbox","◌","Messages"\],\["create","＋","Create"\],\["utility","◉","Live"\],\["switch","◎","Switch"\]\]/);
  assert.match(page, /work:\[\["primary","▤","Feed"\].*\["utility","▣","Jobs"\]/);
  assert.match(page, /dating:\[\["primary","♥","Discover"\].*\["utility","✦","Connections"\]/);
  assert.match(page, /Messages stay second in every profile/);
  assert.match(page, /Private discovery/);
  assert.match(page, /Public professional/);
  assert.match(page, /five isolated profiles/);
  assert.match(page, /cross-mode contact needs consent/);
  assert.match(page, /"All modes","Social","Work","Dating","Travel","Market"/);
  assert.match(page, /chatMode/);
  assert.match(page, /failed|nothing published/i);
  assert.match(page, /type="file"/);
  assert.match(page, /Open camera/);
  assert.match(page, /Choose media/);
  assert.match(page, /"Near","For You","Global","Breaking"/);
  assert.match(page, /"Like".*"Haha".*"Useful".*"Sad".*"Angry".*"Fake\?".*"Not for me"/);
  assert.match(page, /Video call/);
  assert.match(page, /Schedule meeting/);
  assert.match(page, /Free discovery and paid posts/);
  assert.doesNotMatch(page, /TikTok|OLX|WhatsApp|Tinder|Bumble|YouTube|LinkedIn|Airbnb|Bolt|Fresha|Spotify/);
  assert.match(css, /demo-creator-v2\.webp/);
  assert.match(css, /demo-market-v2\.webp/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.showcaseHeader,.moduleRail,.infoPanel,.showcaseFooter\{display:none\}/);
  assert.match(layout, /openGraph/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps accessibility semantics and synthetic-state disclosure persistent", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const pixelFonts = [...css.matchAll(/font-size:([0-9.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(pixelFonts.length > 0);
  assert.ok(pixelFonts.every((size) => size >= 12), `font below 12px: ${Math.min(...pixelFonts)}`);
  assert.match(page, /role="dialog" aria-modal="true"/);
  assert.ok((page.match(/role="dialog"/g) ?? []).length >= 4);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tab" aria-selected=/);
  assert.match(page, /aria-pressed=/);
  assert.match(page, /event\.key==="Escape"/);
  assert.match(page, /trapDialogFocus/);
  assert.match(page, /useFocusReturn/);
  assert.match(page, /aria-label="Close composer"/);
  assert.match(page, /aria-label="Close module launcher"/);
  assert.match(page, /aria-label="Close demo support"/);
  assert.match(page, /LOCAL INTERACTIVE DEMO · SYNTHETIC DATA · NO PROVIDERS · 0 REAL FUNDS/);
  assert.match(page, /DEMO · SYNTHETIC · 0 FUNDS/);
  assert.doesNotMatch(page, /ON-CHAIN<br\/><b>CONFIRMED/);
  assert.doesNotMatch(page, /Identity checked|Host verified|Escrow funded|✓ Verified|Identity\s+verified/);
  assert.doesNotMatch(page, /(?<!Demo )Trust Lens/);
  assert.match(page, /Demo balances · 0 real funds/);
  assert.match(page, /Demo seller · Demo escrow/);
  assert.match(page, /Demo identity status/);
  assert.match(css, /@media\(max-width:760px\).*\.demoRibbon/s);
});
