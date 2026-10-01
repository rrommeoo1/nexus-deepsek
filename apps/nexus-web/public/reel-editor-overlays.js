import { STICKER_CATEGORIES, stickerById, stickerCatalogPage } from './reel-sticker-catalog.js?v=20261001-camera11';

const MAX_DECORATIONS = 12;
const FONT_STYLES = Object.freeze({ classic:'system-ui,sans-serif', elegance:'Georgia,serif', neon:'Arial Black,sans-serif', retro:'Courier New,monospace', comic:'Comic Sans MS,cursive', typewriter:'Courier New,monospace', bold:'Arial Black,sans-serif', outline:'system-ui,sans-serif', handwriting:'cursive' });

function safeText(value, limit = 120) { return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, limit); }
function zone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
function decorate(type, values = {}) {
  return {
    id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, assetId:'', text:'', x:50, y:48, scale:1, rotation:0,
    zIndex:1, opacity:1, style:'classic', align:'center', color:'#ffffff', background:'transparent', animation:'none', startMs:0, endMs:600000,
    timezone:zone(), locationPrecision:'area', dynamic:false, ...values,
  };
}
function normalized(item, index = 0) {
  const base = decorate(item?.type || 'STICKER', { id:item?.id || `legacy-${Date.now()}-${index}` });
  return { ...base, ...item, text:safeText(item?.text), zIndex:Number(item?.zIndex ?? index + 1), opacity:Number(item?.opacity ?? 1) };
}
export function readStudioDecorations(form) {
  try { const parsed = JSON.parse(form?.elements?.studio_decorations?.value || '[]'); return Array.isArray(parsed) ? parsed.slice(0, MAX_DECORATIONS).map(normalized) : []; }
  catch { return []; }
}
export function writeStudioDecorations(form, decorations, applyPreview) {
  if (!form?.elements?.studio_decorations) return;
  form.elements.studio_decorations.value = JSON.stringify(decorations.slice(0, MAX_DECORATIONS).map(normalized));
  form.dispatchEvent(new Event('input', { bubbles:true })); applyPreview?.();
}

function clockText(item, date = new Date()) {
  const time = new Intl.DateTimeFormat('ro-RO', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:item.timezone || zone() }).format(date);
  if (item.type === 'DATE') return new Intl.DateTimeFormat('ro-RO', { day:'2-digit', month:'2-digit', timeZone:item.timezone || zone() }).format(date);
  if (item.style === 'live') return `LIVE  ${time}`;
  if (item.style === 'analog') return `◷  ${time}`;
  return time;
}
function displayText(item) { return new Set(['TIME','DATE']).has(item.type) ? clockText(item) : item.text; }
function decorationInner(item, escapeText = (value) => value) {
  const asset = stickerById(item.assetId);
  if (asset) return `<img src="${escapeText(asset.image)}" alt="${escapeText(asset.label)}" draggable="false">`;
  return `<span>${escapeText(displayText(item))}</span>`;
}
function styleString(item) {
  return `left:${Number(item.x)}%;top:${Number(item.y)}%;z-index:${Number(item.zIndex)};opacity:${Number(item.opacity)};color:${item.color};background:${item.background};font-family:${FONT_STYLES[item.style] || FONT_STYLES.classic};text-align:${item.align};transform:translate(-50%,-50%) rotate(${Number(item.rotation)}deg) scale(${Number(item.scale)})`;
}
export function studioDecorationsMarkup(decorations, escapeText) {
  ensureClockUpdates();
  return (Array.isArray(decorations) ? decorations : []).map((raw, index) => { const item = normalized(raw, index); return `<span class="studioDecoration decoration${escapeText(item.type)} style${escapeText(item.style)} animation${escapeText(item.animation)}" style="${styleString(item)}" data-decoration-start="${Number(item.startMs)}" data-decoration-end="${Number(item.endMs)}"${item.dynamic ? ` data-dynamic-decoration="true" data-dynamic-type="${escapeText(item.type)}" data-dynamic-style="${escapeText(item.style)}" data-dynamic-timezone="${escapeText(item.timezone)}"` : ''}>${decorationInner(item, escapeText)}</span>`; }).join('');
}
export function bindStudioDecorationTimeline(video) {
  const items = video.closest('.studioMedia')?.querySelectorAll('[data-decoration-start]') || [];
  const synchronize = () => items.forEach((item) => { const time = video.currentTime * 1000; item.hidden = time < Number(item.dataset.decorationStart || 0) || time > Number(item.dataset.decorationEnd || 600000); });
  video.addEventListener('timeupdate', synchronize); video.addEventListener('seeked', synchronize);
}

