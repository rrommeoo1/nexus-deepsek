export type GenesisAction = "UPSERT" | "TOMBSTONE";
export type GenesisRole = "GATEWAY" | "EVENT_LOG" | "REPLICA" | "STORAGE" | "INDEX" | "JOBS";

export interface GenesisManifest {
  schemaVersion: 1; nodeId: string; mode: "D0_GENESIS"; protocol: "/nexus/shards/1.0";
  reducerVersion: "genesis-reducer/1.0.0"; replicationFactor: 1; roles: readonly GenesisRole[];
  authorityKeyId: string; syntheticLabel: "SYSTEM_TEST";
}
export interface GenesisCommand {
  schemaVersion: 1; eventId: string; objectCommitment: string; valueCommitment: string;
  action: GenesisAction; occurredAt: string; actorClass: "SYSTEM_TEST"; signature: string;
}
export interface GenesisEvent extends GenesisCommand {
  ordinal: number; previousEventHash: string; eventHash: string;
}
export interface GenesisStateEntry { objectCommitment: string; kind: "VALUE" | "TOMBSTONE"; valueCommitment: string; ordinal: number; }
export interface GenesisProjection {
  schemaVersion: 1; nodeId: string; reducerVersion: "genesis-reducer/1.0.0"; eventCount: number;
  rangeStart: number; rangeEnd: number; eventHead: string; stateRoot: string; state: readonly GenesisStateEntry[];
}
export interface GenesisCheckpoint {
  schemaVersion: 1; checkpointVersion: 1; manifest: GenesisManifest; rangeStart: number; rangeEnd: number;
  eventHead: string; stateRoot: string; events: readonly GenesisEvent[]; replayIndex: readonly string[];
  previousCheckpointHash: string; checkpointHash: string; signature: string;
}
export interface GenesisBackupReceipt {
  schemaVersion: 1; storageClass: "LOCAL_FIXTURE"; checkpointHash: string; stateRoot: string;
  eventHead: string; eventCount: number; byteLength: number;
}
export interface GenesisDisposalReceipt {
  schemaVersion: 1; nodeId: string; clearedEvents: number; clearedReplayEntries: number; disposed: true;
}

