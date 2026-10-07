// Extrage design tokens din CSS-ul web (fara browser): variabile CSS, fonturi, raze, umbre.
// Usage: node tools/web-ref/extract-tokens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, mkdir, saveJson, __dirname } from './harness.mjs';

const CSS_DIR = path.resolve(__dirname, '..', '..', 'apps', 'nexus-web', 'public');
const files = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).sort();
const vars = {};
const fonts = {};
const radii = {};
const shadows = {};
const animations = {};
const transitions = {};
const summary = [];

for (const file of files) {
  const css = fs.readFileSync(path.join(CSS_DIR, file), 'utf8');
  summary.push({ file, bytes: css.length, vars: (css.match(/--[a-z0-9-]+\s*:/gi) || []).length });
  // selector { ... } blocks that declare custom properties
  const blocks = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  for (const block of blocks) {
    const sel = block.slice(0, block.indexOf('{')).trim().replace(/\s+/g, ' ');
    const body = block.slice(block.indexOf('{') + 1, -1);
    for (const decl of body.split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      const value = decl.slice(i + 1).trim();
      if (!value) continue;
      if (prop.startsWith('--')) {
        const key = sel + ' ' + prop;
        if (!(key in vars)) vars[key] = { file, selector: sel, value };
      }
    }
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    fonts[v] = (fonts[v] || 0) + 1;
  }
  for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    radii[v] = (radii[v] || 0) + 1;
  }
  for (const m of css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    shadows[v] = (shadows[v] || 0) + 1;
  }
  for (const m of css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/g)) {
    animations[m[1]] = (animations[m[1]] || 0) + 1;
  }
  for (const m of css.matchAll(/animation\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    animations['anim:' + v] = (animations['anim:' + v] || 0) + 1;
  }
  for (const m of css.matchAll(/transition\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    transitions[v] = (transitions[v] || 0) + 1;
  }
}

const top = (obj, n = 120) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
const dir = mkdir(path.join(OUT, '_tokens'));
saveJson(path.join(dir, 'css-variables.json'), vars);
saveJson(path.join(dir, 'css-files.json'), summary);
saveJson(path.join(dir, 'fonts.json'), top(fonts, 60));
saveJson(path.join(dir, 'radii.json'), top(radii, 80));
saveJson(path.join(dir, 'shadows.json'), top(shadows, 80));
saveJson(path.join(dir, 'animations.json'), top(animations, 120));
saveJson(path.join(dir, 'transitions.json'), top(transitions, 120));
console.log('css files:', files.length);
console.log('variables:', Object.keys(vars).length);
console.log('fonts:', Object.keys(fonts).length, '| radii:', Object.keys(radii).length, '| shadows:', Object.keys(shadows).length, '| animations:', Object.keys(animations).length, '| transitions:', Object.keys(transitions).length);
console.log(summary.map((s) => s.file + '(' + s.vars + ' vars)').join(', '));
