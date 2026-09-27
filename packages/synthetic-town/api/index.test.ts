import { SyntheticCheckpointAuthority, SyntheticTownError, SyntheticTownRunner, validateSyntheticActor } from "./index";
declare const process: { stdout: { write(value: string): void }; stderr: { write(value: string): void }; exitCode?: number };

let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions += 1; if (!value) throw new Error(message); }
async function expectCode(work: () => unknown | Promise<unknown>, code: string): Promise<void> { assertions += 1; try { await work(); throw new Error(`expected ${code}`); } catch (error) { if (!(error instanceof SyntheticTownError) || error.code !== code) throw error; } }
const RUN_ID = "NX-SYNTH-LOAD-0001";
const SEED = 0x5eed2026;
const KEY = "9f".repeat(32);
const AUTHORITY = new SyntheticCheckpointAuthority("SYNTH-CHECKPOINT:LOCAL_A37", KEY);
function request(seed = SEED, actorCount = 10_000) { return { schemaVersion: 1 as const, runId: RUN_ID, seed, actorCount, maxActors: 10_000 as const, maxJourneyActions: 40_000 as const, maxForbiddenAttempts: 50_000 as const, timeoutMs: 30_000 as const, networkAllowed: false as const, externalProcessesAllowed: false as const, realFundsAllowed: false as const }; }

