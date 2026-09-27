// The feed surface: one page, three ways to read it.
//
// Reels, Whispers and News are three different contracts on the same screen, so the mode is the one
// place that decides what is asked for and what is drawn: FEED_MODE_CONTRACT maps a mode to the
// lens/format pair the feed API already understands, and every renderer here is a pure function of
// data the server sent. Nothing is invented - a whisper shows the text it has plus a real audio
// attachment when the post carries one, a news card shows what the approved aggregator sent, and a
// reel keeps the clip card the rest of the app already uses.
//
// The module owns markup and its own bindings only; app.js owns state, requests and the card
// actions (reaction, comments, repost, save, share), which is why the cards below carry exactly the
// data-* hooks wirePostActions() already answers to.

export const FEED_MODES = Object.freeze(["reels", "whispers", "news"]);

// Mode -> API contract. `format` and `lens` are the values the server validates, so a mode can
// never ask for something the feed endpoint would answer differently.
export const FEED_MODE_CONTRACT = Object.freeze({
  reels: Object.freeze({ tab: "profile.tabReels", glyph: "▶", kind: "feed.kindClips", format: "clips", lens: null }),
  whispers: Object.freeze({ tab: "profile.tabWhispers", glyph: "❝", kind: "feed.kindTweets", format: "tweets", lens: "for-you" }),
  news: Object.freeze({ tab: "feed.breaking", glyph: "▤", kind: "feed.breaking", format: "posts", lens: "breaking" }),
});

// The destinations the feed still has, now that the lens line is gone: they live in the source sheet
// ("which source am I reading"), one press away, instead of printed under the switch. News and Whispers
// are not here - they are the switch itself.
export const FEED_DESTINATIONS = Object.freeze([
  Object.freeze(["for-you", "feed.mix", "feed.forYouDetail"]),
  Object.freeze(["local", "feed.local", "feed.localDetail"]),
  Object.freeze(["global", "feed.global", "feed.globalDetail"]),
  Object.freeze(["following", "feed.following", "feed.friendsDetail"]),
  Object.freeze(["photos", "feed.photos", "feed.photosDetail"]),
  Object.freeze(["friends", "feed.friends", "feed.friendsDetail"]),
  Object.freeze(["private", "feed.private", "feed.privateDetail"]),
]);

// One section of the source sheet: what the feed reads, then how it is shown. The two display choices
// were in the old feed sheet; they are here so nothing was lost when the line left the feed.
export function feedSourceSectionMarkup({ t, esc, current, presentation = "cards", mediaFit = "fill" }) {
  const button = (attributes, glyph, title, detail, active) => '<button type="button" ' + attributes + ' class="' + (active ? "active" : "") + '"><i><strong>' + glyph + '</strong></i><span><b>' + esc(title) + '</b><small>' + esc(detail) + '</small></span><em>' + (active ? "Activ" : "›") + '</em></button>';
  return [
    '<h3 class="profileSwitcherSectionTitle">' + esc(t("feed.sectionTitle")) + '</h3>',
    '<div class="profileHubGrid feedSourceGrid" data-feed-source>',
    FEED_DESTINATIONS.map(([id, titleKey, detailKey]) => button('data-feed-destination="' + id + '"', id === "for-you" ? "✦" : id === "local" ? "⌖" : id === "global" ? "◉" : id === "following" ? "✓" : id === "photos" ? "▦" : id === "friends" ? "◎" : "▣", t(titleKey), t(detailKey), id === current)).join(""),
    button("data-feed-presentation", presentation === "cards" ? "▤" : "⛶", t("profile.settingPresentation"), t(presentation === "cards" ? "profile.presentationCards" : "profile.presentationImmersive"), false),
    button("data-feed-fit", mediaFit === "fill" ? "⬛" : "▢", t("profile.settingMediaFit"), t(mediaFit === "fill" ? "profile.fitFill" : "profile.fitFit"), false),
    '</div>',
  ].join("");
}

// The three answers the section can give, wired by the screen that owns the state.
export function bindFeedSourceSection(root, { onDestination, onPresentation, onFit } = {}) {
  root.querySelectorAll("[data-feed-destination]").forEach((button) => button.addEventListener("click", () => onDestination?.(button.dataset.feedDestination)));
  root.querySelector("[data-feed-presentation]")?.addEventListener("click", () => onPresentation?.());
  root.querySelector("[data-feed-fit]")?.addEventListener("click", () => onFit?.());
}

