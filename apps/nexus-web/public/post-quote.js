// Quote posts and text pages answer the same question: what does a post look like when it is not
// a video? Both are pure markup, so they live here and app.js keeps only the wiring.
//
// A quote is a conversation, not a card: the commentary on top, then the post it answers, then
// (when it exists) the post that one answered. The walk is capped and cycle-safe, because a
// record that points back at itself must never trap a reader.
export const QUOTE_CHAIN_LAYERS = 3;

// A post without media is not a missing clip: the text itself is the page. Long text is paginated
// at word boundaries, one 9:16 page each, so a thought is read like a reel instead of a wall.
export const TEXT_PAGE_LIMIT = 380;

export function quoteChainFor(post, maxLayers = QUOTE_CHAIN_LAYERS) {
  const layers = [];
  const seen = new Set();
  let cursor = post?.quoted_post || null;
  while (cursor && layers.length < maxLayers) {
    const id = Number(cursor.id);
    if (!Number.isFinite(id) || seen.has(id)) break;
    seen.add(id);
    layers.push(cursor);
    cursor = cursor.quoted_post || null;
  }
  return layers;
}

export function quoteLayerMarkup(layer, { esc, t, captionHtml, mediaList, mediaUrl, stamp }, index = 0, { interactive = true } = {}) {
  const author = layer?.author || {};
  const name = String(author.display_name || author.handle || "Creator");
  const handle = String(author.handle || "creator");
  const initials = name.slice(0, 2).toUpperCase();
  const portrait = author.avatar
    ? '<img class="postQuoteAvatar" src="' + esc(author.avatar) + '" alt="" loading="lazy" />'
    : '<span class="postQuoteAvatar" aria-hidden="true">' + esc(initials) + '</span>';
  const first = mediaList(layer)[0] || null;
  const source = first ? mediaUrl(first) : null;
  const caption = String(layer?.caption || "").trim();
  const when = layer?.created_at ? " · " + esc(stamp(layer.created_at)) : "";
  const open = interactive
    ? ' role="link" tabindex="0" data-quote-open="' + Number(layer?.id || 0) + '" aria-label="' + esc(t("post.quoteOpen")) + '"'
    : '';
  return '<div class="postQuoteLayer' + (index ? ' postQuoteOlder' : '') + '"' + open + '>'
    + '<header>' + portrait + '<b><bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(handle) + '</bdi>' + when + '</small></header>'
    + (caption ? '<p>' + captionHtml(caption) + '</p>' : '')
    + (source ? '<span class="postQuoteThumb">' + (first.kind === "video"
      ? '<video src="' + esc(source) + '" muted playsinline preload="metadata"></video>'
      : '<img src="' + esc(source) + '" alt="" loading="lazy" />') + '</span>' : '')
    + '</div>';
}

export function quotedPostMarkup(post, context, { layers = QUOTE_CHAIN_LAYERS } = {}) {
  const chain = quoteChainFor(post, Math.max(1, layers));
  if (!chain.length) return "";
  return '<div class="postQuoteChain" role="group" aria-label="' + context.esc(context.t("post.quotedFrom")) + '">'
    + chain.map((layer, index) => quoteLayerMarkup(layer, context, index)).join("")
    + '</div>';
}

// The composer shows the quoted post under the commentary field, so the reader always knows what
// the new text is answering before pressing Publică.
export function composerQuoteMarkup(post, context) {
  if (!post) return "";
  return '<section class="composerQuote" aria-label="' + context.esc(context.t("post.quotedFrom")) + '">'
    + '<small>' + context.esc(context.t("composer.quoteHint")) + '</small>'
    + quoteLayerMarkup(post, context, 0, { interactive: false })
    + '<input type="hidden" name="quoted_post_id" value="' + Number(post.id) + '" />'
    + '</section>';
}

export function textPagesFor(text, limit = TEXT_PAGE_LIMIT) {
  const source = String(text ?? "").trim();
  if (!source) return [];
  const pages = [];
  let rest = source;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.55) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.55) cut = limit;
    pages.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pages.push(rest);
  return pages.filter(Boolean);
}

export function textStageMarkup(post, context) {
  const pages = textPagesFor(post?.caption);
  if (!pages.length) return "";
  return '<div class="clipTextStage" data-text-stage="' + Number(post.id) + '" role="group" aria-label="' + context.esc(context.t("post.textPages")) + '">'
    + '<div class="clipTextTrack" tabindex="0">'
    + pages.map((page, index) => '<div class="clipTextPage" data-page="' + index + '"><p>' + context.captionHtml(page) + '</p></div>').join("")
    + '</div>'
    + (pages.length > 1 ? '<span class="mediaCounter postTextCounter" aria-live="polite">1/' + pages.length + '</span>' : '')
    + '</div>';
}

// The three interactive pieces share one binder: a quoted layer opens the post it shows, the quote
// action starts a composer that already knows what it answers, and a text page reports the page the
// reader stopped on. Nothing here decides anything on its own; every action is handed in.
export function bindPostQuoteSurface(root, { openPostDetail, findPost, openComposer, toast, t }) {
  root.querySelectorAll("[data-quote-open]").forEach((layer) => {
    const open = (event) => {
      event.stopPropagation();
      openPostDetail(Number(layer.dataset.quoteOpen), { from: layer });
    };
    layer.addEventListener("click", open);
    layer.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== layer) return;
      event.preventDefault();
      open(event);
    });
  });
  root.querySelectorAll("[data-quote]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const post = findPost(Number(button.dataset.quote));
    if (!post) return toast(t("post.quoteFailed"));
    openComposer(post);
  }));
  root.querySelectorAll("[data-text-stage]").forEach((stage) => {
    const track = stage.querySelector(".clipTextTrack");
    const counter = stage.querySelector(".postTextCounter");
    track?.addEventListener("scroll", () => {
      const width = track.clientWidth || 1;
      const pages = Math.max(1, Math.round(track.scrollWidth / width));
      const page = Math.max(0, Math.min(pages - 1, Math.round(track.scrollLeft / width)));
      if (counter) counter.textContent = (page + 1) + "/" + pages;
    }, { passive: true });
  });
}
