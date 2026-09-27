import {DatingCheckpointBoundary,DatingPolicyBoundary,DatingPolicyError,DatingProfileBoundary,DatingProfileCommand,DatingRegistry,DatingTrustBoundary,DatingTrustClaims,PrivateActionRecorder,PrivateInteractionAuthorization,scanDatingLeakage} from "./index";
import {ActionEnvelope,ActionRecordedEvent,ChainPolicyError,NexusActionsSandbox,PreparedAction} from "../../chain-actions-api/index";
declare const process:{stdout:{write(v:string):void}};
let assertions=0;
function assert(v:unknown,m:string):asserts v{assertions++;if(!v)throw new Error(`ASSERT:${m}`)}
function expect(fn:()=>unknown,code:string){let actual="NO_ERROR";try{fn()}catch(e){actual=e instanceof DatingPolicyError?e.code:e instanceof ChainPolicyError?e.code:String(e)}assert(actual===code,`expected ${code}, got ${actual}`)}
async function expectAsync(fn:()=>Promise<unknown>,code:string){let actual="NO_ERROR";try{await fn()}catch(e){actual=e instanceof DatingPolicyError?e.code:e instanceof ChainPolicyError?e.code:String(e)}assert(actual===code,`expected ${code}, got ${actual}`)}
class Issuer<T extends object>{values=new Set<string>();issue(v:T){this.values.add(JSON.stringify(v));return v}verify(v:Readonly<T>){return this.values.has(JSON.stringify(v))}}
class Profiles implements DatingProfileBoundary{active=true;isActiveDatingProfile(){return this.active}}
class Policy implements DatingPolicyBoundary{state={version:1,blocked:false,deviceActive:true,safetyClear:true};current(){return Object.freeze({...this.state})}}
class Trust implements DatingTrustBoundary{state={claimId:"CLAIM:DATING:1",trustVersion:1,profileCommitment:"1".repeat(64),profileGeneration:3,adultVerified:true as const,photoMatch:true as const,recentLiveness:true as const,livenessCheckedAt:"2026-08-09T22:00:00.000Z",expiresAt:"2026-08-09T23:00:00.000Z",revoked:false as boolean,observedAt:"2026-08-09T22:00:00.000Z"};current(){return Object.freeze({...this.state})}}
class Checkpoints implements DatingCheckpointBoundary{state={checkpointId:"CHECKPOINT:DATING:1",receiptCount:0,receiptSetCommitment:"0".repeat(64),trustClaimId:"CLAIM:DATING:1",trustVersion:1,policyVersion:3};current(){return Object.freeze({...this.state})}}

