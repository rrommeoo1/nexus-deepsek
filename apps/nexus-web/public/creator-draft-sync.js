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
export function bindDraftBackup(form,isCurrent,save){let timer;const backup=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(isCurrent()&&!form.querySelector('[type="submit"]').disabled)save().catch(()=>{});},900);};form.addEventListener('input',backup);form.addEventListener('change',backup);}
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
