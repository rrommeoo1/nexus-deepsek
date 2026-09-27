export type MeshRole = "CATALOG" | "REPLICA" | "REPAIR";
export type ReplicaAction = "ASSIGN" | "RELEASE";
export type ReplicationHealth = "HEALTHY" | "UNDER_REPLICATED" | "UNAVAILABLE";

export interface MeshManifest {
  schemaVersion: 1;
  nodeId: string;
  protocol: "/nexus/mesh/1.0";
  roles: readonly MeshRole[];
  failureDomain: string;
  capacityClass: "FIXTURE";
  syntheticLabel: "SYSTEM_TEST";
  walletRequired: false;
  bondRequired: false;
  rewardEligible: false;
  authorityKeyId: string;
  signature: string;
}

export interface MeshObjectCommand {
  schemaVersion: 1;
  eventId: string;
  objectId: string;
  valueCommitment: string;
  occurredAt: string;
  actorClass: "SYSTEM_TEST";
  signature: string;
}

export interface ReplicaReceipt {
  schemaVersion: 1;
  ordinal: number;
  action: ReplicaAction;
  nodeId: string;
  objectId: string;
  valueCommitment: string;
  catalogRoot: string;
  placementEpoch: number;
  previousReceiptHash: string;
  receiptHash: string;
  signature: string;
}

export interface MeshNodeRecord {
  manifest: MeshManifest;
  joinedAtEpoch: number;
  online: boolean;
}

export interface MeshObjectRecord {
  command: MeshObjectCommand;
  publishedAtEpoch: number;
  replicas: readonly string[];
}

export interface MeshObjectProjection {
  objectId: string;
  valueCommitment: string;
  assignedReplicas: readonly string[];
  onlineReplicas: readonly string[];
  targetReplication: number;
  health: ReplicationHealth;
}

export interface MeshProjection {
  schemaVersion: 1;
  protocol: "/nexus/mesh/1.0";
  placementEpoch: number;
  nodeCount: number;
  onlineNodeCount: number;
  targetReplication: number;
  catalogRoot: string;
  receiptHead: string;
  receiptCount: number;
  rewardsAccrued: 0;
  objects: readonly MeshObjectProjection[];
}

export interface MeshSnapshot {
  schemaVersion: 1;
  snapshotVersion: 1;
  protocol: "/nexus/mesh/1.0";
  targetReplication: 3;
  placementEpoch: number;
  nodes: readonly MeshNodeRecord[];
  objects: readonly MeshObjectRecord[];
  receipts: readonly ReplicaReceipt[];
  receiptHead: string;
  catalogRoot: string;
  checkpointHash: string;
  signature: string;
}

export class MeshError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MeshError";
  }
}

