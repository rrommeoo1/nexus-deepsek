// Wave 6h (P10): one renderer for "why am I seeing this", used by the feed card, the post page and the
// profile.
//
// The server states the signals as keys (lib/repo.js), so nothing here invents a sentence and nothing
// here trusts prose: an unknown key is dropped rather than printed, and the vocabulary is closed on the
// client too. The profile is a special case worth stating: an archive is read newest first, so the line
// there does not claim an order - it names the reader's own signals for that post.
export const RANKING_REASON_LIMIT = 4;
export const RANKING_REASON_KEYS = Object.freeze([
  "exploration_new", "following_author", "similar_liked", "language_preference", "region_preference",
  "organic_conversation", "seen_before", "author_less", "community_dislike", "marked_opinion",
  "older_post", "fresh_eligible", "repost_shared",
]);

const RANKING_REASON_SET = new Set(RANKING_REASON_KEYS);

export function rankingReasonKeys(post) {
  const reasons = Array.isArray(post?.ranking?.reasons) ? post.ranking.reasons : [];
  const keys = [];
  for (const reason of reasons) {
    const key = String(reason ?? "").trim();
    if (!RANKING_REASON_SET.has(key) || keys.includes(key)) continue;
    keys.push(key);
    if (keys.length >= RANKING_REASON_LIMIT) break;
  }
  return keys;
}

export function rankingReasonLabel(key, t) {
  const tr = typeof t === "function" ? t : (value) => value;
  return RANKING_REASON_SET.has(String(key ?? "")) ? tr("why." + key) : "";
}

// The prefix says which question is being answered, and it is the only thing that differs between the
// surfaces: the reasons themselves are the same sentences everywhere.
export function rankingReasonPrefixKey({ context = "feed" } = {}) {
  return context === "profile" ? "profile.whySignals" : "post.whyVisible";
}

export function rankingReasonMarkup(post, { esc, t, context = "feed" } = {}) {
  const keys = rankingReasonKeys(post);
  if (!keys.length) return "";
  const tr = typeof t === "function" ? t : (key) => key;
  const escape = typeof esc === "function" ? esc : (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
  const label = tr(rankingReasonPrefixKey({ context }));
  const sentences = keys.map((key) => escape(tr("why." + key))).join(" · ");
  return '<div class="rankReason" data-rank-reason data-rank-context="' + escape(context) + '" title="' + escape(label) + '">✦ '
    + '<span class="rankReasonLabel">' + escape(label) + "</span> " + sentences + "</div>";
}

// The full answer, for the sheet behind "why am I seeing this": one row per reason, and never a claim
// about what other people did.
export function rankingReasonListMarkup(post, { esc, t } = {}) {
  const keys = rankingReasonKeys(post);
  const tr = typeof t === "function" ? t : (key) => key;
  const escape = typeof esc === "function" ? esc : (value) => String(value ?? "");
  if (!keys.length) return "";
  return '<ul class="rankReasonList" data-rank-reason-list>' + keys
    .map((key) => "<li>" + escape(tr("why." + key)) + "</li>").join("") + "</ul>";
}

// A reason that lowered a post is stated as plainly as one that raised it, and the reader is told when
// their own signal is the cause.
export function rankingReasonIsPrivate(key) {
  return key === "author_less" || key === "seen_before";
}
