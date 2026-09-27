// Nexus post page — the surface that opens when a tweet card is tapped.
//
// Design contract (see planning/NX-SOCIAL-X-SURFACE-v1.md):
//  - the post is read large, the way X reads a post, not inside a small drawer;
//  - replies are read as tweets and carry the same actions as the post above them;
//  - every counter comes from the server exactly as counted, and a counter with no real
//    readers yet is hidden instead of being shown as a decorative zero.
//
// The module receives the interface helpers it needs (translation, escaping, requests, the
// shared action wiring), so it stays testable in Node and does not duplicate app.js.

export function postDetailReplyMarkup(comment, context, depth = 0) {
  const { esc, t, reactionSummaryMarkup, relativeStamp, safeUrl, menuMarkup } = context;
  const id = Number(comment.id);
  // The staircase: every answer sits one step further in, and past five steps the depth stops
  // growing so a long thread stays readable on a phone.
  const level = Math.max(0, Math.min(5, Number(depth) || 0));
  const name = comment.display_name || comment.handle || "Nexus";
  const avatarUrl = safeUrl(comment.avatar);
  const counts = comment.reactions?.counts || {};
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const viewerReaction = comment.reactions?.viewer_reaction || null;
  const withdrawn = comment.status === "withdrawn";
  const views = Math.max(0, Number(comment.views) || 0);
  const shares = Math.max(0, Number(comment.reply_shares) || 0);
  // "Replying to @x" is a fact from the record, not a guess from the page: the parent author travels
  // with the reply precisely so a deep-linked reply still says who it answers.
  const parentAuthor = comment.parent_author || null;
  const contextLine = parentAuthor && Number(comment.parent_id || 0) && !parentAuthor.withdrawn
    ? '<p class="detailReplyContext">' + esc(t("x.reply.inReplyTo")) + ' <bdi dir="ltr">@' + esc(parentAuthor.handle || "user") + '</bdi></p>'
    : parentAuthor && Number(comment.parent_id || 0)
      ? '<p class="detailReplyContext isWithdrawn">' + esc(t("x.reply.parentWithdrawn")) + '</p>'
      : '';
  return [
    '<article class="detailReply" data-reply-id="' + id + '" data-depth="' + level + '" style="--depth:' + level + '">',
    '<header class="detailReplyHead"><i>' + (avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(String(name).slice(0, 2).toUpperCase())) + '</i>',
    '<span><b><bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(comment.handle || "user") + '</bdi> · ' + esc(relativeStamp(comment.created_at)) + '</small></span>',
    '<button type="button" data-comment-more="' + id + '" aria-label="' + esc(t("x.menu.title")) + '" aria-expanded="false">•••</button></header>',
    withdrawn
      ? '<p class="detailReplyBody isWithdrawn">' + esc(t("comments.withdrawn")) + '</p>'
      : '<p class="detailReplyBody" dir="auto">' + esc(comment.body || "") + '</p>',
    contextLine,
    total ? reactionSummaryMarkup(counts) : '',
    '<div class="detailReplyActions">',
    '<button type="button" data-comment-like="' + id + '" class="' + (viewerReaction ? "on" : "") + '" aria-label="' + esc(t("post.reactions")) + '">♡ <small>' + total + '</small></button>',
    withdrawn ? '' : '<button type="button" data-reply-to="' + id + '" data-reply-handle="' + esc(comment.handle || "") + '">◌ ' + esc(t("x.reply.reply")) + '</button>',
    '<button type="button" data-comment-share="' + id + '" class="' + (comment.shared_by_me ? "on" : "") + '" aria-pressed="' + (comment.shared_by_me === true) + '" aria-label="' + esc(t("x.reply.share")) + '">⟳ <small>' + shares + '</small></button>',
    '<button type="button" data-comment-save="' + id + '" class="' + (comment.saved_by_me ? "on" : "") + '">' + esc(t(comment.saved_by_me ? "post.saved" : "x.reply.save")) + '</button>',
    views > 0 ? '<span class="postViews compact" role="img" aria-label="' + esc(t("x.reply.views") + ": " + views) + '"><i aria-hidden="true">◉</i><b>' + views + '</b></span>' : '',
    '</div>',
    '<div class="detailReplyMenu" hidden>' + menuMarkup({ id: Number(comment.post_id), user_id: comment.user_id, author: { handle: comment.handle } }, { commentId: id }) + '</div>',
    '</article>',
  ].join("");
}