export function feedModeForFeed(feed) {
  if (feed === "tweets") return "whispers";
  if (feed === "breaking") return "news";
  return "reels";
}

// The walk a horizontal swipe takes through the three readings: the same order the rail prints, wrapping
// at both ends, so the gesture and the rail can never disagree about what comes next.
export function nextFeedMode(mode, offset = 1) {
  const index = Math.max(0, FEED_MODES.indexOf(mode));
  return FEED_MODES[(index + Number(offset || 0) + FEED_MODES.length) % FEED_MODES.length];
}

// The header names only the reading that is open. Neighbouring readings stay available through the same
// horizontal swipe and keyboard walk, but their marks are not duplicated in the bar.
export function feedModeSwitchMarkup({ active, t, esc }) {
  const titles = { reels: "profile.tabReels", whispers: "profile.tabWhispers", news: "feed.breaking" };
  const current = FEED_MODES.includes(active) ? active : FEED_MODES[0];
  const label = t(titles[current]);
  return '<nav class="feedModes" role="tablist" aria-label="' + esc(t("feed.modesLabel")) + '" data-feed-modes data-feed-mode-active="' + esc(current) + '">'
    + '<div class="feedModeRow">'
    + '<button type="button" role="tab" data-feed-mode="' + current + '" aria-selected="true" id="feedModeCurrent" tabindex="0" class="active" aria-label="' + esc(label) + '" title="' + esc(label) + '"><i aria-hidden="true">' + FEED_MODE_CONTRACT[current].glyph + '</i></button>'
    + '</div></nav>';
}

// The rail answers for itself wherever it is drawn: a press selects a reading, and the two arrow keys walk the
// same order the words print in - the walk `nextFeedMode` describes - so a reader on a keyboard moves exactly
// as far as a swipe does, and a word that moved never answers from a stale tablist. The bar's other
// behaviour is bound here too: on a reel the bar folds back (wave 14g), and that fold is measured from the
// column, which lives on the screen the bar belongs to.
export function bindFeedModeRail(root, { current, onSelect } = {}) {
  root.querySelectorAll("[data-feed-mode]").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.feedMode)));
  root.querySelector("[data-feed-modes]")?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    onSelect(nextFeedMode(current(), event.key === "ArrowRight" ? 1 : -1));
    root.querySelector("#feedModeCurrent")?.focus({ preventScroll: true });
  });
  bindReelChromeFold(root.closest(".phoneScreen"), { header: root.querySelector("#phoneHeader") });
}

// The one drawing left in this module: the way out of the session, which is the last tile of the drawer.
// It is inline SVG for the same reason the bottom bar uses inline SVG - an emoji is a different drawing
// on every device.
const FEED_ICONS = Object.freeze({
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v9"/><path d="M7.05 5.7a8 8 0 1 0 9.9 0"/></svg>',
  // Two stacked displays with opposing source chevrons: this is a source/module switch, never logout.
  // Logout keeps its own red power mark inside the drawer.
  modules: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="12" height="9" rx="2"/><rect x="9" y="11" width="12" height="9" rx="2"/><path d="M5 17h3m-1.7-1.7L8 17l-1.7 1.7M19 7h-3m1.7-1.7L16 7l1.7 1.7"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>',
});

// Wave 14h took the bar's one door off it, reading the owner's mark of "the screen with an arrow" as that
// door. Wave 14i: he corrected the reading - the mark he wanted gone was the gear drawn over the reel, and
// the door he wanted back is this one. It is the single button of wave 14g, in the same place on the right
// of the bar, and it opens the same drawer: `bindFeedHub` listens for `data-feed-quick-open` on the whole
// phone screen, so this button and the `menu` mark of the bottom bar open one drawer and read out one name.
export function feedHeaderActionsMarkup({ t, esc }) {
  return '<div class="feedHeaderIcons"><button class="feedHeaderIcon" id="feedModules" type="button" data-feed-quick-open aria-haspopup="dialog" aria-expanded="false" aria-label="' + esc(t("header.changeProfile")) + '" title="' + esc(t("header.changeProfile")) + '">' + FEED_ICONS.modules + '</button></div>';
}

