import { DeterministicMesh, MeshError, MeshFixtureAuthority, MeshManifest, MeshObjectCommand, MeshSnapshot, ReplicaReceipt } from "./index";

declare const process: { stdout: { write(value: string): void }; stderr: { write(value: string): void }; exitCode?: number };

let assertions = 0;
function assert(value: unknown, message: string): asserts value {
  assertions += 1;
  if (!value) throw new Error(message);
}
async function expectCode(operation: () => unknown | Promise<unknown>, code: string): Promise<void> {
  assertions += 1;
  try {
    await operation();
    throw new Error(`expected ${code}`);
  } catch (error) {
    if (!(error instanceof MeshError) || error.code !== code) throw error;
  }
}

const KEY = "a7".repeat(32);
const NOW = "2026-08-15T12:00:00Z";
const ZERO = "0".repeat(64);
const authority = new MeshFixtureAuthority("NODE-MESH-AUTH:LOCAL_A16", KEY);

function nodeId(index: number): string { return `NODE:MESH:${String(index).padStart(2, "0")}`; }
function domain(index: number): string { return `FD:REGION_${String(index).padStart(2, "0")}:OWNER_${String(index).padStart(2, "0")}`; }
function hash(byte: number): string { return byte.toString(16).padStart(2, "0").repeat(32); }

async function manifest(index: number, issuer: MeshFixtureAuthority = authority): Promise<Readonly<MeshManifest>> {
  return issuer.issueManifest({
    schemaVersion: 1,
    nodeId: nodeId(index),
    protocol: "/nexus/mesh/1.0",
    roles: ["CATALOG", "REPLICA", "REPAIR"],
    failureDomain: domain(index),
    capacityClass: "FIXTURE",
    syntheticLabel: "SYSTEM_TEST",
    walletRequired: false,
    bondRequired: false,
    rewardEligible: false,
    authorityKeyId: issuer.keyId
  });
}

async function command(index: number, issuer: MeshFixtureAuthority = authority): Promise<Readonly<MeshObjectCommand>> {
  return issuer.issueCommand({
    schemaVersion: 1,
    eventId: `MESH-EVENT:OBJECT:${String(index).padStart(2, "0")}`,
    objectId: hash(32 + index),
    valueCommitment: hash(96 + index),
    occurredAt: NOW,
    actorClass: "SYSTEM_TEST"
  });
}

class FaultInjectingAuthority extends MeshFixtureAuthority {
  failReceiptAfter: number | null = null;
  override async signReceipt(unsigned: Omit<ReplicaReceipt, "signature">): Promise<string> {
    if (this.failReceiptAfter !== null) {
      if (this.failReceiptAfter === 0) throw new MeshError("MESH_FIXTURE_SIGNING_FAILURE");
      this.failReceiptAfter -= 1;
    }
    return super.signReceipt(unsigned);
  }
}

async function build(nodeCount: number, commandIndex: number): Promise<DeterministicMesh> {
  const mesh = new DeterministicMesh(authority);
  for (let index = 1; index <= nodeCount; index += 1) await mesh.join(await manifest(index));
  await mesh.publish(await command(commandIndex));
  return mesh;
}

async function reseal(snapshotInput: MeshSnapshot, mutate: (draft: Record<string, unknown>) => void): Promise<Readonly<MeshSnapshot>> {
  const draft = JSON.parse(JSON.stringify(snapshotInput)) as Record<string, unknown>;
  mutate(draft);
  delete draft.checkpointHash;
  delete draft.signature;
  return authority.sealSnapshot(draft as unknown as Omit<MeshSnapshot, "checkpointHash" | "signature">);
}