let clockTimer = 0;
function ensureClockUpdates() {
  if (typeof document === 'undefined' || clockTimer) return;
  clockTimer = setInterval(() => document.querySelectorAll('[data-dynamic-decoration="true"]').forEach((node) => { const index = Number(node.dataset.decorationIndex); const form = document.getElementById('composerForm'); const editorItem = Number.isSafeInteger(index) ? readStudioDecorations(form)[index] : null; const item = editorItem || { type:node.dataset.dynamicType, style:node.dataset.dynamicStyle, timezone:node.dataset.dynamicTimezone }; const span = node.querySelector(':scope > span'); if (item?.type && span) span.textContent = displayText(item); }), 1000);
}
function assistiveLayers(stage) {
  let vertical = stage.querySelector('.decorationGuideVertical'); let horizontal = stage.querySelector('.decorationGuideHorizontal'); let trash = stage.querySelector('.decorationTrash');
  if (!vertical) { vertical = document.createElement('i'); vertical.className = 'decorationGuide decorationGuideVertical'; stage.append(vertical); }
  if (!horizontal) { horizontal = document.createElement('i'); horizontal.className = 'decorationGuide decorationGuideHorizontal'; stage.append(horizontal); }
  if (!trash) { trash = document.createElement('div'); trash.className = 'decorationTrash'; trash.textContent = '⌫ Delete'; stage.append(trash); }
  return { vertical, horizontal, trash };
}
function controls(item, index, form, applyPreview) {
  const remove = document.createElement('button'); remove.type='button'; remove.className='decorationDelete'; remove.textContent='×'; remove.setAttribute('aria-label','Șterge');
  const resize = document.createElement('button'); resize.type='button'; resize.className='decorationResize'; resize.textContent='↗'; resize.setAttribute('aria-label','Redimensionează');
  const rotate = document.createElement('button'); rotate.type='button'; rotate.className='decorationRotate'; rotate.textContent='↻'; rotate.setAttribute('aria-label','Rotește'); item.append(remove,resize,rotate);
  const mutate = (callback) => { const next=readStudioDecorations(form); if (!next[index]) return; callback(next[index],next); writeStudioDecorations(form,next,applyPreview); };
  remove.onclick=(event)=>{ event.stopPropagation(); mutate((_entry,list)=>list.splice(index,1)); };
  resize.onclick=(event)=>{ event.stopPropagation(); mutate((entry)=>{ entry.scale=Number(Math.min(3,entry.scale+.2).toFixed(2)); }); };
  rotate.onclick=(event)=>{ event.stopPropagation(); mutate((entry)=>{ entry.rotation=(entry.rotation+15)%360; }); };
}
function bindGestures(item, index, stage, form, applyPreview) {
  const pointers=new Map(); const layers=assistiveLayers(stage); let hold=0; let initial=null; let moved=false;
  const show=(active)=>{ layers.vertical.classList.toggle('active',active); layers.horizontal.classList.toggle('active',active); layers.trash.classList.toggle('active',active); };
  item.addEventListener('pointerdown',(event)=>{
    if (event.target.closest?.('button') || (event.target!==item && event.target.parentElement!==item && event.target.tagName!=='IMG' && event.target.tagName!=='SPAN')) return;
    item.setPointerCapture?.(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); show(true); moved=false;
    const entry=readStudioDecorations(form)[index]; initial={ x:entry.x,y:entry.y,scale:entry.scale,rotation:entry.rotation,distance:0,angle:0 };
    if (pointers.size===1) hold=setTimeout(()=>{ if(moved)return; const next=readStudioDecorations(form); if(next.length<MAX_DECORATIONS){ const copy={...next[index],id:`${next[index].type.toLowerCase()}-${Date.now()}-copy`,x:Math.min(92,next[index].x+5),y:Math.min(88,next[index].y+5),zIndex:next.length+1}; next.push(copy); writeStudioDecorations(form,next,applyPreview); } },600);
  });
  item.addEventListener('pointermove',(event)=>{
    if(!pointers.has(event.pointerId)||!initial)return; const old=pointers.get(event.pointerId); if(Math.hypot(event.clientX-old.x,event.clientY-old.y)>4)moved=true; clearTimeout(hold); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const bounds=stage.getBoundingClientRect(); const values=[...pointers.values()];
    if(values.length===1){ let x=Math.max(5,Math.min(95,(event.clientX-bounds.left)/bounds.width*100)); let y=Math.max(5,Math.min(91,(event.clientY-bounds.top)/bounds.height*100)); const snapX=Math.abs(x-50)<2.5,snapY=Math.abs(y-50)<2.5; if(snapX)x=50;if(snapY)y=50; layers.vertical.classList.toggle('snap',snapX);layers.horizontal.classList.toggle('snap',snapY); item.style.left=`${x}%`;item.style.top=`${y}%`; }
    else { const [a,b]=values; const distance=Math.hypot(b.x-a.x,b.y-a.y); const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI; if(!initial.distance){initial.distance=distance;initial.angle=angle;} const scale=Math.max(.4,Math.min(3,initial.scale*distance/initial.distance)); const rotation=(initial.rotation+angle-initial.angle+360)%360; item.style.transform=`translate(-50%,-50%) rotate(${rotation}deg) scale(${scale})`; }
  });
  const finish=(event)=>{
    if(!pointers.has(event.pointerId))return; clearTimeout(hold); pointers.delete(event.pointerId); if(pointers.size)return; show(false); const bounds=stage.getBoundingClientRect(); const rect=item.getBoundingClientRect(); const next=readStudioDecorations(form); if(!next[index])return;
    const centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2; if((centerY-bounds.top)/bounds.height*100>91){next.splice(index,1);writeStudioDecorations(form,next,applyPreview);return;}
    next[index].x=Math.round(Math.max(5,Math.min(95,(centerX-bounds.left)/bounds.width*100))); next[index].y=Math.round(Math.max(5,Math.min(91,(centerY-bounds.top)/bounds.height*100)));
    const transform=item.style.transform; const rotation=/rotate\(([-\d.]+)deg/.exec(transform); const scale=/scale\(([-\d.]+)\)/.exec(transform); if(rotation)next[index].rotation=Math.round(Number(rotation[1])+360)%360;if(scale)next[index].scale=Number(Number(scale[1]).toFixed(2)); writeStudioDecorations(form,next,applyPreview);
  };
  item.addEventListener('pointerup',finish);item.addEventListener('pointercancel',finish);
  item.addEventListener('dblclick',()=>document.dispatchEvent(new CustomEvent('nexus:edit-decoration',{detail:{index}})));
  item.addEventListener('click',()=>openDecorationTimeline(index,stage,form,applyPreview));
}

function openDecorationTimeline(index,stage,form,applyPreview){
  const panel=document.getElementById('decorationTimeline');if(!panel||!stage.querySelector('video'))return;const start=panel.querySelector('[data-decoration-start-range]'),end=panel.querySelector('[data-decoration-end-range]'),startOutput=panel.querySelector('[data-decoration-start-output]'),endOutput=panel.querySelector('[data-decoration-end-output]');const item=readStudioDecorations(form)[index];if(!item)return;
  const video=stage.querySelector('video'),maximum=Math.max(.1,Math.min(600,Number.isFinite(video.duration)?video.duration:600));start.max=String(maximum);end.max=String(maximum);start.value=String(Math.min(maximum,item.startMs/1000));end.value=String(Math.min(maximum,item.endMs/1000));panel.hidden=false;
  const update=()=>{const from=Math.max(0,Math.min(Number(start.value),Number(end.value)-.1)),to=Math.min(maximum,Math.max(Number(end.value),from+.1));start.value=String(from);end.value=String(to);startOutput.textContent=`${from.toFixed(1)}s`;endOutput.textContent=`${to.toFixed(1)}s`;const next=readStudioDecorations(form);if(!next[index])return;next[index].startMs=Math.round(from*1000);next[index].endMs=Math.round(to*1000);writeStudioDecorations(form,next,applyPreview);};
  startOutput.textContent=`${Number(start.value).toFixed(1)}s`;endOutput.textContent=`${Number(end.value).toFixed(1)}s`;start.onchange=update;end.onchange=update;panel.querySelector('[data-decoration-timeline-close]').onclick=()=>{panel.hidden=true;};
}

export function renderStudioDecorations(stage, decorations, { form=null, applyPreview=null, interactive=false }={}) {
  stage?.querySelectorAll('.studioDecoration,.decorationGuide,.decorationTrash').forEach((node)=>node.remove()); ensureClockUpdates();
  decorations.map(normalized).forEach((decoration,index)=>{
    const item=document.createElement('span'); item.className=`studioDecoration decoration${decoration.type} style${decoration.style} animation${decoration.animation}`; item.dataset.decorationIndex=String(index); if(decoration.dynamic){item.dataset.dynamicDecoration='true';item.dataset.dynamicType=decoration.type;item.dataset.dynamicStyle=decoration.style;item.dataset.dynamicTimezone=decoration.timezone;} item.style.cssText=styleString(decoration);
    const asset=stickerById(decoration.assetId); if(asset){const image=document.createElement('img');image.src=asset.image;image.alt=asset.label;image.draggable=false;item.append(image);}else{const text=document.createElement('span');text.textContent=displayText(decoration);item.append(text);}
    if(interactive){item.tabIndex=0;item.setAttribute('role','button');item.setAttribute('aria-label',`${displayText(decoration)}. Mută sau atinge de două ori pentru editare`);controls(item,index,form,applyPreview);stage.append(item);bindGestures(item,index,stage,form,applyPreview);}else stage?.append(item);
  });
}

function closePanel(panel){panel.hidden=true;}
function addDecoration(form,applyPreview,item,panel){const next=readStudioDecorations(form);if(next.length>=MAX_DECORATIONS)return;next.push(normalized({...item,zIndex:next.length+1},next.length));writeStudioDecorations(form,next,applyPreview);if(panel)closePanel(panel);}

export function bindStickerCatalogue({form,applyPreview}){
  const panel=document.querySelector('[data-review-panel="stickers"]');if(!panel)return;const categories=panel.querySelector('[data-sticker-categories]');const grid=panel.querySelector('[data-sticker-grid]');const search=panel.querySelector('[data-sticker-search]');const more=panel.querySelector('[data-sticker-more]');
  let active='Recommended',page=0,query='';const recentKey='nexus:reel-stickers:recent:v2',favoritesKey='nexus:reel-stickers:favorites:v2';
  const readIds=(key)=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.slice(0,100):[];}catch{return[];}};const saveIds=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value.slice(0,100)));}catch{}};
  const add=(sticker)=>{addDecoration(form,applyPreview,decorate(sticker.animated?'GIF':'STICKER',{assetId:sticker.assetId,animation:sticker.animated?'pulse':'none'}),panel);saveIds(recentKey,[sticker.id,...readIds(recentKey).filter((id)=>id!==sticker.id)]);};
  const paint=(append=false)=>{let result;if(active==='Favorites'||active==='Recent'){const ids=readIds(active==='Favorites'?favoritesKey:recentKey);const items=ids.map(stickerById).filter(Boolean).filter((item)=>!query||item.label.toLowerCase().includes(query.toLowerCase()));result={items:items.slice(page*48,page*48+48),hasMore:(page+1)*48<items.length};}else result=stickerCatalogPage({category:active,query,page});if(!append)grid.replaceChildren();const favoriteIds=new Set(readIds(favoritesKey));result.items.forEach((sticker)=>{const cell=document.createElement('article');cell.className='stickerCell';const choose=document.createElement('button');choose.type='button';choose.className='stickerChoose';const image=document.createElement('img');image.src=sticker.image;image.alt=sticker.label;image.loading='lazy';choose.append(image);choose.onclick=()=>add(sticker);const favorite=document.createElement('button');favorite.type='button';favorite.className='stickerFavorite';favorite.textContent=favoriteIds.has(sticker.id)?'♥':'♡';favorite.setAttribute('aria-label','Favorite');favorite.onclick=()=>{const ids=readIds(favoritesKey),has=ids.includes(sticker.id);saveIds(favoritesKey,has?ids.filter((id)=>id!==sticker.id):[sticker.id,...ids]);favorite.textContent=has?'♡':'♥';};cell.append(choose,favorite);grid.append(cell);});more.hidden=!result.hasMore;};
  const categoryList=['Favorites','Recommended','Recent',...STICKER_CATEGORIES.filter((entry)=>entry!=='Recommended')];const icons={Favorites:'☆',Recommended:'▣',Recent:'◴',GIF:'GIF',Emoji:'☺',Funny:'😂',Reactions:'♡',Love:'♥',Animals:'🐾',Food:'◉',Travel:'✈',Celebration:'✦',Memes:'M',Weather:'☀',Time:'◷',Location:'⌖'};
  categoryList.forEach((category)=>{const button=document.createElement('button');button.type='button';button.innerHTML=`<i>${icons[category]||'•'}</i><span>${category}</span>`;button.className=category===active?'active':'';button.onclick=()=>{active=category;page=0;categories.querySelectorAll('button').forEach((entry)=>entry.classList.toggle('active',entry===button));paint();};categories.append(button);});
  panel.querySelectorAll('[data-functional-sticker]').forEach((button)=>button.addEventListener('click',()=>{const kind=button.dataset.functionalSticker;if(kind==='location'){closePanel(panel);document.querySelector('[data-review-tool="location"]')?.click();return;}if(kind==='gif'){active='GIF';page=0;paint();return;}const presets={mention:decorate('MENTION',{text:'@mention',style:'pill',background:'#ffffff',color:'#111111'}),hashtag:decorate('HASHTAG',{text:'#hashtag',style:'pill',background:'#ffffff',color:'#111111'}),poll:decorate('POLL',{text:'📊 Poll',style:'pill',background:'#ffffff',color:'#111111'}),donation:decorate('DONATION',{text:'💎 Donation',style:'pill',background:'#ffffff',color:'#111111'}),'live-time':decorate('TIME',{style:'live',dynamic:true,background:'#ffffff',color:'#111111'}),'digital-clock':decorate('TIME',{style:'digital',dynamic:true,background:'transparent'}),'analog-clock':decorate('TIME',{style:'analog',dynamic:true,background:'transparent'}),date:decorate('DATE',{style:'date',dynamic:true,background:'transparent'})};if(presets[kind])addDecoration(form,applyPreview,presets[kind],panel);}));
  search.addEventListener('input',()=>{query=search.value.trim();page=0;paint();});more.addEventListener('click',()=>{page+=1;paint(true);});paint();
}