const ZERO = "0".repeat(64);
const HASH = /^[a-f0-9]{64}$/;
const NODE_ID = /^NODE:MESH:[A-Z0-9_-]{2,32}$/;
const AUTHORITY_ID = /^NODE-MESH-AUTH:[A-Z0-9_-]{2,32}$/;
const FAILURE_DOMAIN = /^FD:[A-Z0-9_-]{2,24}:[A-Z0-9_-]{2,24}$/;
const EVENT_ID = /^MESH-EVENT:[A-Z0-9:_-]{3,64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ROLES: readonly MeshRole[] = Object.freeze(["CATALOG", "REPLICA", "REPAIR"]);
const MANIFEST_KEYS = ["schemaVersion", "nodeId", "protocol", "roles", "failureDomain", "capacityClass", "syntheticLabel", "walletRequired", "bondRequired", "rewardEligible", "authorityKeyId", "signature"] as const;
const COMMAND_KEYS = ["schemaVersion", "eventId", "objectId", "valueCommitment", "occurredAt", "actorClass", "signature"] as const;
const RECEIPT_KEYS = ["schemaVersion", "ordinal", "action", "nodeId", "objectId", "valueCommitment", "catalogRoot", "placementEpoch", "previousReceiptHash", "receiptHash", "signature"] as const;
const NODE_RECORD_KEYS = ["manifest", "joinedAtEpoch", "online"] as const;
const OBJECT_RECORD_KEYS = ["command", "publishedAtEpoch", "replicas"] as const;
const SNAPSHOT_KEYS = ["schemaVersion", "snapshotVersion", "protocol", "targetReplication", "placementEpoch", "nodes", "objects", "receipts", "receiptHead", "catalogRoot", "checkpointHash", "signature"] as const;

function fail(code: string): never { throw new MeshError(code); }
function exactObject(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value as object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value as Record<string, unknown>;
}
function exactString<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(code);
  return value as T;
}
function patterned(value: unknown, pattern: RegExp, code: string): string {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
  return value;
}
function safeInteger(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(code);
  return value;
}
function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") fail(code);
  return value;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function capture(value: unknown, code: string): Readonly<{ value: unknown; serialized: string }> {
  try {
    const serialized = canonical(value);
    return Object.freeze({ value: JSON.parse(serialized), serialized });
  } catch {
    fail(code);
  }
}
async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail("MESH_CRYPTO_UNAVAILABLE");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function frozen<T extends object>(value: T): Readonly<T> { return Object.freeze(value); }
function sortedUnique(values: readonly string[], pattern: RegExp, code: string): readonly string[] {
  const copy = values.map(value => patterned(value, pattern, code));
  if (new Set(copy).size !== copy.length) fail(code);
  copy.sort();
  return frozen(copy);
}

function parseManifest(input: unknown): Readonly<MeshManifest> {
  const value = exactObject(input, MANIFEST_KEYS, "MESH_MANIFEST_INVALID");
  if (value.schemaVersion !== 1 || value.protocol !== "/nexus/mesh/1.0" || value.capacityClass !== "FIXTURE" ||
      value.syntheticLabel !== "SYSTEM_TEST" || value.walletRequired !== false || value.bondRequired !== false ||
      value.rewardEligible !== false || !Array.isArray(value.roles) || value.roles.length !== ROLES.length ||
      value.roles.some((role, index) => role !== ROLES[index])) fail("MESH_MANIFEST_INVALID");
  return frozen({
    schemaVersion: 1,
    nodeId: patterned(value.nodeId, NODE_ID, "MESH_MANIFEST_INVALID"),
    protocol: "/nexus/mesh/1.0",
    roles: ROLES,
    failureDomain: patterned(value.failureDomain, FAILURE_DOMAIN, "MESH_MANIFEST_INVALID"),
    capacityClass: "FIXTURE",
    syntheticLabel: "SYSTEM_TEST",
    walletRequired: false,
    bondRequired: false,
    rewardEligible: false,
    authorityKeyId: patterned(value.authorityKeyId, AUTHORITY_ID, "MESH_MANIFEST_INVALID"),
    signature: patterned(value.signature, HASH, "MESH_MANIFEST_INVALID")
  });
}

function parseCommand(input: unknown): Readonly<MeshObjectCommand> {
  const value = exactObject(input, COMMAND_KEYS, "MESH_COMMAND_INVALID");
  const occurredAt = patterned(value.occurredAt, ISO, "MESH_COMMAND_INVALID");
  if (value.schemaVersion !== 1 || value.actorClass !== "SYSTEM_TEST" || !Number.isFinite(Date.parse(occurredAt))) fail("MESH_COMMAND_INVALID");
  return frozen({
    schemaVersion: 1,
    eventId: patterned(value.eventId, EVENT_ID, "MESH_COMMAND_INVALID"),
    objectId: patterned(value.objectId, HASH, "MESH_COMMAND_INVALID"),
    valueCommitment: patterned(value.valueCommitment, HASH, "MESH_COMMAND_INVALID"),
    occurredAt,
    actorClass: "SYSTEM_TEST",
    signature: patterned(value.signature, HASH, "MESH_COMMAND_INVALID")
  });
}