export class GenesisNodeError extends Error { constructor(readonly code: string) { super(code); this.name = "GenesisNodeError"; } }
const ZERO = "0".repeat(64); const HASH = /^[a-f0-9]{64}$/; const ID = /^[A-Z][A-Z0-9._:-]{2,79}$/; const NODE = /^NODE:GENESIS:[A-Z0-9_-]{3,32}$/; const KEY = /^NODE-AUTHORITY:[A-Z0-9_-]{3,32}$/; const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ROLES: readonly GenesisRole[] = Object.freeze(["GATEWAY", "EVENT_LOG", "REPLICA", "STORAGE", "INDEX", "JOBS"]);
const MANIFEST_KEYS=["schemaVersion","nodeId","mode","protocol","reducerVersion","replicationFactor","roles","authorityKeyId","syntheticLabel"] as const;
const COMMAND_KEYS=["schemaVersion","eventId","objectCommitment","valueCommitment","action","occurredAt","actorClass","signature"] as const;
const EVENT_KEYS=[...COMMAND_KEYS,"ordinal","previousEventHash","eventHash"] as const;
const ENTRY_KEYS=["objectCommitment","kind","valueCommitment","ordinal"] as const;
const CHECKPOINT_KEYS=["schemaVersion","checkpointVersion","manifest","rangeStart","rangeEnd","eventHead","stateRoot","events","replayIndex","previousCheckpointHash","checkpointHash","signature"] as const;
function fail(code:string):never{throw new GenesisNodeError(code)}
function object(value:unknown,keys:readonly string[],code:string):Record<string,unknown>{if(value===null||typeof value!=="object"||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail(code);const a=Object.keys(value as object).sort(),e=[...keys].sort();if(a.length!==e.length||a.some((v,i)=>v!==e[i]))fail(code);return value as Record<string,unknown>}
function integer(value:unknown,min:number,max:number,code:string):number{if(typeof value!=="number"||!Number.isSafeInteger(value)||value<min||value>max)fail(code);return value}
function string(value:unknown,pattern:RegExp,code:string):string{if(typeof value!=="string"||!pattern.test(value))fail(code);return value}
function exact<T extends string>(value:unknown,allowed:readonly T[],code:string):T{if(typeof value!=="string"||!allowed.includes(value as T))fail(code);return value as T}
function canonical(value:unknown):string{if(value===null||typeof value==="boolean"||typeof value==="number"||typeof value==="string")return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;const o=value as Record<string,unknown>;return`{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`}
function canonicalSnapshot(value:unknown,code:string):Readonly<{value:unknown;serialized:string}>{try{const serialized=canonical(value),copy=JSON.parse(serialized);return frozen({value:copy,serialized})}catch{fail(code)}}
async function sha256(value:string):Promise<string>{const subtle=globalThis.crypto?.subtle;if(!subtle)fail("CRYPTO_UNAVAILABLE");const d=await subtle.digest("SHA-256",new TextEncoder().encode(value));return[...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,"0")).join("")}
function frozen<T extends object>(value:T):Readonly<T>{return Object.freeze(value)}
function manifest(input:unknown):Readonly<GenesisManifest>{const o=object(input,MANIFEST_KEYS,"GENESIS_MANIFEST_INVALID");if(o.schemaVersion!==1||o.mode!=="D0_GENESIS"||o.protocol!=="/nexus/shards/1.0"||o.reducerVersion!=="genesis-reducer/1.0.0"||o.replicationFactor!==1||o.syntheticLabel!=="SYSTEM_TEST"||!Array.isArray(o.roles)||o.roles.length!==ROLES.length||o.roles.some((r,i)=>r!==ROLES[i]))fail("GENESIS_MANIFEST_INVALID");return frozen({schemaVersion:1,nodeId:string(o.nodeId,NODE,"GENESIS_MANIFEST_INVALID"),mode:"D0_GENESIS",protocol:"/nexus/shards/1.0",reducerVersion:"genesis-reducer/1.0.0",replicationFactor:1,roles:ROLES,authorityKeyId:string(o.authorityKeyId,KEY,"GENESIS_MANIFEST_INVALID"),syntheticLabel:"SYSTEM_TEST"})}
function command(input:unknown):Readonly<GenesisCommand>{const o=object(input,COMMAND_KEYS,"GENESIS_COMMAND_INVALID");if(o.schemaVersion!==1||o.actorClass!=="SYSTEM_TEST")fail("GENESIS_COMMAND_INVALID");const occurredAt=string(o.occurredAt,ISO,"GENESIS_COMMAND_INVALID");if(!Number.isFinite(Date.parse(occurredAt)))fail("GENESIS_COMMAND_INVALID");return frozen({schemaVersion:1,eventId:string(o.eventId,ID,"GENESIS_COMMAND_INVALID"),objectCommitment:string(o.objectCommitment,HASH,"GENESIS_COMMAND_INVALID"),valueCommitment:string(o.valueCommitment,HASH,"GENESIS_COMMAND_INVALID"),action:exact(o.action,["UPSERT","TOMBSTONE"],"GENESIS_COMMAND_INVALID"),occurredAt,actorClass:"SYSTEM_TEST",signature:string(o.signature,HASH,"GENESIS_COMMAND_INVALID")})}
function event(input:unknown):Readonly<GenesisEvent>{const o=object(input,EVENT_KEYS,"GENESIS_CHECKPOINT_INVALID");const c=command(Object.fromEntries(COMMAND_KEYS.map(k=>[k,o[k]])));return frozen({...c,ordinal:integer(o.ordinal,1,1_000_000,"GENESIS_CHECKPOINT_INVALID"),previousEventHash:string(o.previousEventHash,HASH,"GENESIS_CHECKPOINT_INVALID"),eventHash:string(o.eventHash,HASH,"GENESIS_CHECKPOINT_INVALID")})}
function entry(input:unknown):Readonly<GenesisStateEntry>{const o=object(input,ENTRY_KEYS,"GENESIS_STATE_INVALID");return frozen({objectCommitment:string(o.objectCommitment,HASH,"GENESIS_STATE_INVALID"),kind:exact(o.kind,["VALUE","TOMBSTONE"],"GENESIS_STATE_INVALID"),valueCommitment:string(o.valueCommitment,HASH,"GENESIS_STATE_INVALID"),ordinal:integer(o.ordinal,1,1_000_000,"GENESIS_STATE_INVALID")})}