// The last row of the drawer the last button of the bar opens. It lives beside that button so the drawer
// ends the same way wherever it is opened from, and it is the one row here that ends the session.
export function feedDrawerEndMarkup({ t, esc }) {
  return '<div class="profileSwitcherEnd"><button type="button" data-profile-logout><i style="--profile-color:#ff5d7a" aria-hidden="true"><strong>⇥</strong></i><span><b>'
    + esc(t("x.profile.logout")) + '</b><small>' + esc(t("profile.logoutConfirm")) + '</small></span><em aria-hidden="true">›</em></button></div>';
}

// Wave 14g: the one door left on the bar, drawn. The owner asked for a drawer that is small and has no
// words in it, so this is a grid of marks - one tile per module of Nexus, the one being read marked, and
// the last tile ends the session. Nothing textual is printed, but nothing is hidden from a screen reader
// either: every tile carries the label the app already has for it, and no new copy was written.
export function feedQuickDrawerMarkup({ t, esc }) {
  return '<div class="feedQuickLayer" data-feed-quick-layer hidden>'
    + '<div class="feedQuickBackdrop" data-feed-quick-backdrop aria-hidden="true"></div>'
    + '<section class="feedQuickDrawer" role="dialog" aria-modal="true" aria-label="' + esc(t("header.changeProfile")) + '" tabindex="-1" data-feed-quick-drawer>'
    + '<button type="button" class="feedQuickClose" data-feed-quick-close aria-label="' + esc(t("common.close")) + '" title="' + esc(t("common.close")) + '">' + FEED_ICONS.close + '</button>'
    + '<div class="feedQuickGrid" data-feed-quick-grid></div>'
    + '<button type="button" class="feedQuickLogout" data-feed-quick-logout aria-label="' + esc(t("x.profile.logout")) + '" title="' + esc(t("x.profile.logout")) + '">' + FEED_ICONS.logout + '</button>'
    + '</section></div>';
}

// The tiles, drawn from the state at the moment the drawer opens: the module you are reading is marked on
// each open, so a drawer that moved never answers from a stale list.
export function feedQuickTilesMarkup({ esc, modules = [] }) {
  return modules.map((module) => '<button type="button" data-feed-quick-module="' + esc(module.id) + '" class="' + (module.active ? "active" : "") + '" style="--profile-color:' + esc(module.color || "#20e0d0") + '" aria-label="' + esc(module.title) + '" title="' + esc(module.title) + '" aria-pressed="' + String(Boolean(module.active)) + '"><i aria-hidden="true"><strong>' + esc(module.glyph || "◆") + '</strong></i></button>').join("");
}

// The drawer answers for itself, wherever it is drawn: a press on the button opens it, a press on a tile
// switches module and closes it, the last tile ends the session, and Esc, a tap beside it or the button
// again put the reader back where they were, with the focus on the button that opened it. The listener is
// delegated on the phone screen because the bar is re-rendered whenever a counter changes, and a listener
// bound to a button would die with the button it was bound to.
export function bindFeedHub(mount, { build, onModule, onLogout } = {}) {
  if (!mount || mount.dataset.feedHubBound === "true") return null;
  mount.dataset.feedHubBound = "true";
  const layer = mount.querySelector("[data-feed-quick-layer]");
  const drawer = mount.querySelector("[data-feed-quick-drawer]");
  const grid = mount.querySelector("[data-feed-quick-grid]");
  if (!layer || !drawer || !grid) return null;
  let openedBy = null;
  const openers = () => [...mount.querySelectorAll("[data-feed-quick-open]")];
  const close = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    openers().forEach((button) => button.setAttribute("aria-expanded", "false"));
    openedBy?.focus?.({ preventScroll: true });
    openedBy = null;
  };
  mount.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target === layer || target.closest("[data-feed-quick-backdrop], [data-feed-quick-close]")) { close(); return; }
    const opener = target.closest("[data-feed-quick-open]");
    if (opener) {
      if (layer.hidden) {
        openedBy = opener;
        if (build) grid.innerHTML = build();
        layer.hidden = false;
        drawer.focus({ preventScroll: true });
      } else close();
      openers().forEach((button) => button.setAttribute("aria-expanded", String(!layer.hidden && button === opener)));
      return;
    }
    // A tile that is not the way out switches the module; either way the drawer is done with.
    const tile = target.closest("[data-feed-quick-module]");
    if (tile) { close(); onModule?.(tile.dataset.feedQuickModule); return; }
    if (target.closest("[data-feed-quick-logout]")) { close(); onLogout?.(); }
  });
  // Esc stands down while something is layered above the drawer (a viewer, an account modal), the same
  // rule the panel this drawer replaces obeyed.
  mount.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || layer.hidden) return;
    if (document.querySelector(".storyViewer, .account-modal, .reelViewer, .mediaViewer")) return;
    event.stopPropagation();
    close();
  });
  return { close, isOpen: () => !layer.hidden };
}

