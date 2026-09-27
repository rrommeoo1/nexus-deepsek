import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifactGroups = {
  client_cryptography: ["public/chat-crypto.js", "public/app.js", "public/call-client.js"],
  server_protocol_and_storage: [
    "lib/api.js", "lib/repo.js", "lib/db.js", "lib/security.js",
  ],
  encrypted_attachment_boundary: [
    "lib/media.js", "lib/resumable-upload.js", "lib/privacy-matrix.js",
  ],
  deterministic_verification: [
    "test/audit.test.js", "test/p1-e2ee-attachments.test.js",
    "test/core.test.js",
    "test/p1-e2ee-group-api.test.js", "test/p1-e2ee-group-epochs.test.js",
    "test/p1-e2ee-group-scalability.test.js", "test/p1-sessions-devices.test.js",
    "test/db-migrations.test.js", "test/resumable-upload.test.js",
    "test/privacy-matrix.test.js",
  ],
};
const artifactNames = [...new Set(Object.values(artifactGroups).flat())];
const artifacts = Object.fromEntries(artifactNames.map((name) => [name, readFileSync(resolve(root, name), "utf8")]));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function scoped(sourceName, startMarker, endMarker) {
  const source = artifacts[sourceName];
  const start = source.indexOf(startMarker);
  const end = start < 0 ? -1 : source.indexOf(endMarker, start + startMarker.length);
  return { sourceName, source, start, end, text: start >= 0 && end > start ? source.slice(start, end) : "" };
}

function invariant(id, scope, fragment) {
  const relativeIndex = scope.text.indexOf(fragment);
  const absoluteIndex = relativeIndex < 0 ? -1 : scope.start + relativeIndex;
  return {
    id,
    pass: scope.start >= 0 && scope.end > scope.start && relativeIndex >= 0,
    source: scope.sourceName,
    scope_start: scope.start < 0 ? null : scope.source.slice(0, scope.start).split("\n").length,
    evidence_line: absoluteIndex < 0 ? null : scope.source.slice(0, absoluteIndex).split("\n").length,
  };
}

const requireCrypto = scoped("public/chat-crypto.js", "function requireCrypto()", "function openKeyDb()");
const createDevice = scoped("public/chat-crypto.js", "async function createDeviceRecord()", "export async function ensureChatDevice");
const recoveryKdf = scoped("public/chat-crypto.js", "async function deriveRecoveryKey", "function recoveryMetadata");
const recoveryBundle = scoped("public/chat-crypto.js", "export async function createRecoveryBundle", "export async function openRecoveryBundle");
const deriveMessage = scoped("public/chat-crypto.js", "async function deriveMessageKey", "export async function encryptPayloadForDevice");
const directEncrypt = scoped("public/chat-crypto.js", "export async function encryptPayloadForDevice", "export async function encryptEnvelopeForDevice");
const groupEncrypt = scoped("public/chat-crypto.js", "export async function encryptGroupPayloadForDevices", "export async function encryptChatText");
const groupSharedEncrypt = scoped("public/chat-crypto.js", "const keyBytes = crypto.getRandomValues(new Uint8Array(32))", "const sharedCiphertextSha256");
const groupWrapperEncrypt = scoped("public/chat-crypto.js", "for (const recipient of recipients) {", "return {\n      shared_ciphertext:");
const groupDecrypt = scoped("public/chat-crypto.js", "async function decryptGroupChatPayload", "export async function decryptChatMessage");
const repoPublicKey = scoped("lib/repo.js", "function canonicalChatPublicJwk", "export function normalizePersona");
const repoEncryptedWrite = scoped("lib/repo.js", "sendEncryptedConversationMessage(", "getMessageEnvelope(");
const apiDeviceRegistration = scoped("lib/api.js", 'if (method === "POST" && path === "/api/chat/recovery-devices")', "const recoveryActivationMatch");
const apiEncryptedWrite = scoped("lib/api.js", 'if (new Set(["e2ee_v1", "e2ee_group_v1"]).has(body.encryption_mode))', "const text = sanitizeText(body.body, 4000)");
const encryptedMedia = scoped("lib/media.js", "export function storeClientEncryptedMedia", "export function readMedia");
const encryptedUpload = scoped("lib/resumable-upload.js", "export function beginResumableUpload", "export function getResumableUpload");
const deviceMutation = scoped("public/chat-crypto.js", "function safeOwnerDeviceResult", "function bytesToBase64");
const keyMaterialValidation = scoped("public/chat-crypto.js", "export async function validateConversationKeyMaterial", "function validateSafetyMaterial");
const decryptionContext = scoped("public/chat-crypto.js", "export function validateEncryptedMessageContext", "function validateDecryptedPayload");
const attachmentDecryption = scoped("public/chat-crypto.js", "export async function decryptChatAttachment", "\n}");
const apiKeyMaterial = scoped("lib/api.js", "const chatKeyMaterialMatch", 'if (method === "GET" && path === "/api/chat/conversations")');
const appEnvelopeValidation = scoped("public/app.js", "function isSafeThreadEnvelope", "function isSafeThreadMeeting");
const appThread = scoped("public/app.js", "async function loadThread", "function isBoundAuxiliaryMutation");
const appBlobLifecycle = scoped("public/app.js", "function revokeDecryptedAttachmentUrls", "function sigilCacheKey");

