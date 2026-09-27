import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import {
  applyInterfaceLocale,
  createInterfaceTranslator,
  interfaceLocaleCoverage,
  resolveInterfaceLocale,
  SUPPORTED_INTERFACE_LOCALES,
} from "../public/interface-locale.js";

const css = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

// Guard: every literal key the client asks for must exist in all four catalogues.
// interfaceLocaleCoverage() only compares catalogue-to-catalogue (English as the
// contract), so a key that code uses but no catalogue defines used to leak raw.
// Generated bundles are excluded; dynamic families (t("nav." + slot)) are covered
// by their own suites.
const publicDirectory = new URL("../public/", import.meta.url);
const clientSourceNames = (await readdir(publicDirectory))
  .filter((name) => name.endsWith(".js") && name !== "interface-locale.js" && !/^(?:wc-bundle|device-wallet)\.js$/.test(name));
const literalClientKeys = new Set();
for (const name of clientSourceNames) {
  const source = await readFile(new URL(name, publicDirectory), "utf8");
  for (const match of source.matchAll(/(?<![A-Za-z0-9_$.])t\(\s*["']([A-Za-z0-9._-]+)["']\s*\)/g)) literalClientKeys.add(match[1]);
}

test("every literal client key resolves in all four catalogues instead of leaking raw", () => {
  assert.ok(literalClientKeys.size > 500, `literal key scan covered only ${literalClientKeys.size} keys`);
  const leaked = [];
  for (const locale of SUPPORTED_INTERFACE_LOCALES) {
    const t = createInterfaceTranslator(locale);
    for (const key of [...literalClientKeys].sort()) if (t(key) === key) leaked.push(`${locale}:${key}`);
  }
  assert.deepEqual(leaked, []);
});

test("all four interface catalogues cover every English contract key", () => {
  assert.deepEqual(SUPPORTED_INTERFACE_LOCALES, ["ro", "en", "pl", "ar"]);
  assert.deepEqual(interfaceLocaleCoverage(), { ro: [], en: [], pl: [], ar: [] });
  const critical = [
    "nav.inbox", "profile.title", "comments.relevant", "messages.loadMore",
    "thread.decryptAttachment", "activity.markAllRead", "draft.quota",
    "upload.cancel", "live.retry", "common.close",
  ];
  for (const locale of SUPPORTED_INTERFACE_LOCALES) {
    const t = createInterfaceTranslator(locale);
    for (const key of critical) {
      const translated = t(key);
      assert.equal(typeof translated, "string", `${locale}:${key}`);
      assert.ok(translated.trim().length > 0 && translated !== key, `${locale}:${key}`);
    }
  }
});

test("explicit profile language wins, automatic language uses device and never IP", () => {
  assert.equal(resolveInterfaceLocale({ accountLocale: "pl", deviceLocales: ["ar-SA"] }), "pl");
  assert.equal(resolveInterfaceLocale({ accountLocale: "auto", deviceLocales: ["ar-EG", "en-US"] }), "ar");
  assert.equal(resolveInterfaceLocale({ accountLocale: "auto", deviceLocales: ["fr-FR", "ro-RO"] }), "ro");
  const syncSource = app.match(/function syncInterfaceLocale\(\)\s*\{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(syncSource, /navigator\.languages/);
  assert.doesNotMatch(syncSource, /geo(?:location)?|ip(?:Address)?|region/i);
});

test("RTL changes document semantics and mirrors edge interactions without corrupting identifiers", () => {
  const documentRef = { documentElement: { dataset: {} } };
  assert.deepEqual(applyInterfaceLocale(documentRef, "ar"), { locale: "ar", direction: "rtl" });
  assert.deepEqual({ lang: documentRef.documentElement.lang, dir: documentRef.documentElement.dir }, { lang: "ar", dir: "rtl" });
  assert.match(css, /html\[dir="rtl"\] \.clipQuickActions[\s\S]*?right:\s*auto\s*!important[\s\S]*?--nx-safe-left/);
  assert.match(css, /bdi\[dir="ltr"\][\s\S]*?unicode-bidi:\s*isolate/);
  assert.match(css, /html\[dir="rtl"\] \.clipCommentsDrawer \.c\.reply[\s\S]*?margin-right:\s*25px/);
  assert.match(app, /<bdi dir="ltr">@/);
});
