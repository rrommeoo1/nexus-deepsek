#!/usr/bin/env node
// Prints what a `uiautomator dump` actually says: every visible text, every accessible name and its
// bounds. This is how a screen is verified without looking at a picture (`docs/DEV-WORKFLOW.md`).
//
// Usage: node tools/ui-texts.mjs <ui.xml> [filter]
//   filter — optional substring; only lines containing it are printed.
import { readFileSync } from 'node:fs';

const [, , file, filter = ''] = process.argv;
if (!file) {
  console.error('usage: node tools/ui-texts.mjs <ui.xml> [filter]');
  process.exit(2);
}

const xml = readFileSync(file, 'utf8');
const node = /<node\b[^>]*>/g;
let match;
let printed = 0;

while ((match = node.exec(xml)) !== null) {
  const attributes = match[0];
  const value = (name) => {
    const found = new RegExp(`${name}="([^"]*)"`).exec(attributes);
    return found ? found[1] : '';
  };
  const text = value('text');
  const label = value('content-desc');
  const bounds = value('bounds');
  const cls = value('class').replace('android.widget.', '').replace('android.view.', '');
  const extra = [value('clickable') === 'true' ? 'clickable' : '', value('checked') === 'true' ? 'checked' : '',
    value('selected') === 'true' ? 'selected' : '', value('enabled') === 'false' ? 'disabled' : '']
    .filter(Boolean).join(' ');
  if (!text && !label) continue;
  const line = `${cls || 'node'}  text="${text}"  label="${label}"  @${bounds}${extra ? '  ' + extra : ''}`;
  if (filter && !line.toLowerCase().includes(filter.toLowerCase())) continue;
  console.log(line);
  printed += 1;
}

console.log(`\n${printed} labelled node(s) in ${file}`);
