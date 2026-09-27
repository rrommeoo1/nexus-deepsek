#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

const CONTRACT_SCHEMA_VERSION: u16 = 2;
const MAX_ACTION_TTL_MS: u64 = 5 * 60 * 1_000;
const MAX_CAPABILITY_LIFETIME_MS: u64 = 30 * 24 * 60 * 60 * 1_000;
const MAX_ACTIONS_PER_CAPABILITY: u32 = 10_000;
const MAX_CLOCK_SKEW_MS: u64 = 30_000;

const ACTOR_HUMAN: u8 = 1;
const ACTOR_AGENT: u8 = 2;
const ACTOR_SYSTEM_TEST: u8 = 3;

const VISIBILITY_PUBLIC: u8 = 1;
const VISIBILITY_CONNECTIONS: u8 = 2;
const VISIBILITY_PRIVATE_COMMITMENT: u8 = 3;

const SCOPE_SOCIAL_PUBLIC: u32 = 1 << 0;
const SCOPE_MARKET_PUBLIC: u32 = 1 << 1;
const SCOPE_REVIEW_PUBLIC: u32 = 1 << 2;
const SCOPE_PRIVATE_COMMITMENT: u32 = 1 << 3;
const ALL_SCOPE_BITS: u32 = SCOPE_SOCIAL_PUBLIC
    | SCOPE_MARKET_PUBLIC
    | SCOPE_REVIEW_PUBLIC
    | SCOPE_PRIVATE_COMMITMENT;

const ACTION_POST_CREATE: u16 = 1;
const ACTION_POST_EDIT: u16 = 2;
const ACTION_LIKE: u16 = 3;
const ACTION_UNLIKE: u16 = 4;
const ACTION_COMMENT_CREATE: u16 = 5;
const ACTION_COMMENT_EDIT: u16 = 6;
const ACTION_COMMENT_TOMBSTONE: u16 = 7;
const ACTION_FOLLOW: u16 = 8;
const ACTION_UNFOLLOW: u16 = 9;
const ACTION_SAVE: u16 = 10;
const ACTION_SHARE: u16 = 11;
const ACTION_LISTING_CREATE: u16 = 100;
const ACTION_LISTING_UPDATE: u16 = 101;
const ACTION_LISTING_RENEW: u16 = 102;
const ACTION_LISTING_CLOSE: u16 = 103;
const ACTION_OFFER: u16 = 104;
const ACTION_REVIEW: u16 = 200;
const ACTION_PRIVATE: u16 = u16::MAX;

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, PartialEq, Eq)]
pub struct ActionEnvelope<M: ManagedTypeApi> {
    pub version: u16,
    pub actor_kind: u8,
    pub actor_commitment: ManagedByteArray<M, 32>,
    pub action_type: u16,
    pub object_commitment: ManagedByteArray<M, 32>,
    pub payload_hash_or_cid: ManagedByteArray<M, 32>,
    pub visibility_class: u8,
    pub action_nonce: u64,
    pub issued_at: u64,
    pub expires_at: u64,
    pub session_public_key: ManagedByteArray<M, 32>,
}

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone)]
pub struct SessionCapability<M: ManagedTypeApi> {
    pub schema_version: u16,
    pub controller: ManagedAddress<M>,
    pub actor_kind: u8,
    pub actor_commitment: ManagedByteArray<M, 32>,
    pub scope_bits: u32,
    pub max_actions: u32,
    pub used_actions: u32,
    pub valid_from: u64,
    pub expires_at: u64,
    pub last_action_nonce: u64,
    pub authorized_relayer: ManagedAddress<M>,
    pub active: bool,
}