const invariants = [
  invariant("secure_context_gate", requireCrypto, "E2EE requires HTTPS or localhost"),
  invariant("p256_device_key_generation", createDevice, 'generateKey({ name: "ECDH", namedCurve: "P-256" }'),
  invariant("persisted_device_private_key_imported_non_extractable", createDevice, 'importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])'),
  invariant("message_ecdh_256_derive_bits", deriveMessage, 'deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256)'),
  invariant("message_hkdf_sha256", deriveMessage, '{ name: "HKDF", hash: "SHA-256", salt, info }'),
  invariant("message_aes_256_gcm_derived_key", deriveMessage, '{ name: "AES-GCM", length: 256 }'),
  invariant("direct_random_96_bit_iv", directEncrypt, "crypto.getRandomValues(new Uint8Array(12))"),
  invariant("direct_aes_gcm_128_bit_tag", directEncrypt, "tagLength: 128"),
  invariant("direct_new_message_epoch_required", directEncrypt, "epoch-bound E2EE key material is required for new messages"),
  invariant("group_random_256_bit_content_key", groupSharedEncrypt, "crypto.getRandomValues(new Uint8Array(32))"),
  invariant("group_random_96_bit_shared_iv", groupSharedEncrypt, "crypto.getRandomValues(new Uint8Array(12))"),
  invariant("group_shared_aes_gcm_128_bit_tag", groupSharedEncrypt, "tagLength: 128"),
  invariant("group_random_96_bit_wrapper_iv", groupWrapperEncrypt, "crypto.getRandomValues(new Uint8Array(12))"),
  invariant("group_wrapper_aes_gcm_128_bit_tag", groupWrapperEncrypt, "tagLength: 128"),
  invariant("group_content_key_js_buffer_clear", groupEncrypt, "keyBytes.fill(0)"),
  invariant("group_decrypt_checks_ciphertext_commitment", groupDecrypt, "group ciphertext commitment mismatch"),
  invariant("group_decrypted_content_key_js_buffer_clear", groupDecrypt, "contentKeyBytes.fill(0)"),
  invariant("recovery_pbkdf2_sha256", recoveryKdf, '{ name: "PBKDF2", hash: "SHA-256", salt, iterations: E2EE_RECOVERY_KDF_ITERATIONS }'),
  invariant("recovery_aes_256_gcm_derived_key", recoveryKdf, '{ name: "AES-GCM", length: 256 }'),
  invariant("recovery_bundle_aes_gcm_128_bit_tag", recoveryBundle, "tagLength: 128"),
  invariant("server_public_jwk_rejects_private_d", repoPublicKey, '"d" in publicJwk'),
  invariant("group_mode_downgrade_denied", repoEncryptedWrite, 'error: "encryption_mode_downgrade"'),
  invariant("encrypted_replay_commits_server_expiry_metadata", repoEncryptedWrite, "expires_at: expiry"),
  invariant("api_recovery_registration_rejects_private_d", apiDeviceRegistration, '"d" in publicJwk'),
  invariant("api_plaintext_denied_on_e2ee_write", apiEncryptedWrite, "plaintext body is forbidden on the E2EE endpoint"),
  invariant("api_e2ee_envelope_count_bounded", apiEncryptedWrite, "body.envelopes.length > MAX_E2EE_DEVICE_ENVELOPES"),
  invariant("encrypted_attachment_storage_marked_unscannable", encryptedMedia, 'scanStatus: "ready_client_encrypted"'),
  invariant("encrypted_attachment_upload_purpose_mime_bound", encryptedUpload, '(purpose === "message_e2ee_attachment") !== (mime === NEXUS_E2EE_ATTACHMENT_MIME)'),
  invariant("device_mutation_owner_intent_bound", deviceMutation, "result.intent?.owner_id === ownerId"),
  invariant("device_registration_replay_key_stable", deviceMutation, "`nexus-e2ee-register:${record.deviceId}`"),
  invariant("key_material_commitment_recomputed_client_side", keyMaterialValidation, "E2EE device-set commitment mismatch"),
  invariant("key_material_current_device_coverage_required", keyMaterialValidation, "E2EE current device coverage is invalid"),
  invariant("decryption_message_id_context_bound", decryptionContext, "Number(envelope.message_id) !== Number(message.id)"),
  invariant("decryption_nonce_context_bound", decryptionContext, "envelope.client_nonce !== message.client_nonce"),
  invariant("decryption_private_jwk_extension_denied", decryptionContext, 'new Set(["kty", "crv", "x", "y"])'),
  invariant("attachment_download_stream_bounded", attachmentDecryption, "readBoundedResponseBytes(response, 20 * 1024 * 1024)"),
  invariant("key_material_cross_profile_denied", apiKeyMaterial, "conversation.context_persona !== auth.persona"),
  invariant("key_material_viewer_scope_returned", apiKeyMaterial, "viewer_id: auth.user.id"),
  invariant("thread_envelope_matches_message_context", appEnvelopeValidation, "envelope.client_nonce === message.client_nonce"),
  invariant("decrypted_blob_revoked_on_page_exit", appBlobLifecycle, 'window.addEventListener("pagehide", revokeDecryptedAttachmentUrls)'),
];
const failed = invariants.filter((item) => !item.pass);

