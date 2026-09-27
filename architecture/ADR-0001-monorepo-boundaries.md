# ADR-0001 — Monorepo zones and bounded contexts

- Status: Accepted for scaffold
- Date: 2026-08-02
- Owner: A02
- Packet: `NX-ARCH-001`
- Machine-readable contract: [`bounded-contexts.yaml`](bounded-contexts.yaml)

## Context

Nexus combines identity, multiple profiles, social media, E2EE messaging, Dating,
commerce, media/live, Kids, agents, smart contracts and a permissionless node
network. A monorepo is useful for atomic contract changes and generated bindings,
but a shared repository must not become permission to import another domain's
internals or read its tables.

The source architecture requires modules to collaborate through public services or
events, keeps Dating in a separate feature/data namespace, isolates Kids as a
separate binary/tenant/key hierarchy and distinguishes MultiversX ordering from
successful execution under Supernova. The P1 registry also requires one accountable
owner per executable packet and machine-readable bounded-context ownership.

## Decision

The repository has four top-level code zones when scaffolded:

```text
apps/                 deployable user interfaces
  mobile/             adult mobile shell
  public-web/         public/work/business web
  admin-web/          privileged operations UI
  kids/               separate child binary

services/             independently deployable processes
  api/ identity/ messaging/ moderation/
  media-worker/ live-adapter/
  chain-indexer/ action-relayer/
  agent-gateway/ nexus-node/ kids-api/

packages/             versioned libraries and public domain APIs
  contracts/ identity/ profile/ social/ work/ commerce/
  dating/ messaging/ moderation/ media/ recommendations/
  kids/ node-sdk/ agent-sdk/ chain-adapter/

contracts/            Rust MultiversX smart contracts
  nexus-actions/ nexus-profile-registry/
  nexus-marketplace/ nexus-booking/ nexus-ride/
  nexus-appointments/ nexus-tipping/
```

No code directories are created by this ADR. The list is the import and ownership
contract for the later scaffold.

### Dependency direction

```text
apps ────────────────► public package APIs
services ────────────► public package APIs
domain packages ─────► lower-level public package APIs
chain adapter ───────► generated ABI/event contracts
Rust contracts ──────► their own shared Rust primitives only

                     never
context A internals ──X──► context B internals or tables
adult core ───────────X──► Kids data/keys/tenant
Social/Work/Agents ───X──► Dating internals or sensitive data
```

All cross-context imports are denied unless the target is listed in
`allowed_imports`. Even an allowed edge may use only the target's public surface,
conceptually `packages/{context}/api`; it never authorizes `internal/`, repository
tables or raw encryption keys. Unknown imports and events fail closed.

An event producer owns its schema. Consumers may subscribe only to explicitly
listed events. Events contain identifiers, commitments, redacted fields or
ciphertext; raw Dating, Kids, message plaintext, KYC, wellness, precise location or
safety evidence is forbidden. Cross-context commands remain synchronous only
through a versioned public contract; durable state propagation uses outbox events.

### Bounded-context ownership

Every context and artifact has one scalar owner. A person/agent may own multiple
related contexts, but an artifact cannot have co-owners. P1 epics and entry packets
map to a `bounded_context` in the YAML contract, and the task owner must equal that
context owner.

A new dependency edge requires A02 review. A cross-context change requires source
and target owner review. Sensitive boundaries additionally require C02/C04; Kids
requires A44/C04/C07; chain boundaries require A20/C03. The author cannot be the
sole approver. Breaking public contracts require a new version and migration
window; every material change includes rollback or migration evidence.

## Data boundaries

Each bounded context owns its schema, encryption purpose and retention jobs.
Direct foreign-table reads are prohibited. A single PostgreSQL deployment may be
used initially, but roles/schemas enforce the same boundary that separate
databases would enforce later.

- `Dating`: only the Dating context accesses Dating preferences or targets. Other
  contexts receive an eligibility result, generic commitment or ciphertext.
- `Kids`: separate app, API, tenant, DB role, keys, analytics and SDK inventory.
  Adult Core has no route to child data; Kids cannot import Dating, Social,
  messaging, commerce, wallet or adult profile internals.
- `Messaging`: servers handle ciphertext and minimum routing metadata. Plaintext
  exists only inside the E2EE client boundary.
- `Identity/KYC`: raw provider evidence remains in the provider/vault boundary;
  consumers receive versioned claims.
- `Mobility/commerce location`: exact location is encrypted, purpose-bound and TTL;
  it is not exported to feeds, global analytics or the node mesh.
