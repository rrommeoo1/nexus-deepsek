// Owner-requested, interactive LAN workspace. Not an unbounded actor simulation.
import { existsSync, readFileSync, realpathSync, readdirSync, statSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console } from 'node:console';
import { Writable } from 'node:stream';

export function workspaceEnvironment(source, dir, config) {
  if (source.NODE_ENV === 'production') throw new Error('WORKSPACE_PRODUCTION_FORBIDDEN');
  if (config.classification !== 'SYSTEM_TEST' || !/^[a-f0-9]{64}$/.test(config.sessionSecret)) throw new Error('WORKSPACE_CONFIG_INVALID');
  const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA'].filter(key => source[key]).map(key => [key, source[key]]));
  return Object.assign(env, { NODE_ENV: 'development', NEXUS_ENV_FILE: '', NEXUS_DATA_DIR: dir,
    NEXUS_SESSION_SECRET: config.sessionSecret, PORT: '3100', HTTPS_PORT: '3543', HOST: '0.0.0.0',
    NEXUS_WC_PROJECT_ID: '', NEXUS_INCREMENTAL_COST_LIMIT: '0' });
}

export function appendBoundedLog(path, chunk, limit = 1024 * 1024) {
  const data = Buffer.from(chunk);
  const tail = data.subarray(Math.max(0, data.length - limit));
  // Only this operational log is truncated. Database, uploads and credentials are never deleted.
  if (existsSync(path) && statSync(path).size + tail.length > limit) writeFileSync(path, '', { mode: 0o600 });
  appendFileSync(path, tail, { mode: 0o600 });
}

export function workspaceDiskBytes(folder) {
  return readdirSync(folder, { withFileTypes: true }).reduce((total, item) => total + (item.isSymbolicLink() ? Infinity : item.isDirectory() ? workspaceDiskBytes(join(folder, item.name)) : statSync(join(folder, item.name)).size), 0);
}

export async function startWorkspace() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const dir = join(root, 'test-labs', 'messenger');
  if (!existsSync(dir) || realpathSync(dir) !== join(realpathSync(root), 'test-labs', 'messenger')) throw new Error('WORKSPACE_PATH_INVALID');
  for (const name of ['lab.json', 'nexus.sqlite']) {
    if (!existsSync(join(dir, name)) || realpathSync(join(dir, name)) !== join(realpathSync(dir), name)) throw new Error('WORKSPACE_EXISTING_DATA_REQUIRED');
  }
  const config = JSON.parse(readFileSync(join(dir, 'lab.json'), 'utf8'));
  const env = workspaceEnvironment(process.env, dir, config);
  // Keep provider/billing/production credentials out, including an inherited .env path.
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const logfile = join(dir, 'workspace.log');
  if (existsSync(logfile) && realpathSync(logfile) !== join(realpathSync(dir), 'workspace.log')) throw new Error('WORKSPACE_LOG_PATH_INVALID');
  const output = new Writable({ write(chunk, encoding, done) { try { appendBoundedLog(logfile, chunk); done(); } catch (error) { done(error); } } });
  globalThis.console = new Console({ stdout: output, stderr: output });
  output.on('error', () => process.exit(1));
  const guard = () => {
    try {
      if (workspaceDiskBytes(dir) <= 256 * 1024 * 1024) return;
      console.error('WORKSPACE_DISK_LIMIT: 256 MiB exceeded; data retained. Review storage before restart.');
    } catch { console.error('WORKSPACE_STORAGE_UNAVAILABLE'); }
    process.exit(1);
  };
  guard();
  setInterval(guard, 30000).unref();
  console.log(JSON.stringify({ event: 'workspace_start', at: new Date().toISOString(), pid: process.pid, http_port: 3100, https_port: 3543, automatic_seed: false, runtime_limit: null, max_disk_mb: 256, incremental_cost: 0 }));
  // Same process: stopping the scheduled task cannot leave an orphan server child.
  // No seed, password reset, account conversion or session-secret regeneration.
  await import('../server.js');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startWorkspace().catch(error => { console.error(error?.code || error?.message || 'WORKSPACE_START_FAILED'); process.exitCode = 1; });
}
