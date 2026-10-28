import { useEffect } from 'react';
import { AppState } from 'react-native';
import { nexusApi } from './nexusApi';

/**
 * The phone's half of the view counter — the reading the server cannot see by itself.
 *
 * `GET /api/profiles/:handle` publishes `view_stats.viewers` on every post (`socialPostView`, api.js), and
 * that number is `repo.js` `postViewStatsBulk` counting the *distinct* organic viewers of
 * `social_impressions`. A view therefore exists only once a client reports it — and until now only the web
 * did: `public/app.js` keeps the queue below (`queueSocialImpression` / `flushSocialImpressions`,
 * `POST /api/social/impressions`), while every post opened on the phone went uncounted. This file is that
 * queue, on the same contract, so a clip watched here moves the same number the web moves:
 *
 *   · one entry per post id, `{ post_id, dwell_ms, completed }`, the dwell kept as the longest reading;
 *   · a page is a view once it has held the screen for `MIN_READ_MS` — a thumb flicked past is not one,
 *     and the server would ignore a 0 ms one anyway;
 *   · a 650 ms debounce, 50 entries per request, `{ entries, comment_entries: [] }` — the web's own
 *     batching and the same route (`api.js` `POST /api/social/impressions`, which refuses anyone whose
 *     active persona is not `social`);
 *   · a batch that could not be delivered goes back in the queue and travels with the next reading. It is
 *     not retried on a timer: an unreachable server is not a reason to spin.
 *
 * Nothing here invents a number. The screens print `view_stats.viewers`, and this file only makes sure the
 * reading that happened on the phone reaches the store that owns it.
 */
export type ImpressionEntry = { post_id: number; dwell_ms: number; completed: boolean };
export type ImpressionSender = (entries: ImpressionEntry[]) => Promise<unknown>;

/** The web's own constants (`app.js` `queueSocialImpression`, `flushSocialImpressions`). */
const FLUSH_DELAY_MS = 650;
const MAX_BATCH = 50;
const MAX_DWELL_MS = 600_000;
/** How long a page has to hold the screen before it counts as read. */
export const MIN_READ_MS = 900;

export type ImpressionLedger = {
  /** Records one reading of one post; the longest dwell wins and `completed` is never unset. */
  note: (postId: number, dwellMs?: number, completed?: boolean) => void;
  /** Sends what is queued now, without waiting for the debounce. */
  flush: () => Promise<void>;
  /** What has not reached the server yet — a test's window into the queue. */
  pending: () => ImpressionEntry[];
};

/**
 * The ledger itself, with the clock and the wire as arguments, so its rules are testable: `send` carries a
 * batch to the server and `onDelivered` is told which ids were accepted.
 */
export function createImpressionLedger(send: ImpressionSender, options: {
  delayMs?: number;
  onDelivered?: (postIds: number[]) => void;
} = {}): ImpressionLedger {
  const delay = Math.max(0, Number(options.delayMs ?? FLUSH_DELAY_MS) || 0);
  const queue = new Map<number, ImpressionEntry>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  const disarm = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const arm = () => {
    disarm();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  };

  /** A batch the server never accepted comes back exactly as it went out, merged with what arrived since. */
  const restore = (entries: ImpressionEntry[]) => {
    for (const entry of entries) {
      const current = queue.get(entry.post_id);
      if (!current) {
        queue.set(entry.post_id, entry);
        continue;
      }
      current.dwell_ms = Math.max(current.dwell_ms, entry.dwell_ms);
      current.completed = current.completed || entry.completed;
    }
  };

  function note(postId: number, dwellMs = 0, completed = false) {
    const id = Number(postId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const current = queue.get(id) ?? { post_id: id, dwell_ms: 0, completed: false };
    current.dwell_ms = Math.max(current.dwell_ms, Math.max(0, Math.min(MAX_DWELL_MS, Math.floor(Number(dwellMs) || 0))));
    current.completed = current.completed || completed === true;
    queue.set(id, current);
    arm();
  }

  async function flush(): Promise<void> {
    disarm();
    if (inFlight) return inFlight;
    if (!queue.size) return;
    const batch = [...queue.values()].slice(0, MAX_BATCH);
    for (const entry of batch) queue.delete(entry.post_id);
    inFlight = (async () => {
      let failed = false;
      try {
        await send(batch);
      } catch {
        failed = true;
        restore(batch);
      } finally {
        inFlight = null;
        if (!failed) {
          options.onDelivered?.(batch.map((entry) => entry.post_id));
          /** Anything that arrived while the request was in the air takes the next batch. */
          if (queue.size) arm();
        }
      }
    })();
    return inFlight;
  }

  return { note, flush, pending: () => [...queue.values()] };
}

export type ImpressionDelivery = (postIds: number[]) => void;

const deliveries = new Set<ImpressionDelivery>();

/**
 * Told once a batch has been accepted by the server. A surface that prints a count subscribes and reads its
 * own address again, because the number it shows is now one reading behind.
 */
export function subscribeImpressionDelivery(listener: ImpressionDelivery): () => void {
  deliveries.add(listener);
  return () => {
    deliveries.delete(listener);
  };
}

function sendImpressions(entries: ImpressionEntry[]) {
  return nexusApi('/api/social/impressions', {
    method: 'POST',
    body: JSON.stringify({ entries, comment_entries: [] }),
  });
}

export const impressions = createImpressionLedger(sendImpressions, {
  onDelivered: (postIds) => {
    for (const listener of deliveries) listener(postIds);
  },
});

/** One reading of one post, as a screen reports it. */
export function noteImpression(postId?: number | null, dwellMs = 0, completed = false): void {
  if (postId === null || postId === undefined) return;
  impressions.note(postId, dwellMs, completed);
}

export function flushImpressions(): Promise<void> {
  return impressions.flush();
}

/**
 * A reader who leaves the app keeps the page they were on: the queue is sent then, so a view does not wait
 * for a screen that may never come back.
 */
function useFlushWhenHidden(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushImpressions();
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Reports the post that holds the screen.
 *
 * The page counts once it has been read (`MIN_READ_MS`) and once more when it is left, with the real dwell —
 * the ledger keeps the longer of the two, so a page opened and closed is one entry and a clip watched for a
 * minute is a minute. `null` (a feed between pages, a route that is still loading) reports nothing.
 */
export function usePostImpression(postId?: number | null, minReadMs = MIN_READ_MS): void {
  useFlushWhenHidden();
  useEffect(() => {
    const id = Number(postId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => noteImpression(id, Date.now() - startedAt), Math.max(0, minReadMs));
    return () => {
      clearTimeout(timer);
      const dwell = Date.now() - startedAt;
      if (dwell >= minReadMs) noteImpression(id, dwell);
    };
  }, [postId, minReadMs]);
}
