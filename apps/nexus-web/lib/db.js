import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIGURED_DATA_DIR = String(process.env.NEXUS_DATA_DIR ?? "").trim();
export const DATA_DIR = CONFIGURED_DATA_DIR ? resolve(CONFIGURED_DATA_DIR) : join(HERE, "..", "data");
export const DB_PATH = join(DATA_DIR, "nexus.sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verification_token TEXT,
  email_verification_expires_at INTEGER,
  password_reset_token TEXT,
  password_reset_expires_at INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  avatar TEXT,
  mvx_address TEXT,
  mvx_alias TEXT,
  linked_wallet TEXT,
  linked_wallet_changed_at INTEGER,
  google_sub TEXT UNIQUE,
  facebook_sub TEXT UNIQUE,
  xalias_sub TEXT UNIQUE,
  traffic_class TEXT NOT NULL DEFAULT 'HUMAN_ORGANIC',
  account_state TEXT NOT NULL DEFAULT 'active',
  chat_key_epoch INTEGER NOT NULL DEFAULT 1,
  onboarded_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS personas (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  age INTEGER,
  avatar TEXT,
  cover TEXT,
  -- What the hero shows above the identity: the cover photo, or the shelf of saved stories instead.
  -- 'cover' is the default, so a profile that never chose one reads exactly as it did before.
  cover_mode TEXT NOT NULL DEFAULT 'cover',
  -- The calendar date the owner chose (YYYY-MM-DD), or nothing. The age a reader sees is derived from it
  -- whenever the profile is read, so a year that passes is a year the profile already shows.
  birth_date TEXT,
  -- The order the owner put the five content tabs in, as a comma-separated list of tab ids. Empty means the
  -- product's own order, so a profile that never arranged them reads exactly as it did before.
  tabs_order TEXT NOT NULL DEFAULT '',
  identity_sigil TEXT NOT NULL DEFAULT 'STAR',
  sigil_color TEXT NOT NULL DEFAULT '#20e0d0',
  orbit_mood TEXT,
  orbit_place TEXT,
  orbit_now TEXT,
  orbit_fandom TEXT,
  orbit_quote TEXT,
  orbit_expires_at INTEGER,
  profile_kind TEXT NOT NULL DEFAULT 'personal',
  business_verification_status TEXT NOT NULL DEFAULT 'unverified',
  visibility TEXT NOT NULL DEFAULT 'friends',
  discoverability TEXT NOT NULL DEFAULT 'public',
  message_policy TEXT NOT NULL DEFAULT 'requests',
  interface_locale TEXT NOT NULL DEFAULT 'auto',
  content_languages TEXT NOT NULL DEFAULT '[]',
  region_code TEXT,
  near_enabled INTEGER NOT NULL DEFAULT 0,
  private_access_enabled INTEGER NOT NULL DEFAULT 0,
  private_access_price_cents INTEGER NOT NULL DEFAULT 100,
  private_access_month_price_cents INTEGER NOT NULL DEFAULT 2500,
  private_access_forever_price_cents INTEGER NOT NULL DEFAULT 10000,
  private_access_currency TEXT NOT NULL DEFAULT 'USD',
  private_access_duration_days INTEGER NOT NULL DEFAULT 30,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, persona)
);
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mnemonic',
  keystore TEXT NOT NULL,
  address_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, address)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  device_id TEXT NOT NULL DEFAULT 'unknown',
  device_label TEXT NOT NULL DEFAULT 'Unknown device',
  device_fingerprint TEXT,
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT UNIQUE NOT NULL,
  ext TEXT NOT NULL,
  mime TEXT NOT NULL,
  detected_mime TEXT,
  kind TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL DEFAULT 'social_post',
  scan_status TEXT NOT NULL DEFAULT 'quarantined_legacy',
  scan_reason TEXT NOT NULL DEFAULT 'not_inspected',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS media_upload_grants (
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  actor_persona TEXT NOT NULL DEFAULT 'social',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (media_id, user_id, purpose, actor_persona)
);
CREATE TABLE IF NOT EXISTS media_purge_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_hash TEXT NOT NULL,
  media_ext TEXT NOT NULL,
  media_size INTEGER NOT NULL,
  reason TEXT NOT NULL,
  purged_at INTEGER NOT NULL,
  receipt_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  purpose TEXT NOT NULL,
  mime TEXT NOT NULL,
  total_bytes INTEGER NOT NULL CHECK(total_bytes > 0),
  expected_sha256 TEXT,
  chunk_size INTEGER NOT NULL CHECK(chunk_size > 0),
  total_parts INTEGER NOT NULL CHECK(total_parts > 0),
  received_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated','uploading','assembling','completed','cancelled','failed','expired')),
  create_idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  completion_idempotency_key TEXT,
  cancellation_idempotency_key TEXT,
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  error_code TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, create_idempotency_key)
);
CREATE TABLE IF NOT EXISTS upload_parts (
  upload_id TEXT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK(part_number >= 0),
  size INTEGER NOT NULL CHECK(size > 0),
  sha256 TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(upload_id, part_number),
  UNIQUE(upload_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS outbox_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','published','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL DEFAULT (unixepoch()),
  published_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(aggregate_type, aggregate_id, event_type)
);
CREATE TABLE IF NOT EXISTS outbox_dead_letters (
  event_id INTEGER PRIMARY KEY REFERENCES outbox_events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mutation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  request_target TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),
  outcome_status INTEGER,
  response_status INTEGER,
  response_headers_json TEXT,
  response_body BLOB,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(user_id, actor_persona, idempotency_key)
);
CREATE TABLE IF NOT EXISTS action_intents (
  id TEXT PRIMARY KEY,
  mutation_request_id INTEGER NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_persona TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('HUMAN','AGENT','SYSTEM_TEST')),
  action_type TEXT NOT NULL,
  action_class TEXT NOT NULL CHECK(action_class IN ('PUBLIC_ACTION','PRIVATE_ACTION','FINANCIAL_ACTION','EPHEMERAL_EXCLUDED')),
  actor_commitment TEXT NOT NULL,
  object_commitment TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  idempotency_commitment TEXT NOT NULL,
  chain_status TEXT NOT NULL CHECK(chain_status IN ('LOCAL_ACCEPTED_CHAIN_DISABLED','EXCLUDED_SYNTHETIC','EPHEMERAL_EXCLUDED','CHAIN_PENDING','CONFIRMED','FAILED')),
  tx_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS action_reconciliation_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('PASS','MISMATCH')),
  completed_mutations INTEGER NOT NULL,
  action_intents INTEGER NOT NULL,
  mismatches INTEGER NOT NULL,
  pii_findings INTEGER NOT NULL,
  report_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  kind TEXT NOT NULL DEFAULT 'text',
  caption TEXT NOT NULL DEFAULT '',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'active',
  language TEXT,
  region_code TEXT,
  provenance TEXT NOT NULL DEFAULT 'user',
  media_edit_json TEXT,
  media_edit_hash TEXT,
  audio_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  audio_rights TEXT,
  audio_attribution TEXT NOT NULL DEFAULT '',
  content_commitment TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  edited_at INTEGER,
  archived_at INTEGER,
  withdrawn_at INTEGER,
  -- A post the owner put at the top of their profile, or nothing. Three at most: a pin is a decision
  -- about this profile, not a rank, and everything else in the archive stays chronological.
  pinned_at INTEGER,
  devnet_tx TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (follower_id, followee_id, persona)
);
CREATE TABLE IF NOT EXISTS post_versions (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  caption TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  content_commitment TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (post_id, version)
);
CREATE TABLE IF NOT EXISTS follow_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
  decided_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(requester_id, target_id, persona)
);
CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'like',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL DEFAULT 'social',
  parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  content_commitment TEXT,
  edited_at INTEGER,
  withdrawn_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  pinned_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS comment_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  content_commitment TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(comment_id, version)
);
CREATE TABLE IF NOT EXISTS post_reactions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, actor_persona, post_id)
);
CREATE TABLE IF NOT EXISTS comment_reactions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, actor_persona, comment_id)
);
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, actor_persona, post_id)
);
CREATE TABLE IF NOT EXISTS post_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'copy_link',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- A repost is read twice: on the reposter's profile and as a feed candidate for the people
-- who follow them, always newest first.
CREATE INDEX IF NOT EXISTS idx_post_shares_repost ON post_shares(channel, created_at);
-- A shared reply is the same kind of internal share a repost is: it lives on the sharer's profile
-- and keeps the reply, its author and its post. Nothing new is published, so nothing new needs
-- moderating and no view is counted twice.
CREATE TABLE IF NOT EXISTS comment_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'repost',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(comment_id, user_id, actor_persona, channel)
);
CREATE INDEX IF NOT EXISTS idx_comment_shares_reply ON comment_shares(comment_id, channel);
CREATE INDEX IF NOT EXISTS idx_comment_shares_profile ON comment_shares(user_id, actor_persona, channel, created_at);
-- A post can carry an ordered set of media. The posts.media_id column stays the cover (the first
-- one), so every existing reader keeps working while the carousel reads this table.
CREATE TABLE IF NOT EXISTS post_media (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, position)
);
CREATE INDEX IF NOT EXISTS idx_post_media_media ON post_media(media_id);
-- Hashtags and cashtags are extracted from the caption at write time, never guessed at read
-- time: a tag page answers with the posts that really carry the tag.
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('hashtag','cashtag')),
  tag TEXT NOT NULL,
  display TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, kind, tag)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_lookup ON post_tags(kind, tag, post_id);
