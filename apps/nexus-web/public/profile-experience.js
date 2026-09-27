// Nexus owner profile — the identity surface renders what the record holds and nothing more.
//
// The location picker lives in its own module because the list of city names is data, not layout.
import { locationPickerMarkup } from './profile-location.js';
import { profileTickerMarkup, readTickerSpeed } from './profile-ticker.js?v=20260920-hero1';
// The profile explains a post with the same sentence the feed uses, marked as a profile context: the
// archive is chronological, so the line names the reader's own signals instead of claiming an order.
import { rankingReasonMarkup } from './ranking-reasons.js';

// The tabs are the archive's index: what the profile holds, split by what a reader is looking for.
// Moments is the saved-story shelf — it used to sit in the hero between the identity and the band, where
// it took the height the cover needs, so it is a tab of its own now.
const CONTENT_KINDS = Object.freeze({ flow: null, reels: 'video', shots: 'image', whispers: 'text', moments: 'moment' });
// The five tabs are icons now: five words spent the row on facts the icons already say, and the name of a
// tab is still read - in its accessible label and its tooltip - just not printed on the bar.
const CONTENT_TAB_GLYPHS = Object.freeze({ flow: '≡', reels: '▶', shots: '▦', whispers: '❝', moments: '✦' });
// The order the tabs are read in unless the owner arranged them. The list of tabs belongs to the product,
// the order belongs to the person who reads this profile every day.
const CONTENT_TAB_ORDER = Object.freeze(['flow', 'reels', 'shots', 'whispers', 'moments']);
// Three ways to read the same archive, and each one says what it sorts by: the day it was written, how much
// it was answered, and what this reader's own signals put first.
const CONTENT_FILTERS = Object.freeze(['newest', 'popular', 'relevant']);
// What each reading is called on screen: the arrow opens a list, and a list is read in the language of the
// person reading it.
function readingLabel(id, tr) {
  return tr('profile.filter' + id[0].toUpperCase() + id.slice(1));
}

// A stored order is one list of tab ids, read the same forgiving way the server writes it: unknown ids are
// dropped and anything the list forgot is appended in the product's own order, so a bar always has all five.
export function profileTabOrder(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const wanted = [];
  for (const entry of list) {
    const id = String(entry ?? '').trim().toLowerCase();
    if (CONTENT_TAB_ORDER.includes(id) && !wanted.includes(id)) wanted.push(id);
  }
  for (const id of CONTENT_TAB_ORDER) if (!wanted.includes(id)) wanted.push(id);
  return wanted;
}

// A count a reader can take in at a glance: 1.2K views is a fact, 1234 views is homework. Intl does the
// shortening in the interface language, and a number that is not a count is not printed.
export function profileCompactCount(value, locale) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  if (count < 1000) return count.toLocaleString(locale);
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  } catch {
    return String(count);
  }
}

const RELATIVE_UNITS = Object.freeze([
  ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
]);

// A presence is a dot, not a sentence: green when the person is there now, yellow when their presence
// is visible to this viewer but they are not online at this moment. The words live in the tooltip and
// the accessible name, because a name line that also prints "Online" spends its one row on two facts.
export function profilePresenceDot(profile) {
  const presence = profile?.presence;
  if (presence?.visible !== true) return "";
  return presence.online === true ? "online" : "away";
}

// Whispers are read as a timeline, so every card carries the same relative stamp the
// feed uses. Intl keeps the wording in the interface language instead of a locale table.
export function profileRelativeTime(createdAt, now = Date.now(), locale = 'ro-RO') {
  const createdMs = Number(createdAt) * 1000;
  if (!Number.isFinite(createdMs) || !Number.isFinite(Number(now))) return '';
  const elapsedSeconds = Math.max(0, Math.floor((Number(now) - createdMs) / 1000));
  const [unit, span] = RELATIVE_UNITS.find(([, seconds]) => elapsedSeconds >= seconds) ?? ['second', 1];
  const amount = elapsedSeconds < 60 ? 0 : -Math.floor(elapsedSeconds / span);
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(amount, unit);
  } catch {
    return '';
  }
}

export function profilePostKind(post) {
  if (post?.media?.kind === 'video') return 'video';
  if (post?.media?.kind === 'image') return 'image';
  return 'text';
}

// What every filter needs, written on the node itself so one rule can sort a tile and a whisper card the
// same way in one stream: when it was written, how much it was answered (reactions, comments and the
// distinct people who watched it), what this reader's own signals say about it, and where the owner put it.
// Nothing here is invented: an archive nobody watched has zero views, and a post the feed has no signal for
// has no rank.
export function postOrderAttributes(post, stamp) {
  const counts = post?.reactions?.counts && typeof post.reactions.counts === 'object' ? Object.values(post.reactions.counts) : [];
  const reactions = counts.reduce((total, count) => total + Math.max(0, Number(count) || 0), 0);
  const comments = Math.max(0, Number(post?.comment_count || 0));
  const viewers = Math.max(0, Number(post?.view_stats?.viewers || 0));
  const reasons = Array.isArray(post?.ranking?.reasons) ? post.ranking.reasons.length : 0;
  const pinned = Math.max(0, Math.floor(Number(post?.pinned_at || 0)));
  return ' data-profile-stamp="' + Math.max(0, Math.floor(Number(stamp) || 0)) + '"'
    + ' data-profile-score="' + (reactions + comments + viewers) + '"'
    + ' data-profile-rank="' + reasons + '"'
    + ' data-profile-pin="' + pinned + '"';
}

// Flow/Reels/Shots stay a visual grid; Whispers is a single-column timeline. A profile is a
// personal archive, so it is always read newest first: the feed ranks, the profile does not.
// A repost is part of that archive and is stamped with when it was shared, not with when the
// post underneath was written.
export function profileContentBuckets(posts, { stamp = null } = {}) {
  const at = typeof stamp === 'function' ? stamp : (post) => Number(post?.created_at || 0);
  const list = (Array.isArray(posts) ? posts : [])
    .slice()
    .sort((a, b) => at(b) - at(a) || Number(b?.id || 0) - Number(a?.id || 0));
  return {
    tiles: list.filter((post) => profilePostKind(post) !== 'text'),
    whispers: list.filter((post) => profilePostKind(post) === 'text'),
  };
}

