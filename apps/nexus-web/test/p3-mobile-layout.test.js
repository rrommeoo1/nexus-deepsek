import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("phone shell is full bleed and bounded by dynamic viewport plus safe areas", () => {
  assert.match(index, /viewport-fit=cover/);
  assert.match(css, /--nx-viewport-height:\s*100vh/);
  assert.match(css, /@supports \(height:\s*100dvh\)/);
  assert.match(css, /--nx-safe-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.match(css, /--nx-safe-right:\s*env\(safe-area-inset-right,\s*0px\)/);
  assert.match(css, /--nx-safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(css, /--nx-safe-left:\s*env\(safe-area-inset-left,\s*0px\)/);
  assert.match(css, /\.phoneScreen\s*\{[\s\S]*?border-radius:\s*0\s*!important/);
  assert.match(css, /\.phoneScreen::before,\s*\.phoneScreen::after\s*\{\s*border-radius:\s*0\s*!important/);
});

test("narrow header preserves Nexus identity and comments surrender the dock", () => {
  assert.match(css, /@media \(max-width:\s*380px\)[\s\S]*?grid-template-columns:\s*clamp\(100px,\s*30vw,\s*114px\)/);
  assert.match(css, /\.phoneScreen\.commentsModeActive \.appNav\s*\{[\s\S]*?display:\s*none\s*!important[\s\S]*?pointer-events:\s*none\s*!important/);
});

test("landscape contract keeps clips rectangular, full viewport and uncropped", () => {
  assert.match(css, /@media \(max-width:\s*960px\) and \(max-height:\s*500px\) and \(orientation:\s*landscape\)/);
  assert.match(css, /\.clipStage:fullscreen video\.media[\s\S]*?object-fit:\s*contain\s*!important/);
  assert.match(css, /\.reelViewer[\s\S]*?height:\s*var\(--nx-viewport-height\)\s*!important/);
  assert.match(css, /\.clipQuickActions,\s*\.reelViewer \.viewerActionRail[\s\S]*?var\(--nx-safe-right\)/);
});