async function main(): Promise<void> {
  const first = new SyntheticTownRunner(); const receipt = await first.run(request());
  assert(receipt.actorCount === 10_000, "exactly ten thousand actors complete");
  assert(receipt.journeyActionCount === 40_000, "four bounded actions per actor complete");
  assert(receipt.forbiddenEffectAttempts === 50_000 && receipt.forbiddenEffectDenials === 50_000, "all five production effects per actor are denied");
  assert(receipt.completedRequestCount === 10_000, "request index is complete");
  assert(/^[a-f0-9]{64}$/.test(receipt.corpusSha256), "corpus has sha256 commitment");
  assert(JSON.stringify(receipt.productionEffects) === JSON.stringify({ payoutAtomic: "0", reviews: 0, reputationDelta: 0, organicEvents: 0, adoptionEvents: 0 }), "production effects remain exactly zero");
  assert(receipt.networkOperations === 0 && receipt.externalProcessOperations === 0 && receipt.economicOperations === 0 && receipt.incrementalCostEur === 0, "run has zero external and economic effects");

  const second = new SyntheticTownRunner(); const repeat = await second.run(request());
  assert(JSON.stringify(repeat) === JSON.stringify(receipt), "identical seed produces identical receipt");
  const alternate = new SyntheticTownRunner(); const alternateReceipt = await alternate.run({ ...request(SEED + 1), runId: "NX-SYNTH-LOAD-0002" });
  assert(alternateReceipt.corpusSha256 !== receipt.corpusSha256, "different seed changes corpus commitment");

  const actor = SyntheticTownRunner.actor(1);
  assert(validateSyntheticActor(actor).trafficClass === "SYSTEM_TEST", "canonical actor validates");
  await expectCode(() => validateSyntheticActor({ ...actor, trafficClass: "HUMAN" }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => validateSyntheticActor({ ...actor, walletMode: "EXTERNAL" }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => validateSyntheticActor({ ...actor, dataMode: "REAL" }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => validateSyntheticActor({ ...actor, trafficClass: "SYSTEM_TEST", extra: true }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => validateSyntheticActor({ ...actor, trafficClass: "false" }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => new SyntheticTownRunner().run({ ...request(), actorCount: 10_001 }), "SYNTHETIC_RESOURCE_CAP_EXCEEDED");
  await expectCode(() => new SyntheticTownRunner().run({ ...request(), networkAllowed: true }), "SYNTHETIC_RUN_INVALID");
  await expectCode(() => new SyntheticTownRunner().run({ ...request(), externalProcessesAllowed: true }), "SYNTHETIC_RUN_INVALID");
  await expectCode(() => new SyntheticTownRunner().run({ ...request(), realFundsAllowed: true }), "SYNTHETIC_RUN_INVALID");
  await expectCode(() => first.run(request()), "SYNTHETIC_RUN_REPLAY");

  const checkpoint = await first.exportCheckpoint(AUTHORITY);
  assert(checkpoint.completedRequestIds.length === 10_000, "checkpoint carries complete replay index");
  const restored = await SyntheticTownRunner.restore(checkpoint, AUTHORITY);
  assert(JSON.stringify(restored.projection()) === JSON.stringify(first.projection()), "fresh runner restores exact projection");
  await expectCode(() => restored.executeJourney(SyntheticTownRunner.envelope(RUN_ID, SEED, 1)), "SYNTHETIC_REQUEST_REPLAY");
  await expectCode(() => SyntheticTownRunner.restore({ ...checkpoint, extra: true }, AUTHORITY), "SYNTHETIC_CHECKPOINT_INVALID");
  await expectCode(() => SyntheticTownRunner.restore({ ...checkpoint, completedRequestIds: checkpoint.completedRequestIds.slice(0, -1) }, AUTHORITY), "SYNTHETIC_CHECKPOINT_SIGNATURE_INVALID");
  await expectCode(() => SyntheticTownRunner.restore({ ...checkpoint, receipt: { ...checkpoint.receipt, organicEvents: 1 } }, AUTHORITY), "SYNTHETIC_CHECKPOINT_INVALID");
  await expectCode(() => SyntheticTownRunner.restore({ ...checkpoint, receipt: { ...checkpoint.receipt, corpusSha256: "0".repeat(64) } }, AUTHORITY), "SYNTHETIC_CHECKPOINT_SIGNATURE_INVALID");
  await expectCode(() => SyntheticTownRunner.restore({ ...checkpoint, authorityKeyId: "SYNTH-CHECKPOINT:OTHER" }, AUTHORITY), "SYNTHETIC_CHECKPOINT_SIGNATURE_INVALID");

  const envelope = SyntheticTownRunner.envelope("NX-SYNTH-SINGLE-0001", SEED, 1);
  const isolated = new SyntheticTownRunner(); isolated.executeJourney(envelope);
  const isolatedProjection = isolated.projection();
  assert(isolatedProjection.journeyActions === 4 && isolatedProjection.forbiddenAttempts === 5 && isolatedProjection.forbiddenDenials === 5, "single journey exercises all isolated sinks");
  assert(isolatedProjection.productionEffects.payoutAtomic === "0" && isolatedProjection.productionEffects.reviews === 0 && isolatedProjection.productionEffects.reputationDelta === 0 && isolatedProjection.productionEffects.organicEvents === 0 && isolatedProjection.productionEffects.adoptionEvents === 0, "single journey cannot poison production sinks");
  await expectCode(() => isolated.executeJourney({ ...envelope, requestId: "SYNTH-REQUEST:00000002", trafficClass: "AGENT" }), "SYNTHETIC_ACTOR_INVALID");
  await expectCode(() => isolated.executeJourney({ ...envelope, requestId: "SYNTH-REQUEST:00000002", surfaces: ["PROFILE_SWITCH", "CLIP_VIEW", "CHAT_MESSAGE"] }), "SYNTHETIC_JOURNEY_INVALID");

  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-SYNTH-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", actor_count: receipt.actorCount, journey_action_count: receipt.journeyActionCount, forbidden_effect_attempts: receipt.forbiddenEffectAttempts, forbidden_effect_denials: receipt.forbiddenEffectDenials, corpus_sha256: receipt.corpusSha256, deterministic_repeat: JSON.stringify(receipt) === JSON.stringify(repeat), production_effects: receipt.productionEffects, checkpoint: { authority_verified: true, request_index_count: checkpoint.completedRequestIds.length, exact_restore: true, fresh_replay_denied: true }, negative: { exact_shape: true, label_stripping: true, mixed_actor_class: true, boolean_string: true, cap_overflow: true, network_enable: true, external_process_enable: true, real_funds_enable: true, run_replay: true, request_replay_after_restore: true, checkpoint_extra_field: true, checkpoint_prefix: true, checkpoint_effect_poison: true, checkpoint_corpus_tamper: true, checkpoint_authority_substitution: true, journey_surface_truncation: true }, network_operations: 0, external_provider_operations: 0, economic_operations: 0, real_fund_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}
void main().catch((error) => { process.stderr.write(error instanceof Error ? (error.stack ?? `${error.name}:${error.message}`) : String(error)); process.exitCode = 1; });
