// Isolated, bounded local test environment; no production credentials or external providers.
import { mkdirSync, existsSync, readFileSync, writeFileSync, realpathSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { labRuntimeSeconds } from './messenger-lab-runtime.mjs';
const runtimeSeconds = labRuntimeSeconds(process.argv.slice(2));
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, 'test-labs', 'messenger');
if (process.env.NODE_ENV === 'production') throw new Error('LAB_PRODUCTION_FORBIDDEN');
mkdirSync(dir, { recursive: true });
if (realpathSync(dir) !== join(realpathSync(root), 'test-labs', 'messenger')) throw new Error('LAB_PATH_INVALID');
const marker = join(dir, 'lab.json');
if (!existsSync(marker) && existsSync(join(dir, 'nexus.sqlite'))) throw new Error('LAB_UNMARKED_DB');
if (!existsSync(marker)) writeFileSync(marker, JSON.stringify({ classification: 'SYSTEM_TEST', password: randomBytes(18).toString('base64url'), sessionSecret: randomBytes(32).toString('hex') }), { flag: 'wx', mode: 0o600 });
const config = JSON.parse(readFileSync(marker, 'utf8'));
if (config.classification !== 'SYSTEM_TEST' || !config.sessionSecret || config.password?.length < 16) throw new Error('LAB_CONFIG_INVALID');
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
Object.assign(env, { NODE_ENV: 'development', NEXUS_ENV_FILE: '', NEXUS_DATA_DIR: dir, NEXUS_SESSION_SECRET: config.sessionSecret, PORT: '3100', HTTPS_PORT: '3543', HOST: '0.0.0.0', NEXUS_WC_PROJECT_ID: '', NEXUS_INCREMENTAL_COST_LIMIT: '0' });
// Modules must see the isolated data path before their first import.
process.env.NEXUS_DATA_DIR = dir;
const [{ openDb }, { createRepo }, { storeMedia }, { seedMessengerLab }] = await Promise.all([import('../lib/db.js'), import('../lib/repo.js'), import('../lib/media.js'), import('./messenger-lab-seed.mjs')]);
const db = openDb(), repo = createRepo(db);
const photo = (repo, user, purpose) => {
  const name = user.handle === 'lab_mira' ? 'mira' : 'alex';
  const file = join(root, 'test', 'fixtures', 'messenger', name + '.png');
  if (!existsSync(file)) return null;
  return repo.insertMedia({ ...storeMedia(readFileSync(file), 'image/png'), uploadedBy: user.id, actorPersona: 'social', purpose });
};
const result = seedMessengerLab(repo, { password: config.password,
  avatar: (repo, user) => { const media = photo(repo, user, 'profile_avatar'); return media ? `/media/${media.hash}.${media.ext}` : null; },
  attachment: (repo, user) => photo(repo, user, 'message_attachment'),
});
db.close();
writeFileSync(join(dir, 'access.md'), `# Nexus Messenger · test local\n\nCont: lab_tester@nexus.test\n\nParolă: ${config.password}\n\nPe al doilea dispozitiv: lab_mira@nexus.test sau lab_alex@nexus.test, aceeași parolă.\n\nFolosește o fereastră privată dedicată: cookie-urile de pe același host sunt comune porturilor. Nu folosi date personale reale.\n\nPornire: node scripts/messenger-lab.mjs --serve (maximum 10 minute per rulare).\n\nHTTP: http://localhost:3100 · HTTPS: https://localhost:3543\nPe telefon înlocuiește localhost cu IP-ul laptopului. Camera cere certificatul HTTPS local acceptat de dispozitiv.\n`, { mode: 0o600 });
console.log(JSON.stringify({ ...result, http: 'http://localhost:3100', https: 'https://localhost:3543', credentials_file: join(dir, 'access.md'), max_runtime_seconds: runtimeSeconds, max_disk_mb: 256, incremental_cost: 0 }, null, 2));
if (process.argv.includes('--serve')) {
  const child = spawn(process.execPath, ['--max-old-space-size=384', 'server.js'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const size = (folder) => readdirSync(folder, { withFileTypes: true }).reduce((sum, item) => sum + (item.isSymbolicLink() ? Infinity : item.isDirectory() ? size(join(folder, item.name)) : statSync(join(folder, item.name)).size), 0);
  const timer = setTimeout(() => child.kill(), runtimeSeconds * 1000);
  const disk = setInterval(() => { if (size(dir) > 256 * 1024 * 1024) child.kill(); }, 5000);
  child.on('exit', (code) => { clearTimeout(timer); clearInterval(disk); process.exitCode = code || 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
}