- `Wellness`: private metrics remain in the Music/Grow purpose boundary and are not
  inputs to advertising, Dating or Work.
- `Node Network`: open nodes receive public data or ciphertext, never plaintext
  Dating, child activity, KYC, exact location or safety evidence.

Deletion is a domain command. The owning context purges mutable stores and emits a
tombstone/purge outcome; immutable chain history is never represented as erased.

## Chain boundary and Supernova adapter

Product domains do not call MultiversX SDKs directly. They create versioned intents
through `chain_integration`, which owns relayer routing, ABI bindings, indexer,
reducer and reconciliation.

```text
domain intent
  → Action/Financial public contract
  → chain adapter + relayer
  → MultiversX transaction
  → NETWORK_ACCEPTED
  → ORDERED_FINAL
  → EXECUTION_PENDING
  → EXECUTED_SUCCESS | EXECUTED_FAIL
  → reducer/reconciliation event
```

The adapter discovers runtime capabilities and exposes `ANDROMEDA_COMPAT` or
`SUPERNOVA` behavior behind the same domain contract. `ORDERED_FINAL` is never
treated as financial or product success. Money-moving state waits for
`EXECUTED_SUCCESS`; optimistic non-financial UI must compensate on failure.
Application shards and Nexus Node Network placement remain separate from
MultiversX execution shards.

Contracts contain critical commitments, ownership and escrow liabilities. Media,
chat plaintext, GPS, private profile fields, search indexes and node job payloads
remain off-chain. An ABI/event change starts in `packages/contracts`, is versioned,
generates consumers and must pass compatibility tests before implementation merge.

## Media and realtime boundaries

Media owns source upload, probe, transcoding, packaging, manifests, signed playback
and purge receipts. Social, Live, Kids and Music consume audience-specific public
media contracts; they do not read media storage directly.

- originals are private by default;
- IPFS is opt-in only for intentionally permanent public media;
- every presentation rechecks audience, rights and moderation;
- Live chat/reactions are a separate realtime channel;
- emergency Live termination does not depend on chain finality or a generative model;
- Kids playback uses its own approved catalog and delivery policy;
- distributed media/node jobs exchange signed jobs/receipts off-chain and settle
  periodically, rather than producing a transaction per segment.

## Enforcement

`planning/validate-architecture.ps1` is a zero-dependency bootstrap validator. It
checks schema presence, zone/path consistency, unique IDs/paths, owner alignment,
known and acyclic import edges, event ownership/consumption, sensitive-data
allowlists, P1 task ownership and required change rules. Its internal negative
fixture must prove that both `Social → Dating internals` and `Core → Kids data` are
denied.

Later CI may replace the bootstrap parser with language-aware import rules, DB-role
tests and generated contract checks, but may not weaken these invariants.

## Consequences

Positive:

- privacy and child-safety failures become structural rather than convention-only;
- teams can change one context without importing a vertical's implementation;
- chain/runtime upgrades stay behind one adapter;
- services can be split out gradually without changing domain contracts;
- task ownership and code ownership can be generated from one registry.

Costs:

- some same-process calls require explicit interfaces and mapping types;
- event versioning, outbox delivery and idempotency add implementation work;
- duplicated read models are preferred over cross-schema joins;
- emergency/safety paths need explicit APIs rather than database shortcuts.

## Migration sequence

1. Create the four empty zones and CODEOWNERS from the YAML registry.
2. Scaffold `packages/contracts` and generated OpenAPI/event/ABI types first.
3. Add language-aware dependency checks matching `allowed_imports`.
4. Introduce schema/database roles per context before tables contain real data.
5. Build identity/profile, moderation and chain adapter walking skeletons.
6. Add P1 entry packets in milestone order; no epic becomes executable work.
7. Deploy Kids only after separate binary/tenant/key/network isolation tests.
8. Extract `nexus-node` and media workers behind existing contracts; do not expose
   new private data classes during extraction.

Existing code that violates an edge is not grandfathered. It receives an owner,
deadline and strangler migration; no new call sites may use the forbidden path.

## Rejected alternatives

- A single shared `common` package containing domain models: it creates invisible
  coupling and privacy leaks.
- Database access as integration: it bypasses policy, retention and audit.
- Direct MultiversX calls from each vertical: it duplicates nonce, runtime and
  ordered-versus-executed logic.
- Kids as a feature flag in the adult app: it cannot prove SDK/data isolation.
- Public IPFS for all media: deletion, rights and private-content requirements make
  this unsafe.
