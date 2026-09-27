const nowSeconds = () => Math.floor(Date.now() / 1000);
const cleanError = (error) => String(error?.message ?? "handler failed").replace(/[\r\n\t]/g, " ").slice(0, 300);

export function createLocalOutboxHandlers(repo, { sse = null } = {}) {
  return {
    "action.intent.created": (event) => {
      const payload = JSON.parse(event.payload_json);
      const allowed = new Set(["intent_id", "actor_kind", "action_type", "action_class", "payload_hash", "chain_status"]);
      if (Object.keys(payload).some((key) => !allowed.has(key)) ||
          payload.intent_id !== event.aggregate_id || !/^[a-f0-9]{64}$/.test(String(payload.payload_hash || "")) ||
          payload.chain_status === "CONFIRMED") {
        throw new Error("action intent envelope invariant failed");
      }
      // Local mode acknowledges durable projection only. It never submits a
      // transaction and therefore can never promote an intent to CONFIRMED.
      return { acknowledged: true, chain_submission: false };
    },
    "media.upload.completed": (event) => {
      const payload = JSON.parse(event.payload_json);
      const media = repo.getMediaById(Number(payload.mediaId));
      if (!media || String(payload.uploadId) !== String(event.aggregate_id)) throw new Error("media completion invariant failed");
      return { acknowledged: true };
    },
    "social.post.published": (event) => {
      const payload = JSON.parse(event.payload_json);
      const post = repo.getPostById(Number(payload.postId));
      if (!post || String(post.id) !== String(event.aggregate_id) || post.status !== "active") {
        throw new Error("post publication invariant failed");
      }
      if (sse) {
        const channels = [`user:${post.user_id}`];
        if (post.visibility === "public") channels.push(`persona:${post.persona}`);
        // Emit only an invalidation envelope. Authorized clients re-read the
        // resource through Privacy Matrix; private post data never enters a
        // broad realtime channel.
        sse.broadcast("post-available", { post_id: post.id, persona: post.persona }, channels);
      }
      return { acknowledged: true };
    },
  };
}

export function dispatchOutboxBatch({ db, handlers, workerId = "local-outbox", limit = 25, maxAttempts = 5, now = nowSeconds() }) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const boundedAttempts = Math.max(1, Math.min(20, Number(maxAttempts) || 5));
  const claimed = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = db.prepare(`SELECT * FROM outbox_events
      WHERE (status = 'pending' AND available_at <= ?)
         OR (status = 'processing' AND COALESCE(locked_until, 0) <= ?)
      ORDER BY id LIMIT ?`).all(now, now, boundedLimit);
    for (const row of rows) {
      const changed = db.prepare(`UPDATE outbox_events
        SET status = 'processing', attempts = attempts + 1, locked_by = ?, locked_until = ?, last_error = NULL
        WHERE id = ? AND ((status = 'pending' AND available_at <= ?) OR (status = 'processing' AND COALESCE(locked_until, 0) <= ?))`)
        .run(workerId, now + 30, row.id, now, now);
      if (changed.changes === 1) claimed.push({ ...row, attempts: Number(row.attempts) + 1 });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const result = { claimed: claimed.length, published: 0, retried: 0, dead_lettered: 0 };
  for (const event of claimed) {
    try {
      const handler = handlers?.[event.event_type];
      if (typeof handler !== "function") throw new Error(`no handler for ${event.event_type}`);
      handler(event);
      db.prepare(`UPDATE outbox_events SET status = 'published', published_at = ?, locked_by = NULL, locked_until = NULL, last_error = NULL WHERE id = ? AND status = 'processing' AND locked_by = ?`)
        .run(now, event.id, workerId);
      result.published++;
    } catch (error) {
      const message = cleanError(error);
      if (event.attempts >= boundedAttempts) {
        db.exec("BEGIN IMMEDIATE");
        try {
          db.prepare(`INSERT OR REPLACE INTO outbox_dead_letters
            (event_id, event_type, aggregate_type, aggregate_id, payload_json, attempts, last_error, failed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(event.id, event.event_type, event.aggregate_type, event.aggregate_id, event.payload_json, event.attempts, message, now);
          db.prepare(`UPDATE outbox_events SET status = 'failed', locked_by = NULL, locked_until = NULL, last_error = ? WHERE id = ? AND locked_by = ?`)
            .run(message, event.id, workerId);
          db.exec("COMMIT");
          result.dead_lettered++;
        } catch (inner) {
          db.exec("ROLLBACK");
          throw inner;
        }
      } else {
        const backoff = Math.min(600, Math.max(1, 5 ** Math.max(0, event.attempts - 1)));
        db.prepare(`UPDATE outbox_events SET status = 'pending', available_at = ?, locked_by = NULL, locked_until = NULL, last_error = ? WHERE id = ? AND locked_by = ?`)
          .run(now + backoff, message, event.id, workerId);
        result.retried++;
      }
    }
  }
  return result;
}