// A source is printed as the site it came from, never as the raw string a stranger typed, and
// the link is escaped even though the server already accepted only http(s).
function sourceLabel(value) {
  try {
    return new URL(String(value)).hostname.replace(/^www\./, "");
  } catch { return String(value); }
}

export function communityNoteSourceMarkup(note, context) {
  const { esc, t } = context;
  const sources = Array.isArray(note?.sources) ? note.sources.slice(0, 3) : [];
  if (!sources.length) return "";
  return '<ul class="communityNoteSources">' + sources.map((url) => '<li><a href="' + esc(url)
    + '" target="_blank" rel="noopener noreferrer nofollow" title="' + esc(t("x.notes.fieldSource")) + '">'
    + esc(sourceLabel(url)) + '</a></li>').join("") + '</ul>';
}

export function communityNoteComposerMarkup(postId, context) {
  const { esc, t } = context;
  return [
    '<form class="noteComposer" data-note-composer="' + Number(postId) + '" hidden>',
    '<label class="noteComposerField"><span>' + esc(t("x.notes.fieldBody")) + '</span>',
    '<textarea name="body" rows="4" minlength="12" maxlength="600" dir="auto" placeholder="' + esc(t("x.notes.bodyPlaceholder")) + '"></textarea></label>',
    [1, 2, 3].map((index) => '<label class="noteComposerField"><span>' + esc(t("x.notes.fieldSource")) + ' ' + index + '</span>'
      + '<input name="source' + index + '" type="url" inputmode="url" maxlength="300" placeholder="https://" /></label>').join(""),
    '<div class="noteComposerActions">',
    '<button type="button" class="cancelNote" data-note-cancel>' + esc(t("x.notes.cancel")) + '</button>',
    '<button class="btn small" type="submit">' + esc(t("x.notes.submit")) + '</button>',
    '</div>',
    '<p class="sheet-note">' + esc(t("x.notes.visibility")) + '</p>',
    '</form>',
  ].join("");
}

