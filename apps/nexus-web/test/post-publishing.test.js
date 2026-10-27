import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { issueSession } from '../lib/security.js';
import { handleRequest } from '../lib/api.js';
import { normalizePublishing } from '../lib/post-publishing.js';
import { normalizeCreatorStudio } from '../lib/creator-studio.js';
import { validDraft, draftMediaBytes } from '../public/creator-draft-sync.js';
import { synchronizeReelSound } from '../public/reel-auto-sound.js';

function response(){return {statusCode:200,headers:{},body:'',writeHead(status,headers={}){this.statusCode=status;Object.assign(this.headers,headers);},setHeader(name,value){this.headers[name]=value;},getHeader(name){return this.headers[name];},end(value){this.body=String(value||'');}};}
function request(method,url,cookie,body,key){const raw=Buffer.from(JSON.stringify(body||{}));return {method,url,headers:{'content-type':'application/json',cookie,'idempotency-key':key},socket:{remoteAddress:'127.0.0.241'},on(event,callback){if(event==='data')process.nextTick(()=>callback(raw));if(event==='end')process.nextTick(callback);return this;},destroy(){}};}
function fixture(){const db=openDb(':memory:'),repo=createRepo(db);const users=['publish-owner','publish-reader'].map(handle=>{const user=repo.createUser({handle,displayName:handle});repo.ensurePersona(user.id,'social',{visibility:'public'});const session=issueSession(user.id,'social');repo.insertSession({tokenHash:session.tokenHash,userId:user.id,persona:'social',expiresAt:session.expiresAt});return {...user,cookie:`nexus_session=${session.token}`};});let counter=0;return {db,repo,users,async call(method,url,body={},actor=0,key){const res=response();await handleRequest(request(method,url,users[actor].cookie,body,key||`publishing-test-${++counter}-unique`),res,{db,repo,sse:{broadcast(){}}});return {status:res.statusCode,...JSON.parse(res.body)};}};}