/// Gas-bounded action ledger. It stores only session capabilities and nonces;
/// user-visible action state is rebuilt off-chain from finalized events.
#[multiversx_sc::contract]
pub trait NexusActions {
    #[init]
    fn init(&self, chain_id: ManagedBuffer, pauser: ManagedAddress) {
        require!(!chain_id.is_empty() && chain_id.len() <= 16, "CHAIN_ID_INVALID");
        require!(!pauser.is_zero(), "PAUSER_INVALID");

        let mut domain_input = ManagedBuffer::new_from_bytes(b"NEXUS_ACTION_V2\0");
        domain_input.append(&chain_id);
        domain_input.append_bytes(b"\0");
        domain_input.append(self.blockchain().get_sc_address().as_managed_buffer());
        let domain = self.crypto().sha256(&domain_input);

        self.chain_id().set(chain_id);
        self.domain_separator().set(domain);
        self.pauser().set(pauser);
    }

    #[upgrade]
    fn upgrade(&self) {}

    /// Owner allowlists funded protocol relayers. A capability can select only
    /// one currently allowlisted relayer, keeping every call one-action-only.
    #[only_owner]
    #[endpoint(setRelayerAllowed)]
    fn set_relayer_allowed(&self, relayer: ManagedAddress, allowed: bool) {
        require!(!relayer.is_zero(), "RELAYER_INVALID");
        self.relayer_allowed(&relayer).set(allowed);
    }

    #[only_owner]
    #[endpoint(setPauser)]
    fn set_pauser(&self, pauser: ManagedAddress) {
        require!(!pauser.is_zero(), "PAUSER_INVALID");
        self.pauser().set(pauser);
    }

    #[endpoint(pauseActionType)]
    fn pause_action_type(&self, action_type: u16, paused: bool) {
        self.require_pauser_or_owner();
        require!(self.required_scope(action_type) != 0, "ACTION_TYPE_INVALID");
        self.action_paused(action_type).set(paused);
    }

    #[endpoint(pauseRelayer)]
    fn pause_relayer(&self, relayer: ManagedAddress, paused: bool) {
        self.require_pauser_or_owner();
        require!(!relayer.is_zero(), "RELAYER_INVALID");
        self.relayer_paused(&relayer).set(paused);
    }

    /// Direct wallet call. No payment is accepted because the endpoint is not
    /// annotated payable. The session key cannot authorize financial actions.
    #[endpoint(registerCapability)]
    fn register_capability(
        &self,
        actor_kind: u8,
        actor_commitment: ManagedByteArray<Self::Api, 32>,
        session_public_key: ManagedByteArray<Self::Api, 32>,
        scope_bits: u32,
        max_actions: u32,
        expires_at: u64,
        authorized_relayer: ManagedAddress,
    ) {
        let now = self
            .blockchain()
            .get_block_timestamp_millis()
            .as_u64_millis();
        self.require_actor_kind(actor_kind);
        self.require_scope_bits(scope_bits);
        require!(self.is_nonzero_32(&actor_commitment), "ACTOR_COMMITMENT_INVALID");
        require!(self.is_nonzero_32(&session_public_key), "SESSION_KEY_INVALID");
        require!(max_actions > 0 && max_actions <= MAX_ACTIONS_PER_CAPABILITY, "CAPABILITY_LIMIT_INVALID");
        require!(expires_at > now && expires_at - now <= MAX_CAPABILITY_LIFETIME_MS, "CAPABILITY_TIME_INVALID");
        require!(!authorized_relayer.is_zero(), "RELAYER_INVALID");
        require!(self.relayer_allowed(&authorized_relayer).get(), "RELAYER_DENIED");

        let mapper = self.capability(&session_public_key);
        require!(mapper.is_empty(), "CAPABILITY_ALREADY_EXISTS");
        mapper.set(SessionCapability {
            schema_version: CONTRACT_SCHEMA_VERSION,
            controller: self.blockchain().get_caller(),
            actor_kind,
            actor_commitment,
            scope_bits,
            max_actions,
            used_actions: 0,
            valid_from: now,
            expires_at,
            last_action_nonce: 0,
            authorized_relayer,
            active: true,
        });
    }

