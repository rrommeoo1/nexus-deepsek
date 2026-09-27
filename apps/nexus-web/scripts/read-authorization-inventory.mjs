import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceNames = ["lib/api.js", "lib/repo.js", "lib/privacy-matrix.js"];
const sources = Object.fromEntries(sourceNames.map((name) => [name, readFileSync(resolve(root, name), "utf8")]));
const controls = [
  ["public_profile_matrix", "lib/api.js", "repo.canViewPost(auth.user.id, auth.persona"],
  ["feed_viewer_bound", "lib/api.js", "repo.listSocialFeed(auth.user.id"],
  ["search_viewer_bound", "lib/api.js", "repo.searchSocial(auth.user.id"],
  ["private_content_viewer_bound", "lib/api.js", "repo.listPrivateContentForViewer(auth.user.id"],
  ["stories_persona_bound", "lib/api.js", "repo.listActiveStories(auth.user.id, auth.persona"],
  ["story_archive_owner_bound", "lib/api.js", "repo.listArchivedStories(auth.user.id, auth.persona"],
  ["media_matrix", "lib/api.js", "repo.canReadMedia(m.id, auth.user.id, auth.persona)"],
  ["conversation_participant", "lib/api.js", "repo.isConversationParticipant(conversationId, auth.user.id)"],
  ["conversation_block_state", "lib/api.js", "repo.conversationBlockState(conversationId).blocked"],
  ["message_device_owner", "lib/api.js", "device.user_id !== auth.user.id || device.status !== \"active\""],
  ["notifications_owner", "lib/api.js", "repo.listNotifications(auth.user.id, { persona })"],
  ["repository_single_matrix", "lib/repo.js", "evaluatePrivacy({"],
  ["post_read_matrix", "lib/repo.js", "this.canViewPost(viewerId, viewerPersona, post)"],
  ["story_read_matrix", "lib/repo.js", "this.canViewPost(viewerId, viewerPersona, { ...story, kind: \"story\" })"],
  ["avatar_read_matrix", "lib/repo.js", "kind: \"avatar\""],
  ["deny_invalid_status", "lib/privacy-matrix.js", "RESOURCE_INACTIVE"],
  ["deny_cross_persona", "lib/privacy-matrix.js", "PERSONA_MISMATCH"],
  ["deny_block", "lib/privacy-matrix.js", "BLOCKED"],
];

const items = controls.map(([id, source, fragment]) => ({ id, source, pass: sources[source].includes(fragment) }));
const failed = items.filter((item) => !item.pass);
const report = {
  schema: "NEXUS_CRITICAL_READ_AUTHORIZATION_INVENTORY_V1",
  cycle: 169,
  scope: "critical_privacy_bearing_reads_not_every_public_or_operational_get",
  controls: items,
  summary: { total: items.length, passed: items.length - failed.length, failed: failed.length },
  source_sha256: Object.fromEntries(sourceNames.map((name) => [name, createHash("sha256").update(sources[name]).digest("hex")])),
  fail_closed: true,
  external_network: false,
  incremental_cost: 0,
  gate: failed.length ? "FAIL_LOCAL" : "PASS_LOCAL",
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (failed.length) process.exitCode = 1;
