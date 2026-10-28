import { router } from 'expo-router';

/**
 * A hashtag is a place on this network, not a search term.
 *
 * The web wires `#subiect` into a real tag page: `captionWithTagsMarkup` prints the mark as
 * `<button data-tag-kind="hashtag" data-tag="...">` (`app.js:4032-4052`) and the press opens
 * `.tagPageLayer`, which reads `GET /api/social/tags/hashtag/:tag` (`app.js:4184`) — the posts that
 * really carry the tag, plus the two honest counts behind them (how many posts, how many distinct
 * people). Searching captions for the literal text `#tag` would be a different, weaker answer: it
 * misses a tag written once and it cannot print those counts.
 *
 * The phone answers with the same page as a pushed route (`src/app/tag/[tag].tsx`), so the feed keeps
 * its place underneath it and the arrow back returns the reader to the exact page they left — a slot
 * of the shell would have unmounted the feed.
 *
 * The address is what the server accepts: `[L N _]{2,50}`, lowercased (`api.js:3523-3526`,
 * `repo.listPostsByTag`). Anything else is not a tag, so pressing it opens nothing rather than an
 * empty page (`#`, `#a`, `#two words`).
 */
const TAG = /^[\p{L}\p{N}_]{2,50}$/u;

/** `#Brașov` -> `brașov`: the tag the server stores — no mark, no case, no spaces around it. */
export function normalizeTag(tag?: string | null): string {
  return String(tag ?? '').trim().replace(/^#/, '').toLowerCase();
}

/** Whether this word is a tag the server would accept, which is whether it has a page at all. */
export function isTag(tag?: string | null): boolean {
  return TAG.test(normalizeTag(tag));
}

/** The tag's own page, pushed over whatever the reader was reading. */
export function openTagPage(tag?: string | null, dismiss?: () => void): void {
  const normalized = normalizeTag(tag);
  if (!TAG.test(normalized)) return;
  dismiss?.();
  router.push({ pathname: '/tag/[tag]', params: { tag: normalized } });
}
