import { json, readJson } from './transport.js';
const FIELDS = new Set(['caption','title','visibility','language','provenance','persistent','duration_hours','studio_aspect','studio_filter','studio_intensity','trim_start','trim_end','playback_rate','mute_original','overlay_text','overlay_position','overlay_color','audio_rights','audio_attribution','studio_decorations','publishing_json','jamendo_track','studio_transform']);
export function initializeCreatorDrafts(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS creator_drafts (
    id TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona TEXT NOT NULL, mode TEXT NOT NULL, fields_json TEXT NOT NULL, media_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL, PRIMARY KEY(id,user_id,persona))`);
}
export async function handleCreatorDrafts({req,res,method,path,repo,auth}) {
  const match = /^\/api\/creator\/drafts(?:\/([a-z0-9-]{8,80}))?$/.exec(path);
  if (!match) return false;
  const db = repo.db, owner = auth.user.id, persona = auth.persona, id = match[1];
  const scope = { owner_id: owner, owner_persona: persona };
  if (method === 'GET' && !id) {
    const drafts = db.prepare('SELECT * FROM creator_drafts WHERE user_id=? AND persona=? ORDER BY updated_at DESC LIMIT 20').all(owner,persona).map(row=>({id:row.id,mode:row.mode,updatedAt:row.updated_at,fields:JSON.parse(row.fields_json),media:JSON.parse(row.media_json)}));
    json(res,200,{ok:true,...scope,drafts}); return true;
  }
  if (method === 'DELETE' && id) {
    db.prepare('DELETE FROM creator_drafts WHERE id=? AND user_id=? AND persona=?').run(id,owner,persona);
    json(res,200,{ok:true,...scope,id}); return true;
  }
  if (method !== 'PUT' || !id) { json(res,405,{ok:false}); return true; }
  const body = await readJson(req);
  const fields = body?.fields, media = body?.media;
  if (!['post','story'].includes(body?.mode) || !fields || typeof fields !== 'object' || Array.isArray(fields)
    || Object.entries(fields).some(([key,value])=>!FIELDS.has(key) || !['string','number','boolean'].includes(typeof value) || (typeof value==='string' && value.length>(['studio_decorations','jamendo_track','publishing_json'].includes(key)?24000:2000)))
    || !Array.isArray(media) || media.length>11) { json(res,400,{ok:false,error:'Draft invalid'}); return true; }
  for (const item of media) {
    if(!item || typeof item!=='object' || Array.isArray(item) || !/^[a-f0-9]{64}$/.test(item.hash||'') || !/^[a-z0-9]{2,5}$/.test(item.ext||'')){json(res,400,{ok:false,error:'Draft media invalid'});return true;}
    const row = repo.db.prepare('SELECT * FROM media WHERE hash=? AND ext=?').get(String(item.hash),String(item.ext));
    if (!row || !['source','audio'].includes(item.role) || !repo.hasMediaUploadGrant(row.id,owner,item.role==='audio'?'social_audio':body.mode==='story'?'story':'social_post',persona)) { json(res,403,{ok:false,error:'Draft media invalid'}); return true; }
  }
  const count = db.prepare('SELECT count(*) AS n FROM creator_drafts WHERE user_id=? AND persona=? AND id<>?').get(owner,persona,id).n;
  if (count>=20) { json(res,409,{ok:false,error:'Ai deja 20 de drafturi. Șterge unul pentru a continua.'}); return true; }
  db.prepare('INSERT INTO creator_drafts VALUES (?,?,?,?,?,?,?) ON CONFLICT(id,user_id,persona) DO UPDATE SET mode=excluded.mode,fields_json=excluded.fields_json,media_json=excluded.media_json,updated_at=excluded.updated_at')
    .run(id,owner,persona,body.mode,JSON.stringify(fields),JSON.stringify(media.map(({hash,ext,role,name,mime})=>({hash,ext,role,name:String(name||'media').slice(0,120),mime:String(mime||'').slice(0,80)}))),Date.now());
  json(res,200,{ok:true,...scope,id}); return true;
}
