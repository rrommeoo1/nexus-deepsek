import { openDb } from "../lib/db.js";

const db = openDb(":memory:");
try {
  const indexes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((row) => row.name));
  const required = [
    "idx_posts_social_lens", "idx_posts_created", "idx_comments_post_parent",
    "idx_post_reactions_post", "idx_follows_followee", "idx_stories_active",
    "idx_message_items_conversation", "idx_conversation_participant_user",
    "idx_notif_user_persona", "idx_upload_sessions_owner_status",
    "idx_upload_parts_upload", "idx_mutation_requests_expiry", "idx_outbox_pending",
    "idx_jobs_open_created", "idx_jobs_owner", "idx_job_applications_applicant",
    "idx_job_applications_job", "idx_business_pages_category", "idx_business_services_page",
    "idx_appointment_slots_service", "idx_appointments_customer", "idx_appointments_page",
    "idx_market_listings_discovery", "idx_market_listings_seller", "idx_market_offers_listing",
    "idx_market_offers_buyer", "idx_market_orders_party", "idx_stay_listings_discovery",
    "idx_stay_bookings_overlap", "idx_stay_bookings_party", "idx_ride_drivers_dispatch",
    "idx_ride_requests_dispatch", "idx_ride_requests_party", "idx_transaction_reviews_public",
    "idx_dating_profiles_discovery", "idx_dating_decisions_target", "idx_dating_matches_party",
    "idx_dating_meet_plans_match",
    "idx_watch_channels_owner", "idx_watch_videos_home", "idx_watch_videos_channel",
    "idx_watch_subscriptions_user", "idx_watch_progress_viewer", "idx_family_groups_adult",
    "idx_kids_children_family", "idx_kids_sessions_expiry", "idx_kids_catalog_eligibility",
    "idx_kids_history_child", "idx_kids_mutations_expiry",
    "idx_music_artists_owner", "idx_music_tracks_catalog", "idx_music_tracks_artist",
    "idx_music_library_user", "idx_music_play_starts_track", "idx_grow_content_discovery",
    "idx_grow_workout_offers", "idx_grow_workout_reservations_buyer", "idx_grow_courses_discovery",
    "idx_grow_enrollments_learner", "idx_grow_private_owner_expiry",
  ];
  const integrityRow = db.prepare("PRAGMA integrity_check").get();
  const integrity = Object.values(integrityRow || {})[0];
  const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  const feedPlan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM posts WHERE persona = ? AND status = 'active' ORDER BY created_at DESC LIMIT 30").all("social");
  const checks = {
    required_indexes_present: required.every((name) => indexes.has(name)),
    integrity_ok: integrity === "ok",
    foreign_keys_ok: foreignKeys.length === 0,
    feed_query_uses_index: feedPlan.some((step) => /USING INDEX idx_posts_social_lens/i.test(step.detail)),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const report = { schema: "NEXUS_DATA_INDEX_INVENTORY_V1", cycle: 173, required_indexes: required,
    index_count: indexes.size, feed_query_plan: feedPlan.map((step) => step.detail), checks,
    summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
    external_network: false, incremental_cost: 0,
    gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL" };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
} finally { db.close(); }
