import { nexusApi } from './nexusApi';
import { rememberPayload } from './relations';
import { mediaSourceForPath, type StoriesPage, type StoryView } from './socialTypes';

/**
 * The story shelf of the product, read with the two calls the web client itself makes:
 *
 *   GET  /api/stories?state=unseen   lib/api.js:4588   (public/app.js:3287 `loadStories`)
 *   POST /api/stories/:id/view       lib/api.js:4599   { progress, completed } (app.js:3378)
 *
 * The web validates every record before it paints it (`loadStories`, app.js:3289-3306) and drops the
 * whole answer when one record is wrong; the same gate runs here, so the tray can never show a card
 * the web would have refused. Nothing is defaulted: a story without a real commitment, a live expiry
 * and a matching author is not printed.
 */
const HANDLE = /^[a-z0-9_]{2,30}$/;
const COMMITMENT = /^[a-f0-9]{64}$/;

/** One record passes the same seven checks the web's `validStories` runs. */
export function isPrintableStory(story: StoryView, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const media = story?.media;
  return Number.isSafeInteger(Number(story?.id)) && Number(story.id) > 0
    && Number.isSafeInteger(Number(story.user_id)) && Number(story.user_id) > 0
    && story.persona === 'social' && story.status === 'active'
    && ['public', 'followers', 'friends', 'private'].includes(String(story.visibility))
    && typeof story.caption === 'string' && story.caption.length <= 500
    && COMMITMENT.test(String(story.content_commitment || ''))
    && Number.isSafeInteger(Number(story.created_at)) && Number(story.created_at) > 0
    && (story.expires_at == null || (Number.isSafeInteger(Number(story.expires_at)) && Number(story.expires_at) > nowSeconds))
    && story.lifecycle === (story.expires_at == null ? 'persistent_until_archived' : 'expires')
    && Boolean(story.author) && Number(story.author?.id) === Number(story.user_id)
    && HANDLE.test(String(story.author?.handle || ''))
    && Number(story.view_progress) >= 0 && Number(story.view_progress) <= 1
    && (!media || (['image', 'video'].includes(String(media.kind)) && /^[a-f0-9]{64}$/.test(String(media.hash || ''))));
}

export type StoriesAnswer = { stories: StoryView[]; viewerId: number | null; viewerPersona: string | null };

/**
 * The unseen shelf, in the server's own order. An answer that does not declare itself `unseen`, or
 * that belongs to another viewer/persona, is refused (`loadStories` app.js:3306: `container.innerHTML`
 * is emptied instead of painting a stale shelf).
 */
export async function fetchStories(expect?: { viewerId?: number; persona?: string }): Promise<StoriesAnswer> {
  const page = await nexusApi<StoriesPage>('/api/stories?state=unseen');
  const viewerId = Number.isSafeInteger(Number(page.viewer_id)) ? Number(page.viewer_id) : null;
  const viewerPersona = typeof page.viewer_persona === 'string' ? page.viewer_persona : null;
  const rows = Array.isArray(page.stories) ? page.stories : [];
  const mine = (expect?.viewerId == null || viewerId === expect.viewerId)
    && (expect?.persona == null || viewerPersona === expect.persona);
  if (page.state !== 'unseen' || !mine) return { stories: [], viewerId, viewerPersona };
  /**
   * The shelf names accounts, so it feeds the one relation store (`rememberPayload`): a story author whose
   * follow side the app has not read yet is resolved once, and the chip in the viewer prints the same word
   * the rest of the app prints. A refused answer was returned above, before anything is believed.
   */
  rememberPayload(page);
  return { stories: rows.filter((story) => isPrintableStory(story)), viewerId, viewerPersona };
}

/**
 * The progress the viewer really reached. The server answers with its own stored progress and the
 * `viewed` flag it derived, so the rail can dim a card because the server says so - not because the
 * client hoped (app.js:3385 accepts the answer only when it is exact).
 */
export async function recordStoryView(storyId: number, progress: number, completed: boolean): Promise<boolean> {
  const safe = Math.max(0, Math.min(1, Number(progress) || 0));
  const answer = await nexusApi<{ ok: true; viewed?: boolean; progress?: number }>(`/api/stories/${storyId}/view`, {
    method: 'POST',
    body: JSON.stringify({ progress: safe, completed: completed === true }),
  });
  return answer.viewed === true;
}

/**
 * The stories of one contact, read with the call the web makes for a contact card
 * (`contact-stories.js:22-25`: `GET /api/stories?state=all`) and gated by `contactStories`
 * (`contact-stories.js:2-20`), condition for condition: the answer must be the viewer's own, on the
 * `social` persona, in the `all` state, and every row must belong to the peer being opened.
 */
export async function fetchContactStories(peerId: number, viewerId?: number): Promise<StoryView[] | null> {
  const result = await nexusApi<StoriesPage>('/api/stories?state=all').catch(() => null);
  if (!result || result.ok !== true) return null;
  if (Number(result.viewer_id) !== Number(viewerId)) return null;
  if (result.viewer_persona !== 'social' || result.state !== 'all') return null;
  if (!Array.isArray(result.stories) || result.stories.length > 100) return null;
  const items = result.stories.filter((story) => Number(story?.user_id) === Number(peerId));
  const now = Math.floor(Date.now() / 1000);
  const printable = items.every((story) => Number.isSafeInteger(Number(story.id)) && Number(story.id) > 0
    && story.persona === 'social' && story.status === 'active'
    && ['public', 'followers', 'friends', 'private'].includes(String(story.visibility))
    && typeof story.caption === 'string' && story.caption.length <= 500
    && Number.isSafeInteger(Number(story.created_at)) && Number(story.created_at) > 0
    && Number(story.author?.id) === Number(peerId) && HANDLE.test(String(story.author?.handle || ''))
    && (!story.author?.avatar || Boolean(mediaSourceForPath(story.author.avatar)))
    && COMMITMENT.test(String(story.content_commitment || ''))
    && (story.expires_at == null || (Number.isSafeInteger(Number(story.expires_at)) && Number(story.expires_at) > now))
    && story.lifecycle === (story.expires_at == null ? 'persistent_until_archived' : 'expires')
    && Number(story.view_progress) >= 0 && Number(story.view_progress) <= 1
    && (!story.media || (['image', 'video'].includes(String(story.media.kind))
      && /^[a-f0-9]{64}$/.test(String(story.media.hash || ''))
      && /^[a-z0-9]{2,8}$/.test(String(story.media.ext || ''))
      && Boolean(mediaSourceForPath(`/media/${story.media.hash}.${story.media.ext}`)))));
  return printable ? items : null;
}