async function main(): Promise<void> {
  const fixtureResults: Array<{ nodeCount: number; replication: number; catalogRoot: string; receiptHead: string }> = [];
  for (let count = 1; count <= 8; count += 1) {
    const mesh = await build(count, count);
    const projection = await mesh.projection();
    const object = projection.objects[0];
    const roots = await mesh.nodeCatalogRoots();
    assert(projection.nodeCount === count && projection.onlineNodeCount === count, `N=${count} membership converges`);
    assert(projection.targetReplication === Math.min(count, 3), `N=${count} target is min(N,3)`);
    assert(object.assignedReplicas.length === Math.min(count, 3) && object.onlineReplicas.length === Math.min(count, 3), `N=${count} reaches target replicas`);
    assert(object.health === "HEALTHY", `N=${count} reports healthy after placement`);
    assert(roots.length === count && roots.every(view => view.catalogRoot === projection.catalogRoot), `N=${count} honest catalog roots agree`);
    assert(projection.rewardsAccrued === 0, `N=${count} SYSTEM_TEST accrues zero rewards`);
    if (count >= 3) {
      const manifests = await Promise.all(Array.from({ length: count }, (_, index) => manifest(index + 1)));
      const selectedDomains = object.assignedReplicas.map(id => manifests.find(item => item.nodeId === id)?.failureDomain);
      assert(new Set(selectedDomains).size === 3, `N=${count} placement uses three failure domains`);
    }
    const twin = await build(count, count);
    const twinProjection = await twin.projection();
    assert(JSON.stringify(twinProjection) === JSON.stringify(projection), `N=${count} full projection is deterministic`);
    fixtureResults.push({ nodeCount: count, replication: projection.targetReplication, catalogRoot: projection.catalogRoot, receiptHead: projection.receiptHead });
  }

  const growth = new DeterministicMesh(authority);
  await growth.join(await manifest(1));
  await growth.publish(await command(20));
  for (let count = 2; count <= 8; count += 1) {
    await growth.join(await manifest(count));
    const beforeRepair = await growth.projection();
    assert(beforeRepair.nodeCount === count && beforeRepair.targetReplication === Math.min(count, 3), `growth N=${count} updates membership target before repair`);
    const repaired = await growth.repair();
    assert(repaired.objects[0].health === "HEALTHY" && repaired.objects[0].assignedReplicas.length === Math.min(count, 3), `growth N=${count} repairs to target`);
    assert((await growth.nodeCatalogRoots()).every(view => view.catalogRoot === repaired.catalogRoot), `growth N=${count} retains catalog convergence`);
  }

  const beforeChurn = await growth.projection();
  const failedHolder = beforeChurn.objects[0].assignedReplicas[0];
  await growth.setOnline(failedHolder, false);
  const duringChurn = await growth.projection();
  assert(duringChurn.onlineNodeCount === 7 && duringChurn.targetReplication === 3, "churn retains the authoritative eligible-node target");
  assert(duringChurn.objects[0].health === "UNDER_REPLICATED" && duringChurn.objects[0].onlineReplicas.length === 2, "failed holder is visible as under-replication before repair");
  const repairedChurn = await growth.repair();
  assert(repairedChurn.objects[0].health === "HEALTHY" && repairedChurn.objects[0].onlineReplicas.length === 3, "anti-entropy repair restores three online replicas");
  assert(!repairedChurn.objects[0].assignedReplicas.includes(failedHolder), "repair does not assign payload to an offline node");
  await growth.setOnline(failedHolder, true);
  const rejoined = await growth.repair();
  assert(rejoined.onlineNodeCount === 8 && rejoined.objects[0].health === "HEALTHY", "rejoined permissionless node participates without availability regression");

  await growth.publish(await command(21));
  const multiObject = await growth.projection();
  assert(multiObject.objects.length === 2 && multiObject.objects.every(object => object.health === "HEALTHY"), "multiple catalog objects preserve independent healthy placement");
  assert(multiObject.rewardsAccrued === 0, "join replication churn and repair never create rewards");
  const snapshot = await growth.exportSnapshot();
  const restored = await DeterministicMesh.restore(JSON.parse(JSON.stringify(snapshot)), authority, snapshot.checkpointHash);
  const restoredProjection = await restored.projection();
  assert(JSON.stringify(restoredProjection) === JSON.stringify(multiObject), "fresh restore reproduces the full mesh projection byte-for-byte");
  assert((await restored.nodeCatalogRoots()).every(view => view.catalogRoot === snapshot.catalogRoot), "fresh restore reproduces every online catalog root");
  const continued = await restored.publish(await command(22));
  assert(continued.health === "HEALTHY" && (await restored.projection()).receiptCount > snapshot.receipts.length, "restored mesh continues the signed receipt lineage");
  await expectCode(async () => restored.publish(await command(21)), "MESH_OBJECT_REPLAY");
  await expectCode(() => restored.publish(snapshot.objects[1].command), "MESH_OBJECT_REPLAY");

  const capturedInput = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  const pendingRestore = DeterministicMesh.restore(capturedInput, authority, snapshot.checkpointHash);
  capturedInput.checkpointHash = hash(250);
  const capturedRestore = await pendingRestore;
  assert((await capturedRestore.projection()).catalogRoot === snapshot.catalogRoot, "restore captures one immutable representation before its first await");

  const stale = hash(251);
  await expectCode(() => DeterministicMesh.restore(snapshot, authority, stale), "MESH_CHECKPOINT_STALE");
  const extraRoot = await reseal(snapshot, draft => { draft.unexpected = true; });
  await expectCode(() => DeterministicMesh.restore(extraRoot, authority, extraRoot.checkpointHash), "MESH_SNAPSHOT_INVALID");
  const badCommand = await reseal(snapshot, draft => {
    const objects = draft.objects as Array<Record<string, unknown>>;
    (objects[0].command as Record<string, unknown>).valueCommitment = hash(252);
  });
  await expectCode(() => DeterministicMesh.restore(badCommand, authority, badCommand.checkpointHash), "MESH_OBJECT_LINEAGE_INVALID");
  const badManifest = await reseal(snapshot, draft => {
    const nodes = draft.nodes as Array<Record<string, unknown>>;
    (nodes[0].manifest as Record<string, unknown>).failureDomain = "FD:FORGED:OWNER";
  });
  await expectCode(() => DeterministicMesh.restore(badManifest, authority, badManifest.checkpointHash), "MESH_NODE_LINEAGE_INVALID");
  const reordered = await reseal(snapshot, draft => {
    const receipts = draft.receipts as unknown[];
    [receipts[0], receipts[1]] = [receipts[1], receipts[0]];
  });
  await expectCode(() => DeterministicMesh.restore(reordered, authority, reordered.checkpointHash), "MESH_RECEIPT_LINEAGE_INVALID");
  const truncated = await reseal(snapshot, draft => {
    const receipts = draft.receipts as Array<Record<string, unknown>>;
    receipts.pop();
    draft.receiptHead = receipts.at(-1)?.receiptHash ?? ZERO;
  });
  await expectCode(() => DeterministicMesh.restore(truncated, authority, truncated.checkpointHash), "MESH_RECEIPT_RECONCILIATION_FAILED");
  const fullyStripped = await reseal(snapshot, draft => {
    draft.receipts = [];
    draft.receiptHead = ZERO;
    for (const object of draft.objects as Array<Record<string, unknown>>) object.replicas = [];
  });
  await expectCode(() => DeterministicMesh.restore(fullyStripped, authority, fullyStripped.checkpointHash), "MESH_RECEIPT_RECONCILIATION_FAILED");
  const nodeBeforeJoin = await reseal(snapshot, draft => {
    const firstReceipt = (draft.receipts as Array<Record<string, unknown>>)[0];
    const receiptNode = (draft.nodes as Array<Record<string, unknown>>).find(node => (node.manifest as Record<string, unknown>).nodeId === firstReceipt.nodeId)!;
    receiptNode.joinedAtEpoch = Number(firstReceipt.placementEpoch) + 1;
  });
  await expectCode(() => DeterministicMesh.restore(nodeBeforeJoin, authority, nodeBeforeJoin.checkpointHash), "MESH_RECEIPT_CAUSALITY_INVALID");
  const objectBeforePublication = await reseal(snapshot, draft => {
    const firstReceipt = (draft.receipts as Array<Record<string, unknown>>)[0];
    const receiptObject = (draft.objects as Array<Record<string, unknown>>).find(object => (object.command as Record<string, unknown>).objectId === firstReceipt.objectId)!;
    receiptObject.publishedAtEpoch = Number(firstReceipt.placementEpoch) + 1;
  });
  await expectCode(() => DeterministicMesh.restore(objectBeforePublication, authority, objectBeforePublication.checkpointHash), "MESH_RECEIPT_CAUSALITY_INVALID");

  const duplicateTarget = snapshot.objects[0];
  const duplicateNode = duplicateTarget.replicas[0];
  const duplicateReceipt = await authority.issueReceipt({
    schemaVersion: 1,
    ordinal: snapshot.receipts.length + 1,
    action: "ASSIGN",
    nodeId: duplicateNode,
    objectId: duplicateTarget.command.objectId,
    valueCommitment: duplicateTarget.command.valueCommitment,
    catalogRoot: snapshot.catalogRoot,
    placementEpoch: snapshot.placementEpoch,
    previousReceiptHash: snapshot.receiptHead
  });
  const replayedReceipt = await reseal(snapshot, draft => {
    (draft.receipts as unknown[]).push(duplicateReceipt);
    draft.receiptHead = duplicateReceipt.receiptHash;
  });
  await expectCode(() => DeterministicMesh.restore(replayedReceipt, authority, replayedReceipt.checkpointHash), "MESH_RECEIPT_REPLAY");

  const unassignedNode = snapshot.nodes.map(record => record.manifest.nodeId).find(id => !duplicateTarget.replicas.includes(id));
  assert(unassignedNode !== undefined, "fixture contains a node outside the selected replica set");
  const invalidRelease = await authority.issueReceipt({
    schemaVersion: 1,
    ordinal: snapshot.receipts.length + 1,
    action: "RELEASE",
    nodeId: unassignedNode,
    objectId: duplicateTarget.command.objectId,
    valueCommitment: duplicateTarget.command.valueCommitment,
    catalogRoot: snapshot.catalogRoot,
    placementEpoch: snapshot.placementEpoch,
    previousReceiptHash: snapshot.receiptHead
  });
  const fabricatedTransition = await reseal(snapshot, draft => {
    (draft.receipts as unknown[]).push(invalidRelease);
    draft.receiptHead = invalidRelease.receiptHash;
  });
  await expectCode(() => DeterministicMesh.restore(fabricatedTransition, authority, fabricatedTransition.checkpointHash), "MESH_RECEIPT_STATE_INVALID");

  const invalidEconomicManifest = { ...await manifest(30), nodeId: "NODE:MESH:30", failureDomain: "FD:REGION_30:OWNER_30", rewardEligible: true };
  await expectCode(() => growth.join(invalidEconomicManifest), "MESH_MANIFEST_INVALID");
  const invalidBooleanManifest = { ...await manifest(31), nodeId: "NODE:MESH:31", failureDomain: "FD:REGION_31:OWNER_31", walletRequired: "false" };
  await expectCode(() => growth.join(invalidBooleanManifest), "MESH_MANIFEST_INVALID");
  await expectCode(async () => growth.join(await manifest(1)), "MESH_NODE_REPLAY");
  await expectCode(() => growth.setOnline("NODE:MESH:99", false), "MESH_NODE_NOT_FOUND");
  await expectCode(() => growth.setOnline(nodeId(1), "false"), "MESH_NODE_INVALID");

  const concurrent = new DeterministicMesh(authority);
  const concurrentManifests = await Promise.all(Array.from({ length: 8 }, (_, index) => manifest(index + 1)));
  await Promise.all(concurrentManifests.map(item => concurrent.join(item)));
  assert((await concurrent.projection()).nodeCount === 8, "concurrent permissionless joins serialize into eight unique epochs");
  const duplicateManifest = await manifest(20);
  const duplicateResults = await Promise.allSettled([concurrent.join(duplicateManifest), concurrent.join(duplicateManifest)]);
  assert(duplicateResults.filter(result => result.status === "fulfilled").length === 1 && duplicateResults.filter(result => result.status === "rejected" && result.reason instanceof MeshError && result.reason.code === "MESH_NODE_REPLAY").length === 1, "concurrent duplicate join commits exactly once");
  await concurrent.publish(await command(30));
  const receiptCountBefore = (await concurrent.projection()).receiptCount;
  const repairResults = await Promise.all([concurrent.repair(), concurrent.repair()]);
  assert(repairResults.every(result => result.objects[0].health === "HEALTHY"), "concurrent repair calls serialize and converge");
  assert((await concurrent.projection()).receiptCount === receiptCountBefore, "idempotent repair emits no duplicate receipts");

  const faultAuthority = new FaultInjectingAuthority("NODE-MESH-AUTH:FAULT_A16", "b8".repeat(32));
  const faultMesh = new DeterministicMesh(faultAuthority);
  for (let index = 1; index <= 4; index += 1) await faultMesh.join(await manifest(index, faultAuthority));
  const faultCommand = await command(40, faultAuthority);
  const beforeFailedPublish = await faultMesh.projection();
  faultAuthority.failReceiptAfter = 0;
  await expectCode(() => faultMesh.publish(faultCommand), "MESH_FIXTURE_SIGNING_FAILURE");
  const afterFailedPublish = await faultMesh.projection();
  assert(afterFailedPublish.placementEpoch === beforeFailedPublish.placementEpoch && afterFailedPublish.objects.length === 0 && afterFailedPublish.receiptCount === 0, "failed publish rolls back epoch object replay index and receipts atomically");
  faultAuthority.failReceiptAfter = null;
  await faultMesh.publish(faultCommand);
  const faultHolder = (await faultMesh.projection()).objects[0].assignedReplicas[0];
  await faultMesh.setOnline(faultHolder, false);
  const beforeFailedRepair = await faultMesh.projection();
  faultAuthority.failReceiptAfter = 1;
  await expectCode(() => faultMesh.repair(), "MESH_FIXTURE_SIGNING_FAILURE");
  const afterFailedRepair = await faultMesh.projection();
  assert(afterFailedRepair.receiptCount === beforeFailedRepair.receiptCount && JSON.stringify(afterFailedRepair.objects) === JSON.stringify(beforeFailedRepair.objects), "failed multi-receipt repair rolls back every staged assignment and release");
  faultAuthority.failReceiptAfter = null;
  const afterFaultRecovery = await faultMesh.repair();
  assert(afterFaultRecovery.objects[0].health === "HEALTHY" && afterFaultRecovery.objects[0].onlineReplicas.length === 3, "same repair succeeds after injected signer recovery");

  process.stdout.write(JSON.stringify({
    schema_version: 1,
    task_id: "NX-NODE-P02",
    status: "PASS",
    assertions,
    protocol: "/nexus/mesh/1.0",
    fixtures: fixtureResults,
    node_range: { minimum: 1, maximum: 8 },
    replication_formula: "min(eligibleNodes,3)",
    churn: { under_replicated_observed: true, repaired_to_target: true, offline_assignment_denied: true },
    convergence: { deterministic_projection: true, all_online_catalog_roots_equal: true, fresh_restore_equal: true },
    receipts: { ordered_sha256_lineage: true, signature_verified: true, state_machine_reconciled: true, causal_epoch_order: true, nonempty_object_history: true, replay_denied: true, prefix_denied: true, atomic_staging: true, fault_rollback: true },
    permissionless_fixture: { wallet_required: false, bond_required: false, reward_account_required: false },
    synthetic_isolation: { actor_class: "SYSTEM_TEST", rewards_accrued: 0, organic_events: 0 },
    negative: { exact_shape: true, command_tamper: true, manifest_tamper: true, receipt_reorder: true, receipt_prefix: true, receipt_full_strip: true, receipt_node_causality: true, receipt_object_causality: true, receipt_replay: true, receipt_transition: true, stale_checkpoint: true, boolean_string: true, duplicate_join: true, restore_toctou: true, publish_fault_rollback: true, repair_fault_rollback: true },
    network_operations: 0,
    external_provider_operations: 0,
    economic_operations: 0,
    real_fund_operations: 0,
    incremental_cost: { amount: 0, currency: "EUR" }
  }));
}

void main().catch(error => {
  process.stderr.write(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