const report = {
  schema: "NEXUS_E2EE_AUDIT_INVENTORY_V1",
  scope: "local_source_shape_inventory_not_an_independent_cryptographic_audit",
  protocol_families: [
    "NEXUS_E2EE_V2_EPOCH_BOUND_ECDH_P256_HKDF_SHA256_AES_256_GCM",
    "NEXUS_GROUP_ENVELOPE_V1_SINGLE_PAYLOAD_CONTENT_KEY_FANOUT",
    "NEXUS_E2EE_ATTACHMENT_V1",
    "NEXUS_E2EE_RECOVERY_V1",
  ],
  claimed_local_properties: [
    "authenticated_encryption_of_message_and_attachment_payloads",
    "exact_active_device_coverage_at_server_commit",
    "epoch_bound_membership_and_device_authorization",
    "e2ee_api_rejects_client_private_jwk_material_and_plaintext",
    "fail_closed_without_complete_current_device_material",
    "client_validates_key_material_and_decryption_context_before_use",
    "encrypted_attachment_fetch_is_internal_content_addressed_and_bounded",
  ],
  explicitly_not_claimed: [
    "independent_cryptographic_audit", "formal_verification", "signal_protocol_compatibility",
    "double_ratchet_or_ratcheting_sender_keys", "forward_secrecy_or_post_compromise_security",
    "automatic_cryptographic_peer_identity_authentication", "metadata_anonymity",
    "cryptographic_authentication_of_message_expiry", "malware_scanning_of_client_encrypted_attachments",
    "real_device_interoperability",
  ],
  trust_boundaries: {
    client: "generates and retains device private keys; encrypts/decrypts payloads",
    server: "authenticates accounts, supplies the public-device directory, authorizes epochs, enforces expiry and stores opaque ciphertext plus metadata",
    peer_verification: "safety-number comparison is required to detect a substituted or changed device directory",
    recovery: "portable recovery package security depends on the user passphrase and browser cryptography",
  },
  priority_open_questions_for_external_auditor: [
    "Can a malicious or compromised server substitute device public keys without detection before users compare safety numbers?",
    "Are all canonical encodings and AAD bindings unambiguous across supported browsers?",
    "Does long-term static ECDH expose retained ciphertext after device-key compromise, and what ratchet is required?",
    "Are nonce uniqueness and RNG-failure assumptions acceptable for every AES-GCM key domain?",
    "Can epoch, membership, device-revocation or idempotent-replay races yield unauthorized wrappers or history access?",
    "Are recovery-package KDF parameters, activation flow and memory handling sufficient for supported devices?",
    "Can ciphertext size, malformed JWK/base64 or maximum-cardinality fanout cause practical denial of service?",
    "Must disappearing-message expiry be client-authenticated, given it is currently server-enforced metadata?",
  ],
  artifact_groups: artifactGroups,
  source_sha256: Object.fromEntries(artifactNames.map((name) => [name, sha256(artifacts[name])])),
  invariants,
  invariant_summary: { total: invariants.length, passed: invariants.length - failed.length, failed: failed.length },
  invariant_assurance: "construction_scoped_source_shape_only_plus_separate_executable_test_artifacts",
  external_network: false,
  real_funds: false,
  incremental_cost: 0,
  local_gate: failed.length ? "FAIL" : "PASS_LOCAL_SOURCE_SHAPE_INVENTORY",
  production_gate: "BLOCKED_PENDING_FORMAL_INDEPENDENT_CRYPTO_AUDIT_AND_REAL_DEVICE_TESTS",
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
