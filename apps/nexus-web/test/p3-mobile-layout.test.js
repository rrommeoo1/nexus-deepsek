import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");
const screenShell = await readFile(new URL("../public/screen-shell.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("phone shell is bounded by the dynamic viewport, safe areas and one rounded silhouette", () => {
  assert.match(index, /viewport-fit=cover/);
  assert.match(css, /--nx-viewport-height:\s*100vh/);
  assert.match(css, /@supports \(height:\s*100dvh\)/);
  assert.match(css, /--nx-safe-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.match(css, /--nx-safe-right:\s*env\(safe-area-inset-right,\s*0px\)/);
  assert.match(css, /--nx-safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(css, /--nx-safe-left:\s*env\(safe-area-inset-left,\s*0px\)/);
  assert.match(screenShell, /--nexus-screen-radius:\s*clamp\(20px,\s*6vw,\s*28px\)/);
  assert.match(screenShell, /clip-path:\s*inset\(var\(--nexus-screen-gutter\) round var\(--nexus-screen-radius\)\)/);
  assert.match(screenShell, /\.phone,\s*\n\s*\.phoneMetal,\s*\n\s*\.phoneScreen\s*\{[\s\S]*?overflow:\s*hidden\s*!important/);
  assert.match(screenShell, /\.phoneScreen::before,\s*\n\s*\.phoneScreen::after\s*\{[\s\S]*?border-radius:\s*inherit\s*!important/);
  assert.ok(index.indexOf("/screen-shell.css?v=20260928-round1") > index.indexOf("/profile-private-access.css"));
});

test("narrow header preserves Nexus identity and comments surrender the dock", () => {
  assert.match(css, /@media \(max-width:\s*380px\)[\s\S]*?grid-template-columns:\s*clamp\(100px,\s*30vw,\s*114px\)/);
  assert.match(css, /\.phoneScreen\.commentsModeActive \.appNav\s*\{[\s\S]*?display:\s*none\s*!important[\s\S]*?pointer-events:\s*none\s*!important/);
});

test("landscape contract keeps clips full viewport, uncropped and softly rounded", () => {
  assert.match(css, /@media \(max-width:\s*960px\) and \(max-height:\s*500px\) and \(orientation:\s*landscape\)/);
  assert.match(css, /\.clipStage:fullscreen video\.media[\s\S]*?object-fit:\s*contain\s*!important/);
  assert.match(css, /\.reelViewer[\s\S]*?height:\s*var\(--nx-viewport-height\)\s*!important/);
  assert.match(css, /\.clipQuickActions,\s*\.reelViewer \.viewerActionRail[\s\S]*?var\(--nx-safe-right\)/);
  assert.match(screenShell, /max-height:\s*500px[\s\S]*?--nexus-screen-radius:\s*18px/);
  assert.match(screenShell, /body,\s*\n\s*\.phone,[\s\S]*?\.reelViewer,[\s\S]*?border-radius:\s*var\(--nexus-screen-radius\)\s*!important/);
});

test("body-level viewers and dialogs cannot escape the rounded screen", () => {
  assert.match(screenShell, /body\s*>\s*\.mediaViewer,[\s\S]*?body\s*>\s*\.storyViewer,[\s\S]*?body\s*>\s*\[role="dialog"\][\s\S]*?overflow:\s*hidden\s*!important/);
});