// The reel carries no name any more. The owner moved the profile up the rail, above the button that
// likes, so the words left the overlay and the mark went where a thumb already is. It is still the button
// it always was - it opens the creator's moment - so the card binds it the way it always did.
export function clipCreatorAvatarMarkup({ esc, t, handle, name, avatar }) {
  return '<button class="clipRailAvatar" data-creator-story="' + esc(handle) + '" type="button" aria-label="' + esc(t("post.openStory") + " " + name) + '"><i>' + avatar + '</i></button>';
}

// The reel owns the whole screen while it plays, so the two things on the bar that are about being
// somewhere else - the wordmark and the one door - leave from the second reel on, and the reader keeps
// the rail, which says which reading they are in. Only a full-screen reel folds the bar: a text reading
// and the card presentation keep it, so a reading that is not the one this was written for never wears
// the state. The listener is bound on the phone screen, once: the column it measures is replaced on every
// load of the feed, and a listener bound to the column would die with it. `scroll` does not bubble, so
// this one listens in the capture phase, which is how a scroll of a replaced child still reaches the
// parent that stayed. Binding again re-measures instead of binding twice, so the state is re-read on
// every render of the bar.
const feedFoldBindings = new WeakMap();

export function bindReelChromeFold(screen, { header = null, column = "#pulsePosts" } = {}) {
  if (!screen) return;
  const current = feedFoldBindings.get(screen);
  if (current) {
    current.header = header || screen.querySelector("#phoneHeader");
    current.column = column;
    current.measure();
    return;
  }
  const binding = {
    header: header || screen.querySelector("#phoneHeader"),
    column,
    measure: null,
  };
  binding.measure = () => {
    const bar = binding.header?.isConnected ? binding.header : screen.querySelector("#phoneHeader");
    binding.header = bar;
    const view = screen.querySelector(".clipsScreen");
    const host = view?.querySelector(binding.column);
    if (!bar || !view?.classList.contains("feed-reels") || !view.classList.contains("presentation-immersive") || !host) {
      bar?.classList.remove("feedChromeFolded");
      return;
    }
    const firstReel = host.querySelector(":scope > .clipCard");
    const height = Number(firstReel?.getBoundingClientRect?.().height || host.clientHeight || 0);
    const threshold = height > 0 ? height * 0.5 : 240;
    bar.classList.toggle("feedChromeFolded", Number(host.scrollTop || 0) >= threshold);
  };
  feedFoldBindings.set(screen, binding);
  screen.addEventListener("scroll", binding.measure, { capture: true, passive: true });
  requestAnimationFrame(binding.measure);
}

// Skeletons are the layout that is coming, not a spinner: the reader sees where the cards will be.
export function feedSkeletonMarkup({ mode, t, esc, count = 3 }) {
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    if (mode === "news") {
      cards.push('<article class="feedSkeletonCard feedSkeletonNews"><span class="skeletonKicker"></span><span class="skeletonLine wide"></span><span class="skeletonLine"></span><span class="skeletonMeta"></span></article>');
    } else if (mode === "whispers") {
      cards.push('<article class="feedSkeletonCard feedSkeletonWhisper"><header><span class="skeletonAvatar"></span><span class="skeletonName"></span></header><span class="skeletonLine wide"></span><span class="skeletonLine"></span><span class="skeletonLine short"></span><footer><span class="skeletonAction"></span><span class="skeletonAction"></span><span class="skeletonAction"></span></footer></article>');
    } else {
      cards.push('<article class="feedSkeletonCard feedSkeletonReel"><header><span class="skeletonAvatar"></span><span class="skeletonName"></span></header><span class="skeletonMedia"></span><footer><span class="skeletonAction"></span><span class="skeletonAction"></span><span class="skeletonAction"></span></footer></article>');
    }
  }
  return '<div class="feedSkeleton" data-feed-skeleton role="status" aria-live="polite"><span class="feedSkeletonLabel">' + esc(t("feed.loading")) + '</span>' + cards.join("") + '</div>';
}

