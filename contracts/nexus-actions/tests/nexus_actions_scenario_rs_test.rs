use ed25519_dalek::{Signer, SigningKey};
use multiversx_sc_scenario::imports::*;
use std::fs;

#[path = "../output/nexus_actions_proxy.rs"]
mod nexus_actions_proxy;

use nexus_actions_proxy::{
    ActionEnvelope as ProxyActionEnvelope, NexusActionsProxy,
    SessionCapability as ProxySessionCapability,
};

const OWNER: TestAddress = TestAddress::new("owner");
const PAUSER: TestAddress = TestAddress::new("pauser");
const RELAYER: TestAddress = TestAddress::new("relayer");
const CONTROLLER: TestAddress = TestAddress::new("controller");
const CONTRACT: TestSCAddress = TestSCAddress::new("nexus-actions");
const CODE_PATH: MxscPath = MxscPath::new("output/nexus-actions.mxsc.json");

const NOW_MS: u64 = 1_800_000_000_000;
const CAPABILITY_EXPIRY_MS: u64 = NOW_MS + 86_400_000;
const ACTION_EXPIRY_MS: u64 = NOW_MS + 60_000;

fn world() -> ScenarioWorld {
    let mut world = ScenarioWorld::new().executor_config(ExecutorConfig::full_suite());
    world.set_current_dir_from_workspace(".");
    world.register_contract(CODE_PATH, nexus_actions::ContractBuilder);
    world
}

fn managed_32(bytes: &[u8; 32]) -> ManagedByteArray<StaticApi, 32> {
    ManagedByteArray::new_from_bytes(bytes)
}

fn managed_64(bytes: &[u8; 64]) -> ManagedByteArray<StaticApi, 64> {
    ManagedByteArray::new_from_bytes(bytes)
}

fn write_go_portable_trace(world: &mut ScenarioWorld, path: &str) {
    world.write_scenario_trace(path);
    let trace = fs::read_to_string(path).expect("scenario trace must be readable");
    let portable = trace
        .replace("mxsc:output/", "mxsc:../output/")
        .replacen(
            "\"gasLimit\": \"5,000,000\"",
            "\"gasLimit\": \"100,000,000\"",
            1,
        )
        .replace(
            "\"gasLimit\": \"5,000,000\"",
            "\"gasLimit\": \"20,000,000\"",
        );
    fs::write(path, portable).expect("portable scenario trace must be writable");
}

fn action_envelope(
    public_key: &[u8; 32],
    nonce: u64,
    action_type: u16,
    visibility: u8,
    object: u8,
) -> ProxyActionEnvelope<StaticApi> {
    ProxyActionEnvelope {
        version: 2,
        actor_kind: 1,
        actor_commitment: managed_32(&[0x11; 32]),
        action_type,
        object_commitment: managed_32(&[object; 32]),
        payload_hash_or_cid: managed_32(&[0x33; 32]),
        visibility_class: visibility,
        action_nonce: nonce,
        issued_at: NOW_MS,
        expires_at: ACTION_EXPIRY_MS,
        session_public_key: managed_32(public_key),
    }
}

struct Fixture {
    world: ScenarioWorld,
    signing_key: SigningKey,
    public_key: [u8; 32],
}

impl Fixture {
    fn deployed() -> Self {
        Self::deployed_with_scope(1u32)
    }

    fn deployed_with_scope(scope_bits: u32) -> Self {
        let mut world = world();
        world.start_trace();
        world.account(OWNER).nonce(1);
        world.account(PAUSER).nonce(1);
        world.account(RELAYER).nonce(1);
        world.account(CONTROLLER).nonce(1);
        world
            .current_block()
            .block_timestamp_millis(TimestampMillis::new(NOW_MS));

        world
            .tx()
            .id("deploy")
            .from(OWNER)
            .typed(NexusActionsProxy)
            .init("D", PAUSER)
            .code(CODE_PATH)
            .new_address(CONTRACT)
            .run();

        world
            .tx()
            .id("allow relayer")
            .from(OWNER)
            .to(CONTRACT)
            .typed(NexusActionsProxy)
            .set_relayer_allowed(RELAYER, true)
            .run();

        let signing_key = SigningKey::from_bytes(&[0x42; 32]);
        let public_key = *signing_key.verifying_key().as_bytes();
        world
            .tx()
            .id("register capability")
            .from(CONTROLLER)
            .to(CONTRACT)
            .typed(NexusActionsProxy)
            .register_capability(
                1u8,
                managed_32(&[0x11; 32]),
                managed_32(&public_key),
                scope_bits,
                3u32,
                CAPABILITY_EXPIRY_MS,
                RELAYER,
            )
            .run();

        Self {
            world,
            signing_key,
            public_key,
        }
    }