-- Community notes: a reader can add context, other readers rate it, and the note only becomes
-- public when it is found helpful from more than one perspective. Nothing here changes the
-- visibility of the post itself: a note explains, it never hides.
CREATE TABLE IF NOT EXISTS community_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL DEFAULT 'post',
  subject_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_persona TEXT NOT NULL DEFAULT 'social',
  body TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'NEEDS_MORE_RATINGS' CHECK(status IN ('NEEDS_MORE_RATINGS','HELPFUL','NOT_HELPFUL','WITHDRAWN')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  published_at INTEGER,
  UNIQUE(author_id, author_persona, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_community_notes_subject ON community_notes(subject_type, subject_id, status);
CREATE TABLE IF NOT EXISTS community_note_ratings (
  note_id INTEGER NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_persona TEXT NOT NULL DEFAULT 'social',
  perspective TEXT NOT NULL,
  helpful INTEGER NOT NULL CHECK(helpful IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (note_id, rater_id, rater_persona)
);
CREATE INDEX IF NOT EXISTS idx_community_note_ratings_note ON community_note_ratings(note_id, perspective);
-- Append-only trail for every note action, so "why is this note here" always has an answer.
CREATE TABLE IF NOT EXISTS community_note_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id INTEGER,
  action TEXT NOT NULL,
  reason_code TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_community_note_events_note ON community_note_events(note_id, id);
CREATE TABLE IF NOT EXISTS social_impressions (
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_persona TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  impression_count INTEGER NOT NULL DEFAULT 1,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (viewer_id, viewer_persona, post_id)
);
CREATE TABLE IF NOT EXISTS social_feedback (
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_persona TEXT NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (viewer_id, viewer_persona, post_id, kind)
);
CREATE TABLE IF NOT EXISTS social_live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'creator' CHECK(category IN ('creator','music','gaming','talk','sport','education')),
  status TEXT NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','scheduled','live','ended','cancelled')),
  transport_status TEXT NOT NULL DEFAULT 'GATED_NO_SFU' CHECK(transport_status IN ('GATED_NO_SFU','READY_PRIVATE','VERIFIED_ACTIVE','FAILED')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','followers','friends','private')),
  language TEXT NOT NULL DEFAULT 'und',
  comments_enabled INTEGER NOT NULL DEFAULT 1,
  scheduled_at INTEGER,
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS social_live_attendance (
  session_id INTEGER NOT NULL REFERENCES social_live_sessions(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_heartbeat_at INTEGER NOT NULL DEFAULT (unixepoch()),
  left_at INTEGER,
  PRIMARY KEY (session_id, viewer_id)
);
CREATE TABLE IF NOT EXISTS social_live_competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('battle','championship')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','live','completed','cancelled')),
  scoring_policy TEXT NOT NULL DEFAULT 'ORGANIC_ENGAGEMENT_V1' CHECK(scoring_policy = 'ORGANIC_ENGAGEMENT_V1'),
  prize_policy TEXT NOT NULL DEFAULT 'NO_PRIZE_CONFIGURED',
  starts_at INTEGER,
  ends_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS social_live_competitors (
  competition_id INTEGER NOT NULL REFERENCES social_live_competitions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed INTEGER,
  organic_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'registered' CHECK(status IN ('invited','registered','active','eliminated','winner','withdrawn')),
  PRIMARY KEY (competition_id, user_id)
);
CREATE TABLE IF NOT EXISTS recommendation_state (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER,
  PRIMARY KEY (user_id, persona)
);
CREATE TABLE IF NOT EXISTS content_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  content_commitment TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  engine TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  labels_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  factual_status TEXT NOT NULL,
  visual_safety TEXT NOT NULL,
  assessment_hash TEXT UNIQUE NOT NULL,
  author_disputed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(subject_type, subject_id, content_commitment, policy_version)
);
-- Attribution ledger for openly licensed material admitted by the out-of-band
-- catalog ingest (scripts/content-ingest.mjs). The media table stores no licence
-- metadata, so provenance and credit live here.
CREATE TABLE IF NOT EXISTS content_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  hash TEXT,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  licence TEXT NOT NULL DEFAULT '',
  licence_url TEXT NOT NULL DEFAULT '',
  metadata_stripped INTEGER NOT NULL DEFAULT 0,
  ingest_marker TEXT NOT NULL DEFAULT 'seeded_catalog',
  retrieved_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_content_sources_media ON content_sources(media_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_marker ON content_sources(ingest_marker, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_persona TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  outcome TEXT NOT NULL DEFAULT 'AUTOMATED_TRIAGE_PENDING',
  reason_code TEXT NOT NULL DEFAULT 'REPORT_RECORDED_NO_AUTOMATIC_TAKEDOWN',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  UNIQUE(reporter_id, reporter_persona, subject_type, subject_id, category)
);
CREATE TABLE IF NOT EXISTS moderation_appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appellant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  content_commitment TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECORDED_AUTOMATED_ONLY',
  outcome TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS moderation_reconsiderations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  outcome TEXT NOT NULL,
  assessment_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, content_hash, policy_version)
);
CREATE TABLE IF NOT EXISTS moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  actor_kind TEXT NOT NULL,
  action TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  caption TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'followers',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER,
  content_commitment TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  archived_at INTEGER
);
CREATE TABLE IF NOT EXISTS story_views (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_persona TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (story_id, viewer_id, viewer_persona)
);
CREATE TABLE IF NOT EXISTS story_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id, persona, title)
);
CREATE TABLE IF NOT EXISTS story_highlight_items (
  highlight_id INTEGER NOT NULL REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (highlight_id, story_id)
);
CREATE INDEX IF NOT EXISTS idx_story_highlights_owner ON story_highlights(owner_id, persona, position, id);
CREATE INDEX IF NOT EXISTS idx_story_highlight_items_story ON story_highlight_items(story_id, highlight_id);
CREATE TABLE IF NOT EXISTS profile_blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocker_persona TEXT NOT NULL,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (blocker_id, blocker_persona, blocked_id)
);
-- Mute is weaker than block: the muted account keeps its relationships, its content
-- simply stops being a candidate for the muter. scope='topic' is reserved for a future
-- per-tag mute and is already modelled so the graph state matches the specification.
CREATE TABLE IF NOT EXISTS profile_mutes (
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_persona TEXT NOT NULL DEFAULT 'social',
  muted_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'account' CHECK(scope IN ('account','topic')),
  topic TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (owner_id, owner_persona, muted_id, scope, topic)
);
CREATE INDEX IF NOT EXISTS idx_profile_mutes_owner ON profile_mutes(owner_id, owner_persona);
-- Reader-initiated requests for context on a post ("Request Community Note"). A request
-- never changes visibility and never publishes anything: it only joins a queue that
-- contributors can pick up once the notes engine is enabled.
CREATE TABLE IF NOT EXISTS community_note_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_persona TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(requester_id, requester_persona, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_community_note_requests_subject ON community_note_requests(subject_type, subject_id);
-- Replies are comments, so replies need their own impression counter: the post table
-- cannot describe how many people read one answer inside a thread.
CREATE TABLE IF NOT EXISTS comment_impressions (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_persona TEXT NOT NULL,
  impression_count INTEGER NOT NULL DEFAULT 1,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (comment_id, viewer_id, viewer_persona)
);
CREATE TABLE IF NOT EXISTS saved_comments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, actor_persona, comment_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'direct',
  title TEXT,
  context_persona TEXT NOT NULL DEFAULT 'social',
  direct_key TEXT UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  request_recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  key_epoch INTEGER NOT NULL DEFAULT 1,
  key_epoch_changed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  state TEXT NOT NULL DEFAULT 'active',
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  history_start_message_id INTEGER NOT NULL DEFAULT 0,
  last_read_message_id INTEGER,
  archived_at INTEGER,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS message_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_persona TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL DEFAULT '',
  attachment_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  client_nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  encryption_mode TEXT NOT NULL DEFAULT 'plaintext_local',
  sender_device_id TEXT,
  device_set_commitment TEXT,
  key_epoch INTEGER,
  key_epoch_commitment TEXT,
  encrypted_request_commitment TEXT,
  expires_at INTEGER,
  expired_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  edited_at INTEGER,
  UNIQUE(sender_id, client_nonce)
);
CREATE TABLE IF NOT EXISTS message_receipts (
  message_id INTEGER NOT NULL REFERENCES message_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at INTEGER,
  read_at INTEGER,
  PRIMARY KEY (message_id, user_id)
);
CREATE TABLE IF NOT EXISTS chat_presence (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, persona)
);
CREATE TABLE IF NOT EXISTS chat_devices (
  device_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_algorithm TEXT NOT NULL DEFAULT 'ECDH-P256',
  public_jwk TEXT NOT NULL,
  device_kind TEXT NOT NULL DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'active',
  registered_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER,
  activation_token_hash TEXT,
  activation_expires_at INTEGER,
  activated_at INTEGER
);
CREATE TABLE IF NOT EXISTS message_ciphertext_envelopes (
  message_id INTEGER NOT NULL REFERENCES message_items(id) ON DELETE CASCADE,
  recipient_device_id TEXT NOT NULL REFERENCES chat_devices(device_id) ON DELETE RESTRICT,
  sender_device_id TEXT NOT NULL REFERENCES chat_devices(device_id) ON DELETE RESTRICT,
  iv_b64 TEXT NOT NULL,
  ciphertext_b64 TEXT NOT NULL,
  aad_sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (message_id, recipient_device_id)
);
CREATE TABLE IF NOT EXISTS message_shared_ciphertexts (
  message_id INTEGER PRIMARY KEY REFERENCES message_items(id) ON DELETE CASCADE,
  iv_b64 TEXT NOT NULL,
  ciphertext_b64 TEXT NOT NULL,
  aad_sha256 TEXT NOT NULL,
  ciphertext_sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS conversation_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS conversation_calls (
  call_id TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing',
  expires_at INTEGER NOT NULL,
  answered_at INTEGER,
  ended_at INTEGER,
  ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS call_participant_leases (
  call_id TEXT NOT NULL REFERENCES conversation_calls(call_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lease_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (call_id, user_id)
);
CREATE TABLE IF NOT EXISTS call_signal_replay_guard (
  call_id TEXT NOT NULL REFERENCES conversation_calls(call_id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_nonce TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK(signal_type IN ('offer','answer','ice')),
  payload_sha256 TEXT NOT NULL,
  delivery_claim_until INTEGER,
  delivered_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (call_id, sender_id, signal_nonce)
);
CREATE TABLE IF NOT EXISTS native_auth_consumptions (
  token_sha256 TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  address TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  persona TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  session_token_ciphertext BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (purpose, idempotency_key)
);
CREATE TABLE IF NOT EXISTS email_signup_challenges (
  nonce_sha256 TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_mac TEXT NOT NULL,
  email_sha256 TEXT NOT NULL,
  nonce_ciphertext BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  consumed_command_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_auth_commands (
  purpose TEXT NOT NULL CHECK(purpose IN ('signup','login','verify')),
  idempotency_key TEXT NOT NULL,
  request_mac TEXT NOT NULL,
  subject_sha256 TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  session_token_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  session_token_ciphertext BLOB NOT NULL,
  response_ciphertext BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (purpose, idempotency_key)
);
CREATE TABLE IF NOT EXISTS auth_logout_commands (
  idempotency_key TEXT PRIMARY KEY,
  credential_set_sha256 TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'market',
  title TEXT NOT NULL,
  price TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  devnet_tx TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS work_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'open' CHECK(availability IN ('open','not_looking','hiring')),
  skills_json TEXT NOT NULL DEFAULT '[]',
  experience_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS business_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_persona TEXT NOT NULL DEFAULT 'work' CHECK(owner_persona = 'work'),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('business','hair_salon','beauty')),
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','synthetic_demo')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_page_id INTEGER REFERENCES business_pages(id) ON DELETE SET NULL,
  persona TEXT NOT NULL DEFAULT 'work' CHECK(persona = 'work'),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  workplace_type TEXT NOT NULL DEFAULT 'onsite' CHECK(workplace_type IN ('onsite','hybrid','remote')),
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK(employment_type IN ('full_time','part_time','contract','internship')),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_persona TEXT NOT NULL DEFAULT 'work' CHECK(applicant_persona = 'work'),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','shortlisted','rejected','withdrawn')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(job_id, applicant_id)
);
CREATE TABLE IF NOT EXISTS business_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES business_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('haircut','hair_styling','beauty','consultation')),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 10 AND 480),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 100000000),
  deposit_cents INTEGER NOT NULL DEFAULT 0 CHECK(deposit_cents BETWEEN 0 AND price_cents),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS appointment_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','closed')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(service_id, starts_at),
  CHECK(ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL UNIQUE REFERENCES appointment_slots(id) ON DELETE RESTRICT,
  service_id INTEGER NOT NULL REFERENCES business_services(id) ON DELETE RESTRICT,
  page_id INTEGER NOT NULL REFERENCES business_pages(id) ON DELETE RESTRICT,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_persona TEXT NOT NULL DEFAULT 'work' CHECK(customer_persona = 'work'),
  quoted_deposit_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  status TEXT NOT NULL DEFAULT 'confirmed_local_no_payment' CHECK(status IN ('confirmed_local_no_payment','completed','cancelled')),
  commitment TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS market_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_persona TEXT NOT NULL DEFAULT 'market' CHECK(seller_persona = 'market'),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('electronics','home','fashion','vehicles','sports','collectibles','services','other')),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 1000000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  sale_mode TEXT NOT NULL CHECK(sale_mode IN ('free_classified','protected_checkout')),
  discovery_scope TEXT NOT NULL CHECK(discovery_scope IN ('local','global')),
  public_location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','sold','withdrawn')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS market_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_persona TEXT NOT NULL DEFAULT 'market' CHECK(buyer_persona = 'market'),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 100 AND 1000000000),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(listing_id, buyer_id)
);
CREATE TABLE IF NOT EXISTS market_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL UNIQUE REFERENCES market_listings(id) ON DELETE RESTRICT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  offer_id INTEGER UNIQUE REFERENCES market_offers(id) ON DELETE SET NULL,
  quoted_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  sale_mode TEXT NOT NULL CHECK(sale_mode IN ('free_classified','protected_checkout')),
  status TEXT NOT NULL DEFAULT 'local_unfunded' CHECK(status IN ('local_unfunded','fulfilled','completed','cancelled')),
  commitment TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS stay_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_persona TEXT NOT NULL DEFAULT 'travel' CHECK(host_persona = 'travel'),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  public_location TEXT NOT NULL,
  private_address TEXT NOT NULL,
  nightly_cents INTEGER NOT NULL CHECK(nightly_cents BETWEEN 100 AND 1000000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  max_guests INTEGER NOT NULL CHECK(max_guests BETWEEN 1 AND 32),
  cancellation_policy TEXT NOT NULL CHECK(cancellation_policy IN ('flexible','moderate','strict')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS stay_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES stay_listings(id) ON DELETE RESTRICT,
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  guest_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  guest_persona TEXT NOT NULL DEFAULT 'travel' CHECK(guest_persona = 'travel'),
  check_in INTEGER NOT NULL,
  check_out INTEGER NOT NULL,
  guest_count INTEGER NOT NULL CHECK(guest_count BETWEEN 1 AND 32),
  nightly_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  cancellation_policy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed_local_no_payment' CHECK(status IN ('confirmed_local_no_payment','completed','cancelled')),
  commitment TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(check_out > check_in)
);
CREATE TABLE IF NOT EXISTS ride_driver_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'travel' CHECK(persona = 'travel'),
  vehicle_label TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 8),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','synthetic_demo')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','available','on_trip','suspended')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS ride_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_persona TEXT NOT NULL DEFAULT 'travel' CHECK(rider_persona = 'travel'),
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pickup_zone TEXT NOT NULL,
  dropoff_zone TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 8),
  quoted_fare_cents INTEGER NOT NULL CHECK(quoted_fare_cents BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  trip_pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','matched','in_trip','completed','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  commitment TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS dating_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'dating' CHECK(persona = 'dating'),
  display_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK(age BETWEEN 18 AND 99),
  gender TEXT NOT NULL CHECK(gender IN ('woman','man','nonbinary','self_described','private')),
  seeking_json TEXT NOT NULL,
  intention TEXT NOT NULL CHECK(intention IN ('long_term','partnership','slow_dating','casual','friendship','non_monogamy','exploring')),
  interests_json TEXT NOT NULL DEFAULT '[]',
  bio TEXT NOT NULL DEFAULT '',
  city_bucket TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'paused' CHECK(visibility IN ('discoverable','paused','private')),
  adult_claimed INTEGER NOT NULL DEFAULT 1 CHECK(adult_claimed = 1),
  photo_verification TEXT NOT NULL DEFAULT 'unverified' CHECK(photo_verification IN ('unverified','synthetic_demo')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS dating_decisions (
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL DEFAULT 'dating' CHECK(actor_persona = 'dating'),
  action TEXT NOT NULL CHECK(action IN ('pass','like')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (actor_id, target_id),
  CHECK(actor_id <> target_id)
);
CREATE TABLE IF NOT EXISTS dating_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_low_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER UNIQUE REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','unmatched','blocked')),
  ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  matched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_low_id, user_high_id),
  CHECK(user_low_id < user_high_id)
);
CREATE TABLE IF NOT EXISTS dating_meet_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES dating_matches(id) ON DELETE CASCADE,
  proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_bucket TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','completed','cancelled')),
  low_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(low_confirmed IN (0,1)),
  high_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(high_confirmed IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS watch_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused','suspended')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS watch_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES watch_channels(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 3 AND 3600),
  audience TEXT NOT NULL DEFAULT 'public' CHECK(audience IN ('public','subscribers','private')),
  age_rating TEXT NOT NULL DEFAULT 'general' CHECK(age_rating IN ('general','teen','adult')),
  rights_state TEXT NOT NULL DEFAULT 'self_declared' CHECK(rights_state IN ('self_declared','cleared','blocked')),
  moderation_state TEXT NOT NULL DEFAULT 'approved_local_demo' CHECK(moderation_state IN ('pending','approved_local_demo','approved','rejected')),
  state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','withdrawn','blocked')),
  captions_language TEXT NOT NULL DEFAULT 'und',
  published_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS watch_subscriptions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_persona TEXT NOT NULL DEFAULT 'social' CHECK(actor_persona = 'social'),
  channel_id INTEGER NOT NULL REFERENCES watch_channels(id) ON DELETE CASCADE,
  notification_mode TEXT NOT NULL DEFAULT 'personalized' CHECK(notification_mode IN ('none','personalized','all')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, channel_id)
);
CREATE TABLE IF NOT EXISTS watch_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  kind TEXT NOT NULL DEFAULT 'standard' CHECK(kind IN ('standard','watch_later')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id, kind, title)
);
CREATE TABLE IF NOT EXISTS watch_playlist_items (
  playlist_id INTEGER NOT NULL REFERENCES watch_playlists(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES watch_videos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (playlist_id, video_id),
  UNIQUE(playlist_id, position)
);
CREATE TABLE IF NOT EXISTS watch_progress (
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES watch_videos(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0 CHECK(position_seconds >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (viewer_id, video_id)
);
CREATE TABLE IF NOT EXISTS family_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adult_account_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_state TEXT NOT NULL DEFAULT 'LOCAL_DEMO_UNVERIFIED' CHECK(authority_state IN ('LOCAL_DEMO_UNVERIFIED','VERIFIED','REVOKED')),
  consent_version TEXT NOT NULL DEFAULT 'LOCAL-DEMO-V1',
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(adult_account_id)
);
CREATE TABLE IF NOT EXISTS kids_children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_group_id INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK(age_band IN ('preschool','6_8','9_12','13_15','16_17')),
  locale TEXT NOT NULL DEFAULT 'en',
  avatar_code TEXT NOT NULL DEFAULT 'orbit',
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused','deleted')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS kids_parent_controls (
  child_id INTEGER PRIMARY KEY REFERENCES kids_children(id) ON DELETE CASCADE,
  daily_minutes INTEGER NOT NULL DEFAULT 45 CHECK(daily_minutes BETWEEN 5 AND 240),
  autoplay INTEGER NOT NULL DEFAULT 0 CHECK(autoplay = 0),
  search_enabled INTEGER NOT NULL DEFAULT 1 CHECK(search_enabled IN (0,1)),
  live_enabled INTEGER NOT NULL DEFAULT 0 CHECK(live_enabled IN (0,1)),
  approved_topics_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS kids_sessions (
  token_hash TEXT PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES kids_children(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS kids_catalog_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES watch_videos(id) ON DELETE CASCADE,
  age_band TEXT NOT NULL CHECK(age_band IN ('preschool','6_8','9_12','13_15','16_17')),
  locale TEXT NOT NULL,
  topic TEXT NOT NULL,
  editorial_state TEXT NOT NULL DEFAULT 'approved_local_demo' CHECK(editorial_state IN ('approved_local_demo','approved','blocked')),
  valid_from INTEGER NOT NULL DEFAULT (unixepoch()),
  valid_to INTEGER,
  UNIQUE(video_id, age_band, locale)
);
CREATE TABLE IF NOT EXISTS kids_history (
  child_id INTEGER NOT NULL REFERENCES kids_children(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES watch_videos(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK(progress_seconds >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (child_id, video_id)
);
CREATE TABLE IF NOT EXISTS kids_feedback (
  child_id INTEGER NOT NULL REFERENCES kids_children(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES watch_videos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('LOVE','HAHA','WOW','SHOW_LESS')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (child_id, video_id, kind)
);
CREATE TABLE IF NOT EXISTS kids_mutation_requests (
  child_id INTEGER NOT NULL REFERENCES kids_children(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (child_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS music_artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  rights_verification TEXT NOT NULL DEFAULT 'self_declared_local' CHECK(rights_verification IN ('self_declared_local','verified','suspended')),
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused','suspended')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id)
);
CREATE TABLE IF NOT EXISTS music_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER NOT NULL REFERENCES music_artists(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 3 AND 3600),
  rights_basis TEXT NOT NULL CHECK(rights_basis IN ('original','public_domain','creative_commons','direct_license')),
  attribution TEXT NOT NULL DEFAULT '',
  explicit INTEGER NOT NULL DEFAULT 0 CHECK(explicit IN (0,1)),
  territory TEXT NOT NULL DEFAULT 'LOCAL_DEMO',
  availability_state TEXT NOT NULL DEFAULT 'draft' CHECK(availability_state IN ('draft','published_local_demo','published','hold','withdrawn')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  published_at INTEGER
);
CREATE TABLE IF NOT EXISTS music_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id, title)
);
CREATE TABLE IF NOT EXISTS music_playlist_items (
  playlist_id INTEGER NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (playlist_id, track_id),
  UNIQUE(playlist_id, position)
);
CREATE TABLE IF NOT EXISTS music_library (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, track_id)
);
CREATE TABLE IF NOT EXISTS music_play_starts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  fraud_state TEXT NOT NULL DEFAULT 'unqualified' CHECK(fraud_state IN ('unqualified','qualified_local_demo','invalid')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS grow_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL CHECK(vertical IN ('nutrition','sport','learn')),
  format TEXT NOT NULL DEFAULT 'article' CHECK(format IN ('article','video','program','course_intro')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_note TEXT NOT NULL,
  medical_class TEXT NOT NULL CHECK(medical_class IN ('W0','W1')),
  editorial_state TEXT NOT NULL DEFAULT 'approved_local_demo' CHECK(editorial_state IN ('draft','approved_local_demo','approved','rejected')),
  reviewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS grow_workout_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES grow_content(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  access_minutes INTEGER NOT NULL CHECK(access_minutes BETWEEN 15 AND 480),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS grow_workout_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES grow_workout_offers(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quoted_price_cents INTEGER NOT NULL,
  nexus_fee_cents INTEGER NOT NULL,
  provider_share_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  status TEXT NOT NULL DEFAULT 'demo_unpaid' CHECK(status IN ('demo_unpaid','cancelled','completed_local_demo')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(offer_id, buyer_id)
);
CREATE TABLE IF NOT EXISTS grow_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents BETWEEN 0 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  accreditation_claim TEXT NOT NULL DEFAULT 'NOT_ACCREDITED' CHECK(accreditation_claim IN ('NOT_ACCREDITED','VERIFIED_EXTERNAL')),
  status TEXT NOT NULL DEFAULT 'published_local_demo' CHECK(status IN ('draft','published_local_demo','published','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS grow_enrollments (
  course_id INTEGER NOT NULL REFERENCES grow_courses(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'local_enrolled_no_payment' CHECK(status IN ('local_enrolled_no_payment','active','completed','cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (course_id, learner_id)
);
CREATE TABLE IF NOT EXISTS grow_private_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL CHECK(vertical IN ('nutrition','sport','learn')),
  kind TEXT NOT NULL CHECK(kind IN ('goal','journal','note','progress')),
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  commitment TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id, commitment)
);
CREATE TABLE IF NOT EXISTS pay_resolution_receipts (
  id TEXT PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  alias TEXT NOT NULL,
  alias_version TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  network TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  token_decimals INTEGER NOT NULL CHECK(token_decimals BETWEEN 0 AND 18),
  atomic_amount TEXT NOT NULL,
  display_amount TEXT NOT NULL,
  purpose_hash TEXT NOT NULL,
  receipt_hash TEXT NOT NULL UNIQUE,
  integrity_mode TEXT NOT NULL DEFAULT 'LOCAL_COMMITMENT_ONLY' CHECK(integrity_mode IN ('LOCAL_COMMITMENT_ONLY','SIGNED_PRODUCTION')),
  status TEXT NOT NULL DEFAULT 'preview_active' CHECK(status IN ('preview_active','consumed_local_unsigned','invalidated','expired')),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(sender_id <> recipient_id),
  CHECK(expires_at > issued_at)
);
CREATE TABLE IF NOT EXISTS pay_transfer_intents (
  id TEXT PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolution_receipt_id TEXT NOT NULL UNIQUE REFERENCES pay_resolution_receipts(id) ON DELETE RESTRICT,
  sender_address TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  network TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  atomic_amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'local_unsigned' CHECK(status IN ('local_unsigned','submitted','ordered','executed_success','failed_terminal','cancelled')),
  tx_hash TEXT,
  privacy_mode TEXT NOT NULL DEFAULT 'OWNER_ONLY' CHECK(privacy_mode = 'OWNER_ONLY'),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(sender_id <> recipient_id)
);
CREATE TABLE IF NOT EXISTS creator_support_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('tip','membership')),
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  interval_days INTEGER CHECK(interval_days IS NULL OR interval_days BETWEEN 1 AND 366),
  split_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS creator_support_intents (
  id TEXT PRIMARY KEY,
  supporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES creator_support_products(id) ON DELETE RESTRICT,
  quoted_cents INTEGER NOT NULL,
  gross_cents INTEGER NOT NULL,
  creator_share_cents INTEGER NOT NULL,
  nexus_fee_cents INTEGER NOT NULL,
  safety_reserve_cents INTEGER NOT NULL,
  infra_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TEST-USDC' CHECK(currency = 'TEST-USDC'),
  status TEXT NOT NULL CHECK(status IN ('demo_unpaid','excluded_synthetic','settled','refunded','reversed')),
  payout_eligible INTEGER NOT NULL DEFAULT 0 CHECK(payout_eligible IN (0,1)),
  split_version TEXT NOT NULL,
  commitment TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(supporter_id <> creator_id),
  CHECK(gross_cents = creator_share_cents + nexus_fee_cents + safety_reserve_cents + infra_cents)
);
CREATE TABLE IF NOT EXISTS creator_reward_epochs (
  epoch_id TEXT PRIMARY KEY,
  eligible_net_revenue_cents INTEGER NOT NULL DEFAULT 0 CHECK(eligible_net_revenue_cents >= 0),
  pool_cap_cents INTEGER NOT NULL DEFAULT 0 CHECK(pool_cap_cents >= 0),
  funded_pool_cents INTEGER NOT NULL DEFAULT 0 CHECK(funded_pool_cents >= 0),
  allocation_root TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'local_zero_pool' CHECK(state IN ('local_zero_pool','funded','closed')),
  config_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(funded_pool_cents <= pool_cap_cents)
);
CREATE TABLE IF NOT EXISTS nexus_node_manifests (
  node_id TEXT PRIMARY KEY,
  operator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  owner_cluster_hash TEXT NOT NULL,
  trust_class TEXT NOT NULL CHECK(trust_class IN ('T0','T1','T2','T3','GENESIS')),
  protocol_version TEXT NOT NULL,
  service_roles_json TEXT NOT NULL,
  capability_hash TEXT NOT NULL,
  endpoint_mode TEXT NOT NULL DEFAULT 'LOCAL_NO_ADVERTISEMENT' CHECK(endpoint_mode IN ('LOCAL_NO_ADVERTISEMENT','PUBLIC_VERIFIED')),
  state TEXT NOT NULL DEFAULT 'candidate' CHECK(state IN ('candidate','active_local','active_verified','suspended','exited')),
  last_heartbeat_at INTEGER,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS nexus_node_event_commitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL REFERENCES nexus_node_manifests(node_id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK(sequence >= 1),
  event_count INTEGER NOT NULL CHECK(event_count >= 0),
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  previous_commitment TEXT NOT NULL,
  root_hash TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'local_single_node' CHECK(verification_state IN ('local_single_node','quorum_verified','rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(node_id, sequence),
  CHECK(range_end >= range_start)
);
CREATE TABLE IF NOT EXISTS nexus_node_checkpoints (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nexus_node_manifests(node_id) ON DELETE RESTRICT,
  shard_key TEXT NOT NULL,
  event_from INTEGER NOT NULL,
  event_to INTEGER NOT NULL,
  reducer_version TEXT NOT NULL,
  state_root TEXT NOT NULL,
  previous_checkpoint_hash TEXT NOT NULL,
  backup_receipt_hash TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL UNIQUE,
  verification_state TEXT NOT NULL DEFAULT 'local_single_node' CHECK(verification_state IN ('local_single_node','replica_verified','quorum_verified','rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(event_to >= event_from)
);
INSERT OR IGNORE INTO nexus_node_manifests
  (node_id, operator_user_id, owner_cluster_hash, trust_class, protocol_version,
   service_roles_json, capability_hash, endpoint_mode, state, last_heartbeat_at)
VALUES
  ('nexus-genesis-local', NULL,
   '95c82d788adbdda5523ba064c960ef5a27de913b638a17762b248b87e87f8264',
   'GENESIS', '1.0.0',
   '["gateway","event_log","storage","index","jobs"]',
   'bc591da7889e93f31f7c54c217b377d0387798966f318bf311ef54909b8a0b97',
   'LOCAL_NO_ADVERTISEMENT', 'active_local', unixepoch());
CREATE TABLE IF NOT EXISTS transaction_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vertical TEXT NOT NULL CHECK(vertical IN ('market','stay','ride')),
  subject_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 0 CHECK(visible IN (0,1)),
  reveal_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(vertical, subject_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_open_created ON jobs(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON job_applications(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_pages_category ON business_pages(status, category, location);
CREATE INDEX IF NOT EXISTS idx_business_services_page ON business_services(page_id, status, id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_service ON appointment_slots(service_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_page ON appointments(page_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_discovery ON market_listings(status, discovery_scope, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_offers_listing ON market_offers(listing_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_offers_buyer ON market_offers(buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_orders_party ON market_orders(buyer_id, seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stay_listings_discovery ON stay_listings(status, public_location, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_overlap ON stay_bookings(listing_id, status, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_stay_bookings_party ON stay_bookings(guest_id, host_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_drivers_dispatch ON ride_driver_profiles(status, verification_status, seats);
CREATE INDEX IF NOT EXISTS idx_ride_requests_dispatch ON ride_requests(status, requested_at, seats, created_at);
CREATE INDEX IF NOT EXISTS idx_ride_requests_party ON ride_requests(rider_id, driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dating_profiles_discovery ON dating_profiles(visibility, intention, city_bucket, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dating_decisions_target ON dating_decisions(target_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dating_matches_party ON dating_matches(user_low_id, user_high_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dating_meet_plans_match ON dating_meet_plans(match_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_watch_channels_owner ON watch_channels(owner_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_videos_home ON watch_videos(state, moderation_state, rights_state, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_videos_channel ON watch_videos(channel_id, state, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_subscriptions_user ON watch_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_progress_viewer ON watch_progress(viewer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_groups_adult ON family_groups(adult_account_id, state);
CREATE INDEX IF NOT EXISTS idx_kids_children_family ON kids_children(family_group_id, state);
CREATE INDEX IF NOT EXISTS idx_kids_sessions_expiry ON kids_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_kids_catalog_eligibility ON kids_catalog_entries(age_band, locale, editorial_state, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_kids_history_child ON kids_history(child_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_mutations_expiry ON kids_mutation_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_music_artists_owner ON music_artists(owner_id, state);
CREATE INDEX IF NOT EXISTS idx_music_tracks_catalog ON music_tracks(availability_state, explicit, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_tracks_artist ON music_tracks(artist_id, availability_state, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_library_user ON music_library(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_play_starts_track ON music_play_starts(track_id, fraud_state, created_at);
CREATE INDEX IF NOT EXISTS idx_grow_content_discovery ON grow_content(vertical, editorial_state, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_grow_workout_offers ON grow_workout_offers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grow_workout_reservations_buyer ON grow_workout_reservations(buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grow_courses_discovery ON grow_courses(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grow_enrollments_learner ON grow_enrollments(learner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_grow_private_owner_expiry ON grow_private_entries(owner_id, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_receipts_sender_expiry ON pay_resolution_receipts(sender_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pay_intents_sender_created ON pay_transfer_intents(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_intents_recipient_created ON pay_transfer_intents(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_products_catalog ON creator_support_products(creator_id, status, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_support_creator ON creator_support_intents(creator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_support_supporter ON creator_support_intents(supporter_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_manifests_state ON nexus_node_manifests(state, trust_class, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_commitments_node ON nexus_node_event_commitments(node_id, sequence DESC);
CREATE INDEX IF NOT EXISTS idx_node_checkpoints_node ON nexus_node_checkpoints(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_public ON transaction_reviews(vertical, reviewee_id, visible, created_at DESC);
CREATE TABLE IF NOT EXISTS private_profile_access_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  owner_share_cents INTEGER NOT NULL,
  nexus_share_cents INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo_unpaid',
  privacy_mode TEXT NOT NULL DEFAULT 'OWNER_ANONYMOUS',
  receipt_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS devnet_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  explorer_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'social',
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  actor_count INTEGER NOT NULL DEFAULT 1,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  type TEXT NOT NULL,
  in_app INTEGER NOT NULL DEFAULT 1,
  push INTEGER NOT NULL DEFAULT 0,
  email INTEGER NOT NULL DEFAULT 0,
  preview TEXT NOT NULL DEFAULT 'generic',
  quiet_start TEXT,
  quiet_end TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, persona, type)
);
CREATE TABLE IF NOT EXISTS maintenance_receipts (
  operation_id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  historical_target_count INTEGER NOT NULL,
  observed_remaining INTEGER NOT NULL,
  execution_tool_sha256 TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operational_controls (
  control_key TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused')),
  incident_id TEXT,
  reason_code TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS operational_incidents (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK(severity IN ('SEV0','SEV1','SEV2','SEV3')),
  state TEXT NOT NULL CHECK(state IN ('open','contained','resolved')),
  reason_code TEXT NOT NULL,
  commander_hash TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  contained_at INTEGER,
  resolved_at INTEGER,
  evidence_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operational_control_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL REFERENCES operational_incidents(id) ON DELETE RESTRICT,
  control_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('pause','resume')),
  approval_id TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  checker_hash TEXT,
  reason_code TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_export_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','expired','revoked')),
  manifest_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  subject_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('requested','blocked_legal_hold','cancelled','purging','purged')),
  requested_at INTEGER NOT NULL,
  execute_after INTEGER NOT NULL,
  cancelled_at INTEGER,
  purged_at INTEGER,
  media_manifest_json TEXT,
  purge_receipt_hash TEXT,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS account_legal_holds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS account_purge_tombstones (
  subject_hash TEXT PRIMARY KEY,
  deletion_request_id TEXT NOT NULL UNIQUE,
  manifest_hash TEXT NOT NULL,
  purged_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id, persona);
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests(target_id, persona, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON follow_requests(requester_id, persona, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participant_user ON conversation_participants(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_message_items_conversation ON message_items(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user ON message_receipts(user_id, read_at, delivered_at);
CREATE INDEX IF NOT EXISTS idx_chat_devices_user ON chat_devices(user_id, status, device_id);
CREATE INDEX IF NOT EXISTS idx_message_envelopes_recipient ON message_ciphertext_envelopes(recipient_device_id, message_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_expiry ON typing_indicators(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversation_meetings_conversation ON conversation_meetings(conversation_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_conversation_calls_conversation ON conversation_calls(conversation_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_calls_expiry ON conversation_calls(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_call_participant_leases_expiry ON call_participant_leases(lease_until, call_id);
CREATE INDEX IF NOT EXISTS idx_call_signal_guard_expiry ON call_signal_replay_guard(expires_at);
CREATE INDEX IF NOT EXISTS idx_native_auth_consumptions_expiry ON native_auth_consumptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_signup_challenges_expiry ON email_signup_challenges(expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_email_auth_commands_expiry ON email_auth_commands(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_logout_commands_expiry ON auth_logout_commands(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_live_open_host ON social_live_sessions(host_id) WHERE status IN ('preview','scheduled','live');
CREATE INDEX IF NOT EXISTS idx_social_live_discovery ON social_live_sessions(status, transport_status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_live_attendance_active ON social_live_attendance(session_id, left_at, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_social_live_competitions_status ON social_live_competitions(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_private_access_viewer ON private_profile_access_receipts(viewer_id, persona, expires_at);
CREATE INDEX IF NOT EXISTS idx_private_access_owner ON private_profile_access_receipts(owner_id, persona, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_owner_status ON upload_sessions(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry ON upload_sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_parts_upload ON upload_parts(upload_id, part_number);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, available_at, id);
CREATE INDEX IF NOT EXISTS idx_mutation_requests_expiry ON mutation_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_action_intents_chain_status ON action_intents(chain_status, created_at);
CREATE INDEX IF NOT EXISTS idx_action_intents_user ON action_intents(user_id, actor_persona, created_at);
CREATE INDEX IF NOT EXISTS idx_account_exports_owner_expiry ON account_export_requests(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_account_deletions_due ON account_deletion_requests(state, execute_after);
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_active_user ON account_deletion_requests(user_id) WHERE state IN ('requested','blocked_legal_hold','purging');
CREATE INDEX IF NOT EXISTS idx_account_legal_holds_user ON account_legal_holds(user_id, active, expires_at);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_state ON operational_incidents(state, severity, opened_at);
CREATE INDEX IF NOT EXISTS idx_operational_events_incident ON operational_control_events(incident_id, id);
`;

// Add columns missing from databases created before the auth/hardening schema.
function migrateWalletsTable(db) {
  const cols = db.prepare(`PRAGMA table_info(wallets)`).all().map((c) => c.name);
  if (!cols.length) return;
}

function migrateUsersTable(db) {
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  };
  add("email", "email TEXT");
  add("email_verified", "email_verified INTEGER NOT NULL DEFAULT 0");
  add("email_verification_token", "email_verification_token TEXT");
  add("email_verification_expires_at", "email_verification_expires_at INTEGER");
  add("password_reset_token", "password_reset_token TEXT");
  add("password_reset_expires_at", "password_reset_expires_at INTEGER");
  add("google_sub", "google_sub TEXT");
  add("facebook_sub", "facebook_sub TEXT");
  add("xalias_sub", "xalias_sub TEXT");
  add("linked_wallet", "linked_wallet TEXT");
  add("linked_wallet_changed_at", "linked_wallet_changed_at INTEGER");
  add("traffic_class", "traffic_class TEXT NOT NULL DEFAULT 'HUMAN_ORGANIC'");
  add("account_state", "account_state TEXT NOT NULL DEFAULT 'active'");
  add("chat_key_epoch", "chat_key_epoch INTEGER NOT NULL DEFAULT 1");
  // Identity onboarding: the person either chose their handle (stamped at signup) or completed the
  // first-run flow once. A null value on a generated handle is what the flow keys on.
  add("onboarded_at", "onboarded_at INTEGER");
  db.exec(`UPDATE users SET traffic_class = 'SYSTEM_TEST' WHERE handle LIKE 'systemtest_%' OR display_name LIKE 'SYSTEM_TEST %'`);

  // Earlier local builds stored temporary email bearers verbatim. Hash them in
  // place so a database read no longer reveals an operational token.
  for (const column of ["email_verification_token", "password_reset_token"]) {
    const rows = db.prepare(`SELECT id, ${column} token FROM users WHERE ${column} IS NOT NULL`).all();
    const update = db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`);
    for (const row of rows) {
      if (!/^[a-f0-9]{64}$/i.test(String(row.token))) {
        update.run(createHash("sha256").update(String(row.token)).digest("hex"), row.id);
      }
    }
  }
}

function addMissingColumns(db, tableName, definitions) {
  const cols = new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!cols.has(name)) db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export function migrateNotificationSchema(db) {
  addMissingColumns(db, "notifications", {
    persona: "persona TEXT NOT NULL DEFAULT 'social'",
    sensitive: "sensitive INTEGER NOT NULL DEFAULT 0",
    actor_count: "actor_count INTEGER NOT NULL DEFAULT 1",
  });
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      persona TEXT NOT NULL,
      type TEXT NOT NULL,
      in_app INTEGER NOT NULL DEFAULT 1,
      push INTEGER NOT NULL DEFAULT 0,
      email INTEGER NOT NULL DEFAULT 0,
      preview TEXT NOT NULL DEFAULT 'generic',
      quiet_start TEXT,
      quiet_end TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, persona, type)
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user_persona ON notifications(user_id, persona, read, created_at DESC);
  `);
}

export function migrateSessionSchema(db) {
  addMissingColumns(db, "sessions", {
    device_id: "device_id TEXT NOT NULL DEFAULT 'unknown'",
    device_label: "device_label TEXT NOT NULL DEFAULT 'Unknown device'",
    device_fingerprint: "device_fingerprint TEXT",
    last_seen_at: "last_seen_at INTEGER NOT NULL DEFAULT 0",
  });
  db.exec(`
    UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at = 0;
    CREATE INDEX IF NOT EXISTS idx_sessions_user_device ON sessions(user_id, device_id, expires_at DESC);
  `);
}

export function migrateMediaUploadGrantsKey(db, { beforeCommit = null } = {}) {
  const columns = db.prepare(`PRAGMA table_info(media_upload_grants)`).all();
  const names = new Set(columns.map((column) => column.name));
  const required = ["media_id", "user_id", "purpose", "actor_persona", "created_at"];
  if (!required.every((name) => names.has(name))) throw new Error("MEDIA_GRANT_SCHEMA_UNSUPPORTED");
  const primaryKey = columns.filter((column) => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((column) => column.name);
  const expected = ["media_id", "user_id", "purpose", "actor_persona"];
  if (primaryKey.length === expected.length && primaryKey.every((name, index) => name === expected[index])) {
    return { migrated: false, primaryKey };
  }
  const supportedLegacy = ["media_id", "user_id", "purpose"];
  if (primaryKey.length !== supportedLegacy.length || !primaryKey.every((name, index) => name === supportedLegacy[index])) {
    throw new Error("MEDIA_GRANT_PRIMARY_KEY_UNSUPPORTED");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE media_upload_grants_v2 (
        media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        actor_persona TEXT NOT NULL DEFAULT 'social',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (media_id, user_id, purpose, actor_persona)
      );
      INSERT INTO media_upload_grants_v2 (media_id, user_id, purpose, actor_persona, created_at)
      SELECT media_id, user_id, purpose,
             CASE WHEN lower(actor_persona) IN ('social','work','dating','travel','market')
                  THEN lower(actor_persona) ELSE 'social' END,
             MIN(created_at)
      FROM media_upload_grants
      GROUP BY media_id, user_id, purpose,
               CASE WHEN lower(actor_persona) IN ('social','work','dating','travel','market')
                    THEN lower(actor_persona) ELSE 'social' END;
      DROP TABLE media_upload_grants;
      ALTER TABLE media_upload_grants_v2 RENAME TO media_upload_grants;
      CREATE INDEX idx_media_grants_user ON media_upload_grants(user_id, actor_persona, purpose, media_id);
    `);
    if (typeof beforeCommit === "function") beforeCommit();
    db.exec("COMMIT");
    return { migrated: true, primaryKey: expected };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// A consumed NativeAuth proof must remain consumed until its own expiry even
// after logout, session revocation or account removal. Older schemas referenced
// sessions/users with ON DELETE CASCADE, which erased the anti-replay marker.
export function migrateNativeAuthConsumptionIndependence(db, { beforeCommit = null } = {}) {
  const columns = db.prepare(`PRAGMA table_info(native_auth_consumptions)`).all();
  const required = ["token_sha256", "purpose", "idempotency_key", "request_sha256", "address", "user_id", "persona", "session_token_hash", "session_token_ciphertext", "expires_at", "created_at"];
  if (!required.every((name) => columns.some((column) => column.name === name))) throw new Error("NATIVE_AUTH_CONSUMPTION_SCHEMA_UNSUPPORTED");
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list(native_auth_consumptions)`).all();
  if (!foreignKeys.length) return { migrated: false, independent: true };
  const supported = foreignKeys.every((foreignKey) => (foreignKey.from === "user_id" && foreignKey.table === "users")
    || (foreignKey.from === "session_token_hash" && foreignKey.table === "sessions"));
  if (!supported) throw new Error("NATIVE_AUTH_CONSUMPTION_FOREIGN_KEY_UNSUPPORTED");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE native_auth_consumptions_v2 (
        token_sha256 TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_sha256 TEXT NOT NULL,
        address TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        persona TEXT NOT NULL,
        session_token_hash TEXT NOT NULL,
        session_token_ciphertext BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (purpose, idempotency_key)
      );
      INSERT INTO native_auth_consumptions_v2
        (token_sha256, purpose, idempotency_key, request_sha256, address, user_id, persona,
         session_token_hash, session_token_ciphertext, expires_at, created_at)
      SELECT token_sha256, purpose, idempotency_key, request_sha256, address, user_id, persona,
             session_token_hash, session_token_ciphertext, expires_at, created_at
      FROM native_auth_consumptions;
      DROP TABLE native_auth_consumptions;
      ALTER TABLE native_auth_consumptions_v2 RENAME TO native_auth_consumptions;
      CREATE INDEX idx_native_auth_consumptions_expiry ON native_auth_consumptions(expires_at);
    `);
    if (typeof beforeCommit === "function") beforeCommit();
    db.exec("COMMIT");
    return { migrated: true, independent: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateSocialTables(db) {
  migrateNativeAuthConsumptionIndependence(db);
  addMissingColumns(db, "mutation_requests", {
    outcome_status: "outcome_status INTEGER",
  });
  db.exec(`UPDATE mutation_requests
    SET outcome_status = response_status
    WHERE status = 'completed' AND outcome_status IS NULL`);
  addMissingColumns(db, "media_upload_grants", {
    actor_persona: "actor_persona TEXT NOT NULL DEFAULT 'social'",
  });
  migrateMediaUploadGrantsKey(db);
  addMissingColumns(db, "outbox_events", {
    locked_by: "locked_by TEXT",
    locked_until: "locked_until INTEGER",
    last_error: "last_error TEXT",
  });
  addMissingColumns(db, "media", {
    detected_mime: "detected_mime TEXT",
    uploaded_by: "uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
    purpose: "purpose TEXT NOT NULL DEFAULT 'social_post'",
    scan_status: "scan_status TEXT NOT NULL DEFAULT 'quarantined_legacy'",
    scan_reason: "scan_reason TEXT NOT NULL DEFAULT 'not_inspected'",
  });
  addMissingColumns(db, "personas", {
    avatar: "avatar TEXT",
    cover: "cover TEXT",
    // Where the cover sits inside its frame, as a percentage from the top. A wide photo in a short
    // band is cropped by geometry, so the crop has to be a decision the owner can make and keep:
    // 35 keeps faces and skylines in frame, and the owner can move it.
    cover_focus: "cover_focus INTEGER NOT NULL DEFAULT 35",
    // The band above the identity shows either the cover photo or the shelf of saved stories. The
    // choice is additive: an existing record keeps its cover, because that is what the default says.
    cover_mode: "cover_mode TEXT NOT NULL DEFAULT 'cover'",
    // The date of birth is additive as well, and empty for every record that was written before it: a
    // profile with no date keeps whatever age it declared, and a profile with one derives its age.
    birth_date: "birth_date TEXT",
    // The tab order is additive and starts empty: an empty value is read as the product's own order, so
    // no existing profile changes the way it is read.
    tabs_order: "tabs_order TEXT NOT NULL DEFAULT ''",
    identity_sigil: "identity_sigil TEXT NOT NULL DEFAULT 'STAR'",
    sigil_color: "sigil_color TEXT NOT NULL DEFAULT '#20e0d0'",
    orbit_mood: "orbit_mood TEXT",
    orbit_place: "orbit_place TEXT",
    orbit_now: "orbit_now TEXT",
    orbit_fandom: "orbit_fandom TEXT",
    orbit_quote: "orbit_quote TEXT",
    orbit_expires_at: "orbit_expires_at INTEGER",
    location: "location TEXT NOT NULL DEFAULT ''",
    age: "age INTEGER",
    profile_kind: "profile_kind TEXT NOT NULL DEFAULT 'personal'",
    business_verification_status: "business_verification_status TEXT NOT NULL DEFAULT 'unverified'",
    discoverability: "discoverability TEXT NOT NULL DEFAULT 'public'",
    message_policy: "message_policy TEXT NOT NULL DEFAULT 'requests'",
    interface_locale: "interface_locale TEXT NOT NULL DEFAULT 'auto'",
    content_languages: "content_languages TEXT NOT NULL DEFAULT '[]'",
    region_code: "region_code TEXT",
    near_enabled: "near_enabled INTEGER NOT NULL DEFAULT 0",
    private_access_enabled: "private_access_enabled INTEGER NOT NULL DEFAULT 0",
    private_access_price_cents: "private_access_price_cents INTEGER NOT NULL DEFAULT 100",
    private_access_month_price_cents: "private_access_month_price_cents INTEGER NOT NULL DEFAULT 2500",
    private_access_forever_price_cents: "private_access_forever_price_cents INTEGER NOT NULL DEFAULT 10000",
    private_access_currency: "private_access_currency TEXT NOT NULL DEFAULT 'USD'",
    private_access_duration_days: "private_access_duration_days INTEGER NOT NULL DEFAULT 30",
    updated_at: "updated_at INTEGER NOT NULL DEFAULT 0",
  });
  addMissingColumns(db, "posts", {
    visibility: "visibility TEXT NOT NULL DEFAULT 'public'",
    status: "status TEXT NOT NULL DEFAULT 'active'",
    language: "language TEXT",
    region_code: "region_code TEXT",
    provenance: "provenance TEXT NOT NULL DEFAULT 'user'",
    media_edit_json: "media_edit_json TEXT",
    media_edit_hash: "media_edit_hash TEXT",
    audio_media_id: "audio_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL",
    audio_rights: "audio_rights TEXT",
    audio_attribution: "audio_attribution TEXT NOT NULL DEFAULT ''",
    content_commitment: "content_commitment TEXT",
    version: "version INTEGER NOT NULL DEFAULT 1",
    edited_at: "edited_at INTEGER",
    archived_at: "archived_at INTEGER",
    withdrawn_at: "withdrawn_at INTEGER",
    // A pin is additive and absent for every post written before it: nothing is pinned until the owner
    // says so, and three pins are the whole allowance.
    pinned_at: "pinned_at INTEGER",
    moderation_state: "moderation_state TEXT NOT NULL DEFAULT 'ACTIVE'",
    moderation_reason: "moderation_reason TEXT",
    moderation_policy_version: "moderation_policy_version TEXT",
  });
  addMissingColumns(db, "comments", {
    actor_persona: "actor_persona TEXT NOT NULL DEFAULT 'social'",
    parent_id: "parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL",
    status: "status TEXT NOT NULL DEFAULT 'active'",
    content_commitment: "content_commitment TEXT",
    edited_at: "edited_at INTEGER",
    withdrawn_at: "withdrawn_at INTEGER",
    version: "version INTEGER NOT NULL DEFAULT 1",
    pinned_at: "pinned_at INTEGER",
  });
  addMissingColumns(db, "moderation_appeals", {
    content_commitment: "content_commitment TEXT",
  });
  addMissingColumns(db, "social_live_sessions", {
    visibility: "visibility TEXT NOT NULL DEFAULT 'private'",
    language: "language TEXT NOT NULL DEFAULT 'und'",
    comments_enabled: "comments_enabled INTEGER NOT NULL DEFAULT 1",
  });
  migrateNotificationSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_versions (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      caption TEXT NOT NULL,
      visibility TEXT NOT NULL,
      status TEXT NOT NULL,
      content_commitment TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (post_id, version)
    );
    INSERT OR IGNORE INTO post_versions (post_id, version, caption, visibility, status, content_commitment, created_at)
    SELECT id, version, caption, visibility, status, content_commitment, created_at FROM posts
    WHERE content_commitment IS NOT NULL;
    CREATE TABLE IF NOT EXISTS private_profile_access_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      persona TEXT NOT NULL DEFAULT 'social',
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      owner_share_cents INTEGER NOT NULL,
      nexus_share_cents INTEGER NOT NULL,
      starts_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'demo_unpaid',
      privacy_mode TEXT NOT NULL DEFAULT 'OWNER_ANONYMOUS',
      receipt_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    DROP INDEX IF EXISTS idx_media_grants_user;
CREATE INDEX IF NOT EXISTS idx_media_grants_user ON media_upload_grants(user_id, actor_persona, purpose, media_id);
CREATE INDEX IF NOT EXISTS idx_media_purge_receipts_time ON media_purge_receipts(purged_at DESC);
    CREATE INDEX IF NOT EXISTS idx_social_impressions_post ON social_impressions(post_id, viewer_id);
    CREATE INDEX IF NOT EXISTS idx_social_feedback_viewer ON social_feedback(viewer_id, viewer_persona, kind, post_id);
    CREATE INDEX IF NOT EXISTS idx_private_access_viewer ON private_profile_access_receipts(viewer_id, persona, expires_at);
    CREATE INDEX IF NOT EXISTS idx_private_access_owner ON private_profile_access_receipts(owner_id, persona, created_at DESC);
    INSERT OR IGNORE INTO post_reactions (user_id, actor_persona, post_id, kind, created_at, updated_at)
    SELECT user_id, 'social', post_id, CASE WHEN kind = 'like' THEN 'LIKE' ELSE upper(kind) END,
           created_at, created_at FROM likes;
    CREATE INDEX IF NOT EXISTS idx_posts_social_lens ON posts(persona, status, visibility, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(persona, status, expires_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views(viewer_id, viewer_persona, completed, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id, kind);
    CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id, kind);
    CREATE INDEX IF NOT EXISTS idx_comments_post_parent ON comments(post_id, parent_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_comment_versions_comment ON comment_versions(comment_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_content_assessments_subject ON content_assessments(subject_type, subject_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_subject ON moderation_reports(subject_type, subject_id, category, status);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_report_account_subject_category
      ON moderation_reports(reporter_id, subject_type, subject_id, category);
    CREATE INDEX IF NOT EXISTS idx_moderation_appeals_subject ON moderation_appeals(subject_type, subject_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_appeal_current_assessment
      ON moderation_appeals(appellant_id, subject_type, subject_id, content_commitment)
      WHERE content_commitment IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_moderation_reconsiderations_user ON moderation_reconsiderations(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_moderation_events_subject ON moderation_events(subject_type, subject_id, id);
  `);
  db.prepare(`UPDATE moderation_appeals SET status = 'RECORDED_AUTOMATED_ONLY' WHERE status = 'AUTO_REVIEWED'`).run();
  const missingPostCommitments = db.prepare(`
    SELECT id, user_id, persona, kind, caption, media_id, visibility, language, region_code, provenance,
           media_edit_hash, audio_media_id, audio_rights, audio_attribution
    FROM posts
  `).all();
  const updatePostCommitment = db.prepare(`UPDATE posts SET content_commitment = ? WHERE id = ?`);
  for (const row of missingPostCommitments) {
    const commitment = createHash("sha256").update(JSON.stringify({
      userId: row.user_id, persona: row.persona, kind: row.kind, caption: row.caption,
      mediaId: row.media_id, visibility: row.visibility, language: row.language,
      regionCode: row.region_code, provenance: row.provenance,
      mediaEditHash: row.media_edit_hash, audioMediaId: row.audio_media_id,
      audioRights: row.audio_rights, audioAttribution: row.audio_attribution || "",
    })).digest("hex");
    updatePostCommitment.run(commitment, row.id);
  }
  const missingCommentCommitments = db.prepare(`
    SELECT id, user_id, actor_persona, post_id, parent_id, body FROM comments
    WHERE content_commitment IS NULL OR content_commitment = ''
  `).all();
  const updateCommentCommitment = db.prepare(`UPDATE comments SET content_commitment = ? WHERE id = ?`);
  for (const row of missingCommentCommitments) {
    const commitment = createHash("sha256").update(JSON.stringify({
      userId: row.user_id, actorPersona: row.actor_persona, postId: row.post_id,
      parentId: row.parent_id, body: row.body,
    })).digest("hex");
    updateCommentCommitment.run(commitment, row.id);
  }
  db.exec(`
    INSERT OR IGNORE INTO comment_versions (comment_id, version, body, content_commitment, created_at)
    SELECT id, CASE WHEN version < 1 THEN 1 ELSE version END, body, content_commitment, created_at
    FROM comments WHERE content_commitment IS NOT NULL AND content_commitment <> ''
  `);
}

export function migrateChatDeviceSchema(db) {
  addMissingColumns(db, "chat_devices", {
    device_kind: "device_kind TEXT NOT NULL DEFAULT 'primary'",
    activation_token_hash: "activation_token_hash TEXT",
    activation_expires_at: "activation_expires_at INTEGER",
    activated_at: "activated_at INTEGER",
  });
  db.exec(`
    UPDATE chat_devices SET device_kind = 'recovery'
    WHERE device_id LIKE 'device:recovery:%' AND device_kind = 'primary';
    UPDATE chat_devices SET activated_at = registered_at
    WHERE status = 'active' AND activated_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_chat_devices_pending_expiry
      ON chat_devices(status, activation_expires_at, user_id);
  `);
}

function migrateMessagingTables(db) {
  migrateChatDeviceSchema(db);
  addMissingColumns(db, "conversations", {
    status: "status TEXT NOT NULL DEFAULT 'active'",
    request_recipient_id: "request_recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
    key_epoch: "key_epoch INTEGER NOT NULL DEFAULT 1",
    key_epoch_changed_at: "key_epoch_changed_at INTEGER NOT NULL DEFAULT 0",
  });
  addMissingColumns(db, "conversation_participants", {
    state: "state TEXT NOT NULL DEFAULT 'active'",
    history_start_message_id: "history_start_message_id INTEGER NOT NULL DEFAULT 0",
  });
  addMissingColumns(db, "message_items", {
    expires_at: "expires_at INTEGER",
    expired_at: "expired_at INTEGER",
    encryption_mode: "encryption_mode TEXT NOT NULL DEFAULT 'plaintext_local'",
    sender_device_id: "sender_device_id TEXT",
    device_set_commitment: "device_set_commitment TEXT",
    key_epoch: "key_epoch INTEGER",
    key_epoch_commitment: "key_epoch_commitment TEXT",
    encrypted_request_commitment: "encrypted_request_commitment TEXT",
  });
  db.exec(`
    UPDATE users SET chat_key_epoch = 1 WHERE chat_key_epoch IS NULL OR chat_key_epoch < 1;
    UPDATE conversations SET key_epoch = 1 WHERE key_epoch IS NULL OR key_epoch < 1;
    UPDATE conversations SET key_epoch_changed_at = created_at
      WHERE key_epoch_changed_at IS NULL OR key_epoch_changed_at < 1;
    CREATE INDEX IF NOT EXISTS idx_conversations_key_epoch ON conversations(id, key_epoch);
    CREATE TABLE IF NOT EXISTS message_shared_ciphertexts (
      message_id INTEGER PRIMARY KEY REFERENCES message_items(id) ON DELETE CASCADE,
      iv_b64 TEXT NOT NULL,
      ciphertext_b64 TEXT NOT NULL,
      aad_sha256 TEXT NOT NULL,
      ciphertext_sha256 TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  const legacy = db.prepare(`SELECT * FROM messages ORDER BY id ASC`).all();
  const findConversation = db.prepare(`SELECT id FROM conversations WHERE direct_key = ?`);
  const createConversation = db.prepare(`
    INSERT OR IGNORE INTO conversations (kind, context_persona, direct_key, created_by, created_at, updated_at)
    VALUES ('direct', 'social', ?, ?, ?, ?)
  `);
  const addParticipant = db.prepare(`
    INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?)
  `);
  const addMessage = db.prepare(`
    INSERT OR IGNORE INTO message_items
      (conversation_id, sender_id, sender_persona, kind, body, client_nonce, status, created_at)
    VALUES (?, ?, 'social', 'text', ?, ?, 'sent', ?)
  `);
  for (const message of legacy) {
    const low = Math.min(message.from_id, message.to_id);
    const high = Math.max(message.from_id, message.to_id);
    const key = `${low}:${high}:social`;
    createConversation.run(key, message.from_id, message.created_at, message.created_at);
    const conversation = findConversation.get(key);
    if (!conversation) continue;
    addParticipant.run(conversation.id, message.from_id, 'member', message.created_at);
    addParticipant.run(conversation.id, message.to_id, 'member', message.created_at);
    addMessage.run(conversation.id, message.from_id, message.body, `legacy:${message.id}`, message.created_at);
  }
}

export function openDb(path = DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // Deleted sensitive values are overwritten in SQLite-managed pages. WAL is
  // retained for runtime durability; the legacy-custody purge has a separate
  // quiesced checkpoint/VACUUM receipt proving its pre-WAL storage generation.
  db.exec("PRAGMA secure_delete = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrateUsersTable(db);
  migrateWalletsTable(db);
  migrateSessionSchema(db);
  migrateSocialTables(db);
  migrateMessagingTables(db);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_mvx_address ON users(mvx_address) WHERE mvx_address IS NOT NULL AND mvx_address <> ''`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_linked_wallet ON users(linked_wallet) WHERE linked_wallet IS NOT NULL AND linked_wallet <> ''`);
  // SQLite unique indexes cannot express cross-column uniqueness. These
  // triggers make one MultiversX address authoritative across both primary
  // and linked-wallet roles, including concurrent writers/processes.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_users_wallet_identity_insert
    BEFORE INSERT ON users
    BEGIN
      SELECT CASE WHEN NEW.mvx_address IS NOT NULL AND NEW.mvx_address <> '' AND EXISTS (
        SELECT 1 FROM users WHERE linked_wallet = NEW.mvx_address
      ) THEN RAISE(ABORT, 'wallet identity conflict') END;
      SELECT CASE WHEN NEW.linked_wallet IS NOT NULL AND NEW.linked_wallet <> '' AND EXISTS (
        SELECT 1 FROM users WHERE mvx_address = NEW.linked_wallet
      ) THEN RAISE(ABORT, 'wallet identity conflict') END;
    END;
    CREATE TRIGGER IF NOT EXISTS trg_users_wallet_identity_update
    BEFORE UPDATE OF mvx_address, linked_wallet ON users
    BEGIN
      SELECT CASE WHEN NEW.mvx_address IS NOT NULL AND NEW.mvx_address <> '' AND EXISTS (
        SELECT 1 FROM users WHERE id <> NEW.id AND linked_wallet = NEW.mvx_address
      ) THEN RAISE(ABORT, 'wallet identity conflict') END;
      SELECT CASE WHEN NEW.linked_wallet IS NOT NULL AND NEW.linked_wallet <> '' AND EXISTS (
        SELECT 1 FROM users WHERE id <> NEW.id AND mvx_address = NEW.linked_wallet
      ) THEN RAISE(ABORT, 'wallet identity conflict') END;
    END;
  `);
  return db;
}

export { SCHEMA };
