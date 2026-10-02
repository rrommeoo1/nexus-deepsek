import { setCameraComposerState } from './reel-camera-review.js?v=20261001-publish1';

export function readPublishing(form) {
  try { return JSON.parse(form.elements.publishing_json?.value || '{}'); } catch { return {}; }
}
const defaults = {title:'',location:'',locationPrecision:'area',link:'',taggedUserIds:[],allowComments:true,allowRepost:true,allowDownload:true,watermark:true,saveToDevice:false};
export function bindPublishingDetails({form,api,toast,applyPreview,openDrafts}) {
  const root=form.closest('.cameraComposer'); if(!root)return;
  root.classList.add('modernCreator');
  const cameraModes=root.querySelector('.reelCameraModes');
  if(cameraModes&&openDrafts){const drafts=document.createElement('button');drafts.type='button';drafts.textContent='DRAFTS';drafts.onclick=openDrafts;cameraModes.append(drafts);}
  const page=document.createElement('section');page.className='publishingDetails';page.hidden=true;
  page.innerHTML=`<header class="publishHeader"><button type="button" data-return-preview aria-label="Înapoi la editare">‹</button><span>New post</span><button type="button" data-return-preview>Preview ↗</button></header>
    <div class="publishWriting"><button type="button" class="publishThumbnail" data-return-preview aria-label="Editează preview"><span>Preview</span></button><label class="publishTitle"><span class="sr-only">Titlu</span><input name="title" maxlength="100" placeholder="Adaugă un titlu…"></label><div data-description-slot></div></div>
    <div class="publishQuick"><button type="button" data-publish-sheet="tags"># Hashtags</button><button type="button" data-publish-sheet="people">@ People</button></div>
    <div class="publishRows">
      <button type="button" class="publishRow" data-publish-sheet="location"><i>⌖</i><span>Locație<small data-location-summary>Adaugă un loc</small></span><b>›</b></button>
      <button type="button" class="publishRow" data-publish-sheet="link"><i>↗</i><span>Adaugă un link<small data-link-summary>Opțional</small></span><b>›</b></button>
      <label class="publishRow"><i>◎</i><span>Cine poate vedea</span><span data-visibility-slot></span></label>
      <label class="publishRow"><i>◯</i><span>Permite comentarii</span><input type="checkbox" role="switch" data-setting="allowComments" checked></label>
      <label class="publishRow"><i>↻</i><span>Permite repostarea</span><input type="checkbox" role="switch" data-setting="allowRepost" checked></label>
      <details class="publishAdvanced"><summary>Mai multe opțiuni <b>⌄</b></summary>
        <label class="publishRow"><i>✦</i><span>Conținut generat cu AI</span><input type="checkbox" role="switch" data-ai-content></label>
        <label class="publishRow"><i>↓</i><span>Permite descărcarea</span><input type="checkbox" role="switch" data-setting="allowDownload" checked></label>
        <label class="publishRow"><i>▣</i><span>Salvează pe dispozitiv<small>După publicare</small></span><input type="checkbox" role="switch" data-setting="saveToDevice"></label>
        <label class="publishRow"><i>ℕ</i><span>Watermark Nexus<small>Sigla Nexus + username la export</small></span><input type="checkbox" role="switch" data-setting="watermark" checked></label>
        <p class="publishHint">Capturile și înregistrarea ecranului rămân posibile.</p>
      </details>
    </div><p class="publishDraftStatus" role="status" data-draft-status></p>
    <section class="publishSheet" hidden><header><b data-sheet-title></b><button type="button" data-sheet-close aria-label="Închide">×</button></header><div data-sheet-body></div></section>
    <input type="hidden" name="publishing_json" value="{}"><input type="hidden" name="jamendo_track" value=""><input type="hidden" name="studio_transform" value="{}">`;
  form.insertBefore(page,form.querySelector('#uploadProgress'));
  page.querySelector('[data-description-slot]').append(form.querySelector('.captionField'));
  page.querySelector('[data-visibility-slot]').append(form.elements.visibility);
  const caption=form.elements.caption;caption.placeholder='Spune povestea…';
  const settings={...defaults,...readPublishing(form)};
  const commit=()=>{settings.title=form.elements.title.value;form.elements.publishing_json.value=JSON.stringify(settings);caption.dispatchEvent(new Event('input',{bubbles:true}));};
  page.querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{settings[input.dataset.setting]=input.checked;commit();});
  page.querySelector('[data-ai-content]').onchange=event=>{form.elements.provenance.value=event.target.checked?'AI_GENERATED':'NOT_DECLARED';commit();};
  form.elements.title.addEventListener('input',commit);
  page.querySelectorAll('[data-return-preview]').forEach(button=>button.onclick=()=>{setCameraComposerState('review',{force:true});applyPreview();});
  const sheet=page.querySelector('.publishSheet'),body=sheet.querySelector('[data-sheet-body]');let generation=0;
  const close=()=>{sheet.hidden=true;generation++;};sheet.querySelector('[data-sheet-close]').onclick=close;
  const display=()=>{page.querySelector('[data-location-summary]').textContent=settings.location||'Adaugă un loc';let host='Opțional';try{if(settings.link)host=new URL(settings.link).hostname;}catch{}page.querySelector('[data-link-summary]').textContent=host;};
  const open=async(kind)=>{
    const turn=++generation;sheet.hidden=false;body.replaceChildren();sheet.querySelector('[data-sheet-title]').textContent=({tags:'Hashtags',people:'Etichetează persoane',location:'Locație',link:'Adaugă un link'})[kind];
    const input=document.createElement('input');input.placeholder=kind==='link'?'https://…':kind==='location'?'Oraș, loc sau adresă…':'Caută…';input.maxLength=kind==='link'?2048:120;input.value=kind==='link'?settings.link:kind==='location'?settings.location:'';
    const search=document.createElement('button');search.type='button';search.textContent=kind==='link'?'Salvează':'Caută';
    const results=document.createElement('div');results.className='publishResults';results.setAttribute('role','status');body.append(input,search,results);
    const render=(items)=>{results.replaceChildren();if(!items.length)results.textContent='Niciun rezultat. Poți încerca altă căutare.';items.forEach(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.onclick=item.select;results.append(button);});};
    const location=(items)=>render(items.map(item=>({label:item.label,select:()=>{settings.location=item.label;settings.locationPrecision=['city','area','exact'].includes(item.type)?item.type:'area';commit();display();close();}})));
    const perform=async()=>{
      if(kind==='link'){try{const url=input.value.trim()?new URL(input.value.trim()):null;if(url&&(url.protocol!=='https:'||url.username||url.password))throw new Error();settings.link=url?.href||'';commit();display();close();}catch{results.textContent='Introdu un link HTTPS valid.';}return;}
      results.textContent='Se caută…';
      const query=input.value.trim();if(query.length<2&&kind!=='tags'){results.textContent='Scrie cel puțin două caractere.';return;}
      const response=await api(kind==='people'?'/api/social/search?q='+encodeURIComponent(query):kind==='location'?'/api/location/suggestions?kind=search&q='+encodeURIComponent(query):'/api/social/tags?limit=20');
      if(turn!==generation||!form.isConnected)return;
      if(!response.ok){results.textContent='Căutarea nu este disponibilă. Încearcă din nou.';return;}
      if(kind==='location')return location(response.suggestions||[]);
      if(kind==='people')render((response.profiles||[]).map(person=>({label:'@'+person.handle,select:()=>{const id=Number(person.user_id||person.id);if(settings.taggedUserIds.includes(id)){results.textContent='Persoana este deja adăugată.';return;}if(settings.taggedUserIds.length>=20){results.textContent='Maximum 20 de persoane.';return;}settings.taggedUserIds.push(id);caption.value=(caption.value+' @'+person.handle).trim().slice(0,2000);commit();results.textContent='Persoană adăugată';}})));
      if(kind==='tags')render((response.tags||[]).filter(tag=>!query||tag.tag.includes(query.replace('#',''))).map(tag=>({label:'#'+tag.tag,select:()=>{caption.value=(caption.value+' #'+tag.tag).trim().slice(0,2000);commit();close();}})));
    };search.onclick=()=>perform().catch(()=>{results.textContent='Conexiune indisponibilă.';});input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();search.click();}};
    if(kind==='tags'){const custom=document.createElement('button');custom.type='button';custom.textContent='Adaugă hashtagul scris';custom.onclick=()=>{const tag=input.value.replace(/^#/,'').replace(/[^\p{L}\p{N}_]/gu,'').slice(0,50);if(tag){caption.value=(caption.value+' #'+tag).trim().slice(0,2000);commit();close();}};body.append(custom);search.click();}
    if(kind==='location'){
      const gps=document.createElement('button');gps.type='button';gps.textContent='⌖ Folosește locația mea';body.prepend(gps);
      gps.onclick=()=>{results.textContent='Se caută locația…';if(!navigator.geolocation){results.textContent='GPS indisponibil. Scrie locul manual.';return;}navigator.geolocation.getCurrentPosition(async({coords})=>{const response=await api(`/api/location/suggestions?kind=reverse&lat=${coords.latitude}&lon=${coords.longitude}`);if(turn!==generation)return;location(response.suggestions||[]);},()=>{results.textContent='Locația nu este disponibilă. O poți scrie manual.';},{timeout:9000,enableHighAccuracy:false});};
      const manual=document.createElement('button');manual.type='button';manual.textContent='Folosește textul';manual.onclick=()=>{settings.location=input.value.trim().slice(0,120);settings.locationPrecision='area';commit();display();close();};body.append(manual);
    }
  };
  page.querySelectorAll('[data-publish-sheet]').forEach(button=>button.onclick=()=>open(button.dataset.publishSheet));
  const sync=()=>{
    const visible=root.dataset.cameraState==='publishing-details';page.hidden=!visible;
    if(!visible)return;
    Object.assign(settings,defaults,readPublishing(form));settings.title=form.elements.title.value;
    const counter=form.querySelector('#captionCounter');if(counter)counter.textContent=caption.value.length+'/2000';
    page.querySelectorAll('[data-setting]').forEach(input=>{input.checked=settings[input.dataset.setting];});
    page.querySelector('[data-ai-content]').checked=form.elements.provenance.value==='AI_GENERATED';display();
    const thumb=page.querySelector('.publishThumbnail');thumb.querySelector('.previewStage')?.remove();const source=form.querySelector('#preview .previewStage');
    if(source){const clone=source.cloneNode(true);clone.querySelectorAll('button').forEach(node=>node.remove());clone.querySelectorAll('video').forEach(video=>{video.autoplay=false;video.controls=false;video.muted=true;video.pause();});thumb.prepend(clone);}
  };
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-camera-state']});sync();
  form.querySelector('.composerActions button[type="submit"]').textContent='Post ↑';
  form.querySelector('#saveDraft').textContent='Save draft';
  return {sync};
}