export class GenesisFixtureAuthority {
  constructor(readonly keyId:string,private readonly fixtureKey:string){if(!KEY.test(keyId)||!HASH.test(fixtureKey))fail("GENESIS_AUTHORITY_INVALID")}
  async issueCommand(input:Omit<GenesisCommand,"signature">):Promise<Readonly<GenesisCommand>>{const unsigned={...input};return command({...unsigned,signature:await sha256(`${this.fixtureKey}:COMMAND:${canonical(unsigned)}`)})}
  async verifyCommand(input:GenesisCommand):Promise<boolean>{if(input.signature.length!==64)return false;const{signature,...unsigned}=input;return signature===await sha256(`${this.fixtureKey}:COMMAND:${canonical(unsigned)}`)}
  async signCheckpoint(unsigned:Omit<GenesisCheckpoint,"signature">):Promise<string>{return sha256(`${this.fixtureKey}:CHECKPOINT:${canonical(unsigned)}`)}
  async verifyCheckpoint(input:GenesisCheckpoint):Promise<boolean>{const{signature,...unsigned}=input;return input.manifest.authorityKeyId===this.keyId&&signature===await this.signCheckpoint(unsigned)}
}

function apply(events:readonly GenesisEvent[]):Map<string,Readonly<GenesisStateEntry>>{const state=new Map<string,Readonly<GenesisStateEntry>>();for(const e of events)state.set(e.objectCommitment,frozen({objectCommitment:e.objectCommitment,kind:e.action==="UPSERT"?"VALUE":"TOMBSTONE",valueCommitment:e.valueCommitment,ordinal:e.ordinal}));return state}
async function stateRoot(state:Map<string,Readonly<GenesisStateEntry>>):Promise<string>{return sha256(canonical([...state.values()].sort((a,b)=>a.objectCommitment.localeCompare(b.objectCommitment))))}
function bodyOf(e:GenesisEvent):GenesisCommand{return{schemaVersion:1,eventId:e.eventId,objectCommitment:e.objectCommitment,valueCommitment:e.valueCommitment,action:e.action,occurredAt:e.occurredAt,actorClass:"SYSTEM_TEST",signature:e.signature}}
async function eventHash(e:Omit<GenesisEvent,"eventHash">):Promise<string>{return sha256(canonical(e))}