export function renderLockedProfileOffer(sheet, profile, options) {
  const { esc, money, closeLabel = 'Close', dialogLabel = 'Private profile', onClose, onSelectTerm } = options;
  const prices = profile.private_access;
  sheet.innerHTML = '<span id="publicProfileDialogLabel" hidden>' + esc(dialogLabel) + '</span><button class="sheet-close" type="button" aria-label="' + esc(closeLabel) + '">×</button><section class="lockedProfileOffer"><i>◈</i><h2>' + esc(profile.name || 'Private profile') + '</h2><p>@' + esc(profile.handle) + ' · private</p><div><button type="button" data-private-term="24h"><b>' + money(prices.price_24h_cents, prices.currency) + '</b><small>24 h</small></button><button type="button" data-private-term="1month"><b>' + money(prices.price_month_cents, prices.currency) + '</b><small>1 month</small></button><button type="button" data-private-term="forever"><b>' + money(prices.price_forever_cents, prices.currency) + '</b><small>Forever</small></button></div><small>Access does not include online presence. Real payments are disabled locally.</small></section><div id="private-access-sheet"></div>';
  sheet.querySelector('.sheet-close')?.addEventListener('click', onClose);
  sheet.querySelectorAll('[data-private-term]').forEach((button) => button.addEventListener('click', () => onSelectTerm?.(button.dataset.privateTerm)));
}

function mediaUrl(media, safeUrl) {
  return media && typeof media === 'object' ? safeUrl('/media/' + String(media.hash || '') + '.' + String(media.ext || '')) : '';
}

const EMPTY_STATES = Object.freeze({
  flow: '<path d="M3 12h4l2-6 3 12 2-6h7"/>',
  reels: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  shots: '<rect x="4" y="6" width="16" height="12" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m5 17 5-5 4 4 3-2 2 3"/>',
  whispers: '<path d="M20 4c-6 1-11 5-13 11l-3 5"/><path d="M20 4c1 5-2 9-7 10l-4 1"/>',
  moments: '<path d="M12 3v18"/><path d="M3 12h18"/><circle cx="12" cy="12" r="8.5"/>',
});

function emptyStateBlock(kind, esc, tr, hidden) {
  return '<div class="ownerEmptyState" data-owner-empty-for="' + kind + '"' + (hidden ? ' hidden' : '') + '>'
    + '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + EMPTY_STATES[kind] + '</svg>'
    + '<b>' + esc(tr('profile.empty.' + kind + '.title')) + '</b>'
    + '<span>' + esc(tr('profile.empty.' + kind + '.detail')) + '</span></div>';
}

