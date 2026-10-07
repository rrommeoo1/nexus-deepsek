// Generează fișierul central de tokens al aplicației native, direct din variabilele CSS extrase din web.
// Nicio valoare nu este estimată: fiecare linie vine din docs/web-ref/_tokens/css-variables.json.
//   node tools/web-ref/make-native-tokens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, REPO } from './harness.mjs';

const src = JSON.parse(fs.readFileSync(path.join(OUT, '_tokens', 'css-variables.json'), 'utf8'));
const rootEntries = Object.entries(src).filter(([key]) => key.startsWith(':root '));
if (rootEntries.length < 20) throw new Error('too few :root variables: ' + rootEntries.length);

const camel = (name) => name.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const groups = new Map();
for (const [key, info] of rootEntries) {
  const name = key.replace(/^:root /, '');
  const group = name.startsWith('--nx67-') ? 'nx67' : name.startsWith('--nx-') ? 'nx' : 'core';
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ name, value: info.value, file: info.file });
}
for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));

const lines = [];
lines.push('/**');
lines.push(' * Tokens de design extrase 1:1 din CSS-ul web — nu un sistem nou, nu valori estimate.');
lines.push(' *');
lines.push(' * Sursă: docs/web-ref/_tokens/css-variables.json, generat cu tools/web-ref/extract-tokens.mjs din');
lines.push(' * apps/nexus-web/public/*.css la viewport-ul telefonului (469x1021 CSS px, DPR 2.6).');
lines.push(' * Regenerare: node tools/web-ref/make-native-tokens.mjs');
lines.push(' *');
lines.push(' * `webCssVariables` păstrează numele originale (`--nx-cyan`), iar `webTokens` le dă nume de');
lines.push(' * identificator pentru cod. Ambele liste conțin exact valorile web.');
lines.push(' */');
lines.push('');
lines.push('export const webCssVariables = {');
for (const [group, list] of groups) {
  lines.push('  // ' + group + ' — ' + [...new Set(list.map((i) => i.file))].join(', '));
  for (const item of list) lines.push("  '" + item.name + "': '" + item.value.replace(/'/g, "\\'") + "',");
}
lines.push('} as const;');
lines.push('');
lines.push('export const webTokens = {');
lines.push('  colors: {');
for (const [group, list] of groups) {
  for (const item of list) lines.push('    ' + camel(item.name) + ": '" + item.value.replace(/'/g, "\\'") + "',");
}
lines.push('  },');
lines.push('} as const;');
lines.push('');
lines.push('export type WebTokenName = keyof typeof webCssVariables;');
lines.push('');

const target = path.join(REPO, 'apps', 'nexus-mobile', 'src', 'theme', 'webTokens.ts');
fs.writeFileSync(target, lines.join('\n'), 'utf8');
console.log('wrote', path.relative(REPO, target).replace(/\\/g, '/'), rootEntries.length, 'variables in', groups.size, 'groups');
