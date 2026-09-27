"use client";

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, @next/next/no-img-element, react-hooks/refs */

import { ChangeEvent, KeyboardEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

type ModuleId = "clips" | "profiles" | "market" | "chat" | "creator" | "prive" | "pay" | "dating" | "stream" | "kids" | "signal" | "work" | "stay" | "ride" | "beauty" | "music" | "wellbeing" | "node";
type Module = { id: ModuleId; icon: string; name: string; section: string; color: string; tag: string; features: string[] };
type ProfileMode = "social" | "work" | "dating" | "travel" | "market";
type NavSlot = "primary" | "inbox" | "create" | "utility" | "switch";
type ComposerMode = ProfileMode;
type Flash = (s: string) => void;
type Session = { handle: string; name: string; profile: ProfileMode; at: string };
type Fx = { brightness: number; contrast: number; saturate: number; sepia: number; blur: number; grayscale: number };
type MediaItem = { id: string; url: string; name: string; type: "image" | "video"; source: "camera" | "file"; fx: Fx };

const modules: Module[] = [
  { id:"clips", icon:"▶", name:"Pulse", section:"SOCIAL", color:"#20e0d0", tag:"Clips, posts, stories and live in one flow", features:["Near · For You · Global · Breaking","Camera, video, photo and text","Sounds, effects, duet and stitch","Free reactions + optional support"] },
  { id:"profiles", icon:"◎", name:"Profiles", section:"IDENTITY", color:"#20e0d0", tag:"One account. Many independent versions of you.", features:["Social, Work, Dating, Travel, Market","Instant profile switch","Independent privacy and audiences","Incognito sessions"] },
  { id:"market", icon:"◇", name:"Market", section:"COMMERCE", color:"#ffb94e", tag:"Buy and sell almost anything legal", features:["Local and worldwide listings","Photos, categories and offers","Verified reviews and seller trust","Stablecoin / EGLD escrow"] },
  { id:"chat", icon:"••", name:"Messages", section:"COMMUNICATION", color:"#20e0d0", tag:"All conversations, calls and meetings in one place", features:["Private and group chat","Video calls and scheduled meetings","Disappearing media","Cross-profile consent"] },
  { id:"creator", icon:"↟", name:"Creator", section:"EARN", color:"#20e0d0", tag:"Transparent creator earnings", features:["Tips and memberships","Creator reward pool","Transparent payout split","Organic and supporter rankings"] },
  { id:"prive", icon:"18", name:"Privé 18+", section:"ADULT WEB", color:"#a653ff", tag:"Adult-only, consent-first creator space", features:["Age and identity gate","Free discovery and paid posts","Paid live and private calls","Geo, consent and leak controls"] },
  { id:"pay", icon:"$", name:"Nexus Pay", section:"PAYMENTS", color:"#20e0d0", tag:"Pay a verified username instantly", features:["EUR / USD stablecoins","EGLD and ESDT support","Username resolution","Signed settlement receipt"] },
  { id:"dating", icon:"♥", name:"Dating", section:"CONNECTIONS", color:"#ff4e83", tag:"Compatibility, discretion and safety before meeting", features:["Inclusive intentions and preferences","Serious Intent Score","Expiring photos","Safety check-in"] },
  { id:"stream", icon:"◉", name:"Watch", section:"VIDEO", color:"#ff5267", tag:"Long video, channels and live", features:["Video upload and channels","Live, premieres and VOD","Playlists and subscriptions","Moderated live chat"] },
  { id:"kids", icon:"★", name:"Kids", section:"FAMILY", color:"#ffc44e", tag:"Curated, parent-controlled video", features:["Age-banded catalogue","No public messages","Screen-time limits","Parent dashboard"] },
  { id:"signal", icon:"#", name:"Signal", section:"PUBLIC CONVERSATION", color:"#d8e6f2", tag:"Posts, threads and public conversations", features:["Posts, media and threads","Communities and audio rooms","Near and global topics","Verifiable pseudonyms"] },
  { id:"work", icon:"▣", name:"Work", section:"PROFESSIONAL", color:"#36afff", tag:"Professional identity, network and jobs", features:["CV and portfolio","Jobs and networking","Skill credentials","Work filter in unified messages"] },
  { id:"stay", icon:"⌂", name:"Stay", section:"TRAVEL", color:"#25d9aa", tag:"Verified stays and experiences", features:["Create property listings","Calendar and pricing","Booking escrow","Verified stay reviews"] },
  { id:"ride", icon:"↗", name:"Ride", section:"MOBILITY", color:"#68e77b", tag:"Simple verified ride sharing", features:["Driver matching","Live trip status","Safety contact","Stablecoin settlement"] },
  { id:"beauty", icon:"✦", name:"Beauty", section:"BOOKING", color:"#ee8cff", tag:"Book trusted professionals near you", features:["Business pages","Staff portfolios","Live availability","Deposit escrow"] },
  { id:"music", icon:"♫", name:"Music", section:"AUDIO", color:"#43df80", tag:"Listen, create and attribute", features:["Tracks and playlists","Add audio to posts","Rights-aware upload","Support the artist"] },
  { id:"wellbeing", icon:"＋", name:"Wellbeing", section:"HEALTH & LEARNING", color:"#72e9e2", tag:"Sport, nutrition and learning", features:["Single-session workouts","Nutrition journal","Courses and learning paths","Private progress"] },
  { id:"node", icon:"N", name:"Node Network", section:"DECENTRALIZED", color:"#8ca2ff", tag:"From one community node to thousands", features:["Signed event log","State-root checkpoints","Backup and restore","Permissionless roadmap"] },
];

const profiles: Array<{id:ProfileMode;name:string;detail:string;icon:string;color:string}> = [
  {id:"social",name:"Social",detail:"Public vibe",icon:"SK",color:"#9a61ff"},
  {id:"work",name:"Work",detail:"Professional",icon:"WK",color:"#2fb7ff"},
  {id:"dating",name:"Dating",detail:"Find connections",icon:"♥",color:"#ff4f7d"},
  {id:"travel",name:"Travel",detail:"Explore the world",icon:"✈",color:"#32d6d0"},
  {id:"market",name:"Market",detail:"Buy & sell",icon:"◇",color:"#ffb94e"},
];
const profileTitles:Record<ProfileMode,string>={social:"Social",work:"Work",dating:"Dating",travel:"Travel",market:"Market"};
const profilePolicies:Record<ProfileMode,{visibility:string;contacts:string;connections:string;activity:string}>={
  social:{visibility:"Public",contacts:"Friends + follows",connections:"Social circle",activity:"Friends"},
  work:{visibility:"Public professional",contacts:"Network + recruiters",connections:"Work network",activity:"Visible"},
  dating:{visibility:"Private discovery",contacts:"Matches only",connections:"Dating connections",activity:"Hidden"},
  travel:{visibility:"Guests + hosts",contacts:"Bookings + travel circle",connections:"Travel contacts",activity:"Trips only"},
  market:{visibility:"Public seller",contacts:"Buyers + sellers",connections:"Marketplace contacts",activity:"Listings only"},
};
const primaryTarget:Record<ProfileMode,ModuleId>={social:"clips",work:"work",dating:"dating",travel:"stay",market:"market"};
const utilityTarget:Record<ProfileMode,ModuleId>={social:"stream",work:"work",dating:"dating",travel:"stay",market:"market"};
const navItems:Record<ProfileMode,Array<[NavSlot,string,string]>>={
  social:[["primary","◫","Pulse"],["inbox","◌","Messages"],["create","＋","Create"],["utility","◉","Live"],["switch","◎","Switch"]],
  work:[["primary","▤","Feed"],["inbox","◌","Messages"],["create","＋","Create"],["utility","▣","Jobs"],["switch","◎","Switch"]],
  dating:[["primary","♥","Discover"],["inbox","◌","Messages"],["create","＋","Moment"],["utility","✦","Connections"],["switch","◎","Switch"]],
  travel:[["primary","⌂","Explore"],["inbox","◌","Messages"],["create","＋","List"],["utility","✈","Trips"],["switch","◎","Switch"]],
  market:[["primary","◇","Browse"],["inbox","◌","Messages"],["create","＋","Sell"],["utility","▦","Orders"],["switch","◎","Switch"]],
};
const products = [
  ["Wireless Headphones","65 USDC","headphones"], ["Mountain Backpack","45 USDC","bag"],
  ["City Commuter Bike","120 USDC","bike"], ["Minimalist Watch","80 USDC","watch"],
];
const chats = [
  ["LunaKai","Loved your latest clip! 🔥","9:41","2","#a45fff","Social"], ["Digital Nomads","Kai: Check out this place","9:32","2","#2fc3ef","Travel"],
  ["Work Projects","Your deck is ready","9:15","1","#4aa5ff","Work"], ["Maya","Would Thursday work for coffee?","Yesterday","","#ffb056","Dating"],
  ["Bike buyer","Is the commuter bike available?","Yesterday","","#d98b28","Market"],
];
const defaultFx:Fx={brightness:100,contrast:100,saturate:100,sepia:0,blur:0,grayscale:0};
const fxToFilter=(f:Fx)=>`brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) sepia(${f.sepia}%) blur(${f.blur}px) grayscale(${f.grayscale}%)`;
const SOUNDS=["None","Pop","Chime","Kick","Snap","Whoosh","Rise"];

function usePersistentState<T>(key:string, initial:T){
  const [value,setValue]=useState<T>(()=>{ try{ if(typeof window==="undefined") return initial; const raw=localStorage.getItem(key); return raw?JSON.parse(raw) as T : initial; }catch{ return initial; } });
  useEffect(()=>{ try{ if(typeof window!=="undefined") localStorage.setItem(key, JSON.stringify(value)); }catch{ /* ignore */ } },[key,value]);
  return [value,setValue] as const;
}

function ensureAudio():AudioContext|null{
  if(typeof window==="undefined") return null;
  const w=window as unknown as {AudioContext?:typeof AudioContext; webkitAudioContext?:typeof AudioContext; __nexusAudio?:AudioContext};
  if(w.__nexusAudio) return w.__nexusAudio;
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if(!Ctor) return null;
  w.__nexusAudio = new Ctor();
  return w.__nexusAudio;
}
function playTone(freq:number,type:OscillatorType,dur=0.25,vol=0.2){
  const ctx=ensureAudio(); if(!ctx) return;
  const t=ctx.currentTime; const o=ctx.createOscillator(); const g=ctx.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+dur+0.03);
}
function playNoise(dur=0.3,vol=0.15){
  const ctx=ensureAudio(); if(!ctx) return;
  const t=ctx.currentTime; const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src=ctx.createBufferSource(); src.buffer=buf; const g=ctx.createGain(); g.gain.value=vol; src.connect(g); g.connect(ctx.destination); src.start(t);
}
function playSweep(start:number,end:number,dur=0.5,vol=0.2){
  const ctx=ensureAudio(); if(!ctx) return;
  const t=ctx.currentTime; const o=ctx.createOscillator(); const g=ctx.createGain();
  o.type="sine"; o.frequency.setValueAtTime(start,t); o.frequency.exponentialRampToValueAtTime(end,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+dur+0.03);
}
function playSound(name:string){
  if(name==="Pop") playTone(600,"square",0.12,0.25);
  if(name==="Chime"){ playTone(660,"sine",0.4,0.18); setTimeout(()=>playTone(880,"sine",0.45,0.14),90); }
  if(name==="Kick") playTone(120,"sine",0.3,0.4);
  if(name==="Snap") playNoise(0.08,0.3);
  if(name==="Whoosh") playNoise(0.5,0.16);
  if(name==="Rise") playSweep(200,900,0.6,0.18);
}
function capturePhoto(video:HTMLVideoElement):string{
  const canvas=document.createElement("canvas"); const w=640; const h=Math.max(480,Math.round((video.videoHeight||480)/(video.videoWidth||640)*w));
  canvas.width=w; canvas.height=h; const ctx=canvas.getContext("2d"); if(ctx) ctx.drawImage(video,0,0,w,h);
  return canvas.toDataURL("image/jpeg",0.85);
}
function useCamera(active:boolean){
  const nodeRef=useRef<HTMLVideoElement|null>(null); const streamRef=useRef<MediaStream|null>(null);
  const [status,setStatus]=useState<"idle"|"ready"|"error">("idle");
  useEffect(()=>{
    if(!active) return;
    let cancelled=false;
    const md=typeof navigator!=="undefined" ? navigator.mediaDevices : undefined;
    const p = (md && md.getUserMedia) ? md.getUserMedia({video:true,audio:false}) : Promise.reject(new Error("no camera"));
    p.then(stream=>{ if(cancelled){ stream.getTracks().forEach(t=>t.stop()); return; } streamRef.current=stream; if(nodeRef.current) nodeRef.current.srcObject=stream; setStatus("ready"); })
     .catch(()=>{ if(!cancelled) setStatus("error"); });
    return ()=>{ cancelled=true; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; };
  },[active]);
  const setNode=useCallback((el:HTMLVideoElement|null)=>{ nodeRef.current=el; if(el && streamRef.current) el.srcObject=streamRef.current; },[]);
  const capture=()=> nodeRef.current ? capturePhoto(nodeRef.current) : null;
  return {setNode, ready:status==="ready", error:status==="error", capture};
}