export function bindTextEditor({form,applyPreview}){
  const panel=document.querySelector('[data-review-panel="text"]');if(!panel)return;const input=panel.querySelector('[data-review-text]');let activeIndex=null;let draft=decorate('TEXT',{style:'classic'});
  const sync=()=>{const value=input.value.slice(0,120);if(!value&&activeIndex===null)return;const next=readStudioDecorations(form);if(activeIndex===null){activeIndex=next.length;next.push({...draft,text:value,zIndex:next.length+1});}else if(next[activeIndex])next[activeIndex]={...next[activeIndex],...draft,text:value,id:next[activeIndex].id};writeStudioDecorations(form,next,applyPreview);};
  const open=(index=null)=>{activeIndex=Number.isSafeInteger(index)?index:null;const item=activeIndex===null?decorate('TEXT',{style:'classic'}):readStudioDecorations(form)[activeIndex];draft={...item};input.value=item?.text||'';panel.hidden=false;setTimeout(()=>input.focus(),0);};
  document.querySelector('[data-review-tool="text"]')?.addEventListener('click',()=>open());document.addEventListener('nexus:edit-decoration',(event)=>{const item=readStudioDecorations(form)[event.detail.index];if(item?.type==='TEXT')open(event.detail.index);});
  input.addEventListener('input',sync);panel.querySelectorAll('[data-text-style]').forEach((button)=>button.addEventListener('click',()=>{draft.style=button.dataset.textStyle;panel.querySelectorAll('[data-text-style]').forEach((entry)=>entry.classList.toggle('active',entry===button));sync();}));
  panel.querySelectorAll('[data-text-color]').forEach((button)=>button.addEventListener('click',()=>{draft.color=button.dataset.textColor;sync();}));panel.querySelector('[data-text-background]')?.addEventListener('click',()=>{draft.background=draft.background==='transparent'?'#111111cc':'transparent';sync();});panel.querySelector('[data-text-align]')?.addEventListener('click',()=>{draft.align=draft.align==='left'?'center':draft.align==='center'?'right':'left';sync();});
  panel.querySelector('[data-text-done]')?.addEventListener('click',()=>{sync();closePanel(panel);});panel.querySelector('[data-text-mention]')?.addEventListener('click',()=>{input.value+=' @';sync();input.focus();});panel.querySelector('[data-text-pov]')?.addEventListener('click',()=>{input.value=input.value?`${input.value} POV`:'POV';sync();input.focus();});
}

