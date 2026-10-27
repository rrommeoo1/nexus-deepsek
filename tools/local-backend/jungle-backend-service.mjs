#!/usr/bin/env node
/**
 * Jungle Book local backend supervisor.
 *
 * One process that owns the API process: it starts it, keeps it alive, notices when it stops
 * answering, and stops it in a way that closes the database instead of pulling the rug out.
 *
 * Why a supervisor instead of "just a scheduled task":
 *   - a scheduled task can start a program at logon, but it cannot tell a hung server from a healthy
 *     one, and Windows' own restart-on-failure only fires when the process exits;
 *   - a console window that flashes every minute is a symptom of something restarting blindly, which
 *     is exactly what this replaces;
 *   - everything it decides is written to disk (`logs\supervisor.log`, `run\status.json`), so "is the
 *     backend up, and since when, and after how many restarts" is a file read, not a guess.
 *
 * Usage:
 *   node jungle-backend-service.mjs [--env <file>] [--port 5000] [--once]
 *
 * `--once` runs the child in the foreground for a single lifetime (used by tests and by a manual
 * `start-backend.ps1` that wants the console output on screen).
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const APP_DIR = join(REPO_ROOT, 'apps', 'nexus-web');
const NEXUS_HOME = process.env.NEXUS_HOME || 'C:\\Nexus';
const RUN_DIR = join(NEXUS_HOME, 'run');
const LOG_DIR = join(NEXUS_HOME, 'logs');

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const ENV_FILE = argValue('--env', join(NEXUS_HOME, 'env', 'jungle.env'));
const ONCE = process.argv.includes('--once');
const LOCK_FILE = join(RUN_DIR, 'supervisor.lock');
const STOP_FILE = join(RUN_DIR, 'stop.request');
const STATUS_FILE = join(RUN_DIR, 'status.json');
const SUPERVISOR_LOG = join(LOG_DIR, 'supervisor.log');

mkdirSync(RUN_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

/** KEY=VALUE lines, `#` comments, nothing else. The file is the configuration; the shell is not. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at < 1) continue;
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try { appendFileSync(SUPERVISOR_LOG, `${line}\n`); } catch { /* a full disk must not stop the server */ }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** One supervisor per machine: a second one would race for the port and confuse the status file. */
function takeLock() {
  if (existsSync(LOCK_FILE)) {
    const holder = Number(readFileSync(LOCK_FILE, 'utf8').trim() || 0);
    if (holder && holder !== process.pid && pidAlive(holder)) {
      log(`another supervisor is already running (pid ${holder}); this one exits`);
      return false;
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock() {
  try {
    if (existsSync(LOCK_FILE) && readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) rmSync(LOCK_FILE);
  } catch { /* nothing to release */ }
}

/** Log files are rotated by size rather than by time, so a crash loop cannot fill the disk. */
const MAX_LOG_BYTES = 20 * 1024 * 1024;
function openLogSink() {
  const day = new Date().toISOString().slice(0, 10);
  let path = join(LOG_DIR, `server-${day}.log`);
  try {
    if (existsSync(path) && statSync(path).size > MAX_LOG_BYTES) {
      renameSync(path, `${path}.1`);
    }
  } catch { /* rotation is best effort */ }
  return { path, fd: openSync(path, 'a') };
}

const fileEnv = readEnvFile(ENV_FILE);
const port = Number(argValue('--port', fileEnv.PORT || process.env.PORT || 5000));
const childEnv = {
  ...process.env,
  ...fileEnv,
  PORT: String(port),
  HOST: fileEnv.HOST || '0.0.0.0',
  // A cooperative shutdown channel: the server reads one line from stdin, so it can close the
  // database cleanly instead of being killed mid-write. Windows has no usable SIGTERM for this.
  NEXUS_SERVICE_CONTROL: '1',
};

const state = {
  supervisor_pid: process.pid,
  port,
  env_file: ENV_FILE,
  data_dir: childEnv.NEXUS_DATA_DIR ?? null,
  started_at: new Date().toISOString(),
  child_pid: null,
  child_started_at: null,
  restarts: 0,
  healthy: false,
  last_health_at: null,
  last_health_error: null,
  consecutive_health_failures: 0,
  stopping: false,
  exit_reason: null,
  version: null,
};

function writeStatus() {
  try { writeFileSync(STATUS_FILE, `${JSON.stringify(state, null, 2)}\n`); } catch { /* status is a convenience */ }
}

let child = null;
let logSink = null;
let stopTimer = null;
let healthTimer = null;
let backoffMs = 1000;
let stopping = false;

function startChild() {
  logSink = openLogSink();
  child = spawn(process.execPath, ['--max-old-space-size=1024', 'server.js'], {
    cwd: APP_DIR,
    env: childEnv,
    stdio: ['pipe', logSink.fd, logSink.fd],
    windowsHide: true,
  });
  state.child_pid = child.pid;
  state.child_started_at = new Date().toISOString();
  state.healthy = false;
  writeStatus();
  log(`child started pid=${child.pid} port=${port} data=${state.data_dir}`);

  const startedAt = Date.now();
  child.on('exit', (code, signal) => {
    const lived = Math.round((Date.now() - startedAt) / 1000);
    try { closeSync(logSink.fd); } catch { /* already closed */ }
    log(`child exited code=${code} signal=${signal} after ${lived}s`);
    state.child_pid = null;
    state.healthy = false;
    if (stopping) { writeStatus(); endSupervisor(0); return; }
    state.restarts += 1;
    state.exit_reason = `exit ${code}/${signal} after ${lived}s`;
    writeStatus();
    // A child that ran for a minute was healthy: its restart starts from the short delay again.
    backoffMs = lived >= 60 ? 1000 : Math.min(backoffMs * 2, 30_000);
    log(`restarting in ${backoffMs}ms (restart #${state.restarts})`);
    setTimeout(() => { if (!stopping) startChild(); }, backoffMs);
  });

  child.on('error', (error) => log(`child error: ${error.message}`));
}

async function probeHealth() {
  if (!child) return;
  const started = Date.now();
  try {
    const answer = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(4000) });
    if (!answer.ok) throw new Error(`status ${answer.status}`);
    const body = await answer.json();
    state.healthy = true;
    state.consecutive_health_failures = 0;
    state.last_health_at = new Date().toISOString();
    state.last_health_error = null;
    state.version = { commit_short: body.commit_short ?? null, capabilities: body.capabilities ?? null };
  } catch (error) {
    state.healthy = false;
    state.consecutive_health_failures += 1;
    state.last_health_error = error.message;
    log(`health probe failed (${state.consecutive_health_failures}): ${error.message} in ${Date.now() - started}ms`);
    // Three misses in a row is a hung server, not a slow moment: restart it rather than report up.
    if (state.consecutive_health_failures >= 3 && child) {
      log('three failed probes in a row: asking the child to shut down');
      stopChild('hung');
    }
  }
  writeStatus();
}

function stopChild(reason) {
  if (!child || stopping) return;
  stopping = true;
  state.stopping = true;
  state.exit_reason = reason;
  writeStatus();
  log(`stopping child (${reason})`);
  try { child.stdin.write('shutdown\n'); } catch { /* the child may already be gone */ }
  stopTimer = setTimeout(() => {
    log('child did not answer the shutdown request in 15s: terminating');
    try { child.kill(); } catch { /* already gone */ }
  }, 15_000);
  stopTimer.unref?.();
}

function endSupervisor(code) {
  clearTimeout(stopTimer);
  clearInterval(healthTimer);
  releaseLock();
  writeStatus();
  log('supervisor exiting');
  process.exit(code);
}

if (!takeLock()) process.exit(0);
if (existsSync(STOP_FILE)) rmSync(STOP_FILE);

log(`supervisor pid=${process.pid} app=${APP_DIR} env=${ENV_FILE} once=${ONCE}`);
startChild();
healthTimer = setInterval(probeHealth, 30_000);
healthTimer.unref?.();
setTimeout(probeHealth, 2500);

// A stop request is a file, so any shell (or a scheduled task, or a person) can ask for a clean stop
// without knowing the supervisor's pid.
const stopWatcher = setInterval(() => {
  if (existsSync(STOP_FILE)) {
    rmSync(STOP_FILE, { force: true });
    log('stop.request seen');
    stopChild('requested');
  }
}, 1000);
stopWatcher.unref?.();

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { log(`${signal} received`); stopChild(signal); });
}
process.on('uncaughtException', (error) => log(`supervisor uncaught: ${error?.message ?? error}`));