export function feedEmptyMarkup({ mode, t, esc }) {
  // News has its own honest sentence: an empty list there means the aggregator had nothing, not
  // that the reader has nothing to read.
  const title = mode === "news" ? t("feed.breakingEmpty") : t("feed.empty");
  const detail = mode === "whispers" ? t("profile.empty.whispers.detail") : "";
  return '<div class="feedState" data-feed-state="empty" role="status"><i aria-hidden="true">◌</i><b>' + esc(title) + '</b>'
    + (detail ? '<span>' + esc(detail) + '</span>' : '')
    + '<button type="button" data-feed-refresh>' + esc(t("feed.pullRefresh")) + '</button></div>';
}

// A failed request says so and offers the same request again; it never shows half a feed.
export function feedErrorMarkup({ mode, t, esc }) {
  return '<div class="feedState feedStateError" data-feed-state="error" role="alert"><i aria-hidden="true">!</i><b>' + esc(t("feed.unavailable")) + '</b>'
    + '<span>' + esc(mode === "news" ? t("feed.breakingDisabledDetail") : t("search.unavailableDetail")) + '</span>'
    + '<button type="button" data-feed-retry>' + esc(t("live.retry")) + '</button></div>';
}

// The shelf of moments as the feed reads it: one card per story, the first one being the reader's
// own door to the camera. The class names the shelf already used (`storyCard`, `storyPrism`,
// `storyViewed`, `prismStoryCard`) are kept, so the peek gesture, the seen/unseen state and the
// viewer keep answering to the same hooks; only the shape the reader sees is new.
export function feedStoryRailMarkup({ stories, owner, t, esc, mediaUrl }) {
  const selfName = (owner && (owner.display_name || owner.handle)) || t("profile.selfPrefix");
  const selfInitials = esc(selfName.slice(0, 2).toUpperCase());
  const selfAvatar = owner?.avatar ? '<img src="' + esc(owner.avatar) + '" alt="" loading="lazy" decoding="async" />' : "";
  const own = '<button id="addStory" class="storyCard feedStoryCard feedStoryOwn" type="button" aria-label="' + esc(t("feed.yourStory")) + '">'
    + '<i class="storyPrism createPrism"><b class="storyInitials">' + selfInitials + '</b>' + selfAvatar + '<b class="storyAddBadge" aria-hidden="true">+</b></i>'
    + '<span>' + esc(t("feed.yourStory")) + '</span></button>';
  const cards = stories.map((story, index) => {
    const name = story.author?.display_name || story.author?.handle || "?";
    // A generated demo card carries its own artwork; a real card asks for its thumbnail, and one that
    // cannot be loaded removes itself so the initials behind it are what the reader sees.
    const source = story.media?.src || (story.media?.hash ? mediaUrl?.(story) : "");
    const real = Boolean(source) && (Boolean(story.media?.src) || Number(story.id) > 0);
    const visual = real && story.media?.kind === "image" ? '<img src="' + esc(source) + '" alt="" loading="lazy" decoding="async" />'
      : real && story.media?.kind === "video" ? '<video src="' + esc(source) + '#t=0.1" muted playsinline preload="metadata"></video>'
        : "";
    const econ = story.economy?.collectible ? '<strong>Collect</strong>' : story.economy?.unlock ? '<strong>$</strong>' : "";
    // An unseen story keeps the accent ring; a seen one loses it and dims, so the rail says what is
    // new without a legend.
    return '<button class="storyCard prismStoryCard feedStoryCard ' + (visual ? "" : "storyPlain ") + (story.viewed_by_me ? "storyViewed" : "storyUnseen") + '" data-story="' + esc(story.id) + '" type="button" title="' + esc(story.caption || name) + '">'
      + '<i class="storyPrism a' + (index % 4) + '">' + (visual ? "" : '<b class="storyInitials" aria-hidden="true">' + esc(name.slice(0, 2).toUpperCase()) + '</b>') + visual + '<em>' + esc(name.slice(0, 1).toUpperCase()) + '</em>' + econ
      + '<b class="storyName" dir="auto">' + esc(name) + '</b></i></button>';
  });
  return own + cards.join("");
}