    #[endpoint(revokeCapability)]
    fn revoke_capability(&self, session_public_key: ManagedByteArray<Self::Api, 32>) {
        let mapper = self.capability(&session_public_key);
        require!(!mapper.is_empty(), "CAPABILITY_NOT_FOUND");
        let mut capability = mapper.get();
        require!(capability.controller == self.blockchain().get_caller(), "CONTROLLER_REQUIRED");
        capability.active = false;
        mapper.set(capability);
    }

    /// Rotation can only reduce the remaining authority of the old key.
    #[endpoint(rotateCapability)]
    fn rotate_capability(
        &self,
        old_session_public_key: ManagedByteArray<Self::Api, 32>,
        new_session_public_key: ManagedByteArray<Self::Api, 32>,
        new_scope_bits: u32,
        new_max_actions: u32,
        new_expires_at: u64,
        new_authorized_relayer: ManagedAddress,
    ) {
        let old_mapper = self.capability(&old_session_public_key);
        require!(!old_mapper.is_empty(), "CAPABILITY_NOT_FOUND");
        let mut old = old_mapper.get();
        let caller = self.blockchain().get_caller();
        let now = self
            .blockchain()
            .get_block_timestamp_millis()
            .as_u64_millis();
        require!(old.controller == caller, "CONTROLLER_REQUIRED");
        require!(old.active, "CAPABILITY_REVOKED");
        require!(self.is_nonzero_32(&new_session_public_key), "SESSION_KEY_INVALID");
        require!(self.capability(&new_session_public_key).is_empty(), "CAPABILITY_ALREADY_EXISTS");
        self.require_scope_bits(new_scope_bits);
        require!(new_scope_bits & !old.scope_bits == 0, "CAPABILITY_SCOPE_ESCALATION");
        require!(new_expires_at > now && new_expires_at <= old.expires_at, "CAPABILITY_TIME_ESCALATION");
        require!(new_max_actions > 0 && new_max_actions <= old.max_actions - old.used_actions, "CAPABILITY_LIMIT_ESCALATION");
        require!(self.relayer_allowed(&new_authorized_relayer).get(), "RELAYER_DENIED");

        let replacement = SessionCapability {
            schema_version: CONTRACT_SCHEMA_VERSION,
            controller: caller,
            actor_kind: old.actor_kind,
            actor_commitment: old.actor_commitment.clone(),
            scope_bits: new_scope_bits,
            max_actions: new_max_actions,
            used_actions: 0,
            valid_from: now,
            expires_at: new_expires_at,
            last_action_nonce: 0,
            authorized_relayer: new_authorized_relayer,
            active: true,
        };
        self.capability(&new_session_public_key).set(replacement);
        old.active = false;
        old_mapper.set(old);
    }

    #[endpoint(recordAction)]
    fn record_action(
        &self,
        envelope: ActionEnvelope<Self::Api>,
        session_signature: ManagedByteArray<Self::Api, 64>,
    ) {
        require!(envelope.action_type != ACTION_PRIVATE, "PRIVATE_ENDPOINT_REQUIRED");
        require!(envelope.visibility_class != VISIBILITY_PRIVATE_COMMITMENT, "PRIVATE_ENDPOINT_REQUIRED");
        self.validate_and_record(envelope, session_signature);
    }

    #[endpoint(recordPrivateAction)]
    fn record_private_action(
        &self,
        generic_commitment: ManagedByteArray<Self::Api, 32>,
        envelope: ActionEnvelope<Self::Api>,
        session_signature: ManagedByteArray<Self::Api, 64>,
    ) {
        require!(envelope.action_type == ACTION_PRIVATE, "PRIVATE_ENVELOPE_INVALID");
        require!(envelope.visibility_class == VISIBILITY_PRIVATE_COMMITMENT, "PRIVATE_ENVELOPE_INVALID");
        require!(envelope.object_commitment == generic_commitment, "PRIVATE_ENVELOPE_INVALID");
        self.validate_and_record(envelope, session_signature);
    }

    /// Canonical bytes signed by the device session key. The domain includes
    /// protocol version, configured chain id, and this contract's raw address.
    #[view(getSigningMessage)]
    fn get_signing_message(&self, envelope: ActionEnvelope<Self::Api>) -> ManagedBuffer {
        self.signing_message(&envelope)
    }

