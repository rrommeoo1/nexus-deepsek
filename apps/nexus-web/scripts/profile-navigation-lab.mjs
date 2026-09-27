// Disposable local-only SYSTEM_TEST server. Never opens the user's database.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'nexus-profile-audit-'));
const password = randomBytes(18).toString('base64url');
process.env.NEXUS_DATA_DIR = dir;
const [{ openDb }, { createRepo }, { storeMedia }, { seedMessengerLab }] = await Promise.all([
  import('../lib/db.js'), import('../lib/repo.js'), import('../lib/media.js'), import('./messenger-lab-seed.mjs'),
]);
const db = openDb(), repo = createRepo(db);
seedMessengerLab(repo, { password });
const author = repo.getUserByHandle('lab_alex');
const tester = repo.getUserByHandle('lab_tester');
const media = repo.insertMedia({ ...storeMedia(readFileSync(new URL('../test/fixtures/messenger/alex.png', import.meta.url)), 'image/png'),
  uploadedBy: author.id, actorPersona: 'social', purpose: 'social_post' });
for (let i = 1; i <= 3; i++) repo.createPost({ userId: author.id, persona: 'social', kind: 'image', mediaId: media.id,
  caption: `SYSTEM_TEST navigation image ${i}`, visibility: 'public' });
repo.setFollow(tester.id, author.id, 'social', true);
repo.updatePersona(author.id, 'social', { tabsOrder: ['shots', 'flow', 'reels', 'whispers', 'moments'], coverFocus: 72 });
repo.createPost({ userId: author.id, persona: 'social', caption: 'SYSTEM_TEST shared-renderer whisper', visibility: 'public' });
const privateAuthor = repo.getUserByHandle('lab_mira');
repo.updatePersona(privateAuthor.id, 'social', { visibility: 'private', discoverability: 'public' });
const selfMedia = repo.insertMedia({ ...storeMedia(readFileSync(new URL('../test/fixtures/messenger/mira.png', import.meta.url)), 'image/png'),
  uploadedBy: tester.id, actorPersona: 'social', purpose: 'social_post' });
repo.createPost({ userId: tester.id, persona: 'social', kind: 'image', mediaId: selfMedia.id,
  caption: 'SYSTEM_TEST own profile navigation', visibility: 'public' });
db.close();
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']
  .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
Object.assign(env, { NODE_ENV: 'development', NEXUS_ENV_FILE: '', NEXUS_DATA_DIR: dir,
  NEXUS_SESSION_SECRET: randomBytes(32).toString('hex'), HOST: '127.0.0.1', PORT: '3217',
  NEXUS_TLS_PFX_PATH: join(dir, 'no-certificate.pfx'), NEXUS_WC_PROJECT_ID: '', NEXUS_INCREMENTAL_COST_LIMIT: '0' });
const child = spawn(process.execPath, ['--max-old-space-size=256', 'server.js'], {
  cwd: new URL('..', import.meta.url), env, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'],
});
console.log(JSON.stringify({ url: 'http://127.0.0.1:3217', email: 'lab_tester@nexus.test', password,
  data: dir, classification: 'SYSTEM_TEST', runtime_limit_seconds: 900, real_funds: false }));
const timer = setTimeout(() => child.kill(), 900_000);
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', (code) => { clearTimeout(timer); process.exitCode = code || 0; });