// Community context. A note is public only because other readers judged it helpful from more
// than one perspective; it explains the post and never changes what the post is. The author of
// a pending note sees their own note with its status, so nothing is moderated in the dark.
export function communityNoteMarkup(post, result, context) {
  const { esc, t, state } = context;
  const postId = Number(post?.id);
  if (!Number.isSafeInteger(postId) || postId <= 0) return "";
  const bundle = result?.community_notes || post?.community_notes || null;
  const notes = Array.isArray(bundle?.notes) ? bundle.notes : [];
  const mine = bundle?.mine || null;
  const requests = Math.max(0, Number(bundle?.counts?.requests || 0));
  const quota = result?.note_quota || null;
  const isOwner = Number(post.user_id) === Number(state.user?.id) && post.persona === state.persona;
  const shown = [];
  for (const note of notes) if (note.status === "HELPFUL") shown.push({ note, own: false });
  if (mine && mine.status !== "HELPFUL") shown.push({ note: mine, own: true });
  const card = ({ note, own }) => {
    const id = Number(note.id);
    const ratings = note.ratings || { total: 0, helpful: 0, perspectives: 0 };
    const meta = ratings.total
      ? ratings.total + " " + t("x.notes.ratingMeta") + " · " + ratings.perspectives + " " + t("x.notes.perspectiveMeta") + " · " + ratings.helpful + " " + t("x.notes.helpful")
      : t("x.notes.noRatingsYet");
    return [
      '<section class="communityNote' + (own ? " isMine" : "") + '" data-note-id="' + id + '">',
      '<header class="communityNoteHead"><b>' + esc(t(own ? "x.notes.titleMine" : "x.notes.title")) + '</b><small>' + esc(meta) + '</small></header>',
      own ? '<p class="communityNoteStatus" data-note-status="' + esc(note.status) + '">' + esc(t("x.notes.status." + note.status)) + '</p>' : '',
      '<p class="communityNoteBody" dir="auto">' + esc(note.body || "") + '</p>',
      communityNoteSourceMarkup(note, context),
      own
        ? '<div class="communityNoteActions"><button type="button" data-note-withdraw="' + id + '">' + esc(t("x.notes.withdraw")) + '</button></div>'
        : '<div class="communityNoteActions">'
          + '<button type="button" data-note-rate="' + id + '" data-helpful="1" class="' + (note.my_rating === true ? "on" : "") + '" aria-pressed="' + (note.my_rating === true) + '">' + esc(t("x.notes.helpful")) + '</button>'
          + '<button type="button" data-note-rate="' + id + '" data-helpful="0" class="' + (note.my_rating === false ? "on" : "") + '" aria-pressed="' + (note.my_rating === false) + '">' + esc(t("x.notes.notHelpful")) + '</button>'
          + '<span class="communityNoteRule">' + esc(t("x.notes.rule")) + '</span></div>',
      '</section>',
    ].join("");
  };
  const write = (!isOwner && !mine)
    ? [
      '<div class="communityNoteWrite">',
      '<button type="button" data-note-write="' + postId + '" aria-expanded="false">' + esc(t("x.notes.add")) + '</button>',
      quota ? '<small>' + esc(t("x.notes.quota") + ": " + Number(quota.notes_left)) + '</small>' : '',
      requests ? '<small>' + esc(requests + " " + t("x.notes.requested")) + '</small>' : '',
      '</div>',
      communityNoteComposerMarkup(postId, context),
    ].join("")
    : '';
  const inner = shown.map(card).join("") + write;
  if (!inner) return "";
  return '<div class="communityNotesHost" data-note-host="' + postId + '">' + inner + '</div>';
}

