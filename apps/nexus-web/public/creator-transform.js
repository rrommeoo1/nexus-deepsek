export const defaultTransform=()=>({rotation:0,zoom:1,x:50,y:50,ratio:0,originalVolume:1,musicVolume:.7});
export function creatorFilterCss(manifest){
  if(!manifest)return 'none';const amount=Math.max(0,Math.min(100,Number(manifest.intensity||0)))/100;
  if(manifest.filter==='VIVID')return `saturate(${(1+amount*.8).toFixed(2)}) contrast(${(1+amount*.18).toFixed(2)})`;
  if(manifest.filter==='WARM')return `sepia(${(amount*.35).toFixed(2)}) saturate(${(1+amount*.45).toFixed(2)})`;
  if(manifest.filter==='COOL')return `hue-rotate(${Math.round(amount*12)}deg) saturate(${(1+amount*.25).toFixed(2)})`;
  if(manifest.filter==='MONO')return `grayscale(${amount.toFixed(2)})`;
  if(manifest.filter==='HIGH_CONTRAST')return `contrast(${(1+amount*.8).toFixed(2)})`;return 'none';
}
export function readTransform(form){try{return {...defaultTransform(),...JSON.parse(form.elements.studio_transform?.value||'{}')};}catch{return defaultTransform();}}
export function transformCss(value={}){const t={...defaultTransform(),...value};return `transform:rotate(${Number(t.rotation)}deg) scale(${Number(t.zoom)});object-position:${Number(t.x)}% ${Number(t.y)}%;`;}
export function applyTransform(stage,asset,value){asset.style.transform=`rotate(${value.rotation}deg) scale(${value.zoom})`;asset.style.objectPosition=`${value.x}% ${value.y}%`;stage.style.aspectRatio=value.ratio>0?String(value.ratio):'';if(asset.tagName==='VIDEO'){asset.volume=value.originalVolume;asset.muted=value.originalVolume===0;} }
export function bindTransformEditor(form,applyPreview){
  const nav=document.querySelector('.cameraReviewTools');if(!nav)return;
  for(const [key,label,icon] of [['crop','Crop','⌗'],['volume','Volume','♫']]){
    const button=document.createElement('button');button.type='button';button.innerHTML=`<i>${icon}</i><span>${label}</span>`;nav.append(button);
    const panel=document.createElement('section');panel.className='cameraReviewPanel compact';panel.dataset.reviewPanel=key;panel.hidden=true;
    panel.innerHTML=`<header><b>${label}</b><button type="button" data-transform-close>×</button></header>`+(key==='crop'?`<div class="cropRatios"><button type="button" data-crop="ORIGINAL">Original</button><button type="button" data-crop="VERTICAL_9_16">9:16</button><button type="button" data-crop="SQUARE_1_1">1:1</button><button type="button" data-crop="PORTRAIT_4_5">4:5</button><button type="button" data-crop="FREE">Free</button><button type="button" data-rotate>↻ 90°</button></div><label>Cadru liber<input data-transform="ratio" type="range" min="0.4" max="2.4" step=".05" value="1" hidden></label><label>Zoom<input data-transform="zoom" type="range" min="1" max="3" step=".05" value="1"></label><label>Orizontal<input data-transform="x" type="range" min="0" max="100" value="50"></label><label>Vertical<input data-transform="y" type="range" min="0" max="100" value="50"></label>`:`<label>Sunet original<input data-transform="originalVolume" type="range" min="0" max="1" step=".05" value="1"></label><label>Muzică<input data-transform="musicVolume" type="range" min="0" max="1" step=".05" value=".7"></label>`);
    document.getElementById('cameraReviewActions').append(panel);button.onclick=()=>{document.querySelectorAll('[data-review-panel]').forEach(node=>{node.hidden=true;});panel.hidden=false;const value=readTransform(form);panel.querySelectorAll('[data-transform]').forEach(input=>{input.value=value[input.dataset.transform];});};
    panel.querySelector('[data-transform-close]').onclick=()=>{panel.hidden=true;};
    const update=(patch)=>{const next={...readTransform(form),...patch};form.elements.studio_transform.value=JSON.stringify(next);form.dispatchEvent(new Event('input',{bubbles:true}));applyPreview();const audio=document.querySelector('#reelAutoSound audio');if(audio)audio.volume=next.musicVolume;};
    panel.querySelectorAll('[data-transform]').forEach(input=>input.oninput=()=>update({[input.dataset.transform]:Number(input.value)}));
    panel.querySelectorAll('[data-crop]').forEach(item=>item.onclick=()=>{const free=item.dataset.crop==='FREE';form.elements.studio_aspect.value=free?'ORIGINAL':item.dataset.crop;panel.querySelector('[data-transform="ratio"]').hidden=!free;update({ratio:free?1:0});});
    panel.querySelector('[data-rotate]')?.addEventListener('click',()=>update({rotation:(readTransform(form).rotation+90)%360}));
  }
}
