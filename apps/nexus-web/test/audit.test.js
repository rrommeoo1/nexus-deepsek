import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Static security audit for the local product. Deterministic, no network.
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
const api = await readFile(new URL("../lib/api.js", import.meta.url), "utf8");
const security = await readFile(new URL("../lib/security.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const profileExperience = await readFile(new URL("../public/profile-experience.js", import.meta.url), "utf8");
const profilePanels = await readFile(new URL("../public/profile-settings-panels.js", import.meta.url), "utf8");
const profileMenu = await readFile(new URL("../public/profile-menu.js", import.meta.url), "utf8");
const profileTicker = await readFile(new URL("../public/profile-ticker.js", import.meta.url), "utf8");
const notificationPreferences = await readFile(new URL("../public/notification-preferences.js", import.meta.url), "utf8");
const messengerShell = await readFile(new URL("../public/messenger-shell.js", import.meta.url), "utf8");
const deviceWalletEntry = await readFile(new URL("../client/device-wallet-entry.js", import.meta.url), "utf8");
const modalAccessibility = await readFile(new URL("../public/modal-accessibility.js", import.meta.url), "utf8");
const interfaceLocale = await readFile(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const client = await readFile(new URL("../public/client.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const screenShell = await readFile(new URL("../public/screen-shell.css", import.meta.url), "utf8");
// Wave 14: the feed's own surface (three modes, the shelf, the switch, the voice-note player) lives in
// its own module and its own stylesheet, the way the profile and the post page do.
const feedSurface = await readFile(new URL("../public/feed-surface.js", import.meta.url), "utf8");
const feedSurfaceCss = await readFile(new URL("../public/feed-surface.css", import.meta.url), "utf8");
const reelsReference = await readFile(new URL("../public/reels-reference.js", import.meta.url), "utf8");
const socialHumanUx = await readFile(new URL("../public/social-human-ux.css", import.meta.url), "utf8");
const visualFoundation = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");
const profileExperienceCss = await readFile(new URL("../public/profile-experience.css", import.meta.url), "utf8");
const m12Module = await readFile(new URL("../public/m12-module.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const callClient = await readFile(new URL("../public/call-client.js", import.meta.url), "utf8");
const chatCrypto = await readFile(new URL("../public/chat-crypto.js", import.meta.url), "utf8");
const media = await readFile(new URL("../lib/media.js", import.meta.url), "utf8");
const resumableUpload = await readFile(new URL("../lib/resumable-upload.js", import.meta.url), "utf8");
const database = await readFile(new URL("../lib/db.js", import.meta.url), "utf8");
const repository = await readFile(new URL("../lib/repo.js", import.meta.url), "utf8");
const environment = await readFile(new URL("../lib/env.js", import.meta.url), "utf8");
const releaseCheck = await readFile(new URL("../scripts/release-check.mjs", import.meta.url), "utf8");
const accountLifecycle = await readFile(new URL("../lib/account-lifecycle.js", import.meta.url), "utf8");
const accountPurge = await readFile(new URL("../scripts/account-purge.mjs", import.meta.url), "utf8");
const operationalControls = await readFile(new URL("../lib/operational-controls.js", import.meta.url), "utf8");
const incidentControl = await readFile(new URL("../scripts/incident-control.mjs", import.meta.url), "utf8");
const appAssetVersion = "20260928-comments24";
const appAssetPattern = new RegExp(`app\\.js\\?v=${appAssetVersion}`);
const localeAssetPattern = /interface-locale\.js\?v=20260928-comments24/;
const stylesAssetPattern = /styles\.css\?v=20260923-wave14i/;
const backupRestore = await readFile(new URL("../lib/backup-restore.js", import.meta.url), "utf8");
const recoveryDrill = await readFile(new URL("../scripts/backup-restore-drill.mjs", import.meta.url), "utf8");
const incidentRunbook = await readFile(new URL("../docs/incident-and-recovery-runbook.md", import.meta.url), "utf8");
const actionLedger = await readFile(new URL("../lib/action-ledger.js", import.meta.url), "utf8");
const actionReconcile = await readFile(new URL("../scripts/action-ledger-reconcile.mjs", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

test("server fails closed without leaking internals", () => {
  assert.match(server, /internal error/);
  assert.doesNotMatch(server, /err\.stack/);
  assert.doesNotMatch(server, /console\.log\(err/);
});

test("authentication rejects missing/invalid sessions", () => {
  assert.match(api, /not signed in/);
});

test("content is escaped on the client before insertion", () => {
  assert.match(app, /textContent/);
  assert.match(app, /esc\(/);
  assert.doesNotMatch(app, /dangerouslySetInnerHTML/);
});

test("no secrets hard-coded without env override", () => {
  assert.match(security, /process\.env\.NEXUS_SESSION_SECRET/);
  assert.match(security, /NODE_ENV === "production"/);
  assert.match(security, /NEXUS_SESSION_SECRET is required in production/);
});

test("phone Social experience has a final readability and interaction contract", () => {
  assert.match(index, /social-human-ux\.css\?v=20260914-sound1/);
  assert.match(socialHumanUx, /\.reactionSummaryGlyphs \.reactionMetric b/);
  assert.match(socialHumanUx, /font-size:15px!important/);
  assert.match(socialHumanUx, /\.presentation-cards/);
  assert.match(app, /data-social-presentation="immersive"/);
  assert.match(app, /dominantShare >= \.85/);
  assert.match(app, /function bindPrimaryReactionControl\(/);
});

test("moderation dialogs are keyboard bounded and restore focus", () => {
  assert.match(app, /event\.key === "Escape"/);
  assert.match(modalAccessibility, /event\.key !== 'Tab'/);
  assert.match(modalAccessibility, /sibling\.setAttribute\('inert', ''\)/);
  assert.match(modalAccessibility, /restoreTarget\.focus/);
  assert.doesNotMatch(app, /app\.inert = true/);
  assert.match(app, /r\.can_appeal \?/);
  assert.match(app, /t\("trust\.factualDetail"\)/);
  assert.match(app, /t\("trust\.communityFakeNote"\)/);
  assert.match(app, /const TRUST_SIGNAL_KEYS = Object\.freeze/);
  assert.match(app, /normalized\.startsWith\("SAFETY_CONTEXT_"\)/);
  assert.match(app, /trustSignalMessage\(label\.code\)/);
  assert.doesNotMatch(app, /esc\(label\.meaning\)/);
  assert.match(app, /t\("report\.syntheticNote"\)/);
  assert.match(app, /t\("review\.note"\)/);
  assert.doesNotMatch(app, /toast\(r\.error \|\| "Trust Lens/);
  assert.doesNotMatch(app, /toast\(result\.error \|\| "Contestația/);
  assert.doesNotMatch(app, /toast\(r\.error \|\| "Raportul/);
  assert.doesNotMatch(app, /output\.textContent = result\.error/);
});

test("Creator Studio is truthful, rights-gated and never auto-publishes a revision", () => {
  assert.match(app, /t\("studio\.title"\)/);
  assert.match(app, /t\("studio\.localNonDestructive"\)/);
  assert.match(app, /social_audio/);
  assert.match(app, /t\("audio\.rightsRequired"\)/);
  assert.match(app, /t\("studio\.truth"\)/);
  assert.match(app, /creatorStudioValidationKey\(fd, file, \{ socialMode, storyMode \}\)/);
  assert.match(app, /CREATOR_MEDIA_MIMES\.has\(file\.type\)/);
  assert.match(app, /CREATOR_AUDIO_MIMES\.has\(audioFile\.type\)/);
  assert.match(app, /start >= end/);
  assert.match(app, /t\("studio\.previewError"\)/);
  assert.match(interfaceLocale, /does not claim muxing\/transcoding or a licensed music catalogue/);
  assert.match(app, /t\("review\.allowed"\)/);
  assert.match(interfaceLocale, /publicarea cere încă o confirmare explicită/);
});

test("browser resumable upload preserves idempotency across lost responses and fails recoverably", () => {
  const uploadClient = app.slice(app.indexOf("class UploadClientError"), app.indexOf("function openComposer"));
  assert.match(app, /Persist the create key before the request so a lost response cannot create a duplicate session/);
  assert.match(app, /persistUploadResume\(storageKey, resume\);\s*const created = await api\("\/api\/uploads"/);
  assert.match(app, /resume\?\.createKey \? \{/);
  assert.match(app, /resume\.partKeys\[part\] \|\|= newUploadMutationKey/);
  assert.match(app, /"Idempotency-Key": resume\.completionKey/);
  assert.match(app, /"Idempotency-Key": cancellation\.cancelKey/);
  assert.match(app, /new UploadClientError\("UPLOAD_CANCELLED"\)/);
  assert.match(app, /new Set\(\["initiated", "uploading", "completed"\]\)/);
  assert.match(app, /new Set\(\["cancelled", "failed", "expired"\]\)/);
  assert.match(app, /if \(!status\.ok\) throw new UploadClientError\("UPLOAD_STATUS_UNAVAILABLE"\)/);
  assert.match(app, /if \(!completed\.ok \|\| !completed\.media\?\.hash\) throw new UploadClientError\("UPLOAD_COMPLETE_FAILED"\)/);
  assert.match(app, /setUploadFailure\(message\);\s*toast\(message\)/);
  assert.match(app, /const publishKey = form\.dataset\.publishKey/);
  assert.match(app, /const mutationKey = storyIntent\?\.key \|\| publishKey/);
  assert.match(app, /headers: \{ "Idempotency-Key": mutationKey \}/);
  assert.match(app, /prepareStoryPublishIntent\(body, publishKey\)/);
  assert.match(app, /isSafePublishedStoryResult\(r, \{ body, media, ownerId: state\.user\.id \}\)/);
  assert.match(app, /composerControls\.forEach\(\(control\) => \{ control\.disabled = true; \}\)/);
  assert.match(app, /r\.action === "post_published"/);
  assert.match(app, /JSON\.stringify\(r\.post\.creator_studio\.manifest\) === JSON\.stringify\(studioManifest\)/);
  assert.match(app, /r\.post\?\.audio_rights === fd\.get\("audio_rights"\)/);
  assert.doesNotMatch(uploadClient, /throw new Error\(created\.error/);
  assert.doesNotMatch(uploadClient, /throw new Error\(result\.error \|\| `Chunkul/);
});

test("Social shell has one global create entry and a compact top-only mode switcher", () => {
  assert.match(app, /button data-slot/);
  assert.match(app, /slot === "create"\) \{ openCreateHub\(\)/);
  assert.match(app, /modeBadge"\)\.addEventListener\("click", openProfileSwitcher\)/);
  assert.match(app, /if \(document\.getElementById\("profileSwitcherBackdrop"\)\) return closeProfileSwitcher\(\)/);
  assert.match(app, /closeSocialFeedSwitcher\(\);\s*closeSocialFriendsSwitcher\(\);/);
  assert.match(app, /\["account","◎","Profil"\]/);
  assert.doesNotMatch(app, /id="createBtn"|id="composeBtn"|id="searchBtn"/);
  assert.doesNotMatch(app, /id="notesBtn"/);
  assert.doesNotMatch(app, /id="plist"|data-persona=/);
  assert.doesNotMatch(app, /demoRibbon|phoneDemoLabel|sessionStrip|Signed in as/);
});

test("Nexus Dock owns message notifications and clip-first playback", () => {
  assert.match(app, /refreshMessageBadge/);
  assert.match(app, /class="navBadge"/);
  assert.match(app, /const unreadCount = Math\.min\(9999, unreadMessageCount \+ unreadActivityCount\)/);
  assert.match(app, /slot === "inbox" && unreadCount > 0/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /video\.muted = readSocialMuted\(\)/);
  assert.match(app, /video\.loop = true/);
  assert.match(app, /socialFormat = "clips"/);
  assert.match(app, /clipQuickActions/);
  assert.match(app, /data-clip-sound/);
  assert.match(app, /video\.controls = false/);
  assert.match(app, /event\.key !== " " && event\.key !== "Enter"/);
  assert.match(app, /SUPORT DIRECT · OPȚIONAL/);
  assert.match(app, /nu cumpără ranking organic/);
  assert.match(app, /plățile reale rămân oprite în demo/);
});

test("mobile Social shell returns Home from the logo and gives the clip most of the viewport", () => {
  assert.match(app, localeAssetPattern);
  assert.match(index, stylesAssetPattern);
  assert.match(app, /t\("header\.home"\)/);
  assert.match(interfaceLocale, /"header\.home": "Nexus Home · revino la prima pagină"/);
  assert.match(app, /document\.getElementById\("wordmark"\)\.addEventListener\("click", goHome\)/);
  assert.match(app, /class="headerSwitches"/);
  assert.match(app, /id="feedBadge"/);
  assert.match(app, /id="friendsBadge"/);
  assert.match(app, /clipMetaOverlay/);
  assert.match(app, /clipIdentityPersistent/);
  assert.match(app, /data-clip-menu/);
  assert.match(app, /clipMoreActions/);
  // The Pulse feed renders only what /api/social/feed returned: generated showcase posts
  // were removed once real catalog content was ingested into the account.
  assert.doesNotMatch(app, /demoSocialFeedPosts/);
  assert.doesNotMatch(app, /allowDemoShowcase/);
  assert.match(app, /const posts = r\.posts;/);
  assert.match(app, /function clearUnavailableFeedState\(container\)/);
  // Wave 14: one guard for both answers that are not a feed - a failed request and a page the client
  // could not verify - and it ends in a card that offers the same request again.
  assert.match(app, /if \(!r\.ok \|\| !isSafeSocialFeedPage\(r, \{ lens: requestedLens, format: requestedFormat, cursor: null, viewerId, viewerPersona \}\)\) \{/);
  assert.match(app, /container\.innerHTML = feedErrorMarkup\(\{ mode: requestedMode, t, esc \}\)/);
  assert.match(app, /r\.provider\?\.status === "disabled"\) \{ clearUnavailableFeedState\(container\)/);
  assert.match(app, /r\.near\?\.status === "consent_required"\) \{ clearUnavailableFeedState\(container\)/);
  // Wave 14b: a generated demo moment carries its own artwork (public/demo-stories), not a media hash
  // this instance may not hold.
  // Wave 14b: a generated demo moment carries its own artwork (public/demo-stories), not a media hash.
  // Wave 14d: the demo moments moved to the module that paints the shelf they fill.
  assert.match(feedSurface, /\/demo-stories\/story-cove\.svg/);
  assert.match(app, /data-clip-play/);
  assert.match(app, /clipChromeHidden/);
  assert.match(app, /bindDoubleTapHeart\(video, \{/);
  assert.match(app, /aria-label", "Deschide Reel-ul pe tot ecranul"/);
  assert.match(app, /if \(postId\) openFeedMediaViewer\(postId\)/);
  assert.match(app, /stage\.dataset\.videoAspect/);
  assert.match(app, /video\.videoWidth \/ video\.videoHeight/);
  assert.match(app, /playButton\.hidden = !video\.paused/);
  assert.match(app, /SOCIAL_SOUND_KEY/);
  assert.match(app, /localStorage\.setItem\(SOCIAL_SOUND_KEY/);
  assert.match(app, /applySocialMuted\(document, muted\)/);
  assert.match(app, /const REACTION_HOLD_MS = 180/);
  assert.match(app, /const REACTION_HOVER_MS = 110/);
  assert.match(app, /bindPrimaryReactionControl\(button, button\.closest\("article"\)\?\.querySelector\("\.reactionBar"\), root\)/);
  assert.match(app, /t\("post\.openReactions"\)/);
  assert.match(app, /\["FAKE_OPINION", "◆", "reaction\.fake"\]/);
  assert.match(app, /openReactions\.classList\.remove\("expanded"\)/);
  assert.match(app, /data-comments-scrim/);
  assert.match(app, /data-close-comments/);
  assert.match(app, /class="commentBack"/);
  assert.doesNotMatch(app, /comments-heading-/);
  assert.match(app, /event\.clientY - startY > 84/);
  assert.match(app, /event\.key !== "Escape"/);
  assert.match(app, /closeCommentsDrawer/);
  assert.match(app, /function syncCommentsMode\(\)/);
  assert.match(app, /\.clipCommentsDrawer:not\(\.hidden\)/);
  assert.match(app, /screen\.classList\.toggle\("commentsModeActive", active\)/);
  assert.match(app, /nav\.inert = active/);
  assert.match(styles, /\.phoneScreen\.commentsModeActive \.appNav\{display:none!important/);
  assert.match(styles, /\.phoneScreen\.commentsModeActive\.hasSocialTopNav \.screenViewport/);
  assert.match(app, /compareCommentImportance/);
  assert.match(app, /commentReactionTotal/);
  assert.match(app, /REACTION_GLYPHS/);
  assert.match(app, /function dominantReactionIcon\(counts = \{\}\)/);
  assert.match(app, /function reactionSummary\(counts = \{\}\)/);
  assert.match(app, /dominantShare >= \.85 \? \[\{ \.\.\.dominant, count: total \}\]/);
  assert.match(app, /ranked\.slice\(0, 3\)/);
  assert.match(app, /!\("DISLIKE" in r\.counts\)/);
  assert.match(app, /r\.private_dislike_by_me === \(active && reaction === "DISLIKE"\)/);
  assert.match(app, /class="reactionMetric"/);
  assert.match(app, /\["DISLIKE", "▼", "reaction\.dislike"\]/);
  assert.match(app, /function openCreatorStory\(handle\)/);
  assert.match(app, /data-creator-story/);
  assert.match(app, /function renderCommentThread\(comments, postId = null\)/);
  assert.match(app, /t\("comments\.replyTo"\)/);
  assert.match(app, /data-reply-handle/);
  assert.match(app, /commentsExpanded/);
  assert.match(styles, /\.clipCard\.commentsExpanded \.clipStage/);
  assert.match(app, /data-repost/);
  assert.match(app, /socialFormat === "tweets" \? "post\.retweet" : "post\.repost"/);
  assert.match(app, /t\("feed\.breakingDisabled"\)/);
  assert.match(app, /t\("feed\.nearConsentDetail"\)/);
  assert.match(app, /t\("feed\.empty"\)/);
  assert.match(app, /followButtonLabel/);
  assert.match(app, /t\("comments\.relevant"\)/);
  assert.match(app, /t\("post\.shareDisabled"\)/);
  assert.match(app, /data-post-creator-menu/);
  assert.match(app, /data-creator-profile/);
  assert.match(app, /data-creator-message/);
  assert.match(app, /function openCreatorProfile\(handle\)/);
  assert.match(app, /function messageCreator\(handle\)/);
  assert.match(app, /\.postCreatorMenu:not\(\[hidden\]\)/);
  assert.match(app, /viewerCreatorMenu/);
  assert.match(app, /viewerCreatorMore/);
  assert.match(app, /viewerCommentsOpen/);
  assert.match(app, /class="viewerActionMenu" hidden/);
  assert.match(app, /data-viewer-more/);
  assert.match(styles, /\.viewerActionMenu\[hidden\]\{display:none!important\}/);
  assert.match(app, /t\("comments\.loadError"\)/);
  assert.match(app, /data-comments-retry/);
  assert.match(app, /t\("comments\.saveError"\)/);
  assert.match(app, /data-cancel-reply/);
  assert.match(app, /input\.placeholder = t\("comments\.input"\)/);
  assert.match(styles, /\.cancelReply\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(app, /result\.error \|\| "Comentariul nu a putut/);
  assert.match(app, /toggleRepost/);
  assert.match(api, /\/api\\\/posts\\\/\\d\+\\\/repost/);
  assert.match(repository, /setPostRepost/);
  assert.match(repository, /postRepostSummary/);
  assert.match(app, /comment_preview/);
  assert.match(app, /commentAvatar/);
  assert.match(app, /renderCommentLine/);
  assert.match(styles, /\.clipCommentPreview/);
  assert.match(styles, /\.commentAvatar/);
  assert.match(styles, /\.clipPauseGlyph\{display:none!important\}/);
  assert.match(styles, /\.clipPlayState/);
  assert.match(styles, /\.clipChromeHidden \.clipMetaOverlay/);
  assert.match(styles, /\.clipCommentsDrawer\.hidden/);
  assert.match(styles, /\.appNav button i\{width:42px;height:42px/);
  assert.match(styles, /\.appNav button\.createNav i\{width:58px;height:58px/);
  assert.match(styles, /\.pulsePosts\.clipFirst \.clipCard \.clipStage\{width:100%;height:100%;min-height:100%/);
  assert.match(styles, /\.clipMetaOverlay\{position:absolute/);
  assert.match(styles, /\.clipChromeHidden \.clipIdentityPersistent/);
  assert.match(styles, /\.clipCreator\.clipIdentityPersistent\{[\s\S]*width:max-content!important/);
  assert.match(styles, /\.clipStage\.commentsOpen \.clipQuickActions/);
  assert.match(styles, /\.clipChromeHidden \.clipQuickActions,\.clipStage \.clipQuickActions/);
  // Check actual rules below, not historical prose comments removed during minification.
  assert.match(styles, /\.clipCard>\.clipMoreActions\{[\s\S]*top:54px!important;right:12px!important;bottom:auto!important/);
  assert.match(styles, /\.reelViewer\.viewerCommentsOpen \.viewerActionRail/);
  assert.match(styles, /\.clipQuickActions button,\.reelViewer \.viewerActionRail>button\{[\s\S]*background:transparent!important/);
  assert.match(styles, /\.clipCommentsDrawer \.c\.reply,\.viewerCommentsPanel \.c\.reply/);
  assert.match(styles, /\.replyContext/);
  assert.match(styles, /\.clipCreator\.clipIdentityPersistent\{grid-template-columns:max-content max-content!important/);
  assert.match(styles, /\.reactionSummaryGlyphs/);
  assert.match(styles, /\.clipsScreen\{--story-rail-height:136px/);
  assert.match(styles, /\.clipsScreen>\.stories\{position:sticky!important/);
  assert.match(styles, /\.clipsScreen>\.pulsePosts\{height:100%!important/);
  // Wave 14f: the shelf of moments is the Messages screen's tray and the rail of readings is on the bar, so
  // the 18px auto-hide that folded them went with them: neither the call nor the threshold survives in app.js
  // or in the module. The shell keeps the legacy rule for the class it used, unused, until the cleanup round.
  assert.equal(app.includes("bindStoryRailAutoHide"), false);
  assert.equal(feedSurface.includes("scrollTop > 18"), false);
  assert.match(styles, /\.clipsScreen\.storiesCollapsed\{--story-rail-height:0px!important/);
  // The legacy full-bleed reset remains module-local, but the final global shell owns the visible edge.
  assert.match(screenShell, /\.phone,\s*\n\s*\.phoneMetal,\s*\n\s*\.phoneScreen\s*\{[\s\S]*?border-radius:\s*var\(--nexus-screen-radius\)\s*!important/);
  assert.match(styles, /\.clipStage\[data-video-aspect="landscape"\] video\.media\{[\s\S]*object-fit:cover!important/);
  assert.match(styles, /\.post\.clipPost>\.reactionBar\.expanded.*display:grid!important/s);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(socialHumanUx, /\.mediaViewer\.reelViewer\.media-fit-fill/);
  assert.match(socialHumanUx, /\.mediaViewer\.reelViewer\.media-fit-fit/);
  assert.match(socialHumanUx, /\.viewerFitMenu/);
  assert.match(styles, /\.dynamicIsland\{display:none\}/);
  assert.match(index, /20260829-p2live1/);
  assert.match(app, /loadNexusShareTargets/);
  assert.match(app, /sendPostToNexusTarget/);
  assert.match(app, /openStoryViewer/);
  assert.match(app, /\/api\/stories\/" \+ storyId \+ "\/view/);
  assert.match(app, /suppressClickUntil/);
  assert.match(app, /performance\.now\(\) \+ 450/);
  assert.match(styles, /storyViewerFrame/);
  assert.match(app, /startLiveDeviceCheck/);
  assert.match(app, /t\("live\.localNotLive"\)/);
  assert.match(app, /cameraRecovery/);
  assert.match(app, /source: "clip_camera"/);
  assert.match(app, /source: "story_camera"/);
  assert.match(index, /20260829-p2live1/);
  assert.match(app, /uploadMediaResumable/);
  assert.match(app, /\/api\/uploads/);
  assert.match(client, /headers\["Idempotency-Key"\]/);
  assert.match(api, /MEDIA_UPLOAD_LEGACY_RETIRED/);
  assert.doesNotMatch(api, /media data must be canonical base64/);
  assert.match(app, /const SOCIAL_SHARING_ENABLED = true/);
  assert.match(app, /t\("post\.internalShareOnly"\)/);
  assert.match(interfaceLocale, /Nexus conversations only\. No external app\./);
  assert.match(app, /t\("post\.shareDisabled"\)/);
  assert.match(interfaceLocale, /Doar către conversații Nexus\. Nicio aplicație externă\./);
  assert.doesNotMatch(app, /wa\.me|t\.me\/share|fb-messenger:|viber:|facebook\.com\/sharer|x\.com\/intent/);
  assert.match(api, /cache-control": "private, no-store, max-age=0"/);
  assert.match(api, /const MEDIA_RANGE_MAX_BYTES = 4 \* 1024 \* 1024/);
  assert.match(api, /function boundedMediaRange/);
  assert.match(api, /"content-range": `bytes \$\{range\.start\}-\$\{range\.end\}\/\$\{buf\.length\}`/);
  assert.match(api, /"x-content-type-options": "nosniff"/);
  assert.match(api, /"content-disposition": delivery\.disposition/);
  assert.match(api, /mediaDeliveryPolicy\(m\)/);
  assert.match(repository, /WHERE avatar = \? OR cover = \?/);
  assert.doesNotMatch(api, /cache-control": "public, max-age=31536000, immutable"/);
  assert.doesNotMatch(app, /LOCAL FUNCTIONAL · MULTIVERSX DEVNET · 0 REAL FUNDS|DEVNET · 0 FUNDS/);
});

test("Create Hub exposes camera, gallery, story, clip, post and local drafts without wallet material", () => {
  for (const action of ["camera", "gallery", "story", "clip", "post", "drafts"]) {
    assert.match(app, new RegExp(`data-create-action=\\"${action}\\"`));
  }
  assert.match(app, /t\("create\.camera"\)/);
  assert.match(app, /t\("create\.gallery"\)/);
  assert.match(app, /"create\.post"/);
  assert.match(app, /"composer\.sourceCamera"/);
  assert.match(app, /openComposer\("story", \{ camera: true, source: "story_camera" \}\)/);
  assert.match(app, /"composer\.sourceStoryCamera"/);
  assert.match(app, /"composer\.sourceGallery"/);
  assert.match(app, /composerIntent/);
  assert.match(app, /data-source-jump="tweet"/);
  assert.match(app, /Tweet Nexus/);
  assert.match(app, /captionMax = tweetMode \|\| storyMode \? 500 : 2000/);
  assert.match(app, /id="captionCounter">0/);
  assert.match(app, /tweetComposer/);
  assert.doesNotMatch(app, /class="createKinds"/);
  assert.match(styles, /\.composerIntent/);
  assert.match(styles, /\.tweetComposer \.captionField textarea/);
  assert.match(app, /indexedDB\.open\("nexus-social-drafts", 2\)/);
  assert.match(app, /getUserMedia/);
  assert.match(app, /MediaRecorder/);
  assert.match(app, /setUploadProgress\(100, t\("publish\.published"\)\)/);
  assert.match(app, /persistUploadResume\(storageKey, resume\);\s*const created = await api\("\/api\/uploads"/);
  assert.match(app, /resume\?\.createKey \? \{/);
  assert.match(app, /if \(!status\.ok\) throw new UploadClientError\("UPLOAD_STATUS_UNAVAILABLE"\)/);
  assert.match(app, /headers: \{ "Idempotency-Key": mutationKey \}/);
  assert.match(app, /setUploadFailure\(message\)/);
  assert.match(app, /t\("create\.truth"\)/);
  assert.match(app, /id="closeComposer"/);
  assert.match(app, /bindComposerPicker\(sourceInput/);
  assert.match(app, /onEmptyCancel: goHome/);
  assert.match(app, /readSelectedPreview\(sourceInput, fileToDataUrl, isCurrent\)/);
  assert.doesNotMatch(app, /if \(composerStillOpen && !hasSelection\) goHome\(\)/);
  assert.match(app, /t\("composer\.close"\)/);
  assert.match(interfaceLocale, /Drafturile nu conțin chei de wallet/);
  assert.match(app, /const DRAFT_LIMIT_PER_PROFILE = 20/);
  assert.match(app, /const DRAFT_QUOTA_BYTES_PER_PROFILE = 100 \* 1024 \* 1024/);
  assert.match(app, /safeDraftRecord/);
  assert.match(app, /store\.index\("owner_persona"\)\.getAll\(draftScopeKey\(owner, persona\)\)/);
  assert.match(app, /enforceDraftQuota\(owner, persona, record\.id\)/);
  assert.match(app, /planDraftEvictions\(scoped/);
  assert.match(app, /quota\.evicted\.length/);
  assert.match(app, /class="draftQuota" role="status"/);
  assert.match(app, /Number\(state\.user\.id\) !== owner \|\| state\.persona !== persona/);
  assert.match(app, /data-draft-retry/);
  assert.match(app, /t\("draft\.openError"\)/);
  assert.match(app, /const composerCameraRequestGate = createLatestRequestGate\(\)/);
  assert.match(app, /const discardedComposerRecorders = new WeakSet\(\)/);
  assert.match(app, /const stream = await navigator\.mediaDevices\.getUserMedia/);
  assert.match(app, /!request\.isCurrent\(\)[\s\S]{0,180}stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(app, /!discardedComposerRecorders\.has\(recorder\) && sourceInput\.isConnected && state\.persona === selectedPersona/);
  assert.match(app, /startBoundedRecording\(recorder/);
  assert.match(app, /maxBytes: DRAFT_FILE_LIMIT/);
  assert.match(app, /if \(!attached\) return toast\(t\("camera\.attachError"\)\)/);
  assert.match(app, /stopComposerCamera\(\{ discardRecording: false \}\);\s*if \(!attached\)/);
  assert.doesNotMatch(app, /indexedDB\.open\("nexus-social-drafts"[\s\S]{0,600}(?:seed|private_key|mnemonic)/i);
});

test("large Nexus Prism stories can render image and video previews", () => {
  // Wave 14 moved the rail's markup into the feed module, which is where the preview now lives: the
  // screen draws it, an image story stays an image, a video story stays a video, and the reader's own
  // card is still the door to the camera.
  assert.match(feedSurface, /storyPrism/);
  assert.match(feedSurface, /story\.media\?\.kind === "image"/);
  assert.match(feedSurface, /story\.media\?\.kind === "video"/);
  assert.match(feedSurface, /id="addStory"/);
  assert.match(app, /feedStoryRailMarkup\(/);
});

test("Nexus Sigil is earned automatically while Orbit remains voluntary and temporary", () => {
  assert.match(app, /SIGIL_LEVELS/);
  assert.match(app, /1_000_000/);
  assert.match(app, /sigil\.earned \? familyLabel/);
  assert.match(app, /Sigilul apare numai după atingerea pragului/);
  assert.match(app, /followers unici HUMAN_ORGANIC/);
  assert.match(app, /Pagina Business trebuie verificată/);
  assert.match(app, /openSigilSwitcher/);
  assert.doesNotMatch(app, /sigilBtn locked|class="accountBtn sigilBtn locked/);
  assert.match(app, /nexus-sigil:/);
  assert.match(app, /temporary expression cache is optional/);
  assert.match(app, /openSigilSwitcher/);
  assert.match(app, /usernameSigil/);
  assert.match(repository, /sigilProgress/);
  assert.match(repository, /follower\.traffic_class = 'HUMAN_ORGANIC'/);
  assert.match(repository, /BUSINESS_VERIFICATION_REQUIRED/);
  assert.match(database, /profile_kind TEXT NOT NULL DEFAULT 'personal'/);
  assert.match(database, /business_verification_status TEXT NOT NULL DEFAULT 'unverified'/);
  assert.match(api, /Nexus Sigil se activează automat/);
  assert.doesNotMatch(app, /data-quick-sigil|Alege Nexus Sigil|Culoare Sigil|sigilEditor|profileModeToggle/);
  assert.match(app, /Orbit · expresie temporară/);
  assert.match(app, /Gând \/ proverb \/ zicală/);
  assert.match(database, /orbit_quote TEXT/);
  assert.match(api, /orbit_status\.quote/);
});

test("Social navigation exposes four top contexts, four bottom destinations plus Create, and real Live/Search gates", () => {
  for (const feed of ['"for-you"', '"local"', '"global"', '"friends"', '"following"', '"private"', '"breaking"', '"tweets"']) assert.match(app, new RegExp(feed));
  assert.match(app, /data-social-feed/);
  assert.match(app, /t\("feed\.private"\), t\("feed\.privateSelectorDetail"\)/);
  assert.match(app, /t\("feed\.tweets"\), t\("feed\.tweetsSelectorDetail"\)/);
  assert.match(app, /socialTopView = "tweets"; socialLens = "for-you"; socialFormat = "tweets"/);
  assert.match(api, /"tweets"/);
  assert.match(repository, /format === "tweets".*post\.kind !== "text".*post\.media_id/);
  assert.doesNotMatch(app, /data-format/);
  assert.match(styles, /\.clipsScreen \.feedTabs\{display:none\}/);
  assert.match(app, /openSocialFeedSwitcher/);
  assert.match(app, /openSocialFriendsSwitcher/);
  assert.match(app, /if \(document\.getElementById\("socialFeedSwitcherBackdrop"\)\) return closeSocialFeedSwitcher\(\)/);
  assert.match(app, /if \(document\.getElementById\("socialFriendsSwitcherBackdrop"\)\) return closeSocialFriendsSwitcher\(\)/);
  assert.match(app, /data-friends-kind/);
  assert.match(app, /\["followers", t\("header\.followers"\)\]/);
  assert.match(app, /\["following", t\("header\.following"\)\]/);
  assert.match(app, /\["favorites", t\("header\.favorites"\)\]/);
  assert.match(app, /\["requests", t\("header\.requests"\)\]/);
  assert.match(app, /t\("friends\.sheetTitle"\)/);
  assert.match(app, /t\("friends\.requestsLoadFailed"\)/);
  assert.match(app, /t\("friends\.relationsLoadFailed"\)/);
  assert.match(app, /const requestGate = socialFriendsLoadGate\.begin\(\)/);
  assert.match(app, /if \(!stillCurrent\(\)\) return/);
  assert.match(app, /if \(!stillCurrent\(\) \|\| socialFriendView !== "requests"\) return/);
  assert.match(app, /const requestMutationGate = createSingleFlightGate\(\)/);
  assert.match(app, /if \(!requestMutationGate\.tryStart\(\)\) return/);
  assert.match(app, /\[data-request-decision\], \[data-request-cancel\]/);
  assert.doesNotMatch(app, /result\.error \|\| t\("friends\.request(?:Update|Cancel)Error"\)/);
  assert.match(app, /<bdi dir="auto">/);
  assert.match(app, /<bdi dir="ltr">@/);
  assert.match(app, /t\(isFavorite \? "friends\.removeFavorite" : "friends\.addFavorite"\)/);
  assert.match(app, /\/api\/follow\/requests\?direction=incoming/);
  assert.match(app, /\/api\/follow\/requests\?direction=outgoing/);
  assert.match(app, /data-request-decision/);
  assert.match(app, /data-request-cancel/);
  assert.match(index, /p1-requests\.css\?v=20260829-p2live1/);
  assert.match(index, /p2-clips\.css\?v=20260829-p2live1/);
  assert.match(index, /p2-messaging\.css\?v=20260914-compose2/);
  // G1: the duplicate Change/menu mark is gone. The wordmark and the header drawer remain the ways to
  // change context, while the bottom bar is only destinations.
  assert.match(app, /social: \[\["primary","⌂","Acasă"\],\["inbox","◌","Mesaje"\],\["search","⌕","Căutare"\],\["create","＋","Creează"\],\["friends","◍","Prieteni"\],\["utility","◉","Live"\],\["account","◎","Profil"\]\]/s);
  assert.match(app, /openSocialDiscover/);
  assert.match(app, /renderSocialSearch/);
  assert.match(api, /path === "\/api\/social\/relations"/);
  assert.match(api, /path === "\/api\/social\/search"/);
  assert.match(repository, /searchSocial/);
  assert.match(repository, /listSocialRelations/);
  assert.match(app, /\["now", t\("live\.now"\)\].*\["following", t\("live\.following"\)\].*\["battle", t\("live\.battle"\)\].*\["championship", t\("live\.championships"\)\]/s);
  assert.match(app, /renderSocialLive/);
  assert.match(api, /path === "\/api\/social\/live"/);
  assert.match(api, /UNIQUE_ACTIVE_HUMAN_ORGANIC_45S/);
  assert.match(repository, /prepareSocialLive/);
  assert.match(repository, /visibility: session\.visibility/);
  assert.match(database, /comments_enabled INTEGER NOT NULL DEFAULT 1/);
  assert.match(app, /comments_enabled: data\.get\("comments"\) === "on"/);
  assert.match(app, /let stopWhenHidden = null/);
  assert.match(app, /removeEventListener\("visibilitychange", stopWhenHidden\)/);
  assert.match(app, /liveSetupSheet[^\n]+tabindex="-1"/);
  assert.match(app, /const liveDeviceRequestGate = createLatestRequestGate\(\)/);
  assert.match(app, /const deviceRequest = liveDeviceRequestGate\.begin\(\)/);
  assert.match(app, /!deviceRequest\.isCurrent\(\) \|\| !preview\.isConnected/);
  assert.match(app, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(app, /liveDeviceReady\(\)/);
  assert.match(app, /const previewKey = form\.dataset\.previewKey/);
  assert.match(app, /headers: \{ "Idempotency-Key": previewKey \}/);
  assert.match(app, /event\.currentTarget\.dataset\.previewKey = newUploadMutationKey\("live-preview"\)/);
  assert.match(app, /t\("live\.genericError"\)/);
  const liveSetup = app.slice(app.indexOf("function openLiveSetupSheet"), app.indexOf("function openCompetitionSheet"));
  assert.doesNotMatch(liveSetup, /esc\(result\.reason\)/);
  assert.doesNotMatch(liveSetup, /esc\(result\.error \|\| "Reîncearcă"\)/);
  assert.match(app, /Array\.isArray\(result\.live\)/);
  assert.match(app, /Array\.isArray\(result\.creators\)/);
  assert.match(app, /Array\.isArray\(result\.competitions\)/);
  assert.match(app, /const socialLiveLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const request = socialLiveLoadGate\.begin\(\)/);
  assert.match(app, /result\.viewer_persona === selectedPersona/);
  assert.match(app, /result\.transport\?\.public_broadcast === false/);
  assert.match(app, /toLocaleString\(interfaceLocale\)/);
  assert.match(app, /data-competition-key=/);
  assert.match(app, /headers: \{ "Idempotency-Key": competitionKey \}/);
  assert.match(app, /event\.currentTarget\.dataset\.competitionKey = newUploadMutationKey\("live-competition"\)/);
  assert.match(app, /startsAt\.toISOString\(\)/);
  assert.match(app, /result\.action === "preview_saved"/);
  assert.match(app, /result\.action === "competition_draft_saved"/);
  assert.match(app, /Number\(result\.owner_id\) === Number\(state\.user\.id\)/);
  const competitionSheet = app.slice(app.indexOf("function openCompetitionSheet"), app.indexOf("async function refreshMessageBadge"));
  assert.doesNotMatch(competitionSheet, /esc\(result\.reason\)/);
  assert.doesNotMatch(competitionSheet, /esc\(result\.error/);
  assert.match(repository, /createSocialLiveCompetitionDraft/);
  assert.match(database, /social_live_sessions/);
  assert.match(database, /social_live_competitions/);
  assert.match(database, /uq_social_live_open_host/);
});

test("follow request decisions and cancellations retain stable replay keys across refresh", () => {
  const relations = app.slice(app.indexOf("function stableFollowRequestMutationKey"), app.indexOf("function openSocialFriendsSwitcher"));
  assert.match(app, /const followRequestMutationKeys = new Map\(\)/);
  assert.match(relations, /followRequestMutationKeys\.size >= 400/);
  assert.match(relations, /newUploadMutationKey\("follow-request"\)/);
  assert.match(relations, /const selectedPersona = state\.persona/);
  assert.match(relations, /state\.persona === selectedPersona/);
  assert.match(relations, /value\.length <= 80/);
  assert.match(relations, /request\.persona === selectedPersona && request\.status === "pending"/);
  assert.match(relations, /safeInternalMediaUrl\(request\.avatar\)/);
  assert.match(relations, /data-request-key=/);
  assert.match(relations, /headers: \{ "Idempotency-Key": mutationKey \}/);
  assert.match(relations, /Number\(result\.request_id\) !== requestId/);
  assert.match(relations, /result\.decision !== decision/);
  assert.match(relations, /result\.active !== false \|\| result\.request_pending !== false/);
  assert.match(relations, /followRequestMutationKeys\.delete\(`decision:/);
  assert.match(relations, /followRequestMutationKeys\.delete\(`cancel:/);
  assert.doesNotMatch(relations, /toast\(result\.error|toast\(result\?\.error/);
});

test("relations and device-local favorites are bounded, media-confined and failure-honest", () => {
  const favorites = app.slice(app.indexOf("function readSocialFavorites"), app.indexOf("function closeSocialFriendsSwitcher"));
  const relations = app.slice(app.indexOf("async function loadSocialFriendsList"), app.indexOf("function openSocialFriendsSwitcher"));
  assert.match(favorites, /!Array\.isArray\(parsed\) \|\| parsed\.length > 500/);
  assert.match(favorites, /Number\.isSafeInteger\(id\) && id > 0/);
  assert.match(favorites, /\.slice\(0, 500\)/);
  assert.match(favorites, /catch \{ return false; \}/);
  assert.match(app, /result\.kind === kind/);
  assert.match(app, /function isSafeSocialRelationsPage/);
  assert.match(app, /result\.people\.length <= 40/);
  assert.match(relations, /data-relations-more/);
  assert.match(api, /relation cursor invalid/);
  assert.match(app, /Number\(r\.actor_id\) === Number\(state\.user\.id\)/);
  assert.match(app, /Number\(r\.target_id\) === target/);
  assert.match(app, /Number\(person\.user_id\) !== Number\(viewerId\)/);
  assert.match(app, /\["followers", "following"\]\.includes\(person\.relation\)/);
  assert.match(app, /typeof person\.following_me === "boolean"/);
  assert.match(relations, /const avatarUrl = safeInternalMediaUrl\(person\.avatar\)/);
  assert.match(relations, /if \(!saved\) return toast\(t\("friends\.favoriteUpdateError"\)\)/);
  for (const locale of ["ro", "en", "pl", "ar"]) assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"friends\\.favoriteUpdateError"`));
});

test("feed media opens at the selected item in a continuous vertical full-screen viewer", () => {
  assert.match(app, /openMediaViewer/);
  assert.match(app, /data-viewer-comments/);
  assert.match(app, /openViewerComments\(Number\(event\.currentTarget\.dataset\.viewerComments\)\)/);
  assert.match(app, /flushViewerExposure/);
  assert.match(app, /maxProgress >= \.9/);
  assert.match(app, /if \(viewer\.querySelector\("\.viewerCommentsPanel"\)\) dismissCommentOverlay\(\)/);
  assert.doesNotMatch(app, /dwell_ms: 1, completed: item\.media\.kind === "image"/);
  assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="viewerDialogLabel"/);
  assert.match(app, /id="viewerDialogLabel" hidden>' \+ esc\(t\("viewer\.label"\)\)/);
  assert.match(app, /class="mediaViewer reelViewer media-fit-/);
  assert.match(reelsReference, /viewerTopBar/);
  assert.match(app, /viewerActionRail/);
  assert.match(app, /viewerReactionTray/);
  assert.match(app, /viewerCreatorOverlay/);
  assert.match(app, /viewerCommentShortcut/);
  assert.match(app, /viewerPlayState/);
  assert.match(app, /t\("viewer\.videoAria"\)/);
  assert.match(app, /bindDoubleTapHeart\(viewerMedia, \{/);
  assert.match(app, /data-viewer-sound/);
  assert.match(app, /openViewerComments/);
  assert.match(app, /api\("\/api\/social\/impressions"/);
  assert.match(app, /article\.post:not\(\.clipPost\) img\.media/);
  assert.match(app, /openMediaViewer\(items, index, \{/);
  assert.match(app, /feedRestore:[\s\S]*scrollTop:[\s\S]*windowScrollY/);
  assert.match(app, /preloadNeighbors/);
  assert.match(app, /preload\.preload = "metadata"/);
  assert.match(app, /document\.querySelectorAll\("video\.media"\)\.forEach\(\(video\) => video\.pause\(\)\)/);
  assert.match(app, /event\.key === "ArrowUp"/);
  assert.match(app, /event\.key === "ArrowDown"/);
  assert.match(app, /pointerdown/);
  assert.match(app, /pointerup/);
  assert.match(app, /decideViewerGesture\(\{ dx, dy \}\)/);
  assert.match(app, /viewer\.addEventListener\("touchstart"/);
  assert.match(app, /viewer\.addEventListener\("touchmove"/);
  assert.match(app, /viewer\.addEventListener\("touchend"/);
  assert.match(app, /feedRestore\.container\.scrollTop = feedRestore\.scrollTop/);
  assert.match(app, /let mediaViewerSessionGeneration = 0/);
  assert.match(app, /mediaViewerState\?\.sessionId === sessionId && state\.persona === selectedPersona/);
  assert.match(app, /item\.persona === selectedPersona[\s\S]{0,100}isSafeSearchMedia\(item\.media\)/);
  assert.match(app, /document\.removeEventListener\("visibilitychange", mediaViewerState\.visibilityHandler\)/);
  assert.match(app, /mediaViewerState\.resumeOnVisible = !video\.paused/);
  assert.match(app, /safeInternalMediaUrl\(author\.avatar\)/);
  assert.match(styles, /\.mediaViewer\.reelViewer/);
  assert.match(styles, /\.reelViewer \.viewerTopBar/);
  assert.match(styles, /\.reelViewer \.viewerCommentShortcut/);
});

test("private profile access is modeled as anonymous timed paid access with 90/10 split", () => {
  assert.match(app, /private_access_enabled/);
  assert.match(profilePanels, /24 h · 1 month · forever/);
  assert.match(profilePanels, /Local test · no real funds/);
  assert.match(app, /90% creator, 10% Nexus/);
  assert.match(profilePanels, /profileEdit\.priceDay/);
  assert.match(app, /min="1"/);
  assert.match(interfaceLocale, /minimul este 1 USD echivalent stablecoin/);
  assert.match(app, /ownerul nu vede cine a vizitat/);
  assert.match(app, /renderPrivateContent/);
  assert.match(app, /privateDemoCandidates/);
  assert.match(app, /aria\.private/);
  assert.match(app, /demo_private_price_cents:\s*100/);
  assert.match(app, /demo_private_price_cents:\s*300/);
  assert.match(app, /Math\.max\(100, Number\(person\.demo_private_price_cents/);
  assert.match(app, /data-private-unlock/);
  assert.match(app, /reveal reciproc/i);
  assert.match(api, /private_access/);
  assert.match(api, /duration_days/);
  assert.match(api, /priceCents < 100/);
  assert.match(database, /private_access_price_cents INTEGER NOT NULL DEFAULT 100/);
  assert.match(database, /private_access_duration_days INTEGER NOT NULL DEFAULT 30/);
  assert.match(repository, /price_per_day_cents/);
  assert.match(repository, /Math\.max\(100, Number\(profile\.private_access_price_cents/);
  assert.match(repository, /VISITOR_REVEAL_RECIPROCAL/);
});

test("Curiosity Market implements free-by-default unlock collect reveal without real funds", () => {
  assert.match(app, /CURIOSITY_ECONOMY/);
  assert.match(app, /NEXUS_CURIOSITY_MARKET_V1_LOCAL/);
  assert.match(app, /minSettlementCents: 100/);
  assert.match(app, /revealSplit: \{ revealedVisitor: 60, owner: 30, nexus: 10 \}/);
  assert.match(app, /demoCuriosityStories/);
  assert.match(app, /handleStoryPeek/);
  assert.match(app, /openStoryEconomySheet/);
  assert.match(app, /openCuriositySheet/);
  assert.match(app, /curiosityLedgerKey/);
  assert.match(app, /demo_local_no_real_funds/);
  assert.match(app, /UNLOCK/);
  assert.match(app, /REVEAL_X2/);
  assert.match(app, /LIST_RESALE/);
  // Wave 14d: the demo moments these three lines name moved to feed-surface.js with the shelf they fill.
  assert.match(feedSurface, /Third perspective/);
  assert.match(feedSurface, /\/demo-stories\/story-mountain\.svg/);
  assert.match(feedSurface, /\/demo-stories\/story-island\.svg/);
  assert.match(app, /hidden_unlock/);
  assert.match(app, /nu cumpără ranking organic/);
  // Functional selectors below remain after removing historical CSS comments.
  assert.match(styles, /\.storyCard\.peeked/);
  assert.match(styles, /\.curiosityLock/);
  assert.match(styles, /\.curiosityActions/);
  assert.match(styles, /\.curiosityMiniLedger/);
});

test("Nexus username is distinct from MultiversX herotag and resolves safely for payments", () => {
  assert.match(app, /\/auth\/mvx\/nexus-username/);
  assert.match(api, /path === "\/api\/pay\/resolve"/);
  assert.match(api, /identity_verified: false/);
  assert.match(api, /prepared: false/);
  assert.match(api, /signed: false/);
  assert.match(api, /broadcast: false/);
  assert.match(app, /renderM12PayWorkspace/);
  assert.match(m12Module, /id="m12-pay-form"/);
  assert.match(m12Module, /Alias → adresă → rețea → token → sumă/);
  assert.match(m12Module, /Semnarea și broadcast-ul sunt oprite în demo/);
  assert.match(m12Module, /receipt_id: item\.id, receipt_hash: item\.receipt_hash/);
  assert.match(interfaceLocale, /Nu este herotag MultiversX/);
});

test("baseline browser security headers and seed-ingestion denial are present", () => {
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
  assert.match(server, /Permissions-Policy/);
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /split\("\?"\)\[0\]/);
  assert.match(api, /importul seed phrase în Nexus este dezactivat/);
  assert.doesNotMatch(api, /repo\.insertWallet\(/);
  assert.doesNotMatch(api, /decryptWallet|encryptWallet|generateWallet/);
  assert.match(api, /cererea cross-site a fost refuzată/);
  assert.match(api, /Nexus nu păstrează seed phrase/);
  assert.doesNotMatch(app, /rec-seed|import-seed-form|name="mnemonic"/);
  assert.doesNotMatch(app, /copy-seed|seed-reveal|export seed phrase/i);
});

test("mobile xPortal flow uses a fresh pairing and the official combined NativeAuth login", () => {
  assert.match(app, /freshPairing:\s*true/);
  assert.match(app, /t\("auth\.openXportal"\)/);
  assert.match(app, /t\("auth\.continueSignature"\)/);
  assert.match(app, /walletWasBackgrounded/);
  assert.match(app, /signature-ready/);
  assert.doesNotMatch(app, /pasul 2 din 2/);
});

test("email auth UI replays one intent and activates only the server-confirmed device wallet", () => {
  const landing = app.slice(app.indexOf("function renderLanding"), app.indexOf("async function herotagLogin"));
  assert.match(app, /const authSignupFlight = createSingleFlightGate\(\)/);
  assert.match(app, /const authLoginFlight = createSingleFlightGate\(\)/);
  assert.match(landing, /data-signup-init-key=/);
  assert.match(landing, /data-signup-key=/);
  assert.match(landing, /data-login-key=/);
  assert.match(landing, /headers: \{ "Idempotency-Key": form\.dataset\.signupInitKey \}/);
  assert.match(landing, /headers: \{ "Idempotency-Key": form\.dataset\.signupKey \}/);
  assert.match(landing, /headers: \{ "Idempotency-Key": form\.dataset\.loginKey \}/);
  assert.match(landing, /if \(!form\.isConnected\) return/);
  assert.match(landing, /confirmedAddress !== walletProof\.address/);
  assert.match(landing, /commitDeviceWallet\?\.\(confirmedAddress\)/);
  assert.doesNotMatch(landing, /r\.error|error\?\.message/);
  assert.match(deviceWalletEntry, /PENDING_PREFIX/);
  assert.match(deviceWalletEntry, /export function commitDeviceWallet/);
  assert.match(deviceWalletEntry, /localStorage\.setItem\(`\$\{PENDING_PREFIX\}\$\{address\}`/);
  assert.match(deviceWalletEntry, /localStorage\.removeItem\(pendingKey\)/);
  assert.doesNotMatch(deviceWalletEntry.slice(deviceWalletEntry.indexOf("export async function createDeviceWalletProof"), deviceWalletEntry.indexOf("export function deviceWalletStatus")), /localStorage\.setItem\(ACTIVE_KEY/);
  assert.match(index, /device-wallet\.js\?v=20260905-auth26/);
});

test("authentication shell is device-localized before login and preserves provider capability on return", () => {
  const initialization = app.slice(app.indexOf("async function init"), app.indexOf("// ---------- landing"));
  const landing = app.slice(app.indexOf("function renderLanding"), app.indexOf("async function herotagLogin"));
  assert.match(initialization, /syncInterfaceLocale\(\);\s*const me = await api\("\/api\/me"\)/);
  assert.match(app, /let authProviderState = \{ google: false, facebook: false, mvxNetwork: "mainnet" \}/);
  assert.match(landing, /authProviderState = \{/);
  assert.match(landing, /const p = authProviderState/);
  for (const key of ["tagline", "signIn", "continueGoogle", "continueFacebook", "connectXportal", "orEmail", "email", "password", "forgot", "createAccount", "walletAuto", "invalidEmail", "invalidPassword", "passwordMismatch", "accountCreated", "invalidCredentials"]) {
    assert.match(landing, new RegExp(`t\\("auth\\.${key}"\\)`));
  }
  assert.doesNotMatch(landing, /Introdu o adresă|Parola trebuie|Parolele nu coincid|Verific acreditările|Emailul sau parola nu/);
  for (const locale of ["ro", "en", "pl", "ar"]) assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"auth\\.walletActivationFailed"`));
  assert.match(app, /function xPortalFailureMessage/);
  assert.match(app, /t\("auth\.xportalCancelled"\)/);
  assert.match(app, /t\("auth\.xportalTimedOut"\)/);
  assert.match(app, /t\("auth\.emailResetUnavailable"\)/);
  const xportal = app.slice(app.indexOf("async function xPortalFlow"), app.indexOf("function renderMvxLogin"));
  assert.doesNotMatch(xportal, /setStatus\(err\?\.message|toast\(err\?\.message/);
});

test("global connectivity state follows locale changes and remains fail-closed offline", () => {
  const connectivity = app.slice(app.indexOf("function syncNetworkState"), app.indexOf("function readSocialMuted"));
  assert.match(connectivity, /t\("connectivity\.offline"\)/);
  assert.match(connectivity, /t\("connectivity\.restored"\)/);
  assert.match(connectivity, /if \(!online\) nexusEventStream\?\.close\(\)/);
  assert.match(app.slice(app.indexOf("function syncInterfaceLocale"), app.indexOf("function earnedSigilFor")), /syncNetworkState\(\)/);
  assert.doesNotMatch(connectivity, /poți consulta ce este deja încărcat|Conexiune restabilită/);
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"connectivity\\.restored"`));
  }
});

test("local WebRTC calls expose honest capability gates and never persist signaling in browser storage", () => {
  assert.match(callClient, /isSecureContext/);
  assert.match(callClient, /iceServers:\s*\[\]/);
  assert.match(callClient, /WebRTC DTLS-SRTP/);
  assert.match(callClient, /FĂRĂ TURN\/SFU/i);
  assert.doesNotMatch(callClient, /localStorage|sessionStorage/);
  assert.doesNotMatch(callClient, /STUN|stun:|turn:/i);
  assert.match(callClient, /globalThis\.addEventListener\?\.\("pagehide", stopLocalMedia\)/);
  assert.match(callClient, /const scope = `signal:\$\{call\.call_id\}:\$\{signalNonce\}`/);
  assert.doesNotMatch(callClient, /signalNonce\}:\$\{attempt\}/);
  assert.match(callClient, /startCallLease\(\)/);
  assert.match(callClient, /lease_seconds\) === 25/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS call_participant_leases/);
  assert.match(repository, /cpl\.lease_until <= \?/);
  assert.match(api, /\/heartbeat\$/);
  assert.match(app, /t\("thread\.groupCallBlocked"\)/);
});

test("messaging UI fails closed while authorization loads and exposes recoverable errors", () => {
  assert.match(app, /t\("thread\.checking"\)/);
  assert.match(app, /Privacy Matrix · deny by default/);
  assert.match(app, /id="video-call" type="button" disabled/);
  assert.match(app, /name="attachment"[^>]+disabled/);
  assert.match(app, /name="body"[^>]+disabled/);
  assert.match(app, /data-inbox-retry/);
  assert.match(app, /data-thread-retry/);
  assert.match(app, /t\("thread\.unavailable"\)/);
  assert.match(app, /dialog\.addEventListener\("keydown", \(event\) => \{ if \(event\.key === "Escape"\) close\(\); \}\)/);
});

test("localized messaging shell rejects stale inbox responses and malformed conversations", () => {
  assert.match(app, /const messagesLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const loadRequest = messagesLoadGate\.begin\(\)/);
  assert.match(app, /const selectedBox = inboxBox/);
  assert.match(app, /const selectedFilter = inboxFilter/);
  assert.match(app, /!loadRequest\.isCurrent\(\) \|\| !list\?\.isConnected \|\| inboxBox !== selectedBox \|\| inboxFilter !== selectedFilter/);
  assert.match(app, /Array\.isArray\(conversations\)/);
  assert.match(app, /Number\.isSafeInteger\(Number\(conversation\.id\)\)/);
  assert.match(app, /function isSafeConversationSummary\(conversation, viewerId\)/);
  assert.match(app, /conversation\.participants\.length > 50/);
  assert.match(app, /new Set\(participantIds\)\.size !== participantIds\.length/);
  assert.match(app, /participantIds\.includes\(Number\(viewerId\)\)/);
  assert.match(app, /safeInternalMediaUrl\(participant\.avatar\)/);
  assert.match(app, /conversation\.kind === "direct" && participants\.length !== 2/);
  assert.match(app, /response\.privacy_enforced_server_side === true/);
  assert.match(app, /response\.query\?\.persona === selectedFilter && response\.query\?\.box === selectedBox/);
  assert.match(app, /conversations\.length <= 100/);
  assert.match(app, /conversations\.every\(\(conversation\) => isSafeConversationSummary\(conversation, state\.user\.id\)\)/);
  assert.match(app, /t\("messages\.loadError"\)/);
  assert.match(app, /role="tab" aria-selected=/);
  const messagesShell = app.slice(app.indexOf("async function renderMessages"), app.indexOf("const NOTIFICATION_LABELS"));
  assert.doesNotMatch(messagesShell, /response\.error/);
  assert.doesNotMatch(messagesShell, /Inboxul nu poate fi încărcat|Nicio conversație aici|Nicio cerere nouă/);
});

test("conversation creator validates locally and replays one stable mutation", () => {
  const creator = app.slice(app.indexOf("function renderConversationCreator"), app.indexOf("async function openThread"));
  assert.match(creator, /data-conversation-key=/);
  assert.match(creator, /\^\[a-z0-9_\]\{2,30\}\$/);
  assert.match(creator, /kind === "direct" && usernames\.length !== 1/);
  assert.match(creator, /kind === "group" && usernames\.length < 2/);
  assert.match(creator, /kind === "group" && usernames\.length > 49/);
  assert.match(creator, /usernames\.includes\(String\(state\.user\.handle \|\| ""\)\.toLowerCase\(\)\)/);
  assert.match(creator, /headers: \{ "Idempotency-Key": form\.dataset\.conversationKey \}/);
  assert.match(creator, /event\.currentTarget\.dataset\.conversationKey = newUploadMutationKey\("conversation-create"\)/);
  assert.match(creator, /if \(submit\.disabled\) return/);
  assert.match(creator, /Number\.isSafeInteger\(conversationId\)/);
  assert.match(creator, /if \(!form\.isConnected \|\| state\.persona !== selectedPersona\) return/);
  assert.match(creator, /result\.intent\?\.kind === kind && result\.intent\?\.context_persona === selectedPersona/);
  assert.match(creator, /isSafeConversationSummary\(result\.conversation, state\.user\.id\)/);
  assert.match(creator, /JSON\.stringify\(otherHandles\) !== JSON\.stringify\(\[\.\.\.usernames\]\.sort\(\)\)/);
  assert.match(api, /usernames\.length > 49/);
  assert.match(api, /const profile = repo\.getPersona\(recipient\.id, contextPersona\)/);
  assert.doesNotMatch(api, /getPersona\(recipient\.id, contextPersona\) \?\? repo\.ensurePersona/);
  assert.match(api, /intent: \{ kind, context_persona: contextPersona, recipient_handles: usernames, title: normalizedTitle \}/);
  assert.doesNotMatch(creator, /result\.error/);
  assert.doesNotMatch(creator, /Conversația nu a putut fi creată|Pentru grup, separă/);
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"conversation\\.tooMany"[\\s\\S]*?"conversation\\.self"`));
  }
});

test("thread loading and plaintext composer are stale-safe and replay-safe", () => {
  assert.match(app, /const threadLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const loadRequest = threadLoadGate\.begin\(\)/);
  assert.match(app, /const selectedUserId = Number\(state\.user\.id\)/);
  assert.match(app, /const selectedPersona = state\.persona/);
  assert.match(app, /!loadRequest\.isCurrent\(\) \|\| activeConversationId !== conversationId \|\| Number\(state\.user\.id\) !== selectedUserId \|\| state\.persona !== selectedPersona/);
  assert.match(app, /threadLoadGate\.invalidate\(\);\s+revokeDecryptedAttachmentUrls\(\);\s+activeConversationId = null/);
  assert.match(app, /function isSafeThreadMessage\(message, conversation, requestedDeviceId\)/);
  assert.match(app, /function isSafeThreadEnvelope\(envelope, message, requestedDeviceId\)/);
  assert.match(app, /function isSafeThreadMeeting\(meeting, conversationId, participantIds\)/);
  assert.match(app, /function isSafeThreadCall\(call, conversationId, participantIds\)/);
  assert.match(app, /r\.privacy_enforced_server_side === true/);
  assert.match(app, /Number\(r\.query\?\.conversation_id\) === conversationId/);
  assert.match(app, /\(r\.query\?\.device_id \?\? null\) === requestedDeviceId/);
  assert.match(app, /r\.query\?\.viewer_persona === selectedPersona/);
  assert.match(app, /isSafeConversationSummary\(conversation, selectedUserId\)/);
  assert.match(app, /r\.messages\.length <= 500/);
  assert.match(app, /r\.messages\.every\(\(message\) => isSafeThreadMessage\(message, conversation, requestedDeviceId\)\)/);
  assert.match(app, /Number\(messages\[index - 1\]\.id\) < Number\(message\.id\)/);
  assert.match(app, /r\.meetings\.length <= 100/);
  assert.match(app, /r\.calls\.length <= 50/);
  assert.match(app, /conversation\.typing\.length <= 49/);
  const loader = app.slice(app.indexOf("async function loadThread"), app.indexOf("function signalTyping"));
  assert.doesNotMatch(loader, /r\.messages\.filter/);
  assert.doesNotMatch(loader, /r\.conversation\.participants\.filter/);
  assert.match(api, /query: \{ conversation_id: conversationId, device_id: deviceId \|\| null, viewer_persona: auth\.persona, \.\.\./);
  assert.match(api, /privacy_enforced_server_side: true/);
  assert.match(repository, /listConversationMeetings\(conversationId, viewerId, limit = 100\)/);
  assert.match(repository, /ORDER BY cm\.starts_at ASC, cm\.id ASC LIMIT \?/);
  assert.match(app, /data-message-key=/);
  assert.match(app, /data-client-nonce=/);
  assert.match(app, /function isSafeMessageMutationResult\(result, expected\)/);
  assert.match(app, /headers: \{ "Idempotency-Key": intent\.messageKey \}/);
  assert.match(app, /client_nonce: intent\.clientNonce/);
  assert.match(app, /clientNonce: intent\.clientNonce/);
  assert.match(app, /idempotencyKey: intent\.messageKey/);
  assert.match(app, /activeConversationId === intent\.conversationId/);
  assert.match(app, /form\.dataset\.messageKey !== intent\.messageKey \|\| form\.dataset\.clientNonce !== intent\.clientNonce/);
  assert.match(chatCrypto, /async function postEncryptedMessage\(api, conversationId, body, idempotencyKey\)/);
  assert.match(chatCrypto, /headers: idempotencyKey \? \{ "Idempotency-Key": idempotencyKey \} : undefined/);
  assert.match(chatCrypto, /local_intent:/);
  assert.match(app, /if \(submit\.disabled\) return/);
  assert.match(app, /"Idempotency-Key": "thread-read:"/);
  assert.match(app, /body: \{ through_message_id: latestMessageId \}/);
  assert.match(app, /Number\(readResult\.through_message_id\) === latestMessageId/);
  assert.match(api, /chatMessageMutationView\(message, replay\)/);
  assert.match(api, /through_message_id: throughMessageId/);
  assert.match(repository, /markConversationRead\(conversationId, userId, throughMessageId = null\)/);
  assert.match(repository, /markConversationRead[\s\S]*?BEGIN IMMEDIATE[\s\S]*?COMMIT/);
  assert.match(repository, /last_read_message_id = MAX\(COALESCE\(last_read_message_id, 0\), \?\)/);
  assert.match(repository, /id > \? AND id <= \?/);
  const openThread = app.slice(app.indexOf("async function openThread"), app.indexOf("function signalTyping"));
  assert.doesNotMatch(openThread, /result\.error \|\| "Mesajul/);
  assert.doesNotMatch(openThread, /upload\.error \|\|/);
});

test("thread content is localized, attachment-confined and decision-replay-safe", () => {
  const thread = app.slice(app.indexOf("async function loadThread"), app.indexOf("function signalTyping"));
  assert.match(app, /function safeInternalMediaUrl\(value\)/);
  assert.match(app, /\^\\\/media\\\/\[a-f0-9\]\{64\}/);
  assert.match(thread, /const attachmentUrl = safeInternalMediaUrl\(message\.attachment_url\)/);
  assert.match(thread, /data-decision-key=/);
  assert.match(thread, /const decisionKey = button\.dataset\.decisionKey/);
  assert.match(thread, /"Idempotency-Key": decisionKey/);
  assert.match(thread, /controls\.forEach\(\(control\) => \{ control\.disabled = true; \}\)/);
  assert.match(thread, /requestHost\.isConnected \|\| activeConversationId !== conversationId \|\| Number\(state\.user\.id\) !== actorId \|\| state\.persona !== actorPersona/);
  assert.match(thread, /Number\(result\.conversation_id\) === conversationId/);
  assert.match(thread, /result\.decision === decision/);
  assert.match(thread, /result\.membership_state === \(decision === "accept" \? "active" : "declined"\)/);
  assert.match(api, /conversation\.context_persona !== auth\.persona/);
  assert.match(api, /actor_persona: auth\.persona/);
  assert.match(thread, /Array\.isArray\(keyMaterial\.users_without_devices\)/);
  assert.match(thread, /decryptedAttachmentUrls\.add\(url\)/);
  assert.match(app, /function revokeDecryptedAttachmentUrls\(\)/);
  assert.match(thread, /error\?\.message === "E2EE requires HTTPS or localhost" \? "secure_context_required" : "device_unavailable"/);
  assert.doesNotMatch(thread, /result\.error|callReady\.reason/);
  assert.doesNotMatch(thread, /Conversație indisponibilă|Decriptează atașamentul|Cheile conversației s-au schimbat/);
  assert.match(interfaceLocale, /"thread\.decryptAttachment": "Decriptează atașamentul"/);
  assert.match(interfaceLocale, /"thread\.decryptAttachment": "Decrypt attachment"/);
});

test("meeting and group administration are accessible, localized and replay-safe", () => {
  const admin = app.slice(app.indexOf("function closeThreadActionSheet"), app.indexOf("// ---------- Profiles ----------"));
  assert.match(app, /manageButton\.disabled = !canManage/);
  assert.doesNotMatch(admin, /window\.prompt/);
  assert.match(admin, /role="dialog" aria-modal="true" aria-labelledby=/);
  assert.match(admin, /data-thread-action-key=/);
  assert.match(admin, /if \(submit\.disabled\) return/);
  assert.match(admin, /headers: \{ "Idempotency-Key": form\.dataset\.threadActionKey \}/);
  assert.match(admin, /if \(!form\.isConnected \|\| activeConversationId !== conversationId \|\| Number\(state\?\.user\?\.id\) !== actorId \|\| state\?\.persona !== actorPersona\) return/);
  assert.match(admin, /participant\.state === "active" && participant\.role !== "owner"/);
  assert.match(admin, /\^\[a-z0-9_\]\{2,30\}\$/);
  assert.match(admin, /expected_title: conversation\.title \?\? null/);
  assert.match(admin, /expected_key_epoch: expectedKeyEpoch/);
  assert.match(admin, /Number\(result\?\.key_epoch\) === expectedKeyEpoch \+ 1/);
  assert.match(repository, /updateGroupTitle\(conversationId, actorId, title, expectedTitle\)[\s\S]*?BEGIN IMMEDIATE/);
  assert.match(repository, /addGroupMember\(conversationId, actorId, userId, expectedKeyEpoch\)[\s\S]*?BEGIN IMMEDIATE/);
  assert.match(repository, /GROUP_MEMBERSHIP_EPOCH_INVARIANT_FAILED/);
  assert.match(admin, /localDateTimeInputValue/);
  assert.match(admin, /startsAtMs < now \+ \(5 \* 60 \* 1000\)/);
  assert.match(admin, /new Set\(\[15, 30, 45, 60, 90, 120\]\)/);
  assert.doesNotMatch(admin, /result\.error|Administrare grup|Titlul întâlnirii|Data nu este validă/);
  assert.match(interfaceLocale, /"group\.title": "Administrează grupul"/);
  assert.match(interfaceLocale, /"meeting\.title": "Schedule a meeting"/);
});

test("auxiliary thread mutations are profile-bound, result-bound and retry-safe", () => {
  const auxiliary = app.slice(app.indexOf("function isBoundAuxiliaryMutation"), app.indexOf("// ---------- Profiles ----------"));
  assert.match(app, /const typingMutationKeys = new Map\(\)/);
  assert.match(auxiliary, /headers: \{ "Idempotency-Key": mutationKey \}/);
  assert.match(auxiliary, /isBoundAuxiliaryMutation\(result, \{ conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, active \}\)/);
  assert.match(auxiliary, /isSafeConversationSummary\(result\?\.conversation, actorId\)/);
  assert.match(auxiliary, /Number\(meeting\.conversation_id\) === conversationId/);
  assert.match(api, /group not found for active profile/);
  assert.match(api, /active conversation not found for active profile/);
  assert.match(api, /intent: \{ conversation_id: conversationId, actor_id: auth\.user\.id, actor_persona: auth\.persona, active \}/);
  assert.match(callClient, /const callMutationKeys = new Map\(\)/);
  assert.match(callClient, /function isSafeCall\(call, expected = \{\}\)/);
  assert.match(callClient, /getPersona/);
  assert.match(callClient, /isBoundIntent\(started, \{ conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, mode \}\)/);
  assert.match(callClient, /payload_persisted === false && result\.replay_guard === "durable_hash_only"/);
  assert.match(repository, /delivered: previous\.delivered_at != null/);
  assert.doesNotMatch(callClient, /throw new Error\(started\.error|showToast\(result\.error/);
});

test("realtime messaging and call events are recipient/profile-bound invalidations", () => {
  const stream = app.slice(app.indexOf("function connectStream"), app.indexOf("init();"));
  assert.match(app, /let nexusEventStreamGeneration = 0/);
  assert.match(stream, /const generation = \+\+nexusEventStreamGeneration/);
  assert.match(stream, /nexusEventStream === es && nexusEventStreamGeneration === generation/);
  assert.match(stream, /Number\(state\?\.user\?\.id\) === viewerId && state\?\.persona === viewerPersona/);
  assert.match(stream, /Number\(payload\?\.recipient_id\) === viewerId && payload\?\.recipient_persona === viewerPersona/);
  assert.match(stream, /event\.data\.length > maxLength/);
  assert.match(stream, /new Set\(\["plaintext_local", "e2ee_v1", "e2ee_group_v1"\]\)/);
  assert.match(stream, /payload\.actor_persona !== viewerPersona/);
  assert.match(stream, /payload\.transport === "local_webrtc_p2p" && payload\.secure_context_required === true/);
  assert.match(api, /viewer_id: auth\.user\.id, viewer_persona: auth\.persona/);
  assert.match(api, /recipient_id: participant\.id,[\s\S]*?recipient_persona: conversation\.context_persona,[\s\S]*?message_id:/);
  assert.doesNotMatch(api, /sse\.publish\(channelForUser\(participant\.id\), "message", \{ conversation_id: conversationId, message \}\)/);
  assert.match(app, /connectStream\(\); toast\("Profil activ: " \+ persona\)/);
});

test("P3 visual foundation keeps the shared shell legible and the key states distinct", () => {
  assert.match(index, /p3-visual-foundation\.css\?v=20260912-messenger1/);
  assert.match(index, appAssetPattern);
  assert.match(visualFoundation, /grid-template-columns:\s*128px minmax\(0,\s*1fr\)/);
  assert.match(visualFoundation, /\.landing-card/);
  assert.match(socialHumanUx, /\.inboxScreen \.securityState summary/);
  assert.match(visualFoundation, /\.emptyInbox/);
  assert.match(visualFoundation, /\.liveHero/);
  assert.match(visualFoundation, /\.liveEmpty/);
  assert.match(visualFoundation, /prefers-reduced-motion/);
});

test("Activity Center is profile-scoped, idempotent and keeps external channels gated", () => {
  assert.match(database, /CREATE TABLE IF NOT EXISTS notification_preferences/);
  assert.match(database, /idx_notif_user_persona/);
  assert.match(repository, /NOTIFICATION_MANDATORY/);
  assert.match(repository, /markAllNotificationsRead/);
  assert.match(api, /\/api\/notification-preferences/);
  assert.match(api, /CHANNEL_GATED/);
  assert.match(messengerShell, /data-inbox-box="activity"/);
  assert.match(app, /data-notification-read-all/);
  assert.match(visualFoundation, /\.notificationCenter/);
  assert.match(api, /function publishNotificationInvalidation/);
  assert.match(api, /"notification-changed"/);
  assert.match(api, /unread_non_message/);
  assert.match(app, /const seenNotificationChanges = new Set\(\)/);
  assert.match(app, /seenNotificationChanges\.has\(payload\.change_id\)/);
  assert.match(app, /seenNotificationChanges\.size > 512/);
  assert.match(app, /refreshNotificationBadge\(\)/);
  assert.match(app, /unreadMessageCount \+ unreadActivityCount/);
});

test("localized Activity Center rejects stale data and replays one user intent", () => {
  const activity = app.slice(app.indexOf("async function renderNotificationActivity"), app.indexOf("function conversationListItem"));
  assert.match(app, /const activityLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /activityLoadGate\.invalidate\(\)/);
  assert.match(activity, /const loadRequest = activityLoadGate\.begin\(\)/);
  assert.match(activity, /!loadRequest\.isCurrent\(\) \|\| !host\?\.isConnected \|\| inboxBox !== "activity" \|\| inboxFilter !== persona/);
  assert.match(activity, /Array\.isArray\(result\.notifications\)/);
  assert.match(activity, /Array\.isArray\(preferenceResult\.preferences\)/);
  assert.match(activity, /NOTIFICATION_TYPES\.has\(item\.type\)/);
  assert.match(activity, /Number\.isSafeInteger\(Number\(item\.id\)\)/);
  assert.match(activity, /data-notification-key=/);
  assert.match(activity, /"Idempotency-Key": button\.dataset\.notificationKey/);
  assert.match(activity, /if \(button\.disabled\) return/);
  // The write path of a preference form is one module now, so its rules are pinned where they live.
  // The module validates and hands the body to a save function; the header and the idempotency key
  // are built by the screen that owns the transport.
  assert.match(notificationPreferences, /type: form\.dataset\.notificationPref/);
  assert.match(app, /save: \(body, key\) => api\("\/api\/notification-preferences", \{ method: "PATCH", headers: \{ "Idempotency-Key": key \}, body \}\)/);
  assert.match(notificationPreferences, /if \(submit\.disabled\) return/);
  assert.match(notificationPreferences, /Boolean\(quietStart\) !== Boolean\(quietEnd\)/);
  assert.match(notificationPreferences, /persona === "dating" \? "generic"/);
  assert.match(notificationPreferences, /export const NOTIFICATION_LABEL_KEYS/);
  assert.doesNotMatch(activity, /result\.error|saved\.error|Activitatea nu poate fi încărcată|Preferință salvată/);
  assert.match(interfaceLocale, /"activity\.markAllRead": "Mark all as read"/);
  assert.match(interfaceLocale, /"activity\.markAllRead": "تحديد الكل كمقروء"/);
});

test("Account Center exposes privacy-safe device sessions and step-up logout-all", () => {
  assert.match(database, /migrateSessionSchema/);
  assert.match(database, /idx_sessions_user_device/);
  assert.match(repository, /listUserSessions/);
  assert.match(repository, /nexus-session-public-v1/);
  assert.match(api, /\/api\/account\/sessions/);
  assert.match(api, /\/auth\/logout-all/);
  assert.match(api, /STEP_UP_REQUIRED/);
  assert.match(profilePanels, /id="account-session-list"/);
  assert.match(profilePanels, /id="sign-out-all"/);
  assert.doesNotMatch(app, /device_fingerprint/);
  assert.match(visualFoundation, /\.accountSession/);
});

test("Account Center manages E2EE devices without exposing key material or promising history transfer", () => {
  const accountDeviceInventory = app.slice(app.indexOf("const loadChatDevices"), app.indexOf("  let selectedRecoveryFile"));
  assert.match(api, /ownerSafeChatDevice/);
  assert.match(api, /public_keys_exposed_in_account_inventory: false/);
  assert.match(api, /historical_access_transferred: false/);
  assert.match(api, /revokeChatDeviceMatch/);
  assert.match(profilePanels, /id="account-chat-device-list"/);
  assert.match(app, /data-revoke-chat-device/);
  assert.match(profilePanels, /t\("security\.revokePermanent"\)/);
  assert.match(interfaceLocale, /Revocarea este definitivă/);
  assert.match(visualFoundation, /\.securityKeyInventory/);
  assert.doesNotMatch(accountDeviceInventory, /public_jwk/);
});

test("E2EE attachments are client-encrypted, purpose-bound and require explicit local opening", () => {
  assert.match(media, /NEXUS-E2EE-ATTACHMENT-V1/);
  assert.match(media, /ciphertext_not_server_scannable/);
  assert.match(resumableUpload, /message_e2ee_attachment/);
  assert.match(resumableUpload, /E2EE_ATTACHMENT_BOUNDARY_INVALID/);
  assert.match(repository, /encrypted_attachment_invalid/);
  assert.match(api, /server_can_malware_scan_attachment/);
  assert.match(chatCrypto, /encryptChatAttachment/);
  assert.match(chatCrypto, /encrypted attachment integrity mismatch/);
  assert.match(app, /t\("thread\.decryptAttachment"\)/);
  assert.match(interfaceLocale, /nu pot fi scanate malware/);
  assert.doesNotMatch(app, /message\.attachment_url.*encrypted_attachment.*download/);
  assert.match(visualFoundation, /\.e2eeAttachment/);
});

test("E2EE safety number is device-set bound, locally verified and blocks changed keys", () => {
  assert.match(chatCrypto, /NEXUS_SAFETY_NUMBER_V1/);
  assert.match(chatCrypto, /E2EE device-set commitment mismatch/);
  assert.match(chatCrypto, /changePending: true/);
  assert.match(chatCrypto, /conversation-trust/);
  assert.match(app, /id="e2ee-safety"/);
  assert.match(app, /t\("thread\.keysChanged"\)/);
  assert.match(app, /safety\?\.state !== "changed"/);
  assert.match(app, /t\("thread\.compareSafety"\)/);
  assert.doesNotMatch(app, /share.*safety/i);
});

test("E2EE recovery is client-encrypted, opt-in and explicitly forward-only", () => {
  assert.match(chatCrypto, /NEXUS-E2EE-RECOVERY-V1/);
  assert.match(chatCrypto, /E2EE_RECOVERY_KDF_ITERATIONS = 600_000/);
  assert.match(chatCrypto, /scope: "future_messages_only"/);
  assert.match(chatCrypto, /NEXUS_E2EE_ACCOUNT_BINDING_V1/);
  assert.match(chatCrypto, /belongs to a different Nexus account/);
  assert.match(chatCrypto, /passphrase is too predictable/);
  assert.match(chatCrypto, /different E2EE key already exists in this browser/);
  assert.match(chatCrypto, /privateKeyExtractable: privateKey\.extractable/);
  assert.match(profilePanels, /id="create-e2ee-recovery"/);
  assert.match(profilePanels, /id="restore-e2ee-recovery"/);
  assert.match(profilePanels, /t\("security\.recoveryIntro"\)/);
  assert.match(interfaceLocale, /numai mesajele trimise după activare/);
  assert.match(interfaceLocale, /Nexus nu primește parola sau cheia privată/);
  assert.doesNotMatch(app, /upload.*recovery.*bundle/i);
});

test("E2EE recovery remains pending until explicit download confirmation and expires fail-closed", () => {
  assert.match(database, /device_kind TEXT NOT NULL DEFAULT 'primary'/);
  assert.match(database, /idx_chat_devices_pending_expiry/);
  assert.match(repository, /status = 'pending_recovery'/);
  assert.match(repository, /MAX_RECOVERY_DEVICES_PER_USER = 3/);
  assert.match(repository, /generic registration cannot bypass confirmation|recoveryId/);
  assert.match(api, /\/api\/chat\/recovery-devices/);
  assert.match(api, /RECOVERY_ACTIVATION_EXPIRED/);
  assert.match(chatCrypto, /activateProvisionedRecoveryDevice/);
  assert.match(profilePanels, /id="activate-e2ee-recovery"/);
  assert.match(profilePanels, /t\("security\.savedActivate"\)/);
  assert.match(interfaceLocale, /Am salvat fișierul · Activează/);
  assert.match(app, /t\("recovery\.downloadRequested"\)/);
  assert.match(interfaceLocale, /Descărcarea a fost solicitată/);
  assert.doesNotMatch(app, /Pachet E2EE criptat descărcat/);
});

test("E2EE pending activation survives refresh without plaintext browser storage", () => {
  assert.match(chatCrypto, /RECOVERY_ACTIVATION_STORE = "recovery-activation"/);
  assert.match(chatCrypto, /indexedDB\.open\(DB_NAME, 3\)/);
  assert.match(chatCrypto, /persistPendingRecoveryActivation/);
  assert.match(chatCrypto, /readPendingRecoveryActivation/);
  assert.match(chatCrypto, /transaction\.oncomplete/);
  assert.match(chatCrypto, /transaction\.onabort/);
  assert.match(chatCrypto, /AES-GCM/);
  assert.match(app, /t\("recovery\.pendingRecovered"\)/);
  assert.match(app, /"recovery\.refreshSafe"/);
  assert.match(interfaceLocale, /Activare recuperată după refresh/);
  assert.match(interfaceLocale, /Confirmarea rezistă unui refresh/);
  assert.doesNotMatch(app, /(?:localStorage|sessionStorage)\.setItem\([^\n]*recovery/i);
  assert.match(index, appAssetPattern);
});

test("new E2EE messages are epoch-bound and membership/device changes rotate fail closed", () => {
  assert.match(database, /chat_key_epoch INTEGER NOT NULL DEFAULT 1/);
  assert.match(database, /key_epoch_commitment TEXT/);
  assert.match(repository, /key_epoch = key_epoch \+ 1/);
  assert.match(repository, /chat_key_epoch = chat_key_epoch \+ 1/);
  assert.match(repository, /conversation_blocked/);
  assert.match(repository, /BEGIN IMMEDIATE/);
  assert.match(api, /NEXUS_E2EE_V2_EPOCH_BOUND/);
  assert.match(api, /key_epoch_stale/);
  assert.match(chatCrypto, /NEXUS_CHAT_SALT_V2/);
  assert.match(chatCrypto, /epoch-bound E2EE key material is required for new messages/);
  assert.match(chatCrypto, /NEXUS_CHAT_SALT_V1/, "legacy ciphertext remains decryptable without permitting new downgrade writes");
});

test("Account lifecycle is step-up protected, export allow-listed and purge defaults to dry-run", () => {
  assert.match(database, /account_export_requests/);
  assert.match(database, /account_deletion_requests/);
  assert.match(accountLifecycle, /ACCOUNT_DELETION_GRACE_SECONDS = 30/);
  assert.match(accountLifecycle, /secrets_excluded: true/);
  assert.doesNotMatch(accountLifecycle, /SELECT \* FROM users WHERE id/);
  assert.match(api, /DELETION_DOUBLE_CONFIRMATION_REQUIRED/);
  assert.match(api, /ACCOUNT_DELETION_PENDING/);
  assert.match(profilePanels, /id="request-account-export"/);
  assert.match(profilePanels, /id="request-account-deletion"/);
  assert.match(visualFoundation, /\.accountLifecycle/);
  assert.match(accountPurge, /mode: "dry_run"/);
  assert.match(accountPurge, /NEXUS_ACCOUNT_PURGE_EXECUTE/);
  assert.equal(packageManifest.scripts["account:purge:dry-run"], "node scripts/account-purge.mjs");
});

test("incident containment is fail-closed and recovery proof is synthetic-only", () => {
  assert.match(database, /operational_controls/);
  assert.match(operationalControls, /all_mutations/);
  assert.match(operationalControls, /resume requires a distinct checker/);
  assert.match(operationalControls, /previous_hash/);
  assert.match(api, /OPERATIONAL_CONTROL_ACTIVE/);
  assert.match(api, /status: degraded \? "degraded" : "ready"/);
  assert.match(incidentControl, /NEXUS_INCIDENT_CONTROL_EXECUTE/);
  assert.match(backupRestore, /restored state hash mismatch/);
  assert.match(recoveryDrill, /demo_database_opened: false/);
  assert.match(incidentRunbook, /Never restore over the live database/);
  assert.equal(packageManifest.scripts["incident:status"], "node scripts/incident-control.mjs");
  assert.equal(packageManifest.scripts["recovery:drill"], "node scripts/backup-restore-drill.mjs");
});

test("Action Ledger is atomic, hash-only, synthetic-safe and locally reconcilable", () => {
  assert.match(database, /CREATE TABLE IF NOT EXISTS action_intents/);
  assert.match(database, /outcome_status INTEGER/);
  assert.match(actionLedger, /EXCLUDED_SYNTHETIC/);
  assert.match(actionLedger, /EPHEMERAL_EXCLUDED/);
  assert.match(actionLedger, /LOCAL_ACCEPTED_CHAIN_DISABLED/);
  assert.match(actionLedger, /LOCAL_ONLY_NOT_CONFIRMED/);
  assert.match(actionLedger, /action\.intent\.created/);
  assert.doesNotMatch(actionLedger, /caption|email|wallet_address|message_body/);
  assert.match(actionReconcile, /NEXUS_ACTION_RECONCILE_REPAIR/);
  assert.match(actionReconcile, /external_network: false/);
  assert.equal(packageManifest.scripts["action:reconcile"], "node scripts/action-ledger-reconcile.mjs");
  assert.equal(packageManifest.scripts["action:reconcile:repair"], "node scripts/action-ledger-reconcile.mjs --repair");
  assert.match(envExample, /NEXUS_ACTION_RECONCILE_REPAIR=0/);
  assert.match(readme, /Action Ledger și reconciliere/);
});

test("Profile settings open from one drawer of bounded panels, never from a second tab bar", () => {
  // The drawer is the only index the profile has: seven rows, in the order the menu renders them.
  assert.match(app, /const profileViews = \["profile", "wallet", "access", "privacy", "notifications", "settings"\]/);
  assert.equal(app.includes("data-profile-settings-tab"), false);
  assert.match(profileMenu, /"profile"[\s\S]{0,90}"wallet"[\s\S]{0,90}"access"[\s\S]{0,120}"privacy"[\s\S]{0,140}"notifications"[\s\S]{0,150}"appearance"[\s\S]{0,200}"logout"/);
  assert.match(profileMenu, /id: "privacy", glyph: "◎", label: "profileMenu\.privacy"/);
  assert.match(profileMenu, /id: "notifications", glyph: "◌", label: "profileMenu\.notifications"/);
  assert.match(profileMenu, /id: "appearance", glyph: "◐", label: "profileMenu\.appearance"/);
  assert.match(profileMenu, /id: "logout", glyph: "→", label: "x\.profile\.logout"/);
  assert.match(app, /bindProfileMenu\(vp, \{/);
  assert.match(app, /onSelect: \(id\) => setProfileSettingsView\(profileMenuView\(id\)\)/);
  assert.match(app, /markProfileMenuActive\(screen, activeTabId\(nextView\)\)/);
  assert.match(profilePanels, /data-profile-panel="profile"/);
  assert.match(profilePanels, /data-profile-panel="wallet"/);
  assert.match(profilePanels, /data-profile-panel="access"/);
  assert.match(profilePanels, /data-profile-panel="settings"/);
  assert.match(app, /profilePanelInactive/);
  assert.match(app, /aria-hidden/);
  assert.match(visualFoundation, /\.profileSectionTabs/);
  assert.match(visualFoundation, /\.accountScreen \.profilePanelInactive/);

test("owner profile hero keeps the avatar-centric layout with localized per-tab empty states", () => {
  assert.match(profileExperience, /class="ownerHero"/);
  // The tab a reader presses is the tab the render syncs and the tab the screen is told about: one identity per
  // press, read off the button, and that same press opens the filters the icon carries.
  assert.match(profileExperience, /const kind = tab\.dataset\.ownerContent;/);
  assert.match(profileExperience, /onContentTab\?\.\(kind\);/);
  assert.match(app, /const selectProfileSection = \(id\) => profileSectionSwitcher\?\.\(id\)/);
  assert.match(app, /onContentTab: \(\) => \{ if \(host\.hidden\) selectProfileSection\("profile"\); \}/);
  assert.match(profileExperience, /class="ownerAvatar"/);
  // Whispers read as one card after another, and every card carries the same real
  // reaction / comment / repost controls the feed card uses instead of a decorative row.
  assert.match(profileExperience, /class="ownerWhisperCard"/);
  assert.match(profileExperience, /class="ownerWhisperList" role="region"/);
  assert.match(profileExperience, /data-reaction-toggle="' \+ id \+ '"/);
  assert.match(profileExperience, /profileContentBuckets\(\[\.\.\.posts, \.\.\.repostEntries\], \{/);
  assert.doesNotMatch(profileExperience, /class="textTile"/);
  // The band carries the handle, the location and the three counters, so the hero prints none of them
  // a second time: the facts stay once, in one screen-reader-only line, and the location row is the
  // editor for a fact the band shows - visible only while the identity is being edited.
  assert.match(profileExperience, /class="ownerFacts"/);
  assert.doesNotMatch(profileExperience, /class="ownerStats"/);
  assert.doesNotMatch(profileExperience, /class="ownerHandle"/);
  assert.match(profileExperienceCss, /\.ownerFacts\{position:absolute;width:1px;height:1px/);
  assert.match(profileExperienceCss, /\.ownerLocationRow\{position:relative;display:none/);
  assert.match(profileExperienceCss, /\.nexusOwnerProfile\.heroEditing \.ownerLocationRow\{display:flex\}/);
  assert.match(profileExperience, /data-owner-empty-for/);
  assert.match(profileExperience, /profile\.empty\.' \+ kind \+ '\.title/);
  assert.match(profileExperience, /tr\('profile\.tab' \+ kind\[0\]\.toUpperCase\(\) \+ kind\.slice\(1\)\)/);
  assert.match(profileExperience, /profile\.bioPlaceholder/);
  assert.match(app, /const activeTabId = \(view\) => \(view === "edit" \? "profile" : view\);/);
  assert.match(profilePanels, /data-device-setting="sound"/);
  assert.match(profilePanels, /data-device-setting="fit"/);
  assert.match(profilePanels, /data-device-setting="presentation"/);
  assert.match(app, /setSocialPresentation\(socialPresentation === "immersive" \? "cards" : "immersive"\)/);
  // The assets are edited on the profile itself now, so no settings route opens that form and no row
  // points at it: the panel keeps the policy, the device settings and the sign-out.
  assert.equal(app.includes("openProfileEditorView"), false);
  assert.equal(app.includes("profile-assets-edit"), false);
  assert.match(profileExperienceCss, /\.ownerHero\{display:grid;gap:6px;padding:12px 14px 0;text-align:left/);
  assert.match(profileExperienceCss, /\.ownerAvatar\{width:78px;height:78px/);
  // The panels are indexed by the drawer, so the sticky bar above them is the only chrome left.
  assert.match(profileExperienceCss, /\.accountMenuBar\{position:sticky/);
  assert.equal(profileExperienceCss.includes(".profileSettingsTabs"), false);
  assert.match(profileExperienceCss, /\.ownerEmptyState\{display:grid/);
  assert.match(profileExperienceCss, /\.ownerEmptyState\[hidden\]\{display:none!important\}/);
  assert.match(profileExperienceCss, /\.ownerWhisperList\{display:grid/);
  assert.match(profileExperienceCss, /\.ownerWhisperAction\{display:inline-flex/);
  assert.match(profileExperienceCss, /\.ownerWhisperCard>\.comments\{position:relative/);
  assert.match(profileExperienceCss, /\.ownerBio\{display:-webkit-box/);
  assert.equal((interfaceLocale.match(/"profile\.editShort":/g) || []).length, 4);
  assert.equal((interfaceLocale.match(/"profile\.settingsNote":/g) || []).length, 4);
  assert.equal((interfaceLocale.match(/"profile\.empty\.whispers\.detail":/g) || []).length, 4);
});
});

test("localized Profile shell rejects stale loads and malformed preview media", () => {
  const profileShell = app.slice(app.indexOf("async function renderProfiles"), app.indexOf("  const edit = document.getElementById(\"pedit\")"));
  const preview = app.slice(app.indexOf("function renderProfilePreview"), app.indexOf("function renderAssetList"));
  assert.match(app, /const profileLoadGate = createLatestRequestGate\(\)/);
  assert.match(profileShell, /const selectedPersona = state\.persona/);
  assert.match(profileShell, /const loadRequest = profileLoadGate\.begin\(\)/);
  assert.match(profileShell, /!loadRequest\.isCurrent\(\) \|\| !vp\?\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(profileShell, /!publicProfile\?\.ok \|\| !publicProfile\.profile \|\| typeof publicProfile\.profile !== "object"/);
  assert.match(profileShell, /data-profile-retry/);
  assert.match(profileShell, /accountResponse\?\.ok \? accountResponse : \{ ok: false, providers: \{\}, funding: \{\} \}/);
  assert.match(profileExperience, /const avatar = safeUrl\(profile\.avatar\), cover = safeUrl\(profile\.cover\)/);
  assert.match(profileExperience, /Array\.isArray\(result\.posts\)/);
  assert.match(profileExperience, /Number\(post\.id\)/);
  assert.match(preview, /safeInternalMediaUrl\("\/media\/"/);
  assert.doesNotMatch(profileShell, /Profil & setări|Secțiuni profil/);
  assert.doesNotMatch(preview, /Adaugă o descriere|Nicio postare în acest profil|Copertă profil/);
  assert.match(interfaceLocale, /"profile\.title": "Profile and settings"/);
  assert.match(interfaceLocale, /"profile\.title": "الملف والإعدادات"/);
});

test("public profile overlay is localized, stale-safe and validates private media boundaries", () => {
  const publicProfile = app.slice(app.indexOf("async function openCreatorProfile"), app.indexOf("function messageCreator"));
  assert.match(app, /const publicProfileLoadGate = createLatestRequestGate\(\)/);
  assert.match(publicProfile, /const request = publicProfileLoadGate\.begin\(\)/);
  assert.match(publicProfile, /const selectedPersona = state\.persona/);
  assert.match(publicProfile, /!request\.isCurrent\(\) \|\| !backdrop\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(publicProfile, /profile\.persona === selectedPersona/);
  assert.match(publicProfile, /result\.posts\.length <= 100/);
  assert.match(publicProfile, /post\.caption\.length <= 5_000/);
  assert.match(publicProfile, /\^\[a-f0-9\]\{64\}\$/);
  // Identity media and tab rendering are shared with the canonical profile.
  // Behavioral markup/handler coverage lives in creator-profile.test.js.
  assert.match(publicProfile, /renderCreatorProfile\(/);
  assert.match(publicProfile, /safeUrl: safeInternalMediaUrl/);
  assert.match(publicProfile, /profile\.handle === normalized/);
  for (const key of ["dialog", "loading", "unavailable", "unavailableDetail"]) {
    assert.match(publicProfile, new RegExp(`t\\("publicProfile\\.${key}"\\)`));
  }
  assert.doesNotMatch(publicProfile, /Profil indisponibil|Fără bio publică|Editează profilul|Nicio postare vizibilă/);
  for (const locale of ["ro", "en", "pl", "ar"]) assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"publicProfile\\.noPosts"`));
});

test("follow actions replay one stable intent and synchronize every visible surface", () => {
  const follow = app.slice(app.indexOf("async function toggleFollow"), app.indexOf("// ---------- Create Hub"));
  assert.match(follow, /if \(!btn\?\.isConnected \|\| btn\.disabled\) return/);
  assert.match(follow, /Number\.isSafeInteger\(target\)/);
  assert.match(follow, /const selectedPersona = state\.persona/);
  assert.match(follow, /btn\.dataset\.followIntent !== intent \|\| !btn\.dataset\.followKey/);
  assert.match(follow, /newUploadMutationKey\("follow-toggle"\)/);
  assert.match(follow, /headers: \{ "Idempotency-Key": btn\.dataset\.followKey \}/);
  assert.match(follow, /!btn\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(follow, /typeof r\.active === "boolean"/);
  assert.match(follow, /!\(r\.active && r\.request_pending\)/);
  assert.match(follow, /document\.querySelectorAll\('\[data-follow="' \+ target \+ '\"\]'\)/);
  assert.match(follow, /delete followButton\.dataset\.followKey/);
  assert.match(follow, /\^\[a-f0-9\]\{64\}\$/);
  assert.doesNotMatch(follow, /toast\(r\.error|toast\(r\?\.error/);
});

test("profile editor is localized, replay-safe and bound to one Privacy Matrix persona", () => {
  const editor = app.slice(app.indexOf('const profileForm = document.getElementById("profile-form")'), app.indexOf('  const dev = await api("/api/devnet")'));
  assert.match(profilePanels, /data-profile-key=/);
  assert.match(editor, /profileForm\.dataset\.profileKey = newUploadMutationKey\("profile-save"\)/);
  assert.match(editor, /if \(submit\.disabled\) return/);
  assert.match(editor, /profileControls\.forEach\(\(control\) => \{ control\.disabled = true; \}\)/);
  assert.match(editor, /const releaseProfileForm/);
  assert.match(editor, /const submissionKey = form\.dataset\.profileKey/);
  assert.match(editor, /headers: \{ "Idempotency-Key": submissionKey \}/);
  assert.match(editor, /api\("\/api\/persona\/" \+ selectedPersona/);
  assert.match(editor, /!form\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(editor, /result\.persona\.persona !== selectedPersona/);
  assert.match(editor, /form\.dataset\.profileKey !== submissionKey/);
  assert.match(editor, /Number\(result\.owner_id\) !== Number\(state\.user\.id\)/);
  assert.match(editor, /result\.requested_persona !== selectedPersona/);
  assert.match(editor, /Number\(result\.persona\.user_id\) !== Number\(state\.user\.id\)/);
  assert.match(editor, /new Set\(\["public", "followers", "friends", "private"\]\)/);
  assert.match(editor, /new Set\(\["public", "hidden"\]\)\.has\(discoverability\)/);
  assert.match(editor, /result\.persona\.discoverability !== discoverability/);
  assert.match(editor, /new Set\(\["everyone", "requests", "followers", "nobody"\]\)/);
  assert.match(editor, /privateAccessPriceCents < 100/);
  assert.match(editor, /nearEnabled && !regionCode/);
  // The form holds the policy only: the avatar and the cover are uploaded by the hero editor, so the
  // settings submission carries no image and no upload at all.
  assert.doesNotMatch(editor, /uploadMediaResumable/);
  assert.doesNotMatch(editor, /persona-avatar|persona-cover/);
  assert.doesNotMatch(editor, /upload\.error|result\.error|r\.error/);
  assert.match(interfaceLocale, /"profileEdit\.save": "Save profile"/);
  assert.match(interfaceLocale, /"profileEdit\.save": "Zapisz profil"/);
  assert.match(interfaceLocale, /"profileEdit\.save": "حفظ الملف"/);
});

test("wallet and Nexus username UI is localized, replay-safe and truthful", () => {
  const wallet = app.slice(app.indexOf('document.getElementById("copy-address")'), app.indexOf('  const localWallet ='));
  const assets = app.slice(app.indexOf("function renderAssetList"), app.indexOf("async function switchPersona"));
  assert.match(app, /\^erd1\[a-z0-9\]\{58\}\$/);
  assert.match(app, /account\.ok && account\.funding\?\.crypto_transfer === true && address/);
  assert.match(profilePanels, /data-username-key=/);
  assert.match(wallet, /dataset\.usernameKey = newUploadMutationKey\("username-claim"\)/);
  assert.match(wallet, /if \(usernameButton\.disabled\) return/);
  assert.match(wallet, /const usernameKey = usernameButton\.dataset\.usernameKey/);
  assert.match(wallet, /headers: \{ "Idempotency-Key": usernameKey \}/);
  assert.match(wallet, /input\.disabled = true/);
  assert.match(wallet, /!usernameButton\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(wallet, /result\.user\.handle !== username/);
  assert.match(wallet, /Number\(result\.owner_id\) !== Number\(state\.user\.id\)/);
  assert.match(wallet, /result\.username !== username/);
  assert.doesNotMatch(wallet, /result\.error|r\.error/);
  assert.match(assets, /Array\.isArray\(account\.assets\)/);
  assert.match(assets, /slice\(0, 100\)/);
  assert.match(assets, /Number\(asset\.amount\) > 0/);
  assert.match(assets, /document\.execCommand\("copy"\) === true/);
  assert.match(assets, /copied \? message : t\("common\.copyFailed"\)/);
  assert.match(interfaceLocale, /"wallet\.usernameSaved": "Username saved ✓"/);
  assert.match(interfaceLocale, /"wallet\.usernameSaved": "Nazwa zapisana ✓"/);
  assert.match(interfaceLocale, /"wallet\.usernameSaved": "تم حفظ الاسم ✓"/);
});

test("Account session inventory is localized, stale-safe and replay-safe", () => {
  const sessions = app.slice(app.indexOf("const accountSessionsLoadGate"), app.indexOf("  const loadChatDevices"));
  assert.match(sessions, /const request = accountSessionsLoadGate\.begin\(\)/);
  assert.match(sessions, /!request\.isCurrent\(\) \|\| !host\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(sessions, /!result\?\.ok \|\| !Array\.isArray\(result\.sessions\)/);
  assert.match(sessions, /Number\.isSafeInteger\(Number\(session\.id\)\)/);
  assert.match(sessions, /sessions\.filter\(\(session\) => session\.current\)\.length !== 1/);
  assert.match(sessions, /slice\(0, 100\)/);
  assert.match(sessions, /data-revoke-key=/);
  assert.match(sessions, /if \(button\.disabled\) return/);
  assert.match(sessions, /headers: \{ "Idempotency-Key": button\.dataset\.revokeKey \}/);
  assert.match(sessions, /!button\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.doesNotMatch(sessions, /revoked\.error|result\.error/);
  assert.match(interfaceLocale, /"sessions\.revoked": "Session revoked ✓"/);
  assert.match(interfaceLocale, /"sessions\.revoked": "Sesja unieważniona ✓"/);
  assert.match(interfaceLocale, /"sessions\.revoked": "تم إبطال الجلسة ✓"/);
});

test("E2EE device inventory and recovery UI fail closed on stale or malformed state", () => {
  const devices = app.slice(app.indexOf("const chatDevicesLoadGate"), app.indexOf("  let selectedRecoveryFile"));
  const recovery = app.slice(app.indexOf("  let selectedRecoveryFile"), app.indexOf('  document.getElementById("refresh-sessions")'));
  assert.match(devices, /const request = chatDevicesLoadGate\.begin\(\)/);
  assert.match(devices, /!request\.isCurrent\(\) \|\| !host\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(devices, /!Array\.isArray\(result\.devices\) \|\| result\.devices\.length > 100/);
  assert.match(devices, /Number\(result\.query\?\.owner_id\) !== Number\(u\.id\)/);
  assert.match(devices, /public_keys_exposed_in_account_inventory !== false/);
  assert.match(devices, /device\.key_algorithm === "ECDH-P256"/);
  assert.match(devices, /new Set\(devices\.map\(\(device\) => device\.device_id\)\)\.size !== devices\.length/);
  assert.match(devices, /data-revoke-device-key=/);
  assert.match(devices, /headers: \{ "Idempotency-Key": button\.dataset\.revokeDeviceKey \}/);
  assert.match(devices, /revoked\.intent\?\.owner_id === Number\(u\.id\)/);
  assert.match(devices, /revoked\.device\.device_id === deviceId && revoked\.device\.status === "revoked"/);
  assert.doesNotMatch(devices, /revoked\.error|result\.error/);
  assert.match(recovery, /recoveryScreenActive/);
  assert.match(recovery, /selectedRecoveryFile\.type === "application\/json"/);
  assert.match(recovery, /selectedRecoveryFile\.size <= 64 \* 1024/);
  assert.match(recovery, /Number\(pendingRecoveryActivation\.expiresAt\) \* 1000 > Date\.now\(\)/);
  assert.match(recovery, /clearPendingRecoveryActivation\(\)\.catch/);
  assert.doesNotMatch(recovery, /error\.message/);
  assert.match(interfaceLocale, /"e2eeDevices\.revokeSuccess": "E2EE device permanently revoked ✓"/);
  assert.match(interfaceLocale, /"e2eeDevices\.revokeSuccess": "Urządzenie E2EE trwale unieważnione ✓"/);
  assert.match(interfaceLocale, /"e2eeDevices\.revokeSuccess": "تم إبطال جهاز E2EE نهائيًا ✓"/);
});

test("E2EE device registration and recovery mutations bind owner, device and stable replay key", () => {
  assert.match(chatCrypto, /function safeOwnerDeviceResult\(result, \{ ownerId, deviceId, action, status \}\)/);
  assert.match(chatCrypto, /`nexus-e2ee-register:\$\{record\.deviceId\}`/);
  assert.match(chatCrypto, /registered\?\.code === "CHAT_DEVICE_ID_UNAVAILABLE"/);
  assert.doesNotMatch(chatCrypto, /if \(!registered\.ok\) \{[\s\S]*?record = await createDeviceRecord/);
  assert.match(chatCrypto, /`nexus-recovery-provision:\$\{deviceId\}`/);
  assert.match(chatCrypto, /`nexus-recovery-activate:\$\{deviceId\}`/);
  assert.match(chatCrypto, /pending\.device\.activation_expires_at\) !== Number\(pending\.activation_expires_at\)/);
  assert.match(chatCrypto, /result\.intent\?\.owner_id === ownerId/);
  assert.match(api, /query: \{ owner_id: auth\.user\.id \}/);
  assert.match(api, /CHAT_DEVICE_ID_UNAVAILABLE/);
  assert.match(api, /intent: \{ owner_id: auth\.user\.id, device_id: deviceId, action: "register" \}/);
  assert.match(api, /intent: \{ owner_id: auth\.user\.id, device_id: recoveryActivationDeviceId, action: "activate_recovery" \}/);
});

test("post reactions are single-flight, stable-replay and exact-result bound", () => {
  assert.match(app, /const postReactionMutations = new Map\(\)/);
  assert.match(app, /intentFingerprint = `\$\{postId\}:\$\{state\.user\.id\}:\$\{state\.persona\}:\$\{reaction\}:\$\{active\}`/);
  assert.match(app, /if \(previous\?\.inFlight\) return/);
  assert.match(app, /"Idempotency-Key": intent\.key/);
  assert.match(app, /Number\(r\.post_id\) === postId/);
  assert.match(app, /Number\(r\.actor_id\) === Number\(state\.user\.id\)/);
  assert.match(app, /r\.actor_persona === state\.persona/);
  assert.match(app, /r\.viewer_reaction === \(active \? reaction : null\)/);
  assert.match(api, /post_id: id, actor_id: auth\.user\.id, actor_persona: auth\.persona/);
  assert.match(api, /comment_id: commentId, post_id: comment\.post_id/);
});

test("comment lists and mutations are stale-safe, retry-stable and target bound", () => {
  assert.match(app, /const commentListLoadGates = new Map\(\)/);
  assert.match(app, /const commentMutationStates = new Map\(\)/);
  assert.match(app, /function beginCommentMutation\(scope, fingerprint\)/);
  assert.match(app, /if \(previous\?\.inFlight\) return null/);
  assert.match(app, /Number\(r\.post_id\) !== postId \|\| Number\(r\.viewer_id\) !== viewerId/);
  assert.match(app, /r\.viewer_persona !== viewerPersona/);
  assert.match(app, /isSafeCommentResult\(result, \{ postId, commentId, withdrawn: true \}\)/);
  assert.match(app, /headers: \{ "Idempotency-Key": intent\.key \}/);
  assert.match(api, /viewer_id: auth\.user\.id/);
  assert.match(api, /comment_id: commentId, post_id: post\.id, actor_id: auth\.user\.id/);
});

test("secondary engagement mutations are exact-result bound and retry-stable", () => {
  assert.match(app, /const secondaryEngagementMutations = new Map\(\)/);
  assert.match(app, /function beginSecondaryEngagement\(scope, fingerprint\)/);
  assert.match(app, /function isExactSecondaryEngagement\(result, postId\)/);
  assert.match(app, /headers: \{ "Idempotency-Key": intent\.key \}/);
  assert.match(app, /result\.reposted_by_me === active/);
  assert.match(app, /result\.kind === "NOT_INTERESTED" && result\.active === true && result\.private === true/);
  assert.match(api, /saved: repo\.hasSavedPost\(auth\.user\.id, auth\.persona, id\)/);
  assert.match(api, /active: summary\.reposted_by_me/);
});

test("Story list and view receipts are viewer-bound, stale-safe and retry-stable", () => {
  assert.match(app, /const storyLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const storyViewMutations = new Map\(\)/);
  assert.match(app, /Number\(r\.viewer_id\) !== viewerId \|\| r\.viewer_persona !== viewerPersona/);
  assert.match(app, /stories\.length <= 100/);
  assert.match(app, /headers: \{ "Idempotency-Key": intent\.key \}/);
  assert.match(app, /Number\(result\.actor_id\) === viewerId && result\.actor_persona === viewerPersona/);
  assert.match(app, /Number\(state\.user\.id\) !== viewerId \|\| state\.persona !== viewerPersona/);
  assert.match(app, /story\.viewed_by_me = result\.viewed/);
  assert.match(app, /story\.expires_at == null \|\| \(Number\.isSafeInteger/);
  assert.match(app, /story\.lifecycle === \(story\.expires_at == null \? "persistent_until_archived" : "expires"\)/);
  assert.match(app, /function commitStoryViewerProgress\(completed = false\)/);
  assert.match(app, /storyViewerState\.watchedMs = Math\.min/);
  assert.match(app, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(app, /storyViewerState\?\.sessionId === sessionId && storyViewerState\.frameGeneration === frameGeneration/);
  assert.match(app, /closeStoryViewer\(\{ recordProgress: false \}\)/);
  assert.match(api, /requested_progress: progress, requested_completed: body\.completed === true/);
  assert.match(api, /story_id: id, actor_id: auth\.user\.id, actor_persona: auth\.persona/);
});

test("Social feed is latest-request, query, viewer and bounded-result bound", () => {
  assert.match(app, /const socialFeedLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const socialFeedPageLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /const requestedLens = socialLens/);
  assert.match(app, /socialLens !== requestedLens \|\| socialFormat !== requestedFormat/);
  assert.match(app, /function isSafeSocialFeedPage\(result/);
  assert.match(app, /result\.posts\.length <= 30/);
  assert.match(app, /page\.posts\.some\(\(post\) => known\.has\(Number\(post\.id\)\)\)/);
  assert.match(api, /decodeSocialFeedCursor\(cursorRaw, cursorExpected\)/);
  assert.match(api, /cursor: cursorRaw \?\? null, next_cursor: nextCursor, posts/);
  assert.match(api, /synthetic_traffic_eligible: false/);
});

test("Social impressions are visibility-based, batched and profile-race safe", () => {
  assert.match(app, /const socialImpressionQueue = new Map\(\)/);
  assert.match(app, /function queueSocialImpression\(postId/);
  assert.match(app, /function flushSocialImpressions\(\)/);
  assert.match(app, /"Idempotency-Key": key/);
  assert.match(app, /Number\(result\.viewer_id\) === viewerId && result\.viewer_persona === viewerPersona/);
  assert.match(app, /socialImpressionGeneration !== generation/);
  assert.match(app, /function wireFeedExposure\(container\)/);
  assert.match(app, /resetSocialImpressionSession\(\)/);
  assert.match(api, /viewer_id: auth\.user\.id, viewer_persona: auth\.persona, \.\.\.result/);
});

test("moderation reports are stable-replay, single-flight and exact reporter bound", () => {
  assert.match(app, /data-report-key="' \+ esc\(newUploadMutationKey\("moderation-report"\)\)/);
  assert.match(app, /dataset\.inFlight === "true"/);
  assert.match(app, /"Idempotency-Key": event\.currentTarget\.dataset\.reportKey/);
  assert.match(app, /r\.subject_type === subjectType && Number\(r\.subject_id\) === Number\(postId\)/);
  assert.match(app, /Number\(r\.reporter_id\) === reporterId && r\.reporter_persona === reporterPersona/);
  assert.match(app, /r\.report\.category === requestedCategory/);
  assert.match(api, /subject_type: "comment", subject_id: commentId/);
  assert.match(api, /subject_type: "post", subject_id: post\.id/);
});

test("E2EE key material is profile-scoped, commitment-checked and fail-closed before encryption", () => {
  assert.match(api, /conversation\.context_persona !== auth\.persona/);
  assert.match(api, /query: \{ conversation_id: conversationId, viewer_id: auth\.user\.id, viewer_persona: auth\.persona \}/);
  assert.match(api, /privacy_enforced_server_side: true/);
  assert.match(repository, /participants: materialParticipants/);
  assert.match(chatCrypto, /export async function validateConversationKeyMaterial/);
  assert.match(chatCrypto, /E2EE device-set commitment mismatch/);
  assert.match(chatCrypto, /devices\.length > 500/);
  assert.match(chatCrypto, /current device coverage is invalid/);
  assert.match(chatCrypto, /ensureChatDevice\(api, ownerId\)/);
  assert.match(app, /ownerId: intent\.userId, persona: intent\.persona/);
  assert.match(app, /validateConversationKeyMaterial\(material/);
});

test("E2EE decryption binds the exact message context and bounds local attachment plaintext", () => {
  assert.match(chatCrypto, /export function validateEncryptedMessageContext/);
  for (const field of ["message_id", "conversation_id", "client_nonce", "sender_device_id", "device_set_commitment", "key_epoch", "key_epoch_commitment"]) {
    assert.match(chatCrypto, new RegExp(`envelope\\.${field}`));
  }
  assert.match(chatCrypto, /publicKeys\.some\(\(key\) => !new Set\(\["kty", "crv", "x", "y"\]\)\.has\(key\)\)/);
  assert.match(chatCrypto, /readBoundedResponseBytes\(response, 20 \* 1024 \* 1024\)/);
  assert.match(chatCrypto, /keyBytes\.fill\(0\)/);
  assert.match(chatCrypto, /if \(signal\?\.aborted\) throw new DOMException/);
  assert.match(chatCrypto, /cache: "no-store", signal/);
  assert.match(chatCrypto, /encrypted attachment storage reference is invalid/);
  assert.match(app, /window\.addEventListener\("pagehide", revokeDecryptedAttachmentUrls\)/);
  assert.match(app, /if \(document\.visibilityState === "hidden"\) revokeDecryptedAttachmentUrls\(\)/);
  assert.match(app, /for \(const controller of decryptedAttachmentControllers\) controller\.abort\(\)/);
  assert.match(app, /generation === decryptedAttachmentGeneration && !controller\.signal\.aborted/);
  assert.match(app, /host\.isConnected && activeConversationId === conversationId/);
  assert.match(app, /if \(slot !== "inbox"\) \{[\s\S]*?revokeDecryptedAttachmentUrls\(\)/);
  assert.match(app, /async function switchPersona[\s\S]*?revokeDecryptedAttachmentUrls\(\)/);
  assert.match(app, /envelope\.client_nonce === message\.client_nonce/);
  assert.match(app, /mediaMatch\[1\] !== message\.media_hash/);
});

test("GDPR lifecycle UI is stale-safe, replay-safe and confines export downloads", () => {
  const lifecycle = app.slice(app.indexOf("const lifecycleStatus"), app.indexOf('  document.getElementById("sign-out")'));
  assert.match(lifecycle, /const lifecycleLoadGate = createLatestRequestGate\(\)/);
  assert.match(lifecycle, /const request = lifecycleLoadGate\.begin\(\)/);
  assert.match(lifecycle, /!request\.isCurrent\(\) \|\| !lifecycleStatus\?\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(lifecycle, /Number\.isSafeInteger\(Number\(status\.request\.execute_after\)\)/);
  assert.match(lifecycle, /!exports\?\.ok \|\| Number\(exports\.owner_id\) !== Number\(state\.user\.id\) \|\| !Array\.isArray\(exports\.exports\)/);
  assert.match(lifecycle, /accountExportPathPattern = \/\^\\\/api\\\/account\\\/exports\\\/\[0-9a-f\]\{8\}/);
  assert.match(lifecycle, /Number\(result\.owner_id\) !== Number\(state\.user\.id\)/);
  assert.match(lifecycle, /result\.secrets_excluded !== true/);
  assert.match(lifecycle, /slice\(0, 20\)/);
  assert.match(lifecycle, /requestExport\.dataset\.mutationKey = newUploadMutationKey\("account-export"\)/);
  assert.match(lifecycle, /requestDeletion\.dataset\.mutationKey = newUploadMutationKey\("account-deletion-request"\)/);
  assert.match(lifecycle, /cancelDeletion\.dataset\.mutationKey = newUploadMutationKey\("account-deletion-cancel"\)/);
  assert.match(lifecycle, /headers: \{ "Idempotency-Key": button\.dataset\.mutationKey \}/);
  assert.match(lifecycle, /headers: \{ "Idempotency-Key": cancelDeletion\.dataset\.mutationKey \}/);
  assert.match(lifecycle, /!button\.isConnected \|\| state\.persona !== selectedPersona/);
  assert.match(lifecycle, /location\.assign\(downloadUrl\)/);
  assert.doesNotMatch(lifecycle, /result\.error|status\.error|exports\.error/);
  for (const key of ["scheduled", "graceEnds", "legalHold", "active", "statusUnavailable", "exportsUnavailable", "exportReady", "exportFailed", "completeConfirmations", "scheduleConfirm", "scheduleFailed", "cancelFailed", "cancelled"]) {
    assert.match(lifecycle, new RegExp(`t\\("lifecycle\\.${key}"\\)`));
  }
  const shell = profilePanels.slice(profilePanels.indexOf('<details class="accountLifecycle"'), profilePanels.indexOf('<details class="account-card chain-activity"'));
  for (const key of ["summary", "control", "intro", "checking", "confirmPassword", "xportalStepUp", "downloadMine", "sensitive", "graceDeletion", "graceDetail", "onchainAck", "onchainPermanent", "schedule", "cancel"]) {
    assert.match(shell, new RegExp(`t\\("lifecycle\\.${key}"\\)`));
  }
  for (const locale of ["ro", "en", "pl", "ar"]) assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"lifecycle\\.cancelled"`));
});

test("account access and E2EE security shell uses the complete locale contract", () => {
  // The access journey is markup in the panels module now, while the provider rows are resolved by the
  // screen (they read the account response), so the locale contract is checked across both sources.
  const shell = app.slice(app.indexOf("const providerRows"), app.indexOf("const setProfileSettingsView"))
    + profilePanels.slice(profilePanels.indexOf('data-profile-panel="access"'), profilePanels.indexOf('data-profile-panel="settings"'));
  for (const key of [
    "verified", "unverified", "connected", "disconnected", "optional", "eyebrow",
    "accountStatus", "linkXportal", "changeXportal", "summary", "walletTruth",
    "sessionsTitle", "sessionsHint", "refresh", "e2eeTitle", "e2eeHint",
    "revokePermanent", "recoveryTitle", "recoveryIntro", "passphraseLabel",
    "passphraseHint", "prepareDownload", "savedActivate", "choosePackage",
    "restoreBrowser", "restoreEmptyOnly", "confirmRevocations", "xportalRevocations",
    "logoutThis", "logoutAll", "chainActivity", "loading",
  ]) assert.match(shell, new RegExp(`t\\("security\\.${key}"\\)`));
  assert.match(shell, /t\("sessions\.loading"\)/);
  assert.match(shell, /t\("e2eeDevices\.loading"\)/);
  assert.doesNotMatch(shell, /ACCES & RECUPERARE|Securitate, sesiuni & recuperare|Recuperare E2EE opt-in|Activitate blockchain demo/);
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"security\\.logoutAll"`));
  }
});

test("device-wallet status and xPortal relink controls follow the account locale", () => {
  const accountAccess = app.slice(app.indexOf("const localWallet"), app.indexOf("const profileForm"));
  for (const key of ["deviceWalletAvailable", "deviceWalletMissing", "linkPassword", "continueLink", "linkPreparing", "linkQr"]) {
    assert.match(accountAccess, new RegExp(`t\\("security\\.${key}"\\)`));
  }
  assert.match(accountAccess, /t\("auth\.preparingXportal"\)/);
  assert.match(accountAccess, /t\("auth\.xportalQr"\)/);
  assert.doesNotMatch(accountAccess, /Cheia walletului automat|Confirmă parola Nexus|Continuă asocierea|Cod QR pentru asocierea xPortal/);
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"security\\.linkQr"`));
  }
});

test("E2EE recovery actions are localized and logout-all never renders a raw error", () => {
  const actions = app.slice(app.indexOf("const recoveryPassphrase"), app.indexOf("const lifecycleStatus"));
  for (const key of [
    "pendingRecovered", "packageSelected", "enterAndConfirm", "packageRejected",
    "passphraseInvalid", "confirmCreate", "creating", "downloadRequested",
    "refreshSafe", "refreshUnsafe", "packageReady", "createFailed",
    "packageCreateFailed", "prepareAgain", "confirmActivate", "activating",
    "active", "alreadyActive", "activated", "activationRefused", "notActivated",
    "chooseFirst", "enterFullPassphrase", "confirmRestore", "verifying", "restored",
    "restoredToast", "restoreRefused", "invalidPackage",
  ]) assert.match(actions, new RegExp(`(?:t\\(|t\\(activated\\.replay \\? )[^\\n]*"recovery\\.${key}"`));
  for (const key of ["logoutAllConfirm", "logoutAllFailed"]) {
    assert.match(actions, new RegExp(`t\\("security\\.${key}"\\)`));
  }
  assert.doesNotMatch(actions, /toast\(result\.error/);
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"recovery\\.invalidPackage"`));
  }
});

test("Social Search is stale-safe, privacy-bound, shape-bounded, and uses internal media", () => {
  const search = app.slice(app.indexOf("function renderSocialSearch"), app.indexOf("function renderPulse"));
  assert.match(app, /const socialSearchLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /function isSafeSocialSearchPage/);
  assert.match(app, /new Set\(result\.profiles\.map/);
  assert.match(app, /data-search-more/);
  assert.match(app, /seenProfileIds/);
  assert.match(app, /seenPostIds/);
  assert.match(app, /socialSearchLoadGate\.invalidate\(\)/);
  assert.match(api, /search cursor invalid/);
  assert.match(api, /viewer_id: auth\.user\.id/);
  assert.match(api, /next_cursor: nextCursor/);
  assert.match(search, /const request = socialSearchLoadGate\.begin\(\)/);
  assert.match(search, /!request\.isCurrent\(\) \|\| !host\?\.isConnected \|\| Number\(state\.user\.id\) !== viewerId \|\| state\.persona !== selectedPersona \|\| selectedPersona !== "social"/);
  assert.match(app, /result\.query === query && result\.cursor === String\(cursor\)/);
  assert.match(app, /result\.scope === "SOCIAL_LOCAL_INDEX_V1"/);
  assert.match(app, /result\.privacy_enforced_server_side === true/);
  assert.match(app, /result\.synthetic_traffic_eligible === false/);
  assert.match(app, /result\.profiles\.length <= 20/);
  assert.match(app, /result\.posts\.length <= 20/);
  assert.match(app, /result\.profiles\.every\(isSafeSocialSearchProfile\)/);
  assert.match(app, /result\.posts\.every\(isSafeSocialSearchPost\)/);
  assert.match(search, /openCreatorProfile\(button\.dataset\.searchProfile\)/);
  assert.match(search, /wirePostActions\(host\.querySelector\("\.socialSearchPosts"\), posts\)/);
  assert.doesNotMatch(search, /result\?\.error|result\.error|\/api\/profiles\//);
  assert.match(app, /function isSafeSearchMedia[\s\S]*safeInternalMediaUrl/);
  assert.match(app, /function isSafeSocialSearchProfile[\s\S]*profile\.visibility === "public"/);
  assert.match(app, /function isSafeSocialSearchPost[\s\S]*post\.persona === "social" && post\.status === "active"/);
  assert.match(app, /function wirePostActions\(root, postCollection = currentFeedPosts\)/);
  assert.match(app, /function openFeedMediaViewer\(postId, postCollection = currentFeedPosts, viewerOptions = \{\}\)/);
  for (const key of ["eyebrow", "title", "label", "placeholder", "submit", "privacyTruth", "startTitle", "startDetail", "tooShort", "loading", "unavailable", "unavailableDetail", "noResults", "noResultsDetail", "people", "content", "followers", "more"]) {
    assert.match(search, new RegExp(`t\\("search\\.${key}"\\)`));
  }
  for (const locale of ["ro", "en", "pl", "ar"]) {
    assert.match(interfaceLocale, new RegExp(`${locale}: \\{[\\s\\S]*?"search\\.followers"`));
  }
});

test("unified message badge is user-bound, stale-safe, privacy-bound and numerically bounded", () => {
  const badge = app.slice(app.indexOf("async function refreshMessageBadge"), app.indexOf("// ---------- view router"));
  assert.match(app, /const messageBadgeLoadGate = createLatestRequestGate\(\)/);
  assert.match(app, /function renderLanding\(providers\) \{[\s\S]*messageBadgeLoadGate\.invalidate\(\);[\s\S]*unreadMessageCount = 0/);
  assert.match(badge, /const selectedUserId = Number\(state\?\.user\?\.id\)/);
  assert.match(badge, /const request = messageBadgeLoadGate\.begin\(\)/);
  assert.match(badge, /!request\.isCurrent\(\) \|\| Number\(state\?\.user\?\.id\) !== selectedUserId/);
  assert.match(badge, /response\.privacy_enforced_server_side === true/);
  assert.match(badge, /response\.query\?\.persona === "all" && response\.query\?\.box === "inbox"/);
  assert.match(badge, /conversations\.length <= 100/);
  assert.match(badge, /new Set\(conversations\.map/);
  assert.match(badge, /Number\(conversation\.unread\) <= 10_000/);
  assert.match(badge, /Math\.min\(9999, conversations\.reduce/);
  assert.match(api, /query: \{ persona: requested, box, limit, cursor: cursorToken \|\| null, \.\.\./);
  assert.match(api, /privacy_enforced_server_side: true/);
});

test("owner post controls expose replay-safe edit archive withdraw and immutable history", () => {
  assert.match(app, /function openPostLifecycleSheet/);
  assert.match(app, /Number\(post\.user_id\) !== ownerId \|\| post\.persona !== ownerPersona/);
  assert.match(app, /newUploadMutationKey\("post-edit"\)/);
  assert.match(app, /newUploadMutationKey\("post-archive"\)/);
  assert.match(app, /newUploadMutationKey\("post-withdraw"\)/);
  assert.match(app, /result\.immutable_history === true/);
  assert.match(app, /result\.history_preserved === true/);
  assert.match(api, /action: "post_edited"/);
  assert.match(api, /action: "post_archived"/);
  assert.match(api, /action: "post_withdrawn"/);
  for (const key of ["post.manage", "post.history", "post.withdrawConfirm"])
    assert.equal((interfaceLocale.match(new RegExp(`"${key.replaceAll(".", "\\.")}"`, "g")) || []).length, 4, key);
});

test("release readiness is local, fail-closed and documents every external gate", () => {
  assert.equal(packageManifest.scripts["release:check"], "node scripts/release-check.mjs");
  assert.match(releaseCheck, /runActors\(\{ count: 1_000/);
  assert.match(releaseCheck, /productionSmoke/);
  assert.match(releaseCheck, /insecure_api_denied/);
  assert.match(releaseCheck, /external_network: false/);
  assert.match(environment, /NEXUS_TRUST_PROXY/);
  assert.match(environment, /NEXUS_DATA_DIR/);
  assert.match(api, /if \(process\.env\.NODE_ENV === "production"\) return json\(res, 200, publicHealth\)/);
  assert.match(envExample, /NEXUS_SESSION_SECRET=\r?\n/);
  assert.doesNotMatch(envExample, /NEXUS_SESSION_SECRET=change-me/);
  assert.match(readme, /Gates externe încă necesare/);
  assert.match(readme, /nu eticheta build-ul local drept lansare publică/);
});