export function renderOwnerProfileExperience(host, result, options) {
  if (!host || !result?.profile) return;
  const { esc, safeUrl, t, bioMarkup, locale = 'ro-RO', now = Date.now(), controls, visibilityLabel, onEdit, onSettings, onVisibility, onStory, onAvatarPhoto, albums = [], onOpenPost, onOpenReply, onContentTab, onTabLeave, onRendered, onPinPost, onTabsOrder, tickerSpeed: tickerSpeedOption } = options;
  const tr = typeof t === 'function' ? t : (key) => key;
  // A description is text; the one implementation that turns an address inside it into an anchor is
  // owned by the caller, so this module keeps rendering text without carrying a linkifier of its own.
  const bioOf = typeof bioMarkup === 'function' ? bioMarkup : (value) => esc(String(value ?? ''));
  // An attribute cannot hold a raw quote, and the app's text escaping leaves quotes alone: a name, a
  // description or a city written with one in it would break the value the editor reads back.
  const attr = (value) => esc(String(value ?? '')).replace(/"/g, '&quot;');
  // The band's pace is a device-wide choice, so the hero reads it instead of owning it.
  const tickerSpeed = tickerSpeedOption ?? readTickerSpeed();
  const profile = result.profile;
  const isSelf = profile.is_self === true;
  // The order this profile reads its five tabs in, and the name each one keeps: the name is the one the
  // interface already has for that surface, and the glyph is what the bar shows instead of the name.
  const tabOrder = profileTabOrder(profile.tabs_order);
  const tabLabel = (kind) => tr('profile.tab' + kind[0].toUpperCase() + kind.slice(1));
  // Each icon keeps its own reading of its own archive, and the page starts with the honest default: the day
  // it was written. The shelf of saved stories has no readings at all, because it is not a list of posts.
  const readings = new Map();
  const readingOf = (kind) => (kind === 'moments' ? CONTENT_FILTERS[0] : readings.get(kind) || CONTENT_FILTERS[0]);
  // A non-public profile says so with a lock and a translated label. The bare word "friends" used to
  // sit in this line, where it read like a relationship instead of a setting.
  // The lock is a span, not an em: an older identity rule styles every em in the hero as a flex block.
  // A padlock on its own is a question, not an answer — the chip carries the label it stands for, so
  // whoever sees it reads "prieteni"/"privat" instead of guessing whether the profile is locked.
  const visibilityText = typeof visibilityLabel === 'function' ? visibilityLabel(profile.visibility) : profile.visibility;
  // The name line carries the sign of who may read this profile, and the sign is the lock itself: an open
  // padlock when it is public and a closed one when it is not. For the owner it is a control that opens the
  // panel which edits it; a visitor reads the sign only when the profile is not public, because a badge that
  // says "public" on somebody else's name line is noise while a lock is information.
  const visibilityLocked = Boolean(profile.visibility) && profile.visibility !== 'public';
  const visibilityBadge = isSelf
    ? '<button type="button" class="ownerVisibility ' + (visibilityLocked ? 'isLocked' : 'isOpen') + '" data-owner-visibility aria-label="' + esc(visibilityText) + '" title="' + esc(visibilityText) + '"><i aria-hidden="true">' + (visibilityLocked ? '🔒' : '🔓') + '</i></button>'
    : (visibilityLocked
      ? '<span class="ownerVisibility isLocked" role="img" aria-label="🔒 ' + esc(visibilityText) + '" title="' + esc(visibilityText) + '"><i aria-hidden="true">🔒</i></span>'
      : '');
  const posts = Array.isArray(result.posts) ? result.posts : [];
  const stories = Array.isArray(result.stories) ? result.stories : [];
  const name = String(profile.name || profile.handle || 'Nexus');
  const avatar = safeUrl(profile.avatar), cover = safeUrl(profile.cover);
  // The band is short and a photo is wide, so the crop is where the frame sits over the photo: the
  // owner's choice travels as a percentage, and a profile that never chose one starts at 35%.
  const coverFocus = Number.isFinite(Number(profile.cover_focus)) ? Math.min(100, Math.max(0, Math.round(Number(profile.cover_focus)))) : 35;
  // What the band above the identity shows: the cover photo, or the shelf of saved stories. The choice
  // is the owner's, the server carries it, and a value it does not recognise reads as the default.
  const coverMode = profile.cover_mode === 'stories' ? 'stories' : 'cover';
  // A private profile keeps its band to itself: the band is built from what the record says, so a reader
  // who is not allowed in must not receive it. The owner always sees their own band.
  const showTicker = isSelf || profile.visibility === 'public';
  // The age is printed with the unit the interface language uses, and the field that edits it opens on the
  // day the record holds: the owner chooses the date once, from a calendar, and the age is derived from it
  // whenever the profile is read, so a birthday is a birthday and not an edit.
  const birthValue = typeof profile.birth_date === 'string' ? profile.birth_date : '';
  const todayIso = new Date(now).toISOString().slice(0, 10);
  const avatarMarkup = avatar ? '<img src="' + esc(avatar) + '" alt="' + esc(tr('profile.avatarAlt')) + '" />' : esc(name.slice(0, 2).toUpperCase());
  const number = (key) => Math.max(0, Number(profile.counts?.[key]) || 0).toLocaleString(locale);
  const presenceTone = profilePresenceDot(profile);
  const storyTiles = stories.slice(0, 8).map((story, index) => {
    const visual = mediaUrl(story.media, safeUrl);
    return '<button type="button" data-profile-moment="' + index + '"><i>' + (visual ? '<img src="' + esc(visual) + '" alt="" />' : '<span>✦</span>') + '</i><small>' + esc(story.caption || tr('profile.moment')) + '</small></button>';
  });
  // Saved-story albums only: a profile is not the place to publish a new story, and the rail
  // shows the archive when it exists. Without an album, the active stories stay reachable.
  const albumTiles = (Array.isArray(albums) ? albums : []).slice(0, 8).map((album, index) => {
    const cover = mediaUrl(album?.stories?.[0]?.media, safeUrl);
    return '<button type="button" data-profile-album="' + index + '"><i>' + (cover ? '<img src="' + esc(cover) + '" alt="" />' : '<span>▣</span>') + '</i><small>' + esc(album?.title || tr('x.profile.albums')) + '</small></button>';
  });
  // Reposts are shares of someone else's post: they sit in the same archive, newest share
  // first, and the card says who shared them.
  const repostEntries = (Array.isArray(result.reposts) ? result.reposts : [])
    .filter((entry) => entry?.post)
    .map((entry) => ({ ...entry.post, __repost: entry.repost }));
  const buckets = profileContentBuckets([...posts, ...repostEntries], {
    stamp: (post) => Number(post?.__repost?.reposted_at || post?.created_at || 0),
  });
  // A post is a tile when it carries a photo or a clip, and every tile says what a reader needs to decide
  // whether to open it: a play sign and the number of people who watched it for a clip, where it sits in
  // the owner's own arrangement for a pinned one. The pin is a button, so it cannot live inside the tile's
  // own button: the tile is wrapped, and the wrap is what the flow and the filters move around.
  const tileMarkup = (post) => {
    const id = Number(post.id);
    const visual = mediaUrl(post.media, safeUrl);
    if (!visual) return '';
    const kind = profilePostKind(post);
    const stamp = Number(post?.__repost?.reposted_at || post?.created_at || 0);
    const pinnedAt = Math.max(0, Number(post.pinned_at || 0));
    const views = Math.max(0, Number(post.view_stats?.viewers || 0));
    const meta = postOrderAttributes(post, stamp);
    const media = kind === 'video'
      ? '<video src="' + esc(visual) + '" muted playsinline></video>'
      : '<img src="' + esc(visual) + '" alt="' + esc(tr('profile.postAlt')) + '" />';
    // The two facts that turn a clip into a choice, in the corner a thumb already knows: what it is and how
    // many people watched it. The count is one accessible sentence, not a bare number.
    const corner = kind === 'video'
      ? '<i class="profileTilePlay" aria-hidden="true">▶</i>'
        + '<small class="profileTileViews" aria-label="' + esc(profileCompactCount(views, locale) + ' ' + tr('profile.views')) + '"><span aria-hidden="true">👁</span> ' + esc(profileCompactCount(views, locale)) + '</small>'
      : '';
    const pinControl = isSelf
      ? '<button type="button" class="profileTilePin" data-pin-post="' + id + '" aria-pressed="' + (pinnedAt > 0) + '" aria-label="' + esc(tr(pinnedAt > 0 ? 'profile.unpinAction' : 'profile.pinAction')) + '" title="' + esc(tr(pinnedAt > 0 ? 'profile.unpinAction' : 'profile.pinAction')) + '">📌</button>'
      : '';
    return '<div class="profileTile' + (pinnedAt > 0 ? ' isPinned' : '') + '" data-owner-post-item="' + id + '" data-profile-kind="' + kind + '"' + meta + (post.__repost ? ' data-repost-entry="1"' : '') + '>'
      + '<button type="button" class="profileTileOpen" data-profile-post="' + id + '" data-profile-open="' + id + '" data-profile-kind="' + kind + '">'
      + media + corner
      + (post.__repost ? '<b class="profileRepostBadge" aria-hidden="true">⟳</b>' : '')
      + (pinnedAt > 0 ? '<b class="profileTilePinned" aria-hidden="true">📌</b>' : '')
      + '</button>'
      + pinControl
      + '</div>';
  };
  const mediaTiles = buckets.tiles.slice(0, 24).map(tileMarkup);
  // One whisper after another, the way a profile is read: identity, text, then the same
  // reaction / comment / repost controls the feed uses, so nothing here is decorative.
  const whisperCards = buckets.whispers.slice(0, 24).map((post) => {
    const id = Number(post.id);
    const control = controls?.(post) || {};
    const commentTotal = Math.max(0, Number(post.comment_count) || 0);
    const repostTotal = Math.max(0, Number(post.reposts) || 0);
    const caption = String(post.caption || '');
    // A share of someone else's whisper says so, and the whisper keeps its own author and time.
    const reposter = post.__repost || null;
    const repostLine = reposter
      ? '<div class="postRepostedBy">⟳ <b>' + esc(tr(reposter.mine ? 'x.repost.mine' : 'x.repost.by')) + '</b>'
        + (reposter.mine || !reposter.reposter?.handle ? '' : ' <bdi dir="ltr">@' + esc(reposter.reposter.handle) + '</bdi>') + '</div>'
      : '';
    return '<article class="ownerWhisperCard" data-owner-post-item="' + id + '" data-profile-post="' + id + '" data-profile-kind="text" data-post-id="' + id + '" data-post-author="' + Number(post.user_id) + '" data-post-open="' + id + '"' + postOrderAttributes(post, Number(post.created_at || 0)) + (post.__repost ? ' data-repost-entry="1"' : '') + ' role="article" tabindex="0">'
      + repostLine
      + '<header class="ownerWhisperHead"><span class="ownerWhisperAvatar">' + avatarMarkup + '</span><span class="ownerWhisperWho">'
      + '<b><bdi dir="auto">' + esc(name) + '</bdi></b>'
      + '<small><bdi dir="ltr">@' + esc(profile.handle || '') + '</bdi> · ' + esc(profileRelativeTime(post.created_at, now, locale)) + '</small></span></header>'
      + '<p class="ownerWhisperBody" dir="auto">' + esc(caption) + '</p>'
      + rankingReasonMarkup(post, { esc, t: tr, context: "profile" })
      + (control.palette || '')
      + '<div class="ownerWhisperActions">'
      + '<button class="ownerWhisperAction" type="button" data-reaction-toggle="' + id + '" aria-label="' + esc(tr('post.openReactions')) + '" aria-expanded="false">' + (control.summary || '<i class="reactionSummaryGlyphs"></i>') + '</button>'
      + '<button class="ownerWhisperAction" type="button" data-comments="' + id + '" aria-label="' + esc(tr('comments.title')) + '"><i>◌</i><small>' + commentTotal + '</small></button>'
      + '<button class="ownerWhisperAction' + (post.reposted_by_me ? ' on' : '') + '" type="button" data-repost="' + id + '" aria-label="' + esc(tr('post.repost')) + '"><i>⟳</i><small>' + repostTotal + '</small></button>'
      + '</div>'
      + (control.drawer || '')
      + '</article>';
  });
  // Shared replies are the second kind of internal share: they sit in the same archive as the
  // whispers, they say which post they came from, and tapping one opens that reply in its thread.
  const sharedReplyCards = (Array.isArray(result.shared_replies) ? result.shared_replies : [])
    .filter((entry) => entry?.comment && entry?.post)
    .slice(0, 24)
    .map((entry) => {
      const commentId = Number(entry.comment.id);
      const replyAuthor = entry.comment.display_name || entry.comment.handle || 'Nexus';
      const replyAvatar = safeUrl(entry.comment.avatar);
      const onPostBy = entry.post_author?.handle ? '@' + entry.post_author.handle : '';
      return '<article class="ownerWhisperCard ownerSharedReplyCard" data-owner-post-item="reply-' + commentId + '" data-profile-kind="text" data-shared-reply="' + commentId + '" data-shared-reply-post="' + Number(entry.post.id) + '" data-profile-stamp="' + Math.max(0, Math.floor(Number(entry.shared_at || entry.comment.created_at || 0))) + '" data-profile-score="0" data-profile-rank="0" data-profile-pin="0" role="article" tabindex="0">'
        + '<div class="postRepostedBy">⟳ <b>' + esc(tr(entry.mine ? 'x.repost.mine' : 'x.repost.by')) + '</b> <span>' + esc(tr('profile.sharedReplyOn')) + ' ' + esc(onPostBy) + '</span></div>'
        + '<header class="ownerWhisperHead"><span class="ownerWhisperAvatar">' + (replyAvatar ? '<img src="' + esc(replyAvatar) + '" alt="" />' : esc(String(replyAuthor).slice(0, 2).toUpperCase())) + '</span>'
        + '<span class="ownerWhisperWho"><b><bdi dir="auto">' + esc(replyAuthor) + '</bdi></b>'
        + '<small><bdi dir="ltr">@' + esc(entry.comment.handle || '') + '</bdi> · ' + esc(profileRelativeTime(entry.comment.created_at, now, locale)) + '</small></span></header>'
        + '<p class="ownerWhisperBody" dir="auto">' + esc(entry.comment.body || '') + '</p>'
        + '<button class="ownerSharedReplyOpen" type="button" data-open-reply="' + commentId + '">' + esc(tr('profile.openReply')) + '</button>'
        + '</article>';
    });
  // The band above the tabs says where the owner is, who they are and how much they have published, so
  // the hero stops printing the same facts a second time under the name. They stay in the document as
  // one screen-reader-only line: the band is aria-hidden decoration, and a fact that only lives inside
  // decoration would be a fact lost for whoever reads this page with a screen reader.
  const declaredAge = profile.age;
  // The band prints the age, and a band is aria-hidden decoration: the same fact is part of the facts
  // line so a screen reader reads it too. A number that is not a whole year between 13 and 120 is not
  // an age and is not printed anywhere.
  const ageFact = Number.isInteger(declaredAge) && declaredAge >= 13 && declaredAge <= 120
    ? declaredAge.toLocaleString(locale) + ' ' + tr('profile.years') : '';
  const ownerFacts = [
    profile.handle ? '@' + String(profile.handle) : '',
    String(profile.location || '').trim(),
    ageFact,
    number('posts') + ' ' + tr('profile.posts'),
    number('followers') + ' ' + tr('profile.followers'),
    number('following') + ' ' + tr('profile.following'),
  ].filter(Boolean).map((value) => esc(value)).join(' · ');
  host.innerHTML = [
    '<section class="nexusOwnerProfile" data-profile-cover="' + (cover ? '1' : '0') + '" data-cover-mode="' + coverMode + '">',
    // The cover is rendered for the owner even when the profile has none: the pencil needs a place to
    // put a new one, and CSS keeps the empty slot out of the layout until the profile is in edit mode.
    (cover || isSelf)
      ? '<div class="ownerCover" data-cover-focus="' + coverFocus + '">'
        + (cover ? '<img src="' + esc(cover) + '" alt="' + esc(tr('profile.coverAlt')) + '" style="object-position:center ' + coverFocus + '%" />' : '')
        + (isSelf
          ? '<button type="button" class="ownerCoverEdit" data-hero-photo="cover" aria-label="' + esc(tr('profileEdit.changeCover')) + '" title="' + esc(tr('profileEdit.changeCover')) + '"><i aria-hidden="true">▣</i><span>' + esc(tr('profileEdit.changeCover')) + '</span></button>'
            + '<input class="heroFileInput" data-hero-file="cover" type="file" accept="image/jpeg,image/png,image/webp" hidden />'
          : '')
        + '</div>'
      : '',
    '<div class="ownerHero">',
    '<div class="ownerIdentity">',
    // The photo is the avatar; the badge that appears while the profile is in edit mode is a sibling
    // button, so tapping the photo outside editing keeps opening the story or the portrait.
    '<div class="ownerAvatarSlot">'
      + '<button type="button" class="ownerAvatar" aria-label="' + esc(tr('profile.moments')) + '">' + avatarMarkup + (stories.length ? '<b></b>' : '') + '</button>'
      + (isSelf
        ? '<button type="button" class="ownerAvatarEdit" data-hero-photo="avatar" aria-label="' + esc(tr('profileEdit.changeAvatar')) + '" title="' + esc(tr('profileEdit.changeAvatar')) + '">＋</button>'
          + '<input class="heroFileInput" data-hero-file="avatar" type="file" accept="image/jpeg,image/png,image/webp" hidden />'
        : '')
      + '</div>',
    '<div class="ownerIdentityText">',
    // The name line carries the name and the two chips that belong to it, on one row: the presence dot
    // first, then the name, then the lock. The words behind the dot live in its tooltip and its
    // accessible name - a name line that also prints "Online" spends the row on a second fact. The field
    // that edits the name is not here: it is a row of the panel below, with its own name above it.
    '<h1>',
    presenceTone
      ? '<em class="ownerPresence is' + (presenceTone === 'online' ? 'Online' : 'Away') + '" role="img" aria-label="' + esc(tr(presenceTone === 'online' ? 'profile.presenceOnline' : 'profile.presenceAway')) + '" title="' + esc(tr(presenceTone === 'online' ? 'profile.presenceOnline' : 'profile.presenceAway')) + '"><i></i></em>'
      : '',
    (isSelf
      ? '<bdi class="heroEditable" dir="auto" data-hero-edit="name" data-hero-value="' + attr(name) + '" role="textbox" tabindex="0" aria-label="' + esc(tr('profile.editName')) + '">' + esc(name) + '</bdi>'
      : '<bdi dir="auto">' + esc(name) + '</bdi>'),
    visibilityBadge,
    '</h1>',
    // The handle and the three counters are the band's content now, so the hero keeps only what the
    // band cannot carry: the facts once for the screen reader, and the presence dot on the name line.
    '<p class="ownerFacts">' + ownerFacts + '</p>',
    // The three bars are the last thing on the name line, inside it: every setting of this profile opens
    // from here, and because they are part of the line the sign, the name and the bars can never drift onto
    // two rows - which is what a floating third column did whenever the row grew.
    isSelf
      ? '<div class="ownerMenuSlot"><button type="button" class="ownerMenuButton" data-owner-menu aria-haspopup="dialog" aria-expanded="false" aria-label="' + esc(tr('profileMenu.open')) + '"><i class="ownerMenuBars" aria-hidden="true"><b></b><b></b><b></b></i></button></div>'
      : '',
    '</div>',
    '</div>',
    '<div class="ownerBioBlock">',
    // The description is read in the band and edited in the panel, so the hero keeps one paragraph for the
    // screen reader and no second copy of the words on the screen itself.
    '<p class="ownerBio' + (isSelf ? ' isEditable' : '') + (profile.bio ? '' : ' isEmpty') + '" data-hero-bio-text>' + (isSelf
      ? '<bdi class="heroEditable" dir="auto" data-hero-edit="bio" data-hero-value="' + attr(profile.bio || '') + '" role="textbox" tabindex="0" aria-label="' + esc(tr('profile.editBio')) + '">' + (profile.bio ? bioOf(profile.bio) : esc(tr('profile.bioPlaceholder'))) + '</bdi>'
      : (profile.bio ? bioOf(profile.bio) : esc(tr('profile.bioPlaceholder')))) + '</p>',
    '</div>',
    // The edit page is a panel: one card, four fields, each field with its own name above it, all the same
    // width and the same height. Before this, pressing the pencil dropped boxes into the text of the
    // profile - a small frame for the city, a different one for the date, loose text around them - and the
    // page was a form only by accident. The fields stay here while the profile is being edited, and the
    // panel is not in the document at all for a reader.
    isSelf
      ? '<div class="heroEditorPanel" data-hero-editor-panel>'
        + '<label class="heroField isWide"><span>' + esc(tr('profileEdit.rowName')) + '</span>'
        + '<input class="heroEditorInput" data-hero-input="name" maxlength="50" value="' + esc(name) + '" dir="auto" aria-label="' + esc(tr('profile.editName')) + '" hidden /></label>'
        + '<label class="heroField isWide"><span>' + esc(tr('profileEdit.rowStatus')) + '</span>'
        + '<textarea class="heroEditorInput" data-hero-input="bio" rows="3" maxlength="300" dir="auto" aria-label="' + esc(tr('profile.editBio')) + '" hidden>' + esc(profile.bio || '') + '</textarea></label>'
        // The city is chosen from the list the picker carries, and the field is the same size as the others:
        // the frame is what tells the owner this is a field, so it cannot be a chip next to one.
        + '<div class="heroField"><span>' + esc(tr('profileEdit.city')) + '</span>'
        + '<div class="ownerLocationRow" data-owner-location-row>'
        + '<button type="button" class="ownerLocation" data-owner-location="' + attr(profile.location || '') + '" aria-haspopup="listbox" aria-expanded="false" aria-label="' + esc(tr('profile.locationAction')) + '" title="' + esc(tr('profile.locationAction')) + '"><i aria-hidden="true">📍</i><span>' + esc(profile.location || tr('profile.locationAdd')) + '</span></button>'
        + locationPickerMarkup({ esc, t: tr })
        + '</div></div>'
        // The date of birth keeps its label and gets the same frame: two short fields, one row, one size.
        + '<label class="heroField ownerBirthField"><span>' + esc(tr('profileEdit.birth')) + '</span>'
        + '<input class="heroEditorInput heroBirthInput" data-hero-input="birth" data-hero-value="' + birthValue + '" type="date" min="1900-01-01" max="' + todayIso + '"'
        + ' value="' + birthValue + '"'
        + ' aria-label="' + esc(tr('profileEdit.birth')) + '" /></label>'
        + '</div>'
      : '',
    '</div>',
    // The hero holds the identity only. The tabs, the media grid, the whispers and the empty states
    // are siblings again, so they stretch the whole screen width instead of sitting inside the
    // identity's padding — that padding is what turned the tab bar into a floating black box.
    '</div>',
    // The row the identity is read on is one row: the sign, the name and the bars. Under it sits the shelf
    // of saved stories, for a profile that chose the stories instead of a cover, and then the band: the
    // order the owner reads the page in is the order the page is built in.
    '<div class="ownerStoryRail" data-owner-story-rail>',
    storyTiles.length
      ? '<header><b>' + esc(tr('profile.moments')) + '</b><small>' + esc(tr('profileEdit.coverModeStoriesHint')) + '</small></header>'
        + '<div class="ownerStoryTiles">' + storyTiles.join('') + '</div>'
      : '<p>' + esc(tr('profile.empty.moments.detail')) + '</p>',
    '</div>',
    // The band sits directly above the tabs and it is decoration with a contract: read-only, moving
    // right to left, and built only from what the hero already says. The owner's two controls are
    // siblings of the band, not passengers inside it: the pencil waits at the right end of the row and
    // the same square becomes the check that saves, so the button never moves under the owner's finger.
    // A private profile keeps the band out of a reader's payload: the band is the owner's own desk, and
    // a public profile shares it with everyone who can read the profile at all.
    showTicker ? '<div class="ownerTickerRow">' : '',
    showTicker ? profileTickerMarkup(profile, { esc, t: tr, locale, speed: tickerSpeed }) : '',
    isSelf
      ? '<div class="ownerHeroActions">'
        + '<button type="button" class="heroIconButton" data-owner-edit aria-label="' + esc(tr('profile.editAction')) + '" title="' + esc(tr('profile.editAction')) + '">✎</button>'
        + '<button type="button" class="heroIconButton heroConfirm" data-hero-confirm="profile" aria-label="' + esc(tr('profile.confirmBio')) + '" title="' + esc(tr('profile.confirmBio')) + '" hidden>✓</button>'
        + '</div>'
      : '',
    showTicker ? '</div>' : '',
    // The bar is five icons in the order this profile keeps: the name of a tab lives in its label and its
    // tooltip instead of on the bar, and the owner can drag a tab to another place. The order is saved for
    // this profile, so the bar reads the same way for everyone who opens it - an arrangement only means
    // something if the next reader sees it.
    // Nothing about the readings is on screen unless it is asked for: the bar ends in one arrow, the arrow
    // opens the readings of the tab the reader is on, and a reading chosen there stays that tab's reading.
    '<div class="ownerTabsRegion">',
    '<nav class="ownerContentTabs" role="tablist" aria-label="' + esc(tr('profile.contentTabs')) + '" data-owner-tab-bar>'
      + tabOrder.map((kind, index) => '<button type="button" role="tab" data-owner-content="' + kind + '" data-reading="' + readingOf(kind) + '" aria-selected="' + (index === 0) + '" aria-label="' + esc(tabLabel(kind)) + '" title="' + esc(tabLabel(kind)) + (isSelf ? ' · ' + esc(tr('profile.tabsHint')) : '') + '"><i aria-hidden="true">' + CONTENT_TAB_GLYPHS[kind] + '</i></button>').join('')
      + '</nav>',
    // The arrow says what it opens, in words, for whoever cannot see it: the name of the control plus the
    // reading that is on right now.
    '<button type="button" class="ownerFiltersToggle" data-owner-filters-toggle aria-expanded="false" aria-controls="owner-content-filters" aria-label="' + esc(tr('profile.filtersToggle') + ': ' + readingLabel(readingOf(tabOrder[0]), tr)) + '" title="' + esc(tr('profile.filtersToggle') + ': ' + readingLabel(readingOf(tabOrder[0]), tr)) + '"><span aria-hidden="true">▾</span></button>',
    '<div class="ownerContentFilters" id="owner-content-filters" data-owner-filters role="group" aria-label="' + esc(tr('profile.filters')) + '" hidden>'
      + CONTENT_FILTERS.map((id, index) => '<button type="button" data-owner-filter="' + id + '" aria-pressed="' + (index === 0) + '">' + esc(readingLabel(id, tr)) + '</button>').join('')
      + '</div>',
    '</div>',
    // The Flow is one timeline, not two lists: the same nodes the other tabs read are woven into this stream
    // in the order they were written, so a clip, a whisper and a photo follow each other by time. The nodes
    // move between this stream and their own homes; nothing is rendered twice.
    '<div class="ownerFlowStream" data-owner-flow-stream hidden></div>',
    '<div class="ownerPostGrid">' + mediaTiles.join('') + '</div>',
    '<div class="ownerWhisperList" role="region" aria-label="' + esc(tr('profile.tabWhispers')) + '">' + whisperCards.join('') + sharedReplyCards.join('') + '</div>',
    // The saved-story shelf is a tab of its own: the same tiles, inside the archive where a reader looks
    // for them, and out of the hero — which is where the cover gets its height back.
    '<div class="ownerMomentsPanel" data-owner-panel="moments" hidden><header><b>' + esc(tr(albumTiles.length ? 'x.profile.albums' : 'profile.moments')) + '</b></header><div>' + (albumTiles.length ? albumTiles.join('') : storyTiles.join('')) + '</div></div>',
    '<div class="ownerEmptyStates">' + Object.keys(CONTENT_KINDS).map((kind, index) => emptyStateBlock(kind, esc, tr, index !== 0)).join('') + '</div>',
    '</section>',
  ].join('');
  // The lock beside the name is the door to the setting behind it: the profile shows what it is, the
  // panel behind this press is where it is changed, and nothing is edited in place.
  host.querySelector('[data-owner-visibility]')?.addEventListener('click', () => { onVisibility?.(); });
  host.querySelector('.ownerAvatar')?.addEventListener('click', () => {
    // An active story wins; without one the avatar opens the profile photo itself, with no
    // reactions and no rail, because there is nothing to react to in a portrait.
    if (stories.length) return onStory?.(0, stories);
    if (avatar) onAvatarPhoto?.(avatar, name);
  });
  host.querySelectorAll('[data-profile-album]').forEach((button) => button.addEventListener('click', () => {
    const album = albums[Number(button.dataset.profileAlbum)];
    if (album?.stories?.length) onStory?.(0, album.stories);
  }));
  // The pencil is the whole page's editor: it opens the name, the description, the location and the two
  // photos, and one check saves whatever changed. The wire-up below keeps `onEdit` alive, but the pencil
  // is no longer a route to the Settings form.
  host.querySelectorAll('[data-profile-moment]').forEach((button) => button.addEventListener('click', () => onStory?.(Number(button.dataset.profileMoment), stories)));
  host.querySelectorAll('[data-profile-open]').forEach((button) => button.addEventListener('click', () => onOpenPost?.(Number(button.dataset.profileOpen), posts)));
  const emptyStates = host.querySelectorAll('[data-owner-empty-for]');
  // Every post is one node, wherever it is read: a wrapped tile for a photo or a clip, a card for a
  // whisper. The Flow weaves those same nodes into one timeline, and the other tabs read them in their own
  // homes - the grid for the media, the list for the words. Nodes move, they are never copied.
  const stream = host.querySelector('[data-owner-flow-stream]');
  const grid = host.querySelector('.ownerPostGrid');
  const list = host.querySelector('.ownerWhisperList');
  const items = [...host.querySelectorAll('[data-owner-post-item]')];
  const homeOf = new Map(items.map((node) => [node, node.parentElement]));
  const filtersRow = host.querySelector('[data-owner-filters]');
  const tabBar = host.querySelector('[data-owner-tab-bar]');
  // A press that carried a tab is not a tap on it: a touch fires a click after the finger lifts, and that click
  // has to be swallowed for a moment after a drop - otherwise moving a tab would also select it and open its
  // filters. One timestamp is all that needs to be remembered.
  let arrangedAt = 0;
  const orderNumber = (node, key) => Math.max(0, Number(node?.dataset?.[key] || 0));
  const byNewest = (a, b) => orderNumber(b, 'profileStamp') - orderNumber(a, 'profileStamp');
  const byPopular = (a, b) => orderNumber(b, 'profileScore') - orderNumber(a, 'profileScore') || byNewest(a, b);
  const byRelevant = (a, b) => orderNumber(b, 'profileRank') - orderNumber(a, 'profileRank') || byPopular(a, b);
  // A pin is a decision about this profile, so on a tab that reads as a collection of clips the pinned ones
  // come first, oldest pin first, and everything else stays chronological. The Flow is a timeline and stays
  // one: there a pin is only a mark on the post, because a timeline that jumps is not a timeline.
  const byPinnedThen = (sorter) => (a, b) => {
    const pinA = orderNumber(a, 'profilePin');
    const pinB = orderNumber(b, 'profilePin');
    if ((pinA > 0) !== (pinB > 0)) return pinA > 0 ? -1 : 1;
    if (pinA > 0 && pinB > 0 && pinA !== pinB) return pinA - pinB;
    return sorter(a, b);
  };
  let currentTab = tabOrder[0];
  // Applying an order is the same act everywhere: the nodes this tab shows are put back in the container they
  // are read in, in the order that tab's reading chose. Nothing is re-rendered, so nothing loses its wiring.
  const applyOrder = (filter = readingOf(currentTab), kind = currentTab) => {
    const sorter = filter === 'popular' ? byPopular : filter === 'relevant' ? byRelevant : byNewest;
    const hoistPins = kind === 'reels' || kind === 'shots';
    const ordered = items.filter((node) => !node.hidden).sort(hoistPins ? byPinnedThen(sorter) : sorter);
    for (const node of ordered) (kind === 'flow' ? stream : homeOf.get(node))?.append(node);
    // The icon states the reading it is showing, so the owner never has to open a filter to know which one is
    // on - and a tab that is not on the default carries a mark.
    const button = tabBar?.querySelector('[data-owner-content="' + kind + '"]');
    if (button) button.dataset.reading = filter;
    // Which posts the owner put first is stated on the tiles themselves, so a reader never has to guess why
    // the order is what it is.
    items.forEach((node) => node.classList.toggle('isPinnedFirst', hoistPins && orderNumber(node, 'profilePin') > 0 && !node.hidden));
  };
  const syncContentTab = (kind) => {
    currentTab = kind;
    // The Flow is the one tab where the nodes leave their homes: they are woven into the stream by time.
    if (kind === 'flow') {
      if (stream) items.slice().sort(byNewest).forEach((node) => stream.append(node));
    } else {
      items.forEach((node) => homeOf.get(node)?.append(node));
    }
    let shown = 0, tilesShown = 0, whispersShown = 0;
    const wanted = CONTENT_KINDS[kind];
    items.forEach((item) => {
      item.hidden = wanted !== null && item.dataset.profileKind !== wanted;
      if (item.hidden) return;
      shown++;
      if (item.dataset.profileKind === 'text') whispersShown++;
      else tilesShown++;
    });
    if (stream) stream.hidden = kind !== 'flow';
    if (grid) grid.hidden = kind === 'flow' || tilesShown === 0;
    if (list) list.hidden = kind === 'flow' || whispersShown === 0;
    // The saved stories are neither a post nor a whisper: their shelf answers to its own tab.
    const moments = host.querySelector('.ownerMomentsPanel');
    if (moments) moments.hidden = kind !== 'moments';
    // A tab that was left keeps the reading its owner gave it: what changes is the tab, not the filter.
    applyOrder(readingOf(kind), kind);
    emptyStates.forEach((block) => { block.hidden = shown > 0 || block.dataset.ownerEmptyFor !== kind; });
  };
  // The readings are behind one arrow, and nothing else about them is on screen: the arrow opens the list of
  // ways to read the tab the reader is on, says which one is on, and closes on the next tap anywhere else.
  const filtersToggle = host.querySelector('[data-owner-filters-toggle]');
  const closeFilters = () => {
    if (!filtersRow || filtersRow.hidden) return;
    filtersRow.hidden = true;
    filtersRow.style.removeProperty('--filters-left');
    filtersRow.removeAttribute('data-owner-filters-for');
    filtersToggle?.setAttribute('aria-expanded', 'false');
  };
  // The arrow reports the reading of the tab it belongs to, so the state of the list needs no second look.
  const syncFiltersToggle = (kind) => {
    if (!filtersToggle) return;
    const reading = readingOf(kind);
    const label = tr('profile.filtersToggle') + ': ' + readingLabel(reading, tr);
    filtersToggle.hidden = kind === 'moments';
    filtersToggle.setAttribute('aria-label', label);
    filtersToggle.setAttribute('title', label);
    filtersToggle.dataset.reading = reading;
  };
  const openFilters = (kind) => {
    if (!filtersRow || !filtersToggle || kind === 'moments') return;
    filtersRow.dataset.ownerFiltersFor = kind;
    filtersRow.hidden = false;
    filtersRow.querySelectorAll('[data-owner-filter]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.ownerFilter === readingOf(kind)));
    });
    // The list is measured where it is drawn, then placed under the arrow: an element that is hidden reports no
    // width, and a width guessed from nothing puts the list in the wrong place.
    const width = filtersRow.offsetWidth || 240;
    const left = Math.max(4, Math.min(filtersToggle.offsetLeft + filtersToggle.offsetWidth / 2 - width / 2, (filtersToggle.parentElement?.clientWidth || width) - width - 4));
    filtersRow.style.setProperty('--filters-left', Math.round(left) + 'px');
    filtersToggle.setAttribute('aria-expanded', 'true');
  };
  host.querySelectorAll('[data-owner-content]').forEach((tab) => tab.addEventListener('click', () => {
    // A press that carried the tab is not a press that opens anything: the click a finger leaves behind after a
    // move is ignored, so one gesture never does two things.
    if (Date.now() - arrangedAt < 700) return;
    const kind = tab.dataset.ownerContent;
    host.querySelectorAll('[data-owner-content]').forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
    onTabLeave?.();
    // Choosing a tab is choosing a tab: the readings stay behind the arrow they belong to.
    closeFilters();
    syncContentTab(kind);
    syncFiltersToggle(kind);
    // The content tabs live inside the hero. When a settings panel replaced the hero,
    // selecting a tab must bring it back instead of updating a hidden grid.
    onContentTab?.(kind);
  }));
  // The arrow is what opens the readings, and pressing it again closes them.
  filtersToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!filtersRow.hidden && filtersRow.dataset.ownerFiltersFor === currentTab) closeFilters();
    else openFilters(currentTab);
  });
  // One reading, one press: the same nodes read in another order, the tab stays the tab it was, and the
  // icon keeps the reading for the next time it is opened.
  host.querySelectorAll('[data-owner-filter]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const kind = filtersRow?.dataset.ownerFiltersFor || currentTab;
    readings.set(kind, button.dataset.ownerFilter);
    filtersRow?.querySelectorAll('[data-owner-filter]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === button)));
    if (currentTab === kind) applyOrder(button.dataset.ownerFilter, kind);
    else tabBar?.querySelector('[data-owner-content="' + kind + '"]')?.setAttribute('data-reading', button.dataset.ownerFilter);
    syncFiltersToggle(kind);
    closeFilters();
  }));
  // A tap anywhere else closes the list, and Escape does too, because a reading is not a screen. The listener
  // lives on this host, so it dies with the element when the page is drawn again.
  host.addEventListener?.('click', (event) => {
    if (!filtersRow || filtersRow.hidden) return;
    if (event.target?.closest?.('[data-owner-filters], [data-owner-filters-toggle]')) return;
    closeFilters();
  });
  host.addEventListener?.('keydown', (event) => { if (event.key === 'Escape') closeFilters(); });
  syncFiltersToggle(currentTab);
  // The pin is the owner's own arrangement of their own archive, so the control is drawn for the owner
  // alone and the server decides whether a fourth pin fits.
  host.querySelectorAll('[data-pin-post]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pinned = button.getAttribute('aria-pressed') !== 'true';
    button.disabled = true;
    Promise.resolve(onPinPost?.(Number(button.dataset.pinPost), pinned)).catch(() => {}).finally(() => { button.disabled = false; });
  }));
  // Moving a tab is what a finger does after it has held the tab down, and that order matters: a touch that
  // starts with a movement is a scroll, not a drag. So the tab is picked up only once the press has lasted
  // long enough to mean it, and from that moment the move belongs to this code - the page stops scrolling
  // under the finger, the tab travels over its neighbours, and letting go saves the order for this profile.
  // Arrow keys do the same for whoever cannot hold.
  if (tabBar) {
    const HOLD_MS = 320;
    const SLOP_PX = 12;
    let holdTimer = null;
    let dragging = null;
    let startX = 0, startY = 0, orderAtPick = '';
    const tabButtons = () => [...tabBar.querySelectorAll('[data-owner-content]')];
    const orderOf = () => tabButtons().map((button) => button.dataset.ownerContent);
    const saveOrder = () => { void onTabsOrder?.(orderOf()); };
    const moveTab = (button, direction) => {
      const buttons = tabButtons();
      const index = buttons.indexOf(button);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= buttons.length) return false;
      tabBar.insertBefore(button, direction < 0 ? buttons[next] : buttons[next].nextSibling);
      return true;
    };
    const stopHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    const pickUp = (button, pointerId) => {
      dragging = button;
      orderAtPick = orderOf().join(',');
      arrangedAt = Date.now();
      tabBar.classList.add('isArranging');
      button.classList.add('isLifted');
      // The capture is what keeps the moves coming to this tab once the finger leaves it.
      try { button.setPointerCapture(pointerId); } catch { /* capture is an enhancement */ }
    };
    const drop = () => {
      stopHold();
      if (!dragging) return;
      const moved = orderOf().join(',') !== orderAtPick;
      dragging.classList.remove('isLifted');
      tabBar.classList.remove('isArranging');
      dragging = null;
      arrangedAt = Date.now();
      if (moved) saveOrder();
    };
    tabButtons().forEach((button) => {
      button.addEventListener('keydown', (event) => {
        if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
        event.preventDefault();
        if (moveTab(button, event.key === 'ArrowLeft' ? -1 : 1)) saveOrder();
        button.focus();
      });
      if (!isSelf) return;
      button.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        startX = event.clientX; startY = event.clientY;
        stopHold();
        holdTimer = setTimeout(() => { holdTimer = null; pickUp(button, event.pointerId); }, HOLD_MS);
      });
      // A finger that moves before the hold is over is scrolling the page, and that is not this gesture.
      button.addEventListener('pointermove', (event) => {
        if (dragging) return;
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > SLOP_PX) stopHold();
      });
      button.addEventListener('pointerup', stopHold);
      button.addEventListener('pointercancel', () => { stopHold(); if (dragging) drop(); });
    });
    // Once the tab is in the hand, the browser is told to keep its hands off the gesture: this is what makes a
    // hold-and-move work on a touch screen instead of turning into a scroll half a second in.
    tabBar.addEventListener('touchmove', (event) => { if (dragging) event.preventDefault(); }, { passive: false });
    tabBar.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      event.preventDefault();
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-owner-content]');
      if (!over || over === dragging || !tabBar.contains(over)) return;
      const buttons = tabButtons();
      const from = buttons.indexOf(dragging);
      const to = buttons.indexOf(over);
      if (from < 0 || to < 0) return;
      // The carried tab takes the place of the tab it reached, and everything between follows it.
      tabBar.insertBefore(dragging, from < to ? over.nextSibling : over);
    });
    tabBar.addEventListener('pointerup', drop);
    tabBar.addEventListener('pointercancel', drop);
    if (isSelf) tabBar.classList.add('isArrangable');
  }
  syncContentTab(tabOrder[0]);
  // A shared reply is opened where it was written, not as a copy on the profile.
  host.querySelectorAll("[data-open-reply]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    void onOpenReply?.(Number(button.dataset.openReply));
  }));
  // The owner profile is in the DOM now: the host wires the shared post actions
  // (reaction palette, conversation, repost) on the whisper cards.
  onRendered?.(host, posts);
}