function trapDialogFocus(event:KeyboardEvent<HTMLElement>, onClose:()=>void) {
  if(event.key==="Escape"){event.preventDefault();onClose();return}
  if(event.key!=="Tab") return;
  const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(item=>!item.hidden);
  if(!focusable.length) return;
  const first=focusable[0]; const last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}

function useFocusReturn(active:boolean) {
  const opener=useRef<HTMLElement|null>(null);
  const previous=useRef(active);
  useEffect(()=>{if(active&&!previous.current) opener.current=document.activeElement as HTMLElement; if(!active&&previous.current) opener.current?.focus(); previous.current=active},[active]);
}

function useDialogFocus<T extends HTMLElement>(active:boolean) {
  const dialog=useRef<T|null>(null);
  useEffect(()=>{if(active) dialog.current?.focus()},[active]);
  return dialog;
}

function Sheet({ id, title, subtitle, onClose, children }:{ id:string; title:string; subtitle:string; onClose:()=>void; children:ReactNode }) {
  const dialog=useDialogFocus<HTMLDivElement>(true);
  return <div ref={dialog} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}Title`} onKeyDown={event=>trapDialogFocus(event,onClose)}>
    <header className="sheetHead"><button onClick={onClose} aria-label={`Close ${title}`}>×</button><span><b id={`${id}Title`}>{title}</b><small>{subtitle}</small></span></header>
    <div className="sheetBody">{children}</div>
  </div>;
}

function AppHeader({ profile, onMenu, onCreate, onSwitch, onSearch, onNotes, onAccount, session }:{ profile:ProfileMode; onMenu:()=>void; onCreate:()=>void; onSwitch:()=>void; onSearch:()=>void; onNotes:()=>void; onAccount:()=>void; session:Session|null }) {
  return <header className="appHeader">
    <button className="wordmark" onClick={onMenu} aria-label="Open all Nexus modules">NE<span>X</span>US</button>
    <button className={`modeBadge ${profile}`} onClick={onSwitch}><i>{profiles.find(item=>item.id===profile)?.icon}</i><span>{profileTitles[profile]}</span><b>⌄</b></button>
    <div className="statusIcons"><button onClick={onCreate} aria-label="Create">＋</button><button onClick={onSearch} aria-label="Search">⌕</button><button onClick={onNotes} aria-label="Notifications">♢</button><button onClick={onAccount} aria-label="Account" className={`accountBtn ${session?"logged":""}`}>{session?session.handle.slice(0,2).replace("@",""):"♙"}</button></div>
  </header>;
}

function AppNav({ profile, activeSlot, onSelect }:{ profile:ProfileMode; activeSlot:NavSlot; onSelect:(slot:NavSlot)=>void }) {
  return <nav className={`appNav ${profile}`} aria-label={`${profileTitles[profile]} navigation`}>{navItems[profile].map(([slot,icon,label]) => <button key={slot} className={`${activeSlot===slot?"active":""} ${slot==="create"?"createNav":""}`} onClick={()=>onSelect(slot)} aria-label={label} aria-current={activeSlot===slot?"page":undefined}><i>{icon}</i><span>{label}</span></button>)}</nav>;
}

function ClipsScreen({ onTip, onCreate, flash }:{ onTip:()=>void; onCreate:()=>void; flash:Flash }) {
  const [liked,setLiked]=useState(false); const [follow,setFollow]=useState(false); const [saved,setSaved]=useState(false); const [format,setFormat]=useState<"Clips"|"Posts">("Clips"); const [lens,setLens]=useState("For You"); const [reaction,setReaction]=useState("♥"); const [reactionsOpen,setReactionsOpen]=useState(false);
  return <div className="screen clipsScreen">
    <div className="stories"><button onClick={onCreate}><i>＋</i><span>Your story</span></button>{["Luna","Alex","Maya","Kai"].map((n,i)=><button key={n} onClick={()=>flash(`${n}'s story · synthetic day`)}><i className={`storyAvatar a${i}`}>{n[0]}</i><span>{n}</span></button>)}</div>
    <div className="lensNav" role="tablist" aria-label="Discovery lens">{["Near","For You","Global","Breaking"].map(item=><button role="tab" aria-selected={lens===item} key={item} className={lens===item?"active":""} onClick={()=>setLens(item)}>{item}</button>)}</div>
    <div className="feedTabs" role="tablist" aria-label="Pulse content type"><strong>Pulse</strong>{(["Clips","Posts"] as const).map(item=><button role="tab" aria-selected={format===item} key={item} className={format===item?"active":""} onClick={()=>setFormat(item)}>{item}</button>)}<button className="feedCreate" onClick={onCreate} aria-label="Create a clip, photo or post">＋</button></div>
    {format==="Clips"?<div className="clipVisual">
      <div className="clipShade"/><span className="onchain">✓ Demo action proof</span><button className="trustLens" onClick={()=>flash("Demo Trust Lens · synthetic AI likelihood 8% · 2 synthetic sources")}>◇ Demo Trust Lens · AI 8%</button>{lens==="Breaking"&&<span className="breakingBadge">DEMO BREAKING · 3 synthetic sources</span>}
      <div className="clipActions"><button aria-label="Choose reaction" aria-pressed={liked} onClick={()=>{setLiked(!liked);setReactionsOpen(!reactionsOpen)}} className={liked?"liked":""}>{reaction}<small>Demo {liked?"12.5K":"12.4K"}</small></button><button aria-label="Open demo comments" onClick={()=>flash("Demo comments · 2 synthetic replies")}>●<small>Demo 892</small></button><button aria-label={saved?"Remove from saved":"Save privately"} aria-pressed={saved} onClick={()=>{setSaved(!saved);flash(saved?"Removed from saved":"Saved privately in Nexus")}}>{saved?"◆":"◇"}<small>Save</small></button><button aria-label="Preview stamped device download" onClick={()=>flash("Device download would include a Nexus provenance stamp")}>⇩<small>Download</small></button><button aria-label="Open demo support" className="support" onClick={onTip}>$<small>Support</small></button></div>
      {reactionsOpen&&<div className="reactionTray" role="group" aria-label="Choose a reaction">{[["♥","Like"],["😂","Haha"],["💡","Useful"],["😔","Sad"],["😡","Angry"],["?","Fake?"],["↓","Not for me"]].map(([icon,label])=><button aria-pressed={reaction===icon&&liked} key={label} title={label} onClick={()=>{setReaction(icon);setLiked(true);setReactionsOpen(false);flash(`${label} saved as your private opinion`)}}><i>{icon}</i><span>{label}</span></button>)}</div>}
      <div className="caption"><div className="creatorLine"><i>LK</i><b>@LunaKai · Demo badge</b><button aria-pressed={follow} onClick={()=>{setFollow(!follow);flash(follow?"Unfollowed LunaKai":"Following LunaKai · demo")}}>{follow?"Following":"Follow"}</button></div><p>Original song in the mountains 🎵</p><span>♫ Demo audio · LunaKai · {lens}</span></div>
    </div>:<div className="pulsePosts"><article><header><i>AR</i><span><b>Alex Rivera · Demo badge</b><small>@alex · 4m · {lens}</small></span><button className="postMenu" aria-label="Post menu" onClick={()=>flash("Post menu · report, hide or copy link")}>•••</button></header><div className="postTrust">◇ Demo Trust Lens · synthetic sources · AI 4%</div><p>What if every digital identity could be private by default, portable and still easy to use?</p><div className="postMedia"><span>NEXUS PULSE · SYNTHETIC</span><b>One account.<br/>Many sides of life.</b></div><footer><button onClick={()=>flash("Demo like added · 428")}>♡ Demo 428</button><button onClick={()=>flash("Dislike stays private · demo")}>↓ Private</button><button onClick={()=>flash("Demo comment thread opened")}>◌ Demo 86</button><button onClick={()=>flash("Share sheet opened · demo copy link")}>↗ Share</button><button onClick={onTip}>$ Support</button></footer></article><article className="textPost"><header><i>MN</i><span><b>Maya North</b><small>@mayanorth · 12m</small></span></header><p>Just booked a demo weekend experience and invited the whole group. One plan, one chat, one split payment.</p><footer><button onClick={()=>flash("Demo like added · 196")}>♡ Demo 196</button><button onClick={()=>flash("Demo comment thread opened")}>◌ Demo 31</button><button onClick={()=>flash("Share sheet opened · demo")}>↗</button></footer></article></div>}
  </div>;
}

