import { api } from './client.js?v=20260831-p1e2eeattach2';
export function validDraft(draft,{owner,persona,personas,fields:allowed,mediaMimes,audioMimes,maxFileBytes}){
  if(!draft || typeof draft!=='object' || Array.isArray(draft) || Number(draft.owner)!==Number(owner) || draft.persona!==persona || !personas.has(persona)
    || draft.ownerPersona!==String(Number(owner))+':'+persona || !/^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|draft-[a-z0-9-]{8,70})$/.test(String(draft.id||''))
    || !['post','story'].includes(draft.mode) || !Number.isSafeInteger(Number(draft.updatedAt)) || Number(draft.updatedAt)<1 || Number(draft.updatedAt)>Date.now()+60000
    || !draft.fields || typeof draft.fields!=='object' || Array.isArray(draft.fields))return false;
  if(Object.entries(draft.fields).some(([key,value])=>!allowed.has(key) || !['string','boolean','number'].includes(typeof value) || (typeof value==='string'&&value.length>(['studio_decorations','publishing_json','jamendo_track'].includes(key)?24000:2000))))return false;
  const safe=(file,mimes)=>file==null || (file instanceof Blob && file.size>0 && file.size<=maxFileBytes && mimes.has(file.type));
  return safe(draft.sourceFile,mediaMimes)&&safe(draft.audioFile,audioMimes)&&(draft.sourceFiles==null || (Array.isArray(draft.sourceFiles)&&draft.sourceFiles.length<=10&&draft.sourceFiles.every(file=>file&&safe(file,mediaMimes))));
}
export function draftMediaBytes(draft){return (draft?.sourceFiles?.length?draft.sourceFiles.reduce((sum,file)=>sum+Number(file?.size||0),0):Number(draft?.sourceFile?.size||0))+Number(draft?.audioFile?.size||0);}
const draftWrites = new WeakMap();
export function serializeDraftWrite(form, write) {
  const task = (draftWrites.get(form) || Promise.resolve()).catch(() => {}).then(write);
  draftWrites.set(form, task);
  return task;
}
export function bindDraftBackup(form, isCurrent, save, { delay = 250, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer, changed = false, inFlight = null, failed = false;
  const status = () => form.querySelector('[data-draft-status]');
  const label = (value) => { const node = status(); if (node) node.textContent = value; };
  const flush = async () => {
    clearTimer(timer); timer = null;
    if (!isCurrent()) return false;
    if (inFlight) await inFlight.catch(() => {});
    if (!changed) return !failed;
    if (form.querySelector('[type="submit"]')?.disabled) return false;
    changed = false; label('Se salvează draftul…');
    inFlight = Promise.resolve().then(save);
    try { await inFlight; failed = false; label('Draft salvat pe acest dispozitiv.'); return !changed; }
    catch (error) { failed = true; changed = true; label('Draftul nu a fost salvat. Reîncearcă înainte să ieși.'); throw error; }
    finally { inFlight = null; }
  };
  const schedule = () => { clearTimer(timer); timer = setTimer(() => { flush().catch(() => {}); }, delay); };
  const changedField = (event) => {
    if (!isCurrent()) return;
    changed = true; failed = false; label('Modificări nesalvate…');
    if (event.target?.type === 'file') flush().catch(() => {});
    else schedule();
  };
  form.addEventListener('input', changedField);
  form.addEventListener('change', changedField);
  return Object.freeze({ flush });
}
export async function hydrateRemoteDraft(draft){
  const files=[];
  for(const media of draft.media||[]){
    if(!/^[a-f0-9]{64}$/.test(media.hash)||! /^[a-z0-9]{2,5}$/.test(media.ext))throw new Error('Invalid media');
    const response=await fetch('/media/'+media.hash+'.'+media.ext,{credentials:'same-origin'});if(!response.ok)throw new Error('Media unavailable');
    const file=new File([await response.blob()],media.name,{type:media.mime});if(media.role==='audio')draft.audioFile=file;else files.push(file);
  }
  return {...draft,sourceFiles:files,sourceFile:files[0]||null};
}
export async function syncCreatorDraft({form,record,mode,fields,audioFile,uploadMediaResumable,isCurrent}){
  const draftStatus=form.querySelector('[data-draft-status]');
  if(draftStatus)draftStatus.textContent='Se salvează draftul…';
  const media=[];
  for(const [file,role] of [...record.sourceFiles.map(file=>[file,'source']),...(audioFile?[[audioFile,'audio']]:[])]) {
    const uploaded=await uploadMediaResumable(file,role==='audio'?'social_audio':mode==='story'?'story':'social_post',()=>{});
    if(!isCurrent())throw new Error('Draft session changed');
    if(!uploaded.ok)throw new Error('Draft media upload failed');
    media.push({hash:uploaded.media.hash,ext:uploaded.media.ext,mime:file.type,name:file.name,role});
  }
  const saved=await api('/api/creator/drafts/'+record.id,{method:'PUT',headers:{'Idempotency-Key':'draft-'+record.id+'-'+record.updatedAt},body:{mode,fields,media}});
  if(!saved.ok){if(draftStatus)draftStatus.textContent='Copie locală păstrată. Reîncearcă salvarea online.';throw new Error('Draft sync failed');}
  if(draftStatus)draftStatus.textContent='Draft salvat în cont.';
}
