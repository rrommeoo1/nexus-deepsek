import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspaceEnvironment, appendBoundedLog, workspaceDiskBytes } from '../scripts/messenger-workspace.mjs';
import { labRuntimeSeconds } from '../scripts/messenger-lab-runtime.mjs';

test('persistent human workspace keeps isolated credentials/ports and excludes inherited providers', () => {
  const secret = 'a'.repeat(64);
  const env = workspaceEnvironment({ PATH: 'node', NEXUS_ENV_FILE: 'production.env', BILLING_SECRET: 'do-not-inherit', NEXUS_WC_PROJECT_ID: 'external', PORT: '3000' }, 'isolated-data', { classification: 'SYSTEM_TEST', sessionSecret: secret });
  assert.equal(env.PORT, '3100'); assert.equal(env.HTTPS_PORT, '3543'); assert.equal(env.HOST, '0.0.0.0');
  assert.equal(env.NEXUS_SESSION_SECRET, secret); assert.equal(env.NEXUS_DATA_DIR, 'isolated-data');
  assert.equal(env.NEXUS_ENV_FILE, ''); assert.equal(env.NEXUS_WC_PROJECT_ID, ''); assert.equal(env.BILLING_SECRET, undefined);
  assert.equal(env.NEXUS_INCREMENTAL_COST_LIMIT, '0');
  assert.throws(() => workspaceEnvironment({ NODE_ENV: 'production' }, '', {}), /PRODUCTION_FORBIDDEN/);
  assert.throws(() => workspaceEnvironment({}, '', { classification: 'HUMAN', sessionSecret: secret }), /CONFIG_INVALID/);
  assert.throws(() => workspaceEnvironment({}, '', { classification: 'SYSTEM_TEST', sessionSecret: '' }), /CONFIG_INVALID/);
  // Automation/synthetic tests remain bounded; only the explicit human server has no deadline.
  assert.equal(labRuntimeSeconds(['--serve']), 600);
  assert.throws(() => labRuntimeSeconds(['--runtime-seconds=0']), /LAB_RUNTIME_INVALID/);
});

test('operational log stays bounded and storage accounting includes nested data without deleting it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-workspace-test-'));
  try {
    const log = join(dir, 'workspace.log'), db = join(dir, 'existing.sqlite');
    writeFileSync(db, 'untouched');
    appendBoundedLog(log, 'first', 10); appendBoundedLog(log, 'second', 10);
    assert.equal(readFileSync(log, 'utf8'), 'second');
    appendBoundedLog(log, '0123456789abcdef', 10);
    assert.equal(readFileSync(log, 'utf8'), '6789abcdef');
    assert.equal(readFileSync(db, 'utf8'), 'untouched'); assert.equal(workspaceDiskBytes(dir), 19);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