// One listener per rail: a picture that failed to load is removed, so the initials behind it are shown
// instead of the browser's broken-picture glyph. It is a wiring, not a retry - the server was asked once.
export function bindStoryImages(root) {
  if (!root || root.dataset.pictureFallback === "true") return;
  root.dataset.pictureFallback = "true";
  root.addEventListener("error", (event) => {
    const node = event.target;
    if (node && (node.tagName === "IMG" || node.tagName === "VIDEO")) node.remove();
  }, true);
}

// Wave 14f: the 18px auto-hide that folded the shelf of moments - and, with it, the rail of readings -
// was deleted with its two classes. The owner moved both controls to places that do not scroll: the shelf
// is the first thing the Messages screen prints (see `inboxShell` in messenger-shell.js) and the rail of
// readings sits on the bar, above the column. A control on a fixed bar has nothing to step out of the way
// of, so `feedScrolled` and `storiesCollapsed` no longer decide anything on the feed, and the swipe - which
// never listened on either of them - is untouched.

// Wave 14b: a generated card carries its own artwork (public/demo-stories) instead of a missing hash.
// A local host shows them only while there are fewer than four real stories, so the shelf is never
// empty on a machine that has no friends yet — and a real story always wins a place.
export function demoHumanExperienceStories() {
  return [
    { id: -7201, user_id: 92001, persona: "social", caption: "Nexus Motion · demo local", author: { id: 92001, handle: "nexus.motion", display_name: "Nexus Motion" }, media: { kind: "image", src: "/demo-stories/story-cove.svg" }, view_progress: 0 },
    { id: -7202, user_id: 92002, persona: "social", caption: "City lights · demo local", author: { id: 92002, handle: "aria.motion", display_name: "Aria Motion" }, media: { kind: "image", src: "/demo-stories/story-city.svg" }, view_progress: 0 },
    { id: -7203, user_id: 92003, persona: "social", caption: "Third perspective · demo local", author: { id: 92003, handle: "nova.frames", display_name: "Nova Frames" }, media: { kind: "image", src: "/demo-stories/story-mountain.svg" }, view_progress: 0 },
    { id: -7204, user_id: 92004, persona: "social", caption: "Creator world · demo local", author: { id: 92004, handle: "orbit.viewer", display_name: "Orbit Viewer" }, media: { kind: "image", src: "/demo-stories/story-island.svg" }, view_progress: 0 },
    { id: -7205, user_id: 92005, persona: "social", caption: "Golden hour · demo local", author: { id: 92005, handle: "luca.rides", display_name: "Luca Rides" }, media: { kind: "image", src: "/demo-stories/story-road.svg" }, view_progress: 0 },
  ];
}