    #[view(getCapability)]
    fn get_capability(
        &self,
        session_public_key: ManagedByteArray<Self::Api, 32>,
    ) -> OptionalValue<SessionCapability<Self::Api>> {
        let mapper = self.capability(&session_public_key);
        if mapper.is_empty() {
            OptionalValue::None
        } else {
            OptionalValue::Some(mapper.get())
        }
    }

    fn validate_and_record(
        &self,
        envelope: ActionEnvelope<Self::Api>,
        session_signature: ManagedByteArray<Self::Api, 64>,
    ) {
        require!(envelope.version == CONTRACT_SCHEMA_VERSION, "ENVELOPE_VERSION_INVALID");
        self.require_actor_kind(envelope.actor_kind);
        require!(self.is_nonzero_32(&envelope.actor_commitment), "ACTOR_COMMITMENT_INVALID");
        require!(self.is_nonzero_32(&envelope.object_commitment), "OBJECT_COMMITMENT_INVALID");
        require!(self.is_nonzero_32(&envelope.payload_hash_or_cid), "PAYLOAD_COMMITMENT_INVALID");
        require!(self.is_nonzero_32(&envelope.session_public_key), "SESSION_KEY_INVALID");
        require!(
            envelope.visibility_class == VISIBILITY_PUBLIC
                || envelope.visibility_class == VISIBILITY_CONNECTIONS
                || envelope.visibility_class == VISIBILITY_PRIVATE_COMMITMENT,
            "VISIBILITY_INVALID"
        );

        let scope = self.required_scope(envelope.action_type);
        require!(scope != 0, "ACTION_TYPE_INVALID");
        require!(!self.action_paused(envelope.action_type).get(), "ACTION_TYPE_PAUSED");

        let caller = self.blockchain().get_caller();
        require!(self.relayer_allowed(&caller).get(), "RELAYER_DENIED");
        require!(!self.relayer_paused(&caller).get(), "RELAYER_PAUSED");

        let mapper = self.capability(&envelope.session_public_key);
        require!(!mapper.is_empty(), "CAPABILITY_NOT_FOUND");
        let mut capability = mapper.get();
        require!(capability.active, "CAPABILITY_REVOKED");
        require!(capability.authorized_relayer == caller, "RELAYER_DENIED");
        require!(capability.actor_kind == envelope.actor_kind, "CAPABILITY_ACTOR_MISMATCH");
        require!(capability.actor_commitment == envelope.actor_commitment, "CAPABILITY_ACTOR_MISMATCH");
        require!(capability.scope_bits & scope == scope, "CAPABILITY_SCOPE_DENIED");
        require!(capability.used_actions < capability.max_actions, "CAPABILITY_ACTION_LIMIT");

        let now = self
            .blockchain()
            .get_block_timestamp_millis()
            .as_u64_millis();
        require!(now >= capability.valid_from && now < capability.expires_at, "CAPABILITY_TIME_INVALID");
        require!(envelope.issued_at <= now.saturating_add(MAX_CLOCK_SKEW_MS), "ACTION_TIME_INVALID");
        require!(envelope.expires_at > now, "ACTION_EXPIRED");
        require!(envelope.expires_at >= envelope.issued_at, "ACTION_TTL_INVALID");
        require!(envelope.expires_at - envelope.issued_at <= MAX_ACTION_TTL_MS, "ACTION_TTL_INVALID");
        require!(envelope.expires_at <= capability.expires_at, "ACTION_AFTER_CAPABILITY_EXPIRY");
        require!(envelope.action_nonce == capability.last_action_nonce + 1, "ACTION_NONCE_REPLAY_OR_GAP");

        let signing_message = self.signing_message(&envelope);
        self.crypto().verify_ed25519(
            envelope.session_public_key.as_managed_buffer(),
            &signing_message,
            session_signature.as_managed_buffer(),
        );

        capability.last_action_nonce = envelope.action_nonce;
        capability.used_actions += 1;
        mapper.set(capability);
        self.action_recorded_event(
            &envelope.actor_commitment,
            &envelope.object_commitment,
            envelope.action_nonce,
        );
    }