export function bindProfilePullRefresh(screen, refresh) {
  if (!screen) return;
  let startY = null, startX = null, armed = false, pending = false;
  const reset = () => { startY = startX = null; armed = false; screen?.classList.remove('profilePullReady'); };
  screen.addEventListener('touchstart', (event) => {
    if (pending || !screen.isConnected || screen.scrollTop > 0 || event.touches.length !== 1
        || event.target?.closest?.('input, textarea, select, [contenteditable], .profileSettingsArea, [role="dialog"]')) return reset();
    startY = event.touches[0].clientY; startX = event.touches[0].clientX;
  }, { passive: true });
  screen.addEventListener('touchmove', (event) => {
    if (startY === null) return;
    if (!screen.isConnected || screen.scrollTop > 0 || event.touches.length !== 1) return reset();
    const dy = event.touches[0].clientY - startY, dx = Math.abs(event.touches[0].clientX - startX);
    armed = dy > 72 && dy > dx * 1.4;
    screen.classList.toggle('profilePullReady', armed);
  }, { passive: true });
  screen.addEventListener('touchend', async () => {
    const run = armed && !pending && screen.isConnected;
    reset();
    if (!run) return;
    pending = true;
    try { await refresh(); }
    finally { pending = false; }
  }, { passive: true });
  screen.addEventListener('touchcancel', reset, { passive: true });
}
