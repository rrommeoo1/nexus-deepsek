import { applyTransform, defaultTransform, creatorFilterCss } from './creator-transform.js?v=20261001-publish1';
import { renderStudioDecorations } from './reel-editor-overlays.js?v=20261001-publish1';
export function publishingCaption(post,esc){const p=post.publishing;if(!p)return '';return (p.title?'<b class="publishedTitle">'+esc(p.title)+'</b>':'')+(p.location?'<small class="publishedLocation">⌖ '+esc(p.location)+'</small>':'')+(p.link&&p.link.startsWith('https://')?'<a class="publishedLink" href="'+esc(p.link)+'" target="_blank" rel="noopener noreferrer">↗ '+esc(new URL(p.link).hostname)+'</a>':'');}
export function applyPublishedEdits(stage,post){
  const m=post.creator_studio?.integrity==='VERIFIED'?post.creator_studio.manifest:null;if(!m)return;
  const asset=stage.querySelector(':scope > video,:scope > img');if(!asset)return;
  const t={...defaultTransform(),...m.transform};applyTransform(stage,asset,t);asset.dataset.originalVolume=String(m.muteOriginal?0:t.originalVolume);
  asset.style.filter=creatorFilterCss(m);
  renderStudioDecorations(stage,m.decorations||[],{interactive:false});
  if(m.overlay?.text){const text=document.createElement('span');text.className='studioOverlay overlay'+m.overlay.position+' color'+m.overlay.color;text.textContent=m.overlay.text;stage.append(text);}
  const audio=stage.querySelector('audio');if(audio)audio.volume=t.musicVolume;
  if(asset.tagName==='VIDEO'){asset.volume=m.muteOriginal?0:t.originalVolume;asset.playbackRate=m.playbackRate||1;const start=(m.trimStartMs||0)/1000,end=(m.trimEndMs||600000)/1000;asset.addEventListener('loadedmetadata',()=>{asset.currentTime=start;});asset.addEventListener('timeupdate',()=>{if(asset.currentTime>=end)asset.currentTime=start;stage.querySelectorAll('.studioDecoration').forEach((node,index)=>{const d=m.decorations[index];if(d)node.hidden=asset.currentTime*1000<d.startMs||asset.currentTime*1000>d.endMs;});});}
}
// Image posts have no video clock: play only while their own visible surface is active.
export function wireImageSound(root,muted=true){
  root.querySelectorAll('.jamendoSound audio').forEach(audio=>{
    const studio=audio.closest('.studioSound')?.previousElementSibling;
    if(studio?.dataset.musicVolume!=null)audio.volume=Number(studio.dataset.musicVolume);
    if(audio.dataset.imageSoundBound)return;
    const surface=audio.closest('.viewerStage,.clipStage,article');
    const image=surface?.querySelector('img.media,:scope > img');
    if(!image||surface.querySelector('video'))return;
    audio.dataset.imageSoundBound='1';audio.muted=muted;
    const offset=Number(audio.dataset.jamendoOffset||0),duration=Math.max(15,Math.min(60,Number(audio.dataset.jamendoSegment||30)));
    const loop=()=>{if(audio.currentTime>=offset+duration||audio.currentTime<offset)audio.currentTime=offset;};audio.addEventListener('timeupdate',loop);
    let visible=false;const update=()=>{const active=surface.isConnected&&visible&&!document.hidden&&(surface.closest('.mediaViewer')||!document.querySelector('.mediaViewer'));if(active)audio.play().catch(()=>{});else audio.pause();};
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.intersectionRatio>=.65;update();},{threshold:[0,.65]});observer.observe(image);
    document.addEventListener('visibilitychange',update);
    const removed=new MutationObserver(()=>{if(surface.isConnected){update();return;}observer.disconnect();removed.disconnect();audio.pause();audio.removeEventListener('timeupdate',loop);document.removeEventListener('visibilitychange',update);});removed.observe(document.body,{childList:true,subtree:true});
  });
}