// A whisper is text first. The card keeps the same engagement hooks the clip card uses, so a like,
// a reply, a repost, a save and a share here travel through the code that already owns them - and a
// tap on the card itself opens the post page, which is the conversation view.
export function whisperCardMarkup(post, ctx) {
  const { esc, t, stamp, body, palette, drawer, menu, summary, repost, sigil = "", sharing = true } = ctx;
  const author = post.author || {};
  const name = author.display_name || author.handle || "";
  const handle = author.handle || "";
  const avatar = author.avatar ? '<img src="' + esc(author.avatar) + '" alt="" />' : esc(name.slice(0, 2).toUpperCase());
  const privacy = post.visibility && post.visibility !== "public"
    ? '<i class="whisperLock" aria-label="' + esc(t("feed.private")) + '" title="' + esc(t("feed.private")) + '">🔒</i>' : "";
  const attachment = post.media?.kind === "image" && post.media?.hash
    ? '<button class="whisperAttachment" type="button" data-media-post="' + Number(post.id) + '" data-media-index="0" aria-label="' + esc(t("post.openFullscreen")) + '"><img src="/media/' + esc(post.media.hash) + '.' + esc(post.media.ext) + '" alt="" loading="lazy" decoding="async" /></button>'
    : "";
  return [
    '<article class="post whisperCard" data-post-id="' + Number(post.id) + '" data-post-author="' + Number(post.user_id) + '" data-post-open="' + Number(post.id) + '"' + (post.repost ? ' data-repost-entry="1"' : '') + ' role="article" tabindex="0">',
    repost || "",
    '<header class="whisperHead">',
    '<button class="whisperAvatar" type="button" data-creator-profile="' + esc(handle) + '" aria-label="' + esc(t("post.viewProfile")) + '"><i>' + avatar + '</i></button>',
    '<span class="whisperWho"><b>' + sigil + '<button type="button" class="whisperName" data-creator-profile="' + esc(handle) + '"><bdi dir="auto">' + esc(name) + '</bdi></button></b>',
    '<small>' + esc(t("profile.tabWhispers")) + ' · ' + esc(stamp(Number(post.created_at || 0))) + '</small></span>',
    privacy,
    '<button class="whisperMenu" type="button" data-post-creator-menu aria-label="' + esc(t("post.moreCreator")) + '" aria-expanded="false">•••</button>',
    '<div class="postCreatorMenu" hidden>' + (menu || "") + '</div>',
    '</header>',
    '<p class="whisperBody" dir="auto">' + (body || "") + '</p>',
    attachment,
    feedAudioMarkup(post, { esc, t }),
    '<footer class="whisperEngagement">',
    '<button class="whisperAction" type="button" data-reaction-toggle="' + Number(post.id) + '" aria-label="' + esc(t("post.openReactions")) + '" aria-expanded="false">' + (summary || '<i class="reactionSummaryGlyphs"></i>') + '</button>',
    '<button class="whisperAction" type="button" data-comments="' + Number(post.id) + '" aria-label="' + esc(t("comments.title")) + '"><i>◌</i><small>' + Number(post.comment_count || 0) + '</small></button>',
    '<button class="whisperAction' + (post.reposted_by_me ? " on" : "") + '" type="button" data-repost="' + Number(post.id) + '" aria-label="' + esc(t("post.retweet")) + '"><i>⟳</i><small>' + Number(post.reposts || 0) + '</small></button>',
    sharing ? '<button class="whisperAction" type="button" data-share="' + Number(post.id) + '" aria-label="' + esc(t("post.share")) + '"><i>↗</i></button>' : '',
    '<button class="whisperAction' + (post.saved_by_me ? " on" : "") + '" type="button" data-save="' + Number(post.id) + '" aria-label="' + esc(t(post.saved_by_me ? "post.removeSaved" : "post.save")) + '"><i>⛊</i><small>' + esc(t(post.saved_by_me ? "post.saved" : "post.save")) + '</small></button>',
    '</footer>',
    palette || "",
    drawer || "",
    '</article>',
  ].join("");
}


// A voice note only exists when the post carries one: the button, the remaining time and the track
// are real. The track is what the reader sees until the audio is decoded on the device, after which
// the same element is drawn from the measured amplitudes - a shape nobody measured is never drawn.
export function feedAudioMarkup(post, { esc, t }) {
  const audio = post.audio;
  if (!audio?.hash) return "";
  const url = "/media/" + audio.hash + "." + String(audio.ext || "bin");
  return '<div class="feedAudio" data-feed-audio>'
    + '<button class="feedAudioToggle" type="button" data-audio-toggle aria-label="' + esc(t("post.play")) + '" aria-pressed="false"><i aria-hidden="true">▶</i></button>'
    + '<span class="feedAudioVisual"><span class="feedAudioTrack" data-audio-track><i data-audio-progress></i></span><span class="feedAudioWave" data-audio-wave aria-hidden="true" hidden></span></span>'
    + '<span class="feedAudioTime" data-audio-time>0:00</span>'
    + '<small class="feedAudioLabel">' + esc(post.audio_attribution || t("post.audioOriginal")) + '</small>'
    + '<audio preload="none" playsinline src="' + esc(url) + '"></audio>'
    + '</div>';
}

const WAVE_BUCKETS = 28;
// Decoding is a device cost, so each file is measured once and only a bounded number of files stay
// in memory. A file larger than this is played without a shape instead of being decoded.
const WAVE_MAX_BYTES = 8 * 1024 * 1024;
const waveCache = new Map();