export class GenesisNode {
  private readonly events:GenesisEvent[]=[];private readonly replay=new Set<string>();private checkpointHead=ZERO;private disposed=false;private operationTail:Promise<void>=Promise.resolve();
  readonly manifest:Readonly<GenesisManifest>;
  constructor(manifestInput:unknown,private readonly authority:GenesisFixtureAuthority){this.manifest=manifest(manifestInput);if(this.manifest.authorityKeyId!==authority.keyId)fail("GENESIS_AUTHORITY_MISMATCH")}
  private ensureActive(){if(this.disposed)fail("GENESIS_NODE_DISPOSED")}
  private async exclusive<T>(operation:()=>Promise<T>):Promise<T>{const previous=this.operationTail;let release!:()=>void;this.operationTail=new Promise<void>(resolve=>{release=resolve});await previous;try{this.ensureActive();return await operation()}finally{release()}}
  private async projectionUnsafe():Promise<Readonly<GenesisProjection>>{const state=apply(this.events),root=await stateRoot(state);return frozen({schemaVersion:1,nodeId:this.manifest.nodeId,reducerVersion:"genesis-reducer/1.0.0",eventCount:this.events.length,rangeStart:this.events.length===0?0:1,rangeEnd:this.events.length,eventHead:this.events.at(-1)?.eventHash??ZERO,stateRoot:root,state:frozen([...state.values()].sort((a,b)=>a.objectCommitment.localeCompare(b.objectCommitment)).map(v=>entry(v)))})}
  async append(input:unknown):Promise<Readonly<GenesisEvent>>{const c=command(input);return this.exclusive(async()=>{if(!await this.authority.verifyCommand(c))fail("GENESIS_COMMAND_SIGNATURE_INVALID");if(this.replay.has(c.eventId))fail("GENESIS_EVENT_REPLAY");const ordinal=this.events.length+1,previousEventHash=this.events.at(-1)?.eventHash??ZERO;const unsigned={...c,ordinal,previousEventHash};const e=frozen({...unsigned,eventHash:await eventHash(unsigned)});this.events.push(e);this.replay.add(c.eventId);return e})}
  async projection():Promise<Readonly<GenesisProjection>>{return this.exclusive(()=>this.projectionUnsafe())}
  async exportCheckpoint():Promise<Readonly<GenesisCheckpoint>>{return this.exclusive(async()=>{if(this.events.length===0)fail("GENESIS_EMPTY_CHECKPOINT");const p=await this.projectionUnsafe();const base={schemaVersion:1 as const,checkpointVersion:1 as const,manifest:this.manifest,rangeStart:p.rangeStart,rangeEnd:p.rangeEnd,eventHead:p.eventHead,stateRoot:p.stateRoot,events:frozen(this.events.map(e=>frozen({...e}))),replayIndex:frozen([...this.replay].sort()),previousCheckpointHash:this.checkpointHead};const checkpointHash=await sha256(canonical(base));const unsigned=frozen({...base,checkpointHash});const result=frozen({...unsigned,signature:await this.authority.signCheckpoint(unsigned)});this.checkpointHead=checkpointHash;return result})}
  async dispose():Promise<Readonly<GenesisDisposalReceipt>>{return this.exclusive(async()=>{const receipt=frozen({schemaVersion:1 as const,nodeId:this.manifest.nodeId,clearedEvents:this.events.length,clearedReplayEntries:this.replay.size,disposed:true as const});this.events.length=0;this.replay.clear();this.checkpointHead=ZERO;this.disposed=true;return receipt})}
  static async restore(input:unknown,authority:GenesisFixtureAuthority,expectedNodeId:string,expectedPreviousCheckpointHash=ZERO):Promise<GenesisNode>{const o=object(input,CHECKPOINT_KEYS,"GENESIS_CHECKPOINT_INVALID");if(o.schemaVersion!==1||o.checkpointVersion!==1||!Array.isArray(o.events)||!Array.isArray(o.replayIndex))fail("GENESIS_CHECKPOINT_INVALID");const m=manifest(o.manifest);if(m.nodeId!==expectedNodeId||m.authorityKeyId!==authority.keyId)fail("GENESIS_CHECKPOINT_IDENTITY_MISMATCH");const events=o.events.map(event),ids=o.replayIndex.map(v=>string(v,ID,"GENESIS_CHECKPOINT_INVALID"));if(ids.length!==events.length||new Set(ids).size!==ids.length||ids.some((v,i)=>i>0&&ids[i-1]>=v))fail("GENESIS_CHECKPOINT_INVALID");const cp:GenesisCheckpoint={schemaVersion:1,checkpointVersion:1,manifest:m,rangeStart:integer(o.rangeStart,1,1_000_000,"GENESIS_CHECKPOINT_INVALID"),rangeEnd:integer(o.rangeEnd,1,1_000_000,"GENESIS_CHECKPOINT_INVALID"),eventHead:string(o.eventHead,HASH,"GENESIS_CHECKPOINT_INVALID"),stateRoot:string(o.stateRoot,HASH,"GENESIS_CHECKPOINT_INVALID"),events:frozen(events),replayIndex:frozen(ids),previousCheckpointHash:string(o.previousCheckpointHash,HASH,"GENESIS_CHECKPOINT_INVALID"),checkpointHash:string(o.checkpointHash,HASH,"GENESIS_CHECKPOINT_INVALID"),signature:string(o.signature,HASH,"GENESIS_CHECKPOINT_INVALID")};if(cp.previousCheckpointHash!==expectedPreviousCheckpointHash)fail("GENESIS_CHECKPOINT_STALE");if(!await authority.verifyCheckpoint(cp))fail("GENESIS_CHECKPOINT_SIGNATURE_INVALID");const{checkpointHash,...signedWithoutHash}=(()=>{const{signature:_signature,...u}=cp;return u})();if(checkpointHash!==await sha256(canonical(signedWithoutHash)))fail("GENESIS_CHECKPOINT_HASH_INVALID");if(cp.rangeStart!==1||cp.rangeEnd!==events.length||events.length===0)fail("GENESIS_CHECKPOINT_RANGE_INVALID");let previous=ZERO;const seen=new Set<string>();for(let i=0;i<events.length;i+=1){const e=events[i];if(e.ordinal!==i+1||e.previousEventHash!==previous||seen.has(e.eventId)||!await authority.verifyCommand(bodyOf(e)))fail("GENESIS_EVENT_LINEAGE_INVALID");const{eventHash:stored,...unsigned}=e;if(stored!==await eventHash(unsigned))fail("GENESIS_EVENT_LINEAGE_INVALID");seen.add(e.eventId);previous=e.eventHash}if(cp.eventHead!==previous||canonical([...seen].sort())!==canonical(ids))fail("GENESIS_EVENT_LINEAGE_INVALID");const computedRoot=await stateRoot(apply(events));if(cp.stateRoot!==computedRoot)fail("GENESIS_STATE_ROOT_MISMATCH");const node=new GenesisNode(m,authority);node.events.push(...events);for(const id of ids)node.replay.add(id);node.checkpointHead=cp.checkpointHash;const restored=await node.projection();if(restored.stateRoot!==cp.stateRoot||restored.eventHead!==cp.eventHead||restored.eventCount!==cp.rangeEnd)fail("GENESIS_RESTORE_MISMATCH");return node}
}