export function postDetailMarkup(result, options, context) {
  const { esc, t, state, postViewsMarkup, postViewsCount, reactionPaletteMarkup, reactionSummaryMarkup, followButtonLabel, relativeStamp, safeUrl, menuMarkup, sharingEnabled } = context;
  const sort = options?.sort === "newest" || options?.sort === "oldest" ? options.sort : "relevant";
  const post = result?.post || {};
  const author = post.author || {};
  const name = author.display_name || author.handle || state.user.handle || "Nexus";
  const handle = author.handle || state.user.handle || "nexus";
  const avatarUrl = safeUrl(author.avatar);
  const media = post.media ? "/media/" + post.media.hash + "." + post.media.ext : null;
  // A gallery is rendered by the same builder the timeline uses, so a carousel behaves the same
  // on both surfaces; a single media keeps the studio rendering.
  const galleryMarkup = context.carouselFor ? context.carouselFor(post) : "";
  // The context readers added: read after the post, before the replies, exactly where X puts it.
  const notesMarkup = communityNoteMarkup(post, result, context);
  const isOwner = Number(post.user_id) === Number(state.user?.id) && post.persona === state.persona;
  const comments = Array.isArray(result?.comments) ? result.comments : [];
  // One page carries whole branches (roots plus every descendant), so the staircase is built
  // here instead of asking the server for a nested shape.
  const commentIds = new Set(comments.map((comment) => Number(comment.id)));
  const childrenOf = new Map();
  for (const comment of comments) {
    const parentId = Number(comment.parent_id || 0);
    const key = parentId && commentIds.has(parentId) ? parentId : 0;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(comment);
  }
  const renderBranch = (parentId, depth) => (childrenOf.get(parentId) || [])
    .map((comment) => postDetailReplyMarkup(comment, context, depth) + renderBranch(Number(comment.id), depth + 1))
    .join("");
  const replyLadder = renderBranch(0, 0);
  const sortTabs = [["relevant", "x.detail.sortRelevant"], ["newest", "x.detail.sortNewest"], ["oldest", "x.detail.sortOldest"]];
  // Counters come from the record: with nobody counted yet the sentence omits the number
  // entirely, exactly like the badge does.
  const views = postViewsCount(post);
  const viewsSentence = '<p class="postDetailMeta">' + esc(relativeStamp(post.created_at))
    + (views ? ' · <b>' + views + '</b> ' + esc(t("x.views.detail")) : '') + '</p>';
  return [
    '<header class="postDetailBar"><button type="button" data-detail-back aria-label="' + esc(t("x.detail.back")) + '">‹</button>',
    '<button type="button" data-detail-more aria-label="' + esc(t("x.menu.title")) + '" aria-expanded="false">•••</button>',
    menuMarkup(post, { owner: isOwner, muted: result?.muted_author === true }),
    '</header>',
    '<div class="postDetailScroll">',
    '<article class="postDetailMain" data-post-id="' + Number(post.id) + '">',
    '<div class="postDetailAuthor"><i>' + (avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(String(name).slice(0, 2).toUpperCase())) + '</i>',
    '<span><b><bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(handle) + '</bdi></small></span>',
    isOwner ? '' : '<button type="button" data-follow="' + Number(post.user_id) + '" data-active="' + (post.following_me ? 1 : 0) + '" data-pending="' + (post.follow_request_pending ? 1 : 0) + '">' + esc(followButtonLabel({ active: post.following_me, pending: post.follow_request_pending })) + '</button>',
    '</div>',
    post.caption ? '<p class="postDetailText" dir="auto">' + (context.captionFor ? context.captionFor(post.caption) : esc(post.caption)) + '</p>' : '',
    galleryMarkup,
    !galleryMarkup && media ? (post.media.kind === "video"
      ? '<video class="postDetailMedia" src="' + esc(media) + '" controls muted playsinline></video>'
      : '<img class="postDetailMedia" src="' + esc(media) + '" alt="" />') : '',
    Array.isArray(post.tags) && post.tags.length
      ? '<div class="postTagRow">' + post.tags.map((entry) => '<button type="button" class="tagChip" data-tag-kind="' + esc(entry.kind) + '" data-tag="' + esc(entry.tag) + '">'
        + esc((entry.kind === "cashtag" ? "$" : "#") + (entry.display || entry.tag)) + '</button>').join("") + '</div>'
      : '',
    // Counters come from the record: with nobody counted yet the sentence simply omits it.
    viewsSentence,
    // The same reason line the feed card carries, from the same module: the post page is where a reader
    // is most likely to ask why, so it answers with the server's own signals.
    typeof context.rankingReasonMarkup === "function" ? context.rankingReasonMarkup(post, { esc, t }) : "",
    reactionPaletteMarkup(post, post.reactions?.viewer_reaction || null),
    '<div class="detailActionRow">',
    '<button type="button" data-reaction-toggle="' + Number(post.id) + '" aria-expanded="false" aria-label="' + esc(t("post.openReactions")) + '">' + reactionSummaryMarkup(post.reactions?.counts || {}) + '</button>',
    '<button type="button" data-detail-reply-focus="' + Number(post.id) + '">◌ <small>' + comments.length + '</small></button>',
    '<button type="button" data-repost="' + Number(post.id) + '" class="' + (post.reposted_by_me ? "on" : "") + '">⟳ <small>' + Number(post.reposts || 0) + '</small></button>',
    '<button type="button" data-save="' + Number(post.id) + '" class="' + (post.saved_by_me ? "on" : "") + '">' + esc(t(post.saved_by_me ? "post.saved" : "post.save")) + '</button>',
    sharingEnabled ? '<button type="button" data-share="' + Number(post.id) + '">' + esc(t("post.share")) + '</button>' : '',
    postViewsMarkup(post, { compact: true }),
    '</div>',
    '</article>',
    notesMarkup,
    '<form class="detailReplyForm" data-detail-reply="' + Number(post.id) + '" data-parent-id=""><input name="body" maxlength="1000" placeholder="' + esc(t("x.detail.replyPlaceholder")) + '" aria-label="' + esc(t("x.detail.replyPlaceholder")) + '" /><button class="cancelReply" type="button" data-cancel-detail-reply hidden aria-label="' + esc(t("comments.cancelReply")) + '">×</button><button class="btn small" type="submit">' + esc(t("x.detail.replySend")) + '</button></form>',
    '<nav class="detailSortTabs" role="tablist" aria-label="' + esc(t("x.detail.countReplies")) + '">' + sortTabs.map(([id, key]) => '<button type="button" role="tab" data-detail-sort="' + id + '" aria-selected="' + (sort === id) + '" class="' + (sort === id ? "active" : "") + '">' + esc(t(key)) + '</button>').join("") + '</nav>',
    '<div class="detailReplyList">' + (comments.length ? replyLadder : '<div class="detailEmpty"><b>' + esc(t("x.detail.noReplies")) + '</b><span>' + esc(t("x.detail.noRepliesDetail")) + '</span></div>') + '</div>',
    result?.next_cursor ? '<button class="socialFeedMore" type="button" data-detail-more-replies="' + esc(result.next_cursor) + '">' + esc(t("x.detail.loadMore")) + '</button>' : '',
    '</div>',
  ].join("");
}