export function bindLocationSticker({form,applyPreview,api}){
  const panel=document.querySelector('[data-review-panel="location"]');if(!panel)return;const status=panel.querySelector('[data-location-status]'),results=panel.querySelector('[data-location-results]'),manual=panel.querySelector('[data-location-manual]'),addManual=panel.querySelector('[data-location-add]'),search=panel.querySelector('[data-location-search]');let coords=null,precision='area',style='pill-light',lastResults=[];
  const add=(label)=>{const value=safeText(label,116);if(value)addDecoration(form,applyPreview,decorate('LOCATION',{text:`📍 ${value}`,style,locationPrecision:precision,background:style==='pill-light'?'#ffffff':style==='pill-dark'?'#111111cc':'transparent',color:style==='pill-light'?'#111111':'#ffffff'}),panel);};
  const paint=(items)=>{lastResults=Array.isArray(items)?items:lastResults;results.replaceChildren();lastResults.filter((item)=>!item.type||item.type===precision||!['exact','area','city'].includes(item.type)).forEach((item)=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.onclick=()=>add(item.label);results.append(button);});};
  panel.querySelectorAll('[data-location-precision]').forEach((button)=>button.addEventListener('click',()=>{precision=button.dataset.locationPrecision;panel.querySelectorAll('[data-location-precision]').forEach((entry)=>entry.classList.toggle('active',entry===button));paint(lastResults);}));panel.querySelectorAll('[data-location-style]').forEach((button)=>button.addEventListener('click',()=>{style=button.dataset.locationStyle;panel.querySelectorAll('[data-location-style]').forEach((entry)=>entry.classList.toggle('active',entry===button));}));
  panel.querySelector('[data-location-gps]')?.addEventListener('click',()=>{if(!navigator.geolocation){status.textContent='GPS indisponibil. Scrie locația manual.';return;}status.textContent='Se caută locația…';navigator.geolocation.getCurrentPosition(async({coords:position})=>{coords={lat:position.latitude,lon:position.longitude};status.textContent='Alege locația pe care vrei s-o afișezi.';try{const response=await api(`/api/location/suggestions?kind=reverse&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`);paint(response?.ok?response.suggestions:[]);}catch{status.textContent='Adresa nu a putut fi verificată. Folosește textul manual.';}},(error)=>{status.textContent=error?.code===1?'Permisiunea GPS a fost refuzată. Scrie locația manual.':'GPS indisponibil. Încearcă din nou.';},{enableHighAccuracy:false,timeout:9000,maximumAge:300000});});
  search?.addEventListener('click',async()=>{const query=manual.value.trim();if(!query)return;status.textContent='Se caută…';try{const response=await api(`/api/location/suggestions?kind=search&q=${encodeURIComponent(query)}`);paint(response?.ok?response.suggestions:[]);status.textContent=response?.ok?'Alege un rezultat sau folosește textul tău.':'Nicio locație găsită.';}catch{status.textContent='Căutarea nu este disponibilă. Folosește textul tău.';}});
  panel.querySelectorAll('[data-location-nearby]').forEach((button)=>button.addEventListener('click',async()=>{if(!coords){status.textContent='Activează GPS pentru locuri apropiate.';return;}status.textContent='Se caută în apropiere…';try{const response=await api(`/api/location/suggestions?kind=${encodeURIComponent(button.dataset.locationNearby)}&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`);paint(response?.ok?response.suggestions:[]);}catch{status.textContent='Locurile apropiate nu sunt disponibile.';}}));addManual.addEventListener('click',()=>add(manual.value));
}