export class GenesisBackupStore {
  private readonly snapshots=new Map<string,string>();
  async commit(input:unknown,authority:GenesisFixtureAuthority,expectedNodeId:string,expectedPreviousCheckpointHash=ZERO):Promise<Readonly<GenesisBackupReceipt>>{
    const captured=canonicalSnapshot(input,"GENESIS_CHECKPOINT_INVALID"),checkpoint=captured.value as GenesisCheckpoint;const verified=await GenesisNode.restore(checkpoint,authority,expectedNodeId,expectedPreviousCheckpointHash);const projection=await verified.projection(),existing=this.snapshots.get(checkpoint.checkpointHash);if(existing!==undefined&&existing!==captured.serialized)fail("GENESIS_BACKUP_CONFLICT");this.snapshots.set(checkpoint.checkpointHash,captured.serialized);await verified.dispose();return frozen({schemaVersion:1 as const,storageClass:"LOCAL_FIXTURE" as const,checkpointHash:checkpoint.checkpointHash,stateRoot:projection.stateRoot,eventHead:projection.eventHead,eventCount:projection.eventCount,byteLength:new TextEncoder().encode(captured.serialized).byteLength})
  }
  load(checkpointHashInput:unknown):unknown{const checkpointHash=string(checkpointHashInput,HASH,"GENESIS_BACKUP_NOT_FOUND"),snapshot=this.snapshots.get(checkpointHash);if(snapshot===undefined)fail("GENESIS_BACKUP_NOT_FOUND");return JSON.parse(snapshot)}
  get size():number{return this.snapshots.size}
}