    fn signing_message(&self, envelope: &ActionEnvelope<Self::Api>) -> ManagedBuffer {
        let mut message = ManagedBuffer::new();
        message.append(self.domain_separator().get().as_managed_buffer());
        let encoded_envelope = self.serializer().top_encode_to_managed_buffer(envelope);
        message.append(&encoded_envelope);
        message
    }

    fn require_actor_kind(&self, actor_kind: u8) {
        require!(
            actor_kind == ACTOR_HUMAN || actor_kind == ACTOR_AGENT || actor_kind == ACTOR_SYSTEM_TEST,
            "ACTOR_KIND_FORBIDDEN"
        );
    }

    fn require_scope_bits(&self, scope_bits: u32) {
        require!(scope_bits != 0 && scope_bits & !ALL_SCOPE_BITS == 0, "CAPABILITY_SCOPE_INVALID");
    }

    fn is_nonzero_32(&self, value: &ManagedByteArray<Self::Api, 32>) -> bool {
        value != &ManagedByteArray::default()
    }

    fn required_scope(&self, action_type: u16) -> u32 {
        match action_type {
            ACTION_POST_CREATE
            | ACTION_POST_EDIT
            | ACTION_LIKE
            | ACTION_UNLIKE
            | ACTION_COMMENT_CREATE
            | ACTION_COMMENT_EDIT
            | ACTION_COMMENT_TOMBSTONE
            | ACTION_FOLLOW
            | ACTION_UNFOLLOW
            | ACTION_SAVE
            | ACTION_SHARE => SCOPE_SOCIAL_PUBLIC,
            ACTION_LISTING_CREATE
            | ACTION_LISTING_UPDATE
            | ACTION_LISTING_RENEW
            | ACTION_LISTING_CLOSE
            | ACTION_OFFER => SCOPE_MARKET_PUBLIC,
            ACTION_REVIEW => SCOPE_REVIEW_PUBLIC,
            ACTION_PRIVATE => SCOPE_PRIVATE_COMMITMENT,
            _ => 0,
        }
    }

    fn require_pauser_or_owner(&self) {
        let caller = self.blockchain().get_caller();
        require!(
            caller == self.blockchain().get_owner_address() || caller == self.pauser().get(),
            "PAUSER_REQUIRED"
        );
    }

    #[event("ActionRecorded")]
    fn action_recorded_event(
        &self,
        #[indexed] actor_commitment: &ManagedByteArray<Self::Api, 32>,
        #[indexed] object_commitment: &ManagedByteArray<Self::Api, 32>,
        action_nonce: u64,
    );

    #[view(getChainId)]
    #[storage_mapper("chainId")]
    fn chain_id(&self) -> SingleValueMapper<ManagedBuffer>;

    #[view(getDomainSeparator)]
    #[storage_mapper("domainSeparator")]
    fn domain_separator(&self) -> SingleValueMapper<ManagedByteArray<Self::Api, 32>>;

    #[view(getPauser)]
    #[storage_mapper("pauser")]
    fn pauser(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(isRelayerAllowed)]
    #[storage_mapper("relayerAllowed")]
    fn relayer_allowed(&self, relayer: &ManagedAddress) -> SingleValueMapper<bool>;

    #[view(isRelayerPaused)]
    #[storage_mapper("relayerPaused")]
    fn relayer_paused(&self, relayer: &ManagedAddress) -> SingleValueMapper<bool>;

    #[view(isActionPaused)]
    #[storage_mapper("actionPaused")]
    fn action_paused(&self, action_type: u16) -> SingleValueMapper<bool>;

    #[storage_mapper("capability")]
    fn capability(
        &self,
        session_public_key: &ManagedByteArray<Self::Api, 32>,
    ) -> SingleValueMapper<SessionCapability<Self::Api>>;
}