function ProfilesScreen({ activeProfile, onActivate, flash }:{ activeProfile:ProfileMode; onActivate:(profile:ProfileMode)=>void; flash:Flash }) {
  const current=profiles.find(profile=>profile.id===activeProfile)!;const policy=profilePolicies[activeProfile];
  const [edit,setEdit]=useState(false);
  const [edits,setEdits]=usePersistentState<Record<string,{name:string;bio:string}>>("nexus_profile_edits",{});
  const mine=edits[activeProfile]||{name:"",bio:""};
  const [name,setName]=useState(mine.name); const [bio,setBio]=useState(mine.bio);
  return <div className="screen scrollScreen"><h2>Quick Switch</h2><p className="screenSub">One account · separate identity, feed and privacy per mode</p><div className="profileList">{profiles.map(profile=><button aria-pressed={activeProfile===profile.id} key={profile.id} className={activeProfile===profile.id?"active":""} onClick={()=>{onActivate(profile.id);flash(`${profile.name} profile activated`)}}><i style={{background:`${profile.color}22`,color:profile.color}}>{profile.icon}</i><span><b>{profile.name}</b><small>{profile.detail} · {profilePolicies[profile.id].visibility}</small></span>{activeProfile===profile.id?<em>Active</em>:<strong>›</strong>}</button>)}</div><section className="modeIdentity"><i style={{background:`${current.color}22`,color:current.color}}>{current.icon}</i><span><b>{mine.name||`${current.name} identity`}</b><small>{mine.bio||"Avatar, name, bio and audience belong only to this mode"}</small></span><button onClick={()=>{setName(mine.name);setBio(mine.bio);setEdit(true)}}>Edit demo profile</button></section><section className="settings"><h3>{current.name} privacy</h3>{[["◉","Profile visibility",policy.visibility],["♙","Who can contact you",policy.contacts],["♥","Connection list",policy.connections],["◌","Activity status",policy.activity]].map(r=><button className="settingRow" aria-pressed={false} key={r[1]} onClick={()=>flash(`${r[1]} · currently ${r[2]} (demo)`) }><i>{r[0]}</i><span>{r[1]}</span><em>{r[2]} ›</em></button>)}</section><section className="wallet"><span><b>Demo wallet state</b><small>Synthetic wallet · five isolated profiles</small></span><em>Local</em></section>{edit&&<Sheet id="profileEdit" title={`Edit ${current.name} profile`} subtitle="Saved on this device · nothing leaves it" onClose={()=>setEdit(false)}><div className="formFields"><input aria-label="Display name" placeholder="Display name" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Bio" placeholder="Bio" value={bio} onChange={e=>setBio(e.target.value)}/><button onClick={()=>flash("Avatar stays a demo placeholder")}>Avatar · use device photo</button><button onClick={()=>flash(`Audience · ${policy.visibility} (demo)`) }>Audience · {policy.visibility}</button></div><button className="gradientAction" onClick={()=>{setEdits({...edits,[activeProfile]:{name,bio}});setEdit(false);flash("Profile saved on this device")}}>Save profile</button></Sheet>}</div>;
}

function MarketScreen({ view, onCreate, flash }:{ view:"browse"|"orders"; onCreate:()=>void; flash:Flash }) {
  const [scope,setScope]=useState("Local"); const [cat,setCat]=useState("All"); const [product,setProduct]=useState<string[]|null>(null);
  if(view==="orders") return <div className="screen scrollScreen marketScreen ordersScreen"><div className="screenTitle"><span><h2>Orders</h2><small>Synthetic purchases, sales and offers</small></span><button onClick={onCreate}>＋ Sell</button></div><div className="orderTabs" role="tablist" aria-label="Demo order type"><button role="tab" aria-selected="true" className="active" onClick={()=>flash("Showing all demo orders")}>All</button><button role="tab" aria-selected="false" onClick={()=>flash("Filtered: buying · demo")}>Buying</button><button role="tab" aria-selected="false" onClick={()=>flash("Filtered: selling · demo")}>Selling</button></div>{[["Wireless Headphones","Demo escrow funded","65 USDC","Packing"],["City Commuter Bike","Demo offer received","110 USDC","Review"],["Minimalist Watch","Demo delivered","80 USDC","Rate"]].map((order,index)=><article className="orderCard" key={order[0]}><i className={`orderThumb o${index}`}/><span><b>{order[0]}</b><small>{order[1]}</small><strong>Demo {order[2]}</strong></span><button onClick={()=>flash(`${order[0]} → ${order[3]} (demo)`) }>{order[3]}</button></article>)}<section className="marketTrust"><b>Demo escrow protection</b><p>Synthetic funds release only after the agreed demo order state. No real funds move.</p></section></div>;
  return <div className="screen scrollScreen marketScreen"><div className="screenTitle"><span><h2>Market</h2><small>Buy and sell almost anything legal</small></span><button onClick={onCreate}>＋ Sell</button></div><button className="search" onClick={()=>flash("Market search · synthetic results only")}>⌕ <span>What are you looking for?</span><b>☷</b></button><div className="scope" role="group" aria-label="Market area"><button aria-pressed={scope==="Local"} className={scope==="Local"?"active":""} onClick={()=>setScope("Local")}>Near me</button><button aria-pressed={scope==="Global"} className={scope==="Global"?"active":""} onClick={()=>setScope("Global")}>Worldwide</button></div><div className="categories" role="group" aria-label="Product category">{[["All"],["Electronics"],["Fashion"],["Home"],["Vehicles"]].map(([label])=><button aria-pressed={cat===label} key={label} className={cat===label?"active":""} onClick={()=>{setCat(label);flash(`Category: ${label} · demo`)}}>{label}</button>)}</div><div className="productGrid">{products.map(p=><button key={p[0]} onClick={()=>setProduct(p)}><div className={`productImage ${p[2]}`}/><b>{p[0]}</b><small>Synthetic listing · 2 km</small><strong>Demo {p[1]}</strong><em>✓ Demo seller · Demo escrow</em></button>)}</div><button className="fullAction" onClick={onCreate}>＋ Create a listing</button>{product&&<Sheet id="product" title={product[0]} subtitle="Synthetic listing · no real sale" onClose={()=>setProduct(null)}><div className="productHero"/><div className="rowAction"><span><b>Price</b></span><em>Demo {product[1]}</em></div><div className="rowAction"><span><b>Seller</b></span><em>✓ Demo seller</em></div><div className="rowAction"><span><b>Escrow</b></span><em>Demo protected</em></div><button className="gradientAction" onClick={()=>{setProduct(null);flash("Demo purchase started · 0 real funds")}}>Buy with demo escrow</button></Sheet>}</div>;
}

function ChatThread({ chat, onClose, flash }:{ chat:string[]; onClose:()=>void; flash:Flash }) {
  const [msgs,setMsgs]=useState<string[]>(["Hi! Is this still available?","Hi! Yes, it is. When works for you?"]);
  const [draft,setDraft]=useState("");
  return <Sheet id="chatThread" title={chat[0]} subtitle={`${chat[5]} · Demo E2EE`} onClose={onClose}><div className="chatThread">{msgs.map((m,i)=><div key={i} className={i%2?"me":"them"}>{m}</div>)}</div><div className="chatCompose"><input aria-label="Demo message" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a demo message…"/><button aria-label="Send demo message" onClick={()=>{if(draft.trim()){setMsgs([...msgs,draft.trim()]);setDraft("");flash("Demo message sent · not delivered")}}}>↑</button></div></Sheet>;
}

function MeetingSheet({ onClose, flash }:{ onClose:()=>void; flash:Flash }) {
  const [day,setDay]=useState("Thu 21"); const [slot,setSlot]=useState("10:30");
  return <Sheet id="meeting" title="Schedule meeting" subtitle="Local demo planner · synthetic calendar" onClose={onClose}><div className="fieldLabel">Day</div><div className="chipRow">{[["Mon 18"],["Wed 20"],["Thu 21"],["Fri 22"]].map(([l])=><button aria-pressed={day===l} key={l} className={day===l?"active":""} onClick={()=>setDay(l)}>{l}</button>)}</div><div className="fieldLabel">Time</div><div className="chipRow">{[["09:00"],["10:30"],["13:00"],["16:30"]].map(([l])=><button aria-pressed={slot===l} key={l} className={slot===l?"active":""} onClick={()=>setSlot(l)}>{l}</button>)}</div><div className="rowAction"><span><b>Participant</b></span><em>@LunaKai · Demo</em></div><button className="gradientAction" onClick={()=>{onClose();flash(`Meeting scheduled ${day} ${slot} · local demo`)}}>Confirm demo meeting</button></Sheet>;
}

function CameraCallSheet({ id, title, onClose, flash }:{ id:string; title:string; onClose:()=>void; flash:Flash }) {
  const cam=useCamera(true);
  const [muted,setMuted]=useState(false); const [camOn,setCamOn]=useState(true);
  return <Sheet id={id} title={title} subtitle="Uses your device camera · video never leaves this device" onClose={onClose}>
    <div className="callStage">
      {cam.ready?<video ref={cam.setNode} autoPlay playsInline muted className="callVideo" style={{display:camOn?"block":"none"}}/>:cam.error?<div className="callSelf">Camera unavailable<br/><small>Check permission</small></div>:<div className="callSelf">Starting camera…</div>}
      {!camOn && <div className="callSelf">CAMERA OFF</div>}
      <span>@LunaKai · connecting (demo)</span>
    </div>
    <div className="callControls">
      <button aria-pressed={muted} onClick={()=>{setMuted(!muted);flash(muted?"Mic unmuted":"Mic muted · demo")}}>{muted?"Mic off":"Mic on"}</button>
      <button aria-pressed={!camOn} onClick={()=>{setCamOn(!camOn);flash(camOn?"Camera off":"Camera on")}}>{camOn?"Camera off":"Camera on"}</button>
      <button className="end" onClick={()=>{onClose();flash("Call ended · local demo")}}>End call</button>
    </div>
  </Sheet>;
}

function ChatScreen({ flash }:{ flash:Flash }) {
  const [tab,setTab]=useState("All modes"); const [thread,setThread]=useState<string[]|null>(null); const [meeting,setMeeting]=useState(false); const [call,setCall]=useState(false);
  useFocusReturn(meeting||call||thread!==null);
  const visibleChats=tab==="All modes"?chats:chats.filter(chat=>chat[5]===tab);
  return <div className="screen scrollScreen"><div className="titleLine"><span><h2>Messages</h2><small>Synthetic conversations · identity context stays visible</small></span><em>▣ Demo E2EE</em></div><div className="callBar"><button onClick={()=>setCall(true)}>▣ Video call</button><button onClick={()=>setMeeting(true)}>◷ Schedule meeting</button></div><div className="chatTabs modeFilters" role="tablist" aria-label="Message profile filter">{["All modes","Social","Work","Dating","Travel","Market"].map(t=><button role="tab" aria-selected={tab===t} key={t} onClick={()=>setTab(t)} className={tab===t?"active":""}>{t}</button>)}</div><div className="chatList">{visibleChats.map(c=><button key={c[0]} onClick={()=>setThread(c)}><i style={{background:c[4]}}>{c[0].slice(0,2)}</i><span><b>{c[0]} <mark className="chatMode">{c[5]}</mark></b><small>{c[1]}</small></span><em>{c[2]}{c[3]&&<strong>{c[3]}</strong>}</em></button>)}</div><div className="encrypted">▣ Demo encrypted flow · cross-mode contact needs consent</div><button className="compose" aria-label="New message" onClick={()=>flash("New message · choose a contact")}>＋</button>{thread&&<ChatThread chat={thread} onClose={()=>setThread(null)} flash={flash}/>}{meeting&&<MeetingSheet onClose={()=>setMeeting(false)} flash={flash}/>}{call&&<CameraCallSheet id="videoCall" title="Video call" onClose={()=>setCall(false)} flash={flash}/>}</div>;
}

function CreatorScreen({ flash }:{ flash:Flash }) {
  return <div className="screen scrollScreen"><div className="screenTitle"><span><h2>Creator Studio</h2><small>Synthetic month</small></span><button onClick={()=>flash("Demo export · no real file")}>Export demo</button></div><section className="earnings"><small>Demo earnings</small><h3>12,430 <i>demo USDC</i></h3><span>Synthetic +18.6%</span><div className="chart"><i/><i/><i/><i/><i/><i/></div></section><div className="creatorStats">{[["Demo tips","4,250"],["Demo members","5,600"],["Demo reward pool","2,580"]].map(s=><button key={s[0]} onClick={()=>flash(`${s[0]} · ${s[1]} demo USDC`)}><small>{s[0]}</small><b>{s[1]}</b><em>demo USDC</em></button>)}</div><section className="payout"><h3>Illustrative payout</h3><div className="donut"><b>70%</b></div>{[["Creator","70%","#2ed9c9"],["Supporters","15%","#ffad45"],["Platform","10%","#a663ff"],["Network","5%","#83919d"]].map(s=><p key={s[0]}><i style={{background:s[2]}}/>{s[0]}<b>{s[1]}</b></p>)}</section><section className="ranking"><h3>Synthetic creator ranking</h3>{["LunaKai · demo 12,430","WaveRider · demo 9,870","MindfulMiles · demo 7,210"].map((r,i)=><button key={r} onClick={()=>flash(`Opened ${r}`)}><span>#{i+1}</span>{r}</button>)}</section></div>;
}

function WorkScreen({ view, onCreate, flash }:{ view:"feed"|"jobs"; onCreate:()=>void; flash:Flash }) {
  const [tab,setTab]=useState("For you"); const [follow,setFollow]=useState(false); const [job,setJob]=useState<string[]|null>(null);
  if(view==="jobs") return <div className="screen scrollScreen workScreen"><div className="screenTitle"><span><h2>Jobs</h2><small>Matched to your Work profile</small></span><button onClick={onCreate}>＋ Post job</button></div><div className="jobFilters">{[["For you"],["Remote"],["Nearby"]].map(([label])=><button aria-pressed={tab===label} key={label} className={tab===label?"active":""} onClick={()=>{setTab(label);flash(`Filtered: ${label} · demo`)}}>{label}</button>)}</div>{[["Product Designer","Nova Labs","Remote · 82–105K USDC","96% match"],["Web3 Product Lead","Orbit Studio","Berlin · Hybrid","91% match"],["Community Strategist","Lumen Network","Worldwide","88% match"]].map((j,i)=><article className="jobCard" key={j[0]}><i>{["NL","OS","LN"][i]}</i><span><b>{j[0]}</b><small>{j[1]}</small><p>{j[2]}</p></span><button onClick={()=>setJob(j)}>{j[3]}</button></article>)}</div>;
  return <div className="screen scrollScreen workScreen"><div className="screenTitle"><span><h2>Work Feed</h2><small>Synthetic posts + professional clips</small></span><button onClick={onCreate}>＋ Create</button></div><div className="workTabs" role="tablist" aria-label="Work feed type">{["For you","Following","Clips","Posts"].map(t=><button role="tab" aria-selected={tab===t} key={t} className={tab===t?"active":""} onClick={()=>{setTab(t);flash(`Work tab: ${t}`)}}>{t}</button>)}</div><button className="workPrompt" onClick={onCreate}><i>RK</i><span>Share an update, clip or opportunity…</span><b>＋</b></button><article className="workPost"><header><i>NL</i><span><b>Nova Labs · Demo badge</b><small>Technology · 18m</small></span><button aria-pressed={follow} onClick={()=>{setFollow(!follow);flash(follow?"Unfollowed Nova Labs":"Following Nova Labs · demo")}}>{follow?"Following":"Follow"}</button></header><p>We are building a privacy-first creator experience. Here is a 30-second look at the synthetic product team.</p><div className="workClip"><button aria-label="Play demo professional clip" onClick={()=>flash("Playing demo professional clip")}>▶</button><span>Inside Nova Labs · Demo</span></div><footer><button onClick={()=>flash("Demo like added · 248")}>♡ Demo 248</button><button onClick={()=>flash("Demo comment thread opened")}>◌ Demo 37</button><button onClick={()=>flash("Share sheet opened · demo")}>↗ Share</button></footer></article><article className="workPost compact"><header><i>AR</i><span><b>Alex Rivera</b><small>Synthetic profile · 42m</small></span></header><p>Three lessons from launching a global marketplace with local trust.</p><footer><button onClick={()=>flash("Demo like added · 119")}>♡ Demo 119</button><button onClick={()=>flash("Demo comment thread opened")}>◌ Demo 22</button><button onClick={()=>flash("Saved · demo")}>Save</button></footer></article>{job&&<Sheet id="job" title={job[0]} subtitle={`${job[1]} · demo opening`} onClose={()=>setJob(null)}><div className="rowAction"><span><b>Company</b></span><em>{job[1]}</em></div><div className="rowAction"><span><b>Location</b></span><em>{job[2]}</em></div><div className="rowAction"><span><b>Match</b></span><em>{job[3]}</em></div><button className="gradientAction" onClick={()=>{setJob(null);flash("Application started · synthetic only")}}>Apply · demo</button></Sheet>}</div>;
}

function DatingScreen({ view, flash }:{ view:"discover"|"connections"; flash:Flash }) {
  const [decision,setDecision]=useState(0); const [incognito,setIncognito]=useState(false); const [filters,setFilters]=useState(false); const [saved,setSaved]=useState(false);
  if(view==="connections") return <div className="screen scrollScreen connectionsScreen"><div className="screenTitle"><span><h2>Connections</h2><small>Matches, plans and safety</small></span><button aria-pressed={incognito} onClick={()=>{setIncognito(!incognito);flash(incognito?"Incognito off":"Incognito on · demo")}}>Incognito</button></div><div className="connectionStats"><div><b>8</b><small>New matches</small></div><div><b>3</b><small>Conversations</small></div><div><b>1</b><small>Date planned</small></div></div><h3>New connections</h3><div className="connectionFaces">{["Maya","Lina","Alex","Noa"].map((name,index)=><button key={name} onClick={()=>flash(`${name} · open demo chat`)}><i className={`face f${index}`}>{name[0]}</i><span>{name}</span></button>)}</div><h3>Plans</h3><article className="datePlan"><i>19<br/><small>AUG</small></i><span><b>Coffee with Maya</b><small>Public venue · safety contact enabled</small></span><button onClick={()=>flash("Date plan opened · demo")}>View</button></article><section className="datingSafety"><b>Serious Intent</b><span>Your score: 89 · Demo identity status</span><p>Scores are contextual, appealable, synthetic and never replace your judgment.</p></section></div>;
  return <div className="screen datingScreen"><div className="screenTitle"><span><h2>Discover</h2><small>Synthetic serious connections</small></span><button onClick={()=>setFilters(true)}>☷ Filters</button></div><div className={`datingCard choice${decision}`}><div className="datingPhoto"/><div className="datingShade"/><div className="datingInfo"><h3>Maya, 29 <em>Demo</em></h3><p>Synthetic profile · 4 km demo distance</p><div><span>Long-term</span><span>Music</span><span>Travel</span></div><strong>Demo Serious Intent · 92</strong></div></div><div className="datingActions"><button aria-label="Pass this synthetic profile" onClick={()=>setDecision(-1)}>×</button><button aria-label={saved?"Unsave synthetic profile":"Save synthetic profile"} aria-pressed={saved} onClick={()=>{setSaved(!saved);flash(saved?"Removed from saved":"Profile saved · demo")}}>★</button><button aria-label="Like this synthetic profile" onClick={()=>setDecision(1)}>♥</button></div><p className="safetyLine">▣ Demo identity status · Safety check-in preview</p>{filters&&<Sheet id="datingFilters" title="Dating filters" subtitle="Local demo preferences" onClose={()=>setFilters(false)}>{["Intentions","Distance","Age range","Verified only","Safety check-in"].map(f=><button className="rowAction" key={f} onClick={()=>flash(`${f} toggled · demo`)}><span><b>{f}</b></span><em>Demo</em></button>)}<button className="gradientAction" onClick={()=>{setFilters(false);flash("Filters applied · demo")}}>Apply demo filters</button></Sheet>}</div>;
}

function TravelScreen({ view, onCreate, flash }:{ view:"explore"|"trips"; onCreate:()=>void; flash:Flash }) {
  const [stay,setStay]=useState<string[]|null>(null);
  if(view==="trips") return <div className="screen scrollScreen travelScreen"><div className="screenTitle"><span><h2>Trips</h2><small>Synthetic bookings and group plans</small></span><button onClick={onCreate}>＋ List</button></div><article className="tripHero"><small>DEMO UPCOMING · 22–26 AUG</small><h3>Lisbon design weekend</h3><p>4 demo guests · Demo escrow · Demo host badge</p><div><span>Demo booking confirmed</span><button onClick={()=>flash("Group chat opened · demo")}>Open group chat</button></div></article>{["Airport ride","Alfama food walk","Split payment"].map((item,index)=><button className="tripRow" key={item} onClick={()=>flash(`${item} · opened (demo)`) }><i>{["↗","✦","$"][index]}</i><span><b>{item}</b><small>{index===0?"Demo pickup scheduled":"Synthetic plan item"}</small></span><em>›</em></button>)}</div>;
  return <div className="screen scrollScreen travelScreen"><div className="screenTitle"><span><h2>Explore</h2><small>Synthetic stays and experiences</small></span><button onClick={onCreate}>＋ List</button></div><button className="search" onClick={()=>flash("Travel search · synthetic results only")}>⌕ <span>Where do you want to go?</span></button><div className="travelHero"><span>DEMO · PORTUGAL</span><h3>Design stays in Lisbon</h3><p>Demo host badges · simulated booking</p></div><div className="travelCards">{[["Ocean loft","94 demo USDC/night"],["Old town studio","72 demo USDC/night"]].map((s,index)=><button key={s[0]} onClick={()=>setStay(s)}><i className={`stay s${index}`}/><b>{s[0]}</b><small>★ Demo 4.9 · Synthetic host</small><strong>{s[1]}</strong></button>)}</div>{stay&&<Sheet id="stay" title={stay[0]} subtitle="Synthetic stay · no real booking" onClose={()=>setStay(null)}><div className="stayHero"/><div className="rowAction"><span><b>Rate</b></span><em>{stay[1]}</em></div><div className="rowAction"><span><b>Host</b></span><em>★ Demo 4.9 · Synthetic host</em></div><button className="gradientAction" onClick={()=>{setStay(null);flash("Booking started · demo escrow, 0 real funds")}}>Book with demo escrow</button></Sheet>}</div>;
}

function LiveSheet({ onClose, flash }:{ onClose:()=>void; flash:Flash }) {
  const cam=useCamera(true);
  const [viewers,setViewers]=useState(120);
  const [msgs,setMsgs]=useState<string[]>(["@fan1: first! 🔥","@fan2: love this view"]);
  const [draft,setDraft]=useState("");
  useEffect(()=>{ const t=setInterval(()=>setViewers(v=>Math.max(8,v+(Math.random()>0.5?1:-1))),1500); return ()=>clearInterval(t); },[]);
  return <Sheet id="live" title="Go live" subtitle="Your camera on this device · no external stream" onClose={onClose}>
    <div className="liveStage">{cam.ready?<video ref={cam.setNode} autoPlay playsInline muted className="callVideo"/>:cam.error?<div className="callSelf">Camera unavailable</div>:<div className="callSelf">Starting camera…</div>}<span className="liveViewers">● LIVE · {viewers} demo viewers</span></div>
    <div className="chatThread liveChat">{msgs.map((m,i)=><div key={i} className="them">{m}</div>)}</div>
    <div className="chatCompose"><input aria-label="Live chat message" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Say something…"/><button aria-label="Send live chat" onClick={()=>{if(draft.trim()){setMsgs([...msgs,draft.trim()]);setDraft("");}}}>↑</button></div>
    <button className="gradientAction" onClick={()=>{onClose();flash("Live ended · local demo")}}>End live</button>
  </Sheet>;
}

function StreamScreen({ onCreate, flash }:{ onCreate:()=>void; flash:Flash }) {
  const [player,setPlayer]=useState<string|null>(null);
  const [live,setLive]=useState(false);
  return <><div className="screen scrollScreen streamScreen"><div className="screenTitle"><span><h2>Watch</h2><small>Synthetic videos, channels and live</small></span><button onClick={onCreate}>＋ Upload preview</button></div><div className="featuredVideo"><span>DEMO LIVE</span><button aria-label="Play demo live stream" onClick={()=>setPlayer("Mountain Sessions — demo live")}>▶</button><div><b>Mountain Sessions — demo live</b><small>LunaKai · synthetic 2.8K watching</small></div></div><button className="goLiveBtn" onClick={()=>setLive(true)}>● Go live</button><h3>Demo recommendations</h3>{["Build a global creator brand","Lisbon in 48 hours","Strength training basics"].map((v,i)=><button className="videoRow" key={v} onClick={()=>setPlayer(v)}><i className={`thumb t${i}`}>▶</i><span><b>{v}</b><small>{i===0?"Nexus Academy · demo 24K views":"Synthetic creator · demo 8K views"}</small></span></button>)}</div>{player&&<Sheet id="player" title={player} subtitle="Simulated playback · no media stream" onClose={()=>setPlayer(null)}><div className="playerStage"><span>▶</span><b>DEMO VIDEO PLAYER</b><small>Synthetic · nothing is streamed</small></div><button className="gradientAction" onClick={()=>{setPlayer(null);flash("Playback closed · demo")}}>Close player</button></Sheet>}{live&&<LiveSheet onClose={()=>setLive(false)} flash={flash}/>}</>;
}

function PayScreen({ flash }:{ flash:Flash }) {
  const [send,setSend]=useState(false); const [req,setReq]=useState(false); const [scan,setScan]=useState(false); const [hist,setHist]=useState(false);
  useFocusReturn(send||req||scan||hist);
  const sendDialog=useDialogFocus<HTMLDivElement>(send);
  const closeSend=()=>setSend(false);
  return <div className="screen scrollScreen payScreen"><div className="payTitle">NE<span>X</span>US <b>PAY</b></div><h3>Demo balances · 0 real funds</h3>{[["€","Synthetic EUR stablecoin","1,250.00","demo EUR","green"],["$","Synthetic USD stablecoin","2,340.50","demo USD","blue"],["×","Synthetic EGLD","12.3456","demo EGLD","gold"]].map(a=><button className={`balance ${a[4]}`} key={a[1]} onClick={()=>flash(`${a[1]} · ${a[2]} ${a[3]}`)}><i>{a[0]}</i><span><small>{a[1]}</small><b>{a[2]} <strong>{a[3]}</strong></b></span>›</button>)}<div className="payActions"><button onClick={()=>setSend(true)}>↑<small>Send</small></button><button onClick={()=>setReq(true)}>↓<small>Request</small></button><button onClick={()=>setScan(true)}>⌗<small>Scan</small></button><button onClick={()=>setHist(true)}>◷<small>History</small></button></div>{send&&<div ref={sendDialog} tabIndex={-1} className="sendCard" role="dialog" aria-modal="true" aria-labelledby="sendTitle" onKeyDown={event=>trapDialogFocus(event,closeSend)}><button aria-label="Close demo payment" onClick={closeSend}>←</button><h3 id="sendTitle">Demo send to username</h3><span className="fieldLabel">Recipient</span><div className="username">⌕ @synthetic-user</div><div className="recipient"><i>RU</i><span><b>@synthetic-user · Demo badge</b><small>Synthetic MultiversX identity</small></span></div><span className="fieldLabel">Amount</span><div className="amount">250.00 <b>demo EUR⌄</b></div><button className="gradientAction" onClick={()=>{closeSend();flash("Demo payment confirmed · 0 real funds")}}>Review demo payment</button></div>}{req&&<Sheet id="payRequest" title="Request payment" subtitle="Local demo · no real request" onClose={()=>setReq(false)}><div className="formFields"><input aria-label="Request amount" placeholder="Amount"/><input aria-label="From username" placeholder="From @username"/></div><button className="gradientAction" onClick={()=>{setReq(false);flash("Demo request created · 0 real funds")}}>Create demo request</button></Sheet>}{scan&&<Sheet id="payScan" title="Scan to pay" subtitle="Simulated QR · no camera" onClose={()=>setScan(false)}><div className="qrBox">DEMO QR</div><button className="gradientAction" onClick={()=>{setScan(false);flash("QR scanned · demo receipt")}}>Simulate scan</button></Sheet>}{hist&&<Sheet id="payHistory" title="Payment history" subtitle="Synthetic transactions" onClose={()=>setHist(false)}>{[["@LunaKai · Demo support","+2.00 demo USDC"],["@market-user · Demo escrow","-45.00 demo USDC"],["@synthetic-user · Demo send","-250.00 demo EUR"]].map(([t,a])=><button className="rowAction" key={t} onClick={()=>flash(t)}><span><b>{t}</b></span><em>{a}</em></button>)}</Sheet>}</div>;
}

function PriveScreen({ flash }:{ flash:Flash }) {
  const [preview,setPreview]=useState(false); const [tab,setTab]=useState("Free");
  if(!preview) return <div className="screen priveScreen"><div className="priveBrand">NE<span>X</span>US</div><h2>Privé 18+</h2><div className="shield"><span>▣</span></div><h3>Age verification required</h3><strong>18+</strong><p>Adult-only creator space with consent, privacy and country controls.</p><ul><li>Every participant verified 18+</li><li>Per-asset consent and rights</li><li>No explicit public previews</li><li>Paid access and private live rooms</li></ul><button onClick={()=>setPreview(true)}>Open safe synthetic preview</button></div>;
  return <div className="screen scrollScreen priveHub"><div className="screenTitle"><span><h2>Privé</h2><small>Safe synthetic preview · no adult media</small></span><button onClick={()=>setPreview(false)}>Lock</button></div><div className="priveTabs" role="tablist" aria-label="Privé offer type">{[["Free"],["Subscriptions"],["Paid live"]].map(([label])=><button role="tab" aria-selected={tab===label} className={tab===label?"active":""} key={label} onClick={()=>setTab(label)}>{label}</button>)}</div><section className="priveCreator"><i>18+</i><span><b>Synthetic creator channel</b><small>Demo identity · consent · rights status</small></span><button onClick={()=>flash("Synthetic creator profile opened")}>View</button></section><div className="priveOffers"><button onClick={()=>flash("Free 18+ discovery opened · synthetic only")}><span>DEMO FREE DISCOVERY</span><b>Follow before subscribing</b><small>Synthetic audience gate · safe placeholder</small></button><button onClick={()=>flash("PPV preview · no real charge")}><span>DEMO PAY PER VIEW</span><b>Preview a private post</b><small>Demo 2 USDC · creator-first illustration</small></button><button onClick={()=>flash("Paid room preview · timer and cap required")}><span className="liveDot">● DEMO LIVE</span><b>Metered private room preview</b><small>Illustrative rate · timer · spending cap</small></button></div><section className="priveEarn"><span><small>Illustrative creator share</small><b>80–90%</b></span><span><small>Demo access</small><b>Encrypted flow</b></span><span><small>Demo settlement</small><b>Private flow</b></span></section></div>;
}

function GenericScreen({ mod, flash }:{ mod:Module; flash:Flash }) {
  const [selected,setSelected]=useState(0); const [scope,setScope]=useState("Near me");
  return <div className="screen genericScreen" style={{"--accent":mod.color} as React.CSSProperties}><div className="genericHead"><div className="genericOrb"><span>{mod.icon}</span><i/><b/></div><span><small>{mod.section} · LOCAL DEMO</small><h2>{mod.name}</h2><p>{mod.tag}</p></span></div><div className="genericScopes" role="group" aria-label={`${mod.name} discovery area`}>{["Near me","For you","Global"].map(s=><button aria-pressed={scope===s} key={s} className={scope===s?"active":""} onClick={()=>setScope(s)}>{s}</button>)}</div><div className="featureStack">{mod.features.map((f,i)=><button aria-pressed={selected===i} key={f} className={selected===i?"active":""} onClick={()=>setSelected(i)}><i>{String(i+1).padStart(2,"0")}</i><span>{f}</span><em>{selected===i?"OPEN":"›"}</em></button>)}</div><button className="moduleAction" onClick={()=>flash(`${mod.name}: ${mod.features[selected]} · ${scope} · local demo`)}>Continue with {mod.features[selected]}</button></div>;
}

const AUDIENCES:Record<ComposerMode,string[]>={social:["Public","Friends","Only me"],work:["Public","Work network","Only me"],dating:["Approved connections","Only me"],travel:["Public","Guests + hosts","Only me"],market:["Public","Buyers + sellers","Only me"]};

function SoundPicker({ sound, onSelect, onClose }:{ sound:string; onSelect:(s:string)=>void; onClose:()=>void }) {
  return <Sheet id="soundPicker" title="Add sound" subtitle="Generated on-device · preview then attach" onClose={onClose}>
    {SOUNDS.map(s=><button key={s} className={`rowAction ${sound===s?"active":""}`} onClick={()=>{ if(s!=="None") playSound(s); onSelect(s); }}><span><b>{s}</b><small>{s==="None"?"No sound attached":"Tap to preview + attach"}</small></span><em>{sound===s?"ATTACHED":"›"}</em></button>)}
    <button className="gradientAction" onClick={onClose}>Done</button>
  </Sheet>;
}

function CameraCaptureSheet({ onCapture, onClose }:{ onCapture:(url:string)=>void; onClose:()=>void }) {
  const cam=useCamera(true);
  return <Sheet id="camera" title="Open camera" subtitle="Your device camera · photo stays on this device" onClose={onClose}>
    <div className="cameraStage">{cam.ready?<video ref={cam.setNode} autoPlay playsInline muted className="callVideo"/>:cam.error?<div className="callSelf">Camera unavailable<br/><small>Check browser permission</small></div>:<div className="callSelf">Starting camera…</div>}</div>
    <button className="gradientAction" disabled={!cam.ready} onClick={()=>{ const url=cam.capture(); if(url){ onCapture(url); onClose(); } }}>Capture photo</button>
  </Sheet>;
}

function Composer({ mode, onClose, flash, session }:{ mode:ComposerMode; onClose:()=>void; flash:Flash; session:Session|null }) {
  const kinds:Record<ComposerMode,string[]>={social:["Clip","Photo","Post","Story","Live"],work:["Post","Clip","Job","Article"],dating:["Moment","Photo","Video"],travel:["Stay","Experience"],market:["Product","Vehicle","Home","Service"]};
  const [kind,setKind]=useState(kinds[mode][0]);
  const [media,setMedia]=useState<MediaItem[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [sound,setSound]=useState("None");
  const [audience,setAudience]=useState(AUDIENCES[mode][0]);
  const [caption,setCaption]=useState("");
  const [title,setTitle]=useState("");
  const [price,setPrice]=useState("");
  const [camOpen,setCamOpen]=useState(false);
  const [soundOpen,setSoundOpen]=useState(false);
  const [drafts,setDrafts]=usePersistentState<Record<string,{caption:string;title:string;price:string;sound:string;audience:string;photos:string[]}>>("nexus_drafts",{});
  const composerDialog=useDialogFocus<HTMLDivElement>(true);
  const listing=mode==="market"||mode==="travel";
  const selected=media.find(m=>m.id===selectedId)||media[0]||null;
  const addFiles=(files:FileList|null)=>{ if(!files) return; const arr=Array.from(files).slice(0,6); const items:MediaItem[]=arr.map(f=>({id:Math.random().toString(36).slice(2),url:URL.createObjectURL(f),name:f.name,type:f.type.startsWith("video")?"video":"image",source:"file",fx:{...defaultFx}})); setMedia(prev=>[...prev,...items]); if(!selectedId && items.length) setSelectedId(items[0].id); flash(`${items.length} media added · local preview only`); };
  const onFile=(e:ChangeEvent<HTMLInputElement>)=>addFiles(e.target.files);
  const addCameraShot=(url:string)=>{ const item:MediaItem={id:Math.random().toString(36).slice(2),url,name:"Camera capture",type:"image",source:"camera",fx:{...defaultFx}}; setMedia(prev=>[...prev,item]); setSelectedId(item.id); flash("Photo captured · saved on this device"); };
  const setFx=(patch:Partial<Fx>)=>{ if(!selected) return; setMedia(prev=>prev.map(m=>m.id===selected.id?{...m,fx:{...m.fx,...patch}}:m)); };
  const move=(id:string,dir:-1|1)=>{ setMedia(prev=>{ const i=prev.findIndex(m=>m.id===id); const j=i+dir; if(i<0||j<0||j>=prev.length) return prev; const next=[...prev]; [next[i],next[j]]=[next[j],next[i]]; return next; }); };
  const remove=(id:string)=>{ setMedia(prev=>prev.filter(m=>m.id!==id)); if(selectedId===id) setSelectedId(null); };
  const saveDraft=()=>{ const key=`${mode}:${kind}`; setDrafts({...drafts,[key]:{caption,title,price,sound,audience,photos:media.filter(m=>m.source==="camera").map(m=>m.url).slice(0,3)}}); flash("Draft saved on this device"); };
  const loadDraft=()=>{ const d=drafts[`${mode}:${kind}`]; if(!d){ flash("No saved draft for this type"); return; } setCaption(d.caption); setTitle(d.title); setPrice(d.price); setSound(d.sound); setAudience(d.audience); if(d.photos.length) setMedia(d.photos.map((url,i)=>({id:`saved${i}`,url,name:"Saved photo",type:"image",source:"camera",fx:{...defaultFx}}))); flash("Draft loaded"); };
  const headerTitle={social:"Create in Social",work:"Create for Work",dating:"Private Moment",travel:"Create a travel listing",market:"Create a market listing"}[mode];
  const subtitle={social:"Clip, photo, post, story or live",work:"Post, professional clip, job or article",dating:"Visible only to allowed connections",travel:"Stay or experience with protected booking",market:"Sell locally or worldwide"}[mode];
  const uploadLabel=mode==="market"?"Add product photos":mode==="travel"?"Add stay or experience photos":mode==="dating"?"Add disappearing photo or video":"Upload video or photos";
  return <div ref={composerDialog} tabIndex={-1} className={`composerSheet ${mode}`} role="dialog" aria-modal="true" aria-labelledby="composerTitle" onKeyDown={event=>trapDialogFocus(event,onClose)}>
    <header><button onClick={onClose} aria-label="Close composer">×</button><span><b id="composerTitle">{headerTitle}</b><small>{subtitle}</small></span></header>
    <div className="composerBody">
      <div className="createKinds" role="tablist" aria-label="Content type">{kinds[mode].map(item=><button role="tab" aria-selected={kind===item} key={item} className={kind===item?"active":""} onClick={()=>setKind(item)}>{item}</button>)}</div>
      <div className="metaRow"><span className="fieldLabel">Signed in as</span><b>{session?session.handle:"guest"}</b></div>
      <div className="fieldLabel">Audience</div>
      <div className="chipRow" role="group" aria-label="Audience">{AUDIENCES[mode].map(a=><button aria-pressed={audience===a} key={a} className={audience===a?"active":""} onClick={()=>setAudience(a)}>{a}</button>)}</div>
      <div className="mediaChoices"><button onClick={()=>setCamOpen(true)}>◎ Open camera</button><label>▧ Choose media<input type="file" accept={listing?"image/*":"video/*,image/*"} multiple onChange={onFile}/></label></div>
      <label className="uploadDrop">{media.length===0?<><i>＋</i><b>{uploadLabel}</b><small>Tap to choose, or use Camera / Choose media</small><input aria-label="Choose local media preview" type="file" accept={listing?"image/*":"video/*,image/*"} multiple onChange={onFile}/></>:<div className="gallery">{media.map(m=><div key={m.id} className={`galleryThumb ${selected?.id===m.id?"selected":""}`}><button type="button" className="thumbMain" aria-label={`Select ${m.name}`} onClick={()=>setSelectedId(m.id)}>{m.type==="video"?<video src={m.url} muted/>:<img src={m.url} alt={m.name} style={{filter:fxToFilter(m.fx)}}/>}</button><div className="galleryActions"><button aria-label="Move left" onClick={()=>move(m.id,-1)}>←</button><button aria-label="Remove media" onClick={()=>remove(m.id)}>×</button><button aria-label="Move right" onClick={()=>move(m.id,1)}>→</button></div><small>{m.name}</small></div>)}</div>}</label>
      {media.length>0 && selected && <div className="fxPanel"><div className="fxHead"><b>Effects · {selected.name}</b></div>{[["Brightness","brightness",50,150],["Contrast","contrast",50,150],["Saturate","saturate",0,200],["Sepia","sepia",0,100],["Blur","blur",0,20],["Grayscale","grayscale",0,100]].map(([label,key,min,max])=><label key={key as string} className="fxRow"><span>{label}</span><input type="range" aria-label={label as string} min={min as number} max={max as number} value={selected.fx[key as keyof Fx]} onChange={e=>setFx({[key]:Number(e.target.value)} as Partial<Fx>)}/><em>{selected.fx[key as keyof Fx]}</em></label>)}<button className="fxReset" onClick={()=>setFx({...defaultFx})}>Reset effects</button></div>}
      {listing?<div className="formFields"><input aria-label="Listing title" placeholder={mode==="market"?"Listing title":"Stay or experience title"} value={title} onChange={e=>setTitle(e.target.value)}/><div><input aria-label="Price" placeholder="Price" value={price} onChange={e=>setPrice(e.target.value)}/><button onClick={()=>flash("Currency: demo USDC")}>demo USDC⌄</button></div><button onClick={()=>flash("Category picker · demo")}>{mode==="market"?"Category":"Calendar & availability"} ›</button></div>:<div className="formFields"><textarea aria-label="Post text" placeholder={mode==="work"?`Write your ${kind.toLowerCase()}…`:"Write a caption or Pulse post…"} value={caption} onChange={e=>setCaption(e.target.value)}/></div>}
      <button className="soundBtn" onClick={()=>{setSoundOpen(true)}}>♫ Sound: {sound} ›</button>
      <div className="draftRow"><button onClick={saveDraft}>Save draft</button><button onClick={loadDraft}>Load draft</button></div>
      <button className="publish" onClick={()=>{flash(`${kind} draft created · nothing published`);onClose()}}>Preview {kind.toLowerCase()}</button>
      <small className="demoOnly">Local demo — synthetic data · nothing is uploaded, published or charged</small>
    </div>
    {camOpen&&<CameraCaptureSheet onCapture={addCameraShot} onClose={()=>setCamOpen(false)}/>}
    {soundOpen&&<SoundPicker sound={sound} onSelect={(s)=>{setSound(s);if(s!=="None")playSound(s);}} onClose={()=>setSoundOpen(false)}/>}
  </div>;
}

function AuthSheet({ onClose, onDone, flash }:{ onClose:()=>void; onDone:(s:Session)=>void; flash:Flash }) {
  const [mode,setMode]=useState<"in"|"up">("up");
  const [handle,setHandle]=useState(""); const [name,setName]=useState(""); const [profile,setProfile]=useState<ProfileMode>("social");
  const submit=()=>{ const h=(handle.trim()||"nexus-user").replace(/^@/,""); const s:Session={handle:`@${h}`,name:name.trim()||h,profile,at:new Date().toISOString()}; onDone(s); flash(mode==="up"?"Demo account created · local only":"Signed in · local demo session"); };
  return <Sheet id="auth" title={mode==="up"?"Create account":"Sign in"} subtitle="Local demo identity · no real data stored or sent" onClose={onClose}>
    <div className="chipRow">{(["up","in"] as const).map(m=><button aria-pressed={mode===m} key={m} className={mode===m?"active":""} onClick={()=>setMode(m)}>{m==="up"?"Sign up":"Sign in"}</button>)}</div>
    <div className="formFields">
      <input aria-label="Handle" placeholder="@handle" value={handle} onChange={e=>setHandle(e.target.value)}/>
      {mode==="up" && <input aria-label="Display name" placeholder="Display name" value={name} onChange={e=>setName(e.target.value)}/>}
      <div className="fieldLabel">Primary mode</div>
      <div className="chipRow">{profiles.map(p=><button aria-pressed={profile===p.id} key={p.id} className={profile===p.id?"active":""} onClick={()=>setProfile(p.id)}>{p.name}</button>)}</div>
    </div>
    <button className="gradientAction" onClick={submit}>{mode==="up"?"Create demo account":"Continue"}</button>
    <small className="demoOnly">Local only — synthetic identity, nothing leaves this device</small>
  </Sheet>;
}

function SearchSheet({ onClose, flash }:{ onClose:()=>void; flash:Flash }) {
  const [q,setQ]=useState("");
  const results=modules.filter(m=>m.name.toLowerCase().includes(q.toLowerCase()));
  return <Sheet id="search" title="Search" subtitle="Synthetic results across all modules" onClose={onClose}><div className="chatCompose"><input aria-label="Search query" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search people, posts, listings…"/></div>{q?results.map(m=><button className="rowAction" key={m.id} onClick={()=>{onClose();flash(`Search result: ${m.name} · demo`)}}><span><b>{m.name}</b><small>{m.section}</small></span><em>Demo</em></button>):<p className="screenSub">Type to see synthetic results.</p>}</Sheet>;
}

function NotesSheet({ onClose, flash }:{ onClose:()=>void; flash:Flash }) {
  const notes=[["LunaKai liked your reply","2m"],["Nova Labs viewed your profile","1h"],["Escrow is protected · demo","3h"],["New demo connection","Yesterday"]];
  return <Sheet id="notifications" title="Notifications" subtitle="Synthetic alerts" onClose={onClose}>{notes.map(([t,when])=><button className="rowAction" key={t} onClick={()=>flash(t)}><span><b>{t}</b></span><em>{when}</em></button>)}</Sheet>;
}

export default function Home() {
  const [active,setActive]=useState<ModuleId>("clips"); const [activeProfile,setActiveProfile]=useState<ProfileMode>("social"); const [activeSlot,setActiveSlot]=useState<NavSlot>("primary"); const [menu,setMenu]=useState(false); const [tip,setTip]=useState(false); const [composer,setComposer]=useState<ComposerMode|null>(null); const [notice,setNotice]=useState(""); const [search,setSearch]=useState(false); const [notes,setNotes]=useState(false); const [auth,setAuth]=useState(false); const [session,setSession]=usePersistentState<Session|null>("nexus_session",null);
  useFocusReturn(menu||tip||composer!==null||search||notes||auth);
  const launcherDialog=useDialogFocus<HTMLDivElement>(menu);
  const supportDialog=useDialogFocus<HTMLDivElement>(tip);
  const mod=modules.find(m=>m.id===active)!; const flash=(s:string)=>{setNotice(s);setTimeout(()=>setNotice(""),2200)};
  const activateProfile=(profile:ProfileMode)=>{setActiveProfile(profile);setActive(primaryTarget[profile]);setActiveSlot("primary")};
  const select=(id:ModuleId)=>{setActive(id);setMenu(false);if(id==="clips"||id==="signal"||id==="stream"||id==="creator"){setActiveProfile("social");setActiveSlot(id==="stream"?"utility":"primary")}else if(id==="work"){setActiveProfile("work");setActiveSlot("primary")}else if(id==="dating"){setActiveProfile("dating");setActiveSlot("primary")}else if(id==="stay"||id==="ride"||id==="beauty"){setActiveProfile("travel");setActiveSlot("primary")}else if(id==="market"){setActiveProfile("market");setActiveSlot("primary")}else if(id==="chat")setActiveSlot("inbox");else if(id==="profiles")setActiveSlot("switch")};
  const create=()=>{ if(!session){ setAuth(true); return; } setActiveSlot("create");setComposer(activeProfile); };
  const onAccount=()=>{ if(session){ setSession(null); flash("Signed out · local demo"); } else setAuth(true); };
  const navigate=(slot:NavSlot)=>{if(slot==="create"){create();return}setActiveSlot(slot);if(slot==="inbox")setActive("chat");else if(slot==="switch")setActive("profiles");else if(slot==="primary")setActive(primaryTarget[activeProfile]);else setActive(utilityTarget[activeProfile])};
  let content:React.ReactNode;
  if(active==="clips") content=<ClipsScreen onTip={()=>setTip(true)} onCreate={create} flash={flash}/>;
  else if(active==="profiles") content=<ProfilesScreen activeProfile={activeProfile} onActivate={activateProfile} flash={flash}/>;
  else if(active==="market") content=<MarketScreen view={activeSlot==="utility"?"orders":"browse"} onCreate={create} flash={flash}/>;
  else if(active==="chat") content=<ChatScreen flash={flash}/>;
  else if(active==="creator") content=<CreatorScreen flash={flash}/>;
  else if(active==="work") content=<WorkScreen view={activeSlot==="utility"?"jobs":"feed"} onCreate={create} flash={flash}/>;
  else if(active==="dating") content=<DatingScreen view={activeSlot==="utility"?"connections":"discover"} flash={flash}/>;
  else if(active==="stay") content=<TravelScreen view={activeSlot==="utility"?"trips":"explore"} onCreate={create} flash={flash}/>;
  else if(active==="stream") content=<StreamScreen onCreate={create} flash={flash}/>;
  else if(active==="pay") content=<PayScreen flash={flash}/>;
  else if(active==="prive") content=<PriveScreen flash={flash}/>;
  else content=<GenericScreen mod={mod} flash={flash}/>;
  return <main className="nexusDemo">
    <div className="demoRibbon" role="status">LOCAL INTERACTIVE DEMO · SYNTHETIC DATA · NO PROVIDERS · 0 REAL FUNDS</div>
    <header className="showcaseHeader"><div className="trustTag">◇ <span>LOCAL STATE<br/><b>SIMULATED</b></span></div><div className="heroBrand">NE<span>X</span>US<small>THE WORLD&apos;S BLOCKCHAIN SOCIAL SUPER-APP</small></div><div className="trustTag">▣ <span>PRIVACY<br/><b>BY DESIGN</b></span></div></header>
    <section className="demoStage">
      <aside className="moduleRail"><small>OPEN A MODULE</small>{modules.map(m=><button key={m.id} className={active===m.id?"active":""} style={{"--accent":m.color} as React.CSSProperties} onClick={()=>select(m.id)}><i>{m.icon}</i><span><b>{m.name}</b><small>{m.section}</small></span></button>)}</aside>
      <div className="phone"><div className="phoneMetal"><div className="phoneScreen"><div className="phoneDemoLabel">DEMO · SYNTHETIC · 0 FUNDS</div><div className="dynamicIsland"/><AppHeader profile={activeProfile} onMenu={()=>setMenu(!menu)} onCreate={create} onSwitch={()=>navigate("switch")} onSearch={()=>setSearch(true)} onNotes={()=>setNotes(true)} onAccount={onAccount} session={session}/><div className="sessionStrip"><button onClick={onAccount}>{session?`Signed in as ${session.handle}`:"Not signed in · tap to sign in"}</button></div><div className="screenViewport">{content}</div><AppNav profile={activeProfile} activeSlot={activeSlot} onSelect={navigate}/>{menu&&<div ref={launcherDialog} tabIndex={-1} className="launcher" role="dialog" aria-modal="true" aria-labelledby="launcherTitle" onKeyDown={event=>trapDialogFocus(event,()=>setMenu(false))}><div className="launcherHead"><span><b id="launcherTitle">All Nexus modules</b><small>Choose what you want to do · synthetic demo</small></span><button aria-label="Close module launcher" onClick={()=>setMenu(false)}>×</button></div><div>{modules.map(m=><button key={m.id} onClick={()=>select(m.id)} style={{"--accent":m.color} as React.CSSProperties}><i>{m.icon}</i><span>{m.name}</span></button>)}</div></div>}{tip&&<div ref={supportDialog} tabIndex={-1} className="phoneModal" role="dialog" aria-modal="true" aria-labelledby="supportTitle" onKeyDown={event=>trapDialogFocus(event,()=>setTip(false))}><button aria-label="Close demo support" className="close" onClick={()=>setTip(false)}>×</button><div className="tipCoin">$</div><small>DEMO OPTIONAL SUPPORT</small><h2 id="supportTitle">Support LunaKai</h2><p>Likes, comments and follows stay free. No real funds move in this demo.</p><div className="tipAmounts" role="group" aria-label="Demo support amount"><button aria-pressed="false" onClick={()=>flash("Selected Demo $0.10")}>Demo $0.10</button><button aria-pressed="true" className="active" onClick={()=>flash("Selected Demo $0.50")}>Demo $0.50</button><button aria-pressed="false" onClick={()=>flash("Selected Demo $2.00")}>Demo $2.00</button></div><button className="gradientAction" onClick={()=>{setTip(false);flash("Demo support receipt · 0 real funds")}}>Confirm demo support</button><em>DEMO ONLY · 0 EGLD</em></div>}{composer&&<Composer mode={composer} session={session} onClose={()=>{setComposer(null);setActiveSlot(active==="chat"?"inbox":active==="profiles"?"switch":activeSlot==="create"?"primary":activeSlot)}} flash={flash}/>}{search&&<SearchSheet onClose={()=>setSearch(false)} flash={flash}/>}{notes&&<NotesSheet onClose={()=>setNotes(false)} flash={flash}/>}{auth&&<AuthSheet onClose={()=>setAuth(false)} onDone={(s)=>{setSession(s);setAuth(false)}} flash={flash}/>}</div></div></div>
      <aside className="infoPanel"><span className="infoIcon" style={{color:mod.color}}>{mod.icon}</span><small>{profileTitles[activeProfile].toUpperCase()} MODE · {mod.section}</small><h1>Nexus {mod.name}</h1><p>{mod.tag}</p><div className="modeArchitecture"><b>MODE NAVIGATION</b><span>{navItems[activeProfile].map(item=>item[2]).join(" · ")}</span><small>Messages stay second in every profile. Create adapts to the active mode.</small></div><div className="infoFeatures">{mod.features.map(f=><div key={f}>✓ {f}</div>)}</div><section className="freeSupport"><div><i>♡</i><span><b>FREE ENGAGEMENT</b><small>React, comment, share and follow.</small></span></div><div><i>$</i><span><b>OPTIONAL SUPPORT</b><small>Direct creator support.</small></span></div></section><button className="infoCreate" onClick={create}>＋ Create in {profileTitles[activeProfile]}</button><button className="infoCreate" onClick={onAccount}>{session?`Account: ${session.handle}`:"Sign in / Create account"}</button><div className="honest"><b>DEMO STATUS</b><span>Interactive local prototype · production providers are not connected</span></div></aside>
    </section>
    <footer className="showcaseFooter"><div>◎ <b>BUILT FOR THE WORLD</b></div><p><span>NEXUS is free to join and use.</span><br/>Support creators only when you choose.</p><div>♙ <b>FREE ENGAGEMENT + PAID SUPPORT</b></div></footer>
    {notice&&<div className="notice" role="status">✓ {notice}</div>}
  </main>;
}