// The surface owns its mount point and its request state. Everything that mutates data is
// delegated to the caller, so the post page can never invent its own rules for reactions,
// saving or moderation.
export function createPostDetailSurface(context) {
  const { esc, api, toast } = context;
  const surface = { id: null, sort: "relevant", layer: null, result: null, nextCursor: null, focusReplyId: null };
  const layerElement = () => document.getElementById("postDetail");

  const close = ({ fromHistory = false } = {}) => {
    const layer = layerElement();
    if (!layer) { surface.id = null; surface.layer = null; return false; }
    const closedId = surface.id;
    const dismissed = context.dismissOverlay?.(layer, fromHistory);
    if (!dismissed) layer.remove();
    surface.id = null;
    surface.layer = null;
    // The address bar must never keep a link to a page that is closed.
    context.afterClose?.(closedId);
    return true;
  };

  // A reply that was linked to is opened the way a linked post is: the page scrolls to it and marks
  // it, so the reader never has to hunt for the sentence the link promised.
  const focusLinkedReply = (layer) => {
    const target = Number(surface.focusReplyId || 0);
    if (!layer || !Number.isSafeInteger(target) || target <= 0) return;
    const node = layer.querySelector('[data-reply-id="' + target + '"]');
    if (!node) return;
    node.classList.add("isFocused");
    node.scrollIntoView({ block: "center" });
    node.setAttribute("aria-label", context.t("x.reply.focusLabel"));
    surface.focusReplyId = null;
  };

  const load = async ({ reset = false, quiet = false } = {}) => {
    const layer = surface.layer ?? layerElement();
    if (!layer || surface.id === null) return;
    // A quiet reload is not a new opening: it must not count another impression and it must not
    // throw the reader back to the top of the post they were reading.
    const keepScroll = quiet ? Number(layer.querySelector(".postDetailScroll")?.scrollTop || 0) : 0;
    const requestedId = surface.id;
    const cursor = reset ? 0 : Number(surface.nextCursor || 0);
    const viewerId = Number(context.state.user.id);
    const viewerPersona = context.state.persona;
    const result = await api("/api/posts/" + requestedId + "?sort=" + encodeURIComponent(surface.sort) + "&cursor=" + encodeURIComponent(cursor)).catch(() => null);
    if (!layer.isConnected || surface.id !== requestedId) return;
    if (Number(context.state.user.id) !== viewerId || context.state.persona !== viewerPersona) return;
    if (!result?.ok || Number(result.post_id) !== requestedId || !result.post || !Array.isArray(result.comments)) {
      if (reset) layer.innerHTML = '<div class="postDetailNotice">' + esc(context.t("x.detail.unavailable")) + '</div>';
      return toast(context.t("x.detail.unavailable"));
    }
    const merged = reset || !surface.result ? result : { ...result, comments: [...surface.result.comments, ...result.comments] };
    surface.result = merged;
    surface.nextCursor = result.next_cursor ?? null;
    layer.innerHTML = postDetailMarkup(merged, { sort: surface.sort }, context);
    context.wirePostActions(layer, merged.post ? [merged.post] : []);
    wire(layer);
    // What was on screen was seen: the counter only means something if opening a post counts.
    if (!quiet) context.recordImpressions?.(merged);
    const scroll = layer.querySelector(".postDetailScroll");
    if (quiet) scroll?.scrollTo({ top: keepScroll });
    else if (reset) scroll?.scrollTo({ top: 0 });
    focusLinkedReply(layer);
  };

  const submitReply = async (form) => {
    const postId = Number(form.dataset.detailReply);
    const body = String(new FormData(form).get("body") || "").trim();
    const parentId = Number(form.dataset.parentId || 0);
    if (!body || !Number.isSafeInteger(postId)) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    const result = await api("/api/posts/" + postId + "/comments", {
      method: "POST",
      headers: { "Idempotency-Key": context.newMutationKey("detail-reply") },
      body: { body, parent_id: parentId > 0 ? parentId : null },
    }).catch(() => null);
    if (submit) submit.disabled = false;
    const exact = result?.ok === true && Number(result.post_id) === postId
      && Number(result.actor_id) === Number(context.state.user.id)
      && result.actor_persona === context.state.persona
      && result.comment && Number(result.comment.id) > 0 && result.comment.body === body;
    if (!exact) return toast(context.t("x.detail.replyFailed"));
    form.reset();
    form.dataset.parentId = "";
    form.querySelector("[data-cancel-detail-reply]")?.setAttribute("hidden", "");
    const input = form.querySelector('input[name="body"]');
    if (input) input.placeholder = context.t("x.detail.replyPlaceholder");
    toast(context.t("x.detail.replyPublished"));
    await load({ reset: true });
  };

  // Writing, rating and withdrawing a note all go straight to the note endpoints; the answer is
  // checked field by field before anything is said to the reader.
  const submitNote = async (form) => {
    const postId = Number(form.dataset.noteComposer);
    if (!Number.isSafeInteger(postId) || postId <= 0) return;
    const data = new FormData(form);
    const body = String(data.get("body") || "").trim();
    const sources = [1, 2, 3].map((index) => String(data.get("source" + index) || "").trim()).filter(Boolean);
    if (body.length < 12) return toast(context.t("x.notes.bodyShort"));
    const submit = form.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    const result = await api("/api/social/posts/" + postId + "/notes", {
      method: "POST",
      headers: { "Idempotency-Key": context.newMutationKey("post-note") },
      body: { body, sources },
    }).catch(() => null);
    if (submit) submit.disabled = false;
    const exact = result?.ok === true && result.note && Number(result.note.subject_id) === postId
      && result.note.body === body && result.visibility_changed === false;
    if (!exact) {
      const quota = result?.quota || null;
      return toast(quota && Number(quota.notes_left) <= 0 ? context.t("x.notes.quotaReached") : context.t(result?.error === "author_cannot_note_own_post" ? "x.notes.ownPost" : "x.notes.writeFailed"));
    }
    form.reset();
    toast(context.t("x.notes.written"));
    await load({ reset: true, quiet: true });
  };

  const rateNote = async (button) => {
    const noteId = Number(button.dataset.noteRate || 0);
    if (!Number.isSafeInteger(noteId) || noteId <= 0) return;
    const helpful = button.dataset.helpful === "1";
    const host = button.closest(".communityNotesHost");
    host?.querySelectorAll("[data-note-rate]").forEach((other) => { other.disabled = true; });
    const result = await api("/api/social/notes/" + noteId + "/rate", {
      method: "POST",
      headers: { "Idempotency-Key": context.newMutationKey("note-rate") },
      body: { helpful },
    }).catch(() => null);
    host?.querySelectorAll("[data-note-rate]").forEach((other) => { other.disabled = false; });
    const exact = result?.ok === true && result.note && Number(result.note.id) === noteId
      && result.note.my_rating === helpful && result.visibility_changed === false;
    if (!exact) return toast(context.t("x.notes.rateFailed"));
    toast(result.status === "HELPFUL" ? context.t("x.notes.nowPublic") : context.t("x.notes.rated") + " · " + context.t("x.notes.perspective." + String(result.perspective || "unknown").toLowerCase()));
    await load({ reset: true, quiet: true });
  };

  // Sharing a reply is an internal share, exactly like a post repost: the counter changes, the reply
  // does not, and the answer is verified field by field before the reader is told anything.
  const shareReply = async (button) => {
    const commentId = Number(button.dataset.commentShare || 0);
    if (!Number.isSafeInteger(commentId) || commentId <= 0) return;
    if (button.dataset.busy === "1") return;
    const active = !button.classList.contains("on");
    button.dataset.busy = "1";
    const result = await api("/api/comments/" + commentId + "/share", {
      method: "POST",
      headers: { "Idempotency-Key": context.newMutationKey("reply-share") },
      body: { active },
    }).catch(() => null);
    delete button.dataset.busy;
    const exact = result?.ok === true && Number(result.comment_id) === commentId
      && result.shared_by_me === active && Number(result.shares) >= 0
      && result.internal_share === true && result.visibility_changed === false;
    if (!exact) return toast(context.t("x.reply.shareFailed"));
    button.classList.toggle("on", result.shared_by_me === true);
    button.setAttribute("aria-pressed", String(result.shared_by_me === true));
    const counter = button.querySelector("small");
    if (counter) counter.textContent = String(result.shares);
    toast(context.t(result.shared_by_me ? "x.reply.shared" : "x.reply.unshared"));
  };

  const withdrawNote = async (button) => {
    const noteId = Number(button.dataset.noteWithdraw || 0);
    if (!Number.isSafeInteger(noteId) || noteId <= 0) return;
    button.disabled = true;
    const result = await api("/api/social/notes/" + noteId + "/withdraw", {
      method: "POST",
      headers: { "Idempotency-Key": context.newMutationKey("note-withdraw") },
    }).catch(() => null);
    button.disabled = false;
    const exact = result?.ok === true && result.note && Number(result.note.id) === noteId && result.note.status === "WITHDRAWN";
    if (!exact) return toast(context.t("x.notes.withdrawFailed"));
    toast(context.t("x.notes.withdrawn"));
    await load({ reset: true, quiet: true });
  };

  const wire = (layer) => {
    const bar = layer.querySelector(".postDetailBar");
    bar?.querySelector("[data-detail-more]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = bar.querySelector(".postOptionsMenu");
      if (!menu) return;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      event.currentTarget.setAttribute("aria-expanded", String(opening));
    });
    layer.querySelectorAll("[data-detail-sort]").forEach((button) => button.addEventListener("click", async () => {
      if (surface.sort === button.dataset.detailSort) return;
      surface.sort = button.dataset.detailSort;
      surface.nextCursor = null;
      await load({ reset: true });
    }));
    layer.querySelector("[data-detail-reply-focus]")?.addEventListener("click", () => layer.querySelector('.detailReplyForm input[name="body"]')?.focus());
    layer.querySelectorAll("[data-reply-to]").forEach((button) => button.addEventListener("click", () => {
      const form = layer.querySelector(".detailReplyForm");
      const input = form?.querySelector('input[name="body"]');
      if (!form || !input) return;
      form.dataset.parentId = String(Number(button.dataset.replyTo));
      input.placeholder = context.t("x.detail.replyingTo") + " @" + String(button.dataset.replyHandle || "");
      form.querySelector("[data-cancel-detail-reply]")?.removeAttribute("hidden");
      input.focus();
    }));
    layer.querySelectorAll("[data-cancel-detail-reply]").forEach((button) => button.addEventListener("click", () => {
      const form = layer.querySelector(".detailReplyForm");
      if (!form) return;
      form.dataset.parentId = "";
      const input = form.querySelector('input[name="body"]');
      if (input) input.placeholder = context.t("x.detail.replyPlaceholder");
      button.setAttribute("hidden", "");
    }));
    layer.querySelector("[data-detail-reply]")?.addEventListener("submit", (event) => { event.preventDefault(); void submitReply(event.currentTarget); });
    layer.querySelector("[data-detail-more-replies]")?.addEventListener("click", () => { void load(); });
    layer.querySelectorAll("[data-comment-more]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = button.closest(".detailReply")?.querySelector(".detailReplyMenu");
      if (!menu) return;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      button.setAttribute("aria-expanded", String(opening));
    }));
    layer.querySelectorAll("[data-comment-like]").forEach((button) => button.addEventListener("click", () => { void context.toggleCommentLike(button); }));
    layer.querySelectorAll("[data-comment-save]").forEach((button) => button.addEventListener("click", () => { void context.toggleCommentSave(button); }));
    layer.querySelectorAll("[data-comment-share]").forEach((button) => button.addEventListener("click", () => { void shareReply(button); }));
    // Notes are delegated from the layer, so a note written into the page keeps working after the
    // block is redrawn from the server answer.
    layer.querySelectorAll("[data-note-rate]").forEach((button) => button.addEventListener("click", () => { void rateNote(button); }));
    layer.querySelectorAll("[data-note-withdraw]").forEach((button) => button.addEventListener("click", () => { void withdrawNote(button); }));
    layer.querySelectorAll("[data-note-write]").forEach((button) => button.addEventListener("click", () => {
      const form = layer.querySelector(".noteComposer");
      if (!form) return;
      const opening = form.hasAttribute("hidden");
      form.toggleAttribute("hidden", !opening);
      button.setAttribute("aria-expanded", String(opening));
      if (opening) form.querySelector('textarea[name="body"]')?.focus();
    }));
    layer.querySelectorAll("[data-note-cancel]").forEach((button) => button.addEventListener("click", () => {
      const form = layer.querySelector(".noteComposer");
      form?.setAttribute("hidden", "");
      layer.querySelector("[data-note-write]")?.setAttribute("aria-expanded", "false");
    }));
    layer.querySelector("[data-note-composer]")?.addEventListener("submit", (event) => { event.preventDefault(); void submitNote(event.currentTarget); });
    layer.addEventListener("click", (event) => {
      if (event.target.closest("[data-detail-back]")) { event.preventDefault(); close(); return; }
      if (event.target.closest("button, input, textarea, select, a, video, .detailReplyMenu, .postOptionsMenu, .reactionBar")) return;
      layer.querySelectorAll(".detailReplyMenu:not([hidden]), .postOptionsMenu:not([hidden])").forEach((element) => element.setAttribute("hidden", ""));
    });
    layer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } });
  };

  const open = async (postId, { from = null, sort = "relevant", focusReplyId = null, directHash = false } = {}) => {
    const id = Number(postId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    close({ fromHistory: true });
    const host = document.querySelector(".phoneScreen") || document.body;
    const returnFocus = from instanceof Element ? from : document.activeElement;
    host.insertAdjacentHTML("beforeend", '<section class="postDetailLayer" id="postDetail" role="dialog" aria-modal="true" aria-label="' + esc(context.t("x.detail.title")) + '" tabindex="-1"><div class="postDetailNotice">' + esc(context.t("x.detail.loading")) + '</div></section>');
    surface.id = id;
    surface.sort = sort;
    surface.result = null;
    surface.nextCursor = null;
    surface.focusReplyId = Number.isSafeInteger(Number(focusReplyId)) && Number(focusReplyId) > 0 ? Number(focusReplyId) : null;
    surface.layer = layerElement();
    if (!directHash) context.registerOverlay?.(surface.layer, returnFocus, () => close({ fromHistory: true }));
    // The hash is written after the overlay entry is pushed, so going Back returns to the
    // page the reader came from instead of re-opening the post.
    context.afterOverlayRegistered?.(id);
    surface.layer?.focus({ preventScroll: true });
    await load({ reset: true });
  };

  return { open, close, load, wire, submitReply, get state() { return { id: surface.id, sort: surface.sort, result: surface.result }; } };
}