function parseReceipt(input: unknown): Readonly<ReplicaReceipt> {
  const value = exactObject(input, RECEIPT_KEYS, "MESH_RECEIPT_INVALID");
  if (value.schemaVersion !== 1) fail("MESH_RECEIPT_INVALID");
  return frozen({
    schemaVersion: 1,
    ordinal: safeInteger(value.ordinal, 1, 1_000_000, "MESH_RECEIPT_INVALID"),
    action: exactString(value.action, ["ASSIGN", "RELEASE"], "MESH_RECEIPT_INVALID"),
    nodeId: patterned(value.nodeId, NODE_ID, "MESH_RECEIPT_INVALID"),
    objectId: patterned(value.objectId, HASH, "MESH_RECEIPT_INVALID"),
    valueCommitment: patterned(value.valueCommitment, HASH, "MESH_RECEIPT_INVALID"),
    catalogRoot: patterned(value.catalogRoot, HASH, "MESH_RECEIPT_INVALID"),
    placementEpoch: safeInteger(value.placementEpoch, 1, 1_000_000, "MESH_RECEIPT_INVALID"),
    previousReceiptHash: patterned(value.previousReceiptHash, HASH, "MESH_RECEIPT_INVALID"),
    receiptHash: patterned(value.receiptHash, HASH, "MESH_RECEIPT_INVALID"),
    signature: patterned(value.signature, HASH, "MESH_RECEIPT_INVALID")
  });
}

export class MeshFixtureAuthority {
  constructor(readonly keyId: string, private readonly fixtureKey: string) {
    if (!AUTHORITY_ID.test(keyId) || !HASH.test(fixtureKey)) fail("MESH_AUTHORITY_INVALID");
  }
  async issueManifest(input: Omit<MeshManifest, "signature">): Promise<Readonly<MeshManifest>> {
    const unsigned = capture(input, "MESH_MANIFEST_INVALID").value as Omit<MeshManifest, "signature">;
    return parseManifest({ ...unsigned, signature: await sha256(`${this.fixtureKey}:MANIFEST:${canonical(unsigned)}`) });
  }
  async verifyManifest(input: MeshManifest): Promise<boolean> {
    const { signature, ...unsigned } = input;
    return input.authorityKeyId === this.keyId && signature === await sha256(`${this.fixtureKey}:MANIFEST:${canonical(unsigned)}`);
  }
  async issueCommand(input: Omit<MeshObjectCommand, "signature">): Promise<Readonly<MeshObjectCommand>> {
    const unsigned = capture(input, "MESH_COMMAND_INVALID").value as Omit<MeshObjectCommand, "signature">;
    return parseCommand({ ...unsigned, signature: await sha256(`${this.fixtureKey}:COMMAND:${canonical(unsigned)}`) });
  }
  async verifyCommand(input: MeshObjectCommand): Promise<boolean> {
    const { signature, ...unsigned } = input;
    return signature === await sha256(`${this.fixtureKey}:COMMAND:${canonical(unsigned)}`);
  }
  async signReceipt(unsigned: Omit<ReplicaReceipt, "signature">): Promise<string> {
    return sha256(`${this.fixtureKey}:RECEIPT:${canonical(unsigned)}`);
  }
  async issueReceipt(input: Omit<ReplicaReceipt, "receiptHash" | "signature">): Promise<Readonly<ReplicaReceipt>> {
    const base = capture(input, "MESH_RECEIPT_INVALID").value as Omit<ReplicaReceipt, "receiptHash" | "signature">;
    const withHash = frozen({ ...base, receiptHash: await receiptHash(base) });
    return parseReceipt({ ...withHash, signature: await this.signReceipt(withHash) });
  }
  async verifyReceipt(input: ReplicaReceipt): Promise<boolean> {
    const { signature, ...unsigned } = input;
    return signature === await this.signReceipt(unsigned);
  }
  async signCheckpoint(unsigned: Omit<MeshSnapshot, "signature">): Promise<string> {
    return sha256(`${this.fixtureKey}:CHECKPOINT:${canonical(unsigned)}`);
  }
  async verifyCheckpoint(input: MeshSnapshot): Promise<boolean> {
    const { signature, ...unsigned } = input;
    return signature === await this.signCheckpoint(unsigned);
  }
  async sealSnapshot(input: Omit<MeshSnapshot, "checkpointHash" | "signature">): Promise<Readonly<MeshSnapshot>> {
    const base = capture(input, "MESH_SNAPSHOT_INVALID").value as Omit<MeshSnapshot, "checkpointHash" | "signature">;
    const checkpointHash = await sha256(canonical(base));
    const unsigned = frozen({ ...base, checkpointHash });
    return frozen({ ...unsigned, signature: await this.signCheckpoint(unsigned) });
  }
}