test('publishing metadata is canonical, bounded and rejects unsafe URLs and invalid toggles',()=>{
  assert.equal(normalizePublishing({}).allowComments,true);
  assert.deepEqual(normalizePublishing({taggedUserIds:[1,1,2]}).taggedUserIds,[1,2]);
  for(const link of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://169.254.169.254'])assert.throws(()=>normalizePublishing({link}),/LINK_INVALID/);
  assert.throws(()=>normalizePublishing({allowDownload:'false'}),/INVALID/);
  assert.throws(()=>normalizePublishing({latitude:42}),/INVALID/);
  assert.throws(()=>normalizePublishing({constructor:'unexpected'}),/INVALID/);
});
test('post publishes exactly once with server enforced comments, repost, downloads and private visibility',async()=>{
  const f=fixture();try{
    const body={kind:'text',caption:'Creator flow #test',visibility:'public',provenance:'AI_GENERATED',publishing:{title:'New title',location:'Warszawa',link:'https://example.com/',taggedUserIds:[f.users[1].id],allowComments:false,allowRepost:false,allowDownload:false,watermark:true,saveToDevice:false}};
    const first=await f.call('POST','/api/posts',body,0,'publishing-test-replay-unique');assert.equal(first.status,201,JSON.stringify(first));
    const second=await f.call('POST','/api/posts',body,0,'publishing-test-replay-unique');assert.equal(second.post.id,first.post.id);
    assert.equal(f.repo.getPostById(first.post.id).publishing.title,'New title');
    assert.equal((await f.call('POST',`/api/posts/${first.post.id}/comments`,{body:'reply'},1)).status,403);
    assert.equal((await f.call('POST',`/api/posts/${first.post.id}/repost`,{active:true},1)).status,403);
    assert.equal((await f.call('GET',`/api/posts/${first.post.id}/download-permission`,{},1)).status,403);
    const mine=await f.call('POST','/api/posts',{...body,visibility:'private'});assert.equal(mine.status,201);assert.equal(f.repo.canViewPost(f.users[1].id,'social',mine.post),false);
    assert.equal(f.repo.canViewPost(f.users[0].id,'social',mine.post),true);
  }finally{f.db.close();}
});
test('a text post carries the look its author chose and a request cannot repaint a theme',async()=>{
  const f=fixture();try{
    const created=await f.call('POST','/api/posts',{kind:'text',caption:'O pagină scrisă în pădure.',text_style:{theme:'paper',font:'mono',size:'large',align:'center',media:{scale:0.8,x:-0.2,y:0.1}}});
    assert.equal(created.status,201,JSON.stringify(created));
    const style={theme:'paper',font:'mono',size:'large',align:'center',background:'#f4efe2',text:'#1a221b',media:{scale:0.8,x:-0.2,y:0.1}};
    assert.deepEqual(created.post.text_style,style);
    assert.deepEqual(f.repo.getPostById(created.post.id).text_style,style);
    // The style is part of the commitment, so two pages of the same words with different looks are
    // two different posts and neither can be swapped for the other after the fact.
    const other=await f.call('POST','/api/posts',{kind:'text',caption:'O pagină scrisă în pădure.',text_style:{theme:'ink'}});
    assert.equal(other.status,201);
    // A page that names no frame is stored with the neutral one, so every reader has geometry.
    assert.deepEqual(other.post.text_style.media,{scale:1,x:0,y:0});
    assert.notEqual(other.post.content_commitment,created.post.content_commitment);
    // A post written before the column existed still publishes, and renders in the reader's own composition.
    const legacy=await f.call('POST','/api/posts',{kind:'text',caption:'Fără stil ales.'});
    assert.equal(legacy.status,201);assert.equal(legacy.post.text_style,null);
    for(const text_style of [
      {theme:'paper',background:'#000000',text:'#ffffff'},{theme:'neon'},{theme:'ink',shadow:true},{theme:'ink',size:'huge'},
      {theme:'ink',media:{scale:2,x:0,y:0}},{theme:'ink',media:{scale:1,x:0.5,y:0}},{theme:'ink',media:{scale:1,x:0,y:-0.5}},
      {theme:'ink',media:{scale:1,x:0,y:0,z:1}},{theme:'ink',media:{scale:'1',x:0,y:0}},
    ])
      assert.equal((await f.call('POST','/api/posts',{kind:'text',caption:'Stil refuzat.',text_style})).status,400,JSON.stringify(text_style));
  }finally{f.db.close();}
});
test('a 10 000-character page survives publishing and an oversized page is refused, not cut', async()=>{
  const f=fixture();try{
    const article=Array.from({length:120},(_,index)=>`Paragraful ${index+1}. Pădurea își ține pagina, iar cuvintele se așază pe ecran fără să fie tăiate. `).join('\n\n');
    assert.ok(article.length>=10000,`articolul are ${article.length} caractere`);
    const created=await f.call('POST','/api/posts',{kind:'text',caption:article,text_style:{theme:'paper'}});
    assert.equal(created.status,201,JSON.stringify(created));
    assert.equal(f.repo.getPostById(created.post.id).caption.length,article.trim().length);
    assert.equal(created.post.caption,article.trim());
    // The ceiling is checked before sanitizeText: an oversized article is refused, never silently cut.
    const refused=await f.call('POST','/api/posts',{kind:'text',caption:'x'.repeat(20001)});
    assert.equal(refused.status,413);assert.equal(refused.code,'CAPTION_TOO_LONG');
    // A page without an authored look keeps the same 20 000-character ceiling; it is still a text page.
    const plain=await f.call('POST','/api/posts',{kind:'text',caption:'y'.repeat(2000)});
    assert.equal(plain.status,201);assert.equal(f.repo.getPostById(plain.post.id).caption.length,2000);
  }finally{f.db.close();}
});
test('a page with a photograph keeps its authored theme and publishes as a POST',async()=>{
  const f=fixture();try{
    const media=f.repo.insertMedia({
      hash:'c'.repeat(64),ext:'jpg',mime:'image/jpeg',kind:'image',size:40623,
      uploadedBy:f.users[0].id,purpose:'social_post',actorPersona:'social',scanStatus:'ready_local_validation',scanReason:'',
    });
    assert.ok(media);
    const created=await f.call('POST','/api/posts',{
      kind:'image',caption:'O pagină cu o fotografie.',media_items:[{hash:media.hash,ext:media.ext}],
      text_style:{theme:'jungle'},
    });
    assert.equal(created.status,201,JSON.stringify(created));
    assert.equal(created.post.kind,'image');
    assert.equal(created.post.text_style.theme,'jungle');
    assert.equal(f.repo.getPostById(created.post.id).caption,'O pagină cu o fotografie.');
    assert.equal(f.repo.listPostMedia(created.post.id).length,1);
    // A file with no words has no page to paint, so a theme there is still refused.
    const noWords=await f.call('POST','/api/posts',{
      kind:'image',caption:'',media_items:[{hash:media.hash,ext:media.ext}],text_style:{theme:'jungle'},
    });
    assert.equal(noWords.status,400);
  }finally{f.db.close();}
});
test('an editorial document survives publication and is returned by the post route',async()=>{
  const f=fixture();try{
    const one=f.repo.insertMedia({
      hash:'d'.repeat(64),ext:'jpg',mime:'image/jpeg',kind:'image',size:3021,
      uploadedBy:f.users[0].id,purpose:'social_post',actorPersona:'social',scanStatus:'ready_local_validation',scanReason:'',
    });
    const two=f.repo.insertMedia({
      hash:'e'.repeat(64),ext:'png',mime:'image/png',kind:'image',size:4021,
      uploadedBy:f.users[0].id,purpose:'social_post',actorPersona:'social',scanStatus:'ready_local_validation',scanReason:'',
    });
    const document={version:1,typography:'auto',blocks:[
      {id:'p-1',type:'paragraph',text:'Primul paragraf al articolului.'},
      {id:'m-1',type:'media',mediaIndex:0,mediaType:'image',placement:'left',widthFraction:.55,wrapText:true},
      {id:'h-1',type:'heading',text:'Un titlu'},
      {id:'m-2',type:'media',mediaIndex:1,mediaType:'image',placement:'right',widthFraction:.4,wrapText:true},
      {id:'p-2',type:'paragraph',text:'Ultimul paragraf.'},
    ]};
    const created=await f.call('POST','/api/posts',{
      kind:'image',caption:'Primul paragraf al articolului.\n\nUn titlu\n\nUltimul paragraf.',
      media_items:[{hash:one.hash,ext:one.ext},{hash:two.hash,ext:two.ext}],
      text_style:{theme:'paper',document},
    });
    assert.equal(created.status,201,JSON.stringify(created));
    assert.deepEqual(created.post.text_style.document,document);
    assert.deepEqual(f.repo.getPostById(created.post.id).text_style.document,document);
    const routed=await f.call('GET',`/api/posts/${created.post.id}`);
    assert.equal(routed.status,200,JSON.stringify(routed));
    assert.equal(routed.post.id,created.post.id);
    assert.deepEqual(routed.post.text_style.document,document);
    assert.equal(routed.post.media_list.length,2);
    // A broken document is refused before any row is written, never stored as a half page.
    const broken=await f.call('POST','/api/posts',{
      kind:'text',caption:'Pagina ruptă.',
      text_style:{theme:'paper',document:{version:1,blocks:[{id:'p-1',type:'media',mediaIndex:9,placement:'left',widthFraction:.5,wrapText:true}]}},
    });
    assert.equal(broken.status,400);
    // The route is visibility-aware: another reader cannot fetch a private post by guessing its id.
    const privatePost=await f.call('POST','/api/posts',{kind:'text',caption:'Doar eu.',visibility:'private',text_style:{theme:'ink'}});
    assert.equal((await f.call('GET',`/api/posts/${privatePost.post.id}`,{},1)).status,404);
  }finally{f.db.close();}
});
test('server drafts retain edits, isolate owners, reject foreign media and delete only owned rows',async()=>{
  const f=fixture();try{
    const id='draft-publishing-fixture';const fields={caption:'Draft title',publishing_json:JSON.stringify(normalizePublishing({location:'Warszawa'})),studio_decorations:'[]',studio_transform:JSON.stringify({rotation:90})};
    assert.equal((await f.call('PUT','/api/creator/drafts/'+id,{mode:'post',fields,media:[]})).status,200);
    const mine=await f.call('GET','/api/creator/drafts');assert.deepEqual(mine.drafts[0].fields,fields);
    assert.equal((await f.call('GET','/api/creator/drafts',{},1)).drafts.length,0);
    await f.call('DELETE','/api/creator/drafts/'+id,{},1);assert.equal((await f.call('GET','/api/creator/drafts')).drafts.length,1);
    assert.equal((await f.call('PUT','/api/creator/drafts/'+id,{mode:'post',fields,media:[{hash:'a'.repeat(64),ext:'jpg',role:'source'}]})).status,403);
    assert.equal((await f.call('PUT','/api/creator/drafts/'+id,{mode:'post',fields,media:[null]})).status,400);
    await f.call('DELETE','/api/creator/drafts/'+id);assert.equal((await f.call('GET','/api/creator/drafts')).drafts.length,0);
  }finally{f.db.close();}
});
test('gallery draft quota counts every file once and rejects extra oversized media',()=>{
  const photo=new Blob(['photo'],{type:'image/png'}),other=new Blob(['second'],{type:'image/png'});
  const draft={id:'draft-gallery-test',owner:1,persona:'social',ownerPersona:'1:social',mode:'post',updatedAt:Date.now(),fields:{caption:'Saved'},sourceFile:photo,sourceFiles:[photo,other]};
  const policy={owner:1,persona:'social',personas:new Set(['social']),fields:new Set(['caption']),mediaMimes:new Set(['image/png']),audioMimes:new Set(),maxFileBytes:10};
  assert.equal(validDraft(draft,policy),true);assert.equal(draftMediaBytes(draft),11);
  assert.equal(validDraft({...draft,sourceFiles:[photo,new Blob(['x'.repeat(11)],{type:'image/png'})]},policy),false);
  assert.equal(validDraft({...draft,owner:2},policy),false);
});
test('Jamendo synchronization preserves original sound preferences and releases playback',()=>{
  const events=new Map();const video={currentTime:2,paused:false,muted:false,addEventListener(k,v){events.set(k,v);},removeEventListener(k){events.delete(k);}};
  const audio={currentTime:0,playCount:0,pauseCount:0,play(){this.playCount++;return Promise.resolve();},pause(){this.pauseCount++;}};
  const stop=synchronizeReelSound(video,audio,{duration:90,segment_seconds:15,preview_offset:10});
  assert.equal(video.muted,false);assert.equal(audio.currentTime,12);assert.equal(audio.playCount,1);
  video.currentTime=20;events.get('timeupdate')();assert.equal(audio.currentTime,15);stop();assert.equal(events.size,0);assert.equal(audio.pauseCount,1);
});
test('crop rotation and volume survive canonical studio persistence while invalid transforms fail',()=>{
  const transform={rotation:90,zoom:1.3,x:40,y:55,ratio:.75,originalVolume:.25,musicVolume:.6};
  const source={version:1,aspect:'ORIGINAL',filter:'WARM',intensity:70,trimStartMs:0,trimEndMs:0,playbackRate:1,muteOriginal:false,overlay:{text:'',position:'BOTTOM',color:'WHITE'},transform};
  assert.deepEqual(normalizeCreatorStudio(source,{mediaKind:'image'}).transform,transform);
  assert.throws(()=>normalizeCreatorStudio({...source,transform:{...transform,zoom:100}},{mediaKind:'image'}),/TRANSFORM_INVALID/);
});
