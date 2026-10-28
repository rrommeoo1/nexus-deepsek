/* global __dirname */
/**
 * Round 31 (31 October 2026): the theme is no longer one file.
 *
 * `theme/social.ts` reads `theme/blackSilver.ts` (the palette) and `theme/mercury.ts`; `mercury` reads the
 * palette too. Every test that loads `social.ts` as a module therefore has to hand its `require` shim the
 * same two modules the app loads. This helper does that once, so no suite has to re-implement the graph —
 * and so a later split of the theme cannot silently break them all.
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const cache = new Map();

function loadThemeModule(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(resolve(ROOT, `src/theme/${name}.ts`), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const shim = { exports: {} };
  /** `editorial.ts` is the only theme that asks React Native for anything (a font stack). */
  const requireShim = (request) => {
    if (request === 'react-native') {
      return { Platform: { select: (options) => options.android ?? options.default } };
    }
    const match = request.match(/^\.\/([\w-]+)$/);
    if (!match) return {};
    return loadThemeModule(match[1]);
  };
  new Function('exports', 'require', 'module', compiled)(shim.exports, requireShim, shim);
  cache.set(name, shim.exports);
  return shim.exports;
}

/** The two modules `social.ts` imports, ready to be handed to a test's own `require` shim. */
function socialThemeOverrides() {
  return { './blackSilver': loadThemeModule('blackSilver'), './mercury': loadThemeModule('mercury') };
}

module.exports = { loadThemeModule, socialThemeOverrides };
