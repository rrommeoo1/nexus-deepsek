import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Nexus/data/nexus.sqlite', { readOnly: true });
const hash = process.argv[2];
const media = db.prepare('SELECT id, hash, ext, mime, kind, purpose, uploaded_by FROM media WHERE hash = ?').get(hash);
console.log('media', media);
if (media) {
  console.log('posts with media_id', db.prepare('SELECT id, user_id, kind FROM posts WHERE media_id = ?').all(media.id));
  console.log('posts in gallery', db.prepare('SELECT post_id, position FROM post_media WHERE media_id = ?').all(media.id));
  const like = `%${hash}%`;
  console.log('personas', db.prepare('SELECT user_id, persona FROM personas WHERE avatar LIKE ? OR cover LIKE ?').all(like, like));
  console.log('users', db.prepare('SELECT id, handle FROM users WHERE avatar LIKE ?').all(like));
} else {
  console.log('hash not in media table');
}
const total = db.prepare('SELECT COUNT(*) n FROM media').get();
console.log('media rows', total.n);
db.close();