    fn sign(
        &mut self,
        envelope: &ProxyActionEnvelope<StaticApi>,
    ) -> ManagedByteArray<StaticApi, 64> {
        let signing_message: ManagedBuffer<StaticApi> = self
            .world
            .query()
            .to(CONTRACT)
            .typed(NexusActionsProxy)
            .get_signing_message(envelope)
            .returns(ReturnsResult)
            .run();
        let signature = self.signing_key.sign(signing_message.to_boxed_bytes().as_slice());
        managed_64(&signature.to_bytes())
    }
}

#[test]
fn signed_action_increments_nonce_and_replay_is_rejected() {
    let mut fixture = Fixture::deployed();
    let envelope = action_envelope(&fixture.public_key, 1, 3, 1, 0x22);
    let signature = fixture.sign(&envelope);

    fixture
        .world
        .tx()
        .id("record signed like")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(envelope.clone(), signature.clone())
        .run();

    fixture
        .world
        .query()
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .get_capability(managed_32(&fixture.public_key))
        .returns(ExpectValue(OptionalValue::Some(ProxySessionCapability {
            schema_version: 2,
            controller: CONTROLLER.to_managed_address(),
            actor_kind: 1,
            actor_commitment: managed_32(&[0x11; 32]),
            scope_bits: 1,
            max_actions: 3,
            used_actions: 1,
            valid_from: NOW_MS,
            expires_at: CAPABILITY_EXPIRY_MS,
            last_action_nonce: 1,
            authorized_relayer: RELAYER.to_managed_address(),
            active: true,
        })))
        .run();

    fixture
        .world
        .tx()
        .id("reject replay")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(envelope, signature)
        .returns(ExpectError(4, "ACTION_NONCE_REPLAY_OR_GAP"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/signed-action-replay.scen.json",
    );
}

#[test]
fn private_action_requires_generic_commitment_and_private_scope() {
    let mut fixture = Fixture::deployed();
    let envelope = action_envelope(&fixture.public_key, 1, u16::MAX, 3, 0x77);
    let signature = fixture.sign(&envelope);

    fixture
        .world
        .tx()
        .id("reject missing private scope")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_private_action(managed_32(&[0x77; 32]), envelope, signature)
        .returns(ExpectError(4, "CAPABILITY_SCOPE_DENIED"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/private-scope-denied.scen.json",
    );
}

#[test]
fn private_action_with_private_scope_is_accepted() {
    let mut fixture = Fixture::deployed_with_scope(8u32);
    let envelope = action_envelope(&fixture.public_key, 1, u16::MAX, 3, 0x78);
    let signature = fixture.sign(&envelope);

    fixture
        .world
        .tx()
        .id("record private commitment")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_private_action(managed_32(&[0x78; 32]), envelope, signature)
        .run();

    fixture
        .world
        .query()
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .get_capability(managed_32(&fixture.public_key))
        .returns(ExpectValue(OptionalValue::Some(ProxySessionCapability {
            schema_version: 2,
            controller: CONTROLLER.to_managed_address(),
            actor_kind: 1,
            actor_commitment: managed_32(&[0x11; 32]),
            scope_bits: 8,
            max_actions: 3,
            used_actions: 1,
            valid_from: NOW_MS,
            expires_at: CAPABILITY_EXPIRY_MS,
            last_action_nonce: 1,
            authorized_relayer: RELAYER.to_managed_address(),
            active: true,
        })))
        .run();

    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/private-action-success.scen.json",
    );
}

#[test]
fn pauser_can_stop_an_action_type_without_owner_power() {
    let mut fixture = Fixture::deployed();
    fixture
        .world
        .tx()
        .id("pause like")
        .from(PAUSER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .pause_action_type(3u16, true)
        .run();

    let envelope = action_envelope(&fixture.public_key, 1, 3, 1, 0x55);
    let signature = fixture.sign(&envelope);
    fixture
        .world
        .tx()
        .id("reject paused like")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(envelope, signature)
        .returns(ExpectError(4, "ACTION_TYPE_PAUSED"))
        .run();
    write_go_portable_trace(&mut fixture.world, "scenarios/pauser-stop.scen.json");
}

#[test]
fn only_controller_can_revoke_a_capability() {
    let mut fixture = Fixture::deployed();
    fixture
        .world
        .tx()
        .id("reject non-controller revoke")
        .from(PAUSER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .revoke_capability(managed_32(&fixture.public_key))
        .returns(ExpectError(4, "CONTROLLER_REQUIRED"))
        .run();
}

#[test]
fn revoked_capability_cannot_record_an_action() {
    let mut fixture = Fixture::deployed();
    fixture
        .world
        .tx()
        .id("revoke capability")
        .from(CONTROLLER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .revoke_capability(managed_32(&fixture.public_key))
        .run();

    let envelope = action_envelope(&fixture.public_key, 1, 3, 1, 0x44);
    let signature = fixture.sign(&envelope);
    fixture
        .world
        .tx()
        .id("reject revoked capability")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(envelope, signature)
        .returns(ExpectError(4, "CAPABILITY_REVOKED"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/capability-revoked.scen.json",
    );
}

#[test]
fn rotation_cannot_expand_scope_or_use_a_zero_key() {
    let mut fixture = Fixture::deployed();
    fixture
        .world
        .tx()
        .id("reject rotation scope escalation")
        .from(CONTROLLER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .rotate_capability(
            managed_32(&fixture.public_key),
            managed_32(&[0x51; 32]),
            3u32,
            2u32,
            CAPABILITY_EXPIRY_MS,
            RELAYER,
        )
        .returns(ExpectError(4, "CAPABILITY_SCOPE_ESCALATION"))
        .run();

    fixture
        .world
        .tx()
        .id("reject zero replacement key")
        .from(CONTROLLER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .rotate_capability(
            managed_32(&fixture.public_key),
            managed_32(&[0u8; 32]),
            1u32,
            2u32,
            CAPABILITY_EXPIRY_MS,
            RELAYER,
        )
        .returns(ExpectError(4, "SESSION_KEY_INVALID"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/capability-rotation-escalation.scen.json",
    );
}

#[test]
fn unbound_relayer_and_nonce_gap_are_rejected() {
    let mut fixture = Fixture::deployed();
    let first = action_envelope(&fixture.public_key, 1, 3, 1, 0x61);
    let first_signature = fixture.sign(&first);
    fixture
        .world
        .tx()
        .id("reject unallowlisted caller")
        .from(PAUSER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(first, first_signature)
        .returns(ExpectError(4, "RELAYER_DENIED"))
        .run();

    let gap = action_envelope(&fixture.public_key, 2, 3, 1, 0x62);
    let gap_signature = fixture.sign(&gap);
    fixture
        .world
        .tx()
        .id("reject nonce gap")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(gap, gap_signature)
        .returns(ExpectError(4, "ACTION_NONCE_REPLAY_OR_GAP"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/relayer-and-nonce-denied.scen.json",
    );
}

#[test]
fn batch_shaped_extra_argument_is_rejected_by_the_vm_decoder() {
    let mut fixture = Fixture::deployed();
    let envelope = action_envelope(&fixture.public_key, 1, 3, 1, 0x63);
    let signature = fixture.sign(&envelope);
    fixture
        .world
        .tx()
        .id("reject batch-shaped extra argument")
        .from(RELAYER)
        .to(CONTRACT)
        .raw_call("recordAction")
        .argument(&envelope)
        .argument(&signature)
        .argument(&managed_32(&[0x99; 32]))
        .returns(ExpectError(4, "wrong number of arguments"))
        .run();
    write_go_portable_trace(
        &mut fixture.world,
        "scenarios/batch-shaped-extra-argument.scen.json",
    );
}

#[test]
fn capability_action_limit_is_enforced() {
    let mut fixture = Fixture::deployed();
    for nonce in 1..=3 {
        let envelope = action_envelope(&fixture.public_key, nonce, 3, 1, 0x70 + nonce as u8);
        let signature = fixture.sign(&envelope);
        fixture
            .world
            .tx()
            .id("accepted action within limit")
            .from(RELAYER)
            .to(CONTRACT)
            .typed(NexusActionsProxy)
            .record_action(envelope, signature)
            .run();
    }

    let envelope = action_envelope(&fixture.public_key, 4, 3, 1, 0x74);
    let signature = fixture.sign(&envelope);
    fixture
        .world
        .tx()
        .id("reject action above limit")
        .from(RELAYER)
        .to(CONTRACT)
        .typed(NexusActionsProxy)
        .record_action(envelope, signature)
        .returns(ExpectError(4, "CAPABILITY_ACTION_LIMIT"))
        .run();
}
