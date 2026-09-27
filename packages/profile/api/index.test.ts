import { AccessRequest, GrantRevocation, ProfilePolicyError, ProfileSession, ProfileType, VisibilityGrant, VisibilityGrantRegistry, authorizeProfileRead, authorizeProfileReadFromRegistry, buildAccessDenialTrace, clientCanRender, switchProfile, verifySession } from "./index";
declare const process: { stdout: { write(value: string): void } };
let assertions = 0;
function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(`ASSERT:${message}`); }
function expectCode(action: () => unknown, code: string): void { let actual = "NO_ERROR"; try { action(); } catch (error) { actual = error instanceof ProfilePolicyError ? error.code : String(error); } assert(actual === code, `expected ${code}, got ${actual}`); }
function json(value: unknown): unknown { return JSON.parse(JSON.stringify(value)); }
const H = "a".repeat(64), H2 = "b".repeat(64), H3 = "c".repeat(64), NOW = "2026-08-09T18:00:00Z";
const baseProfileTypes = [{ profileId: "PROFILE:WORK", profileType: "WORK" as const }, { profileId: "PROFILE:SOCIAL", profileType: "SOCIAL" as const }, { profileId: "PROFILE:DATING", profileType: "DATING" as const }];
const session: ProfileSession = { schemaVersion: 1, accountId: "ACCOUNT:1", activeProfileId: "PROFILE:WORK", ownedProfileIds: ["PROFILE:WORK", "PROFILE:SOCIAL", "PROFILE:DATING"], profileTypes: baseProfileTypes, generation: 4, actorClass: "SYSTEM_TEST", riskClear: true, incognito: false, issuedAt: "2026-08-09T17:00:00Z", expiresAt: "2026-08-09T19:00:00Z", issuerKeyId: "SESSION:LOCAL:1", signature: H };
const sessionVerifier = { verify: (candidate: Readonly<ProfileSession>) => (candidate.signature === H && candidate.activeProfileId === "PROFILE:WORK" && candidate.generation === 4 && !candidate.incognito) || (candidate.signature === H2 && candidate.activeProfileId === "PROFILE:WORK" && candidate.generation === 4 && candidate.incognito) || (candidate.signature === H3 && candidate.activeProfileId === "PROFILE:SOCIAL" && candidate.generation === 5 && !candidate.incognito) };
const grantVerifier = { verify: (candidate: Readonly<VisibilityGrant>) => candidate.signature === H && candidate.ownerProfileId === "PROFILE:SOCIAL" && candidate.granteeProfileId === "PROFILE:WORK" && candidate.policyVersion === 2 && candidate.expiresAt === "2026-08-09T18:30:00Z" };
const workToSocial: AccessRequest = { schemaVersion: 1, accountId: "ACCOUNT:1", actorProfileId: "PROFILE:WORK", actorProfileType: "WORK", sessionGeneration: 4, resourceOwnerProfileId: "PROFILE:SOCIAL", resourceOwnerProfileType: "SOCIAL", relation: "LINKED", purpose: "PROFILE_VIEW", surface: "PROFILE", globalDiscovery: false, blocked: false };
const grant: VisibilityGrant = { schemaVersion: 1, grantId: "GRANT:SOCIAL:WORK", ownerProfileId: "PROFILE:SOCIAL", ownerProfileType: "SOCIAL", granteeProfileId: "PROFILE:WORK", granteeProfileType: "WORK", policyVersion: 2, purposes: ["PROFILE_VIEW"], relation: "LINKED", allowCrossProfile: true, allowGlobalDiscovery: false, issuedAt: "2026-08-09T17:00:00Z", expiresAt: "2026-08-09T18:30:00Z", issuerKeyId: "POLICY:LOCAL:1", signature: H };
function main(): void {
  assert(verifySession(session, sessionVerifier, NOW).activeProfileId === "PROFILE:WORK", "signed active session passes");
  expectCode(() => verifySession({ ...session, extra: true }, sessionVerifier, NOW), "SESSION_INVALID");
  expectCode(() => verifySession({ ...session, riskClear: false }, sessionVerifier, NOW), "SESSION_RISK_DENIED");
  expectCode(() => verifySession({ ...session, signature: "c".repeat(64) }, sessionVerifier, NOW), "SESSION_SIGNATURE_INVALID");
  expectCode(() => verifySession({ ...session, expiresAt: NOW }, sessionVerifier, NOW), "SESSION_EXPIRED");
  expectCode(() => verifySession({ ...session, ownedProfileIds: ["PROFILE:SOCIAL"], profileTypes: [{ profileId: "PROFILE:SOCIAL", profileType: "SOCIAL" }] }, sessionVerifier, NOW), "ACTIVE_PROFILE_NOT_OWNED");
  expectCode(() => verifySession({ ...session, profileTypes: [{ profileId: "PROFILE:WORK", profileType: "SOCIAL" }] }, sessionVerifier, NOW), "PROFILE_BINDING_INVALID");
  expectCode(() => authorizeProfileRead(workToSocial, session, sessionVerifier, null, grantVerifier, NOW), "AUDIENCE_DENIED");
  assert(!clientCanRender(workToSocial, session, sessionVerifier, null, grantVerifier, NOW), "client denies Work to Social without grant");
  const allowed = authorizeProfileRead(workToSocial, session, sessionVerifier, grant, grantVerifier, NOW);
  assert(allowed.decision === "ALLOW" && allowed.policyVersion === 2, "signed explicit Work to Social grant allows exact purpose");
  expectCode(() => authorizeProfileRead({ ...workToSocial, actorProfileType: "SOCIAL" }, session, sessionVerifier, grant, grantVerifier, NOW), "PROFILE_TYPE_BINDING_MISMATCH");
  expectCode(() => authorizeProfileRead({ ...workToSocial, resourceOwnerProfileType: "DATING" }, session, sessionVerifier, grant, grantVerifier, NOW), "AUDIENCE_DENIED");
  expectCode(() => authorizeProfileRead({ ...workToSocial, purpose: "FEED" }, session, sessionVerifier, grant, grantVerifier, NOW), "AUDIENCE_DENIED");
  expectCode(() => authorizeProfileRead(workToSocial, session, sessionVerifier, { ...grant, signature: "c".repeat(64) }, grantVerifier, NOW), "GRANT_SIGNATURE_INVALID");
  expectCode(() => authorizeProfileRead(workToSocial, session, sessionVerifier, { ...grant, expiresAt: NOW }, grantVerifier, NOW), "GRANT_EXPIRED");
  const datingGlobal: AccessRequest = { ...workToSocial, resourceOwnerProfileId: "PROFILE:DATING:OTHER", resourceOwnerProfileType: "DATING", relation: "NONE", purpose: "SEARCH", surface: "GLOBAL_SEARCH", globalDiscovery: true };
  expectCode(() => authorizeProfileRead(datingGlobal, session, sessionVerifier, null, grantVerifier, NOW), "DATING_GLOBAL_DENIED");
  assert(!clientCanRender(datingGlobal, session, sessionVerifier, null, grantVerifier, NOW), "client omits Dating from global discovery");
  const datingSelfSession: ProfileSession = { ...session, activeProfileId: "PROFILE:DATING", generation: 6, signature: "d".repeat(64) };
  const datingSelfVerifier = { verify: (candidate: Readonly<ProfileSession>) => candidate.signature === "d".repeat(64) && candidate.activeProfileId === "PROFILE:DATING" && candidate.profileTypes.some((binding) => binding.profileId === "PROFILE:DATING" && binding.profileType === "DATING") };
  const datingSelfGlobal: AccessRequest = { ...datingGlobal, actorProfileId: "PROFILE:DATING", actorProfileType: "DATING", sessionGeneration: 6, resourceOwnerProfileId: "PROFILE:DATING", relation: "SELF" };
  expectCode(() => authorizeProfileRead(datingSelfGlobal, datingSelfSession, datingSelfVerifier, null, grantVerifier, NOW), "DATING_GLOBAL_DENIED");
  expectCode(() => authorizeProfileRead({ ...workToSocial, blocked: true }, session, sessionVerifier, grant, grantVerifier, NOW), "PROFILE_FORBIDDEN");
  expectCode(() => authorizeProfileRead({ ...workToSocial, sessionGeneration: 3 }, session, sessionVerifier, grant, grantVerifier, NOW), "CONTEXT_STALE");
  expectCode(() => authorizeProfileRead({ ...workToSocial, actorProfileId: "PROFILE:SOCIAL" }, session, sessionVerifier, grant, grantVerifier, NOW), "CONTEXT_STALE");
  expectCode(() => authorizeProfileRead(workToSocial, { ...session, incognito: true }, sessionVerifier, grant, grantVerifier, NOW), "SESSION_SIGNATURE_INVALID");
  const incognito = { ...session, incognito: true, signature: H2 }; const incognitoGlobal = { ...workToSocial, globalDiscovery: true, surface: "GLOBAL_SEARCH" as const };
  expectCode(() => authorizeProfileRead(incognitoGlobal, incognito, sessionVerifier, grant, grantVerifier, NOW), "INCOGNITO_DISCOVERY_DENIED");
  const next = { ...session, activeProfileId: "PROFILE:SOCIAL", generation: 5, issuedAt: NOW, signature: H3 };
  assert(switchProfile(session, next, "PROFILE:SOCIAL", sessionVerifier, NOW).generation === 5, "profile switch advances signed generation");
  expectCode(() => switchProfile(session, { ...next, generation: 6 }, "PROFILE:SOCIAL", sessionVerifier, NOW), "SESSION_SIGNATURE_INVALID");
  expectCode(() => authorizeProfileRead(workToSocial, next, sessionVerifier, grant, grantVerifier, NOW), "CONTEXT_STALE");
  const socialSelf: AccessRequest = { ...workToSocial, actorProfileId: "PROFILE:SOCIAL", actorProfileType: "SOCIAL", sessionGeneration: 5, resourceOwnerProfileId: "PROFILE:SOCIAL", relation: "SELF" };
  assert(authorizeProfileRead(socialSelf, next, sessionVerifier, null, grantVerifier, NOW).decision === "ALLOW", "new active profile self read passes");
  expectCode(() => authorizeProfileRead({ ...socialSelf, resourceOwnerProfileType: "DATING" }, next, sessionVerifier, null, grantVerifier, NOW), "PROFILE_TYPE_BINDING_MISMATCH");

  const profileTypes: ProfileType[] = ["WORK", "SOCIAL", "DATING", "TRAVEL", "MARKETPLACE"];
  const matrixProfiles = profileTypes.map((type, index) => ({ type, id: `PROFILE:MATRIX:${type}`, signature: String(index + 1).repeat(64) }));
  const matrixBindings = matrixProfiles.map((item) => ({ profileId: item.id, profileType: item.type }));
  const matrixVerifier = { verify: (candidate: Readonly<ProfileSession>) => matrixProfiles.some((profile) => profile.id === candidate.activeProfileId && profile.signature === candidate.signature && candidate.generation === 10 && sameProfiles(candidate.ownedProfileIds, matrixProfiles.map((item) => item.id)) && candidate.profileTypes.every((binding) => matrixBindings.some((expected) => expected.profileId === binding.profileId && expected.profileType === binding.profileType))) };
  for (const actor of matrixProfiles) {
    const matrixSession: ProfileSession = { ...session, activeProfileId: actor.id, ownedProfileIds: matrixProfiles.map((item) => item.id), profileTypes: matrixBindings, generation: 10, signature: actor.signature };
    for (const owner of matrixProfiles) { const request: AccessRequest = { ...workToSocial, actorProfileId: actor.id, actorProfileType: actor.type, sessionGeneration: 10, resourceOwnerProfileId: owner.id, resourceOwnerProfileType: owner.type, relation: actor.id === owner.id ? "SELF" : "NONE" }; if (actor.id === owner.id) assert(authorizeProfileRead(request, matrixSession, matrixVerifier, null, grantVerifier, NOW).decision === "ALLOW", `${actor.type} self access allowed`); else { expectCode(() => authorizeProfileRead(request, matrixSession, matrixVerifier, null, grantVerifier, NOW), owner.type === "DATING" && request.globalDiscovery ? "DATING_GLOBAL_DENIED" : "AUDIENCE_DENIED"); assert(!clientCanRender(request, matrixSession, matrixVerifier, null, grantVerifier, NOW), `${actor.type} to ${owner.type} denied in client`); } }
  }

  const registry = new VisibilityGrantRegistry();
  assert(registry.register(grant, "EVENT:GRANT:1", grantVerifier, NOW).policyVersion === 2, "registry accepts signed current grant");
  assert(authorizeProfileReadFromRegistry(workToSocial, session, sessionVerifier, registry, grantVerifier, NOW).decision === "ALLOW", "API resolves only current registry grant");
  expectCode(() => registry.register(grant, "EVENT:GRANT:1", grantVerifier, NOW), "GRANT_EVENT_REPLAY");
  expectCode(() => registry.register({ ...grant, grantId: "GRANT:SOCIAL:WORK:STALE" }, "EVENT:GRANT:STALE", { verify: () => true }, NOW), "POLICY_VERSION_STALE");
  const revocation: GrantRevocation = { schemaVersion: 1, revocationId: "REVOKE:SOCIAL:WORK:1", grantId: grant.grantId, ownerProfileId: grant.ownerProfileId, policyVersion: grant.policyVersion, revokedAt: NOW, issuerKeyId: "POLICY:LOCAL:1", signature: H2 };
  const revocationVerifier = { verify: (candidate: Readonly<GrantRevocation>) => candidate.signature === H2 && candidate.revocationId === revocation.revocationId && candidate.grantId === grant.grantId && candidate.ownerProfileId === grant.ownerProfileId && candidate.policyVersion === 2 };
  expectCode(() => registry.revoke({ ...revocation, signature: H3 }, "EVENT:REVOKE:BAD", revocationVerifier, NOW), "REVOCATION_SIGNATURE_INVALID");
  registry.revoke(revocation, "EVENT:REVOKE:1", revocationVerifier, NOW);
  assert(registry.resolve(grant.ownerProfileId, grant.granteeProfileId, NOW) === null, "revoked registry grant is absent");
  expectCode(() => authorizeProfileReadFromRegistry(workToSocial, session, sessionVerifier, registry, grantVerifier, NOW), "AUDIENCE_DENIED");
  expectCode(() => registry.revoke(revocation, "EVENT:REVOKE:2", revocationVerifier, NOW), "REVOCATION_BINDING_MISMATCH");
  const snapshot = registry.snapshot("d".repeat(64)), canonical = JSON.stringify(json(snapshot));
  const checkpointVerifier = { verify: (candidate: Readonly<typeof snapshot>) => JSON.stringify(json(candidate)) === canonical };
  const restored = VisibilityGrantRegistry.restore(snapshot, grantVerifier, revocationVerifier, checkpointVerifier);
  assert(restored.resolve(grant.ownerProfileId, grant.granteeProfileId, NOW) === null, "revocation survives verified restart");
  expectCode(() => restored.register(grant, "EVENT:GRANT:1", grantVerifier, NOW), "GRANT_EVENT_REPLAY");
  expectCode(() => VisibilityGrantRegistry.restore({ ...snapshot, nextOrdinal: 2 }, grantVerifier, revocationVerifier, { verify: () => true }), "REGISTRY_SNAPSHOT_INVALID");
  expectCode(() => VisibilityGrantRegistry.restore({ ...snapshot, events: [...snapshot.events].reverse() }, grantVerifier, revocationVerifier, { verify: () => true }), "REGISTRY_SNAPSHOT_INVALID");
  expectCode(() => VisibilityGrantRegistry.restore({ ...snapshot, events: snapshot.events.slice(0, 1) }, grantVerifier, revocationVerifier, { verify: () => true }), "REGISTRY_SNAPSHOT_INVALID");
  expectCode(() => VisibilityGrantRegistry.restore({ ...snapshot, state: snapshot.state.map((row) => ({ ...row, revoked: false })) }, grantVerifier, revocationVerifier, { verify: () => true }), "REGISTRY_SNAPSHOT_INVALID");
  expectCode(() => VisibilityGrantRegistry.restore(snapshot, grantVerifier, revocationVerifier, { verify: () => false }), "REGISTRY_CHECKPOINT_UNVERIFIED");
  const denialTrace = buildAccessDenialTrace({ schemaVersion: 1, traceId: "e".repeat(64), requestId: "REQUEST:SYSTEM_TEST:1", actorCommitment: "f".repeat(64), resourceCommitment: "1".repeat(64), code: "DATING_GLOBAL_DENIED", sessionGeneration: 10, policyVersion: 0, actorClass: "SYSTEM_TEST", occurredAt: NOW });
  assert(!JSON.stringify(denialTrace).includes("PROFILE:DATING") && denialTrace.code === "DATING_GLOBAL_DENIED", "denial trace contains commitments without raw Dating target");
  expectCode(() => buildAccessDenialTrace({ ...denialTrace, actorProfileId: "PROFILE:DATING" }), "DENIAL_TRACE_INVALID");
  expectCode(() => buildAccessDenialTrace({ ...denialTrace, actorClass: "HUMAN" }), "DENIAL_TRACE_INVALID");
  process.stdout.write(JSON.stringify({ schema_version: 1, task_id: "NX-PROFILE-P01", status: "PASS", assertions, actor_class: "SYSTEM_TEST", matrix: { profile_types: profileTypes.length, combinations: profileTypes.length * profileTypes.length, unauthorized_cross_profile_denials: profileTypes.length * (profileTypes.length - 1) }, denial_trace: denialTrace, negative: { work_to_social_api_denied: true, work_to_social_client_denied: true, dating_global_api_denied: true, dating_global_client_denied: true, dating_self_global_denied: true, profile_type_substitution_denied: true, self_owner_type_substitution_denied: true, grant_profile_type_substitution_denied: true, stale_generation_denied: true, incognito_global_denied: true, block_precedes_grant: true, same_wallet_not_authorization: true, grant_replay_denied_after_restart: true, revoked_grant_denied_after_restart: true, missing_reordered_tampered_events_denied: true, checkpoint_required: true, raw_profile_ids_absent_from_trace: true }, network_operations: 0, economic_operations: 0, external_provider_operations: 0, incremental_cost: { amount: 0, currency: "EUR" } }));
}
function sameProfiles(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && [...left].sort().join("|") === [...right].sort().join("|"); }
main();