async function commandCatalogRoot(objects: readonly MeshObjectRecord[]): Promise<string> {
  return sha256(canonical(objects.map(record => record.command).sort((a, b) => a.objectId.localeCompare(b.objectId))));
}

async function receiptHash(unsigned: Omit<ReplicaReceipt, "receiptHash" | "signature">): Promise<string> {
  return sha256(canonical(unsigned));
}

export class DeterministicMesh {
  private readonly nodes = new Map<string, MeshNodeRecord>();
  private readonly objects = new Map<string, { command: Readonly<MeshObjectCommand>; publishedAtEpoch: number; replicas: Set<string> }>();
  private readonly eventIds = new Set<string>();
  private readonly receipts: ReplicaReceipt[] = [];
  private placementEpoch = 0;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(private readonly authority: MeshFixtureAuthority) {}

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release!: () => void;
    this.operationTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }

  async join(input: unknown): Promise<Readonly<MeshNodeRecord>> {
    const captured = capture(input, "MESH_MANIFEST_INVALID").value;
    return this.exclusive(async () => {
      const manifest = parseManifest(captured);
      if (!await this.authority.verifyManifest(manifest)) fail("MESH_MANIFEST_SIGNATURE_INVALID");
      if (this.nodes.has(manifest.nodeId)) fail("MESH_NODE_REPLAY");
      this.placementEpoch += 1;
      const record = frozen({ manifest, joinedAtEpoch: this.placementEpoch, online: true });
      this.nodes.set(manifest.nodeId, record);
      return record;
    });
  }

  async setOnline(nodeIdInput: unknown, onlineInput: unknown): Promise<void> {
    const nodeId = patterned(nodeIdInput, NODE_ID, "MESH_NODE_INVALID");
    const online = boolean(onlineInput, "MESH_NODE_INVALID");
    return this.exclusive(async () => {
      const current = this.nodes.get(nodeId);
      if (!current) fail("MESH_NODE_NOT_FOUND");
      if (current.online === online) fail("MESH_MEMBERSHIP_REPLAY");
      this.placementEpoch += 1;
      this.nodes.set(nodeId, frozen({ manifest: current.manifest, joinedAtEpoch: current.joinedAtEpoch, online }));
    });
  }

  async publish(input: unknown): Promise<Readonly<MeshObjectProjection>> {
    const captured = capture(input, "MESH_COMMAND_INVALID").value;
    return this.exclusive(async () => {
      const command = parseCommand(captured);
      if (!await this.authority.verifyCommand(command)) fail("MESH_COMMAND_SIGNATURE_INVALID");
      if (this.eventIds.has(command.eventId) || this.objects.has(command.objectId)) fail("MESH_OBJECT_REPLAY");
      if (this.onlineNodes().length === 0) fail("MESH_NO_ELIGIBLE_NODE");
      const previousEpoch = this.placementEpoch;
      this.placementEpoch += 1;
      this.eventIds.add(command.eventId);
      this.objects.set(command.objectId, { command, publishedAtEpoch: this.placementEpoch, replicas: new Set<string>() });
      try {
        await this.repairObject(command.objectId);
        return this.objectProjection(command.objectId);
      } catch (error) {
        this.objects.delete(command.objectId);
        this.eventIds.delete(command.eventId);
        this.placementEpoch = previousEpoch;
        throw error;
      }
    });
  }

  async repair(): Promise<Readonly<MeshProjection>> {
    return this.exclusive(async () => {
      const receiptCount = this.receipts.length;
      const replicasBefore = new Map([...this.objects].map(([objectId, record]) => [objectId, [...record.replicas]]));
      try {
        for (const objectId of [...this.objects.keys()].sort()) await this.repairObject(objectId);
        return this.projectionUnsafe();
      } catch (error) {
        this.receipts.splice(receiptCount);
        for (const [objectId, replicas] of replicasBefore) {
          const record = this.objects.get(objectId);
          if (record) {
            record.replicas.clear();
            for (const nodeId of replicas) record.replicas.add(nodeId);
          }
        }
        throw error;
      }
    });
  }

  async projection(): Promise<Readonly<MeshProjection>> {
    return this.exclusive(() => this.projectionUnsafe());
  }

  async nodeCatalogRoots(): Promise<readonly Readonly<{ nodeId: string; catalogRoot: string }>[]> {
    return this.exclusive(async () => {
      const catalogRoot = await this.catalogRootUnsafe();
      return frozen(this.onlineNodes().map(record => frozen({ nodeId: record.manifest.nodeId, catalogRoot })));
    });
  }

  private onlineNodes(): MeshNodeRecord[] {
    return [...this.nodes.values()].filter(record => record.online).sort((a, b) => a.manifest.nodeId.localeCompare(b.manifest.nodeId));
  }

  private target(): number { return Math.min(this.onlineNodes().length, 3); }

  private async rendezvousPlacement(objectId: string): Promise<readonly string[]> {
    const scored = await Promise.all(this.onlineNodes().map(async record => ({
      nodeId: record.manifest.nodeId,
      domain: record.manifest.failureDomain,
      score: await sha256(`${objectId}:${record.manifest.nodeId}`)
    })));
    scored.sort((a, b) => b.score.localeCompare(a.score) || a.nodeId.localeCompare(b.nodeId));
    const desired: string[] = [];
    const domains = new Set<string>();
    for (const candidate of scored) {
      if (desired.length >= this.target()) break;
      if (!domains.has(candidate.domain)) { desired.push(candidate.nodeId); domains.add(candidate.domain); }
    }
    for (const candidate of scored) {
      if (desired.length >= this.target()) break;
      if (!desired.includes(candidate.nodeId)) desired.push(candidate.nodeId);
    }
    return frozen(desired.sort());
  }

  private async buildReceipt(action: ReplicaAction, nodeId: string, record: { command: Readonly<MeshObjectCommand>; publishedAtEpoch: number; replicas: Set<string> }, ordinal: number, previousReceiptHash: string, catalogRoot: string): Promise<Readonly<ReplicaReceipt>> {
    const base = {
      schemaVersion: 1 as const,
      ordinal,
      action,
      nodeId,
      objectId: record.command.objectId,
      valueCommitment: record.command.valueCommitment,
      catalogRoot,
      placementEpoch: this.placementEpoch,
      previousReceiptHash
    };
    const withHash = frozen({ ...base, receiptHash: await receiptHash(base) });
    return frozen({ ...withHash, signature: await this.authority.signReceipt(withHash) });
  }

  private async repairObject(objectId: string): Promise<void> {
    const record = this.objects.get(objectId);
    if (!record) fail("MESH_OBJECT_NOT_FOUND");
    const desired = await this.rendezvousPlacement(objectId);
    const actions: Array<Readonly<{ action: ReplicaAction; nodeId: string }>> = [];
    for (const nodeId of [...record.replicas].sort()) {
      if (!desired.includes(nodeId)) actions.push(frozen({ action: "RELEASE", nodeId }));
    }
    for (const nodeId of desired) {
      if (!record.replicas.has(nodeId)) actions.push(frozen({ action: "ASSIGN", nodeId }));
    }
    const staged: ReplicaReceipt[] = [];
    const catalogRoot = await this.catalogRootAtEpoch(this.placementEpoch);
    let previousReceiptHash = this.receipts.at(-1)?.receiptHash ?? ZERO;
    for (const action of actions) {
      const receipt = await this.buildReceipt(action.action, action.nodeId, record, this.receipts.length + staged.length + 1, previousReceiptHash, catalogRoot);
      staged.push(receipt);
      previousReceiptHash = receipt.receiptHash;
    }
    this.receipts.push(...staged);
    record.replicas.clear();
    for (const nodeId of desired) record.replicas.add(nodeId);
  }

  private objectProjection(objectId: string): Readonly<MeshObjectProjection> {
    const record = this.objects.get(objectId);
    if (!record) fail("MESH_OBJECT_NOT_FOUND");
    const assignedReplicas = [...record.replicas].sort();
    const onlineReplicas = assignedReplicas.filter(nodeId => this.nodes.get(nodeId)?.online === true);
    const targetReplication = this.target();
    const health: ReplicationHealth = onlineReplicas.length === 0 ? "UNAVAILABLE" : onlineReplicas.length < targetReplication ? "UNDER_REPLICATED" : "HEALTHY";
    return frozen({ objectId, valueCommitment: record.command.valueCommitment, assignedReplicas: frozen(assignedReplicas), onlineReplicas: frozen(onlineReplicas), targetReplication, health });
  }

  private objectRecords(): readonly MeshObjectRecord[] {
    return frozen([...this.objects.values()].map(record => frozen({ command: record.command, publishedAtEpoch: record.publishedAtEpoch, replicas: frozen([...record.replicas].sort()) })).sort((a, b) => a.command.objectId.localeCompare(b.command.objectId)));
  }

  private async catalogRootAtEpoch(epoch: number): Promise<string> {
    return commandCatalogRoot(this.objectRecords().filter(record => record.publishedAtEpoch <= epoch));
  }

  private async catalogRootUnsafe(): Promise<string> { return commandCatalogRoot(this.objectRecords()); }

  private async projectionUnsafe(): Promise<Readonly<MeshProjection>> {
    const onlineNodeCount = this.onlineNodes().length;
    return frozen({
      schemaVersion: 1,
      protocol: "/nexus/mesh/1.0",
      placementEpoch: this.placementEpoch,
      nodeCount: this.nodes.size,
      onlineNodeCount,
      targetReplication: Math.min(onlineNodeCount, 3),
      catalogRoot: await this.catalogRootUnsafe(),
      receiptHead: this.receipts.at(-1)?.receiptHash ?? ZERO,
      receiptCount: this.receipts.length,
      rewardsAccrued: 0,
      objects: frozen([...this.objects.keys()].sort().map(objectId => this.objectProjection(objectId)))
    });
  }

  async exportSnapshot(): Promise<Readonly<MeshSnapshot>> {
    return this.exclusive(async () => {
      const projection = await this.projectionUnsafe();
      const base = frozen({
        schemaVersion: 1 as const,
        snapshotVersion: 1 as const,
        protocol: "/nexus/mesh/1.0" as const,
        targetReplication: 3 as const,
        placementEpoch: this.placementEpoch,
        nodes: frozen([...this.nodes.values()].sort((a, b) => a.manifest.nodeId.localeCompare(b.manifest.nodeId)).map(record => frozen({ manifest: record.manifest, joinedAtEpoch: record.joinedAtEpoch, online: record.online }))),
        objects: this.objectRecords(),
        receipts: frozen(this.receipts.map(receipt => frozen({ ...receipt }))),
        receiptHead: projection.receiptHead,
        catalogRoot: projection.catalogRoot
      });
      const checkpointHash = await sha256(canonical(base));
      const unsigned = frozen({ ...base, checkpointHash });
      return frozen({ ...unsigned, signature: await this.authority.signCheckpoint(unsigned) });
    });
  }

  static async restore(input: unknown, authority: MeshFixtureAuthority, expectedCheckpointHash: string): Promise<DeterministicMesh> {
    const captured = capture(input, "MESH_SNAPSHOT_INVALID");
    const value = exactObject(captured.value, SNAPSHOT_KEYS, "MESH_SNAPSHOT_INVALID");
    if (value.schemaVersion !== 1 || value.snapshotVersion !== 1 || value.protocol !== "/nexus/mesh/1.0" || value.targetReplication !== 3 ||
        !Array.isArray(value.nodes) || !Array.isArray(value.objects) || !Array.isArray(value.receipts)) fail("MESH_SNAPSHOT_INVALID");
    const nodes = value.nodes.map(nodeInput => {
      const node = exactObject(nodeInput, NODE_RECORD_KEYS, "MESH_SNAPSHOT_INVALID");
      return frozen({ manifest: parseManifest(node.manifest), joinedAtEpoch: safeInteger(node.joinedAtEpoch, 1, 1_000_000, "MESH_SNAPSHOT_INVALID"), online: boolean(node.online, "MESH_SNAPSHOT_INVALID") });
    });
    const objects = value.objects.map(objectInput => {
      const object = exactObject(objectInput, OBJECT_RECORD_KEYS, "MESH_SNAPSHOT_INVALID");
      if (!Array.isArray(object.replicas)) fail("MESH_SNAPSHOT_INVALID");
      return frozen({ command: parseCommand(object.command), publishedAtEpoch: safeInteger(object.publishedAtEpoch, 1, 1_000_000, "MESH_SNAPSHOT_INVALID"), replicas: sortedUnique(object.replicas, NODE_ID, "MESH_SNAPSHOT_INVALID") });
    });
    const receipts = value.receipts.map(parseReceipt);
    const snapshot: MeshSnapshot = {
      schemaVersion: 1,
      snapshotVersion: 1,
      protocol: "/nexus/mesh/1.0",
      targetReplication: 3,
      placementEpoch: safeInteger(value.placementEpoch, 1, 1_000_000, "MESH_SNAPSHOT_INVALID"),
      nodes: frozen(nodes),
      objects: frozen(objects),
      receipts: frozen(receipts),
      receiptHead: patterned(value.receiptHead, HASH, "MESH_SNAPSHOT_INVALID"),
      catalogRoot: patterned(value.catalogRoot, HASH, "MESH_SNAPSHOT_INVALID"),
      checkpointHash: patterned(value.checkpointHash, HASH, "MESH_SNAPSHOT_INVALID"),
      signature: patterned(value.signature, HASH, "MESH_SNAPSHOT_INVALID")
    };
    if (!HASH.test(expectedCheckpointHash) || snapshot.checkpointHash !== expectedCheckpointHash) fail("MESH_CHECKPOINT_STALE");
    if (!await authority.verifyCheckpoint(snapshot)) fail("MESH_CHECKPOINT_SIGNATURE_INVALID");
    const { signature: _signature, checkpointHash, ...base } = snapshot;
    if (checkpointHash !== await sha256(canonical(base))) fail("MESH_CHECKPOINT_HASH_INVALID");
    if (new Set(nodes.map(node => node.manifest.nodeId)).size !== nodes.length || nodes.some((node, index) => index > 0 && nodes[index - 1].manifest.nodeId >= node.manifest.nodeId)) fail("MESH_NODE_LINEAGE_INVALID");
    if (new Set(objects.map(object => object.command.objectId)).size !== objects.length || new Set(objects.map(object => object.command.eventId)).size !== objects.length || objects.some((object, index) => index > 0 && objects[index - 1].command.objectId >= object.command.objectId)) fail("MESH_OBJECT_LINEAGE_INVALID");
    for (const node of nodes) if (node.joinedAtEpoch > snapshot.placementEpoch || !await authority.verifyManifest(node.manifest)) fail("MESH_NODE_LINEAGE_INVALID");
    for (const object of objects) if (object.publishedAtEpoch > snapshot.placementEpoch || !await authority.verifyCommand(object.command) || object.replicas.some(nodeId => !nodes.some(node => node.manifest.nodeId === nodeId))) fail("MESH_OBJECT_LINEAGE_INVALID");
    if (snapshot.catalogRoot !== await commandCatalogRoot(objects)) fail("MESH_CATALOG_ROOT_MISMATCH");
    const assignments = new Map<string, Set<string>>(objects.map(object => [object.command.objectId, new Set<string>()]));
    const receiptCounts = new Map<string, number>(objects.map(object => [object.command.objectId, 0]));
    let head = ZERO;
    let previousReceiptEpoch = 0;
    for (let index = 0; index < receipts.length; index += 1) {
      const receipt = receipts[index];
      const object = objects.find(candidate => candidate.command.objectId === receipt.objectId);
      const node = nodes.find(candidate => candidate.manifest.nodeId === receipt.nodeId);
      if (receipt.ordinal !== index + 1 || receipt.previousReceiptHash !== head || receipt.placementEpoch > snapshot.placementEpoch || !object || !node) fail("MESH_RECEIPT_LINEAGE_INVALID");
      if (receipt.placementEpoch < previousReceiptEpoch || receipt.placementEpoch < object.publishedAtEpoch || receipt.placementEpoch < node.joinedAtEpoch) fail("MESH_RECEIPT_CAUSALITY_INVALID");
      if (receipt.valueCommitment !== object.command.valueCommitment ||
          receipt.catalogRoot !== await commandCatalogRoot(objects.filter(candidate => candidate.publishedAtEpoch <= receipt.placementEpoch)) || !await authority.verifyReceipt(receipt)) fail("MESH_RECEIPT_LINEAGE_INVALID");
      const { signature: _receiptSignature, receiptHash: storedHash, ...unsigned } = receipt;
      if (storedHash !== await receiptHash(unsigned)) fail("MESH_RECEIPT_LINEAGE_INVALID");
      const assigned = assignments.get(receipt.objectId)!;
      if (receipt.action === "ASSIGN") {
        if (assigned.has(receipt.nodeId)) fail("MESH_RECEIPT_REPLAY");
        assigned.add(receipt.nodeId);
      } else {
        if (!assigned.delete(receipt.nodeId)) fail("MESH_RECEIPT_STATE_INVALID");
      }
      head = receipt.receiptHash;
      previousReceiptEpoch = receipt.placementEpoch;
      receiptCounts.set(receipt.objectId, receiptCounts.get(receipt.objectId)! + 1);
    }
    if (snapshot.receiptHead !== head) fail("MESH_RECEIPT_LINEAGE_INVALID");
    for (const object of objects) {
      if (receiptCounts.get(object.command.objectId) === 0 || canonical([...assignments.get(object.command.objectId)!].sort()) !== canonical(object.replicas)) fail("MESH_RECEIPT_RECONCILIATION_FAILED");
    }
    const mesh = new DeterministicMesh(authority);
    mesh.placementEpoch = snapshot.placementEpoch;
    for (const node of nodes) mesh.nodes.set(node.manifest.nodeId, node);
    for (const object of objects) {
      mesh.objects.set(object.command.objectId, { command: object.command, publishedAtEpoch: object.publishedAtEpoch, replicas: new Set(object.replicas) });
      mesh.eventIds.add(object.command.eventId);
    }
    mesh.receipts.push(...receipts);
    const restored = await mesh.projection();
    if (restored.catalogRoot !== snapshot.catalogRoot || restored.receiptHead !== snapshot.receiptHead || restored.receiptCount !== receipts.length) fail("MESH_RESTORE_MISMATCH");
    return mesh;
  }
}