async function amplitudesFor(url) {
  if (!url || !/^\/media\//.test(url)) return null;
  if (waveCache.has(url)) return waveCache.get(url);
  const pending = (async () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (typeof Context !== "function") return null;
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > WAVE_MAX_BYTES) return null;
    const context = new Context();
    try {
      const decoded = await context.decodeAudioData(buffer);
      const channel = decoded.getChannelData(0);
      const size = Math.max(1, Math.floor(channel.length / WAVE_BUCKETS));
      const peaks = [];
      for (let bucket = 0; bucket < WAVE_BUCKETS; bucket += 1) {
        let peak = 0;
        for (let offset = 0; offset < size; offset += 1) peak = Math.max(peak, Math.abs(channel[bucket * size + offset] || 0));
        peaks.push(Math.max(.08, Math.min(1, peak)));
      }
      return peaks;
    } finally { context.close?.().catch(() => {}); }
  })().catch(() => null);
  if (waveCache.size >= 24) waveCache.delete(waveCache.keys().next().value);
  waveCache.set(url, pending);
  return pending;
}

const clockLabel = (seconds) => {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
};


export function feedMoreMarkup({ t, esc, cursor }) {
  return '<button class="socialFeedMore" type="button" data-feed-more="' + esc(cursor) + '">' + esc(t("search.more")) + '</button>';
}


// One binding for every voice note in a list. Nothing loads until the reader presses play, only one
// note plays at a time, and a note whose card leaves the screen pauses instead of talking alone.
export function bindFeedAudio(root, { t }) {
  const players = [...root.querySelectorAll("[data-feed-audio]")].filter((node) => node.dataset.audioWired !== "true");
  if (!players.length) return () => {};
  const pauseOthers = (keep) => players.forEach((node) => {
    const element = node.querySelector("audio");
    if (element && element !== keep) element.pause();
  });
  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (!entry.isIntersecting) entry.target.querySelector("audio")?.pause(); });
  }, { root: root.matches?.(".pulsePosts") ? root : null, threshold: [.2, .6] }) : null;
  players.forEach((node) => {
    node.dataset.audioWired = "true";
    const audio = node.querySelector("audio");
    const toggle = node.querySelector("[data-audio-toggle]");
    const glyph = toggle?.querySelector("i");
    const progress = node.querySelector("[data-audio-progress]");
    const time = node.querySelector("[data-audio-time]");
    if (!audio || !toggle) return;
    const sync = () => {
      const playing = !audio.paused;
      toggle.setAttribute("aria-pressed", String(playing));
      toggle.setAttribute("aria-label", t(playing ? "post.pause" : "post.play"));
      if (glyph) glyph.textContent = playing ? "❚❚" : "▶";
      node.classList.toggle("playing", playing);
    };
    const paint = () => {
      const duration = Number(audio.duration);
      const elapsed = Number(audio.currentTime);
      if (progress && Number.isFinite(duration) && duration > 0) progress.style.width = Math.min(100, (elapsed / duration) * 100).toFixed(2) + "%";
      // While something is playing the label counts down, which is what a listener wants to know.
      if (time) time.textContent = clockLabel(Number.isFinite(duration) && duration > 0 ? duration - elapsed : elapsed);
    };
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (audio.paused) {
        pauseOthers(audio);
        audio.play().then(() => { void drawWave(node, audio); }).catch(() => sync());
      } else audio.pause();
    });
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("loadedmetadata", paint);
    observer?.observe(node);
  });
  return () => observer?.disconnect();
}

async function drawWave(node, audio) {
  const wave = node.querySelector("[data-audio-wave]");
  const track = node.querySelector("[data-audio-track]");
  if (!wave || wave.dataset.drawn === "1") return;
  const peaks = await amplitudesFor(String(audio.currentSrc || audio.getAttribute("src") || ""));
  if (!peaks?.length || !wave.isConnected) return;
  wave.innerHTML = peaks.map((value) => '<i style="--h:' + Math.round(value * 100) + '%"></i>').join("");
  wave.hidden = false;
  if (track) track.hidden = true;
  wave.dataset.drawn = "1";
}

