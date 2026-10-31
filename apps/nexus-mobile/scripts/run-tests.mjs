/**
 * Round 42: run every suite of `package.json` → `scripts.test` in one process, fast.
 *
 * The chain is a `&&` string, and running it through three shells made a two-minute check cost four and
 * print nothing when it succeeded. This walks the same list with `spawnSync`, prints one line per suite
 * and a summary, and exits nonzero on the first failure. It is a developer's meter, not a product file.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const chain = pkg.scripts.test.split(' && ').map((step) => step.trim()).filter(Boolean);
let failed = 0;
const started = Date.now();
for (const step of chain) {
  const [command, ...args] = step.split(' ');
  const run = spawnSync(command, args, { encoding: 'utf8', shell: false });
  const ok = run.status === 0;
  if (!ok) {
    failed += 1;
    console.log(`FAIL ${step}`);
    console.log((run.stdout || '').split('\n').slice(-14).join('\n'));
    console.log((run.stderr || '').split('\n').slice(-14).join('\n'));
  }
}
console.log(`suites=${chain.length} failed=${failed} in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failed === 0 ? 0 : 1);