const NOW="2026-08-09T22:00:00.000Z",NOWMS=Date.parse(NOW),EXP="2026-08-09T23:00:00.000Z",P="1".repeat(64),ALIAS="2".repeat(64),MEDIA="3".repeat(64),PREF="4".repeat(64),SESSION="5".repeat(64),CONTROLLER="6".repeat(64),GENERIC="7".repeat(64),MATCH="8".repeat(64),H="a".repeat(128);
async function main(){
 const profiles=new Profiles(),policy=new Policy(),trustBoundary=new Trust(),registry=new DatingRegistry(profiles,policy,trustBoundary),commands=new Issuer<DatingProfileCommand>(),trustClaims=new Issuer<DatingTrustClaims>(),auths=new Issuer<PrivateInteractionAuthorization>();
 const command=commands.issue({schemaVersion:1,profileCommitment:P,profileGeneration:3,aliasCommitment:ALIAS,mediaManifestCommitment:MEDIA,preferenceVaultCommitment:PREF,consentVersion:2,visibility:"INCOGNITO",syntheticLabel:"SYSTEM_TEST",activatedAt:NOW,signature:H});
 const claims=trustClaims.issue({schemaVersion:1,claimId:"CLAIM:DATING:1",trustVersion:1,profileCommitment:P,profileGeneration:3,adultVerified:true,identityAssurance:"STRONG",photoMatch:true,recentLiveness:true,livenessCheckedAt:NOW,issuedAt:NOW,expiresAt:EXP,issuerKeyId:"KEY:TRUST:1",signature:H});
 expect(()=>registry.activate({...command,gender:"hidden"},claims,commands,trustClaims,NOW),"DATING_PROFILE_INVALID");
 expect(()=>registry.activate(command,{...claims,adultVerified:"true"},commands,{verify:()=>true},NOW),"DATING_TRUST_DENIED");
 assert(registry.activate(command,claims,commands,trustClaims,NOW).globalSearchEligible===false,"adult verified incognito profile is isolated from global search");

 const relayer=`erd1${"r".repeat(58)}`,contractAddress=`erd1${"q".repeat(58)}`,context={chainId:"D",contractAddress,relayer,relayerAgreementVerified:true,nowMs:NOWMS,payments:[] as readonly unknown[]};
 let mutation=()=>{};
 const sandbox=new NexusActionsSandbox({async verifyEd25519(){const m=mutation;mutation=()=>{};m();return true}});
 sandbox.registerCapability({controller:CONTROLLER,actorKind:"HUMAN",actorCommitment:P,sessionPublicKey:SESSION,scopes:["PRIVATE_COMMITMENT"],maxActions:2,validFromMs:NOWMS-1000,expiresAtMs:NOWMS+7200000,authorizedRelayers:[relayer]},CONTROLLER,NOWMS);
 let retained:PreparedAction|null=null;
 const recorder:PrivateActionRecorder={
  async preparePrivateAction(g,e,s,c,a){retained=await sandbox.preparePrivateAction(g,e as ActionEnvelope,s,c,a);return{opaque:retained}},
  commitPreparedAction(p,expected){const e=sandbox.commitPreparedActionExact(p.opaque as PreparedAction,expected as ActionRecordedEvent);return{...e,actionClass:"PRIVATE_ACTION"}},
  abortPreparedAction(p){sandbox.abortPreparedAction(p.opaque as PreparedAction)}
 };
 function authorization(action:"SWIPE"|"MATCH",generic:string,id:string,nonce:string):PrivateInteractionAuthorization{return auths.issue({schemaVersion:1,authorizationId:id,action,actorProfileCommitment:P,actorProfileGeneration:3,genericCommitment:generic,sessionPublicKey:SESSION,actionNonce:nonce,profileStateVersion:1,policyVersion:policy.state.version,trustClaimId:trustBoundary.state.claimId,trustVersion:trustBoundary.state.trustVersion,chainId:"D",contractAddress,evaluatedAt:NOW,expiresAt:EXP,issuerKeyId:"KEY:PRIVATE:1",signature:H})}
 function envelope(generic:string,nonce:bigint){return{version:1 as const,actorKind:"HUMAN" as const,actorCommitment:P,actionType:"PRIVATE_ACTION" as const,objectCommitment:generic,payloadHashOrCid:generic,visibilityClass:"PRIVATE_COMMITMENT" as const,actionNonce:nonce,issuedAtMs:NOWMS-100,expiresAtMs:NOWMS+10000,sessionPublicKey:SESSION}}

 const trustRace=authorization("SWIPE",GENERIC,"AUTH:TRUST:RACE","1");mutation=()=>{trustBoundary.state={...trustBoundary.state,revoked:true,observedAt:"2026-08-09T22:01:00.000Z"}};
 await expectAsync(()=>registry.executePrivate(trustRace,envelope(GENERIC,1n),H,context,auths,recorder,NOW),"DATING_TRUST_REVOKED");
 await expectAsync(()=>Promise.resolve(sandbox.commitPreparedAction(retained as PreparedAction)),"PREPARED_ACTION_INVALID");assert(sandbox.drainEvents().length===0,"trust race aborts prepared token with zero private actions");
 trustBoundary.state={...trustBoundary.state,revoked:false,observedAt:"2026-08-09T22:02:00.000Z"};
 const policyRace=authorization("SWIPE",GENERIC,"AUTH:POLICY:RACE","1");mutation=()=>{policy.state={version:2,blocked:true,deviceActive:false,safetyClear:false}};
 await expectAsync(()=>registry.executePrivate(policyRace,envelope(GENERIC,1n),H,context,auths,recorder,NOW),"DATING_EXECUTION_STATE_CONFLICT");
 await expectAsync(()=>Promise.resolve(sandbox.commitPreparedAction(retained as PreparedAction)),"PREPARED_ACTION_INVALID");assert(sandbox.drainEvents().length===0,"policy race produces no private action");policy.state={version:3,blocked:false,deviceActive:true,safetyClear:true};

 const substitutionPrepared=await sandbox.preparePrivateAction(GENERIC,envelope(GENERIC,1n),H,context,{saltEntropyBits:128,targetIncludedInClear:false,generatedOnUserDevice:true});
 await expectAsync(()=>Promise.resolve(sandbox.commitPreparedActionExact(substitutionPrepared,{identifier:"ActionRecorded",actorCommitment:MATCH,objectCommitment:GENERIC,actionNonce:"1",actionClass:"PRIVATE_ACTION"})),"PREPARED_ACTION_BINDING_MISMATCH");sandbox.abortPreparedAction(substitutionPrepared);assert(sandbox.drainEvents().length===0,"actor substitution is rejected before chain emission");

 const swipe=authorization("SWIPE",GENERIC,"AUTH:SWIPE:1","1");
 await expectAsync(()=>registry.executePrivate(swipe,{...envelope(GENERIC,1n),objectCommitment:MATCH},H,context,auths,recorder,NOW),"DATING_ENVELOPE_BINDING_MISMATCH");
 let failCommit=true;const failureRecorder:PrivateActionRecorder={...recorder,commitPreparedAction(p,e){if(failCommit){failCommit=false;throw new ChainPolicyError("INJECTED_COMMIT_FAILURE")}return recorder.commitPreparedAction(p,e)}};
 await expectAsync(()=>registry.executePrivate(swipe,envelope(GENERIC,1n),H,context,auths,failureRecorder,NOW),"INJECTED_COMMIT_FAILURE");assert(sandbox.drainEvents().length===0,"commit failure creates no orphan event");
 const concurrent=await Promise.allSettled([registry.executePrivate(swipe,envelope(GENERIC,1n),H,context,auths,recorder,NOW),registry.executePrivate(swipe,envelope(GENERIC,1n),H,context,auths,recorder,NOW)]);
 const winners=concurrent.filter(x=>x.status==="fulfilled"),losers=concurrent.filter(x=>x.status==="rejected");assert(winners.length===1&&losers.length===1,"same authorization concurrency has exactly one winner");const receipt=winners[0].status==="fulfilled"?winners[0].value:fail("winner missing");
 await expectAsync(()=>registry.executePrivate(authorization("SWIPE",GENERIC,"AUTH:SWIPE:NONCE-REUSE","1"),envelope(GENERIC,1n),H,context,auths,recorder,NOW),"DATING_AUTH_REPLAY");
 const match=authorization("MATCH",MATCH,"AUTH:MATCH:1","2"),matchReceipt=await registry.executePrivate(match,envelope(MATCH,2n),H,context,auths,recorder,NOW);assert(matchReceipt.ordinal===2&&matchReceipt.previousReceiptHash===receipt.receiptHash,"mutual match extends authenticated ordered lineage");

 const events=sandbox.drainEvents();assert(events.length===2&&events.every(e=>e.actionClass==="PRIVATE_ACTION"),"chain emits two private actions");
 const serialized=JSON.stringify({profile:registry.getProfile(),receipts:[receipt,matchReceipt],events});assert(scanDatingLeakage(serialized).length===0,"profile receipts events and logs contain no target preference orientation or location");
 const snapIssuer=new Issuer<ReturnType<DatingRegistry["snapshot"]>>(),snapshot=snapIssuer.issue(registry.snapshot({checkpointId:"CHECKPOINT:DATING:1",receiptSetCommitment:matchReceipt.receiptHash,issuedAt:NOW,expiresAt:EXP,issuerKeyId:"KEY:CHECKPOINT:1",signature:H}));
 const checkpoints=new Checkpoints();checkpoints.state={checkpointId:snapshot.checkpointId,receiptCount:snapshot.receiptCount,receiptSetCommitment:snapshot.receiptSetCommitment,trustClaimId:snapshot.trustClaimId,trustVersion:snapshot.trustVersion,policyVersion:snapshot.policyVersion};
 assert(snapshot.receiptCount===2&&scanDatingLeakage(JSON.stringify(snapshot)).length===0,"checkpoint remains free of dating target and preference leakage");
 const restored=await DatingRegistry.restore(snapshot,snapshot.checkpointId,profiles,policy,trustBoundary,checkpoints,snapIssuer,auths,NOW);assert(restored.getProfile()?.visibility==="INCOGNITO","signed checkpoint restores isolated dating profile");
 const freshSandbox=new NexusActionsSandbox({async verifyEd25519(){return true}});freshSandbox.registerCapability({controller:CONTROLLER,actorKind:"HUMAN",actorCommitment:P,sessionPublicKey:SESSION,scopes:["PRIVATE_COMMITMENT"],maxActions:2,validFromMs:NOWMS-1000,expiresAtMs:NOWMS+7200000,authorizedRelayers:[relayer]},CONTROLLER,NOWMS);const freshRecorder:PrivateActionRecorder={async preparePrivateAction(g,e,s,c,a){return{opaque:await freshSandbox.preparePrivateAction(g,e as ActionEnvelope,s,c,a)}},commitPreparedAction(p,e){return freshSandbox.commitPreparedActionExact(p.opaque as PreparedAction,e as ActionRecordedEvent) as typeof e},abortPreparedAction(p){freshSandbox.abortPreparedAction(p.opaque as PreparedAction)}};
 await expectAsync(()=>restored.executePrivate(authorization("SWIPE",GENERIC,"AUTH:RESTORE:NONCE","1"),envelope(GENERIC,1n),H,context,auths,freshRecorder,NOW),"DATING_AUTH_REPLAY");
 await expectAsync(()=>DatingRegistry.restore({...snapshot,extra:true},snapshot.checkpointId,profiles,policy,trustBoundary,checkpoints,snapIssuer,auths,NOW),"DATING_SNAPSHOT_INVALID");
 const targetLeak={...snapshot,likedProfile:"PROFILE:TARGET"};await expectAsync(()=>DatingRegistry.restore(targetLeak,snapshot.checkpointId,profiles,policy,trustBoundary,checkpoints,{verify:()=>true},auths,NOW),"DATING_SNAPSHOT_INVALID");
 const prefix={...snapshot,receiptCount:1,receiptSetCommitment:receipt.receiptHash,receipts:[snapshot.receipts[0]]};await expectAsync(()=>DatingRegistry.restore(prefix,snapshot.checkpointId,profiles,policy,trustBoundary,checkpoints,{verify:()=>true},auths,NOW),"DATING_CHECKPOINT_STALE");
 const fabricated={...snapshot,receipts:[snapshot.receipts[0],{...snapshot.receipts[1],genericCommitment:GENERIC}]};await expectAsync(()=>DatingRegistry.restore(fabricated,snapshot.checkpointId,profiles,policy,trustBoundary,checkpoints,{verify:()=>true},auths,NOW),"DATING_SNAPSHOT_INVALID");
 process.stdout.write(JSON.stringify({schema_version:1,task_id:"NX-DATING-P01",status:"PASS",assertions,actor_class:"SYSTEM_TEST",profile:{adult_verified:true,photo_match:true,recent_liveness:true,trust_current_state:true,incognito:true,global_search:false,organic_metrics:false},private_actions:{swipe:true,match:true,count:2,action_class:"PRIVATE_ACTION",salt_entropy_bits:128,target_in_clear:false,exact_chain_receipt:true,ordered_lineage:true},leakage:{target:0,preference:0,orientation:0,location:0,pii:0},negative:{exact_shape:true,boolean_string:true,trust_race:true,policy_race:true,retained_prepared_action:true,envelope_substitution:true,chain_receipt_substitution:true,commit_failure:true,authorization_replay:true,nonce_replay:true,concurrent_authorization:true,restore_replay:true,snapshot_exact_shape:true,snapshot_target_leak:true,snapshot_prefix:true,snapshot_fabrication:true},network_operations:0,provider_operations:0,economic_operations:0,incremental_cost:{amount:0,currency:"EUR"}}))
}
function fail(message:string):never{throw new Error(message)}
void main();
