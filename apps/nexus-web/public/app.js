import { api, toast } from "./client.js?v=20260831-p1e2eeattach2";
import { creatorStudioMarkup } from './creator-studio-markup.js?v=20261001-publish1';
import { syncCreatorDraft, hydrateRemoteDraft, bindDraftBackup, serializeDraftWrite, validDraft, draftMediaBytes } from './creator-draft-sync.js?v=20261002-layout1';
import { openCameraPresetStream } from './reel-camera-quality.js?v=20261003-lens2';
import { openCameraExitDialog } from './creator-camera-exit.js?v=20261002-layout1';
import { bindPublishingDetails, readPublishing } from './post-publishing.js?v=20261002-stability1';
import { readTransform, transformCss, applyTransform, bindTransformEditor, creatorFilterCss } from './creator-transform.js?v=20261001-publish1';
import { downloadPublishedPost } from './creator-export.js?v=20261001-publish1';
import { publishingCaption, applyPublishedEdits, wireImageSound } from './published-presentation.js?v=20261001-publish1';
import { digestHexOf } from "./sha256.js?v=20260923-wave14i";
import { bindComposerPicker, setInputFile } from "./composer-picker.js?v=20260912-camera3";
import { bindComposerExit } from "./composer-exit.js?v=20260912-camera3";
import { inboxShell, bindInboxPresentation, enhanceThread, setThreadHeader, renderConversationRow, personaBadge } from "./messenger-shell.js?v=20260923-wave14i";
import { messageDayLabel } from './message-presentation.js?v=20260914-lab1';
import { readConversationPreferences } from './conversation-preferences.js?v=20260914-menu1';
import { renderSoundToggle } from './social-sound.js?v=20260925-sound2';
import { bindMessageSearch } from "./messenger-search.js?v=20260914-lab1";
import { bindContactAvatars, openContactCard, createContactOptions } from "./messenger-contact.js?v=20260914-lab1";
import { createThreadNavigation, messageWindowQuery, messageScrollPosition, mountWindowReturn } from "./thread-navigation.js?v=20260914-lab1";
import { attachProfileNavigation, bindCreatorDestinations, profileMediaPosts, syncAuthorFollow } from "./profile-navigation.js?v=20260924-profile2";
const threadNavigation = createThreadNavigation();
import { loadContactStories } from "./contact-stories.js?v=20260913-spaces1";
import { createCameraRecorder, cameraRecordingProfile, startBoundedRecording, cameraRecovery, framedCameraTake } from "./bounded-recording.js?v=20261003-lens2";
import { ensureChatDevice, encryptChatAttachment, encryptChatText, decryptChatAttachment, decryptChatMessage, observeConversationSafety, verifyConversationSafety, validateConversationKeyMaterial, activateProvisionedRecoveryDevice, clearPendingRecoveryActivation, computeRecoveryAccountBinding, persistPendingRecoveryActivation, provisionRecoveryDevice, readPendingRecoveryActivation, restoreRecoveryDevice } from "./chat-crypto.js?v=20260906-p2decrypt1";
import {
  configureCallClient, callCapability, startDirectCall, handleCallInvite,
  handleCallState, handleCallSignal, restoreCurrentCalls, endCurrentCall,
} from "./call-client.js?v=20260906-p2decrypt1";
import { initializeModalAccessibility as initializeSharedModalAccessibility } from "./modal-accessibility.js";
import { applyInterfaceLocale, createInterfaceTranslator, resolveInterfaceLocale } from "./interface-locale.js?v=20260928-name1";
import {
  FEED_MODE_CONTRACT, nextFeedMode, feedModeSwitchMarkup,
  feedHeaderActionsMarkup, feedDrawerEndMarkup, bindFeedModeRail, clipCreatorAvatarMarkup,
  feedSkeletonMarkup, feedEmptyMarkup, feedErrorMarkup, feedMoreMarkup, feedStoryRailMarkup,
  whisperCardMarkup, bindFeedAudio, bindStoryImages, feedSourceSectionMarkup, bindFeedSourceSection,
  demoHumanExperienceStories,
} from "./feed-surface.js?v=20260926-source2";
import { createFeedHub } from "./feed-hub.js?v=20260923-wave14i";
import { NAV_LABEL_KEYS, navFaceMarkup, navIconMarkup } from "./nav-marks.js?v=20260923-wave14i";
import { reelsViewerHeaderMarkup, solidViewerIcon } from "./reels-reference.js?v=20260928-name1";
import { expandableCaptionMarkup, bindExpandableCaptions } from "./reel-caption.js?v=20260923-wave14i";
import { bindDoubleTapHeart, showDoubleTapHeart } from "./double-tap-heart.js?v=20260928-name1";
import { bindCaptionTranslations, captionTranslationButtonMarkup } from "./caption-translation.js?v=20260925-dynamic1";
import { createLatestRequestGate, createSingleFlightGate } from "./latest-request.js?v=20260904-p1locale3";
import { planDraftEvictions, localDraftId } from "./draft-policy.js?v=20260912-camera3";
import { decideSocialGesture, decideViewerGesture } from "./social-gesture.js?v=20260910-humanux7";
import { renderWorkWorkspace } from "./work-module.js?v=20260908-m5local1";
import { renderMarketWorkspace, renderRideWorkspace, renderStayWorkspace } from "./fair-verticals.js?v=20260908-m8local1";
import { renderDatingWorkspace, renderPriveGate } from "./dating-module.js?v=20260908-m9local1";
import { renderWatchWorkspace } from "./watch-module.js?v=20260910-m10local1";
import { renderGrowWorkspace, renderMusicWorkspace } from "./music-grow-module.js?v=20260910-m11local1";
import { renderM12CreatorWorkspace, renderM12NodeWorkspace, renderM12PayWorkspace } from "./m12-module.js?v=20260910-m12local1";
import { createPostDetailSurface } from "./post-detail.js?v=20260928-name1";
import { clipSubtitlesMarkup } from "./clip-options.js?v=20261003-lens2";
import { mountReelAutoSound, synchronizeReelSound } from "./reel-auto-sound.js?v=20261001-publish1";
import { applyCameraPreset, cameraSurfaceIsPortrait, markCameraRequest, openCameraLensChooser, openReelSoundCatalogue, reelCameraMarkup, showCameraPresetStatus, showCameraSensorNote, startCameraBackdrop, stopCameraBackdrop, syncCameraFraming } from "./reel-camera-surface.js?v=20261003-lens2";
import { bindCameraReview, reelCameraReviewMarkup, setCameraComposerState, startRecordingDial } from "./reel-camera-review.js?v=20261002-stability1";
import { canvasBlob } from "./reel-layout.js?v=20261001-publish1";
import { createReelLayoutController } from "./reel-layout-controller.js?v=20261003-lens2";
import { bindStudioDecorationTimeline, readStudioDecorations, renderStudioDecorations, studioDecorationsMarkup } from "./reel-editor-overlays.js?v=20261001-publish1";
import { bindOnboarding, onboardingDefaults, onboardingMarkup, onboardingRequired, visibilityLabelKey } from "./onboarding.js?v=20261003-lens2";
import { bindLocationPicker, closeLocationPicker } from "./profile-location.js?v=20261003-lens2";
import { createProfileHeroEditor } from "./profile-hero-edit.js?v=20261003-lens2";
import { profileBioMarkup } from "./profile-bio-text.js?v=20261003-lens2";
import { bindProfilePullRefresh, profileRelativeTime, renderOwnerProfileExperience } from "./profile-experience.js?v=20260923-wave14i";
import { renderCreatorProfile } from "./creator-profile.js?v=20260924-profile2";
import { bindProfileMenu, markProfileMenuActive, profileMenuMarkup, profileMenuView } from "./profile-menu.js?v=20260923-wave14i";
import { profileSettingsPanelsMarkup } from "./profile-settings-panels.js?v=20260923-wave14i";
import { applyTickerSpeed, nextTickerSpeed, readTickerSpeed, tickerSpeedLabelKey, writeTickerSpeed } from "./profile-ticker.js?v=20260923-wave14i";
// The Breaking lens renders an allow-listed aggregator (P9); the rows are built by its own module so
// that the escaping rules for somebody else's headline live in one place.
import { breakingNewsMarkup } from "./breaking-news.js?v=20260923-wave14i";
// One renderer for "why am I seeing this", shared by the feed card, the post page and the profile.
import { rankingReasonListMarkup, rankingReasonMarkup } from "./ranking-reasons.js?v=20260923-wave14i";
import { NOTIFICATION_TYPES, bindNotificationPreferenceForms, notificationLabel as notificationLabelFromModule, notificationPreferenceForms } from "./notification-preferences.js?v=20260923-wave14i";

// The hero editor is built once and reused: it takes the current state and the current translator at
// the moment it needs them, because both change while the app runs.
// The one door of the feed bar is a small drawer of marks, mounted once by renderShell.
let feedHub = null;
const profileHeroEditor = createProfileHeroEditor({
  t: (key) => t(key),
  toast,
  api,
  newMutationKey: newUploadMutationKey,
  getState: () => state,
  bindLocationPicker,
  closeLocationPicker,
  // The upload, the media guard and the description linkifier belong to app.js; the hero editor only
  // decides when they are used.
  bioMarkup: (text) => profileBioMarkup(text, esc),
  uploadMedia: (file, purpose) => uploadMediaResumable(file, purpose),
  safeMediaUrl: safeInternalMediaUrl,
  // The edit page writes its two whole-word settings itself and says the lock in the language the
  // interface is in: the escaper, the visibility wording and the door into a settings panel come from
  // here, because that page owns no policy and no translator.
  esc,
  visibilityLabel: (visibility) => t(visibilityLabelKey(visibility)),
  openProfilePanel: (id) => profileSectionSwitcher?.(id),
  // The band prints facts the hero edits, so a save that changed one of them draws the profile again.
  reloadProfile: () => profileScreenRefresher?.(),
});

const app = document.getElementById("app");

const MODULES = [
  ["clips","▶","Pulse","SOCIAL","#20e0d0","Clips, posts, stories and live in one flow",["Near · For You · Global · Breaking","Camera, video, photo and text","Sounds, effects, duet and stitch","Free reactions + optional support"]],
  ["profiles","◎","Profiles","IDENTITY","#20e0d0","One account. Many independent versions of you.",["Social, Work, Dating, Travel, Market","Instant profile switch","Independent privacy and audiences","Incognito sessions"]],
  ["market","◇","Market","COMMERCE","#ffb94e","Buy and sell almost anything legal",["Local and worldwide listings","Photos, categories and offers","Verified reviews and seller trust","Stablecoin / EGLD escrow"]],
  ["chat","••","Messages","COMMUNICATION","#20e0d0","All conversations, calls and meetings in one place",["Private and group chat","Video calls and scheduled meetings","Disappearing media","Cross-profile consent"]],
  ["creator","↟","Creator","EARN","#20e0d0","Transparent creator earnings",["Tips and memberships","Creator reward pool","Transparent payout split","Organic and supporter rankings"]],
  ["prive","18","Privé 18+","ADULT WEB","#a653ff","Adult-only, consent-first creator space",["Age and identity gate","Free discovery and paid posts","Paid live and private calls","Geo, consent and leak controls"]],
  ["pay","$","Nexus Pay","PAYMENTS","#20e0d0","Pay a verified username instantly",["EUR / USD stablecoins","EGLD and ESDT support","Username resolution","Signed settlement receipt"]],
  ["dating","♥","Dating","CONNECTIONS","#ff4e83","Compatibility, discretion and safety before meeting",["Inclusive intentions and preferences","Descriptive Trust Passport","Expiring photos","Safety check-in"]],
  ["stream","◉","Watch","VIDEO","#ff5267","Long video, channels and live",["Video upload and channels","Live, premieres and VOD","Playlists and subscriptions","Moderated live chat"]],
  ["kids","★","Kids","FAMILY","#ffc44e","Curated, parent-controlled video",["Age-banded catalogue","No public messages","Screen-time limits","Parent dashboard"]],
  ["signal","#","Signal","PUBLIC CONVERSATION","#d8e6f2","Posts, threads and public conversations",["Posts, media and threads","Communities and audio rooms","Near and global topics","Verifiable pseudonyms"]],
  ["work","▣","Work","PROFESSIONAL","#36afff","Professional identity, network and jobs",["CV and portfolio","Jobs and networking","Skill credentials","Work filter in unified messages"]],
  ["stay","⌂","Stay","TRAVEL","#25d9aa","Verified stays and experiences",["Create property listings","Calendar and pricing","Booking escrow","Verified stay reviews"]],
  ["ride","↗","Ride","MOBILITY","#68e77b","Simple verified ride sharing",["Driver matching","Live trip status","Safety contact","Stablecoin settlement"]],
  ["beauty","✦","Beauty","BOOKING","#ee8cff","Book trusted professionals near you",["Business pages","Staff portfolios","Live availability","Deposit escrow"]],
  ["music","♫","Music","AUDIO","#43df80","Listen, create and attribute",["Tracks and playlists","Add audio to posts","Rights-aware upload","Support the artist"]],
  ["wellbeing","＋","Wellbeing","HEALTH & LEARNING","#72e9e2","Sport, nutrition and learning",["Single-session workouts","Nutrition journal","Courses and learning paths","Private progress"]],
  ["node","N","Node Network","DECENTRALIZED","#8ca2ff","From one community node to thousands",["Signed event log","State-root checkpoints","Backup and restore","Permissionless roadmap"]],
];
const GLOBAL_HUB_IDS = new Set(["market", "creator", "prive", "pay", "stream", "kids", "stay", "ride", "beauty", "music", "wellbeing", "node"]);

const PROFILES = [
  ["social","Social","Public vibe","SK","#9a61ff"],
  ["work","Work","Professional","WK","#2fb7ff"],
  ["dating","Dating","Find connections","♥","#ff4f7d"],
  ["travel","Travel","Explore the world","✈","#32d6d0"],
  ["market","Market","Buy & sell","◇","#ffb94e"],
];

const ORBIT_MOODS = [
  ["JOY", "✨", "Bucurie"], ["FOCUSED", "🎯", "Concentrat"], ["CALM", "🌊", "Calm"],
  ["LOVE", "💗", "Cu drag"], ["DREAMING", "☁", "Visător"], ["ENERGY", "⚡", "Energie"],
  ["CHILL", "🫧", "Relaxat"], ["CURIOUS", "🔭", "Curios"],
];
const SIGIL_LEVELS = [
  [1, 1_000, "Creator"], [2, 10_000, "Rising"], [3, 100_000, "Pro"],
  [4, 1_000_000, "Icon"], [5, 10_000_000, "Global"],
];
const CURIOSITY_ECONOMY = {
  minSettlementCents: 100,
  currency: "USD",
  privateSplit: { creator: 90, nexus: 10 },
  revealSplit: { revealedVisitor: 60, owner: 30, nexus: 10 },
  storyPrimarySplit: { creator: 90, nexus: 8, reserve: 2 },
  resaleRoyaltyBps: 600,
  policy: "NEXUS_CURIOSITY_MARKET_V1_LOCAL",
};

// Wave 14i: Home is back on the bar - wave 14h had read the wordmark as the only way home, and the owner
// asked for the mark back. `navigate("primary")` answers with `goHome`, so the two cannot disagree.
const NAV = {
  social: [["primary","⌂","Acasă"],["inbox","◌","Mesaje"],["search","⌕","Căutare"],["create","＋","Creează"],["friends","◍","Prieteni"],["utility","◉","Live"],["account","◎","Profil"]],
  work: [["primary","▤","Feed"],["inbox","◌","Messages"],["create","＋","Create"],["utility","▣","Jobs"],["account","◎","Profil"]],
  dating: [["primary","♥","Discover"],["inbox","◌","Messages"],["create","＋","Moment"],["utility","✦","Connections"],["account","◎","Profil"]],
  travel: [["primary","⌂","Explore"],["inbox","◌","Messages"],["create","＋","List"],["utility","✈","Trips"],["account","◎","Profil"]],
  market: [["primary","◇","Browse"],["inbox","◌","Messages"],["create","＋","Sell"],["utility","▦","Orders"],["account","◎","Profil"]],
};

const DEVNET_TX_URL = "https://devnet-explorer.multiversx.com/transactions/";
const SOCIAL_SOUND_KEY = "nexus-social-muted-v1";
let socialMutedMemory;
// G1 resets the old card-first preference once. The approved Social layout is immersive by default;
// a reader can still explicitly choose cards afterwards and that new choice remains local.
const SOCIAL_PRESENTATION_KEY = "nexus-social-presentation-v2";
const SOCIAL_MEDIA_FIT_KEY = "nexus-social-media-fit-v1";
const SOCIAL_SHARING_ENABLED = true;

let state = null;
let activeModule = "clips";
let activeSlot = "primary";
let socialLens = "for-you";
let socialFormat = "clips";
let socialTopView = "mix";
// Wave 14: which of the three ways to read the feed is open, and where each of them was left. A mode
// switch keeps the reader's place in every mode instead of throwing all three back to the top.
let feedMode = "reels";
// The lens Reels was left on: a mode switch must not quietly change what Reels shows.
let reelsLensFeed = "for-you";
const feedScrollMemory = new Map();
let socialPresentation = readSocialPresentation();
let socialMediaFit = readSocialMediaFit();
let suppressFeedClickUntil = 0;
let suppressNextUiPopstate = false;
let socialLiveTab = "now";
const socialLiveLoadGate = createLatestRequestGate();
let socialFriendView = "followers";
const socialFriendsLoadGate = createLatestRequestGate();
const followRequestMutationKeys = new Map();
let inboxFilter = "social", inboxContext = "";
let inboxBox = "inbox";
const messagesLoadGate = createLatestRequestGate();
const messageBadgeLoadGate = createLatestRequestGate();
const notificationBadgeLoadGate = createLatestRequestGate();
const activityLoadGate = createLatestRequestGate();
let profileSettingsView = "profile";
// The hero lives in its own module, so the panels are switched through one shared hook instead of a
// click on a tab bar that no longer exists.
let profileSectionSwitcher = null;
// The hero editor asks this to draw the profile again after a save that changed a fact the band prints.
let profileScreenRefresher = null;
let presenceHeartbeatTimer = null;
let composerExit = null;
let activeDraftBackup = null;
let activeCameraExit = null;
function requestActiveCameraExit() {
  const camera = document.getElementById('composerCamera');
  if (!activeCameraExit || !camera?.isConnected || camera.hidden) return false;
  activeCameraExit();
  return true;
}
const committedComposerDrafts = new WeakMap();
const remoteComposerDraftAttempts = new WeakSet();
window.addEventListener('beforeunload', (event) => {
  if (!(requestCameraUnloadWarning() || (activeDraftBackup ? activeDraftBackup.hasPending() : composerExit?.dirty()))) return;
  event.preventDefault();
  event.returnValue = '';
});
function requestCameraUnloadWarning() {
  const camera = document.getElementById('composerCamera');
  return Boolean(activeCameraExit && camera?.isConnected && !camera.hidden);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeDraftBackup?.hasPending()) activeDraftBackup.flush().catch(() => {});
});
let activeComposerPreviewUrl = null;
function clearComposerPreviewUrl() {
  if (!activeComposerPreviewUrl) return;
  try { URL.revokeObjectURL(activeComposerPreviewUrl); } catch { /* Object URL cleanup is best-effort. */ }
  activeComposerPreviewUrl = null;
}
function createComposerPreviewUrl(file) {
  clearComposerPreviewUrl();
  activeComposerPreviewUrl = URL.createObjectURL(file);
  return activeComposerPreviewUrl;
}
const profileLoadGate = createLatestRequestGate();
const publicProfileLoadGate = createLatestRequestGate();
const socialSearchLoadGate = createLatestRequestGate();
let activeConversationId = null;
const threadLoadGate = createLatestRequestGate();
const decryptedAttachmentUrls = new Set();
const decryptedAttachmentControllers = new Set();
let decryptedAttachmentGeneration = 0;
let typingStopTimer = null;
const typingLastSentAt = new Map();
const typingMutationKeys = new Map();
let chatDevicePromise = null;
let activeComposerStream = null;
let activeRecorder = null;
let activeFramedTake = null;
const discardedComposerRecorders = new WeakSet();
const composerCameraRequestGate = createLatestRequestGate();
let activeLiveStream = null;
let activeLiveAudioContext = null;
let activeLiveMeterFrame = null;
const liveDeviceRequestGate = createLatestRequestGate();
let unreadMessageCount = 0;
let unreadActivityCount = 0;
const seenNotificationChanges = new Set();
let currentFeedPosts = [];
let currentStories = [];
let storyViewerState = null;
let storyViewerSessionGeneration = 0;
let mediaViewerState = null;
let mediaViewerSessionGeneration = 0;
let nexusEventStream = null;
let nexusEventStreamGeneration = 0;
let interfaceLocale = "ro";
let t = createInterfaceTranslator(interfaceLocale);
const authSignupFlight = createSingleFlightGate();
const authLoginFlight = createSingleFlightGate();
const postReactionMutations = new Map();
// A comments drawer and the full-screen viewer may show the same post at the same time.
// Keep their pagination and latest-request gates isolated per surface so one view cannot
// cancel or contaminate the other.
const commentListLoadGates = new Map();
const commentPageStates = new Map();
const commentMutationStates = new Map();
const secondaryEngagementMutations = new Map();
const storyLoadGate = createLatestRequestGate();
const storyViewMutations = new Map();
const socialFeedLoadGate = createLatestRequestGate();
const socialFeedPageLoadGate = createLatestRequestGate();
const socialImpressionQueue = new Map();
// Replies are comments on the server, so their impressions travel in the same request but
// in their own queue: a thread that is read is measured like a timeline.
const socialCommentImpressionQueue = new Map();
let socialImpressionTimer = null;
let socialImpressionGeneration = 0;
const trustLoadGate = createLatestRequestGate();
let pendingEmailSignup = null;
let authProviderState = { google: false, facebook: false, mvxNetwork: "mainnet" };
let commentOverlayNavigation = null;

function readSocialPresentation() {
  try {
    const value = localStorage.getItem(SOCIAL_PRESENTATION_KEY);
    if (value === "immersive" || value === "cards") return value;
  } catch { /* a browser that refuses storage still gets a feed */ }
  return "immersive";
}

function setSocialPresentation(value) {
  socialPresentation = value === "cards" ? "cards" : "immersive";
  try { localStorage.setItem(SOCIAL_PRESENTATION_KEY, socialPresentation); } catch { /* non-critical preference */ }
}

function readSocialMediaFit() {
  try {
    return localStorage.getItem(SOCIAL_MEDIA_FIT_KEY) === "fit" ? "fit" : "fill";
  } catch { return "fill"; }
}

function setSocialMediaFit(value) {
  socialMediaFit = value === "fit" ? "fit" : "fill";
  try { localStorage.setItem(SOCIAL_MEDIA_FIT_KEY, socialMediaFit); } catch { /* non-critical preference */ }
}

function queueSocialImpression(postId, dwellMs = 0, completed = false) {
  const id = Number(postId);
  if (!state || state.persona !== "social" || !Number.isSafeInteger(id) || id < 1) return;
  const current = socialImpressionQueue.get(id) || { post_id: id, dwell_ms: 0, completed: false };
  current.dwell_ms = Math.max(current.dwell_ms, Math.max(0, Math.min(600000, Math.floor(Number(dwellMs) || 0))));
  current.completed = current.completed || completed === true;
  socialImpressionQueue.set(id, current);
  clearTimeout(socialImpressionTimer);
  socialImpressionTimer = setTimeout(flushSocialImpressions, 650);
}

function queueCommentImpressions(commentIds) {
  if (!state || state.persona !== "social") return;
  const ids = (Array.isArray(commentIds) ? commentIds : []).map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return;
  for (const id of ids.slice(0, 100)) {
    const current = socialCommentImpressionQueue.get(id) || { comment_id: id, dwell_ms: 0 };
    current.dwell_ms = Math.max(current.dwell_ms, 900);
    socialCommentImpressionQueue.set(id, current);
  }
  clearTimeout(socialImpressionTimer);
  socialImpressionTimer = setTimeout(flushSocialImpressions, 650);
}

async function flushSocialImpressions() {
  clearTimeout(socialImpressionTimer);
  socialImpressionTimer = null;
  if (!state || state.persona !== "social") return;
  if (!socialImpressionQueue.size && !socialCommentImpressionQueue.size) return;
  const entries = [...socialImpressionQueue.values()].slice(0, 50);
  entries.forEach((entry) => socialImpressionQueue.delete(entry.post_id));
  const commentEntries = [...socialCommentImpressionQueue.values()].slice(0, 100);
  commentEntries.forEach((entry) => socialCommentImpressionQueue.delete(entry.comment_id));
  const viewerId = Number(state.user.id);
  const viewerPersona = state.persona;
  const generation = socialImpressionGeneration;
  const key = newUploadMutationKey("social-impressions");
  let result = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    result = await api("/api/social/impressions", {
      method: "POST", headers: { "Idempotency-Key": key },
      body: { entries, comment_entries: commentEntries },
    }).catch(() => null);
    const exact = result?.ok === true && Number(result.viewer_id) === viewerId && result.viewer_persona === viewerPersona
      && Number(result.requested) === entries.length && Number.isSafeInteger(Number(result.recorded))
      && Number(result.recorded) >= 0 && Number(result.recorded) <= entries.length
      && Array.isArray(result.recorded_post_ids) && result.recorded_post_ids.length === Number(result.recorded)
      && new Set(result.recorded_post_ids.map(Number)).size === result.recorded_post_ids.length
      && result.recorded_post_ids.every((id) => entries.some((entry) => entry.post_id === Number(id)))
      && (!commentEntries.length || (result.comment_result
        && Number(result.comment_result.requested) === commentEntries.length
        && Number(result.comment_result.recorded) >= 0
        && Number(result.comment_result.recorded) <= commentEntries.length));
    if (exact || socialImpressionGeneration !== generation || Number(state?.user?.id) !== viewerId || state?.persona !== viewerPersona) break;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if ((socialImpressionQueue.size || socialCommentImpressionQueue.size) && socialImpressionGeneration === generation) {
    socialImpressionTimer = setTimeout(flushSocialImpressions, 650);
  }
}

function resetSocialImpressionSession() {
  socialImpressionGeneration += 1;
  clearTimeout(socialImpressionTimer);
  socialImpressionTimer = null;
  socialImpressionQueue.clear();
  socialCommentImpressionQueue.clear();
}

initializeSharedModalAccessibility();

function syncNetworkState({ announce = false } = {}) {
  const online = navigator.onLine !== false;
  const banner = document.getElementById("network-state");
  document.documentElement.classList.toggle("nexusOffline", !online);
  if (banner) {
    banner.hidden = online;
    banner.textContent = online ? "" : t("connectivity.offline");
  }
  if (!online) nexusEventStream?.close();
  if (online && announce) {
    toast(t("connectivity.restored"));
    if (state) {
      connectStream();
      refreshMessageBadge();
      refreshNotificationBadge();
    }
  }
}

window.addEventListener("offline", () => syncNetworkState());
window.addEventListener("online", () => syncNetworkState({ announce: true }));
syncNetworkState();

function readSocialMuted() {
  if (socialMutedMemory !== undefined) return socialMutedMemory;
  try {
    const stored = localStorage.getItem(SOCIAL_SOUND_KEY);
    return socialMutedMemory = stored !== "false";
  } catch {
    return socialMutedMemory = true;
  }
}

function writeSocialMuted(muted) {
  socialMutedMemory = Boolean(muted);
  try {
    localStorage.setItem(SOCIAL_SOUND_KEY, String(Boolean(muted)));
  } catch {
    // Playback still works when browser storage is unavailable.
  }
}

function applySocialMuted(root, muted) {
  root.querySelectorAll("video.media,.viewerStage>video").forEach((media) => { media.muted = muted || (media.dataset?.originalVolume!=null?Number(media.dataset.originalVolume)===0:Boolean(media.closest?.(".clipStage,.mediaViewer")?.querySelector?.(".jamendoSound audio"))); });
  root.querySelectorAll(".studioSound audio").forEach((media) => { media.muted = muted; });
  document.querySelectorAll("[data-clip-sound],[data-viewer-sound]").forEach((button) => {
    const stage = button.closest('.clipStage,.mediaViewer');
    renderSoundToggle(button, muted, t, Boolean(stage?.querySelector('video.media,.viewerStage>video,.studioSound audio')));
  });
}

window.addEventListener('storage', (event) => {
  try { if (event.storageArea && event.storageArea !== localStorage) return; } catch { return; }
  if (event.key !== SOCIAL_SOUND_KEY && event.key !== null) return;
  socialMutedMemory = event.newValue !== 'false';
  applySocialMuted(document, socialMutedMemory);
});

function currentChatDevice() {
  if (!chatDevicePromise) {
    chatDevicePromise = ensureChatDevice(api, state?.user?.id).catch((error) => {
      chatDevicePromise = null;
      throw error;
    });
  }
  return chatDevicePromise;
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value == null ? "" : value);
  return div.innerHTML;
}

function moduleById(id) {
  return MODULES.find((m) => m[0] === id) || MODULES[0];
}

function profileById(id) {
  return PROFILES.find((p) => p[0] === id) || PROFILES[0];
}

function safeInternalMediaUrl(value) {
  const candidate = String(value ?? "");
  return /^\/media\/[a-f0-9]{64}\.[a-z0-9]{2,8}$/.test(candidate) ? candidate : "";
}

function isSafeSearchMedia(media, allowedKinds = new Set(["image", "video"])) {
  if (media == null) return true;
  if (!media || typeof media !== "object" || !allowedKinds.has(media.kind)) return false;
  return Boolean(safeInternalMediaUrl("/media/" + String(media.hash || "") + "." + String(media.ext || "")));
}

function isSafeSocialSearchProfile(profile) {
  return Boolean(profile && typeof profile === "object"
    && Number.isSafeInteger(Number(profile.id)) && Number(profile.id) > 0
    && typeof profile.handle === "string" && /^[a-z0-9_]{2,30}$/.test(profile.handle)
    && typeof profile.name === "string" && profile.name.length >= 1 && profile.name.length <= 80
    && typeof profile.bio === "string" && profile.bio.length <= 300
    && profile.visibility === "public"
    && Number.isSafeInteger(Number(profile.followers)) && Number(profile.followers) >= 0
    && (!profile.avatar || Boolean(safeInternalMediaUrl(profile.avatar))));
}

function isSafeSocialSearchPost(post) {
  const reactions = post?.reactions;
  const counts = reactions?.counts;
  const allowedReactions = new Set(["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY", "FAKE_OPINION", "DISLIKE"]);
  const studio = post?.creator_studio;
  const studioValid = !studio || studio.integrity !== "VERIFIED" || (studio.manifest && typeof studio.manifest === "object" && /^[a-f0-9]{64}$/.test(String(studio.manifest_hash || "")));
  return Boolean(post && typeof post === "object"
    && Number.isSafeInteger(Number(post.id)) && Number(post.id) > 0
    && Number.isSafeInteger(Number(post.user_id)) && Number(post.user_id) > 0
    && post.persona === "social" && post.status === "active"
    && ["public", "followers", "friends", "private"].includes(post.visibility)
    && ["text", "image", "video"].includes(post.kind)
    && typeof post.caption === "string" && post.caption.length <= 5_000
    && post.author && typeof post.author === "object"
    && Number(post.author.id) === Number(post.user_id)
    && post.author.persona === "social"
    && typeof post.author.handle === "string" && /^[a-z0-9_]{2,30}$/.test(post.author.handle)
    && typeof post.author.display_name === "string" && post.author.display_name.length >= 1 && post.author.display_name.length <= 80
    && (!post.author.avatar || Boolean(safeInternalMediaUrl(post.author.avatar)))
    && isSafeSearchMedia(post.media)
    && isSafeSearchMedia(post.audio, new Set(["audio"]))
    && reactions && typeof reactions === "object" && counts && typeof counts === "object"
    && Object.entries(counts).every(([kind, count]) => allowedReactions.has(kind) && Number.isSafeInteger(Number(count)) && Number(count) >= 0)
    && (reactions.viewer_reaction == null || allowedReactions.has(reactions.viewer_reaction))
    && Number.isSafeInteger(Number(post.comment_count)) && Number(post.comment_count) >= 0
    && studioValid);
}

function isSafeSocialSearchPage(result, { query, cursor, viewerId, viewerPersona }) {
  const nextCursorValid = result?.next_cursor == null
    || (/^\d{1,3}$/.test(String(result.next_cursor)) && Number(result.next_cursor) > Number(cursor) && Number(result.next_cursor) <= 200);
  return Boolean(result?.ok && Number(result.viewer_id) === Number(viewerId) && result.viewer_persona === viewerPersona
    && result.query === query && result.cursor === String(cursor) && nextCursorValid
    && result.scope === "SOCIAL_LOCAL_INDEX_V1"
    && result.privacy_enforced_server_side === true
    && result.synthetic_traffic_eligible === false
    && Array.isArray(result.profiles) && result.profiles.length <= 20
    && new Set(result.profiles.map((profile) => Number(profile?.id))).size === result.profiles.length
    && Array.isArray(result.posts) && result.posts.length <= 20
    && new Set(result.posts.map((post) => Number(post?.id))).size === result.posts.length
    && result.profiles.every(isSafeSocialSearchProfile)
    && result.posts.every(isSafeSocialSearchPost));
}

function isSafeSocialFeedPage(result, { lens, format, cursor, viewerId, viewerPersona }) {
  const nextCursorValid = result?.next_cursor == null || (typeof result.next_cursor === "string"
    && result.next_cursor.length >= 40 && result.next_cursor.length <= 4096 && result.next_cursor.includes("."));
  return Boolean(result?.ok && Number(result.viewer_id) === Number(viewerId) && result.viewer_persona === viewerPersona
    && result.lens === lens && result.format === format && (result.cursor ?? null) === (cursor ?? null)
    && nextCursorValid && Array.isArray(result.posts) && result.posts.length <= 30
    && new Set(result.posts.map((post) => Number(post?.id))).size === result.posts.length
    && result.posts.every(isSafeSocialSearchPost));
}

function revokeDecryptedAttachmentUrls() {
  decryptedAttachmentGeneration += 1;
  for (const controller of decryptedAttachmentControllers) controller.abort();
  decryptedAttachmentControllers.clear();
  for (const url of decryptedAttachmentUrls) URL.revokeObjectURL(url);
  decryptedAttachmentUrls.clear();
  document.querySelectorAll('[data-e2ee-attachment][data-decrypted="true"]').forEach((host) => {
    delete host.dataset.decrypted;
    host.innerHTML = '<button type="button" data-e2ee-open>' + esc(t("thread.decryptAttachment")) + '</button><small>' + esc(t("thread.encryptedAttachmentWarning")) + '</small>';
  });
}
window.addEventListener("pagehide", revokeDecryptedAttachmentUrls);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") revokeDecryptedAttachmentUrls();
});

function sigilCacheKey(persona) {
  return "nexus-sigil:" + String(state?.user?.id || state?.user?.handle || "local") + ":" + String(persona || "social");
}

function readSigilCache(persona) {
  try {
    const cached = JSON.parse(localStorage.getItem(sigilCacheKey(persona)) || "null");
    if (!cached) return {};
    const orbitActive = Number(cached.orbit_expires_at || 0) > Date.now();
    return {
      orbit_mood: orbitActive ? cached.orbit_mood || null : null,
      orbit_place: orbitActive ? cached.orbit_place || null : null,
      orbit_now: orbitActive ? cached.orbit_now || null : null,
      orbit_fandom: orbitActive ? cached.orbit_fandom || null : null,
      orbit_quote: orbitActive ? cached.orbit_quote || null : null,
      orbit_expires_at: orbitActive ? Number(cached.orbit_expires_at) : null,
    };
  } catch { return {}; }
}

function writeOrbitCache(persona, orbit = {}) {
  try { localStorage.setItem(sigilCacheKey(persona), JSON.stringify({
    orbit_mood: orbit.mood || orbit.orbit_mood || null,
    orbit_place: orbit.place || orbit.orbit_place || null,
    orbit_now: orbit.now || orbit.orbit_now || null,
    orbit_fandom: orbit.fandom || orbit.orbit_fandom || null,
    orbit_quote: orbit.quote || orbit.orbit_quote || null,
    orbit_expires_at: Number(orbit.expiresAt || orbit.orbit_expires_at || 0) || null,
  })); } catch { /* temporary expression cache is optional */ }
}

function activePersonaRecord() {
  const profile = state?.profiles?.find((item) => item?.persona === state.persona) || {};
  return { ...profile, ...readSigilCache(state?.persona) };
}

function syncInterfaceLocale() {
  const configured = activePersonaRecord().interface_locale || "auto";
  const deviceLocales = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  interfaceLocale = resolveInterfaceLocale({ accountLocale: configured, deviceLocales });
  t = createInterfaceTranslator(interfaceLocale);
  applyInterfaceLocale(document, interfaceLocale);
  syncNetworkState();
}

function earnedSigilFor(person, persona = state?.persona) {
  const ownProgress = state?.sigils?.[persona];
  const progress = person?.earned_sigil || (person?.id === state?.user?.id || !person ? ownProgress : null) || {};
  return {
    family: progress.family === "business" ? "business" : "creator",
    icon: progress.family === "business" ? "$" : "★",
    level: Number(progress.level || 0),
    earned: Boolean(progress.earned && Number(progress.level) > 0),
    tierName: progress.tier_name || "Locked",
    qualifiedFollowers: Number(progress.qualified_followers || 0),
    totalFollowers: Number(progress.total_followers || 0),
    nextThreshold: progress.next_threshold == null ? 1_000 : Number(progress.next_threshold),
    progressBps: Number(progress.progress_bps || 0),
    eligibility: progress.eligibility || "ELIGIBLE",
  };
}

function usernameSigil(person, persona = state?.persona) {
  const sigil = earnedSigilFor(person, persona);
  if (!sigil.earned) return "";
  const color = profileById(persona)[4];
  return '<span class="usernameSigil earned level' + sigil.level + '" title="Nexus Sigil · ' + esc((sigil.family === "business" ? "Business" : "Creator") + ' ' + sigil.tierName + ' · ' + sigil.qualifiedFollowers.toLocaleString() + ' followers eligibili') + '" style="--sigil-color:' + color + '">' + sigil.icon + '</span>';
}

function activeOrbitStatus(person) {
  if (!person || Number(person.orbit_expires_at || 0) <= Date.now()) return { active: false, summary: "" };
  const moodOption = ORBIT_MOODS.find((item) => item[0] === person.orbit_mood);
  const mood = moodOption ? moodOption[1] + " " + moodOption[2] : "";
  const quote = person.orbit_quote ? "„" + person.orbit_quote + "”" : "";
  const parts = [mood, person.orbit_place, person.orbit_fandom, person.orbit_now, quote].filter(Boolean);
  return { active: parts.length > 0, summary: parts.join(" · "), expiresAt: Number(person.orbit_expires_at) };
}

function orbitStatusChip(person, persona = state?.persona) {
  const own = person?.id === state?.user?.id ? readSigilCache(persona) : {};
  const orbit = activeOrbitStatus({ ...person, ...own });
  return orbit.active ? '<span class="orbitStatusChip" title="Status temporar · expiră automat">◌ ' + esc(orbit.summary) + '</span>' : '';
}

function startPresenceHeartbeat() {
  clearInterval(presenceHeartbeatTimer);
  const heartbeat = async () => {
    if (!state || document.visibilityState !== "visible" || navigator.onLine === false) return;
    const ownerId = Number(state.user.id), persona = state.persona;
    const result = await api("/api/presence", { method: "POST", body: {} }).catch(() => null);
    if (result?.ok && (Number(result.owner_id) !== ownerId || result.owner_persona !== persona)) clearInterval(presenceHeartbeatTimer);
  };
  heartbeat();
  presenceHeartbeatTimer = setInterval(heartbeat, 60_000);
}

async function init() {
  syncInterfaceLocale();
  const me = await api("/api/me");
  if (!me.ok) {
    const providers = await api("/api/providers");
    renderLanding(providers);
    return;
  }
  state = me;
  syncInterfaceLocale();
  configureCallClient({ api, toast, getUserId: () => state?.user?.id, getPersona: () => state?.persona });
  renderShell();
  renderView();
  maybeStartOnboarding();
  connectStream();
  startPresenceHeartbeat();
  refreshMessageBadge();
  refreshNotificationBadge();
  restoreCurrentCalls().catch(() => {});
}


// ---------- landing ----------
function renderLanding(providers) {
  messageBadgeLoadGate.invalidate();
  notificationBadgeLoadGate.invalidate();
  unreadMessageCount = 0;
  unreadActivityCount = 0;
  seenNotificationChanges.clear();
  pendingEmailSignup = null;
  if (providers?.providers && typeof providers.providers === "object") {
    authProviderState = {
      google: providers.providers.google === true,
      facebook: providers.providers.facebook === true,
      mvxNetwork: providers.providers.mvxNetwork === "devnet" ? "devnet" : "mainnet",
    };
  }
  const p = authProviderState;
  const googleReady = p.google === true;
  const facebookReady = p.facebook === true;
  const mvxNetwork = p.mvxNetwork === "devnet" ? "devnet" : "mainnet";
  app.innerHTML = [
    '<div class="landing"><div class="landing-card">',
    '<div class="brand">NE<span>X</span>US</div>',
    '<p class="tagline">' + esc(t("auth.tagline")) + '</p>',

    // Box 1 — Autentificare (Google, Facebook, xPortal, Email).
    '<section class="auth-box" aria-labelledby="login-title"><h2 class="auth-box-title" id="login-title">' + esc(t("auth.signIn")) + '</h2>',
    '<button class="btn social-btn" id="btn-google"' + (googleReady ? '' : ' disabled aria-disabled="true" title="' + esc(t("auth.providerUnavailable")) + '"') + '><span class="btn-logo">G</span><span>' + esc(t("auth.continueGoogle")) + '</span>' + (googleReady ? '' : '<small>' + esc(t("auth.unconfigured")) + '</small>') + '</button>',
    '<button class="btn fb-btn" id="btn-facebook"' + (facebookReady ? '' : ' disabled aria-disabled="true" title="' + esc(t("auth.providerUnavailable")) + '"') + '><span class="btn-logo">f</span><span>' + esc(t("auth.continueFacebook")) + '</span>' + (facebookReady ? '' : '<small>' + esc(t("auth.unconfigured")) + '</small>') + '</button>',
    '<button class="btn wallet-btn" id="btn-xportal" aria-describedby="xportal-note"><span class="btn-logo">◇</span><span>' + esc(t("auth.connectXportal")) + '</span><small>' + mvxNetwork + '</small></button>',
    '<p class="provider-note" id="xportal-note">' + esc(t("auth.firstConnect")) + '</p>',
    '<div class="sep subtle">' + esc(t("auth.orEmail")) + '</div>',
    '<form id="email-login-form" class="auth-form" autocomplete="off" data-login-key="' + esc(newUploadMutationKey("email-login")) + '">',
    '<div class="field"><label for="nexus-login-email">' + esc(t("auth.email")) + '</label><input id="nexus-login-email" name="nexus_login_email" type="email" inputmode="email" maxlength="120" autocomplete="off" data-lpignore="true" data-1p-ignore value="" /></div>',
    '<div class="field"><label for="nexus-login-password">' + esc(t("auth.password")) + '</label><input id="nexus-login-password" name="nexus_login_password" type="password" minlength="8" maxlength="256" autocomplete="off" data-lpignore="true" data-1p-ignore value="" /></div>',
    '<button class="btn ghost" type="submit">' + esc(t("auth.signInAction")) + '</button><p class="provider-note" data-auth-result aria-live="polite"></p>',
    '</form>',
    '<button class="auth-text-link" id="btn-forgot" type="button">' + esc(t("auth.forgot")) + '</button>',
    '</section>',

    // Box 2 — Creează cont.
    '<section class="auth-box" aria-labelledby="signup-title"><h2 class="auth-box-title" id="signup-title">' + esc(t("auth.createAccount")) + '</h2>',
    '<form id="email-signup-form" autocomplete="off" data-signup-init-key="' + esc(newUploadMutationKey("email-signup-init")) + '" data-signup-key="' + esc(newUploadMutationKey("email-signup")) + '">',
    '<div class="field"><label for="nexus-signup-email">' + esc(t("auth.email")) + '</label><input id="nexus-signup-email" name="nexus_signup_email" type="email" inputmode="email" maxlength="120" autocomplete="off" data-lpignore="true" data-1p-ignore value="" /></div>',
    '<div class="field"><label for="nexus-signup-password">' + esc(t("auth.passwordRangeLabel")) + '</label><input id="nexus-signup-password" name="nexus_signup_password" type="password" minlength="8" maxlength="256" autocomplete="new-password" data-lpignore="true" data-1p-ignore value="" /></div>',
    '<div class="field"><label for="nexus-signup-confirm">' + esc(t("auth.confirmPassword")) + '</label><input id="nexus-signup-confirm" name="nexus_signup_confirm" type="password" minlength="8" maxlength="256" autocomplete="new-password" data-lpignore="true" data-1p-ignore value="" /></div>',
    '<button class="btn" type="submit" aria-describedby="signup-wallet-note">' + esc(t("auth.createAccount")) + '</button><p class="provider-note" data-auth-result aria-live="polite"></p>',
    '<p class="signup-note" id="signup-wallet-note"><span aria-hidden="true">◇</span> ' + esc(t("auth.walletAuto")) + '</p>',
    '</form>',
    '</section>',

    '</div></div>',
  ].join("");

  document.getElementById("email-signup-form").addEventListener("submit", emailSignup);
  document.getElementById("email-login-form").addEventListener("submit", emailLogin);
  document.getElementById("btn-google").addEventListener("click", () => {
    if (p.google) { window.location.href = "/auth/google/start"; return; }
    oauthGate("google");
  });
  document.getElementById("btn-facebook").addEventListener("click", () => {
    if (facebookReady) { window.location.href = "/auth/facebook/start"; return; }
    toast(t("auth.providerUnavailable"));
  });
  document.getElementById("btn-xportal").addEventListener("click", () => {
    startWalletFlow({ endpoint: "/auth/mvx/native" });
  });
  document.getElementById("btn-forgot").addEventListener("click", renderForgotPassword);
  document.getElementById("email-login-form").addEventListener("input", (event) => {
    event.currentTarget.dataset.loginKey = newUploadMutationKey("email-login");
  });
  document.getElementById("email-signup-form").addEventListener("input", (event) => {
    pendingEmailSignup = null;
    event.currentTarget.dataset.signupInitKey = newUploadMutationKey("email-signup-init");
    event.currentTarget.dataset.signupKey = newUploadMutationKey("email-signup");
  });
  clearAuthAutofill();
}

// Some mobile browsers/password managers ignore autocomplete="off" and inject
// a previously saved identity after the DOM is painted. Clear only untouched
// fields during that short autofill window; once the user types, we stop.
function clearAuthAutofill() {
  const fields = [...document.querySelectorAll("#email-login-form input, #email-signup-form input")];
  const touched = new WeakSet();
  fields.forEach((field) => {
    field.value = "";
    field.addEventListener("input", () => touched.add(field), { once: true });
  });
  const clearUntouched = () => fields.forEach((field) => { if (!touched.has(field)) field.value = ""; });
  requestAnimationFrame(clearUntouched);
  setTimeout(clearUntouched, 120);
  setTimeout(clearUntouched, 600);
}

async function emailSignup(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const result = form.querySelector("[data-auth-result]");
  if (!authSignupFlight.tryStart() || submit.disabled) return;
  const fd = new FormData(form);
  const password = String(fd.get("nexus_signup_password") || "");
  const confirm = String(fd.get("nexus_signup_confirm") || "");
  const email = String(fd.get("nexus_signup_email") || "").trim().toLowerCase();
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 120;
  if (!validEmail || password.length < 8 || password.length > 256 || password !== confirm) {
    authSignupFlight.finish();
    const message = !validEmail ? t("auth.invalidEmail") : password.length < 8 || password.length > 256 ? t("auth.invalidPassword") : t("auth.passwordMismatch");
    if (result) result.textContent = message;
    return toast(message);
  }
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  if (result) result.textContent = t("auth.preparingWallet");
  let completed = false;
  try {
    if (!pendingEmailSignup || pendingEmailSignup.email !== email) {
      const init = await api("/auth/email/signup-init", {
        method: "POST", headers: { "Idempotency-Key": form.dataset.signupInitKey }, body: { email },
      }).catch(() => null);
      if (!form.isConnected) return;
      const initValid = init?.ok && typeof init.nonce === "string" && init.nonce.length >= 16 && init.nonce.length <= 128 && typeof init.message === "string" && init.message.length > 0 && init.message.length <= 2048 && Number(init.expires_at) > Date.now();
      if (!initValid || !window.NexusDeviceWallet?.createDeviceWalletProof) {
        if (result) result.textContent = t("auth.walletPrepareFailed");
        return;
      }
      let walletProof;
      try { walletProof = await window.NexusDeviceWallet.createDeviceWalletProof({ password, message: init.message }); }
      catch { walletProof = null; }
      if (!form.isConnected) return;
      if (!walletProof || !/^erd1[0-9a-z]{58}$/.test(String(walletProof.address || "")) || !/^[a-f0-9]{128}$/.test(String(walletProof.signature || ""))) {
        if (result) result.textContent = t("auth.walletLocalFailed");
        return;
      }
      pendingEmailSignup = { email, nonce: init.nonce, walletProof };
    }
    if (result) result.textContent = t("auth.creatingAccount");
    const walletProof = pendingEmailSignup.walletProof;
    const r = await api("/auth/email/signup", {
      method: "POST", headers: { "Idempotency-Key": form.dataset.signupKey },
      body: { email, password, wallet_proof: { nonce: pendingEmailSignup.nonce, address: walletProof.address, signature: walletProof.signature } },
    }).catch(() => null);
    if (!form.isConnected) return;
    const confirmedAddress = String(r?.wallet?.address || "");
    if (!r?.ok || confirmedAddress !== walletProof.address || r.session_ready !== true) {
      if (result) result.textContent = r?.code === "RATE_LIMITED" ? t("auth.rateLimited") : t("auth.accountNotConfirmed");
      return;
    }
    if (!window.NexusDeviceWallet?.commitDeviceWallet?.(confirmedAddress)) {
      if (result) result.textContent = t("auth.walletActivationFailed");
      return;
    }
    completed = true;
    pendingEmailSignup = null;
    const card = document.querySelector(".landing-card");
    if (!card) return;
    card.innerHTML = [
      '<h1 class="brand">NE<span>X</span>US</h1>',
      '<div class="sep">' + esc(t("auth.accountCreatedTitle")) + '</div>',
      '<div class="notice">' + esc(t("auth.accountCreated")) + '</div>',
      '<div class="field"><label>' + esc(t("auth.address")) + '</label><input value="' + esc(confirmedAddress) + '" readonly /></div>',
      '<p class="mvx-hint">' + esc(t("auth.recoveryHint")) + '</p>',
      '<button class="btn" id="continue-account" type="button">' + esc(t("auth.continueNexus")) + '</button>',
    ].join("");
    document.getElementById("continue-account").addEventListener("click", () => location.reload());
  } finally {
    authSignupFlight.finish();
    if (!completed && form.isConnected) {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
    }
  }
}

async function emailLogin(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const result = form.querySelector("[data-auth-result]");
  if (!authLoginFlight.tryStart() || submit.disabled) return;
  const fd = new FormData(form);
  const email = String(fd.get("nexus_login_email") || "").trim().toLowerCase();
  const password = String(fd.get("nexus_login_password") || "");
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 120;
  if (!validEmail || password.length < 8 || password.length > 256) {
    authLoginFlight.finish();
    const message = !validEmail ? t("auth.invalidEmail") : t("auth.invalidPassword");
    if (result) result.textContent = message;
    return toast(message);
  }
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  if (result) result.textContent = t("auth.checkingCredentials");
  try {
    const r = await api("/auth/email/login", {
      method: "POST", headers: { "Idempotency-Key": form.dataset.loginKey }, body: { email, password },
    }).catch(() => null);
    if (!form.isConnected) return;
    if (r?.ok === true && r.user && Number.isSafeInteger(Number(r.user.id))) {
      location.reload();
      return;
    }
    if (result) result.textContent = r?.code === "RATE_LIMITED" ? t("auth.rateLimited") : t("auth.invalidCredentials");
  } finally {
    authLoginFlight.finish();
    if (form.isConnected) {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
    }
  }
}

async function herotagLogin(e) {
  e.preventDefault();
  const input = document.getElementById("herotag-login-input");
  const result = document.getElementById("herotag-login-result");
  const handle = (input?.value || "").trim().replace(/^@/, "").toLowerCase();
  if (!handle) return toast("Scrie @herotag-ul Nexus");
  result.textContent = "caut contul…";
  const r = await api("/auth/mvx/nexus-username?handle=" + encodeURIComponent(handle));
  if (!r.ok) { result.textContent = ""; return toast(r.error || "herotag negăsit"); }

  const card = document.querySelector(".landing-card");
  card.innerHTML = [
    '<div class="brand">NE<span>X</span>US</div>',
    '<div class="sep">logare cu herotag Nexus</div>',
    '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">Pregătesc conexiunea cu xPortal…</p>',
    '<div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="Cod QR pentru conectarea xPortal"></div>',
    '<div id="mvx-wc-link" class="wc-link"></div>',
    '<div class="btn-row"><button class="btn ghost" id="back-login" type="button">Înapoi</button></div>',
  ].join("");
  document.getElementById("back-login").addEventListener("click", () => renderLanding());
  await xPortalFlow({ endpoint: "/auth/mvx/herotag-login", extra: { handle: r.handle } });
}

async function aliasLogin(e) {
  e.preventDefault();
  const input = document.getElementById("alias-login-input");
  const result = document.getElementById("alias-login-result");
  const alias = (input?.value || "").trim().replace(/^@/, "").toLowerCase();
  if (!alias) return toast("Scrie herotag-ul MultiversX");
  result.textContent = "rezolv herotag-ul…";

  const r = await api("/auth/mvx/herotag?name=" + encodeURIComponent(alias));
  if (!r.ok) { result.textContent = ""; return toast(r.error || "herotag negăsit"); }

  mountWalletUi("logare cu herotag MultiversX", "@" + r.herotag);
  await xPortalFlow({ endpoint: "/auth/mvx/alias-login", extra: { alias: r.herotag } });
}

// Replace the landing card with the QR scaffold, then run the xPortal flow.
function mountWalletUi(title, subtitle) {
  const card = document.querySelector(".landing-card");
  card.innerHTML = [
    '<div class="brand">NE<span>X</span>US</div>',
    '<div class="sep">' + esc(title) + '</div>',
    subtitle ? '<p class="mvx-hint" style="text-align:center">' + esc(subtitle) + '</p>' : '',
    '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">' + esc(t("auth.preparingXportal")) + '</p>',
    '<div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="' + esc(t("auth.xportalQr")) + '"></div>',
    '<div id="mvx-wc-link" class="wc-link"></div>',
    '<div class="btn-row"><button class="btn ghost" id="back-login" type="button">' + esc(t("auth.back")) + '</button></div>',
  ].join("");
  document.getElementById("back-login").addEventListener("click", () => renderLanding());
}

async function startWalletFlow({ endpoint = "/auth/mvx/native", extra = {} } = {}) {
  mountWalletUi(t("auth.xportalTitle"));
  await xPortalFlow({ endpoint, extra });
}

function xPortalFailureMessage(error) {
  const detail = String(error?.message || "");
  if (/reject|declin|cancel|4001|anulat/i.test(detail)) return t("auth.xportalCancelled");
  if (/timeout|expir|timed out/i.test(detail)) return t("auth.xportalTimedOut");
  return t("auth.xportalFailed");
}

// Shared xPortal (WalletConnect + NativeAuth) flow. Renders QR into the current
// card, then finalizes against `endpoint` with optional `extra` JSON fields.
async function xPortalFlow({ endpoint = "/auth/mvx/native", extra = {} } = {}) {
  const statusHost = document.getElementById("mvx-wc-status");
  const isCurrent = () => statusHost?.isConnected && document.getElementById("mvx-wc-status") === statusHost;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia("(max-width: 900px)").matches);
  const setStatus = (msg) => {
    if (isCurrent()) statusHost.textContent = msg;
  };

  let mod;
  try {
    mod = await import("/wc-bundle.js?v=20260914-xportal18");
  } catch {
    setStatus(t("auth.walletModuleFailed"));
    return;
  }

  let wcState;
  try {
    wcState = await mod.startXPortalLogin({ onStatus: setStatus, freshPairing: true });
    if (!isCurrent()) return;
    const xPortalLink = mod.xPortalUniversalLink(wcState.uri);
    const qrEl = document.getElementById("mvx-wc-qr");
    const linkEl = document.getElementById("mvx-wc-link");
    if (qrEl) {
      qrEl.hidden = mobile || !wcState.uri;
      qrEl.innerHTML = !mobile && wcState.uri ? await mod.renderWcQr(wcState.uri) : "";
    }
    if (linkEl) {
      const openLabel = t("auth.openXportal");
      linkEl.innerHTML = '<a class="btn xportal-open" id="open-xportal-app" href="' + esc(xPortalLink) + '" target="' + (mobile ? "_self" : "_blank") + '" rel="noopener">' + openLabel + '</a>' +
        '<p class="mvx-hint">' + esc(mobile ? t("auth.xportalMobileHint") : t("auth.xportalDesktopHint")) + '</p>';
      if (mobile) {
        setStatus(t("auth.xportalOpening"));
        // The universal link opens the installed xPortal app and otherwise
        // falls back to its install page. The button remains as a fallback.
        setTimeout(() => { if (isCurrent()) document.getElementById("open-xportal-app")?.click(); }, 150);
      }
    }
  } catch (err) {
    setStatus(xPortalFailureMessage(err) || t("auth.xportalStartFailed"));
    return;
  }

  let resumePromise = null;
  let flowDone = false;
  const delayedResumes = new Set();
  let walletWasBackgrounded = false;
  const showSignatureCta = () => {
    if (flowDone || !isCurrent() || wcState.phase !== 'signature') return;
    const open = document.getElementById("open-xportal-app");
    if (open) {
      open.textContent = t("auth.continueSignature");
      open.href = mod.xPortalUniversalLink(null);
      open.classList.add("signature-ready");
    }
    const hint = document.querySelector("#mvx-wc-link .mvx-hint");
    if (hint) hint.textContent = t("auth.signatureHint");
    setStatus(t("auth.walletApproved"));
  };
  const resumeAfterWallet = async () => {
    if (flowDone || !isCurrent() || !['pairing', 'signature'].includes(wcState.phase) || document.visibilityState !== "visible") return;
    setStatus(t("auth.returnSync"));
    if (!resumePromise) {
      resumePromise = mod.resumeXPortalTransport(wcState)
        .catch(() => false)
        .finally(() => { resumePromise = null; });
    }
    await resumePromise;
    showSignatureCta();
  };
  const scheduleResume = () => {
    if (document.visibilityState !== "visible") return;
    resumeAfterWallet();
  };
  const trackWalletVisibility = () => {
    if (document.visibilityState !== "visible") {
      walletWasBackgrounded = true;
      return;
    }
    if (!walletWasBackgrounded) return;
    walletWasBackgrounded = false;
    scheduleResume();
  };
  const markWalletBackgrounded = () => { walletWasBackgrounded = true; };
  const cleanupResume = () => {
    flowDone = true;
    document.removeEventListener("visibilitychange", trackWalletVisibility);
    window.removeEventListener("blur", markWalletBackgrounded);
    for (const timer of delayedResumes) clearTimeout(timer);
    delayedResumes.clear();
  };
  document.addEventListener("visibilitychange", trackWalletVisibility);
  window.addEventListener("blur", markWalletBackgrounded);
  document.getElementById("back-login")?.addEventListener('click', () => {
    wcState.cancelled = true; wcState.sessionAbort?.abort(); cleanupResume();
  }, { once: true });
  try {
    await mod.finalizeXPortalLogin(wcState, { onStatus: setStatus, endpoint, extra, onPhase: (phase) => {
      if (!isCurrent()) return;
      if (phase === 'signature') showSignatureCta();
      if (phase === 'server' || phase === 'complete') {
        document.getElementById('mvx-wc-link')?.replaceChildren();
      }
    } });
    cleanupResume();
    if (!isCurrent()) return;
    toast(t("auth.authenticated"));
    location.reload();
  } catch (err) {
    cleanupResume();
    if (!isCurrent()) return;
    const failure = xPortalFailureMessage(err);
    setStatus(failure);
    const linkEl = document.getElementById("mvx-wc-link");
    if (linkEl) { linkEl.replaceChildren(); linkEl.insertAdjacentHTML("beforeend", '<button class="btn ghost" id="retry-xportal" type="button">' + esc(t("auth.retryConnection")) + '</button>'); }
    document.getElementById("retry-xportal")?.addEventListener("click", () => startWalletFlow({ endpoint, extra }));
    toast(failure);
  }
}

function renderRecovery() {
  const card = document.querySelector(".landing-card");
  card.innerHTML = [
    '<div class="brand">NE<span>X</span>US</div>',
    '<div class="sep">recuperare cont</div>',
    '<button class="btn ghost" id="rec-xportal" type="button">Recuperează contul prin xPortal</button>',
    '<p class="mvx-hint">Pentru siguranță, Nexus nu îți cere seed phrase. Dacă ai un backup, restaurează-l direct în xPortal și apoi conectează walletul aici.</p>',
    '<div id="rec-area"></div>',
    '<button class="btn ghost" id="back-login" type="button">Înapoi la login</button>',
  ].join("");
  document.getElementById("back-login").addEventListener("click", () => renderLanding());
  document.getElementById("rec-xportal").addEventListener("click", async () => {
    const area = document.getElementById("rec-area");
    area.innerHTML = [
      '<div class="sep">recuperare prin xPortal</div>',
      '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">Pregătesc conexiunea cu xPortal…</p>',
      '<div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="Cod QR pentru recuperarea contului prin xPortal"></div>',
      '<div id="mvx-wc-link" class="wc-link"></div>',
    ].join("");
    await xPortalFlow({ endpoint: "/auth/mvx/recover" });
  });
}

function renderForgotPassword() {
  const card = document.querySelector(".landing-card");
  card.innerHTML = [
    '<div class="brand">NE<span>X</span>US</div>',
    '<div class="sep">' + esc(t("auth.recoveryTitle")) + '</div>',
    '<p class="mvx-hint">' + esc(t("auth.emailResetUnavailable")) + '</p>',
    '<button class="btn wallet-btn" id="recover-xportal" type="button"><span class="btn-logo">◇</span>' + esc(t("auth.recoverXportal")) + '</button>',
    '<div id="recovery-wallet-area"></div>',
    '<button class="btn ghost" id="back-login" type="button">' + esc(t("auth.backLogin")) + '</button>',
  ].join("");
  document.getElementById("back-login").addEventListener("click", () => renderLanding());
  document.getElementById("recover-xportal").addEventListener("click", async () => {
    const area = document.getElementById("recovery-wallet-area");
    area.innerHTML = '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">' + esc(t("auth.recoveryPreparing")) + '</p><div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="' + esc(t("auth.xportalQr")) + '"></div><div id="mvx-wc-link" class="wc-link"></div>';
    await xPortalFlow({ endpoint: "/auth/mvx/recover" });
  });
}

function renderMvxLogin(enabled) {
  const box = document.getElementById("mvx-box");
  if (!enabled) return;
  box.innerHTML = [
    '<button class="btn" id="mvx-native">Conectează cu xPortal (mainnet)</button>',
    '<div class="sep">sau loghează cu herotag MultiversX</div>',
    '<div class="field"><label>@herotag (ex. romeoo)</label><div class="btn-row"><input id="mvx-herotag" placeholder="romeoo" autocomplete="off" autocapitalize="off" spellcheck="false" /><button class="btn small" id="mvx-resolve" type="button">Rezolvă</button></div></div>',
    '<p id="mvx-resolve-result" class="mvx-hint"></p>',
    '<p class="mvx-hint">Conectarea cu xPortal deschide portofelul pe telefon (QR/deep-link) și semnează NativeAuth; după confirmare ești logat automat.</p>',
  ].join("");
  document.getElementById("mvx-resolve").addEventListener("click", async () => {
    const name = document.getElementById("mvx-herotag").value.trim();
    if (!name) return toast("Scrie @herotag");
    const r = await api("/auth/mvx/herotag?name=" + encodeURIComponent(name));
    if (r.ok) { document.getElementById("mvx-resolve-result").innerHTML = "✓ @" + esc(r.herotag) + " — găsit (se va loga prin xPortal)"; }
    else { document.getElementById("mvx-resolve-result").innerHTML = ""; toast(r.error || "herotag negăsit"); }
  });
  document.getElementById("mvx-native").addEventListener("click", nativeAuthLogin);
}

async function oauthGate(provider) {
  const r = await api("/auth/" + provider);
  const msg = provider === "google"
    ? "Google OAuth: implementat, dar necesită GOOGLE_CLIENT_ID și GOOGLE_CLIENT_SECRET în .env"
    : "Facebook OAuth: implementat, dar necesită FACEBOOK_APP_ID și FACEBOOK_APP_SECRET în .env";
  if (r.ok === false) toast(r.error || msg);
  else toast(provider + ": gata de activare — adaugă cheile în .env");
}

function nativeAuthLogin() {
  const box = document.getElementById("mvx-box");
  box.innerHTML = [
    '<div class="sep">Conectare cu xPortal</div>',
    '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">Pregătesc conexiunea cu xPortal…</p>',
    '<div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="Cod QR pentru conectarea xPortal"></div>',
    '<div id="mvx-wc-link" class="wc-link"></div>',
    '<div class="btn-row"><button class="btn ghost" id="mvx-native-cancel" type="button">Înapoi</button></div>',
  ].join("");
  document.getElementById("mvx-native-cancel").addEventListener("click", () => renderMvxLogin(true));
  xPortalLogin(box);
}

async function xPortalLogin(box) {
  void box;
  return xPortalFlow();
}

// Pulling a page down is the single refresh gesture of the whole application. The listener
// lives on the viewport, so every screen that scrolls (feed, profile, market, inbox) gets it
// without being wired one by one, and the hint is written in the interface language.
function bindGlobalPullRefresh(viewport) {
  if (!viewport) return;
  let startY = null, startX = null, screen = null, armed = false;
  const reset = () => {
    screen?.classList.remove("profilePullReady");
    screen?.querySelector(".nexusPullHint")?.remove();
    startY = startX = null;
    screen = null;
    armed = false;
  };
  viewport.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return reset();
    const target = event.target instanceof Element ? event.target.closest(".scrollScreen, .accountScreen, .clipsScreen") : null;
    if (!target || target.scrollTop > 0) return reset();
    if (target.classList.contains("accountScreen") || target.classList.contains("clipsScreen")) return reset();
    screen = target;
    startY = event.touches[0].clientY;
    startX = event.touches[0].clientX;
  }, { passive: true });
  viewport.addEventListener("touchmove", (event) => {
    if (startY === null || !screen?.isConnected || event.touches.length !== 1) return;
    const dy = event.touches[0].clientY - startY;
    const dx = Math.abs(event.touches[0].clientX - startX);
    armed = dy > 72 && dy > dx * 1.4;
    if (!armed) return;
    screen.classList.add("profilePullReady");
    if (!screen.querySelector(".nexusPullHint")) {
      const hint = document.createElement("div");
      hint.className = "nexusPullHint";
      hint.setAttribute("role", "status");
      hint.textContent = t("feed.pullRefresh");
      screen.prepend(hint);
    }
  }, { passive: true });
  viewport.addEventListener("touchend", () => {
    const run = armed;
    const target = screen;
    reset();
    if (!run || !target?.isConnected) return;
    profileLoadGate.invalidate();
    renderHeader();
    renderView();
  }, { passive: true });
  viewport.addEventListener("touchcancel", reset, { passive: true });
}

// A shared link has to open the post it points to, otherwise "copy link" would be a lie.
function openDeepLinkedPost() {
  const match = /^#post-(\d+)$/.exec(location.hash || "");
  if (!match || state?.persona !== "social") return false;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  void openPostDetail(id, { directHash: true });
  return true;
}

// A reply link has the same promise as a post link: the reader lands on the reply itself, inside the
// conversation it belongs to, and the server decides whether that reply may be read at all.
async function openReplyDeepLink(commentId, { from = null } = {}) {
  const id = Number(commentId);
  if (!Number.isSafeInteger(id) || id <= 0 || state?.persona !== "social") return false;
  const context = await api("/api/comments/" + id + "/context").catch(() => null);
  const postId = Number(context?.post_id || 0);
  const exact = context?.ok === true && Number(context.comment_id) === id && Number.isSafeInteger(postId) && postId > 0;
  if (!exact) return false;
  await openPostDetail(postId, { focusReplyId: id, from });
  return true;
}

// #reply-<id> is the reply permalink; #post-<id> stays what it always was.
function openDeepLinkedTarget() {
  const reply = /^#reply-(\d+)$/.exec(location.hash || "");
  if (reply) { void openReplyDeepLink(Number(reply[1])); return true; }
  return openDeepLinkedPost();
}

// ---------- identity onboarding ----------
// Shown once for an account that never chose a handle. Dismissing it is allowed (the account already
// works with its generated handle) and it simply comes back on the next visit, because the server
// still has no completion stamp.
let onboardingActive = false;

function closeOnboarding() {
  onboardingActive = false;
  document.getElementById("onboarding")?.remove();
}

function openOnboarding() {
  if (onboardingActive || document.getElementById("onboarding")) return;
  const host = document.querySelector(".phoneScreen") || document.body;
  onboardingActive = true;
  const defaults = onboardingDefaults(state.user, state.onboarding);
  host.insertAdjacentHTML("beforeend", onboardingMarkup({ esc, t, defaults }));
  const layer = document.getElementById("onboarding");
  layer?.querySelector('input[name="handle"]')?.focus({ preventScroll: true });
  bindOnboarding(layer ?? host, {
    t,
    toast,
    defaults,
    checkHandle: (handle) => api("/api/onboarding/handle?handle=" + encodeURIComponent(handle)).catch(() => null),
    submit: (body) => api("/api/onboarding", {
      method: "POST",
      headers: { "Idempotency-Key": newUploadMutationKey("onboarding") },
      body,
    }).catch(() => null),
    onDismiss: () => closeOnboarding(),
    onCompleted: (result) => {
      state.user = { ...state.user, ...(result.user || {}) };
      state.onboarding = result.onboarding ?? state.onboarding;
      if (result.persona) state.persona = result.persona;
      closeOnboarding();
      toast(t("x.onboard.done"));
      renderShell();
      renderView();
    },
  });
}

function maybeStartOnboarding() {
  if (state?.persona !== "social") return false;
  if (!onboardingRequired(state?.user, state?.onboarding)) return false;
  openOnboarding();
  return true;
}

function renderShell() {
  app.innerHTML = [
    '<div class="nexusDemo">',
    '<header class="showcaseHeader"><div class="trustTag">◇ <span>LOCAL STATE<br/><b>PERSISTENT</b></span></div><div class="heroBrand">NE<span>X</span>US<small>THE WORLD\'S BLOCKCHAIN SOCIAL SUPER-APP</small></div><div class="trustTag">▣ <span>PRIVACY<br/><b>BY DESIGN</b></span></div></header>',
    '<section class="demoStage">',
    '<aside class="moduleRail" id="moduleRail"></aside>',
    '<div class="phone"><div class="phoneMetal"><div class="phoneScreen">',
    '<div class="dynamicIsland"></div>',
    '<div id="phoneHeader"></div>',
    '<div class="screenViewport" id="screenViewport"></div>',
    '<div id="phoneNav"></div>',
    '</div></div></div>',
    '<aside class="infoPanel" id="infoPanel"></aside>',
    '</section>',
    '<footer class="showcaseFooter"><div>◎ <b>BUILT FOR THE WORLD</b></div><p><span>NEXUS is free to join and use.</span><br/>Support creators only when you choose.</p><div>♙ <b>FREE ENGAGEMENT + PAID SUPPORT</b></div></footer>',
    '</div>',
  ].join("");

  renderRail();
  renderHeader();
  renderNav();
  renderInfoPanel();
  // The drawer of the feed bar, mounted with the shell so it survives every header re-render (the bar is
  // re-rendered whenever a counter changes).
  feedHub = mountFeedHub();
  feedHub.mount(document.querySelector(".phoneScreen"));
  // One refresh gesture for the whole application, and a shared post link that opens.
  bindGlobalPullRefresh(document.getElementById("screenViewport"));
  window.addEventListener("hashchange", () => { openDeepLinkedTarget(); });
  queueMicrotask(() => { openDeepLinkedTarget(); });
}

function renderRail() {
  const rail = document.getElementById("moduleRail");
  rail.innerHTML = "<small>OPEN A MODULE</small>" + MODULES.map((m) => {
    const id = m[0], icon = m[1], name = m[2], section = m[3], color = m[4];
    return '<button data-module="' + id + '" class="' + (id === activeModule ? "active" : "") + '" style="--accent:' + color + '"><i>' + icon + '</i><span><b>' + name + '</b><small>' + section + '</small></span></button>';
  }).join("");
  rail.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => selectModule(b.dataset.module)));
}

// The owner's rule (2 octombrie 2026): each deployed build prints its version on the main logo, so he can see
// which build he is looking at. Bump the line below on every deploy; the series starts at 1.01.
const NEXUS_BUILD_VERSION = "1.10";
function nexusWordmarkMarkup() {
  return '<svg class="nexusWordmarkSvg" viewBox="0 0 132 34" role="img" aria-label="Nexus"><defs><linearGradient id="nexus-wordmark-x" x1="0" x2="1"><stop stop-color="#00efff"/><stop offset="1" stop-color="#a66cff"/></linearGradient></defs><text x="1" y="24" fill="#f4fbff" font-size="22" font-family="Arial,Helvetica,sans-serif" letter-spacing="5">NE</text><text x="44" y="24" fill="url(#nexus-wordmark-x)" font-size="22" font-family="Arial,Helvetica,sans-serif">X</text><text x="61" y="24" fill="#f4fbff" font-size="22" font-family="Arial,Helvetica,sans-serif" letter-spacing="5">US</text><path d="M91 8h27m-17 6h24m-31 6h30m-20 6h14" fill="none" stroke="#27dfe9" stroke-width="1" opacity=".65"/><circle cx="121" cy="8" r="1.6" fill="#9d72ff"/><circle cx="127" cy="14" r="1.6" fill="#27dfe9"/><circle cx="126" cy="20" r="1.6" fill="#9d72ff"/></svg><i class="wordmarkBuild" aria-hidden="true">' + NEXUS_BUILD_VERSION + '</i>';
}

// The sign-out is a setting, and the dialog around it speaks the interface language like the rest of
// the screen it is opened from (it used to be Romanian only, whichever language the app was in).
async function logoutFromProfile() {
  if (document.getElementById("profileLogoutDialog")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "profileLogoutDialog";
  dialog.className = "profileLogoutDialog";
  dialog.innerHTML = '<form method="dialog"><h2>' + esc(t("x.profile.logout")) + '</h2><p>' + esc(t("profile.logoutConfirm")) + '</p><div data-logout-status role="status" aria-live="polite"></div><menu><button value="cancel">' + esc(t("common.cancel")) + '</button><button value="logout">' + esc(t("x.profile.logout")) + '</button></menu></form>';
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector('[value="logout"]').addEventListener("click", async (event) => {
    event.preventDefault();
    const buttons = [...dialog.querySelectorAll("button")];
    buttons.forEach((button) => { button.disabled = true; });
    dialog.querySelector("[data-logout-status]").textContent = t("profile.logoutPending");
    await endCurrentCall(true);
    const result = await api("/auth/logout", { method: "POST" }).catch(() => null);
    if (!result?.ok) {
      buttons.forEach((button) => { button.disabled = false; });
      dialog.querySelector("[data-logout-status]").textContent = t("profile.logoutFailed");
      return;
    }
    clearInterval(presenceHeartbeatTimer);
    await clearCurrentUserDeviceCache();
    location.replace("/");
  });
  dialog.showModal();
}

function refreshActiveProfile() {
  if (activeSlot !== "account") return;
  profileLoadGate.invalidate();
  return renderProfiles(document.getElementById("screenViewport"));
}

function renderHeader() {
  const box = document.getElementById("phoneHeader");
  const p = profileById(state.persona);
  const persona = activePersonaRecord();
  const sigil = earnedSigilFor(null, state.persona);
  const modeInitials = String(persona.name || p[1]).slice(0, 2).toUpperCase();
  const modeAvatar = persona.avatar ? '<img src="' + esc(persona.avatar) + '" alt="" />' : '<strong>' + esc(modeInitials) + '</strong>';
  if (activeSlot === "account") {
    // The profile screen has no app header: no wordmark, no section title, no sign-out button. The tab
    // bar is the top of that page, and the sign-out lives in Access and security, next to the sessions
    // it ends. The element stays in the DOM but empty, and the stylesheet keeps it collapsed.
    box.innerHTML = "";
    return;
  }
  const feedLabel = socialFeedLabel();
  const friendsLabel = ({ followers: t("header.followers"), following: t("header.following"), favorites: t("header.favorites"), requests: t("header.requests") })[socialFriendView] || t("header.friends");
  const personaHeader = {
    work: { context: "Feed", relations: "Network" },
    dating: { context: "Discover", relations: "Connections" },
    travel: { context: "Explore", relations: "Trips" },
    market: { context: "Browse", relations: "Orders" },
  }[state.persona];
  // The feed has a bar of its own: a logo, a search field that opens the Social search screen, the
  // unread counters the bottom navigation prints, and the doors that were already here. The bar belongs
  // to the feed only - the profile screen keeps its own header (there is none), and the other modules
  // keep the badges they were built around.
  const onFeed = state.persona === "social" && activeModule === "clips" && activeSlot === "primary"
    && new Set(["mix", "discover", "tweets"]).has(socialTopView);
  const socialHeaderControls = state.persona === "social" ? [
    // On the feed the two old plates are not printed: the bar has its own four doors.
    onFeed ? "" : '<button class="modeBadge feedBadge" id="feedBadge" style="--mode-color:#20e0d0" aria-haspopup="dialog" aria-label="' + esc(t("header.changeFeed") + " · " + feedLabel.title) + '" title="' + esc(feedLabel.kind + " · " + feedLabel.title) + '"><i>✦</i><span><small>' + esc(feedLabel.kind) + '</small><b>' + esc(feedLabel.title) + '</b></span><em>⌄</em></button>',
    onFeed ? "" : '<button class="modeBadge friendsBadge" id="friendsBadge" style="--mode-color:#7be7d8" aria-haspopup="dialog" aria-label="' + esc(t("header.openRelations") + " · " + friendsLabel) + '" title="' + esc(t("header.friends") + " · " + friendsLabel) + '"><i>◎</i><span><small>' + esc(t("header.relations")) + '</small><b>' + esc(friendsLabel) + '</b></span><em>⌄</em></button>',
  ].join("") : personaHeader ? [
    '<button class="modeBadge feedBadge" id="feedBadge" style="--mode-color:' + p[4] + '" aria-label="Deschide ' + esc(personaHeader.context) + '"><span><b>' + esc(personaHeader.context) + '</b></span></button>',
    '<button class="modeBadge friendsBadge" id="friendsBadge" style="--mode-color:' + p[4] + '" aria-label="Deschide ' + esc(personaHeader.relations) + '"><span><b>' + esc(personaHeader.relations) + '</b></span></button>',
  ].join("") : "";
  // Wave 14h: nothing sits between the rail and the switches any more - the drawer that mark opened is the
  // first mark of the bottom bar now.
  // Wave 14f: the rail is drawn by the bar, so its presses and its arrow keys are bound where the bar is drawn.
  const modes = onFeed ? feedModeSwitchMarkup({ active: feedMode, t, esc }) : "";
  box.innerHTML = [
    // The bar wears the tint of the reading it prints (`feedMode-reels|whispers|news`).
    '<header class="appHeader' + (onFeed ? " feedHeader feedMode-" + feedMode : "") + '">',
    '<button class="wordmark" id="wordmark" type="button" aria-label="' + esc(t("header.home")) + '" title="' + esc(t("header.home")) + '">' + nexusWordmarkMarkup() + '</button>',
    modes,
    '<div class="headerSwitches">',
    '<button class="modeBadge ' + esc(state.persona) + '" id="modeBadge" style="--mode-color:' + p[4] + '" aria-label="Schimbă Nexus ' + esc(p[1]) + ' · profil activ ' + esc(persona.name || p[2]) + '" title="Nexus ' + esc(p[1]) + ' · ' + esc(persona.name || p[2]) + '"><i class="modeAvatar">' + modeAvatar + '</i><span><small>NEXUS</small><b>' + p[1] + '</b></span><em>⌄</em></button>',
    socialHeaderControls,
    '</div>',
    onFeed ? feedHeaderActionsMarkup({ t, esc }) : "",
    '</header>',
  ].join("");
  box.closest(".phoneScreen")?.classList.toggle("hasSocialTopNav", false);
  document.getElementById("wordmark").addEventListener("click", goHome);
  document.getElementById("modeBadge").addEventListener("click", openProfileSwitcher);
  document.getElementById("feedBadge")?.addEventListener("click", state.persona === "social" ? openSocialFeedSwitcher : () => navigate("primary"));
  document.getElementById("friendsBadge")?.addEventListener("click", state.persona === "social" ? openSocialFriendsSwitcher : () => navigate("utility"));
  // Wave 14g: the bar's one button opens a drawer of marks that answers for its own presses.
  // Wave 14f: the three readings are the bar's own control now; the rail answers for its presses and keys.
  if (onFeed) bindFeedModeRail(box, { current: () => feedMode, onSelect: activateFeedMode });
}

// The one door of the feed bar keeps its state and its actions here and its drawer in feed-hub.js.
function mountFeedHub() {
  return createFeedHub({
    t, esc, profiles: PROFILES, state,
    module: switchPersona, logout: logoutFromProfile,
  });
}

function socialFeedLabel() {
  const kind = t(socialFormat === "clips" ? "feed.kindClips" : socialFormat === "tweets" ? "feed.kindTweets" : "feed.kindPosts");
  if (socialTopView === "friends") return { kind, title: t(socialFormat === "following" ? "feed.following" : "feed.friends"), detail: t("feed.friendsDetail") };
  if (socialTopView === "photos") return { kind, title: t("feed.photos"), detail: t("feed.photosDetail") };
  if (socialTopView === "private") return { kind, title: t("feed.private"), detail: t("feed.privateDetail") };
  if (socialTopView === "tweets") return { kind, title: t("feed.tweets"), detail: t("feed.tweetsDetail") };
  if (socialTopView === "discover" && socialLens === "near") return { kind, title: t("feed.local"), detail: t("feed.localDetail") };
  if (socialTopView === "discover" && socialLens === "global") return { kind, title: t("feed.global"), detail: t("feed.globalDetail") };
  if (socialTopView === "discover" && socialLens === "breaking") return { kind, title: t("feed.breaking"), detail: t("feed.breakingDetail") };
  if (socialTopView === "search") return { kind, title: t("feed.search"), detail: t("feed.searchDetail") };
  return { kind, title: t("feed.mix"), detail: t("feed.forYouDetail") };
}

function activateSocialFeed(feed) {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(() => activateSocialFeed(feed))) return;
  if (!new Set(["for-you", "photos", "local", "global", "friends", "following", "private", "breaking", "tweets", "search"]).has(feed)) return;
  stopComposerCamera();
  // A lens is remembered per mode, so leaving Whispers for Reels brings back the lens Reels had.
  if (feedMode === "reels" && new Set(["for-you", "local", "global", "following"]).has(feed)) reelsLensFeed = feed;
  activeModule = "clips";
  activeSlot = "primary";
  if (feed === "for-you") { socialTopView = "mix"; socialLens = "for-you"; socialFormat = "clips"; }
  else if (feed === "photos") { socialTopView = "photos"; socialLens = "for-you"; socialFormat = "posts"; }
  else if (feed === "private") { socialTopView = "private"; socialLens = "for-you"; socialFormat = "posts"; }
  else if (feed === "tweets") { socialTopView = "tweets"; socialLens = "for-you"; socialFormat = "tweets"; }
  else if (feed === "local") { socialTopView = "discover"; socialLens = "near"; if (socialFormat === "following" || socialFormat === "tweets") socialFormat = "clips"; }
  else if (feed === "global") { socialTopView = "discover"; socialLens = "global"; if (socialFormat === "following" || socialFormat === "tweets") socialFormat = "clips"; }
  else if (feed === "breaking") { socialTopView = "discover"; socialLens = "breaking"; if (socialFormat === "following" || socialFormat === "tweets") socialFormat = "clips"; }
  else if (feed === "search") { socialTopView = "search"; if (socialFormat === "following" || socialFormat === "tweets") socialFormat = "clips"; }
  else { socialTopView = "friends"; socialLens = "for-you"; socialFormat = "following"; }
  renderRail();
  renderHeader();
  renderNav();
  renderInfoPanel();
  renderView();
}

// The switch itself. A mode is a lens/format pair plus the card that renders it, so this is a thin
// translation to the destinations that already exist: News is the approved aggregator lens, Whispers
// is the text-only timeline, and Reels is whatever lens Reels had when the reader left it.
function activateFeedMode(mode) {
  if (!FEED_MODE_CONTRACT[mode] || mode === feedMode) return;
  feedScrollMemory.set(feedMode + ":" + socialLens + ":" + socialFormat, Math.max(0, Number(document.getElementById("pulsePosts")?.scrollTop || 0)));
  feedMode = mode;
  if (mode === "news") activateSocialFeed("breaking");
  else if (mode === "whispers") activateSocialFeed("tweets");
  else activateSocialFeed(reelsLensFeed);
}

function currentSocialFeedKey() {
  if (socialTopView === "friends") return socialFormat === "following" ? "following" : "friends";
  if (socialTopView === "photos") return "photos";
  if (socialTopView === "private") return "private";
  if (socialTopView === "tweets") return "tweets";
  if (socialTopView === "discover" && socialLens === "near") return "local";
  if (socialTopView === "discover" && socialLens === "global") return "global";
  if (socialTopView === "discover" && socialLens === "breaking") return "breaking";
  if (socialTopView === "search") return "search";
  return "for-you";
}

function closeSocialFeedSwitcher() {
  document.getElementById("socialFeedSwitcherBackdrop")?.remove();
}

function socialFavoritesKey() {
  return "nexus-social-favorites:" + String(state?.user?.id || state?.user?.handle || "local") + ":" + String(state?.persona || "social");
}

function readSocialFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(socialFavoritesKey()) || "[]");
    if (!Array.isArray(parsed) || parsed.length > 500) return [];
    return [...new Set(parsed.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  }
  catch { return []; }
}

function writeSocialFavorites(ids) {
  try {
    const bounded = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 500);
    localStorage.setItem(socialFavoritesKey(), JSON.stringify(bounded));
    return true;
  } catch { return false; }
}

window.addEventListener("storage", (event) => {
  if (!state || event.key !== socialFavoritesKey() || !document.getElementById("socialFriendsSwitcherBackdrop")) return;
  socialFriendsLoadGate.invalidate();
  loadSocialFriendsList(socialFriendView);
});

function closeSocialFriendsSwitcher() {
  socialFriendsLoadGate.invalidate();
  document.getElementById("socialFriendsSwitcherBackdrop")?.remove();
}

function fallbackSocialRelations(kind) {
  const favorites = readSocialFavorites();
  const seen = new Map();
  currentFeedPosts.forEach((post) => {
    const author = post.author || {};
    if (!post.user_id || post.user_id === state.user.id || seen.has(post.user_id)) return;
    const isFollowing = Boolean(post.following_me);
    const isFavorite = favorites.includes(Number(post.user_id));
    if (kind === "followers" && !isFollowing) return;
    if (kind === "following" && !isFollowing) return;
    if (kind === "favorites" && !isFavorite) return;
    seen.set(post.user_id, {
      user_id: post.user_id,
      handle: author.handle || "creator",
      name: author.display_name || author.handle || "Creator",
      avatar: author.avatar || null,
      bio: author.bio || "",
      relation: kind,
      following_me: isFollowing,
      favorite: isFavorite,
      counts: { followers: Number(author.followers || 0), posts: 0 },
      earned_sigil: author.earned_sigil,
    });
  });
  return [...seen.values()];
}

function stableFollowRequestMutationKey(intent) {
  const normalized = String(intent || "");
  if (!/^(?:decision|cancel):[1-9]\d*:(?:accept|decline|social|work|dating|travel|market)$/.test(normalized)) return "";
  if (!followRequestMutationKeys.has(normalized)) {
    if (followRequestMutationKeys.size >= 400) {
      const oldest = followRequestMutationKeys.keys().next().value;
      if (oldest) followRequestMutationKeys.delete(oldest);
    }
    followRequestMutationKeys.set(normalized, newUploadMutationKey("follow-request"));
  }
  return followRequestMutationKeys.get(normalized);
}

function isSafeSocialRelationsPage(result, { kind, cursor, viewerId, viewerPersona }) {
  const nextCursorValid = result?.next_cursor == null || (/^\d{1,3}$/.test(String(result.next_cursor))
    && Number(result.next_cursor) > Number(cursor) && Number(result.next_cursor) <= 400);
  return Boolean(result?.ok && Number(result.viewer_id) === Number(viewerId) && result.viewer_persona === viewerPersona
    && result.kind === kind && result.cursor === String(cursor) && nextCursorValid
    && Array.isArray(result.people) && result.people.length <= 40
    && new Set(result.people.map((person) => Number(person?.user_id))).size === result.people.length
    && result.people.every((person) => person && typeof person === "object"
      && Number.isSafeInteger(Number(person.user_id)) && Number(person.user_id) > 0 && Number(person.user_id) !== Number(viewerId)
      && typeof person.handle === "string" && /^[a-z0-9_]{2,30}$/.test(person.handle)
      && typeof person.name === "string" && person.name.length >= 1 && person.name.length <= 80
      && ["followers", "following"].includes(person.relation)
      && typeof person.following_me === "boolean"
      && (!person.avatar || Boolean(safeInternalMediaUrl(person.avatar)))));
}

async function loadSocialFriendsList(kind = socialFriendView) {
  const host = document.getElementById("social-friends-list");
  if (!host) return;
  const selectedPersona = state.persona;
  const requestGate = socialFriendsLoadGate.begin();
  const stillCurrent = () => requestGate.isCurrent()
    && host.isConnected
    && state.persona === selectedPersona
    && document.getElementById("social-friends-list") === host;
  socialFriendView = kind;
  renderHeader();
  host.innerHTML = '<div class="friendsLoading">' + esc(t("friends.loading")) + '</div>';
  document.querySelectorAll("[data-friends-kind]").forEach((button) => button.classList.toggle("active", button.dataset.friendsKind === kind));
  if (kind === "requests") {
    const viewerId = Number(state.user.id);
    const [incomingResult, outgoingResult] = await Promise.all([
      api("/api/follow/requests?direction=incoming").catch(() => null),
      api("/api/follow/requests?direction=outgoing").catch(() => null),
    ]);
    if (!stillCurrent()) return;
    if (!incomingResult?.ok || !outgoingResult?.ok
      || Number(incomingResult.viewer_id) !== viewerId || Number(outgoingResult.viewer_id) !== viewerId
      || incomingResult.persona !== selectedPersona || outgoingResult.persona !== selectedPersona
      || incomingResult.direction !== "incoming" || outgoingResult.direction !== "outgoing") {
      host.innerHTML = '<div class="friendsEmpty error"><b>' + esc(t("friends.requestsLoadFailed")) + '</b><span>' + esc(t("friends.requestsLoadFailedDetail")) + '</span><button type="button" data-request-retry>' + esc(t("common.retry")) + '</button></div>';
      host.querySelector("[data-request-retry]")?.addEventListener("click", () => loadSocialFriendsList("requests"));
      return;
    }
    const validRequestList = (value, direction) => Array.isArray(value) && value.length <= 80 && value.every((request) => request && typeof request === "object"
      && Number.isSafeInteger(Number(request.id)) && Number(request.id) > 0
      && Number.isSafeInteger(Number(direction === "incoming" ? request.requester_id : request.target_id))
      && Number(direction === "incoming" ? request.requester_id : request.target_id) > 0
      && request.persona === selectedPersona && request.status === "pending"
      && typeof request.handle === "string" && /^[a-z0-9_]{2,30}$/.test(request.handle)
      && typeof request.name === "string" && request.name.length >= 1 && request.name.length <= 80);
    if (!validRequestList(incomingResult.requests, "incoming") || !validRequestList(outgoingResult.requests, "outgoing")
      || new Set(incomingResult.requests.map((request) => Number(request.id))).size !== incomingResult.requests.length
      || new Set(outgoingResult.requests.map((request) => Number(request.id))).size !== outgoingResult.requests.length) {
      host.innerHTML = '<div class="friendsEmpty error"><b>' + esc(t("friends.requestsLoadFailed")) + '</b><span>' + esc(t("friends.requestsLoadFailedDetail")) + '</span><button type="button" data-request-retry>' + esc(t("common.retry")) + '</button></div>';
      host.querySelector("[data-request-retry]")?.addEventListener("click", () => loadSocialFriendsList("requests"));
      return;
    }
    const incoming = incomingResult.requests;
    const outgoing = outgoingResult.requests;
    if (!incoming.length && !outgoing.length) {
      host.innerHTML = '<div class="friendsEmpty"><b>' + esc(t("friends.noRequests")) + '</b><span>' + esc(t("friends.noRequestsDetail")) + '</span></div>';
      return;
    }
    const requestMutationGate = createSingleFlightGate();
    const lockRequestActions = () => host.querySelectorAll("[data-request-decision], [data-request-cancel]")
      .forEach((action) => { action.disabled = true; });
    const requestRow = (request, direction) => {
      const personId = Number(direction === "incoming" ? request.requester_id : request.target_id);
      const name = request.name || request.handle || "Nexus";
      const initials = name.slice(0, 2).toUpperCase();
      const avatarUrl = safeInternalMediaUrl(request.avatar);
      const actions = direction === "incoming"
        ? '<div class="requestActions"><button type="button" data-request-decision="decline" data-request-id="' + request.id + '" data-request-key="' + esc(stableFollowRequestMutationKey(`decision:${request.id}:decline`)) + '">' + esc(t("friends.decline")) + '</button><button type="button" data-request-decision="accept" data-request-id="' + request.id + '" data-request-key="' + esc(stableFollowRequestMutationKey(`decision:${request.id}:accept`)) + '" class="primary">' + esc(t("friends.accept")) + '</button></div>'
        : '<div class="requestActions"><button type="button" data-request-cancel="' + personId + '" data-request-key="' + esc(stableFollowRequestMutationKey(`cancel:${personId}:${selectedPersona}`)) + '">' + esc(t("friends.cancel")) + '</button></div>';
      return '<article class="friendRow followRequestRow" data-friend-id="' + personId + '"><i>' + (avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(initials)) + '</i><span><b><bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(request.handle || "user") + '</bdi> · ' + esc(t(direction === "incoming" ? "friends.wantsFollow" : "friends.pending")) + '</small></span>' + actions + '</article>';
    };
    host.innerHTML = (incoming.length ? '<section class="followRequestSection"><h3>' + esc(t("friends.received")) + ' <b>' + incoming.length + '</b></h3>' + incoming.map((request) => requestRow(request, "incoming")).join("") + '</section>' : '')
      + (outgoing.length ? '<section class="followRequestSection"><h3>' + esc(t("friends.sent")) + ' <b>' + outgoing.length + '</b></h3>' + outgoing.map((request) => requestRow(request, "outgoing")).join("") + '</section>' : '');
    host.querySelectorAll("[data-request-decision]").forEach((button) => button.addEventListener("click", async () => {
      if (!requestMutationGate.tryStart()) return;
      const requestId = Number(button.dataset.requestId);
      const decision = button.dataset.requestDecision;
      const mutationKey = button.dataset.requestKey;
      if (!Number.isSafeInteger(requestId) || requestId <= 0 || !["accept", "decline"].includes(decision) || !mutationKey) { requestMutationGate.finish(); return; }
      lockRequestActions();
      const result = await api("/api/follow/requests/" + requestId + "/decision", { method: "POST", headers: { "Idempotency-Key": mutationKey }, body: { decision } }).catch(() => null);
      requestMutationGate.finish();
      if (!stillCurrent() || socialFriendView !== "requests") return;
      if (!result?.ok || Number(result.request_id) !== requestId || result.decision !== decision || typeof result.active !== "boolean"
        || Number(result.actor_id) !== viewerId || result.actor_persona !== selectedPersona || Number(result.target_id) !== viewerId) { toast(t("friends.requestUpdateError")); return loadSocialFriendsList("requests"); }
      followRequestMutationKeys.delete(`decision:${requestId}:accept`);
      followRequestMutationKeys.delete(`decision:${requestId}:decline`);
      toast(t(decision === "accept" ? "friends.requestAccepted" : "friends.requestDeclined"));
      loadSocialFriendsList("requests");
    }));
    host.querySelectorAll("[data-request-cancel]").forEach((button) => button.addEventListener("click", async () => {
      if (!requestMutationGate.tryStart()) return;
      const targetId = Number(button.dataset.requestCancel);
      const mutationKey = button.dataset.requestKey;
      if (!Number.isSafeInteger(targetId) || targetId <= 0 || !mutationKey) { requestMutationGate.finish(); return; }
      lockRequestActions();
      const result = await api("/api/follow", { method: "POST", headers: { "Idempotency-Key": mutationKey }, body: { user_id: targetId, persona: selectedPersona, active: false } }).catch(() => null);
      requestMutationGate.finish();
      if (!stillCurrent() || socialFriendView !== "requests") return;
      if (!result?.ok || Number(result.actor_id) !== viewerId || result.actor_persona !== selectedPersona
        || Number(result.target_id) !== targetId || result.target_persona !== selectedPersona
        || result.active !== false || result.request_pending !== false) toast(t("friends.requestCancelError"));
      else {
        followRequestMutationKeys.delete(`cancel:${targetId}:${selectedPersona}`);
        toast(t("friends.requestCancelled"));
      }
      loadSocialFriendsList("requests");
    }));
    return;
  }
  let people = [];
  const viewerId = Number(state.user.id);
  const result = await api("/api/social/relations?kind=" + encodeURIComponent(kind) + "&cursor=0").catch(() => null);
  if (!stillCurrent()) return;
  const validPeople = isSafeSocialRelationsPage(result, { kind, cursor: "0", viewerId, viewerPersona: selectedPersona });
  if (!validPeople) {
    host.innerHTML = '<div class="friendsEmpty error"><b>' + esc(t("friends.relationsLoadFailed")) + '</b><span>' + esc(t("friends.relationsLoadFailedDetail")) + '</span><button type="button" data-relations-retry>' + esc(t("common.retry")) + '</button></div>';
    host.querySelector("[data-relations-retry]")?.addEventListener("click", () => loadSocialFriendsList(kind));
    return;
  }
  people = result.people;
  if (kind === "favorites") {
    const favoriteIds = readSocialFavorites();
    people = people.filter((person) => favoriteIds.includes(Number(person.user_id || person.id)));
  }
  if (!people.length && !result.next_cursor) {
    host.innerHTML = '<div class="friendsEmpty"><b>' + esc(t(kind === "favorites" ? "friends.emptyFavorites" : "friends.empty")) + '</b><span>' + esc(t("friends.emptyDetail")) + '</span></div>';
    return;
  }
  const favorites = readSocialFavorites();
  const friendRowsMarkup = (rows, pageCursor) => rows.map((person) => {
    const id = Number(person.user_id || person.id);
    const isFavorite = favorites.includes(id) || person.favorite;
    const name = person.name || person.display_name || person.handle || "Nexus";
    const initials = name.slice(0, 2).toUpperCase();
    const avatarUrl = safeInternalMediaUrl(person.avatar);
    const relationKey = { followers: "header.followers", following: "header.following", favorites: "header.favorites" }[person.relation || kind];
    const relationLabel = relationKey ? t(relationKey) : (person.relation || kind);
    return '<article class="friendRow" data-relation-page="' + esc(pageCursor) + '" data-friend-id="' + id + '"><i>' + (avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(initials)) + '</i><span><b>' + usernameSigil(person, "social") + '<bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(person.handle || "user") + '</bdi> · ' + esc(relationLabel) + '</small></span><button type="button" data-friend-star="' + id + '" class="' + (isFavorite ? "active" : "") + '" aria-label="' + esc(t(isFavorite ? "friends.removeFavorite" : "friends.addFavorite")) + '">★</button></article>';
  }).join("");
  const moreButtonMarkup = (cursor) => cursor ? '<button class="friendsMore" type="button" data-relations-more="' + esc(cursor) + '">' + esc(t("search.more")) + '</button>' : '';
  host.innerHTML = (people.length ? friendRowsMarkup(people, "0") : '<div class="friendsEmpty"><b>' + esc(t("friends.emptyFavorites")) + '</b><span>' + esc(t("friends.emptyDetail")) + '</span></div>') + moreButtonMarkup(result.next_cursor);
  const wireFavoriteButtons = (root) => root.querySelectorAll("[data-friend-star]").forEach((button) => button.addEventListener("click", () => {
      const id = Number(button.dataset.friendStar);
      const favoritesNow = readSocialFavorites();
      const active = !favoritesNow.includes(id);
      const saved = writeSocialFavorites(active ? [...favoritesNow, id] : favoritesNow.filter((item) => item !== id));
      if (!saved) return toast(t("friends.favoriteUpdateError"));
      button.classList.toggle("active", active);
      button.setAttribute("aria-label", t(active ? "friends.removeFavorite" : "friends.addFavorite"));
      if (socialFriendView === "favorites") loadSocialFriendsList("favorites");
    }));
  wireFavoriteButtons(host);
  const seenRelationIds = new Set(result.people.map((person) => Number(person.user_id)));
  host.querySelector("[data-relations-more]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const cursor = String(button.dataset.relationsMore || "");
    const pageRequest = socialFriendsLoadGate.begin();
    button.disabled = true;
    const page = await api("/api/social/relations?kind=" + encodeURIComponent(kind) + "&cursor=" + encodeURIComponent(cursor)).catch(() => null);
    if (!pageRequest.isCurrent() || !host.isConnected || Number(state.user.id) !== viewerId || state.persona !== selectedPersona || socialFriendView !== kind) return;
    if (!isSafeSocialRelationsPage(page, { kind, cursor, viewerId, viewerPersona: selectedPersona })) { button.disabled = false; return toast(t("friends.relationsLoadFailed")); }
    let pagePeople = page.people.filter((person) => !seenRelationIds.has(Number(person.user_id)));
    page.people.forEach((person) => seenRelationIds.add(Number(person.user_id)));
    if (kind === "favorites") { const favoriteIds = readSocialFavorites(); pagePeople = pagePeople.filter((person) => favoriteIds.includes(Number(person.user_id))); }
    if (pagePeople.length) {
      host.querySelector(".friendsEmpty")?.remove();
      button.insertAdjacentHTML("beforebegin", '<div data-relation-page-host="' + esc(cursor) + '">' + friendRowsMarkup(pagePeople, cursor) + '</div>');
      wireFavoriteButtons(host.querySelector('[data-relation-page-host="' + cursor + '"]'));
    }
    if (page.next_cursor) { button.dataset.relationsMore = page.next_cursor; button.disabled = false; }
    else { button.remove(); if (!host.querySelector(".friendRow")) host.innerHTML = '<div class="friendsEmpty"><b>' + esc(t("friends.emptyFavorites")) + '</b><span>' + esc(t("friends.emptyDetail")) + '</span></div>'; }
  });
}

function openSocialFriendsSwitcher() {
  if (document.getElementById("socialFriendsSwitcherBackdrop")) return closeSocialFriendsSwitcher();
  closeSocialFeedSwitcher();
  closeProfileSwitcher();
  const vp = document.getElementById("screenViewport");
  const tabs = [["followers", t("header.followers")], ["following", t("header.following")], ["favorites", t("header.favorites")], ["requests", t("header.requests")]];
  vp.insertAdjacentHTML("beforeend", '<div class="switcherBackdrop socialFriendsSwitcherBackdrop" id="socialFriendsSwitcherBackdrop"><section class="switcherSheet socialFriendsSheet" role="region" aria-labelledby="socialFriendsTitle" tabindex="-1"><header><span><small>' + esc(t("friends.sheetEyebrow")) + '</small><b id="socialFriendsTitle">' + esc(t("friends.sheetTitle")) + '</b></span><button type="button" aria-label="' + esc(t("common.close")) + '">×</button></header><nav class="friendsTabs" aria-label="' + esc(t("friends.tabsAria")) + '">' + tabs.map(([id, label]) => '<button type="button" data-friends-kind="' + id + '" class="' + (socialFriendView === id ? "active" : "") + '">' + esc(label) + '</button>').join("") + '</nav><div id="social-friends-list"></div></section></div>');
  const backdrop = document.getElementById("socialFriendsSwitcherBackdrop");
  const dialog = backdrop.querySelector(".switcherSheet");
  dialog.querySelector("header button").addEventListener("click", closeSocialFriendsSwitcher);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeSocialFriendsSwitcher(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSocialFriendsSwitcher(); });
  dialog.querySelectorAll("[data-friends-kind]").forEach((button) => button.addEventListener("click", () => loadSocialFriendsList(button.dataset.friendsKind)));
  dialog.focus();
  loadSocialFriendsList(socialFriendView);
}

function openSocialFeedSwitcher() {
  if (document.getElementById("socialFeedSwitcherBackdrop")) return closeSocialFeedSwitcher();
  closeSocialFriendsSwitcher();
  closeProfileSwitcher();
  const vp = document.getElementById("screenViewport");
  const activeKey = currentSocialFeedKey();
  const primaryOptions = [
    ["for-you", "✦", t("feed.mix"), t("feed.forYouSelectorDetail")],
    ["local", "⌖", t("feed.local"), t("feed.localSelectorDetail")],
    ["global", "◉", t("feed.global"), t("feed.globalSelectorDetail")],
    ["following", "✓", t("feed.following"), t("feed.followingSelectorDetail")],
    ["breaking", "!", t("feed.breaking"), t("feed.breakingSelectorDetail")],
  ];
  const formatOptions = [
    ["photos", "▧", t("feed.photos"), t("feed.photosSelectorDetail")],
    ["tweets", "T", t("feed.tweets"), t("feed.tweetsSelectorDetail")],
    ["friends", "◎", t("feed.friends"), t("feed.friendsSelectorDetail")],
    ["private", "$", t("feed.private"), t("feed.privateSelectorDetail")],
  ];
  const optionMarkup = ([id, icon, label, detail]) => '<button type="button" data-social-feed="' + id + '" class="' + (activeKey === id ? "active" : "") + '"><i>' + icon + '</i><span><b>' + esc(label) + '</b><small>' + esc(detail) + '</small></span><em>›</em></button>';
  vp.insertAdjacentHTML("beforeend", '<div class="switcherBackdrop socialFeedSwitcherBackdrop" id="socialFeedSwitcherBackdrop"><section class="switcherSheet socialFeedSheet" role="region" aria-labelledby="socialFeedTitle" tabindex="-1"><header><span><small>' + esc(t("feed.sheetEyebrow")) + '</small><b id="socialFeedTitle">' + esc(t("feed.sheetTitle")) + '</b></span><button type="button" aria-label="' + esc(t("common.close")) + '">×</button></header><div class="feedPrimaryLabel">' + esc(t("feed.quickChannels")) + '</div><div class="switcherGrid feedPrimaryGrid">' + primaryOptions.map(optionMarkup).join("") + '</div><details class="feedAdvanced"><summary>' + esc(t("feed.moreFormats")) + '</summary><div class="switcherGrid">' + formatOptions.map(optionMarkup).join("") + '</div><div class="socialPresentationPicker" role="group" aria-label="' + esc(t("profile.settingPresentation")) + '"><span><b>' + esc(t("profile.settingPresentation")) + '</b><small>' + esc(t("feed.presentationNote")) + '</small></span><button type="button" data-social-presentation="immersive" class="' + (socialPresentation === "immersive" ? "active" : "") + '">' + esc(t("profile.presentationImmersive")) + '</button><button type="button" data-social-presentation="cards" class="' + (socialPresentation === "cards" ? "active" : "") + '">' + esc(t("profile.presentationCards")) + '</button></div><div class="socialPresentationPicker mediaFitPicker" role="group" aria-label="' + esc(t("profile.settingMediaFit")) + '"><span><b>' + esc(t("profile.settingMediaFit")) + '</b><small>' + esc(t("feed.mediaFitNote")) + '</small></span><button type="button" data-social-media-fit="fill" class="' + (socialMediaFit === "fill" ? "active" : "") + '">' + esc(t("profile.fitFill")) + '</button><button type="button" data-social-media-fit="fit" class="' + (socialMediaFit === "fit" ? "active" : "") + '">' + esc(t("profile.fitFit")) + '</button></div></details></section></div>');
  const backdrop = document.getElementById("socialFeedSwitcherBackdrop");
  const dialog = backdrop.querySelector(".switcherSheet");
  dialog.querySelector("header button").addEventListener("click", closeSocialFeedSwitcher);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeSocialFeedSwitcher(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSocialFeedSwitcher(); });
  dialog.querySelectorAll("[data-social-feed]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.socialFeed;
    closeSocialFeedSwitcher();
    activateSocialFeed(next);
  }));
  dialog.querySelectorAll("[data-social-presentation]").forEach((button) => button.addEventListener("click", () => {
    setSocialPresentation(button.dataset.socialPresentation);
    closeSocialFeedSwitcher();
    renderView();
  }));
  dialog.querySelectorAll("[data-social-media-fit]").forEach((button) => button.addEventListener("click", () => {
    setSocialMediaFit(button.dataset.socialMediaFit);
    closeSocialFeedSwitcher();
    renderView();
  }));
  dialog.focus();
}

function activateSocialTop(view) {
  if (!new Set(["mix", "friends", "search"]).has(view)) return;
  stopComposerCamera();
  activeModule = "clips";
  activeSlot = "primary";
  socialTopView = view;
  if (view === "mix") {
    socialLens = "for-you";
    if (socialFormat === "following") socialFormat = "clips";
  } else if (view === "friends") {
    socialLens = "for-you";
    socialFormat = "following";
  }
  renderRail();
  renderHeader();
  renderNav();
  renderInfoPanel();
  renderView();
}

function closeSocialDiscover() {
  document.getElementById("socialDiscoverBackdrop")?.remove();
}

function openSocialDiscover() {
  closeSocialDiscover();
  const vp = document.getElementById("screenViewport");
  const options = [
    ["near", "⌖", "Near", "Din regiunea aleasă de tine; fără GPS implicit"],
    ["global", "◉", "Global", "Conținut organic relevant din toată rețeaua"],
    ["breaking", "!", "Breaking", "Doar surse verificate; momentan providerul este oprit"],
  ];
  vp.insertAdjacentHTML("beforeend", '<div class="socialDiscoverBackdrop" id="socialDiscoverBackdrop"><section class="socialDiscoverSheet" role="dialog" aria-modal="true" aria-labelledby="socialDiscoverTitle" tabindex="-1"><header><span><small>DESCOPERĂ</small><b id="socialDiscoverTitle">Alege perspectiva feedului</b></span><button type="button" aria-label="Închide">×</button></header><div>' + options.map(([id, icon, label, detail]) => '<button type="button" data-discover-lens="' + id + '" class="' + (socialTopView === "discover" && socialLens === id ? "active" : "") + '"><i>' + icon + '</i><span><b>' + label + '</b><small>' + detail + '</small></span><em>›</em></button>').join("") + '</div><p>Mix și Prieteni rămân separate. Breaking nu afișează știri fabricate când sursa semnată lipsește.</p></section></div>');
  const backdrop = document.getElementById("socialDiscoverBackdrop");
  const dialog = backdrop.querySelector(".socialDiscoverSheet");
  dialog.querySelector("header button").addEventListener("click", closeSocialDiscover);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeSocialDiscover(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSocialDiscover(); });
  dialog.querySelectorAll("[data-discover-lens]").forEach((button) => button.addEventListener("click", () => {
    socialTopView = "discover";
    socialLens = button.dataset.discoverLens;
    if (socialFormat === "following") socialFormat = "clips";
    activeModule = "clips";
    activeSlot = "primary";
    closeSocialDiscover();
    renderHeader();
    renderNav();
    renderView();
  }));
  dialog.focus();
}

function closeSigilSwitcher() {
  document.getElementById("sigilSwitcherBackdrop")?.remove();
}

async function saveOrbitStatus(orbitStatus = {}) {
  const expiresHours = Math.max(1, Math.min(168, Number(orbitStatus.expires_hours) || 24));
  const hasOrbit = Boolean(orbitStatus.mood || orbitStatus.place || orbitStatus.now || orbitStatus.fandom || orbitStatus.quote);
  const localOrbit = {
    mood: orbitStatus.mood || null, place: orbitStatus.place || null, now: orbitStatus.now || null,
    fandom: orbitStatus.fandom || null, quote: orbitStatus.quote || null,
    expiresAt: hasOrbit ? Date.now() + expiresHours * 60 * 60 * 1000 : null,
  };
  const result = await api("/api/persona/" + state.persona, { method: "PATCH", body: {
    orbit_status: { ...orbitStatus, expires_hours: expiresHours },
  } });
  if (!result.ok) return toast(result.error || "Statusul Orbit nu a putut fi salvat");
  writeOrbitCache(state.persona, localOrbit);
  const savedPersona = {
    ...(result.persona || activePersonaRecord()),
    orbit_mood: localOrbit.mood, orbit_place: localOrbit.place, orbit_now: localOrbit.now,
    orbit_fandom: localOrbit.fandom, orbit_quote: localOrbit.quote, orbit_expires_at: localOrbit.expiresAt,
  };
  state.profiles = state.profiles.map((profile) => profile?.persona === state.persona ? savedPersona : profile);
  closeSigilSwitcher();
  renderHeader();
  renderView();
  toast("Status Orbit actualizat ✓");
}

function openSigilSwitcher() {
  closeSigilSwitcher();
  const current = activePersonaRecord();
  const sigil = earnedSigilFor(null, state.persona);
  const modeColor = profileById(state.persona)[4];
  const currentOrbit = activeOrbitStatus(current).active ? current : {};
  const familyLabel = sigil.family === "business" ? "Business" : "Creator";
  const progressLabel = sigil.nextThreshold ? sigil.qualifiedFollowers.toLocaleString("ro-RO") + " / " + sigil.nextThreshold.toLocaleString("ro-RO") : "Nivel maxim";
  document.getElementById("screenViewport").insertAdjacentHTML("beforeend", [
    '<div class="sigilSwitcherBackdrop" id="sigilSwitcherBackdrop">',
    '<section class="sigilSwitcher earnedSigilSheet" role="dialog" aria-modal="true" aria-labelledby="sigilSwitcherTitle" tabindex="-1" style="--sigil-color:' + modeColor + '">',
    '<header class="' + (sigil.earned ? "" : "noSigil") + '"><span><small>STATUS CREATOR · AUTOMAT</small><b id="sigilSwitcherTitle">' + (sigil.earned ? familyLabel + ' ' + esc(sigil.tierName) : "Progres către primul Sigil") + '</b><em>' + (sigil.earned ? "Câștigat organic · nu poate fi cumpărat" : "Sigilul apare numai după atingerea pragului") + '</em></span>' + (sigil.earned ? '<output class="level' + sigil.level + '">' + sigil.icon + '</output>' : '') + '<button type="button" aria-label="Închide">×</button></header>',
    '<section class="sigilProgressCard"><div><span><small>FOLLOWERS ELIGIBILI</small><b>' + progressLabel + '</b></span><em>' + (sigil.progressBps / 100).toFixed(1) + '%</em></div><progress max="10000" value="' + Math.max(0, Math.min(10000, sigil.progressBps)) + '"></progress><p>' + (sigil.eligibility === "BUSINESS_VERIFICATION_REQUIRED" ? 'Pagina Business trebuie verificată înainte de activarea simbolului $.' : 'Contează numai followers unici HUMAN_ORGANIC; boții, testele, paid și incentivized sunt excluși.') + '</p></section>',
    '<div class="sigilTierRail">' + SIGIL_LEVELS.map(([level, threshold, name]) => '<span class="' + (sigil.level >= level ? 'reached' : '') + '"><i>' + sigil.icon + '</i><b>' + esc(name) + '</b><small>' + threshold.toLocaleString("ro-RO") + '</small></span>').join('') + '</div>',
    '<p class="sigilTruth">V1 local verifică followers organici și unicitatea. În producție, activarea rămâne blocată până când fraud-graph, vechimea, blocările și auditul independent sunt operaționale.</p>',
    '<form id="orbitStatusForm" class="orbitStatusForm"><header><span><b>Orbit · expresie temporară</b><small>Separat de Sigil și fără efect asupra rankingului</small></span><button type="button" id="clearOrbitStatus">Curăță</button></header>',
    '<div class="orbitStatusGrid"><label>Mood<select name="mood"><option value="">Fără mood</option>' + ORBIT_MOODS.map(([code, icon, label]) => '<option value="' + code + '"' + (currentOrbit.orbit_mood === code ? ' selected' : '') + '>' + icon + ' ' + esc(label) + '</option>').join('') + '</select></label>',
    '<label>Oraș / loc<input name="place" maxlength="40" value="' + esc(currentOrbit.orbit_place || '') + '" placeholder="ales manual · opțional" /></label>',
    '<label>Echipă / fandom<input name="fandom" maxlength="60" value="' + esc(currentOrbit.orbit_fandom || '') + '" placeholder="ex. club, artist, univers" /></label>',
    '<label>Acum urmăresc / ascult<input name="now" maxlength="60" value="' + esc(currentOrbit.orbit_now || '') + '" placeholder="serial, film, joc, melodie" /></label>',
    '<label class="orbitQuote">Gând / proverb / zicală<input name="quote" maxlength="120" value="' + esc(currentOrbit.orbit_quote || '') + '" placeholder="Ce idee te reprezintă acum?" /></label>',
    '<label>Expiră<select name="expires_hours"><option value="1">1 oră</option><option value="24" selected>24 ore</option><option value="72">3 zile</option><option value="168">7 zile</option></select></label></div>',
    '<p>Nexus nu detectează automat orașul și nu publică GPS/IP. Numele de echipe sau seriale sunt text ales de tine, nu badge oficial ori logo licențiat.</p></form>',
    '<div class="orbitActions"><button type="button" id="cancelOrbit">Renunță</button><button type="button" id="saveOrbit">Salvează statusul Orbit</button></div>',
    '</section></div>',
  ].join(""));
  const backdrop = document.getElementById("sigilSwitcherBackdrop");
  const dialog = backdrop.querySelector(".sigilSwitcher");
  dialog.querySelector("header>button").addEventListener("click", closeSigilSwitcher);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeSigilSwitcher(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSigilSwitcher(); });
  document.getElementById("clearOrbitStatus").addEventListener("click", () => {
    const form = document.getElementById("orbitStatusForm");
    for (const name of ["mood", "place", "fandom", "now", "quote"]) form.elements[name].value = "";
    form.elements.expires_hours.value = "24";
  });
  document.getElementById("cancelOrbit").addEventListener("click", closeSigilSwitcher);
  document.getElementById("saveOrbit").addEventListener("click", () => {
    const data = new FormData(document.getElementById("orbitStatusForm"));
    saveOrbitStatus({ mood: data.get("mood"), place: data.get("place"), fandom: data.get("fandom"), now: data.get("now"), quote: data.get("quote"), expires_hours: Number(data.get("expires_hours")) });
  });
  dialog.focus();
}

function closeProfileSwitcher() {
  document.getElementById("profileSwitcherBackdrop")?.remove();
}

function openProfileSwitcher() {
  if (document.getElementById("profileSwitcherBackdrop")) return closeProfileSwitcher();
  closeSocialFeedSwitcher();
  closeSocialFriendsSwitcher();
  const vp = document.getElementById("screenViewport");
  vp.insertAdjacentHTML("beforeend", [
    '<div class="profileSwitcherBackdrop" id="profileSwitcherBackdrop">',
    '<section class="profileSwitcher" role="region" aria-labelledby="profileSwitcherTitle" tabindex="-1">',
    '<header><span><small>NEXUS ' + esc(profileById(state.persona)[1].toUpperCase()) + '</small><b id="profileSwitcherTitle">Profiluri și aplicații Nexus</b></span><button type="button" aria-label="Închide">×</button></header>',
    '<h3 class="profileSwitcherSectionTitle">PROFILE INDEPENDENTE</h3>',
    '<div>' + PROFILES.map((profile) => {
      const [id, name, detail, icon, color] = profile;
      const saved = state.profiles.find((item) => item?.persona === id) || {};
      const visual = saved.avatar ? '<img src="' + esc(saved.avatar) + '" alt="" />' : '<strong>' + esc(String(saved.name || name).slice(0, 2).toUpperCase()) + '</strong>';
      return '<button type="button" data-switch-persona="' + id + '" class="' + (id === state.persona ? "active" : "") + '"><i style="--profile-color:' + color + '">' + visual + '</i><span><b>' + name + '</b><small>' + esc(saved.name || detail) + '</small></span><em>' + (id === state.persona ? "Activ" : "›") + '</em></button>';
    }).join("") + '</div>',
    '<h3 class="profileSwitcherSectionTitle">APLICAȚII NEXUS</h3>',
    '<div class="profileHubGrid">' + MODULES.filter((module) => GLOBAL_HUB_IDS.has(module[0])).map((module) => {
      const [id, icon, name, category, color] = module;
      return '<button type="button" data-switch-module="' + id + '" class="' + (id === activeModule ? "active" : "") + '"><i style="--profile-color:' + color + '"><strong>' + esc(icon) + '</strong></i><span><b>' + esc(name) + '</b><small>' + esc(category) + '</small></span><em>' + (id === activeModule ? "Deschis" : "›") + '</em></button>';
    }).join("") + '</div><p>Profilele păstrează separat avatarul, bio, privacy și relațiile. Aplicațiile folosesc identitatea Nexus activă fără a combina datele private dintre moduri.</p>',
    // Wave 14b: the feed destinations and both display choices live here now, since the lens line left
    // the feed. Markup and wiring come from the feed module.
    ...(state.persona === "social" ? [feedSourceSectionMarkup({ t, esc, current: currentSocialFeedKey(), presentation: socialPresentation, mediaFit: socialMediaFit })] : []),
    feedDrawerEndMarkup({ t, esc }),
    '</section></div>',
  ].join(""));
  const backdrop = document.getElementById("profileSwitcherBackdrop");
  const dialog = backdrop.querySelector(".profileSwitcher");
  const close = closeProfileSwitcher;
  if (state.persona === "social") {
    bindFeedSourceSection(dialog, {
      onDestination: (feed) => { close(); activateSocialFeed(feed); },
      onPresentation: () => { setSocialPresentation(socialPresentation === "immersive" ? "cards" : "immersive"); close(); renderView(); },
      onFit: () => { setSocialMediaFit(socialMediaFit === "fit" ? "fill" : "fit"); close(); renderView(); },
    });
  }
  dialog.querySelector("header button").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  dialog.querySelectorAll("[data-switch-persona]").forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.switchPersona === state.persona) return close();
    button.disabled = true;
    await switchPersona(button.dataset.switchPersona);
  }));
  dialog.querySelectorAll("[data-switch-module]").forEach((button) => button.addEventListener("click", () => {
    activeModule = button.dataset.switchModule;
    activeSlot = "primary";
    close();
    renderRail();
    renderHeader();
    renderNav();
    renderInfoPanel();
    renderView();
  }));
  // The last row of the drawer ends the session. The drawer closes first, so the dialog that asks the
  // reader to confirm is not behind the sheet that opened it.
  dialog.querySelector("[data-profile-logout]")?.addEventListener("click", () => { close(); void logoutFromProfile(); });
  dialog.focus();
}

function goHome() {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(goHome)) return;
  activeCameraExit = null;
  dismissCommentOverlay({ fromHistory: true, restoreFocus: false });
  closeMediaViewer({ fromHistory: true });
  closeSocialFeedSwitcher();
  closeSocialFriendsSwitcher();
  closeProfileSwitcher();
  stopLiveMedia();
  stopComposerCamera();
  clearComposerPreviewUrl();
  activeSlot = "primary";
  if (state.persona === "social") {
    activeModule = "clips";
    socialTopView = "mix";
    socialLens = "for-you";
    socialFormat = "clips";
    // Home is the feed at its first reading, not the last mode the reader happened to be in.
    feedMode = "reels";
    reelsLensFeed = "for-you";
  } else {
    activeModule = state.persona === "travel" ? "stay" : state.persona;
  }
  renderRail();
  renderHeader();
  renderNav();
  renderInfoPanel();
  renderView();
}

function renderNav() {
  const box = document.getElementById("phoneNav");
  const items = NAV[state.persona] || NAV.social;
  const persona = activePersonaRecord();
  box.innerHTML = '<nav class="appNav ' + esc(state.persona) + '" aria-label="navigation">' + items.map(([slot, icon, fallbackLabel]) => {
    const label = NAV_LABEL_KEYS[slot] ? t(NAV_LABEL_KEYS[slot]) : state.persona === "social" ? t("nav." + slot) : fallbackLabel;
    const unreadCount = Math.min(9999, unreadMessageCount + unreadActivityCount);
    const unread = slot === "inbox" && unreadCount > 0;
    // The last mark is the reader: the picture of the persona being read, when there is one.
    const mark = navFaceMarkup({ esc, persona, slot, icon });
    // The `menu` mark opens the drawer: it is not a place, so it carries the hook `bindFeedHub` looks for.
    const drawer = slot === "menu" ? ' data-feed-quick-open aria-haspopup="dialog" aria-expanded="false"' : "";
    return '<button data-slot="' + slot + '"' + drawer + ' aria-label="' + esc(label + (unread ? ", " + unreadCount + " " + t("nav.unread") : "")) + '" class="' + (slot === activeSlot ? "active" : "") + (slot === "create" ? " createNav" : "") + (unread ? " hasUnread" : "") + '"><i' + (slot === "account" ? ' style="border-radius:50%;overflow:hidden"' : "") + '>' + mark + (unread ? '<b class="navBadge">' + Math.min(unreadCount, 99) + '</b>' : '') + '</i><span>' + esc(label) + '</span></button>';
  }).join("") + '</nav>';
  box.querySelectorAll("[data-slot]").forEach((b) => b.addEventListener("click", () => {
    // The drawer and the relations are not screens: neither moves the reader, and neither is a slot.
    if (b.dataset.slot === "menu") return;
    if (b.dataset.slot === "friends") { openSocialFriendsSwitcher(); return; }
    navigate(b.dataset.slot);
  }));
}

function renderInfoPanel() {
  const m = moduleById(activeModule);
  const p = profileById(state.persona);
  const box = document.getElementById("infoPanel");
  box.innerHTML = [
    '<span class="infoIcon" style="color:' + m[4] + '">' + m[1] + '</span>',
    '<small>' + esc(state.persona.toUpperCase()) + ' MODE · ' + m[3] + '</small>',
    '<h1>Nexus ' + m[2] + '</h1>',
    '<p>' + esc(m[5]) + '</p>',
    '<div class="modeArchitecture"><b>MODE NAVIGATION</b><span>' + (NAV[state.persona] || NAV.social).map((n) => n[2]).join(" · ") + '</span><small>Messages stay second in every profile. Create adapts to the active mode.</small></div>',
    '<div class="infoFeatures">' + m[6].map((f) => '<div>✓ ' + esc(f) + '</div>').join("") + '</div>',
    '<section class="freeSupport"><div><i>♡</i><span><b>FREE ENGAGEMENT</b><small>React, comment, share and follow.</small></span></div><div><i>$</i><span><b>OPTIONAL SUPPORT</b><small>Direct creator support.</small></span></div></section>',
    '<button class="infoCreate" id="infoCreate">Create in ' + p[1] + '</button>',
    '<button class="infoCreate" id="devnetBtn">◈ Vezi acțiunile devnet</button>',
    '<div class="honest"><b>STATUS</b><span>Local full-stack product · real persistence · devnet proofs · providers via .env</span></div>',
  ].join("");
  document.getElementById("infoCreate").addEventListener("click", () => openCreateHub());
  document.getElementById("devnetBtn").addEventListener("click", () => renderDevnet());
}

function selectModule(id) {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(() => selectModule(id))) return;
  if (id === 'chat' && activeModule !== 'chat') inboxFilter = state.persona;
  stopLiveMedia();
  stopComposerCamera();
  activeModule = id;
  renderRail();
  renderHeader();
  renderNav();
  renderInfoPanel();
  renderView();
}

// Pe Android, shell-ul nativ (`apps/nexus-mobile`) deschide camera nativă full-screen
// (`/camera`) în locul celei web, pe care WebView-ul o redă cu benzi negre sus și jos:
// flagul `__NEXUS_SHELL__` este injectat înainte de încărcarea scripturilor.
const NATIVE_CAMERA_SOURCES = new Set(["camera", "clip_camera", "story_camera"]);

function isNexusShell() {
  return typeof window !== "undefined" && window.__NEXUS_SHELL__ === true;
}

function requestNativeCamera(source) {
  if (!isNexusShell()) return false;
  const bridge = window.ReactNativeWebView;
  if (!bridge || typeof bridge.postMessage !== "function") return false;
  bridge.postMessage(JSON.stringify({ type: "nexus:open-camera", source: source || "camera" }));
  return true;
}

function navigate(slot) {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(() => navigate(slot))) return;
  feedHub?.close();
  closeSocialFeedSwitcher();
  closeSocialFriendsSwitcher();
  closeProfileSwitcher();
  if (slot !== "inbox") {
    threadLoadGate.invalidate();
    revokeDecryptedAttachmentUrls();
    activeConversationId = null;
  }
  activeSlot = slot;
  if (slot === "create") { openComposer("post", { camera: true, source: "camera" }); return; }
  if (slot === "primary") { goHome(); return; }
  renderNav();
  if (slot === "inbox") { inboxBox = "inbox"; inboxFilter = state.persona; activeConversationId = null; selectModule("chat"); }
  else if (slot === "account") selectModule("profiles");
  // Wave 14h: the search mark of the bottom bar opens the social search screen the bar has always had -
  // the same screen the live board and the header used to open - and it is a place, so it wears the mark.
  else if (slot === "search" && state.persona === "social") { activeModule = "clips"; socialTopView = "search"; renderHeader(); renderView(); }
  else if (slot === "utility") renderUtility();
}

function renderUtility() {
  const vp = document.getElementById("screenViewport");
  if (state.persona === "work") renderWorkWorkspace(vp, { api, toast, state }, "jobs");
  else if (state.persona === "dating") renderGenericScreen(vp, "Connections", "Matches, plans and safety.", ["New matches", "Conversations", "Date planned", "Serious Intent"]);
  else if (state.persona === "travel") renderGenericScreen(vp, "Trips", "Bookings and group plans.", ["Upcoming", "Group chat", "Split payment", "Itinerary"]);
  else if (state.persona === "market") renderGenericScreen(vp, "Orders", "Purchases, sales and offers.", ["All", "Buying", "Selling", "Escrow"]);
  else renderSocialLive(vp);
}

async function renderSocialLive(vp) {
  const selectedPersona = state.persona;
  const selectedTab = socialLiveTab;
  const request = socialLiveLoadGate.begin();
  const tabs = [["now", t("live.now")], ["following", t("live.following")], ["battle", t("live.battle")], ["championship", t("live.championships")]];
  vp.innerHTML = '<div class="screen scrollScreen socialLiveScreen"><header class="liveHero"><span><small>NEXUS SOCIAL</small><h2>Live</h2><p>' + esc(t("live.discoverySubtitle")) + '</p></span><button type="button" id="prepare-live"><i>●</i> ' + esc(t("live.start")) + '</button></header><div class="liveTabs" role="tablist" aria-label="' + esc(t("live.tabsLabel")) + '">' + tabs.map(([id,label]) => '<button type="button" role="tab" aria-selected="' + (socialLiveTab === id) + '" data-live-tab="' + id + '" class="' + (socialLiveTab === id ? "active" : "") + '">' + esc(label) + '</button>').join("") + '</div><div id="social-live-content"><div class="liveLoading" role="status">' + esc(t("live.loading")) + '</div></div><div id="social-live-sheet"></div></div>';
  document.querySelectorAll("[data-live-tab]").forEach((button) => button.addEventListener("click", () => { socialLiveTab = button.dataset.liveTab; renderSocialLive(vp); }));
  document.getElementById("prepare-live").addEventListener("click", () => openLiveSetupSheet());
  const result = await api("/api/social/live").catch(() => null);
  const host = document.getElementById("social-live-content");
  if (!request.isCurrent() || !host?.isConnected || state.persona !== selectedPersona || socialLiveTab !== selectedTab) return;
  const validLiveResult = result?.ok === true && Number(result.viewer_id) === Number(state.user.id)
    && result.viewer_persona === selectedPersona && result.privacy_enforced_server_side === true
    && result.transport?.status === "GATED_NO_SFU" && result.transport?.public_broadcast === false
    && result.transport?.provider_configured === false && result.synthetic_traffic_eligible === false
    && Array.isArray(result.live) && result.live.length <= 50
    && Array.isArray(result.creators) && result.creators.length <= 50
    && Array.isArray(result.competitions) && result.competitions.length <= 50
    && (!result.own_preview || (Number(result.own_preview.host_id) === Number(state.user.id)
      && result.own_preview.status === "preview" && result.own_preview.transport_status === "GATED_NO_SFU"));
  if (!validLiveResult) {
    host.innerHTML = '<div class="liveEmpty"><i>!</i><b>' + esc(t("live.unavailable")) + '</b><span>' + esc(t("live.unavailableDetail")) + '</span><button type="button" id="retry-live">' + esc(t("live.retry")) + '</button></div>';
    document.getElementById("retry-live").addEventListener("click", () => renderSocialLive(vp));
    return;
  }
  const allLive = Array.isArray(result.live) ? result.live.filter((session) => session && typeof session === "object") : [];
  const live = socialLiveTab === "following" ? allLive.filter((item) => item.is_following) : allLive;
  if (socialLiveTab === "now" || socialLiveTab === "following") {
    const cards = live.map((session, index) => { const handle = String(session.handle || ""); const displayName = String(session.display_name || handle || t("live.unknownCreator")); return '<article class="liveSessionCard"><div class="liveStage a' + (index % 4) + '"><span>LIVE</span><i>' + esc(displayName.slice(0, 2).toUpperCase()) + '</i><strong>◉ ' + Number(session.organic_viewers || 0).toLocaleString(interfaceLocale) + '</strong></div><header><span><b>' + usernameSigil(session, "social") + esc(displayName) + '</b><small>@' + esc(handle) + '</small></span><em>' + Number(session.qualified_followers || 0).toLocaleString(interfaceLocale) + ' ' + esc(t("live.followersCount")) + '</em></header><h3>' + esc(session.title || t("live.untitled")) + '</h3><p>' + esc(t("live.viewerPolicy")) + '</p></article>'; }).join("");
    const creators = (Array.isArray(result.creators) ? result.creators : []).filter((creator) => creator && typeof creator === "object" && (socialLiveTab !== "following" || creator.is_following)).slice(0, 8);
    host.innerHTML = (cards || '<div class="liveEmpty"><i>●</i><b>' + esc(socialLiveTab === "following" ? t("live.noneFollowing") : t("live.noneNow")) + '</b><span>' + esc(t("live.sessionAdmission")) + '</span></div>')
      + (creators.length ? '<section class="liveCreatorBoard"><header><span><small>' + esc(t("live.creatorsToWatch")) + '</small><b>' + esc(t("live.topEligible")) + '</b></span><em>' + esc(t("live.noPaidTest")) + '</em></header><div>' + creators.map((creator, index) => { const handle = String(creator.handle || ""); return '<button type="button" data-live-creator="' + esc(handle) + '"><i>' + (index + 1) + '</i><span><b>' + usernameSigil(creator, "social") + esc(creator.display_name || handle || t("live.unknownCreator")) + '</b><small>@' + esc(handle) + '</small></span><strong>' + Number(creator.qualified_followers || 0).toLocaleString(interfaceLocale) + '</strong></button>'; }).join("") + '</div></section>' : '')
      + '<p class="liveTruth">' + esc(t("live.rankingTruth")) + '</p>';
    host.querySelectorAll("[data-live-creator]").forEach((button) => button.addEventListener("click", () => {
      socialTopView = "search"; activeModule = "clips"; activeSlot = "primary"; renderHeader(); renderNav(); renderView();
      setTimeout(() => { const input = document.getElementById("social-search-input"); if (input) { input.value = button.dataset.liveCreator; document.getElementById("social-search-form")?.requestSubmit(); } }, 0);
    }));
  } else {
    const wanted = socialLiveTab;
    const competitions = (Array.isArray(result.competitions) ? result.competitions : []).filter((competition) => competition && competition.format === wanted);
    const statusLabels = { draft: t("live.statusDraft"), scheduled: t("live.statusScheduled"), live: "LIVE", completed: t("live.statusCompleted") };
    host.innerHTML = '<section class="competitionIntro"><span><small>' + (wanted === "battle" ? "1 VS 1" : "BRACKET") + '</small><h3>' + esc(wanted === "battle" ? t("live.nexusBattle") : t("live.nexusChampionships")) + '</h3><p>' + esc(wanted === "battle" ? t("live.battleDetail") : t("live.championshipDetail")) + '</p></span><button type="button" id="create-competition">＋ ' + esc(t("live.create")) + '</button></section>'
      + (competitions.length ? '<div class="competitionList">' + competitions.map((competition) => { const competitors = Array.isArray(competition.competitors) ? competition.competitors : []; const start = Number(competition.starts_at); const dateLabel = Number.isFinite(start) ? new Date(start * 1000).toLocaleString(interfaceLocale) : t("live.dateUnavailable"); return '<article><header><span><small>' + esc(statusLabels[String(competition.status || "").toLowerCase()] || t("live.statusUnknown")) + '</small><b>' + esc(competition.title || t("live.untitled")) + '</b></span><em>' + esc(dateLabel) + '</em></header><div class="bracketPreview">' + (competitors.length ? competitors.slice(0, 8).map((entry) => '<span><i>' + (Number.isInteger(Number(entry.seed)) ? Number(entry.seed) : "·") + '</i><b>@' + esc(entry.handle || "") + '</b><strong>' + Number(entry.organic_score || 0).toLocaleString(interfaceLocale) + '</strong></span>').join("") : '<p>' + esc(t("live.noParticipants")) + '</p>') + '</div><footer><span>' + esc(t("live.organicScore")) + '</span><b>' + esc(competition.prize_policy === "NO_PRIZE_CONFIGURED" ? t("live.noPrize") : t("live.prizeConfigured")) + '</b></footer></article>'; }).join("") + '</div>' : '<div class="liveEmpty"><i>◇</i><b>' + esc(wanted === "battle" ? t("live.noBattle") : t("live.noChampionship")) + '</b><span>' + esc(t("live.createDraftDetail")) + '</span></div>')
      + '<p class="liveTruth">' + esc(t("live.competitionTruth")) + '</p>';
    document.getElementById("create-competition").addEventListener("click", () => openCompetitionSheet(wanted));
  }
}

function stopLiveMedia({ invalidateRequest = true } = {}) {
  if (invalidateRequest) liveDeviceRequestGate.invalidate();
  if (activeLiveMeterFrame) cancelAnimationFrame(activeLiveMeterFrame);
  activeLiveMeterFrame = null;
  activeLiveAudioContext?.close?.().catch(() => {});
  activeLiveAudioContext = null;
  activeLiveStream?.getTracks().forEach((track) => track.stop());
  activeLiveStream = null;
  const preview = document.getElementById("liveDevicePreview");
  if (preview) preview.srcObject = null;
}

function updateLiveDeviceButtons() {
  const videoTrack = activeLiveStream?.getVideoTracks()[0];
  const audioTrack = activeLiveStream?.getAudioTracks()[0];
  const camera = document.getElementById("liveToggleCamera");
  const mic = document.getElementById("liveToggleMic");
  if (camera) { camera.classList.toggle("off", !videoTrack?.enabled); camera.textContent = t(videoTrack?.enabled ? "live.cameraOn" : "live.cameraOff"); camera.setAttribute("aria-pressed", String(Boolean(videoTrack?.enabled))); }
  if (mic) { mic.classList.toggle("off", !audioTrack?.enabled); mic.textContent = t(audioTrack?.enabled ? "live.micOn" : "live.micOff"); mic.setAttribute("aria-pressed", String(Boolean(audioTrack?.enabled))); }
}

function liveDeviceReady() {
  return Boolean(activeLiveStream?.active
    && activeLiveStream.getVideoTracks().some((track) => track.readyState === "live")
    && activeLiveStream.getAudioTracks().some((track) => track.readyState === "live"));
}

async function startLiveDeviceCheck(facingMode = "user") {
  const status = document.getElementById("liveDeviceStatus");
  const preview = document.getElementById("liveDevicePreview");
  const retry = document.getElementById("liveRetryDevice");
  if (!status || !preview) return false;
  const deviceRequest = liveDeviceRequestGate.begin();
  stopLiveMedia({ invalidateRequest: false });
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.innerHTML = '<b>' + esc(t("live.httpsRequired")) + '</b><span>' + esc(t("live.httpsDetail")) + '</span>';
    retry.hidden = false;
    const submit = document.getElementById("liveSavePreview");
    if (submit) submit.disabled = true;
    return false;
  }
  status.innerHTML = '<b>' + esc(t("live.requestingPermission")) + '</b><span>' + esc(t("live.requestingDetail")) + '</span>';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!deviceRequest.isCurrent() || !preview.isConnected) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    activeLiveStream = stream;
    stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
      if (activeLiveStream !== stream) return;
      updateLiveDeviceButtons();
      const save = document.getElementById("liveSavePreview");
      if (save) save.disabled = !liveDeviceReady();
      if (!liveDeviceReady() && status.isConnected) status.innerHTML = '<b>' + esc(t("live.deviceUnavailable")) + '</b><span>' + esc(t("live.deviceHelp")) + '</span>';
    }, { once: true }));
    preview.srcObject = activeLiveStream;
    preview.dataset.facing = facingMode;
    await preview.play().catch(() => {});
    retry.hidden = true;
    const submit = document.getElementById("liveSavePreview");
    if (submit) submit.disabled = false;
    const videoLabel = activeLiveStream.getVideoTracks()[0]?.label || t("live.cameraAvailable");
    const audioLabel = activeLiveStream.getAudioTracks()[0]?.label || t("live.micAvailable");
    status.innerHTML = '<b>' + esc(t("live.deviceReady")) + '</b><span>' + esc(videoLabel) + ' · ' + esc(audioLabel) + '</span><small>' + esc(t("live.localNotLive")) + '</small>';
    updateLiveDeviceButtons();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && activeLiveStream.getAudioTracks().length) {
      try {
        activeLiveAudioContext = new AudioCtx();
        const analyser = activeLiveAudioContext.createAnalyser();
        analyser.fftSize = 256;
        activeLiveAudioContext.createMediaStreamSource(activeLiveStream).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const meter = document.getElementById("liveMicMeter");
        const draw = () => {
          if (!activeLiveStream || !meter?.isConnected) return;
          analyser.getByteFrequencyData(values);
          const level = values.reduce((sum, value) => sum + value, 0) / values.length / 255;
          meter.style.setProperty("--mic-level", Math.max(2, Math.round(level * 100)) + "%");
          activeLiveMeterFrame = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        activeLiveAudioContext?.close?.().catch(() => {});
        activeLiveAudioContext = null;
      }
    }
    return true;
  } catch (error) {
    if (!deviceRequest.isCurrent()) return false;
    stopLiveMedia();
    const denied = error?.name === "NotAllowedError";
    status.innerHTML = '<b>' + esc(t(denied ? "live.permissionDenied" : "live.deviceUnavailable")) + '</b><span>' + esc(t(denied ? "live.permissionHelp" : "live.deviceHelp")) + '</span>';
    retry.hidden = false;
    const submit = document.getElementById("liveSavePreview");
    if (submit) submit.disabled = true;
    return false;
  }
}

function openLiveSetupSheet() {
  const host = document.getElementById("social-live-sheet");
  if (!host) return;
  const selectedPersona = state.persona;
  stopLiveMedia();
  host.innerHTML = '<div class="liveSheetBackdrop"><section class="liveSetupSheet liveDeviceSheet" role="dialog" aria-modal="true" aria-labelledby="liveSetupTitle" tabindex="-1"><header><span><small>' + esc(t("live.studioEyebrow")) + '</small><b id="liveSetupTitle">' + esc(t("live.setupTitle")) + '</b></span><button type="button" aria-label="' + esc(t("live.close")) + '">×</button></header><div class="livePreviewStage"><video id="liveDevicePreview" autoplay muted playsinline></video><span>' + esc(t("live.localNotLive")) + '</span><div id="liveMicMeter"><i></i></div></div><div class="liveDeviceControls"><button id="liveToggleCamera" type="button" aria-pressed="false">' + esc(t("live.camera")) + '</button><button id="liveToggleMic" type="button" aria-pressed="false">' + esc(t("live.microphone")) + '</button><button id="liveFlipCamera" type="button">' + esc(t("live.flip")) + '</button><button id="liveRetryDevice" type="button" hidden>' + esc(t("live.retry")) + '</button></div><div id="liveDeviceStatus" class="liveDeviceStatus" aria-live="polite"><b>' + esc(t("live.preparingDevice")) + '</b><span>' + esc(t("live.nothingBeforeConfirmation")) + '</span></div><form id="live-setup-form" data-preview-key="' + esc(newUploadMutationKey("live-preview")) + '"><label>' + esc(t("live.title")) + '<input name="title" minlength="3" maxlength="80" required placeholder="' + esc(t("live.titlePlaceholder")) + '" /></label><div class="liveFormGrid"><label>' + esc(t("live.category")) + '<select name="category"><option value="creator">' + esc(t("live.creator")) + '</option><option value="music">' + esc(t("live.music")) + '</option><option value="gaming">' + esc(t("live.gaming")) + '</option><option value="talk">' + esc(t("live.talk")) + '</option><option value="sport">' + esc(t("live.sport")) + '</option><option value="education">' + esc(t("live.education")) + '</option></select></label><label>' + esc(t("live.audience")) + '<select name="visibility"><option value="public">' + esc(t("live.public")) + '</option><option value="followers">' + esc(t("live.followers")) + '</option><option value="private" selected>' + esc(t("live.private")) + '</option></select></label><label>' + esc(t("live.language")) + '<input name="language" maxlength="10" placeholder="' + esc(interfaceLocale) + '" /></label><label class="liveCheck"><input name="comments" type="checkbox" checked /> ' + esc(t("live.commentsEnabled")) + '</label></div><button id="liveSavePreview" type="submit" disabled>' + esc(t("live.savePrivatePreview")) + '</button></form><p>' + esc(t("live.truth")) + '</p><div id="live-setup-result" aria-live="polite"></div></section></div>';
  let stopWhenHidden = null;
  const close = () => {
    if (stopWhenHidden) document.removeEventListener("visibilitychange", stopWhenHidden);
    stopLiveMedia();
    host.innerHTML = "";
  };
  host.querySelector("header button").addEventListener("click", close);
  host.querySelector(".liveSheetBackdrop").addEventListener("click", (event) => { if (event.target.classList.contains("liveSheetBackdrop")) close(); });
  host.querySelector(".liveSetupSheet").addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.getElementById("liveRetryDevice").addEventListener("click", () => startLiveDeviceCheck(document.getElementById("liveDevicePreview")?.dataset.facing || "user"));
  document.getElementById("liveFlipCamera").addEventListener("click", () => startLiveDeviceCheck(document.getElementById("liveDevicePreview")?.dataset.facing === "environment" ? "user" : "environment"));
  document.getElementById("liveToggleCamera").addEventListener("click", () => { const track = activeLiveStream?.getVideoTracks()[0]; if (track) track.enabled = !track.enabled; updateLiveDeviceButtons(); });
  document.getElementById("liveToggleMic").addEventListener("click", () => { const track = activeLiveStream?.getAudioTracks()[0]; if (track) track.enabled = !track.enabled; updateLiveDeviceButtons(); });
  stopWhenHidden = () => { if (document.hidden) close(); };
  document.addEventListener("visibilitychange", stopWhenHidden);
  document.getElementById("live-setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = document.getElementById("liveSavePreview");
    const data = new FormData(form);
    const output = document.getElementById("live-setup-result");
    if (!liveDeviceReady()) return output.textContent = t("live.checkRequired");
    if (submit.disabled) return;
    const previewKey = form.dataset.previewKey;
    submit.disabled = true;
    output.textContent = t("live.saving");
    try {
      const result = await api("/api/social/live/preview", { method: "POST", headers: { "Idempotency-Key": previewKey }, body: { title: data.get("title"), category: data.get("category"), visibility: data.get("visibility"), language: data.get("language") || "und", comments_enabled: data.get("comments") === "on" } });
      if (!output.isConnected || state.persona !== selectedPersona) return;
      const validPreview = result?.ok === true && Number(result.owner_id) === Number(state.user.id)
        && result.owner_persona === selectedPersona && result.action === "preview_saved"
        && Number(result.preview?.host_id) === Number(state.user.id) && result.preview?.status === "preview"
        && result.preview?.transport_status === "GATED_NO_SFU" && result.public_broadcast === false
        && result.viewer_counted === false;
      output.innerHTML = validPreview ? '<div class="liveGateResult"><b>✓ ' + esc(t("live.saved")) + '</b><span>' + esc(t("live.savedStatus")) + '</span><small>' + esc(t("live.session")) + ' #' + Number(result.preview.id) + '</small></div>' : '<div class="liveGateResult error"><b>' + esc(t("live.previewUnavailable")) + '</b><small>' + esc(t("live.genericError")) + '</small></div>';
    } catch {
      if (output.isConnected) output.innerHTML = '<div class="liveGateResult error"><b>' + esc(t("live.previewUnavailable")) + '</b><small>' + esc(t("live.genericError")) + '</small></div>';
    } finally {
      if (submit.isConnected) submit.disabled = !liveDeviceReady();
    }
  });
  document.getElementById("live-setup-form").addEventListener("input", (event) => { event.currentTarget.dataset.previewKey = newUploadMutationKey("live-preview"); });
  host.querySelector(".liveSetupSheet").focus();
  void startLiveDeviceCheck("user");
}

function openCompetitionSheet(format) {
  const host = document.getElementById("social-live-sheet");
  if (!host || !new Set(["battle", "championship"]).has(format)) return;
  const selectedPersona = state.persona;
  const toLocalInput = (milliseconds) => { const date = new Date(milliseconds); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
  const earliestMs = Date.now() + 10 * 60 * 1000;
  const earliest = toLocalInput(earliestMs);
  const latest = toLocalInput(Date.now() + 366 * 86400 * 1000);
  host.innerHTML = '<div class="liveSheetBackdrop"><section class="liveSetupSheet" role="dialog" aria-modal="true" aria-labelledby="competitionTitle" tabindex="-1"><header><span><small>' + esc(format === "battle" ? t("live.battle") : t("live.championship")) + '</small><b id="competitionTitle">' + esc(t("live.createDraft")) + '</b></span><button type="button" aria-label="' + esc(t("live.closeDraft")) + '">×</button></header><form id="competition-form" data-competition-key="' + esc(newUploadMutationKey("live-competition")) + '"><label>' + esc(t("live.title")) + '<input name="title" minlength="3" maxlength="80" required /></label><label>' + esc(t("live.startsAt")) + '<input name="starts_at" type="datetime-local" min="' + earliest + '" max="' + latest + '" value="' + earliest + '" required /></label><button type="submit">' + esc(t("live.saveDraft")) + '</button></form><p>' + esc(t("live.draftTruth")) + '</p><div id="competition-result" aria-live="polite"></div></section></div>';
  const close = () => { host.innerHTML = ""; };
  host.querySelector("header button").addEventListener("click", close);
  host.querySelector(".liveSheetBackdrop").addEventListener("click", (event) => { if (event.target.classList.contains("liveSheetBackdrop")) close(); });
  host.querySelector(".liveSetupSheet").addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.getElementById("competition-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    const data = new FormData(form);
    const output = document.getElementById("competition-result");
    const startsAt = new Date(String(data.get("starts_at") || ""));
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() + 5 * 60 * 1000 || startsAt.getTime() > Date.now() + 366 * 86400 * 1000) {
      output.textContent = t("live.invalidStart");
      return;
    }
    submit.disabled = true;
    const competitionKey = form.dataset.competitionKey;
    output.textContent = t("live.savingDraft");
    try {
      const result = await api("/api/social/live/competitions", { method: "POST", headers: { "Idempotency-Key": competitionKey }, body: { title: data.get("title"), format, starts_at: startsAt.toISOString() } });
      if (!output.isConnected || state.persona !== selectedPersona) return;
      const validDraft = result?.ok === true && Number(result.owner_id) === Number(state.user.id)
        && result.owner_persona === selectedPersona && result.action === "competition_draft_saved"
        && Number(result.competition?.owner_id) === Number(state.user.id) && result.competition?.format === format
        && result.competition?.status === "draft" && result.competition?.scoring_policy === "ORGANIC_ENGAGEMENT_V1"
        && result.competition?.prize_policy === "NO_PRIZE_CONFIGURED" && result.published === false
        && result.prize_escrow_configured === false;
      output.innerHTML = validDraft ? '<div class="liveGateResult"><b>✓ ' + esc(t("live.draftSaved")) + '</b><span>' + esc(t("live.notPublished")) + '</span><small>' + esc(t("live.publishRequirements")) + '</small></div>' : '<div class="liveGateResult error"><b>' + esc(t("live.invalidDraft")) + '</b><small>' + esc(t("live.genericError")) + '</small></div>';
    } catch {
      if (output.isConnected) output.innerHTML = '<div class="liveGateResult error"><b>' + esc(t("live.invalidDraft")) + '</b><small>' + esc(t("live.genericError")) + '</small></div>';
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  });
  document.getElementById("competition-form").addEventListener("input", (event) => { event.currentTarget.dataset.competitionKey = newUploadMutationKey("live-competition"); });
  host.querySelector(".liveSetupSheet").focus();
}

async function refreshMessageBadge() {
  const selectedUserId = Number(state?.user?.id);
  if (!Number.isSafeInteger(selectedUserId) || selectedUserId <= 0) return;
  const request = messageBadgeLoadGate.begin();
  const response = await api("/api/chat/conversations?persona=all&box=inbox").catch(() => null);
  if (!request.isCurrent() || Number(state?.user?.id) !== selectedUserId) return;
  const conversations = response?.conversations;
  const valid = Boolean(response?.ok && response.privacy_enforced_server_side === true
    && response.query?.persona === "all" && response.query?.box === "inbox"
    && Array.isArray(conversations) && conversations.length <= 100
    && new Set(conversations.map((conversation) => Number(conversation?.id))).size === conversations.length
    && conversations.every((conversation) => conversation && typeof conversation === "object"
      && Number.isSafeInteger(Number(conversation.id)) && Number(conversation.id) > 0
      && Number.isSafeInteger(Number(conversation.unread)) && Number(conversation.unread) >= 0 && Number(conversation.unread) <= 10_000));
  if (!valid) return;
  unreadMessageCount = Math.min(9999, conversations.reduce((total, conversation) => total + Number(conversation.unread), 0));
  if (document.getElementById("phoneNav")) renderNav();
}

async function refreshNotificationBadge() {
  const selectedUserId = Number(state?.user?.id);
  if (!Number.isSafeInteger(selectedUserId) || selectedUserId <= 0) return;
  const request = notificationBadgeLoadGate.begin();
  const response = await api("/api/notifications?persona=all").catch(() => null);
  if (!request.isCurrent() || Number(state?.user?.id) !== selectedUserId) return;
  const rows = response?.notifications;
  const valid = Boolean(response?.ok && Number(response.owner_id) === selectedUserId
    && response.privacy_enforced_server_side === true
    && Number(response.query?.viewer_id) === selectedUserId && response.query?.persona === "all"
    && response.persona === "all" && Array.isArray(rows) && rows.length <= 100
    && new Set(rows.map((row) => Number(row?.id))).size === rows.length
    && rows.every((row) => row && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0
      && PROFILES.some((profile) => profile[0] === row.persona) && NOTIFICATION_TYPES.has(row.type))
    && Number.isSafeInteger(Number(response.unread)) && Number(response.unread) >= 0 && Number(response.unread) <= 9999
    && Number.isSafeInteger(Number(response.unread_non_message)) && Number(response.unread_non_message) >= 0 && Number(response.unread_non_message) <= Number(response.unread));
  if (!valid) return;
  unreadActivityCount = Number(response.unread_non_message);
  if (document.getElementById("phoneNav")) renderNav();
}

function renderView() {
  if (document.getElementById("publicProfileSheet")) {
    document.getElementById("publicProfileSheet").discard?.();
    closeMediaViewer({ fromHistory: true, restoreFeed: false });
  }
  const vp = document.getElementById("screenViewport");
  if (state.persona === "social" && activeModule === "clips" && socialTopView === "search") {
    renderSocialSearch(vp);
    return;
  }
  switch (activeModule) {
    case "clips": case "signal": renderPulse(vp); break;
    case "market": renderMarket(vp); break;
    case "chat": renderMessages(vp); break;
    case "profiles": renderProfiles(vp); break;
    case "pay": renderPay(vp); break;
    case "prive": renderPrive(vp); break;
    case "dating": renderDating(vp); break;
    case "work": renderWork(vp); break;
    case "stay": renderStay(vp); break;
    case "ride": renderRide(vp); break;
    case "stream": renderWatch(vp); break;
    case "kids": renderKids(vp); break;
    case "music": renderMusic(vp); break;
    case "wellbeing": renderGrow(vp); break;
    case "creator": renderCreator(vp); break;
    case "node": renderNode(vp); break;
    default: renderGenericModule(vp, moduleById(activeModule)); break;
  }
}

function renderSocialSearch(vp) {
  vp.innerHTML = [
    '<div class="screen scrollScreen socialSearchScreen">',
    '<header><span><small>' + esc(t("search.eyebrow")) + '</small><h2>' + esc(t("search.title")) + '</h2></span><i>⌕</i></header>',
    '<form id="social-search-form" class="socialSearchForm"><label for="social-search-input">' + esc(t("search.label")) + '</label><div><input id="social-search-input" name="q" minlength="2" maxlength="80" autocomplete="off" autocapitalize="off" placeholder="' + esc(t("search.placeholder")) + '" /><button type="submit">' + esc(t("search.submit")) + '</button></div></form>',
    '<p class="socialSearchTruth">' + esc(t("search.privacyTruth")) + '</p>',
    '<div class="socialTrendsHost" id="social-trends"></div>',
    '<div id="social-search-results" aria-live="polite"><div class="socialSearchEmpty"><i>◇</i><b>' + esc(t("search.startTitle")) + '</b><span>' + esc(t("search.startDetail")) + '</span></div></div>',
    '</div>',
  ].join("");
  const form = document.getElementById("social-search-form");
  void loadSocialTrends(document.getElementById("social-trends"));
  const seenProfileIds = new Set();
  const seenPostIds = new Set();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get("q") || "").trim();
    const host = document.getElementById("social-search-results");
    if (query.length < 2) return toast(t("search.tooShort"));
    const request = socialSearchLoadGate.begin();
    const selectedPersona = state.persona;
    const viewerId = Number(state.user.id);
    host.innerHTML = '<div class="socialSearchLoading">' + esc(t("search.loading")) + '</div>';
    const result = await api("/api/social/search?q=" + encodeURIComponent(query) + "&cursor=0").catch(() => null);
    if (!request.isCurrent() || !host?.isConnected || Number(state.user.id) !== viewerId || state.persona !== selectedPersona || selectedPersona !== "social") return;
    const validResult = isSafeSocialSearchPage(result, { query, cursor: "0", viewerId, viewerPersona: selectedPersona });
    if (!validResult) {
      host.innerHTML = '<div class="socialSearchEmpty error"><i>!</i><b>' + esc(t("search.unavailable")) + '</b><span>' + esc(t("search.unavailableDetail")) + '</span><button type="button" id="search-retry">' + esc(t("common.retry")) + '</button></div>';
      host.querySelector("#search-retry")?.addEventListener("click", () => form.requestSubmit());
      return;
    }
    const profiles = result.profiles;
    const posts = result.posts;
    seenProfileIds.clear();
    seenPostIds.clear();
    profiles.forEach((profile) => seenProfileIds.add(Number(profile.id)));
    posts.forEach((post) => seenPostIds.add(Number(post.id)));
    if (!profiles.length && !posts.length) {
      host.innerHTML = '<div class="socialSearchEmpty"><i>⌕</i><b>' + esc(t("search.noResults")) + '</b><span>' + esc(t("search.noResultsDetail")) + '</span></div>';
      return;
    }
    host.innerHTML = (profiles.length ? '<section class="socialSearchProfiles"><h3>' + esc(t("search.people")) + '</h3>' + profiles.map((profile) => { const avatar = safeInternalMediaUrl(profile.avatar); return '<button type="button" data-search-page="0" data-search-profile="' + esc(profile.handle) + '"><i>' + (avatar ? '<img src="' + esc(avatar) + '" alt="" />' : esc(profile.name.slice(0, 2).toUpperCase())) + '</i><span><b>' + usernameSigil(profile, "social") + esc(profile.name) + '</b><small>@' + esc(profile.handle) + orbitStatusChip(profile, "social") + '</small></span><em>' + Number(profile.followers).toLocaleString(interfaceLocale) + ' ' + esc(t("search.followers")) + '</em></button>'; }).join("") + '</section>' : '')
      + (posts.length ? '<section class="socialSearchPosts"><h3>' + esc(t("search.content")) + '</h3><div data-search-post-page="0">' + posts.map(postCard).join("") + '</div></section>' : '')
      + (result.next_cursor ? '<button class="socialSearchMore" type="button" data-search-more="' + esc(result.next_cursor) + '">' + esc(t("search.more")) + '</button>' : '');
    host.querySelectorAll("[data-search-profile]").forEach((button) => button.addEventListener("click", () => openCreatorProfile(button.dataset.searchProfile)));
    if (posts.length) wirePostActions(host.querySelector(".socialSearchPosts"), posts);
    host.querySelector("[data-search-more]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const cursor = String(button.dataset.searchMore || "");
      const pageRequest = socialSearchLoadGate.begin();
      button.disabled = true;
      const page = await api("/api/social/search?q=" + encodeURIComponent(query) + "&cursor=" + encodeURIComponent(cursor)).catch(() => null);
      if (!pageRequest.isCurrent() || !host.isConnected || Number(state.user.id) !== viewerId || state.persona !== selectedPersona) return;
      if (!isSafeSocialSearchPage(page, { query, cursor, viewerId, viewerPersona: selectedPersona })) { button.disabled = false; return toast(t("search.unavailable")); }
      const newProfiles = page.profiles.filter((profile) => !seenProfileIds.has(Number(profile.id)));
      const newPosts = page.posts.filter((post) => !seenPostIds.has(Number(post.id)));
      newProfiles.forEach((profile) => seenProfileIds.add(Number(profile.id)));
      newPosts.forEach((post) => seenPostIds.add(Number(post.id)));
      if (newProfiles.length) {
        let section = host.querySelector(".socialSearchProfiles");
        if (!section) { host.insertAdjacentHTML("afterbegin", '<section class="socialSearchProfiles"><h3>' + esc(t("search.people")) + '</h3></section>'); section = host.querySelector(".socialSearchProfiles"); }
        section.insertAdjacentHTML("beforeend", newProfiles.map((profile) => { const avatar = safeInternalMediaUrl(profile.avatar); return '<button type="button" data-search-page="' + esc(cursor) + '" data-search-profile="' + esc(profile.handle) + '"><i>' + (avatar ? '<img src="' + esc(avatar) + '" alt="" />' : esc(profile.name.slice(0, 2).toUpperCase())) + '</i><span><b>' + usernameSigil(profile, "social") + esc(profile.name) + '</b><small>@' + esc(profile.handle) + orbitStatusChip(profile, "social") + '</small></span><em>' + Number(profile.followers).toLocaleString(interfaceLocale) + ' ' + esc(t("search.followers")) + '</em></button>'; }).join(""));
        section.querySelectorAll('[data-search-page="' + cursor + '"][data-search-profile]').forEach((profileButton) => profileButton.addEventListener("click", () => openCreatorProfile(profileButton.dataset.searchProfile)));
      }
      if (newPosts.length) {
        let section = host.querySelector(".socialSearchPosts");
        if (!section) { button.insertAdjacentHTML("beforebegin", '<section class="socialSearchPosts"><h3>' + esc(t("search.content")) + '</h3></section>'); section = host.querySelector(".socialSearchPosts"); }
        section.insertAdjacentHTML("beforeend", '<div data-search-post-page="' + esc(cursor) + '">' + newPosts.map(postCard).join("") + '</div>');
        wirePostActions(section.querySelector('[data-search-post-page="' + cursor + '"]'), newPosts);
      }
      if (page.next_cursor) { button.dataset.searchMore = page.next_cursor; button.disabled = false; }
      else button.remove();
    });
  });
  document.getElementById("social-search-input").focus();
}

// Wave 14 replaced the five-channel bar with the three-way switch above and the lens line under it:
// the lenses stayed (for-you, local, global, following), News moved up into the switch, and the sheet
// behind the last chip still names every destination. One control on this screen answers one question.

// Wave 14f: this screen is the column and nothing else - the shelf of moments is the Messages screen's tray
// and the rail of readings is on the bar - so a reading starts with a card.
function renderPulse(vp) {
  if (socialTopView === "private") return renderPrivateContent(vp);
  const mode = feedMode;
  vp.innerHTML = [
    '<div class="screen clipsScreen presentation-' + esc(socialPresentation) + ' media-fit-' + esc(socialMediaFit) + ' feed-' + esc(mode) + (socialTopView === "tweets" ? ' tweetsScreen' : '') + '">',
    '<div class="pullRefreshIndicator" id="pullRefreshIndicator" aria-live="polite"><i>↻</i><span>' + esc(t("feed.pullRefresh")) + '</span></div>',
    '<div class="pulsePosts" id="pulsePosts"></div>',
    '</div>',
  ].join("");
  loadFeed(document.getElementById("pulsePosts"));
}

function renderPrivateContent(vp) {
  const persona = activePersonaRecord();
  const price = Math.max(1, Math.round(Number(persona.private_access_price_cents || 100) / 100));
  const currency = persona.private_access_currency || "USD";
  const days = persona.private_access_duration_days || 15;
  const enabled = Boolean(persona.private_access_enabled);
  const sampleCreators = privateDemoCandidates();
  vp.innerHTML = [
    '<div class="screen scrollScreen privateContentScreen">',
    '<header class="privateContentHero"><span><small>PRIVATE CONTENT</small><h2>Conținut privat subscris</h2><p>Aici apar postările profilelor private pentru care ai acces activ pe zilele plătite.</p></span><i>$</i></header>',
    '<section class="privateAccessPreview"><header><span><small>PROFILUL TĂU</small><b>' + (enabled ? "Paywall activ" : "Paywall oprit") + '</b></span><em>' + price + ' ' + esc(currency) + ' / zi</em></header><p>Utilizatorul alege durata. Exemplu: ' + price + ' ' + esc(currency) + '/zi × ' + days + ' zile. Split standard: 90% creator, 10% Nexus.</p><button type="button" id="private-settings">Setări profil privat</button></section>',
    '<section class="privateSubscribedFeed"><h3>Conținut la care ai acces</h3><div id="private-feed-posts"><div class="friendsLoading">Se verifică receipts active…</div></div></section>',
    '<section class="privateCreatorList"><h3>Profile private disponibile</h3>' + (sampleCreators.length ? sampleCreators.map((person) => '<article><i>' + esc((person.name || person.handle).slice(0, 2).toUpperCase()) + '</i><span><b>' + usernameSigil(person, "social") + esc(person.name || person.handle) + '</b><small>@' + esc(person.handle || "creator") + ' · acces anonim' + (person.demo_private_hint ? ' · ' + esc(person.demo_private_hint) : '') + '</small></span><strong>' + money(Math.max(100, Number(person.demo_private_price_cents || 100)), person.demo_private_currency || "USD") + ' / zi</strong><button type="button" data-private-unlock="' + Number(person.user_id || person.id) + '" data-private-handle="' + esc(person.handle || "creator") + '">Deblochează</button></article>').join("") : '<div class="friendsEmpty"><b>Niciun profil privat descoperit încă</b><span>După ce urmărești creatori cu paywall, vor apărea aici.</span></div>') + '</section>',
    '<div id="private-access-sheet"></div>',
    '</div>',
  ].join("");
  document.getElementById("private-settings").addEventListener("click", () => selectModule("profiles"));
  document.querySelectorAll("[data-private-unlock]").forEach((button) => button.addEventListener("click", () => openPrivateAccessSheet(Number(button.dataset.privateUnlock), button.dataset.privateHandle)));
  loadPrivateSubscribedContent();
}

function privateDemoCandidates() {
  const organic = fallbackSocialRelations("following").slice(0, 4);
  if (organic.length) {
    return organic.map((person) => ({
      ...person,
      demo_private_price_cents: Math.max(100, Number(person.demo_private_price_cents || 100)),
      demo_private_currency: person.demo_private_currency || "USD",
      demo_private_hint: "urmărit",
    }));
  }
  return [
    { user_id: 90101, handle: "aria.private", name: "Aria Studio", followers: 18400, sigil_icon: "✦", demo_private_price_cents: 100, demo_private_currency: "USD", demo_private_hint: "demo creator" },
    { user_id: 90102, handle: "nexus.afterdark", name: "Afterdark Lens", followers: 12700, sigil_icon: "◇", demo_private_price_cents: 300, demo_private_currency: "USD", demo_private_hint: "demo private" },
    { user_id: 90103, handle: "mira.fit", name: "Mira Fit", followers: 9100, sigil_icon: "◆", demo_private_price_cents: 100, demo_private_currency: "USD", demo_private_hint: "wellbeing" },
  ];
}

async function loadPrivateSubscribedContent() {
  const host = document.getElementById("private-feed-posts");
  if (!host) return;
  const result = await api("/api/social/private-content").catch(() => null);
  if (!result?.ok) {
    host.innerHTML = '<div class="friendsEmpty"><b>Backendul nou cere restart</b><span>UI-ul este pregătit; receipts și conținut privat se vor încărca după restart sigur.</span></div>';
    return;
  }
  if (!result.posts?.length) {
    host.innerHTML = '<div class="friendsEmpty"><b>Nu ai acces activ încă</b><span>Deblochează un profil privat pentru zilele dorite; conținutul lui va apărea aici.</span></div>';
    return;
  }
  currentFeedPosts = result.posts;
  host.innerHTML = '<div class="privateReceiptRail">' + result.receipts.map((receipt) => '<span><b>@' + esc(receipt.handle) + '</b><small>până ' + new Date(Number(receipt.expires_at) * 1000).toLocaleDateString() + ' · ' + esc(receipt.status) + '</small></span>').join("") + '</div><div class="pulsePosts privatePosts">' + result.posts.map(postCard).join("") + '</div>';
  wirePostActions(host);
}

function money(cents, currency = "USD") {
  return (Number(cents || 0) / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}

function curiosityLedgerKey() {
  return "nexus-curiosity-ledger:" + String(state?.user?.id || state?.user?.handle || "local");
}

function readCuriosityLedger() {
  try { return JSON.parse(localStorage.getItem(curiosityLedgerKey()) || "[]"); } catch { return []; }
}

function writeCuriosityLedger(entries) {
  localStorage.setItem(curiosityLedgerKey(), JSON.stringify(entries.slice(-80)));
}

function curiosityHas(kind, assetId) {
  return readCuriosityLedger().some((entry) => entry.kind === kind && String(entry.asset_id) === String(assetId));
}

function createCuriosityReceipt({ kind, assetType, assetId, title, priceCents, currency = CURIOSITY_ECONOMY.currency, split = null }) {
  const now = Date.now();
  const raw = [kind, assetType, assetId, title, priceCents, currency, state?.user?.handle, now].join(":");
  const hash = Array.from(raw).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) >>> 0, 2166136261).toString(16).padStart(8, "0");
  const entry = {
    id: "curiosity-" + now + "-" + hash,
    kind,
    asset_type: assetType,
    asset_id: assetId,
    title,
    amount_cents: Math.max(CURIOSITY_ECONOMY.minSettlementCents, Number(priceCents || CURIOSITY_ECONOMY.minSettlementCents)),
    currency,
    split,
    status: "demo_local_no_real_funds",
    policy: CURIOSITY_ECONOMY.policy,
    created_at: now,
  };
  const ledger = readCuriosityLedger();
  ledger.push(entry);
  writeCuriosityLedger(ledger);
  return entry;
}

function demoCuriosityReceiptRail(limit = 4) {
  const ledger = readCuriosityLedger().slice(-limit).reverse();
  if (!ledger.length) return '<div class="curiosityMiniLedger empty"><b>Curiosity economy</b><small>Unlock, Reveal x2 și Collect sunt simulate local, fără plăți reale.</small></div>';
  return '<div class="curiosityMiniLedger">' + ledger.map((entry) => '<span><b>' + esc(entry.kind.replaceAll("_", " ")) + '</b><small>' + esc(entry.title || entry.asset_type) + ' · ' + money(entry.amount_cents, entry.currency) + '</small></span>').join("") + '</div>';
}

function openCuriositySheet(asset) {
  const host = document.getElementById("private-access-sheet") || document.getElementById("screenViewport");
  const assetId = asset.assetId;
  const price = Math.max(CURIOSITY_ECONOMY.minSettlementCents, Number(asset.priceCents || CURIOSITY_ECONOMY.minSettlementCents));
  const currency = asset.currency || CURIOSITY_ECONOMY.currency;
  const unlocked = curiosityHas("UNLOCK", assetId);
  const collected = curiosityHas("COLLECT", assetId);
  const revealPrice = price * 2;
  host.insertAdjacentHTML("beforeend", [
    '<div class="switcherBackdrop privateUnlockBackdrop curiosityBackdrop" id="curiositySheet">',
    '<section class="switcherSheet privateUnlockSheet curiositySheet" role="dialog" aria-modal="true" aria-labelledby="curiosityTitle" tabindex="-1">',
    '<header><span><small>CURIOSITY MARKET</small><b id="curiosityTitle">' + esc(asset.title || "Nexus asset") + '</b></span><button type="button" aria-label="Închide">×</button></header>',
    '<div class="privateUnlockBody curiosityBody">',
    '<section class="unlockQuote curiosityQuote"><span><small>' + esc(asset.assetType || "ASSET") + '</small><b>' + esc(asset.owner || "@creator") + '</b></span><strong>' + money(price, currency) + '</strong><em>Free by default. Plătești doar pentru acces, colecție sau reveal voluntar.</em></section>',
    '<div class="curiosityActions">',
    '<button type="button" data-curiosity-action="UNLOCK"' + (unlocked ? ' class="done"' : '') + '><b>' + (unlocked ? "Unlocked ✓" : "Unlock") + '</b><small>Deblochează conținutul ascuns</small></button>',
    '<button type="button" data-curiosity-action="COLLECT"' + (collected ? ' class="done"' : '') + '><b>' + (collected ? "Collected ✓" : "Collect") + '</b><small>Cumpără ediție pentru colecție</small></button>',
    '<button type="button" data-curiosity-action="REVEAL_X2"><b>Reveal x2</b><small>' + money(revealPrice, currency) + ' · 60/30/10 split</small></button>',
    '<button type="button" data-curiosity-action="LIST_RESALE"><b>List / Resell</b><small>Pune în colecție și setează preț</small></button>',
    '</div>',
    '<div class="unlockSplit"><span><b>90%</b><small>creator / seller primary</small></span><span><b>10%</b><small>Nexus fee demo</small></span></div>',
    '<p>Reviews, Trust Passport, verificări, sigilii câștigate și reach organic nu sunt cumpărabile. Acesta este doar un receipt local de produs, fără fonduri reale.</p>',
    demoCuriosityReceiptRail(),
    '</div></section></div>',
  ].join(""));
  const sheet = document.getElementById("curiositySheet");
  const close = () => sheet.remove();
  sheet.querySelector("header button").addEventListener("click", close);
  sheet.addEventListener("click", (event) => { if (event.target === sheet) close(); });
  sheet.querySelectorAll("[data-curiosity-action]").forEach((button) => button.addEventListener("click", () => {
    const kind = button.dataset.curiosityAction;
    const receipt = createCuriosityReceipt({
      kind,
      assetType: asset.assetType,
      assetId,
      title: asset.title,
      priceCents: kind === "REVEAL_X2" ? revealPrice : price,
      currency,
      split: kind === "REVEAL_X2" ? CURIOSITY_ECONOMY.revealSplit : CURIOSITY_ECONOMY.privateSplit,
    });
    button.classList.add("done");
    button.querySelector("b").textContent = kind === "LIST_RESALE" ? "Listed demo ✓" : kind.replaceAll("_", " ") + " ✓";
    sheet.querySelector(".curiosityMiniLedger")?.remove();
    sheet.querySelector(".curiosityBody").insertAdjacentHTML("beforeend", demoCuriosityReceiptRail());
    if (kind === "UNLOCK") document.querySelector('[data-post-id="' + CSS.escape(String(assetId)) + '"]')?.classList.add("curiosityUnlocked");
    toast("Receipt " + receipt.kind.replaceAll("_", " ") + " creat · demo fără plată reală");
  }));
  sheet.querySelector(".curiositySheet").focus();
}

function openStoryEconomySheet(story = null) {
  if (!story) return toast("Story indisponibil");
  if (Number(story.author?.id) === Number(state?.user?.id) && state?.persona === "social") {
    return openStoryOwnerSheet(story);
  }
  openCuriositySheet({
    assetType: "STORY_COLLECTIBLE",
    assetId: story.id,
    title: story.caption || "Story collectible",
    owner: "@" + (story.author?.handle || "creator"),
    priceCents: story.economy?.price_cents || 100,
    currency: story.economy?.currency || CURIOSITY_ECONOMY.currency,
  });
}

function openStoryOwnerSheet(story) {
  const host = document.getElementById("private-access-sheet");
  if (!host || !Number.isSafeInteger(Number(story?.id))) return;
  const archiveKey = newUploadMutationKey("story-archive");
  const highlightKey = newUploadMutationKey("story-highlight-create");
  const itemKey = newUploadMutationKey("story-highlight-item");
  host.innerHTML = '<div class="switcherBackdrop"><section class="switcherSheet" role="dialog" aria-modal="true" aria-labelledby="storyOwnerTitle" tabindex="-1"><header><span><small>STORY</small><b id="storyOwnerTitle">Opțiunile tale</b></span><button type="button" data-close-story-owner aria-label="Închide">×</button></header><div class="privateUnlockBody"><p>Arhivarea îl scoate imediat din Stories. Îl poți păstra într-un Highlight respectând aceeași vizibilitate Social.</p><div data-story-owner-status role="status" aria-live="polite"></div><button class="btn" type="button" data-story-archive>Arhivează</button><button class="btn ghost" type="button" data-story-highlight>Arhivează și adaugă în „Momente”</button></div></section></div>';
  const close = () => { host.innerHTML = ""; };
  const status = host.querySelector("[data-story-owner-status]");
  const setStatus = (message) => { if (status?.isConnected) status.textContent = message; };
  host.querySelector("[data-close-story-owner]").addEventListener("click", close);
  host.querySelector(".switcherBackdrop").addEventListener("click", (event) => { if (event.target.classList.contains("switcherBackdrop")) close(); });
  const finishArchive = (result) => {
    const exact = result?.ok === true && Number(result.story_id) === Number(story.id)
      && Number(result.actor_id) === Number(state.user.id) && result.actor_persona === "social" && result.status === "archived";
    if (!exact) return false;
    currentStories = currentStories.filter((item) => Number(item.id) !== Number(story.id));
    closeStoryViewer({ recordProgress: false });
    close();
    document.getElementById("storyRail") && loadStories(document.getElementById("storyRail"));
    return true;
  };
  host.querySelector("[data-story-archive]").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    setStatus("Arhivez…");
    const result = await api(`/api/stories/${story.id}/archive`, { method: "POST", headers: { "Idempotency-Key": archiveKey }, body: {} }).catch(() => null);
    if (!finishArchive(result)) { event.currentTarget.disabled = false; setStatus("Nu s-a schimbat nimic. Poți reîncerca aceeași operație în siguranță."); toast("Story-ul nu a putut fi arhivat"); }
  });
  host.querySelector("[data-story-highlight]").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    setStatus("Pregătesc Highlight-ul…");
    const created = await api("/api/story-highlights", { method: "POST", headers: { "Idempotency-Key": highlightKey }, body: { title: "Momente" } }).catch(() => null);
    const highlightId = Number(created?.highlight?.id);
    const exactCreate = created?.ok === true && created.action === "story_highlight_created"
      && Number(created.owner_id) === Number(state.user.id) && created.owner_persona === "social"
      && Number.isSafeInteger(highlightId) && highlightId > 0;
    if (!exactCreate) { event.currentTarget.disabled = false; setStatus("Highlight-ul nu a fost confirmat. Nicio arhivare nu este presupusă."); return toast("Highlight-ul nu a putut fi creat"); }
    setStatus("Highlight confirmat. Adaug Story-ul…");
    const added = await api(`/api/story-highlights/${highlightId}/items`, { method: "POST", headers: { "Idempotency-Key": itemKey }, body: { story_id: Number(story.id) } }).catch(() => null);
    const exactItem = added?.ok === true && Number(added.owner_id) === Number(state.user.id)
      && added.owner_persona === "social" && Number(added.highlight_id) === highlightId
      && Number(added.story?.id) === Number(story.id) && added.story?.status === "archived";
    if (!exactItem) { event.currentTarget.disabled = false; setStatus("Highlight-ul există, dar Story-ul nu este confirmat în el. Reîncearcă: Nexus reutilizează aceeași operație, fără duplicare."); return toast("Story-ul nu a putut fi adăugat în Highlight"); }
    finishArchive({ ok: true, story_id: Number(story.id), actor_id: Number(state.user.id), actor_persona: "social", status: "archived" });
    toast("Story arhivat în Momente");
  });
}

async function openPrivateAccessSheet(ownerId, handle = "creator", options = {}) {
  const term = new Set(["24h", "1month", "forever"]).has(options.term) ? options.term : "24h";
  const days = term === "1month" ? 30 : term === "forever" ? 0 : 1;
  const reveal = options.reveal === true;
  const host = document.getElementById("private-access-sheet");
  if (!host) return;
  host.innerHTML = '<div class="switcherBackdrop privateUnlockBackdrop"><section class="switcherSheet privateUnlockSheet" role="dialog" aria-modal="true" aria-labelledby="privateUnlockTitle" tabindex="-1"><header><span><small>PRIVATE ACCESS</small><b id="privateUnlockTitle">Calculez accesul</b></span><button type="button" aria-label="Închide">×</button></header><div class="privateUnlockBody">Se verifică prețul…</div></section></div>';
  const close = () => { host.innerHTML = ""; };
  host.querySelector("header button").addEventListener("click", close);
  host.querySelector(".privateUnlockBackdrop").addEventListener("click", (event) => { if (event.target.classList.contains("privateUnlockBackdrop")) close(); });
  const fallbackQuote = {
    owner_id: ownerId,
    owner_handle: handle,
    persona: "social",
    access_kind: reveal ? "VISITOR_REVEAL_RECIPROCAL" : "PRIVATE_CONTENT_ACCESS",
    price_per_day_cents: 100,
    reveal_multiplier: reveal ? 2 : 1,
    amount_cents: (term === "forever" ? 10000 : days * 100) * (reveal ? 2 : 1),
    currency: "USD",
    duration_days: days,
    owner_share_cents: Math.floor((term === "forever" ? 10000 : days * 100) * (reveal ? 2 : 1) * .9),
    nexus_share_cents: Math.ceil((term === "forever" ? 10000 : days * 100) * (reveal ? 2 : 1) * .1),
    term,
    privacy_mode: "OWNER_ANONYMOUS",
    reciprocal_access: reveal,
    settlement_status: "LOCAL_UI_FALLBACK_SERVER_RESTART_REQUIRED",
  };
  const result = await api("/api/social/private-access/quote?owner_id=" + encodeURIComponent(ownerId) + "&persona=social&term=" + encodeURIComponent(term) + (reveal ? "&kind=visitor_reveal" : "")).catch(() => null);
  const quote = result?.ok ? result.quote : fallbackQuote;
  const body = host.querySelector(".privateUnlockBody");
  body.innerHTML = [
    '<section class="unlockQuote"><span><small>' + (quote.reciprocal_access ? 'REVEAL RECIPROC' : 'PROFIL PRIVAT') + '</small><b>@' + esc(quote.owner_handle || handle) + '</b></span><strong>' + money(quote.amount_cents, quote.currency) + '</strong><em>' + esc(term === "24h" ? "24 h" : term === "1month" ? "1 month" : "Forever") + (quote.reveal_multiplier === 2 ? ' × 2 reveal' : '') + '</em></section>',
    '<div class="unlockTerms"><button type="button" data-unlock-term="24h" class="' + (term === "24h" ? "active" : "") + '">24 h</button><button type="button" data-unlock-term="1month" class="' + (term === "1month" ? "active" : "") + '">1 month</button><button type="button" data-unlock-term="forever" class="' + (term === "forever" ? "active" : "") + '">Forever</button></div>',
    '<label class="privacyToggle revealToggle"><input id="unlock-reveal" type="checkbox"' + (quote.reciprocal_access ? ' checked' : '') + ' /><span><b>Vreau reveal reciproc · cost dublu</b><small>Dacă afli cine te-a urmărit, și acea persoană primește acces similar la tine. Fără expunere unilaterală.</small></span></label>',
    '<div class="unlockSplit"><span><b>' + money(quote.owner_share_cents, quote.currency) + '</b><small>creator 90%</small></span><span><b>' + money(quote.nexus_share_cents, quote.currency) + '</b><small>Nexus 10%</small></span></div>',
    '<p>Accesul este privat: ownerul nu vede cine a vizitat; primește încasarea și statistici agregate, nu username-ul vizitatorului. Nexus păstrează audit intern pseudonimizat pentru dispute și abuz.</p>',
    quote.active_receipt ? '<div class="unlockReceipt"><b>Receipt activ</b><small>Expiră: ' + new Date(Number(quote.active_receipt.expires_at) * 1000).toLocaleString() + '</small></div>' : '',
    '<button class="btn" id="private-demo-receipt" type="button">Generează receipt demo · fără plată reală</button>',
    '<small class="privateSettlementState">Settlement real prin Nexus Pay/xMoney/stablecoin este oprit în demo.</small>',
  ].join("");
  body.querySelectorAll("[data-unlock-term]").forEach((button) => button.addEventListener("click", () => openPrivateAccessSheet(ownerId, handle, { term: button.dataset.unlockTerm, reveal: document.getElementById("unlock-reveal").checked })));
  document.getElementById("unlock-reveal").addEventListener("change", (event) => openPrivateAccessSheet(ownerId, handle, { term, reveal: event.target.checked }));
  document.getElementById("private-demo-receipt").addEventListener("click", async () => {
    const receipt = await api("/api/social/private-access/demo-receipt", { method: "POST", body: { owner_id: ownerId, persona: "social", term, kind: document.getElementById("unlock-reveal").checked ? "visitor_reveal" : "private_content" } }).catch(() => null);
    if (!receipt?.ok) return toast("Receipt demo indisponibil până la restart backend");
    body.querySelector(".unlockReceipt")?.remove();
    body.insertAdjacentHTML("beforeend", '<div class="unlockReceipt"><b>Receipt local creat</b><small>' + esc(receipt.receipt.receipt_hash.slice(0, 12)) + '… · demo_unpaid</small></div>');
    loadPrivateSubscribedContent();
    toast("Receipt demo creat · fără plată reală");
  });
}

function clearUnavailableFeedState(container) {
  currentFeedPosts = [];
  container.classList.remove("clipFirst", "feedReels", "feedWhispers", "feedNews");
}

function isLocalDemoOrigin() {
  return /^(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(location.hostname);
}

// A card the feed could not load says so and offers the same request again. The retry is the
// request itself, not a page reload: the reader keeps their place and their mode.
function wireFeedStateActions(container) {
  container.querySelector("[data-feed-retry]")?.addEventListener("click", () => { void loadFeed(container); });
  container.querySelector("[data-feed-refresh]")?.addEventListener("click", () => { void loadFeed(container); });
}

function whisperCardContext(post) {
  return {
    esc, t,
    stamp: (seconds) => (Number(seconds) > 0 ? relativeStamp(Math.floor(Number(seconds))) : ""),
    body: captionWithTagsMarkup(post.caption || ""),
    palette: reactionPaletteMarkup(post, post.reactions?.viewer_reaction || null),
    drawer: commentsDrawerMarkup(post),
    menu: postOptionsMenuMarkup(post, {
      owner: Number(post.user_id) === Number(state.user?.id) && post.persona === state.persona,
      muted: post.muted_by_me === true,
      blocked: post.blocked_by_me === true,
    }),
    summary: reactionSummaryMarkup(post.reactions?.counts || {}),
    repost: repostHeaderMarkup(post.repost),
    sigil: usernameSigil(post.author || {}, post.persona),
    sharing: SOCIAL_SHARING_ENABLED,
  };
}

async function loadFeed(container) {
  const request = socialFeedLoadGate.begin();
  const requestedLens = socialLens;
  const requestedFormat = socialFormat;
  const requestedMode = feedMode;
  const viewerId = Number(state.user.id);
  const viewerPersona = state.persona;
  // The feed says what it is waiting for, in the shape of the cards that are coming.
  clearUnavailableFeedState(container);
  container.innerHTML = feedSkeletonMarkup({ mode: requestedMode, t, esc, count: 3 });
  container.setAttribute("aria-busy", "true");
  // The gesture belongs to the reading, not to what it found: a notice is a reading too (measured: these
  // paths had no gesture at all). Wave 14f: the reading is one wiring - the swipe - since the shelf and the
  // rail this screen used to fold are not drawn here any more.
  const wireReading = () => { wireSocialChannelSwipe(container); };
  const r = await api("/api/social/feed?lens=" + encodeURIComponent(requestedLens) + "&format=" + encodeURIComponent(requestedFormat));
  if (!request.isCurrent() || !container?.isConnected || Number(state.user.id) !== viewerId
      || state.persona !== viewerPersona || socialLens !== requestedLens || socialFormat !== requestedFormat
      || feedMode !== requestedMode) return;
  container.removeAttribute("aria-busy");
  if (!r.ok || !isSafeSocialFeedPage(r, { lens: requestedLens, format: requestedFormat, cursor: null, viewerId, viewerPersona })) {
    clearUnavailableFeedState(container);
    container.innerHTML = feedErrorMarkup({ mode: requestedMode, t, esc });
    wireFeedStateActions(container);
    wireReading();
    return toast(t("feed.unavailable"));
  }
  if (r.provider?.status === "ready") {
    // News answered from its allow-listed aggregator: the mode shows headlines, and it says so when
    // the snapshot could not be refreshed instead of pretending the list is live.
    clearUnavailableFeedState(container);
    container.innerHTML = breakingNewsMarkup(r, {
      esc, t, locale: state.user?.interface_locale || "en",
      stamp: (value) => (value ? relativeStamp(Math.floor(value / 1000)) : ""),
    });
    wireReading();
    return;
  }
  if (r.provider?.status === "disabled") { clearUnavailableFeedState(container); container.innerHTML = '<div class="feedNotice"><b>' + esc(t("feed.breakingDisabled")) + '</b><span>' + esc(t("feed.breakingDisabledDetail")) + '</span></div>'; wireReading(); return; }
  if (r.near?.status === "consent_required") { clearUnavailableFeedState(container); container.innerHTML = '<div class="feedNotice"><b>' + esc(t("feed.nearConsent")) + '</b><span>' + esc(t("feed.nearConsentDetail")) + '</span><button id="openSocialProfile">' + esc(t("feed.openProfile")) + '</button></div>'; document.getElementById("openSocialProfile").addEventListener("click", () => selectModule("profiles")); wireReading(); return; }
  // The feed renders exactly what the repository returned: catalog content is ingested
  // into a real account, so the client never mixes generated posts into the timeline.
  const posts = r.posts;
  if (!posts.length) {
    clearUnavailableFeedState(container);
    container.innerHTML = feedEmptyMarkup({ mode: requestedMode, t, esc });
    wireFeedStateActions(container);
    wireReading();
    return;
  }
  currentFeedPosts = posts;
  container.classList.remove("feedReels", "feedWhispers", "feedNews");
  container.classList.add(requestedMode === "whispers" ? "feedWhispers" : requestedMode === "news" ? "feedNews" : "feedReels");
  container.classList.toggle("clipFirst", socialFormat === "clips");
  // Whispers are read as text cards; every other mode keeps the card the rest of the app uses.
  container.innerHTML = (requestedMode === "whispers"
    ? posts.map((post) => whisperCardMarkup(post, whisperCardContext(post))).join("")
    : posts.map(postCard).join(""))
    + (r.next_cursor ? feedMoreMarkup({ t, esc, cursor: r.next_cursor }) : '');
  wirePostActions(container);
  wireSocialFeedContinuation(container);
  wireFeedExposure(container);
  if (requestedMode === "whispers") bindFeedAudio(container, { t });
  if (socialFormat === "clips") wireClipPlayback(container);
  wireReading();
  // The reader's place in this reading comes back, so switching between the three never loses a
  // scroll, and a different lens still starts at its own top.
  const remembered = Number(feedScrollMemory.get(requestedMode + ":" + requestedLens + ":" + requestedFormat) || 0);
  if (remembered > 0) container.scrollTop = remembered;
}

// The horizontal gesture of the feed. It used to walk the four channels of the lens; since wave 14e it
// walks the three readings, in the order the rail above the column prints them. The gesture vocabulary
// (the decision, the 72px threshold, the pull at the top) is unchanged: what changed is what it walks.
function wireSocialChannelSwipe(container) {
  if (!container || container.dataset.channelSwipeWired) return;
  container.dataset.channelSwipeWired = "true";
  let pointer = null;
  let touch = null;
  const touchSurface = container.closest(".clipsScreen") || container;
  const beginGesture = (id, x, y) => ({ id, x, y, lastX: x, lastY: y });
  const updatePullDistance = (start, x, y) => {
    if (!start || container.scrollTop > 1) return;
    start.lastX = x;
    start.lastY = y;
    const dy = Math.max(0, y - start.y);
    const dx = Math.abs(x - start.x);
    if (dy <= dx) return;
    container.closest(".clipsScreen")?.style.setProperty("--pull-distance", Math.min(1, dy / 64).toFixed(2));
  };
  const finishGesture = async (start, x, y) => {
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const decision = decideSocialGesture({ dx, dy, scrollTop: container.scrollTop });
    const screen = container.closest(".clipsScreen");
    screen?.style.removeProperty("--pull-distance");
    if (decision.action === "refresh") {
      if (screen?.dataset.refreshing === "true") return;
      suppressFeedClickUntil = performance.now() + 650;
      if (screen) { screen.dataset.refreshing = "true"; screen.setAttribute("aria-busy", "true"); }
      screen?.classList.add("feedRefreshing");
      const indicator = screen?.querySelector(".pullRefreshIndicator span");
      if (indicator) indicator.textContent = t("feed.refreshing");
      await loadFeed(container).catch(() => {});
      screen?.classList.remove("feedRefreshing");
      if (screen) { delete screen.dataset.refreshing; screen.removeAttribute("aria-busy"); }
      if (indicator?.isConnected) indicator.textContent = t("feed.pullRefresh");
      return;
    }
    if (decision.action !== "channel") return;
    // Wave 14e: what the swipe walks is the three readings, not the four channels of a lens.
    suppressFeedClickUntil = performance.now() + 500;
    activateFeedMode(nextFeedMode(feedMode, decision.offset));
  };
  container.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (event.target.closest("button,input,textarea,select,a,.comments,.reactionBar,.clipMoreActions")) return;
    pointer = beginGesture(event.pointerId, event.clientX, event.clientY);
  }, { passive: true });
  container.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    updatePullDistance(pointer, event.clientX, event.clientY);
  }, { passive: true });
  container.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const start = pointer;
    pointer = null;
    void finishGesture(start, event.clientX, event.clientY);
  }, { passive: true });
  container.addEventListener("pointercancel", () => { pointer = null; container.closest(".clipsScreen")?.style.removeProperty("--pull-distance"); }, { passive: true });
  touchSurface.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || event.target.closest("button,input,textarea,select,a,.comments,.reactionBar,.clipMoreActions")) {
      touch = null;
      container.closest(".clipsScreen")?.style.removeProperty("--pull-distance");
      return;
    }
    const point = event.changedTouches[0];
    if (point) touch = beginGesture(point.identifier, point.clientX, point.clientY);
  }, { passive: true });
  touchSurface.addEventListener("touchmove", (event) => {
    if (!touch) return;
    if (event.touches.length !== 1) {
      touch = null;
      container.closest(".clipsScreen")?.style.removeProperty("--pull-distance");
      return;
    }
    const point = [...event.changedTouches].find((item) => item.identifier === touch.id);
    if (point) updatePullDistance(touch, point.clientX, point.clientY);
  }, { passive: true });
  touchSurface.addEventListener("touchend", (event) => {
    if (!touch) return;
    const point = [...event.changedTouches].find((item) => item.identifier === touch.id);
    if (!point) return;
    const start = touch;
    touch = null;
    void finishGesture(start, point.clientX, point.clientY);
  }, { passive: true });
  touchSurface.addEventListener("touchcancel", () => {
    touch = null;
    container.closest(".clipsScreen")?.style.removeProperty("--pull-distance");
  }, { passive: true });
}

function wireFeedExposure(container) {
  const cards = [...container.querySelectorAll("article[data-post-id]")].filter((card) => !card.querySelector("video.media") && !card.dataset.impressionWired);
  if (!cards.length) return;
  const scrollRoot = container.matches?.(".pulsePosts") ? container : (container.closest(".pulsePosts") || container);
  const started = new WeakMap();
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const postId = Number(entry.target.dataset.postId);
    if (entry.isIntersecting && entry.intersectionRatio >= .55) {
      if (!started.has(entry.target)) {
        started.set(entry.target, performance.now());
        queueSocialImpression(postId);
      }
    } else if (started.has(entry.target)) {
      queueSocialImpression(postId, performance.now() - started.get(entry.target));
      started.delete(entry.target);
    }
  }), { root: scrollRoot, threshold: [.1, .55, .9] });
  cards.forEach((card) => { card.dataset.impressionWired = "true"; observer.observe(card); });
}

// A feed that is read to its end loads the next page by itself when the end comes into view; the
// button stays, because a keyboard, an older browser or a reader who wants to ask still can. The
// gate is the same single-flight gate the rest of the app uses, so a scroll cannot fetch twice.
function wireSocialFeedContinuation(container) {
  const button = container.querySelector("[data-feed-more]");
  if (!button) return;
  const loadMore = async () => {
    if (button.disabled || button.dataset.feedLoading === "true") return;
    const cursor = String(button.dataset.feedMore || "");
    const requestedLens = socialLens;
    const requestedFormat = socialFormat;
    const requestedMode = feedMode;
    const viewerId = Number(state.user.id);
    const viewerPersona = state.persona;
    const request = socialFeedPageLoadGate.begin();
    button.disabled = true;
    button.dataset.feedLoading = "true";
    button.textContent = t("feed.loading");
    const page = await api("/api/social/feed?lens=" + encodeURIComponent(requestedLens) + "&format=" + encodeURIComponent(requestedFormat) + "&cursor=" + encodeURIComponent(cursor));
    if (!request.isCurrent() || !container.isConnected || Number(state.user.id) !== viewerId || state.persona !== viewerPersona
        || socialLens !== requestedLens || socialFormat !== requestedFormat || feedMode !== requestedMode) return;
    if (!isSafeSocialFeedPage(page, { lens: requestedLens, format: requestedFormat, cursor, viewerId, viewerPersona })) {
      button.disabled = false;
      button.dataset.feedLoading = "false";
      button.textContent = t("search.more");
      return toast(t("feed.unavailable"));
    }
    const known = new Set(currentFeedPosts.map((post) => Number(post.id)));
    if (page.posts.some((post) => known.has(Number(post.id)))) {
      button.disabled = false;
      button.dataset.feedLoading = "false";
      button.textContent = t("search.more");
      return toast(t("feed.unavailable"));
    }
    if (page.posts.length) {
      const pageId = "feed-page-" + Date.now().toString(36);
      // A page of whispers is a page of whisper cards, so the second page is the same kind of thing
      // as the first one.
      const rows = feedMode === "whispers"
        ? page.posts.map((post) => whisperCardMarkup(post, whisperCardContext(post))).join("")
        : page.posts.map(postCard).join("");
      button.insertAdjacentHTML("beforebegin", '<div id="' + pageId + '" class="socialFeedPage">' + rows + '</div>');
      currentFeedPosts.push(...page.posts);
      const pageRoot = document.getElementById(pageId);
      wirePostActions(pageRoot, currentFeedPosts);
      wireFeedExposure(pageRoot);
      if (feedMode === "whispers") bindFeedAudio(pageRoot, { t });
      if (socialFormat === "clips") wireClipPlayback(pageRoot);
    }
    button.dataset.feedLoading = "false";
    if (page.next_cursor) {
      button.dataset.feedMore = page.next_cursor;
      button.textContent = t("search.more");
      button.disabled = false;
      // The page that just arrived may still not fill the screen, so the sentinel is re-checked.
      if (observer) observeSentinel();
    } else {
      observer?.disconnect();
      button.remove();
    }
  };
  button.addEventListener("click", () => { void loadMore(); });
  // The end of the list loads the next page before it is reached, so scrolling never stops on a
  // button that has to be found first. A screen with no IntersectionObserver keeps the button.
  const observer = typeof IntersectionObserver === "function" && container.matches?.(".pulsePosts")
    ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { root: container, rootMargin: "0px 0px 420px 0px" })
    : null;
  function observeSentinel() {
    observer?.unobserve(button);
    observer?.observe(button);
  }
  observeSentinel();
}

function wireClipPlayback(container) {
  wireImageSound(container,readSocialMuted());
  const videos = [...container.querySelectorAll("video.media")];
  const images = [...container.querySelectorAll("article.clipPost img.media")];
  if (!videos.length && !images.length) return;
  const scrollRoot = container.matches?.(".pulsePosts") ? container : (container.closest(".pulsePosts") || container);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= .65) {
        videos.forEach((other) => { if (other !== video) other.pause(); });
        queueSocialImpression(Number(video.closest("article")?.dataset.postId));
        video.play().catch(() => {});
      } else video.pause();
    });
  }, { root: scrollRoot, threshold: [.15, .65, .9] });
  videos.forEach((video) => {
    if(video.dataset.originalVolume!=null)video.volume=Number(video.dataset.originalVolume);
    const jamendoAudio = video.closest(".clipStage")?.querySelector(".jamendoSound audio");
    if (jamendoAudio && !jamendoAudio.dataset.syncBound) {
      jamendoAudio.dataset.syncBound = "true";
      synchronizeReelSound(video, jamendoAudio, {
        duration: Number(jamendoAudio.dataset.jamendoDuration),
        segment_seconds: Number(jamendoAudio.dataset.jamendoSegment),
        preview_offset: Number(jamendoAudio.dataset.jamendoOffset),
      });
    }
    video.muted = readSocialMuted() || Number(video.dataset.originalVolume)===0;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.tabIndex = 0;
    video.setAttribute("aria-label", "Deschide Reel-ul pe tot ecranul");
    const stage = video.closest(".clipStage");
    let chromeTimer = null;
    const revealChrome = () => {
      stage?.classList.remove("clipChromeHidden");
      clearTimeout(chromeTimer);
      chromeTimer = setTimeout(() => {
        const overlayOpen = stage?.closest("article")?.querySelector(".clipCommentsDrawer:not(.hidden), .reactionBar.expanded, .clipMoreActions.expanded");
        if (!overlayOpen) stage?.classList.add("clipChromeHidden");
      }, 2600);
    };
    const syncPlayState = () => {
      stage?.classList.toggle("clipPaused", video.paused);
      const playButton = stage?.querySelector("[data-clip-play]");
      if (playButton) {
        const commentsOpen = stage?.classList.contains("commentsOpen");
        playButton.textContent = video.paused ? "▶" : "❚❚";
        if (commentsOpen) playButton.hidden = false;
        else playButton.hidden = !video.paused;
        playButton.setAttribute("aria-hidden", String(!commentsOpen && !video.paused));
      }
    };
    const togglePlayback = () => {
      revealChrome();
      if (video.paused) {
        stage?.classList.remove("clipPaused");
        video.play().catch(() => stage?.classList.add("clipPaused"));
      } else {
        video.pause();
        stage?.classList.add("clipPaused");
      }
    };
    const syncVideoAspect = () => {
      if (!stage || !video.videoWidth || !video.videoHeight) return;
      const ratio = video.videoWidth / video.videoHeight;
      stage.dataset.videoAspect = ratio > 1.08 ? "landscape" : ratio < .92 ? "portrait" : "square";
    };
    const tapVideo = () => {
      if (performance.now() < suppressFeedClickUntil) return;
      if (stage?.classList.contains("commentsOpen")) return togglePlayback();
      const palette = video.closest("article")?.querySelector(".reactionBar.expanded");
      if (palette) {
        palette.classList.remove("expanded");
        palette.setAttribute("aria-hidden", "true");
        video.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
        return;
      }
      const postId = Number(video.closest("article")?.dataset.postId);
      if (postId) openFeedMediaViewer(postId);
    };
    bindDoubleTapHeart(video, {
      onSingle: tapVideo,
      onHeart: () => {
        if (performance.now() < suppressFeedClickUntil) return;
        primaryHeartForPost(Number(video.closest("article")?.dataset.postId), stage);
      },
    });
    video.addEventListener("loadedmetadata", syncVideoAspect);
    if (video.readyState >= 1) syncVideoAspect();
    stage?.querySelector("[data-clip-play]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (stage?.classList.contains("commentsOpen")) {
        if (video.paused) video.play().catch(() => {}); else video.pause();
        syncPlayState();
        return;
      }
      const postId = Number(video.closest("article")?.dataset.postId);
      if (postId) openFeedMediaViewer(postId);
    });
    video.addEventListener("play", syncPlayState);
    video.addEventListener("pause", syncPlayState);
    stage?.addEventListener("pointermove", revealChrome, { passive: true });
    stage?.addEventListener("pointerdown", revealChrome, { passive: true });
    video.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (event.key === "Enter" && !stage?.classList.contains("commentsOpen")) {
        const postId = Number(video.closest("article")?.dataset.postId);
        if (postId) openFeedMediaViewer(postId);
      } else togglePlayback();
    });
    video.addEventListener("timeupdate", () => {
      if (video.dataset.completedImpression || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime / video.duration < .9) return;
      video.dataset.completedImpression = "1";
      const postId = Number(video.closest("article")?.dataset.postId);
      if (postId) queueSocialImpression(postId, Math.floor(video.duration * 1000), true);
    });
    observer.observe(video);
    syncPlayState();
    revealChrome();
  });
  images.forEach((image) => bindDoubleTapHeart(image, {
    onSingle: () => {
      if (performance.now() < suppressFeedClickUntil) return;
      const postId = Number(image.closest("article")?.dataset.postId);
      if (postId) openFeedMediaViewer(postId);
    },
    onHeart: () => {
      if (performance.now() < suppressFeedClickUntil) return;
      primaryHeartForPost(Number(image.closest("article")?.dataset.postId), image.closest(".clipStage"));
    },
  }));
  applySocialMuted(container, readSocialMuted());
}

async function loadStories(container) {
  const request = storyLoadGate.begin();
  const viewerId = Number(state.user.id);
  const viewerPersona = state.persona;
  const r = await api("/api/stories?state=unseen");
  if (!request.isCurrent() || !container?.isConnected || Number(state.user.id) !== viewerId || state.persona !== viewerPersona) return;
  const validStories = Array.isArray(r?.stories) && r.stories.length <= 100 && r.stories.every((story) => {
    const mediaUrl = story?.media ? "/media/" + String(story.media.hash || "") + "." + String(story.media.ext || "") : "";
    return Number.isSafeInteger(Number(story?.id)) && Number(story.id) > 0
      && Number.isSafeInteger(Number(story.user_id)) && Number(story.user_id) > 0
      && story.persona === "social" && story.status === "active"
      && ["public", "followers", "friends", "private"].includes(story.visibility)
      && typeof story.caption === "string" && story.caption.length <= 500
      && /^[a-f0-9]{64}$/.test(String(story.content_commitment || ""))
      && Number.isSafeInteger(Number(story.created_at)) && Number(story.created_at) > 0
      && (story.expires_at == null || (Number.isSafeInteger(Number(story.expires_at)) && Number(story.expires_at) > Math.floor(Date.now() / 1000)))
      && story.lifecycle === (story.expires_at == null ? "persistent_until_archived" : "expires")
      && story.author && typeof story.author === "object" && Number(story.author.id) === Number(story.user_id)
      && typeof story.author.handle === "string" && /^[a-z0-9_]{2,30}$/.test(story.author.handle)
      && (!story.author.avatar || Boolean(safeInternalMediaUrl(story.author.avatar)))
      && Number(story.view_progress) >= 0 && Number(story.view_progress) <= 1
      && (!story.media || (["image", "video"].includes(story.media.kind) && Boolean(safeInternalMediaUrl(mediaUrl))));
  });
  if (!r?.ok || Number(r.viewer_id) !== viewerId || r.viewer_persona !== viewerPersona || r.state !== "unseen" || !validStories) { container.innerHTML = ""; return; }
  const organicStories = (Array.isArray(r.stories) ? r.stories : []).slice(0, 12);
  const localDemoHost = /^(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const demoStories = localDemoHost && organicStories.length < 4 ? demoHumanExperienceStories() : [];
  currentStories = [...organicStories, ...demoStories.slice(0, Math.max(0, 4 - organicStories.length))];
  // The reader's own card is the door to the camera; every other card opens the viewer the whole
  // app already uses, and an unseen story keeps the accent ring that says so.
  const owner = activePersonaRecord();
  container.innerHTML = feedStoryRailMarkup({
    stories: currentStories,
    owner: {
      display_name: owner?.name || state.user?.display_name || state.user?.handle,
      handle: state.user?.handle,
      avatar: owner?.avatar || state.user?.avatar || "",
    },
    t, esc,
    mediaUrl: (story) => (story.media?.hash ? "/media/" + story.media.hash + "." + story.media.ext : ""),
  });
  document.getElementById("addStory").addEventListener("click", () => openComposer("story", { camera: true, source: "story_camera" }));
  container.querySelectorAll("[data-story]").forEach((button) => button.addEventListener("click", () => handleStoryPeek(button)));
  bindStoryImages(container);
}

function demoCuriosityStories() {
  return [
    { id: -7001, caption: "Mystery Drop · story collectible demo", author: { handle: "aria.private", display_name: "Aria Studio" }, economy: { collectible: true, unlock: true, price_cents: 200, edition: "1/100", policy: CURIOSITY_ECONOMY.policy } },
    { id: -7002, caption: "Local Secret · unlock near-me demo", author: { handle: "local.secret", display_name: "Local Secret" }, economy: { unlock: true, price_cents: 100, revealable: true, policy: CURIOSITY_ECONOMY.policy } },
    { id: -7003, caption: "Collector Room preview", author: { handle: "nexus.collect", display_name: "Nexus Collect" }, economy: { collectible: true, price_cents: 300, edition: "1/1", policy: CURIOSITY_ECONOMY.policy } },
  ];
}

function handleStoryPeek(button) {
  const storyId = Number(button.dataset.story);
  const index = currentStories.findIndex((item) => Number(item.id) === storyId);
  if (index >= 0) openStoryViewer(index);
}

function commitStoryViewerProgress(completed = false) {
  const viewerState = storyViewerState;
  const story = viewerState ? currentStories[viewerState.index] : null;
  if (!viewerState || !story || viewerState.progressCommitted) return;
  const elapsed = Math.max(0, Number(viewerState.watchedMs || 0) + (viewerState.paused ? 0 : performance.now() - viewerState.startedAt));
  const progress = completed ? 1 : Math.min(.89, elapsed / Math.max(1, viewerState.duration));
  if (progress <= Number(story.view_progress || 0)) return;
  viewerState.progressCommitted = true;
  recordStoryViewed(story, progress, completed);
}

function closeStoryViewer({ recordProgress = true } = {}) {
  if (recordProgress) commitStoryViewerProgress(false);
  storyViewerSessionGeneration += 1;
  if (storyViewerState?.timer) clearTimeout(storyViewerState.timer);
  storyViewerState?.cleanup?.();
  storyViewerState = null;
  document.getElementById("storyViewer")?.remove();
  document.body.classList.remove("storyViewerOpen");
  document.querySelectorAll(".stories .storyCard.storyViewed").forEach((card) => card.remove());
  currentStories = currentStories.filter((story) => !story.viewed_by_me);
}

async function recordStoryViewed(story, progress = 1, completed = true) {
  const storyId = Number(story?.id);
  if (!Number.isSafeInteger(storyId) || storyId <= 0) return;
  const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const fingerprint = `${storyId}:${state.user.id}:${state.persona}:${safeProgress}:${completed === true}`;
  const previous = storyViewMutations.get(storyId);
  if (previous?.inFlight) return;
  const intent = previous?.fingerprint === fingerprint ? { ...previous, inFlight: true }
    : { fingerprint, key: newUploadMutationKey("story-view"), inFlight: true };
  storyViewMutations.set(storyId, intent);
  const viewerId = Number(state.user.id);
  const viewerPersona = state.persona;
  const result = await api("/api/stories/" + storyId + "/view", {
    method: "POST", headers: { "Idempotency-Key": intent.key }, body: { progress: safeProgress, completed: completed === true },
  }).catch(() => null);
  const exact = result?.ok === true && Number(result.story_id) === storyId
    && Number(result.actor_id) === viewerId && result.actor_persona === viewerPersona
    && Number(result.requested_progress) === safeProgress && result.requested_completed === (completed === true)
    && Number(result.progress) >= safeProgress && result.viewed === (completed === true || safeProgress >= .9);
  if (!exact || Number(state.user.id) !== viewerId || state.persona !== viewerPersona) { storyViewMutations.set(storyId, { ...intent, inFlight: false }); return; }
  storyViewMutations.delete(storyId);
  story.viewed_by_me = result.viewed;
  story.view_progress = Math.max(Number(story.view_progress || 0), Number(result.progress));
  document.querySelector('[data-story="' + storyId + '"]')?.classList.toggle("storyViewed", result.viewed);
}

function openStoryViewer(startIndex = 0, items = null) {
  closeStoryViewer();
  if (items) currentStories = items;
  const index = Math.max(0, Math.min(currentStories.length - 1, Number(startIndex) || 0));
  document.body.insertAdjacentHTML("beforeend", '<div id="storyViewer" class="storyViewer" role="dialog" aria-modal="true" aria-label="Stories"><div class="storyViewerFrame"></div></div>');
  document.body.classList.add("storyViewerOpen");
  storyViewerState = { sessionId: ++storyViewerSessionGeneration, frameGeneration: 0, index, timer: null, startedAt: performance.now(), duration: 5000, remaining: 5000, watchedMs: 0, paused: false, progressCommitted: false, suppressClickUntil: 0, cleanup: null };
  renderStoryViewerFrame();
}

function renderStoryViewerFrame() {
  const root = document.getElementById("storyViewer");
  if (!root || !storyViewerState) return;
  if (storyViewerState.timer) clearTimeout(storyViewerState.timer);
  storyViewerState.cleanup?.();
  const sessionId = storyViewerState.sessionId;
  const frameGeneration = ++storyViewerState.frameGeneration;
  const isCurrentFrame = () => Boolean(root.isConnected && storyViewerState?.sessionId === sessionId && storyViewerState.frameGeneration === frameGeneration && state.persona === "social");
  const story = currentStories[storyViewerState.index];
  if (!story) return closeStoryViewer();
  const author = story.author || {};
  const name = author.display_name || author.handle || "Nexus";
  const mediaUrl = story.media ? "/media/" + story.media.hash + "." + story.media.ext : "";
  const media = story.media?.kind === "video"
    ? '<video class="storyViewerMedia" src="' + esc(mediaUrl) + '" playsinline autoplay muted preload="auto"></video>'
    : story.media?.kind === "image"
      ? '<img class="storyViewerMedia" src="' + esc(mediaUrl) + '" alt="' + esc(story.caption || "Story") + '" />'
      : '<div class="storyViewerFallback"><b>' + esc(name.slice(0, 2).toUpperCase()) + '</b><span>' + esc(story.caption || "Nexus Story") + '</span></div>';
  const progress = currentStories.map((_, i) => '<i class="storyProgress ' + (i < storyViewerState.index ? "done" : i === storyViewerState.index ? "active" : "") + '"><b></b></i>').join("");
  root.querySelector(".storyViewerFrame").innerHTML = [
    '<div class="storyProgressRail">' + progress + '</div>',
    media,
    '<header><span class="storyViewerAvatar">' + (safeInternalMediaUrl(author.avatar) ? '<img src="' + esc(safeInternalMediaUrl(author.avatar)) + '" alt="" />' : esc(name.slice(0, 2).toUpperCase())) + '</span><b>' + esc(name) + '</b><small>@' + esc(author.handle || "nexus") + '</small><button data-story-menu aria-label="Opțiuni">•••</button><button data-close-story aria-label="Închide">×</button></header>',
    '<div class="storyViewerCaption">' + esc(story.caption || "") + '</div>',
    '<button class="storyHit storyHitPrev" data-story-prev aria-label="Story anterior"></button><button class="storyHit storyHitNext" data-story-next aria-label="Story următor"></button>',
  ].join("");
  const frame = root.querySelector(".storyViewerFrame");
  const activeBar = frame.querySelector(".storyProgress.active b");
  const video = frame.querySelector("video");
  const schedule = (duration, continuing = false) => {
    if (!isCurrentFrame()) return;
    const scheduledDuration = Math.max(750, duration || 5000);
    if (!continuing) {
      storyViewerState.duration = Math.max(1500, scheduledDuration);
      storyViewerState.watchedMs = 0;
      storyViewerState.progressCommitted = false;
    }
    storyViewerState.remaining = scheduledDuration;
    storyViewerState.startedAt = performance.now();
    activeBar?.style.setProperty("--story-duration", scheduledDuration + "ms");
    activeBar?.classList.add("running");
    storyViewerState.timer = setTimeout(() => advanceStoryViewer(1), scheduledDuration);
  };
  if (video) {
    video.addEventListener("loadedmetadata", () => schedule(Math.min(30000, Math.max(3000, Number(video.duration || 5) * 1000))), { once: true });
    video.play().catch(() => schedule(5000));
  } else schedule(5000);
  const pause = () => { if (!isCurrentFrame() || storyViewerState.paused) return; storyViewerState.watchedMs = Math.min(storyViewerState.duration, storyViewerState.watchedMs + Math.max(0, performance.now() - storyViewerState.startedAt)); storyViewerState.remaining = Math.max(750, storyViewerState.duration - storyViewerState.watchedMs); storyViewerState.paused = true; clearTimeout(storyViewerState.timer); activeBar?.classList.add("paused"); video?.pause(); };
  const resume = () => { if (!isCurrentFrame() || !storyViewerState.paused) return; storyViewerState.paused = false; activeBar?.classList.remove("paused"); video?.play().catch(() => {}); schedule(storyViewerState.remaining, true); };
  frame.querySelector("[data-close-story]").addEventListener("click", closeStoryViewer);
  const clickAdvance = (direction) => {
    if (performance.now() < Number(storyViewerState?.suppressClickUntil || 0)) return;
    advanceStoryViewer(direction);
  };
  frame.querySelector("[data-story-prev]").addEventListener("click", () => clickAdvance(-1));
  frame.querySelector("[data-story-next]").addEventListener("click", () => clickAdvance(1));
  frame.querySelector("[data-story-menu]").addEventListener("click", () => { pause(); openStoryEconomySheet(story); });
  frame.addEventListener("pointerdown", pause);
  frame.addEventListener("pointerup", resume);
  frame.addEventListener("pointercancel", resume);
  let touchStart = 0;
  frame.addEventListener("touchstart", (event) => { touchStart = event.touches[0]?.clientX || 0; }, { passive: true });
  frame.addEventListener("touchend", (event) => {
    const delta = (event.changedTouches[0]?.clientX || 0) - touchStart;
    if (Math.abs(delta) <= 55 || !storyViewerState) return;
    storyViewerState.suppressClickUntil = performance.now() + 450;
    advanceStoryViewer(delta < 0 ? 1 : -1);
  }, { passive: true });
  const onKey = (event) => { if (event.key === "Escape") closeStoryViewer(); else if (event.key === "ArrowRight") advanceStoryViewer(1); else if (event.key === "ArrowLeft") advanceStoryViewer(-1); };
  const onVisibility = () => { if (!isCurrentFrame()) return; if (document.hidden) pause(); else resume(); };
  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  storyViewerState.cleanup = () => { document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVisibility); };
}

function advanceStoryViewer(direction) {
  if (!storyViewerState) return;
  commitStoryViewerProgress(direction > 0);
  const next = storyViewerState.index + direction;
  if (next < 0) { storyViewerState.index = 0; return renderStoryViewerFrame(); }
  if (next >= currentStories.length) return closeStoryViewer({ recordProgress: false });
  storyViewerState.index = next;
  renderStoryViewerFrame();
}

function studioFilterCss(manifest) {
  return creatorFilterCss(manifest);
}

function studioAspectClass(aspect) {
  return ({ VERTICAL_9_16: "aspectVertical", SQUARE_1_1: "aspectSquare", PORTRAIT_4_5: "aspectPortrait", LANDSCAPE_16_9: "aspectLandscape" })[aspect] || "aspectOriginal";
}

const CREATOR_MEDIA_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const CREATOR_AUDIO_MIMES = new Set(["audio/mpeg", "audio/wav", "audio/ogg"]);

function creatorStudioValidationKey(formData, file, { socialMode, storyMode }) {
  if (file?.size && !CREATOR_MEDIA_MIMES.has(file.type)) return "studio.invalidMediaType";
  if (!socialMode || storyMode) return null;
  const audioFile = formData.get("audio_file");
  if (audioFile?.size) {
    if (!file?.size) return "audio.needsMedia";
    if (!CREATOR_AUDIO_MIMES.has(audioFile.type)) return "studio.invalidAudioType";
    if (audioFile.size > 20 * 1024 * 1024) return "studio.audioTooLarge";
    if (!formData.get("audio_rights")) return "audio.rightsRequired";
  }
  if (file?.type?.startsWith("video/")) {
    const start = Number(formData.get("trim_start"));
    const end = Number(formData.get("trim_end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 600 || start >= end) return "studio.invalidTimeline";
  }
  return null;
}

// An author's caption track is a real file next to the media (`<hash>.vtt`); the reader only gets a
// <track> when that file exists, never a generated one.
function captionTrackMarkup(post) {
  const media = post?.media || {};
  if (media.kind !== "video" || media.captions !== true || !/^[a-f0-9]{64}$/.test(String(media.hash || ""))) return "";
  return '<track kind="captions" srclang="und" default data-clip-track src="/media/' + media.hash + '.vtt" />';
}

function renderStudioMedia(post, mediaUrl) {
  const studio = post.creator_studio?.integrity === "VERIFIED" ? post.creator_studio.manifest : null;
  if (!studio) return post.media.kind === "video"
    ? '<video class="media" src="' + esc(mediaUrl) + '" playsinline muted loop preload="metadata">' + captionTrackMarkup(post) + '</video>'
    : '<img class="media" src="' + esc(mediaUrl) + '" alt="media" />';
  const filter = studioFilterCss(studio) + ';' + transformCss(studio.transform);
  const overlay = studio.overlay?.text
    ? '<span class="studioOverlay overlay' + esc(studio.overlay.position) + ' color' + esc(studio.overlay.color) + '">' + esc(studio.overlay.text) + '</span>'
    : "";
  const decorations = studioDecorationsMarkup(studio.decorations, esc);
  let media;
  if (post.media.kind === "video") {
    const start = Number(studio.trimStartMs || 0) / 1000;
    const end = Number(studio.trimEndMs || 600000) / 1000;
    media = '<video class="media studioAsset" data-original-volume="'+Number(studio.muteOriginal?0:studio.transform?.originalVolume??1)+'" src="' + esc(mediaUrl) + '#t=' + start + ',' + end + '" playsinline loop preload="metadata" style="filter:' + filter + '" data-trim-start="' + start + '" data-trim-end="' + end + '" data-playback-rate="' + Number(studio.playbackRate || 1) + '" ' + (studio.muteOriginal ? "muted" : "") + '>' + captionTrackMarkup(post) + '</video>';
  } else {
    media = '<img class="media studioAsset" src="' + esc(mediaUrl) + '" alt="' + esc(t("studio.previewAlt")) + '" style="filter:' + filter + '" />';
  }
  const external = post.external_audio?.provider === "jamendo" ? post.external_audio : null;
  const audioUrl = external?.audio_url || (post.audio ? "/media/" + post.audio.hash + "." + post.audio.ext : null);
  const audio = audioUrl
    ? '<div class="studioSound' + (external ? ' jamendoSound' : '') + '"><b>♫ ' + esc(external ? external.name : t("studio.audioCreator")) + '</b><span>' + esc(external ? external.artist : (post.audio_attribution || t("studio.untitled"))) + '</span><small>' + (external ? '<a href="' + esc(external.share_url) + '" target="_blank" rel="noopener noreferrer">' + esc(external.license + " · Jamendo") + '</a>' : esc(t(post.audio_rights === "ORIGINAL_OWNED" ? "studio.declaredOriginal" : "studio.declaredLicense"))) + '</small><audio src="' + esc(audioUrl) + '" preload="metadata"' + (external ? ' data-jamendo-duration="' + Number(external.duration) + '" data-jamendo-segment="' + Number(external.segment_seconds) + '" data-jamendo-offset="' + Number(external.preview_offset || 0) + '"' : ' controls') + '></audio></div>'
    : "";
  return '<div class="studioMedia ' + studioAspectClass(studio.aspect) + '" style="'+(studio.transform?.ratio?'aspect-ratio:'+Number(studio.transform.ratio):'')+'" data-music-volume="'+Number(studio.transform?.musicVolume??.7)+'">' + media + overlay + decorations + '</div>' + audio;
}

function demoCommentsForPost(postId) {
  const demo = currentFeedPosts.find((post) => Number(post.id) === Number(postId));
  const comments = demo?.comment_preview?.length ? demo.comment_preview : [
    { handle: "nexus.demo", display_name: "Nexus", body: "Comentariu demo vizibil pe clip." },
  ];
  return comments.map((comment, index) => ({
    ...comment,
    id: Number(comment.id || -(Math.abs(Number(postId)) * 100 + index + 1)),
    reactions: comment.reactions || { counts: { LOVE: Math.max(2, 18 - index * 6) } },
    reply_count: Number(comment.reply_count || Math.max(0, 4 - index * 2)),
  })).sort(compareCommentImportance);
}

function commentReactionTotal(comment) {
  return Object.values(comment?.reactions?.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

const REACTION_GLYPHS = Object.freeze({ LIKE: "♥", LOVE: "💗", HAHA: "😂", WOW: "😮", SAD: "😢", ANGRY: "😠", FAKE_OPINION: "◆", DISLIKE: "▼" });

function dominantReactionIcon(counts = {}) {
  let winner = "LIKE";
  let maximum = 0;
  for (const kind of Object.keys(REACTION_GLYPHS)) {
    const count = Number(counts[kind] || 0);
    if (count > maximum) { winner = kind; maximum = count; }
  }
  return maximum > 0 ? REACTION_GLYPHS[winner] : REACTION_GLYPHS.LIKE;
}

function reactionSummary(counts = {}) {
  const ranked = Object.keys(REACTION_GLYPHS).map((kind) => ({ kind, count: Number(counts[kind] || 0) }))
    .filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
  const total = ranked.reduce((sum, entry) => sum + entry.count, 0);
  const dominant = ranked[0];
  const dominantShare = dominant && total ? dominant.count / total : 0;
  const visible = !ranked.length ? [{ kind: "LIKE", count: 0 }]
    : dominantShare >= .85 ? [{ ...dominant, count: total }]
      : ranked.slice(0, 3);
  return {
    entries: visible.map((entry) => ({ ...entry, glyph: REACTION_GLYPHS[entry.kind] })),
    total,
    distributed: visible.length > 1,
    collapsed: ranked.length > 1 && dominantShare >= .85,
  };
}

function reactionSummaryMarkup(counts = {}) {
  const summary = reactionSummary(counts);
  return '<i class="reactionSummaryGlyphs">' + summary.entries.map((entry) => '<span class="reactionMetric" data-kind="' + entry.kind + '"><b>' + entry.glyph + '</b><em>' + entry.count + '</em></span>').join("") + '</i>';
}

function viewerReactionSummaryMarkup(counts = {}, viewerReaction = null) {
  const summary = reactionSummary(counts);
  const selectedKind = REACTION_GLYPHS[viewerReaction] ? viewerReaction : null;
  const primary = selectedKind
    ? { kind: selectedKind, glyph: REACTION_GLYPHS[selectedKind] }
    : { kind: "LIKE", glyph: REACTION_GLYPHS.LIKE };
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  // An untouched control keeps the crisp white heart used by the action rail. Once the viewer chooses a
  // reaction, the control mirrors that exact choice everywhere (feed, viewer, profile and post detail).
  const primaryMark = selectedKind && selectedKind !== "LIKE"
    ? primary.glyph
    : solidViewerIcon("heart", "viewerReactionHeart");
  return '<i class="reactionSummaryGlyphs viewerPrimaryReaction"><span class="reactionMetric" data-kind="' + primary.kind + '"><b>' + primaryMark + '</b><em>' + total + '</em></span></i>';
}

const REACTION_OPTIONS = Object.freeze([
  ["LIKE", "♥", "reaction.like"], ["LOVE", "💗", "reaction.love"],
  ["HAHA", "😂", "reaction.haha"], ["WOW", "😮", "reaction.wow"],
  ["SAD", "😢", "reaction.sad"], ["ANGRY", "😠", "reaction.angry"],
  ["FAKE_OPINION", "◆", "reaction.fake"], ["DISLIKE", "▼", "reaction.dislike"],
]);

function reactionLabel(kind) {
  return t(REACTION_OPTIONS.find(([candidate]) => candidate === kind)?.[2] || "post.reactions");
}

function followButtonLabel({ active = false, pending = false } = {}) {
  return t(active ? "post.following" : pending ? "post.requested" : "post.follow");
}

function applyReactionSummary(button, counts = {}, viewerReaction) {
  if (!button) return;
  const summary = reactionSummary(counts);
  const icon = button.querySelector("i");
  if (icon) icon.innerHTML = button.dataset.viewerReactions !== undefined || button.dataset.reactionDisplay === "compact"
    ? viewerReactionSummaryMarkup(counts, viewerReaction).replace(/^<i[^>]*>|<\/i>$/g, "")
    : summary.entries.map((entry) => '<span class="reactionMetric" data-kind="' + entry.kind + '"><b>' + entry.glyph + '</b><em>' + entry.count + '</em></span>').join("");
  button.classList.toggle("distributedReactions", summary.distributed);
  if (viewerReaction !== undefined) button.classList.toggle("on", Boolean(viewerReaction));
  button.setAttribute("aria-label", t("post.reactions") + ": " + summary.entries.map((entry) => reactionLabel(entry.kind) + " " + entry.count).join(", "));
}

function compareCommentImportance(a, b) {
  const reactionDelta = commentReactionTotal(b) - commentReactionTotal(a);
  if (reactionDelta) return reactionDelta;
  const replyDelta = Number(b?.reply_count || 0) - Number(a?.reply_count || 0);
  if (replyDelta) return replyDelta;
  return Number(b?.created_at || b?.id || 0) - Number(a?.created_at || a?.id || 0);
}

function renderCommentLine(comment, postId = null, depth = 0, parentHandle = "") {
  const name = comment.display_name || comment.handle || "Nexus";
  const initials = name.slice(0, 2).toUpperCase();
  const avatarUrl = safeInternalMediaUrl(comment.avatar);
  const avatar = avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(initials);
  const reactionTotal = commentReactionTotal(comment);
  const replies = Number(comment.reply_count || 0);
  const shares = Math.max(0, Number(comment.reply_shares || 0));
  const views = Math.max(0, Number(comment.views || 0));
  const replyingTo = parentHandle ? '<span class="replyContext"><bdi dir="ltr">@' + esc(parentHandle) + '</bdi></span> ' : '';
  const withdrawn = comment.status === "withdrawn";
  const own = Number(comment.user_id) === Number(state?.user?.id) && comment.actor_persona === state?.persona;
  const pinControl = comment.can_pin && !withdrawn ? '<button type="button" data-comment-pin="' + Number(comment.id) + '" data-active="' + (comment.pinned_by_owner ? "1" : "0") + '">' + esc(t(comment.pinned_by_owner ? "comments.unpin" : "comments.pin")) + '</button>' : '';
  const controls = Number(comment.id) > 0
    ? '<span class="commentManage">' + pinControl + (own && !withdrawn
      ? '<button type="button" data-comment-edit="' + Number(comment.id) + '" data-comment-current="' + esc(comment.body || "") + '">' + esc(t("comments.edit")) + '</button><button type="button" data-comment-withdraw="' + Number(comment.id) + '">' + esc(t("comments.withdraw")) + '</button>'
      : (!withdrawn ? '<button type="button" data-comment-report="' + Number(comment.id) + '">' + esc(t("comments.report")) + '</button>' : '')) + '</span>'
    : '';
  const text = withdrawn ? '<em class="commentTombstone">' + esc(t("comments.withdrawnTombstone")) + '</em>' : esc(comment.body || "");
  const expandControl = withdrawn ? '' : '<button class="commentExpandToggle" type="button" data-comment-expand aria-expanded="false" hidden>' + esc(t("post.seeMore")) + '</button>';
  const timestamp = Number(comment.created_at) > 0 ? relativeStamp(Number(comment.created_at)) : '';
  const commentActions = Number(comment.id) > 0 && !withdrawn
    ? '<div class="commentActions">'
      + '<button type="button" data-reply-to="' + Number(comment.id) + '" data-reply-handle="' + esc(comment.handle || "user") + '" data-post-id="' + Number(postId || comment.post_id || 0) + '" aria-label="' + esc(t("comments.reply")) + '"><i>' + solidViewerIcon("comment") + '</i><small>' + replies + '</small></button>'
      + '<button type="button" data-comment-share="' + Number(comment.id) + '" class="' + (comment.shared_by_me ? 'on' : '') + '" aria-pressed="' + String(comment.shared_by_me === true) + '" aria-label="' + esc(t("x.reply.share")) + '"><i>' + solidViewerIcon("repost") + '</i><small>' + shares + '</small></button>'
      + '<button type="button" data-comment-like="' + Number(comment.id) + '" class="' + (comment.reactions?.viewer_reaction ? 'on' : '') + '" aria-label="' + esc(t("post.reactions")) + '"><i>' + solidViewerIcon("heart") + '</i><small>' + reactionTotal + '</small></button>'
      + '<button type="button" data-comment-save="' + Number(comment.id) + '" class="' + (comment.saved_by_me ? 'on' : '') + '" aria-pressed="' + String(comment.saved_by_me === true) + '" aria-label="' + esc(t(comment.saved_by_me ? "post.saved" : "x.reply.save")) + '"><i>' + solidViewerIcon("save") + '</i></button>'
      + '<span class="commentViews" role="img" aria-label="' + esc(t("x.reply.views") + ': ' + views) + '"><i>' + solidViewerIcon("views") + '</i><small>' + views + '</small></span>'
      + '</div>'
    : '<div class="commentActions withdrawn"><span class="commentViews"><i>' + solidViewerIcon("views") + '</i><small>' + views + '</small></span></div>';
  return '<article class="c commentRow ' + (depth ? "reply" : "") + '" data-comment-id="' + Number(comment.id || 0) + '" style="--reply-depth:' + Math.min(5, Math.max(0, Number(depth) || 0)) + '">'
    + '<button class="commentAvatar" type="button" data-creator-profile="' + esc(comment.handle || "user") + '" aria-label="' + esc(t("post.viewProfile") + " " + name) + '">' + avatar + '</button>'
    + '<div class="commentBody"><header><b><bdi dir="auto">' + esc(name) + '</bdi></b><small class="commentHandle"><bdi dir="ltr">@' + esc(comment.handle || "user") + '</bdi></small>' + (timestamp ? '<time>' + esc(timestamp) + '</time>' : '') + controls + '</header>'
    + '<div class="commentTextBlock"><p>' + replyingTo + text + '</p>' + expandControl + '</div>' + commentActions + '</div></article>';
}

function renderCommentThread(comments, postId = null) {
  const sort = arguments[2] === "newest" ? "newest" : "relevant";
  const safeComments = Array.isArray(comments) ? comments : [];
  const byId = new Map(safeComments.map((comment) => [Number(comment.id), comment]));
  const children = new Map();
  safeComments.forEach((comment) => {
    const parentId = Number(comment.parent_id || 0);
    if (!parentId || !byId.has(parentId)) return;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(comment);
  });
  const roots = safeComments.filter((comment) => !Number(comment.parent_id || 0) || !byId.has(Number(comment.parent_id)));
  const order = sort === "newest"
    ? (a, b) => Number(b?.created_at || b?.id || 0) - Number(a?.created_at || a?.id || 0)
    : compareCommentImportance;
  const renderBranch = (comment, depth = 0, parentHandle = "") => {
    const replies = (children.get(Number(comment.id)) || []).sort(order);
    const nested = replies.length
      ? '<button class="commentRepliesToggle" type="button" data-comment-replies aria-expanded="false">' + esc(t("comments.viewReplies")) + ' (+' + replies.length + ')</button><div class="commentReplyChildren" hidden>' + replies.map((reply, index) => '<div class="commentReplyBranch"' + (index ? ' hidden' : '') + '>' + renderBranch(reply, depth + 1, comment.handle || "user") + '</div>').join("") + '</div>'
      : '';
    return renderCommentLine(comment, postId, depth, parentHandle) + nested;
  };
  return roots.sort(order).map((comment) => '<section class="commentThread">' + renderBranch(comment) + '</section>').join("");
}

function commentCreatorMarkup(post) {
  const author = post?.author || {};
  const name = author.display_name || author.handle || "Nexus";
  const handle = author.handle || "creator";
  const avatarUrl = safeInternalMediaUrl(author.avatar);
  const avatar = avatarUrl ? '<img src="' + esc(avatarUrl) + '" alt="" />' : esc(name.slice(0, 2).toUpperCase());
  const authorId = Number(post?.user_id || author.id || 0);
  const owner = authorId === Number(state?.user?.id) && post?.persona === state?.persona;
  return '<div class="commentPostCreator"><button type="button" data-creator-profile="' + esc(handle) + '" class="commentPostIdentity"><i>' + avatar + '</i><span><b><bdi dir="auto">' + esc(name) + '</bdi></b><small><bdi dir="ltr">@' + esc(handle) + '</bdi></small></span></button>'
    + (owner || !authorId ? '' : '<button class="commentFollow" type="button" data-follow="' + authorId + '" data-active="' + (post.following_me ? 1 : 0) + '" data-pending="' + (post.follow_request_pending ? 1 : 0) + '">' + esc(followButtonLabel({ active: post.following_me, pending: post.follow_request_pending })) + '</button>') + '</div>';
}

function commentPostActionsMarkup(post) {
  const id = Number(post?.id || 0);
  const reactions = post?.reactions?.counts || {};
  const repostLabel = t(post?.kind === "text" ? "post.retweet" : "post.repost");
  return '<div class="commentPostActions" aria-label="' + esc(t("post.actions")) + '">'
    + '<button type="button" data-reaction-toggle="' + id + '" data-reaction-display="compact" class="' + (post?.reactions?.viewer_reaction ? 'on' : '') + '" aria-label="' + esc(t("post.openReactions")) + '" aria-expanded="false">' + viewerReactionSummaryMarkup(reactions, post?.reactions?.viewer_reaction) + '</button>'
    + '<span data-comment-count-post="' + id + '" aria-label="' + esc(t("comments.title")) + '"><i>' + solidViewerIcon("comment") + '</i><small>' + Number(post?.comment_count || 0) + '</small></span>'
    + '<button type="button" data-repost="' + id + '" class="' + (post?.reposted_by_me ? 'on' : '') + '" aria-label="' + esc(repostLabel) + '"><i>' + solidViewerIcon("repost") + '</i><small>' + Number(post?.reposts || 0) + '</small></button>'
    + '<button type="button" data-save="' + id + '" class="' + (post?.saved_by_me ? 'on' : '') + '" aria-label="' + esc(t("post.save")) + '"><i>' + solidViewerIcon("save") + '</i></button>'
    + (SOCIAL_SHARING_ENABLED ? '<button type="button" data-share="' + id + '" aria-label="' + esc(t("post.share")) + '"><i>' + solidViewerIcon("share") + '</i></button>' : '') + '</div>';
}

function commentSortMarkup() {
  return '<nav class="commentSort" aria-label="' + esc(t("comments.title")) + '"><button type="button" data-comment-sort="relevant" class="active">' + esc(t("comments.relevant")) + '</button><button type="button" data-comment-sort="newest">' + esc(t("comments.newest")) + '</button></nav>';
}

function commentComposerMarkup(postId) {
  return '<form class="commentComposer" data-comment-form="' + Number(postId) + '"><input name="body" placeholder="' + esc(t("comments.input")) + '" autocomplete="off" /><button class="cancelReply" type="button" data-cancel-reply aria-label="' + esc(t("comments.cancelReply")) + '" hidden>×</button><button class="commentSend" type="submit" aria-label="' + esc(t("comments.send")) + '">➤</button></form>';
}

function wireCommentReplyInputs(scope) {
  if (!scope) return;
  scope.querySelectorAll("[data-reply-to]").forEach((reply) => reply.addEventListener("click", (event) => {
    event.stopPropagation();
    const input = scope.querySelector('input[name="body"]');
    if (!input) return;
    input.dataset.parentId = reply.dataset.replyTo;
    input.placeholder = t("comments.replyTo") + " @" + reply.dataset.replyHandle;
    scope.querySelector("[data-cancel-reply]")?.removeAttribute("hidden");
    input.focus();
  }));
  const cancelReply = scope.querySelector("[data-cancel-reply]");
  if (cancelReply) cancelReply.onclick = (event) => {
    const input = scope.querySelector('input[name="body"]');
    if (!input) return;
    delete input.dataset.parentId;
    input.placeholder = t("comments.input");
    event.currentTarget.setAttribute("hidden", "");
    input.focus();
  };
}

function bindCommentProfiles(scope) {
  scope?.querySelectorAll(".commentRow [data-creator-profile]").forEach((button) => {
    if (button.dataset.commentProfileBound === "1") return;
    button.dataset.commentProfileBound = "1";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openCreatorProfile(button.dataset.creatorProfile);
    });
  });
}

function wireCommentReplies(scope) {
  wireCommentExpansions(scope);
  scope?.querySelectorAll("[data-comment-replies]").forEach((button) => {
    if (button.dataset.repliesBound === "1") return;
    button.dataset.repliesBound = "1";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const box = button.nextElementSibling;
      const replies = [...(box?.children || [])];
      if (!box || !replies.length) return;
      if (box.hidden) {
        box.hidden = false;
        replies.forEach((reply, index) => { reply.hidden = index > 0; });
      } else {
        const next = replies.find((reply) => reply.hidden);
        if (next) next.hidden = false;
        else {
          box.hidden = true;
          replies.forEach((reply, index) => { reply.hidden = index > 0; });
        }
      }
      const remaining = replies.filter((reply) => reply.hidden).length;
      const open = !box.hidden;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open && !remaining ? t("comments.hideReplies") : t("comments.viewReplies") + " (+" + (open ? remaining : replies.length) + ")";
    });
  });
}

function wireCommentExpansions(scope) {
  scope?.querySelectorAll("[data-comment-expand]").forEach((button) => {
    if (button.dataset.commentExpandBound === "1") return;
    button.dataset.commentExpandBound = "1";
    const row = button.closest(".commentRow");
    const paragraph = row?.querySelector(".commentTextBlock>p");
    if (!row || !paragraph) return;
    requestAnimationFrame(() => {
      if (!button.isConnected || !paragraph.isConnected) return;
      button.hidden = paragraph.scrollHeight <= paragraph.clientHeight + 1;
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const expanded = !row.classList.contains("commentExpanded");
      row.classList.toggle("commentExpanded", expanded);
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = t(expanded ? "post.seeLess" : "post.seeMore");
    });
  });
}

function renderDemoCommentSurface(scope, postId) {
  const sort = scope.dataset.commentSortActive || "relevant";
  const comments = demoCommentsForPost(postId);
  if (sort === "newest") comments.sort((a, b) => Number(b.created_at || b.id || 0) - Number(a.created_at || a.id || 0));
  scope._nexusComments = comments;
  const list = scope.querySelector(".clist");
  if (list) list.innerHTML = renderCommentThread(comments, postId, sort);
  wireCommentReplyInputs(scope);
  wireCommentActionRows(scope);
  wireCommentReplies(scope);
  bindCommentProfiles(scope);
}

function wireCommentSurfaceControls(scope, postId) {
  if (!scope) return;
  scope.dataset.commentSortActive ||= "relevant";
  scope.querySelectorAll("[data-comment-sort]").forEach((button) => {
    button.classList.toggle("active", button.dataset.commentSort === scope.dataset.commentSortActive);
    button.onclick = () => {
      const sort = button.dataset.commentSort === "newest" ? "newest" : "relevant";
      if (sort === scope.dataset.commentSortActive) return;
      scope.dataset.commentSortActive = sort;
      scope.querySelectorAll("[data-comment-sort]").forEach((option) => option.classList.toggle("active", option.dataset.commentSort === sort));
      const list = scope.querySelector(".clist");
      if (list) list.innerHTML = '<p class="commentLoading">' + esc(t("comments.loading")) + '</p>';
      if (postId < 0) renderDemoCommentSurface(scope, postId);
      else loadCommentList(scope, postId, 0, sort);
    };
  });
  bindCommentProfiles(scope);
}

function clipCommentPreview(post) {
  if (socialFormat !== "clips") return "";
  const comments = post.comment_preview?.length ? post.comment_preview : [];
  if (!comments.length) {
    return '<div class="clipCommentPreview neuralComments"><div class="commentSlab empty"><i class="commentAvatar">＋</i><span><b>' + esc(t("comments.previewTitle")) + '</b><small>' + esc(t("comments.previewDetail")) + '</small></span><em>' + esc(t("comments.previewLabel")) + '</em></div></div>';
  }
  return '<div class="clipCommentPreview neuralComments" data-comments-preview="' + post.id + '">' + comments.slice(0, 2).map((comment, index) => '<div class="commentSlab c' + index + '"><i class="commentAvatar">' + esc((comment.display_name || comment.handle || "NX").slice(0, 2).toUpperCase()) + '</i><span><b><bdi dir="ltr">@' + esc(comment.handle || "user") + '</bdi></b><small>' + esc(comment.body || "") + '</small></span><em>♡ ' + (index ? "8" : "12") + '</em></div>').join("") + '</div>';
}

// The feed card and the profile Whispers timeline share these two pieces, so a control
// can never exist on one surface without behaving on the other.
function reactionPaletteMarkup(post, currentReaction = null) {
  return '<div class="reactionBar xPalette" aria-label="' + esc(t("post.chooseReaction")) + '" aria-hidden="true">' + REACTION_OPTIONS.map(([kind, icon, key]) => { const label = t(key); return '<button data-reaction="' + kind + '" data-post="' + post.id + '" class="' + (currentReaction === kind ? "on" : "") + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"><span>' + icon + '</span><small>' + esc(label) + '</small></button>'; }).join("") + '</div>';
}

// Feed and full-screen render the very same conversation body. Only the containing sheet and
// its close control differ, so comments, post reactions, sorting and composing cannot drift.
function commentSurfaceMarkup(post, { closeAttribute = "data-close-comments", loading = false } = {}) {
  const postId = Number(post?.id || 0);
  const loadingMarkup = loading ? '<p class="commentLoading">' + esc(t("comments.loading")) + '</p>' : '';
  return '<button class="commentBack" type="button" ' + closeAttribute + ' aria-label="' + esc(t("x.detail.back")) + '">←</button>'
    + '<article class="commentSurfacePost">' + commentCreatorMarkup(post) + commentPostActionsMarkup(post) + reactionPaletteMarkup(post, post?.reactions?.viewer_reaction || null) + '</article>'
    + commentSortMarkup()
    + '<div class="clist" role="feed">' + loadingMarkup + '</div>'
    + commentComposerMarkup(postId);
}

function commentsDrawerMarkup(post) {
  return '<button class="commentsScrim hidden" type="button" data-comments-scrim="' + post.id + '" aria-label="' + esc(t("comments.close")) + '"></button><section class="comments clipCommentsDrawer hidden" id="comments-' + post.id + '" role="dialog" aria-modal="true" aria-label="Comments" tabindex="-1" data-comment-post-id="' + Number(post.id) + '" data-comment-sort-active="relevant">' + commentSurfaceMarkup(post) + '</section>';
}

function profileWhisperControls(post) {
  return {
    summary: reactionSummaryMarkup(post.reactions?.counts || {}),
    palette: reactionPaletteMarkup(post, post.reactions?.viewer_reaction || null),
    drawer: commentsDrawerMarkup(post),
  };
}

// A "views" number always describes real people: the server counts distinct human readers
// and a post nobody read shows nothing instead of a decorative zero.
function postViewsCount(post) {
  const value = Number(post?.view_stats?.viewers);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function postViewsMarkup(post, { compact = false } = {}) {
  const count = postViewsCount(post);
  if (!count) return '';
  const aria = t("x.views.aria") + ": " + count;
  return '<span class="postViews' + (compact ? ' compact' : '') + '" role="img" aria-label="' + esc(aria) + '" title="' + esc(aria) + '"><i aria-hidden="true">◉</i><b>' + count + '</b>' + (compact ? '' : '<small>' + esc(t("x.views.label")) + '</small>') + '</span>';
}

function localeTimeTag() {
  return ({ ro: "ro-RO", pl: "pl-PL", ar: "ar-EG" })[interfaceLocale] || "en-US";
}

function relativeStamp(createdAt) {
  return profileRelativeTime(createdAt, Date.now(), localeTimeTag());
}

// The ••• menu of every post and every reply. One builder, so the timeline, the post page
// and the thread can never disagree about which actions exist.
// A repost is an internal share, so the card says whose share it is: the reposter's name, or
// "you reposted" on your own profile. The post below keeps its own author and timestamp.
function repostHeaderMarkup(repost) {
  if (!repost) return '';
  const mine = repost.mine === true || Number(repost.reposter?.id) === Number(state?.user?.id);
  const handle = String(repost.reposter?.handle || "");
  return '<div class="postRepostedBy">⟳ <b>' + esc(t(mine ? "x.repost.mine" : "x.repost.by")) + '</b>'
    + (mine || !handle ? '' : ' <bdi dir="ltr">@' + esc(handle) + '</bdi>') + '</div>';
}

function postOptionsMenuMarkup(post, { owner = false, commentId = null, muted = false, blocked = false } = {}) {
  const rows = [];
  const authorId = Number(post.user_id);
  const handle = String(post.author?.handle || post.handle || "");
  const favorites = (() => { try { const list = readSocialFavorites(); return Array.isArray(list) ? list.map(Number) : []; } catch { return []; } })();
  if (owner) {
    rows.push('<button type="button" data-post-manage="' + Number(post.id) + '">' + esc(t("post.manage")) + '</button>');
    rows.push('<button type="button" data-post-history="' + Number(post.id) + '">' + esc(t("post.history")) + '</button>');
  } else if (commentId === null) {
    rows.push('<button type="button" data-creator-profile="' + esc(handle) + '">' + esc(t("post.viewProfile")) + '</button>');
    rows.push('<button type="button" data-creator-message="' + esc(handle) + '">' + esc(t("post.message")) + '</button>');
    rows.push('<button type="button" data-follow="' + authorId + '" data-active="' + (post.following_me ? 1 : 0) + '" data-pending="' + (post.follow_request_pending ? 1 : 0) + '">' + esc(followButtonLabel({ active: post.following_me, pending: post.follow_request_pending })) + '</button>');
    const favorite = favorites.includes(authorId);
    rows.push('<button type="button" data-favorite="' + authorId + '" data-active="' + (favorite ? 1 : 0) + '">' + esc(t(favorite ? "x.menu.unfavorite" : "x.menu.favorite")) + '</button>');
    const isMuted = muted || post.muted_by_me === true;
    rows.push('<button type="button" data-mute="' + authorId + '" data-active="' + (isMuted ? 1 : 0) + '">' + esc(t(isMuted ? "x.menu.unmute" : "x.menu.mute")) + '</button>');
    const isBlocked = blocked || post.blocked_by_me === true;
    rows.push('<button type="button" data-block="' + authorId + '" data-active="' + (isBlocked ? 1 : 0) + '">' + esc(t(isBlocked ? "x.menu.unblock" : "x.menu.block")) + '</button>');
  }
  if (commentId === null) {
    rows.push('<button type="button" data-not-interested="' + Number(post.id) + '">' + esc(t("post.notInterested")) + '</button>');
    if (post.reposted_by_me) rows.push('<button type="button" data-repost-undo="' + Number(post.id) + '">' + esc(t("x.repost.undo")) + '</button>');
    rows.push('<button type="button" data-copy-link="' + Number(post.id) + '">' + esc(t("x.menu.copyLink")) + '</button>');
    rows.push('<button type="button" data-report="' + Number(post.id) + '">' + esc(t("post.report")) + '</button>');
    rows.push('<button type="button" data-report-illegal="' + Number(post.id) + '">' + esc(t("x.menu.reportIllegal")) + '</button>');
    rows.push('<button type="button" data-note-request="' + Number(post.id) + '">' + esc(t("x.menu.requestNote")) + '</button>');
  } else {
    rows.push('<button type="button" data-comment-report="' + Number(commentId) + '">' + esc(t("x.reply.report")) + '</button>');
    rows.push('<button type="button" data-comment-note="' + Number(commentId) + '">' + esc(t("x.menu.requestNote")) + '</button>');
  }
  if (Array.isArray(post.ranking?.reasons) && post.ranking.reasons.length) {
    rows.push('<button type="button" data-why="' + Number(post.id) + '">' + esc(t("x.menu.why")) + '</button>');
  }
  return '<div class="postCreatorMenu postOptionsMenu" hidden>' + rows.join("") + '</div>';
}

// The post page is a module of its own; this glue hands it the same helpers every other
// surface already uses, so nothing is re-implemented for it.
let postDetailSurface = null;
function postDetailApi() {
  postDetailSurface ??= createPostDetailSurface({
    get state() { return state; },
    get t() { return t; },
    esc,
    api,
    toast,
    safeUrl: safeInternalMediaUrl,
    menuMarkup: postOptionsMenuMarkup,
    postViewsMarkup,
    postViewsCount,
    reactionPaletteMarkup,
    reactionSummaryMarkup,
    followButtonLabel,
    relativeStamp,
    wirePostActions,
    // The post page reuses the timeline builders for captions and galleries instead of inventing
    // its own: one caption linkifier, one carousel.
    captionFor: captionWithTagsMarkup,
    carouselFor: mediaCarouselMarkup,
    // The post page explains a post with the same reason line the card uses.
    rankingReasonMarkup,
    newMutationKey: newUploadMutationKey,
    sharingEnabled: SOCIAL_SHARING_ENABLED,
    registerOverlay: registerCommentOverlay,
    afterOverlayRegistered: (id) => {
      if (location.hash === "#post-" + id) return;
      try { history.replaceState(history.state, "", "#post-" + id); } catch { /* the hash is an enhancement */ }
    },
    afterClose: (id) => {
      if (Number(id) > 0 && location.hash !== "#post-" + Number(id)) return;
      if (!location.hash) return;
      try { history.replaceState(history.state, "", location.pathname + location.search); } catch { /* ignore */ }
    },
    dismissOverlay: (layer, fromHistory) => (commentOverlayNavigation?.element === layer ? dismissCommentOverlay({ fromHistory }) : false),
    toggleCommentLike,
    toggleCommentSave,
    // Opening the post page is a real view: the post and the replies that were on screen
    // get their impression, which is what makes the counter honest.
    recordImpressions: (result) => {
      if (result?.post?.id) queueSocialImpression(result.post.id, 1500, true);
      queueCommentImpressions((result.comments || []).map((comment) => comment.id));
    },
  });
  return postDetailSurface;
}

function openPostDetail(postId, options) {
  return postDetailApi().open(postId, options);
}

function closePostDetail(options) {
  const closed = postDetailApi().close(options);
  if (/^#post-\d+$/.test(location.hash)) {
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch { /* ignore */ }
  }
  return closed;
}

// A caption is text with real links in it: #hashtags and $cashtags become buttons, and every
// other character is escaped exactly once (so an escaped quote can never look like a tag).
function captionWithTagsMarkup(text) {
  const source = String(text ?? "");
  const pattern = /(^|[^\p{L}\p{N}_#$/])([#$])([\p{L}\p{N}_]{2,50})/gu;
  let out = "";
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const marker = match[2];
    const raw = match[3];
    const kind = marker === "#" ? "hashtag" : "cashtag";
    if (kind === "cashtag" && !/^[A-Za-z]{2,10}$/.test(raw)) continue;
    const start = match.index + match[1].length;
    out += esc(source.slice(last, start)) + tagChipMarkup(kind, raw);
    last = start + 1 + raw.length;
  }
  return out + esc(source.slice(last));
}

function tagChipMarkup(kind, raw) {
  const normalizedKind = kind === "cashtag" ? "cashtag" : "hashtag";
  const value = String(raw ?? "").toLowerCase();
  if (!value) return "";
  return '<button type="button" class="tagChip" data-tag-kind="' + normalizedKind + '" data-tag="' + esc(value) + '">'
    + esc((normalizedKind === "cashtag" ? "$" : "#") + value) + '</button>';
}

// The ordered media of a post, with the single-cover fallback for posts written before the
// gallery existed, so the interface never has two ways to mean the same thing.
function postMediaList(post) {
  const list = Array.isArray(post?.media_list)
    ? post.media_list.filter((item) => item && item.hash && item.ext).slice(0, 10)
    : [];
  if (list.length) return list;
  return post?.media?.hash ? [{ ...post.media, position: 0 }] : [];
}

function mediaUrlFor(item) {
  return item?.hash && item?.ext ? "/media/" + item.hash + "." + item.ext : null;
}

// Several media are read as a carousel: one slide each, a counter and dots. Tapping a slide opens
// the media itself; a single-media post keeps the creator-studio rendering it always had.
function mediaCarouselMarkup(post) {
  const items = postMediaList(post);
  if (items.length < 2) return "";
  return '<div class="mediaCarousel" data-carousel="' + Number(post.id) + '" data-media-count="' + items.length + '" role="group" aria-label="' + esc(t("post.gallery")) + '">'
    + '<div class="mediaCarouselTrack">' + items.map((item, index) => {
      const url = mediaUrlFor(item);
      return '<button type="button" class="mediaSlide" data-media-index="' + index + '" data-media-post="' + Number(post.id) + '" aria-label="' + esc(t("post.openMedia") + " " + (index + 1) + "/" + items.length) + '">'
        + (item.kind === "video"
          ? '<video src="' + esc(url) + '" muted playsinline preload="metadata"></video><i>▶</i>'
          : '<img src="' + esc(url) + '" alt="" />')
        + '</button>';
    }).join("") + '</div>'
    + '<span class="mediaCounter" aria-hidden="true">1/' + items.length + '</span>'
    + '<span class="mediaDots" aria-hidden="true">' + items.map((_, index) => '<i' + (index === 0 ? ' class="on"' : '') + '></i>').join("") + '</span>'
    + '</div>';
}

// The carousel opens the media itself: no reactions and no comments, because the reader asked to
// look at a picture, not to act on a post.
let mediaLightboxState = null;

function closeMediaLightbox() {
  document.getElementById("mediaLightbox")?.remove();
  mediaLightboxState = null;
}

function openMediaLightbox(post, index = 0) {
  const items = postMediaList(post);
  if (!items.length) return;
  closeMediaLightbox();
  const host = document.querySelector(".phoneScreen") || app;
  const start = Math.max(0, Math.min(items.length - 1, Number(index) || 0));
  host.insertAdjacentHTML("beforeend", '<div class="mediaLightbox" id="mediaLightbox" role="dialog" aria-modal="true" aria-labelledby="mediaLightboxLabel" tabindex="-1"><span id="mediaLightboxLabel" hidden>' + esc(t("post.openMedia")) + '</span><div class="mediaLightboxBody"></div><button type="button" class="mediaLightboxClose" data-lightbox-close aria-label="' + esc(t("common.close")) + '">×</button><button type="button" class="mediaLightboxNav prev" data-lightbox-prev aria-label="' + esc(t("post.previousMedia")) + '">‹</button><button type="button" class="mediaLightboxNav next" data-lightbox-next aria-label="' + esc(t("post.nextMedia")) + '">›</button><span class="mediaLightboxCounter" aria-live="polite"></span></div>');
  const layer = document.getElementById("mediaLightbox");
  mediaLightboxState = { postId: Number(post.id), items, index: start, layer };
  const render = () => {
    const current = mediaLightboxState;
    if (!current || !layer.isConnected) return;
    const item = current.items[current.index];
    const url = mediaUrlFor(item);
    const body = layer.querySelector(".mediaLightboxBody");
    if (body) body.innerHTML = item.kind === "video"
      ? '<video src="' + esc(url) + '" controls autoplay muted playsinline></video>'
      : '<img src="' + esc(url) + '" alt="" />';
    const counter = layer.querySelector(".mediaLightboxCounter");
    if (counter) counter.textContent = (current.index + 1) + "/" + current.items.length;
    const single = current.items.length < 2;
    layer.querySelector("[data-lightbox-prev]").hidden = single;
    layer.querySelector("[data-lightbox-next]").hidden = single;
  };
  layer.addEventListener("click", (event) => {
    if (event.target === layer || event.target.closest("[data-lightbox-close]")) return closeMediaLightbox();
    if (!mediaLightboxState) return;
    if (event.target.closest("[data-lightbox-prev]")) {
      mediaLightboxState.index = (mediaLightboxState.index - 1 + mediaLightboxState.items.length) % mediaLightboxState.items.length;
      return render();
    }
    if (event.target.closest("[data-lightbox-next]")) {
      mediaLightboxState.index = (mediaLightboxState.index + 1) % mediaLightboxState.items.length;
      return render();
    }
  });
  layer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.stopPropagation(); return closeMediaLightbox(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); layer.querySelector("[data-lightbox-prev]")?.click(); }
    if (event.key === "ArrowRight") { event.preventDefault(); layer.querySelector("[data-lightbox-next]")?.click(); }
  });
  render();
  layer.focus({ preventScroll: true });
}

// A tag page answers with the posts that really carry the tag, plus the honest counts behind it:
// how many posts and how many distinct people wrote them.
let tagPageState = null;

function closeTagPage() {
  document.getElementById("tagPage")?.remove();
  tagPageState = null;
}

function tagPageHeadMarkup(kind, tag, stats) {
  const safe = stats && Number(stats.posts) >= 0 ? stats : { posts: 0, authors: 0 };
  return '<b>' + esc((kind === "cashtag" ? "$" : "#") + tag) + '</b>'
    + '<small>' + Number(safe.posts) + ' ' + esc(t("tags.posts")) + ' · ' + Number(safe.authors) + ' ' + esc(t("tags.authors")) + '</small>';
}

async function loadTagPage({ reset = false } = {}) {
  const current = tagPageState;
  const layer = current?.layer;
  if (!current || !layer?.isConnected) return;
  const before = reset ? null : current.nextBefore;
  const result = await api("/api/social/tags/" + current.kind + "/" + encodeURIComponent(current.tag) + "?limit=20" + (before ? "&before=" + encodeURIComponent(before) : "")).catch(() => null);
  if (!tagPageState || tagPageState.layer !== layer || !layer.isConnected) return;
  if (!result?.ok || result.kind !== current.kind || result.tag !== current.tag || !Array.isArray(result.posts)) {
    layer.querySelector(".tagPageList").innerHTML = '<div class="detailEmpty"><b>' + esc(t("tags.unavailable")) + '</b></div>';
    return;
  }
  const posts = reset ? result.posts : [...(tagPageState.posts || []), ...result.posts];
  tagPageState = { ...tagPageState, posts, stats: result.stats, nextBefore: result.next_before ?? null };
  const head = layer.querySelector(".tagPageHead");
  if (head) head.innerHTML = tagPageHeadMarkup(current.kind, current.tag, result.stats);
  const list = layer.querySelector(".tagPageList");
  list.innerHTML = posts.length
    ? posts.map((post) => postCard(post)).join("")
    : '<div class="detailEmpty"><b>' + esc(t("tags.empty")) + '</b><span>' + esc(t("tags.emptyDetail")) + '</span></div>';
  const more = layer.querySelector("[data-tag-more]");
  if (more) more.hidden = !result.next_before;
  wirePostActions(list, posts);
  if (reset) layer.querySelector(".tagPageScroll")?.scrollTo({ top: 0 });
}

async function openTagPage(kind, tag) {
  const normalizedKind = kind === "cashtag" ? "cashtag" : "hashtag";
  const normalizedTag = String(tag || "").trim().toLowerCase();
  if (!/^[\p{L}\p{N}_]{2,50}$/u.test(normalizedTag)) return;
  closeTagPage();
  closeMediaLightbox();
  const host = document.querySelector(".phoneScreen") || app;
  const returnFocus = document.activeElement;
  host.insertAdjacentHTML("beforeend", '<section class="tagPageLayer" id="tagPage" role="dialog" aria-modal="true" aria-labelledby="tagPageLabel" tabindex="-1"><header class="tagPageBar"><button type="button" data-tag-back aria-label="' + esc(t("x.detail.back")) + '">‹</button><span id="tagPageLabel"><b>' + esc((normalizedKind === "cashtag" ? "$" : "#") + normalizedTag) + '</b></span></header><div class="tagPageHead"></div><div class="tagPageScroll"><div class="tagPageList"></div><button class="socialFeedMore" type="button" data-tag-more hidden>' + esc(t("search.more")) + '</button></div></section>');
  const layer = document.getElementById("tagPage");
  tagPageState = { kind: normalizedKind, tag: normalizedTag, layer, posts: [], stats: null, nextBefore: null };
  registerCommentOverlay(layer, returnFocus, () => closeTagPage());
  const back = () => {
    if (commentOverlayNavigation?.element === layer) dismissCommentOverlay();
    else closeTagPage();
  };
  layer.querySelector("[data-tag-back]")?.addEventListener("click", back);
  layer.querySelector("[data-tag-more]")?.addEventListener("click", () => { void loadTagPage(); });
  layer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); back(); } });
  await loadTagPage({ reset: true });
}

function trendingMarkup(tags, kind) {
  if (!Array.isArray(tags) || !tags.length) return "";
  return '<section class="socialTrends"><header><b>' + esc(t(kind === "cashtag" ? "tags.trendingCashtags" : "tags.trending")) + '</b><small>' + esc(t("tags.trendingTruth")) + '</small></header><div>'
    + tags.map((entry, index) => '<button type="button" data-trend-kind="' + kind + '" data-trend-tag="' + esc(entry.tag) + '"><em>' + (index + 1) + '</em><span><b>' + esc((kind === "cashtag" ? "$" : "#") + (entry.display || entry.tag)) + '</b><small>' + Number(entry.authors) + ' ' + esc(t("tags.authors")) + '</small></span></button>').join("")
    + '</div></section>';
}

async function loadSocialTrends(host) {
  if (!host) return;
  const [hashtags, cashtags] = await Promise.all([
    api("/api/social/tags?kind=hashtag&limit=6").catch(() => null),
    api("/api/social/tags?kind=cashtag&limit=5").catch(() => null),
  ]);
  if (!host.isConnected || state?.persona !== "social") return;
  const safeTags = (result, kind) => (result?.ok === true && result.kind === kind && Array.isArray(result.tags) ? result.tags : []);
  host.innerHTML = trendingMarkup(safeTags(hashtags, "hashtag"), "hashtag") + trendingMarkup(safeTags(cashtags, "cashtag"), "cashtag");
  host.querySelectorAll("[data-trend-tag]").forEach((button) => button.addEventListener("click", () => { void openTagPage(button.dataset.trendKind, button.dataset.trendTag); }));
}

// Repost is the internal form of sharing and Share is the external/direct form. On a vertical clip they
// occupy one rail position and open a tiny two-choice menu, keeping both real actions while giving the
// video and soundtrack more room.
function clipDistributeMarkup({ postId, repostLabel, repostCount, reposted = false, sharing = SOCIAL_SHARING_ENABLED, iconClass = "clipSolidIcon" }) {
  if (!sharing) {
    return '<button data-repost="' + postId + '" type="button" class="' + (reposted ? "on" : "") + '" aria-label="' + esc(repostLabel) + '"><i class="' + iconClass + '">' + solidViewerIcon("repost") + '</i><small>' + Number(repostCount || 0) + '</small></button>';
  }
  const label = repostLabel + " / " + t("post.share");
  return [
    '<button class="clipDistributeToggle" data-clip-distribute="' + postId + '" type="button" aria-label="' + esc(label) + '" aria-haspopup="menu" aria-expanded="false"><i class="' + iconClass + '">' + solidViewerIcon("share") + '</i><small>' + Number(repostCount || 0) + '</small></button>',
    '<div class="clipDistributeMenu" data-clip-distribute-menu="' + postId + '" role="menu" aria-label="' + esc(label) + '" hidden>',
    '<button data-repost="' + postId + '" type="button" role="menuitem" class="' + (reposted ? "on" : "") + '" aria-label="' + esc(repostLabel) + '"><i>' + solidViewerIcon("repost") + '</i><span><b>' + esc(repostLabel) + '</b><small>' + Number(repostCount || 0) + '</small></span></button>',
    '<button data-share="' + postId + '" type="button" role="menuitem" aria-label="' + esc(t("post.share")) + '"><i>' + solidViewerIcon("share") + '</i><span><b>' + esc(t("post.share")) + '</b></span></button>',
    '</div>',
  ].join("");
}

function postCard(post) {
  const author = post.author || {};
  const authorName = author.display_name || author.handle || "Creator";
  const authorHandle = author.handle || "creator";
  const avatarText = authorName.slice(0, 2).toUpperCase();
  const m = post.media ? "/media/" + post.media.hash + "." + post.media.ext : null;
  const reactions = post.reactions?.counts || {};
  const currentReaction = post.reactions?.viewer_reaction || null;
  const reactionTotal = Object.values(reactions).reduce((total, value) => total + Number(value || 0), 0);
  const repostLabel = t(socialFormat === "tweets" ? "post.retweet" : "post.repost");
  const repostCount = Number(post.reposts || 0);
  const isOwner = Number(post.user_id) === Number(state.user?.id) && post.persona === state.persona;
  const followLabel = followButtonLabel({ active: post.following_me, pending: post.follow_request_pending });
  const audioAttribution = post.external_audio?.attribution || post.audio_attribution || (t("post.audioOriginal") + " · " + authorName);
  const trustLabel = post.trust?.riskLevel === "CONTEXT" ? "Context automat" : "Trust Lens";
  const unavailableClip = !m && (post.kind === "video" || socialFormat === "clips");
  const clipMode = socialFormat === "clips" && (["video", "image"].includes(post.media?.kind) || unavailableClip);
  const factualLabel = post.trust?.factualStatus === "NOT_FACT_CHECKED" ? "Neverificat factual" : post.trust?.factualStatus || "Neevaluat";
  const ownerMenu = '<button data-post-manage="' + post.id + '" type="button">' + esc(t("post.manage")) + '</button><button data-post-history="' + post.id + '" type="button">' + esc(t("post.history")) + '</button>';
  const cardMenu = postOptionsMenuMarkup(post, { owner: isOwner, muted: post.muted_by_me === true, blocked: post.blocked_by_me === true });
  const authorLine = '<div class="post-head"><div class="avatar">' + esc(avatarText) + '</div><div class="who"><b><bdi dir="auto">' + esc(authorName) + '</bdi></b><small>' + usernameSigil(author, post.persona) + '<bdi dir="ltr">@' + esc(authorHandle) + '</bdi> · ' + esc(post.persona) + orbitStatusChip(author, post.persona) + '</small></div><div class="postCreatorControls">' + (isOwner ? '' : '<button data-follow="' + post.user_id + '" data-active="' + (post.following_me ? 1 : 0) + '" data-pending="' + (post.follow_request_pending ? 1 : 0) + '" type="button">' + esc(followLabel) + '</button>') + '<button data-post-creator-menu type="button" aria-label="' + esc(t("post.moreCreator")) + '" aria-expanded="false">•••</button><div class="postCreatorMenu" hidden>' + cardMenu + '</div></div></div>';
  const trustControl = '<button class="trustSummary ' + (post.trust?.riskLevel === "CONTEXT" ? "context" : "") + '" type="button" data-trust="' + post.id + '">◇ ' + trustLabel + ' · ' + esc(factualLabel) + '</button>';
  const rankingReason = rankingReasonMarkup(post, { esc, t, context: "feed" });
  const noteChip = Number(post.community_notes?.counts?.published || 0) > 0
    ? '<span class="postContextChip" role="note">◈ ' + esc(t("x.notes.title")) + '</span>'
    : '';
  const mediaBlock = (unavailableClip ? '<div class="demoClipFallback" role="img" aria-label="' + esc(t("post.previewAria")) + '"><div></div><span><small>' + esc(t("post.previewEyebrow")) + '</small><b>' + esc(t("post.previewTitle")) + '</b><em>' + esc(t("post.previewDetail")) + '</em></span></div>' : '') + (m ? renderStudioMedia(post, m) : '');
  const carouselBlock = mediaCarouselMarkup(post);
  const mediaArea = carouselBlock || mediaBlock;
  const econ = post.economy || {};
  const locked = Boolean(econ.hidden_unlock && !curiosityHas("UNLOCK", post.id));
  const curiosityOverlay = econ.hidden_unlock ? '<div class="curiosityLock ' + (locked ? "locked" : "unlocked") + '"><span><small>' + (locked ? "HIDDEN UNLOCK" : "UNLOCKED") + '</small><b>' + money(econ.price_cents || 100, econ.currency || "USD") + '</b><em>' + (econ.collectible ? "Collectible · " : "") + (econ.revealable ? "Revealable opt-in" : "Anonymous") + '</em></span><button type="button" data-curiosity="' + post.id + '">' + (locked ? "Unlock / Collect" : "Manage collectible") + '</button></div>' : '';
  const creatorAvatar = author.avatar
    ? '<img src="' + esc(author.avatar) + '" alt="" />'
    : esc(avatarText);
  const clipActions = clipMode ? [
    '<div class="clipQuickActions" aria-label="' + esc(t("post.actions")) + '">',
    clipCreatorAvatarMarkup({ esc, t, handle: authorHandle, name: authorName, avatar: creatorAvatar }),
    '<button data-reaction-toggle="' + post.id + '" data-reaction-display="compact" type="button" class="' + (post.reactions?.viewer_reaction ? 'on' : '') + '" aria-label="' + esc(t("post.openReactions")) + '" aria-expanded="false">' + viewerReactionSummaryMarkup(reactions, currentReaction) + '</button>',
    '<button data-comments="' + post.id + '" type="button" aria-label="' + esc(t("post.openComments")) + '"><i class="clipSolidIcon">' + solidViewerIcon("comment") + '</i><small>' + post.comment_count + '</small></button>',
    '<button data-save="' + post.id + '" type="button" class="' + (post.saved_by_me ? "on" : "") + '" aria-label="' + esc(t("post.save")) + '"><i class="clipSolidIcon">' + solidViewerIcon("save") + '</i><small class="railMetricPlaceholder" aria-hidden="true">•</small></button>',
    clipDistributeMarkup({ postId: post.id, repostLabel, repostCount, reposted: post.reposted_by_me === true }),
    '<button class="clipMusicDisc" data-clip-sound data-audio-label="' + esc(audioAttribution) + '" type="button" aria-label="' + esc(t("post.enableSound")) + '" aria-pressed="true"><i aria-hidden="true">♫</i><small hidden>' + esc(audioAttribution) + '</small></button>',
    '</div><button class="clipPlayState" data-clip-play type="button" aria-label="' + esc(t("post.play")) + '">▶</button>',
  ].join("") : "";
  const clipOverlay = clipMode ? [
    '<div class="clipMetaOverlay">',
    '<div class="clipCreator clipIdentityPersistent"><button class="creatorStoryTrigger" data-creator-story="' + esc(authorHandle) + '" type="button" aria-label="' + esc(t("post.openStory") + " " + authorName) + '"><i>' + creatorAvatar + '</i><span>' + usernameSigil(author, post.persona) + '<b><bdi dir="auto">' + esc(authorName) + '</bdi></b></span></button><div class="creatorInlineActions">',
    isOwner ? '' : '<button data-follow="' + post.user_id + '" data-active="' + (post.following_me ? 1 : 0) + '" data-pending="' + (post.follow_request_pending ? 1 : 0) + '" type="button">' + esc(followLabel) + '</button>',
    '</div></div>',
    post.caption ? expandableCaptionMarkup(captionWithTagsMarkup(post.caption), { t, esc }) : '',
    publishingCaption(post,esc),
    post.caption ? captionTranslationButtonMarkup({ language: post.language, locale: interfaceLocale, esc }) : '',
    '<div class="clipContext">' + trustControl + '</div>',
    noteChip,
    '</div>',
  ].join("") : "";
  return [
    '<article class="post postOpenable ' + (clipMode ? "clipCard clipPost" : "") + '" data-post-id="' + post.id + '" data-post-author="' + Number(post.user_id) + '" data-post-open="' + post.id + '"' + (post.repost ? ' data-repost-entry="1"' : '') + ' role="article" tabindex="0">',
    repostHeaderMarkup(post.repost),
    clipMode ? '' : authorLine,
    clipMode ? '' : '<div class="postTrust">' + esc(t("post.localPersisted")) + ' · ' + esc(t("post.chainNotSubmitted")) + '</div>',
    clipMode ? '' : trustControl,
    clipMode ? '' : rankingReason,
    !clipMode && post.caption ? '<p class="caption">' + captionWithTagsMarkup(post.caption) + '</p>' : '',
    !clipMode ? publishingCaption(post,esc) : '',
    clipMode ? '' : noteChip,
    clipMode ? '<div class="clipStage ' + (locked ? "curiosityLockedStage" : "") + '">' + mediaBlock + curiosityOverlay + clipOverlay + clipActions + clipSubtitlesMarkup(post, { esc, t }) + '</div>' : mediaArea + curiosityOverlay,
    reactionPaletteMarkup(post, currentReaction),
    '<div class="actions' + (clipMode ? ' clipMoreActions' : '') + '">',
    clipMode && isOwner ? ownerMenu : '',
    clipMode ? '<button data-creator-profile="' + esc(authorHandle) + '">' + esc(t("post.viewProfile")) + '</button>' : '',
    clipMode ? '<button data-creator-message="' + esc(authorHandle) + '">' + esc(t("post.message")) + '</button>' : '',
    clipMode ? '' : '<button data-reaction-toggle="' + post.id + '" aria-expanded="false">' + esc(t("post.reactions")) + ' ' + reactionTotal + '</button>',
    clipMode ? '' : '<button data-comments="' + post.id + '">◌ ' + post.comment_count + '</button>',
    clipMode ? '' : '<button data-repost="' + post.id + '" class="' + (post.reposted_by_me ? "on" : "") + '">⟳ ' + repostLabel + ' ' + repostCount + '</button>',
    clipMode ? '' : '<button data-save="' + post.id + '" class="' + (post.saved_by_me ? "on" : "") + '">' + esc(t(post.saved_by_me ? "post.saved" : "post.save")) + '</button>',
    !clipMode && SOCIAL_SHARING_ENABLED ? '<button data-share="' + post.id + '">' + esc(t("post.share")) + '</button>' : '',
    clipMode ? '' : '<button data-support="' + post.id + '" data-author="' + esc(author.handle || "creator") + '">$ ' + esc(t("post.support")) + '</button>',
    !clipMode && m ? '<button data-open-media="' + post.id + '">⛶ ' + esc(t("post.open")) + '</button>' : '',
    !clipMode && econ.collectible ? '<button data-curiosity="' + post.id + '">◇ ' + esc(t("post.collect")) + '</button>' : '',
    postViewsMarkup(post),
    // Report and "not interested" moved into the ••• menu: the row keeps only real actions,
    // which is what a reader expects from a simple timeline.
    '</div>',
    commentsDrawerMarkup(post),
    '</article>',
  ].join("");
}

async function openPostLifecycleSheet(post, { historyOnly = false } = {}) {
  const ownerId = Number(state.user?.id);
  const ownerPersona = state.persona;
  if (!post || Number(post.user_id) !== ownerId || post.persona !== ownerPersona) return toast(t("post.manageDenied"));
  document.getElementById("postLifecycleBackdrop")?.remove();
  document.body.insertAdjacentHTML("beforeend", [
    '<div class="sheet-backdrop postLifecycleBackdrop" id="postLifecycleBackdrop">',
    '<section class="account-modal postLifecycleSheet" role="dialog" aria-modal="true" aria-labelledby="postLifecycleTitle" tabindex="-1">',
    '<button class="sheet-close" type="button" aria-label="' + esc(t("common.close")) + '">×</button>',
    '<small>' + esc(t("post.ownerControls")) + '</small><h3 id="postLifecycleTitle">' + esc(historyOnly ? t("post.history") : t("post.manage")) + '</h3>',
    historyOnly ? '' : '<form id="post-lifecycle-form" data-edit-key="' + esc(newUploadMutationKey("post-edit")) + '"><label>' + esc(t("post.caption")) + '<textarea name="caption" maxlength="2000">' + esc(post.caption || "") + '</textarea></label><label>' + esc(t("post.audience")) + '<select name="visibility">' + ["public", "followers", "friends", "private"].map((value) => '<option value="' + value + '"' + (post.visibility === value ? ' selected' : '') + '>' + esc(t("post.visibility." + value)) + '</option>').join("") + '</select></label><button class="btn" type="submit">' + esc(t("post.saveChanges")) + '</button></form><div class="postLifecycleDanger"><button data-post-archive-confirm="0" data-key="' + esc(newUploadMutationKey("post-archive")) + '" type="button">' + esc(t("post.archive")) + '</button><button data-post-withdraw-confirm="0" data-key="' + esc(newUploadMutationKey("post-withdraw")) + '" type="button">' + esc(t("post.withdraw")) + '</button></div>',
    '<button class="postHistoryLoad" type="button">' + esc(t("post.loadHistory")) + '</button><div class="postHistoryList" aria-live="polite"></div>',
    '</section></div>',
  ].join(""));
  const backdrop = document.getElementById("postLifecycleBackdrop");
  const sheet = backdrop.querySelector(".postLifecycleSheet");
  const close = () => backdrop.remove();
  backdrop.querySelector(".sheet-close").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  const loadHistory = async () => {
    const target = backdrop.querySelector(".postHistoryList");
    target.textContent = t("post.historyLoading");
    const result = await api(`/api/posts/${post.id}/history`).catch(() => null);
    const valid = backdrop.isConnected && Number(state.user?.id) === ownerId && state.persona === ownerPersona
      && result?.ok && Number(result.post_id) === Number(post.id) && Number(result.owner_id) === ownerId
      && result.owner_persona === ownerPersona && result.immutable_history === true
      && Array.isArray(result.versions) && result.versions.length <= 100
      && result.versions.every((version, index) => Number(version.version) === index + 1 && typeof version.caption === "string" && version.caption.length <= 5000 && ["active", "archived", "withdrawn"].includes(version.status) && /^[a-f0-9]{64}$/.test(String(version.content_commitment || "")));
    if (!valid) { if (target.isConnected) target.textContent = t("post.historyError"); return; }
    target.innerHTML = result.versions.map((version) => '<article><b>v' + Number(version.version) + ' · ' + esc(t("post.status." + version.status)) + '</b><p>' + esc(version.caption || t("post.withdrawnTombstone")) + '</p><small>' + esc(String(version.content_commitment).slice(0, 12)) + '…</small></article>').join("");
  };
  backdrop.querySelector(".postHistoryLoad").addEventListener("click", loadHistory);
  if (historyOnly) loadHistory();
  backdrop.querySelector("#post-lifecycle-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const caption = String(new FormData(form).get("caption") || "").trim();
    const visibility = String(new FormData(form).get("visibility") || "");
    if ((!caption && !post.media) || !["public", "followers", "friends", "private"].includes(visibility)) return toast(t("post.editInvalid"));
    submit.disabled = true;
    const result = await api(`/api/posts/${post.id}`, { method: "PATCH", headers: { "Idempotency-Key": form.dataset.editKey }, body: { caption, visibility } }).catch(() => null);
    const exact = result?.ok && result.action === "post_edited" && Number(result.owner_id) === ownerId
      && result.owner_persona === ownerPersona && Number(result.post?.id) === Number(post.id)
      && result.post.caption === caption && result.post.visibility === visibility && result.history_preserved === true;
    if (!exact) { submit.disabled = false; return toast(t("post.editError")); }
    close(); toast(t("post.edited")); renderView();
  });
  const destructive = async (button, action) => {
    if (button.dataset.confirmed !== "1") {
      button.dataset.confirmed = "1";
      button.textContent = t(action === "archive" ? "post.archiveConfirm" : "post.withdrawConfirm");
      return;
    }
    button.disabled = true;
    const endpoint = action === "archive" ? `/api/posts/${post.id}/archive` : `/api/posts/${post.id}`;
    const result = await api(endpoint, { method: action === "archive" ? "POST" : "DELETE", headers: { "Idempotency-Key": button.dataset.key }, body: {} }).catch(() => null);
    const exact = result?.ok && result.action === `post_${action === "archive" ? "archived" : "withdrawn"}`
      && Number(result.post_id) === Number(post.id) && Number(result.actor_id) === ownerId
      && result.actor_persona === ownerPersona && result.history_preserved === true;
    if (!exact) { button.disabled = false; return toast(t("post.lifecycleError")); }
    close(); toast(t(action === "archive" ? "post.archived" : "post.withdrawn")); renderView();
  };
  backdrop.querySelector("[data-post-archive-confirm]")?.addEventListener("click", (event) => destructive(event.currentTarget, "archive"));
  backdrop.querySelector("[data-post-withdraw-confirm]")?.addEventListener("click", (event) => destructive(event.currentTarget, "withdraw"));
  sheet.focus();
}

// The reaction palette opens where there is room: above its own button by default, below it
// when the container has no space above, which is what keeps it from being clipped at the top
// of a feed. It is a popover, so it never adds height to the card.
function positionReactionPalette(palette, button, { viewer = false } = {}) {
  const buttonRect = button.getBoundingClientRect();
  palette.classList.add("reactionPopoverAnchored");
  palette.classList.remove("dropDown");
  if (viewer) {
    const rail = button.closest(".viewerActionRail");
    const maxTop = Math.max(0, Number(rail?.clientHeight || 0) - palette.offsetHeight);
    const centeredTop = button.offsetTop + button.offsetHeight / 2 - palette.offsetHeight / 2;
    palette.style.setProperty("--reaction-popover-top", Math.max(0, Math.min(centeredTop, maxTop)) + "px");
    return;
  }
  const article = button.closest("article");
  if (!article) return;
  const articleRect = article.getBoundingClientRect();
  const maxLeft = Math.max(8, articleRect.width - palette.offsetWidth - 8);
  const left = Math.max(8, Math.min(buttonRect.left - articleRect.left - palette.offsetWidth - 8, maxLeft));
  const maxTop = Math.max(8, articleRect.height - palette.offsetHeight - 8);
  const centeredTop = buttonRect.top - articleRect.top + buttonRect.height / 2 - palette.offsetHeight / 2;
  palette.style.setProperty("--reaction-popover-left", left + "px");
  palette.style.setProperty("--reaction-popover-top", Math.max(8, Math.min(centeredTop, maxTop)) + "px");
}

function closeExpandedPalettes(root) {
  root.querySelectorAll(".reactionBar.expanded, .viewerReactionTray.expanded").forEach((palette) => {
    palette.classList.remove("expanded");
    palette.setAttribute("aria-hidden", "true");
    palette.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
  });
}

// One scroll listener per scrolling container, so a popover never survives a page move.
const paletteScrollHosts = new WeakSet();
const distributeMenuRoots = new WeakSet();

function bindClipDistributeMenus(root) {
  const closeAll = (except = null) => {
    root.querySelectorAll("[data-clip-distribute-menu]").forEach((menu) => {
      if (menu === except) return;
      menu.hidden = true;
      root.querySelector('[data-clip-distribute="' + menu.dataset.clipDistributeMenu + '"]')?.setAttribute("aria-expanded", "false");
    });
  };
  root.querySelectorAll("[data-clip-distribute]").forEach((button) => {
    const menu = root.querySelector('[data-clip-distribute-menu="' + button.dataset.clipDistribute + '"]');
    if (!menu) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.hidden;
      closeAll(opening ? menu : null);
      menu.style.setProperty("--distribute-y", Math.max(0, button.offsetTop - 2) + "px");
      menu.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      if (opening) menu.querySelector("button")?.focus({ preventScroll: true });
    });
    menu.querySelectorAll("button").forEach((action) => action.addEventListener("click", () => closeAll()));
  });
  if (distributeMenuRoots.has(root)) return;
  distributeMenuRoots.add(root);
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-clip-distribute],.clipDistributeMenu")) return;
    closeAll();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const expanded = root.querySelector('[data-clip-distribute][aria-expanded="true"]');
    if (!expanded) return;
    closeAll();
    expanded.focus({ preventScroll: true });
  });
}

const REACTION_HOLD_MS = 180;
const REACTION_HOVER_MS = 110;

function bindPrimaryReactionControl(button, palette, root, { viewer = false } = {}) {
  if (!button || !palette || button.dataset.reactionControlBound === "1") return;
  button.dataset.reactionControlBound = "1";
  let holdTimer = null;
  let hoverTimer = null;
  let suppressPrimaryClick = false;
  const setExpanded = (expanded, focusFirst = false) => {
    root.querySelectorAll(".reactionBar.expanded, .viewerReactionTray.expanded").forEach((other) => {
      if (other === palette) return;
      other.classList.remove("expanded");
      other.setAttribute("aria-hidden", "true");
      if (other.classList.contains("viewerReactionTray")) other.hidden = true;
      other.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
    });
    palette.classList.toggle("expanded", expanded);
    palette.setAttribute("aria-hidden", String(!expanded));
    if (viewer) palette.hidden = !expanded;
    button.setAttribute("aria-expanded", String(expanded));
    if (expanded) positionReactionPalette(palette, button, { viewer });
    if (expanded) button.closest(".clipStage")?.classList.remove("clipChromeHidden");
    if (expanded && focusFirst) palette.querySelector("button")?.focus({ preventScroll: true });
  };
  const openPalette = (focusFirst = false) => {
    setExpanded(true, focusFirst);
    navigator.vibrate?.(12);
  };
  const clearOpenTimers = () => {
    clearTimeout(holdTimer);
    clearTimeout(hoverTimer);
  };
  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    suppressPrimaryClick = false;
    clearOpenTimers();
    holdTimer = setTimeout(() => {
      suppressPrimaryClick = true;
      openPalette(false);
    }, REACTION_HOLD_MS);
  });
  ["pointerup", "pointercancel"].forEach((eventName) => button.addEventListener(eventName, clearOpenTimers));
  button.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse" || !window.matchMedia?.("(pointer: fine)")?.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openPalette(false), REACTION_HOVER_MS);
  });
  button.addEventListener("pointerleave", () => clearOpenTimers());
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    clearOpenTimers();
    openPalette(true);
  });
  button.addEventListener("keydown", (event) => {
    const openWithKeyboard = event.key === "ArrowUp" || event.key === "ArrowDown"
      || (event.shiftKey && (event.key === "Enter" || event.key === " "));
    if (!openWithKeyboard) return;
    event.preventDefault();
    event.stopPropagation();
    clearOpenTimers();
    openPalette(true);
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    clearOpenTimers();
    if (suppressPrimaryClick) { suppressPrimaryClick = false; return; }
    setExpanded(false);
    const selected = palette.querySelector("[data-reaction].on");
    const primary = selected || palette.querySelector('[data-reaction="LIKE"]');
    if (primary) void toggleReaction(primary);
  });
}

function wirePostActions(root, postCollection = currentFeedPosts) {
  bindClipDistributeMenus(root);
  root.querySelectorAll("video[data-trim-end]").forEach((video) => {
    const start = Number(video.dataset.trimStart || 0);
    const end = Number(video.dataset.trimEnd || 180);
    const rate = Number(video.dataset.playbackRate || 1);
    video.addEventListener("loadedmetadata", () => { video.playbackRate = rate; if (video.currentTime < start) video.currentTime = start; });
    video.addEventListener("timeupdate", () => { if (video.currentTime >= end) { video.pause(); video.currentTime = start; } });
    bindStudioDecorationTimeline(video);
  });
  root.querySelectorAll("[data-reaction]").forEach((b) => b.addEventListener("click", () => toggleReaction(b)));
  root.querySelectorAll("[data-reaction-toggle]").forEach((button) => {
    bindPrimaryReactionControl(button, button.closest("article")?.querySelector(".reactionBar"), root);
  });
  root.querySelectorAll(".reactionBar, .viewerReactionTray").forEach((palette) => {
    let dismissStartY = null;
    palette.addEventListener("pointerdown", (event) => { dismissStartY = event.clientY; }, { passive: true });
    palette.addEventListener("pointerup", (event) => {
      if (dismissStartY == null || event.clientY - dismissStartY < 44) { dismissStartY = null; return; }
      dismissStartY = null;
      palette.classList.remove("expanded");
      palette.setAttribute("aria-hidden", "true");
      if (palette.classList.contains("viewerReactionTray")) palette.hidden = true;
      palette.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
      root.querySelector("[data-viewer-reactions]")?.setAttribute("aria-expanded", "false");
    }, { passive: true });
    palette.addEventListener("pointercancel", () => { dismissStartY = null; }, { passive: true });
    // On a fine pointer the palette also leaves shortly after the pointer leaves it, so it
    // disappears as easily as it appeared. A scroll closes it immediately anywhere.
    let leaveTimer = null;
    palette.addEventListener("pointerenter", () => clearTimeout(leaveTimer));
    palette.addEventListener("pointerleave", () => {
      if (!window.matchMedia?.("(pointer: fine)")?.matches) return;
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        palette.classList.remove("expanded");
        palette.setAttribute("aria-hidden", "true");
        palette.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
      }, 420);
    });
    const scrollHost = palette.closest(".pulsePosts, .clipsScreen, .postDetailScroll, .ownerWhisperList, .comments, .storyViewer, .reelViewer");
    if (scrollHost && !paletteScrollHosts.has(scrollHost)) {
      paletteScrollHosts.add(scrollHost);
      scrollHost.addEventListener("scroll", () => closeExpandedPalettes(root), { passive: true });
    }
  });
  root.querySelectorAll("[data-clip-menu]").forEach((button) => button.addEventListener("click", () => {
    const menu = button.closest("article")?.querySelector(".clipMoreActions");
    if (!menu) return;
    const expanded = menu.classList.toggle("expanded");
    button.setAttribute("aria-expanded", String(expanded));
  }));
  root.querySelectorAll("[data-post-creator-menu]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = button.parentElement?.querySelector(".postCreatorMenu");
    if (!menu) return;
    const opening = menu.hasAttribute("hidden");
    menu.toggleAttribute("hidden", !opening);
    button.setAttribute("aria-expanded", String(opening));
  }));
  root.addEventListener("click", (event) => {
    if (!event.target.closest("[data-reaction-toggle], .reactionBar")) {
      root.querySelectorAll(".reactionBar.expanded").forEach((palette) => {
        palette.classList.remove("expanded");
        palette.setAttribute("aria-hidden", "true");
        palette.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
      });
    }
    if (event.target.closest("[data-clip-menu], .clipMoreActions, [data-post-creator-menu], .postCreatorMenu")) return;
    root.querySelectorAll(".clipMoreActions.expanded").forEach((menu) => {
      menu.classList.remove("expanded");
      menu.closest("article")?.querySelector("[data-clip-menu]")?.setAttribute("aria-expanded", "false");
    });
    root.querySelectorAll(".postCreatorMenu:not([hidden])").forEach((menu) => {
      menu.hidden = true;
      menu.parentElement?.querySelector("[data-post-creator-menu]")?.setAttribute("aria-expanded", "false");
    });
  });
  root.querySelectorAll("[data-comments]").forEach((b) => b.addEventListener("click", () => toggleComments(b, postCollection)));
  root.querySelectorAll("[data-close-comments]").forEach((button) => button.addEventListener("click", () => {
    closeCommentsDrawer(button.closest(".comments"));
  }));
  root.querySelectorAll("[data-comments-scrim]").forEach((scrim) => scrim.addEventListener("click", () => {
    closeCommentsDrawer(document.getElementById("comments-" + scrim.dataset.commentsScrim));
  }));
  root.querySelectorAll(".clipCommentsDrawer").forEach((drawer) => {
    let startY = null;
    const dragZone = drawer.querySelector(".drawerHandle") || drawer.querySelector("header");
    dragZone?.addEventListener("pointerdown", (event) => { startY = event.clientY; }, { passive: true });
    dragZone?.addEventListener("pointerup", (event) => {
      if (startY != null && event.clientY - startY > 84) closeCommentsDrawer(drawer);
      startY = null;
    }, { passive: true });
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openComments = root.querySelector(".clipCommentsDrawer:not(.hidden)");
    if (openComments) { event.preventDefault(); closeCommentsDrawer(openComments); }
    const openReactions = root.querySelector(".reactionBar.expanded");
    if (openReactions) {
      event.preventDefault();
      openReactions.classList.remove("expanded");
      openReactions.setAttribute("aria-hidden", "true");
      openReactions.closest("article")?.querySelector("[data-reaction-toggle]")?.setAttribute("aria-expanded", "false");
    }
    const openCreatorMenu = root.querySelector(".clipMoreActions.expanded");
    if (openCreatorMenu) {
      event.preventDefault();
      openCreatorMenu.classList.remove("expanded");
      openCreatorMenu.closest("article")?.querySelector("[data-clip-menu]")?.setAttribute("aria-expanded", "false");
    }
    const openPostCreatorMenu = root.querySelector(".postCreatorMenu:not([hidden])");
    if (openPostCreatorMenu) {
      event.preventDefault();
      openPostCreatorMenu.hidden = true;
      openPostCreatorMenu.parentElement?.querySelector("[data-post-creator-menu]")?.setAttribute("aria-expanded", "false");
    }
  });
  bindCreatorDestinations(root, { profile: openCreatorProfile, story: openCreatorStory });
  bindExpandableCaptions(root, { t });
  bindCaptionTranslations(root, { targetLanguage: interfaceLocale, onUnavailable: toast });
  root.querySelectorAll("[data-creator-message]").forEach((button) => button.addEventListener("click", () => messageCreator(button.dataset.creatorMessage)));
  root.querySelectorAll("[data-post-manage]").forEach((button) => button.addEventListener("click", () => openPostLifecycleSheet(postCollection.find((post) => Number(post.id) === Number(button.dataset.postManage)))));
  root.querySelectorAll("[data-post-history]").forEach((button) => button.addEventListener("click", () => openPostLifecycleSheet(postCollection.find((post) => Number(post.id) === Number(button.dataset.postHistory)), { historyOnly: true })));
  root.querySelectorAll(".postCreatorMenu button").forEach((button) => button.addEventListener("click", () => {
    const menu = button.closest(".postCreatorMenu");
    if (menu) menu.hidden = true;
    menu?.parentElement?.querySelector("[data-post-creator-menu]")?.setAttribute("aria-expanded", "false");
  }));
  root.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", () => toggleSave(b)));
  root.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => sharePost(b)));
  root.querySelectorAll("[data-repost]").forEach((b) => b.addEventListener("click", () => toggleRepost(b)));
  root.querySelectorAll("[data-support]").forEach((b) => b.addEventListener("click", () => openSupportSheet(Number(b.dataset.support), b.dataset.author)));
  root.querySelectorAll("[data-curiosity]").forEach((b) => b.addEventListener("click", () => {
    const postId = Number(b.dataset.curiosity);
    const post = postCollection.find((item) => Number(item.id) === postId);
    if (!post) return toast("Asset indisponibil");
    openCuriositySheet({
      assetType: post.kind === "video" ? "REEL_COLLECTIBLE" : "POST_COLLECTIBLE",
      assetId: post.id,
      title: post.caption || "Nexus collectible",
      owner: "@" + (post.author?.handle || "creator"),
      priceCents: post.economy?.price_cents || 100,
      currency: post.economy?.currency || CURIOSITY_ECONOMY.currency,
    });
  }));
  root.querySelectorAll("[data-open-media]").forEach((button) => button.addEventListener("click", () => openFeedMediaViewer(Number(button.dataset.openMedia), postCollection)));
  root.querySelectorAll("article.post:not(.clipPost) img.media").forEach((image) => image.addEventListener("click", () => {
    if (performance.now() < suppressFeedClickUntil) return;
    const postId = Number(image.closest("article")?.dataset.postId);
    if (postId) openFeedMediaViewer(postId, postCollection);
  }));
  root.querySelectorAll("[data-clip-sound]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const video = button.closest(".clipStage")?.querySelector("video.media");
    const audio = button.closest(".clipStage")?.querySelector(".studioSound audio");
    if (!video && !audio) return;
    const muted = !readSocialMuted();
    writeSocialMuted(muted);
    applySocialMuted(document, muted);
    if (!muted && video?.paused) video.play().catch(() => {});
    if (!muted && audio?.paused) audio.play().catch(() => {});
  }));
  root.querySelectorAll("[data-not-interested]").forEach((b) => b.addEventListener("click", () => hideNotInterested(b)));
  root.querySelectorAll("[data-trust]").forEach((b) => b.addEventListener("click", () => openTrustLens(Number(b.dataset.trust))));
  root.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", () => openReportSheet(Number(b.dataset.report))));
  root.querySelectorAll("[data-follow]").forEach((b) => b.addEventListener("click", (event) => { event.stopPropagation(); toggleFollow(b); }));
  root.querySelectorAll("[data-post-open]").forEach((article) => {
    article.addEventListener("click", (event) => {
      if (article.classList.contains("commentsExpanded")) return;
      if (event.target.closest("button, input, textarea, select, a, video, .reactionBar, .comments, .postCreatorMenu, .detailReplyMenu, .clipStage, .postViews")) return;
      openPostDetail(Number(article.dataset.postOpen), { from: article });
    });
    article.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.target !== article) return;
      event.preventDefault();
      openPostDetail(Number(article.dataset.postOpen), { from: article });
    });
  });
  root.querySelectorAll("[data-repost-undo]").forEach((button) => button.addEventListener("click", () => { void undoRepost(button); }));
  // A tag chip opens the tag page, a slide opens the media, and the carousel keeps its counter
  // honest while it scrolls.
  root.querySelectorAll("[data-tag]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    void openTagPage(button.dataset.tagKind, button.dataset.tag);
  }));
  root.querySelectorAll("[data-media-index]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const postId = Number(button.dataset.mediaPost);
    const post = postCollection.find((item) => Number(item.id) === postId)
      || mediaViewerState?.items.find((item) => Number(item.id) === postId);
    if (!post) return toast(t("post.openFailed"));
    openMediaLightbox(post, Number(button.dataset.mediaIndex));
  }));
  root.querySelectorAll(".mediaCarousel").forEach((carousel) => {
    const track = carousel.querySelector(".mediaCarouselTrack");
    const counter = carousel.querySelector(".mediaCounter");
    const dots = [...carousel.querySelectorAll(".mediaDots i")];
    track?.addEventListener("scroll", () => {
      const width = track.clientWidth || 1;
      const index = Math.max(0, Math.min(dots.length - 1, Math.round(track.scrollLeft / width)));
      if (counter) counter.textContent = (index + 1) + "/" + dots.length;
      dots.forEach((dot, position) => dot.classList.toggle("on", position === index));
    }, { passive: true });
  });
  root.querySelectorAll("[data-mute]").forEach((button) => button.addEventListener("click", () => { void toggleAuthorMute(button); }));
  root.querySelectorAll("[data-block]").forEach((button) => button.addEventListener("click", () => { void toggleAuthorBlock(button); }));
  root.querySelectorAll("[data-favorite]").forEach((button) => button.addEventListener("click", () => toggleAuthorFavorite(button)));
  root.querySelectorAll("[data-copy-link]").forEach((button) => button.addEventListener("click", () => { void copyPostLink(Number(button.dataset.copyLink)); }));
  root.querySelectorAll("[data-report-illegal]").forEach((button) => button.addEventListener("click", () => openReportSheet(Number(button.dataset.reportIllegal), "post", "ILLEGAL_CONTENT")));
  root.querySelectorAll("[data-note-request], [data-comment-note]").forEach((button) => button.addEventListener("click", () => { void requestCommunityNote(button); }));
  root.querySelectorAll("[data-why]").forEach((button) => button.addEventListener("click", () => showRankingReasons(Number(button.dataset.why))));
  root.querySelectorAll("[data-comment-form]").forEach((f) => f.addEventListener("submit", submitComment));
}

function closeMediaViewer({ fromHistory = false, restoreFeed = true } = {}) {
  if (commentOverlayNavigation?.element?.closest("#mediaViewer")) dismissCommentOverlay();
  mediaViewerState?.flushExposure?.();
  mediaViewerSessionGeneration += 1;
  if (mediaViewerState?.visibilityHandler) document.removeEventListener("visibilitychange", mediaViewerState.visibilityHandler);
  document.querySelectorAll("#mediaViewer video").forEach((video) => video.pause?.());
  document.getElementById("mediaViewer")?.remove();
  if (!mediaViewerState) return;
  mediaViewerState.preloads?.forEach((media) => {
    if (media instanceof HTMLVideoElement) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    } else media.removeAttribute?.("src");
  });
  const feedRestore = mediaViewerState.feedRestore;
  const historyToken = mediaViewerState.historyToken;
  mediaViewerState = null;
  if (feedRestore?.container?.isConnected) feedRestore.container.scrollTop = feedRestore.scrollTop;
  if (Number.isFinite(feedRestore?.windowScrollY)) window.scrollTo({ top: feedRestore.windowScrollY, behavior: "instant" });
  if (restoreFeed && feedRestore?.video?.isConnected) {
    feedRestore.video.muted = readSocialMuted();
    feedRestore.video.play().catch(() => {});
  }
  if (!fromHistory && history.state?.nexusMediaViewer === historyToken) {
    suppressNextUiPopstate = true;
    history.back();
  }
}

function openFeedMediaViewer(postId, postCollection = currentFeedPosts, viewerOptions = {}) {
  const items = postCollection.filter((post) => post.media);
  const index = items.findIndex((post) => Number(post.id) === Number(postId));
  if (index < 0) return;
  const article = document.querySelector('article[data-post-id="' + Number(postId) + '"]');
  const container = article?.closest(".pulsePosts");
  openMediaViewer(items, index, {
    ...viewerOptions,
    feedRestore: {
      container,
      scrollTop: Number(container?.scrollTop || 0),
      windowScrollY: window.scrollY,
      video: article?.querySelector("video.media") || null,
    },
  });
}

async function openCreatorProfile(handle) {
  const normalized = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{2,30}$/.test(normalized)) return;
  if (document.getElementById("publicProfileSheet")) return;
  const request = publicProfileLoadGate.begin();
  const selectedPersona = state.persona;
  const selectedUser = state.user.id;
  const host = document.querySelector(".phoneScreen") || app;
  host.insertAdjacentHTML("beforeend", '<div class="sheet-backdrop publicProfileBackdrop" id="publicProfileSheet"><section class="account-modal publicProfileSheet" role="dialog" aria-modal="true" aria-labelledby="publicProfileDialogLabel" tabindex="-1"><span id="publicProfileDialogLabel" hidden>' + esc(t("publicProfile.dialog")) + '</span><button class="sheet-close" type="button" aria-label="' + esc(t("common.close")) + '">×</button><div class="publicProfileLoading">' + esc(t("publicProfile.loading")) + '</div></section></div>');
  const backdrop = document.getElementById("publicProfileSheet");
  const sheet = backdrop.querySelector(".publicProfileSheet");
  const close = attachProfileNavigation(backdrop, {
    context: () => [state?.user?.id, state?.persona, activeModule], viewerState: () => mediaViewerState,
    closeViewer: closeMediaViewer, retireHistory: retireMessengerHistory, current: () => request.isCurrent(),
  });
  sheet.querySelector(".sheet-close").addEventListener("click", () => close());
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  sheet.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  sheet.focus();
  const result = await api("/api/profiles/" + encodeURIComponent(normalized) + "?persona=" + encodeURIComponent(selectedPersona)).catch(() => null);
  if (!request.isCurrent() || !backdrop.isConnected || state.persona !== selectedPersona || state.user.id !== selectedUser) return;
  const profile = result?.profile;
  const lockedProfile = result?.locked === true && ["private", "followers", "friends"].includes(profile?.visibility)
    && result.posts?.length === 0 && result.stories?.length === 0;
  const validProfile = Boolean(result?.ok && profile && typeof profile === "object"
    && Number.isSafeInteger(Number(profile.user_id)) && Number(profile.user_id) > 0
    && profile.handle === normalized && /^[a-z0-9_]{2,30}$/.test(profile.handle)
    && typeof profile.name === "string" && profile.name.length >= 1 && profile.name.length <= 80
    && profile.persona === selectedPersona
    && ["public", "followers", "friends", "private"].includes(profile.visibility)
    && (lockedProfile || (profile.counts && typeof profile.counts === "object"
    && ["posts", "followers", "following", "stories"].every((key) => Number.isSafeInteger(Number(profile.counts[key])) && Number(profile.counts[key]) >= 0)))
    && Array.isArray(result.posts) && result.posts.length <= 100
    && result.posts.every((post) => post && typeof post === "object"
      && Number.isSafeInteger(Number(post.id)) && Number(post.id) > 0
      && typeof post.caption === "string" && post.caption.length <= 5_000
      && (!post.media || (typeof post.media === "object"
        && ["image", "video"].includes(post.media.kind)
        && /^[a-f0-9]{64}$/.test(String(post.media.hash || ""))
        && /^[a-z0-9]{2,8}$/.test(String(post.media.ext || ""))))));
  if (!validProfile) {
    sheet.querySelector(".publicProfileLoading").innerHTML = '<b>' + esc(t("publicProfile.unavailable")) + '</b><p>' + esc(t("publicProfile.unavailableDetail")) + '</p>';
    return;
  }
  if (profile.is_self === true && Number(profile.user_id) === Number(selectedUser)) {
    return close({ destination: () => {
      activeSlot = "account"; activeModule = "profiles"; profileSettingsView = "profile";
      renderHeader(); renderNav(); renderView();
    } });
  }
  const mediaPosts = profileMediaPosts(result);
  sheet.classList.add("canonicalProfileSheet");
  sheet.innerHTML = '<span id="publicProfileDialogLabel" hidden>' + esc(t("publicProfile.dialog")) + '</span><button class="sheet-close" type="button" aria-label="' + esc(t("common.close")) + '">×</button><div data-creator-profile-body></div>';
  sheet.querySelector(".sheet-close").addEventListener("click", () => close());
  renderCreatorProfile(sheet.querySelector("[data-creator-profile-body]"), result, {
    esc, t, safeUrl: safeInternalMediaUrl, locale: interfaceLocale,
    bioMarkup: (text) => profileBioMarkup(text, esc),
    controls: (post) => profileWhisperControls(post),
    visibilityLabel: (visibility) => t(visibilityLabelKey(visibility)),
    onRendered: (root, posts) => wirePostActions(root, posts),
    onFollow: toggleFollow,
    onMessage: () => close({ destination: () => messageCreator(profile.handle) }),
    onPrivateAccess: () => openPrivateAccessSheet(Number(profile.user_id), profile.handle, { term: "24h" }),
    onStory: (index, stories) => close({ destination: () => openStoryViewer(index, stories) }),
    onAvatarPhoto: (url, name) => openProfilePhoto(url, name),
    onTabLeave: () => sheet.querySelectorAll(".clipCommentsDrawer:not(.hidden)").forEach(closeCommentsDrawer),
    onOpenReply: (id) => close({ destination: () => { void openReplyDeepLink(id); } }),
    onOpenPost: (id) => {
      const index = mediaPosts.findIndex((post) => Number(post.id) === id);
      if (index >= 0) close({ destination: () => openMediaViewer(mediaPosts, index) });
    },
  });
}

function messageCreator(handle) {
  closeMediaViewer();
  activeSlot = "inbox";
  selectModule("chat");
  setTimeout(() => {
    renderConversationCreator();
    const input = document.querySelector('#conversation-form input[name="usernames"]');
    if (input) { input.value = handle || ""; input.focus(); }
  }, 0);
}

function openCreatorStory(handle) {
  const normalized = String(handle || "").replace(/^@/, "").toLowerCase();
  const story = currentStories.find((item) => String(item.author?.handle || "").toLowerCase() === normalized);
  if (!story) return openCreatorProfile(normalized);
  if (!story.media) return openStoryEconomySheet(story);
  openMediaViewer([{
    ...story,
    user_id: Number(story.user_id || story.author?.id || state.user.id),
    persona: "social",
    comment_count: Number(story.comment_count || 0),
    reposts: Number(story.reposts || 0),
    reactions: story.reactions || { counts: {}, viewer_reaction: null },
  }], 0);
}

function openMediaViewer(items, initialIndex = 0, options = {}) {
  const selectedPersona = state.persona;
  const mediaItems = items.filter((item) => item && typeof item === "object"
    && Number.isSafeInteger(Number(item.id)) && (Number(item.id) > 0 || (Number(item.id) < 0 && isLocalDemoOrigin()))
    && Number.isSafeInteger(Number(item.user_id || item.author?.id)) && Number(item.user_id || item.author?.id) > 0
    && item.persona === selectedPersona
    && isSafeSearchMedia(item.media));
  if (!mediaItems.length) return;
  closeMediaViewer({ fromHistory: true });
  const sessionId = ++mediaViewerSessionGeneration;
  document.querySelectorAll("video.media").forEach((video) => video.pause());
  mediaViewerState = {
    sessionId,
    persona: selectedPersona,
    items: mediaItems,
    index: Math.max(0, Math.min(initialIndex, mediaItems.length - 1)),
    pointer: null,
    touch: null,
    preloads: [],
    exposure: null,
    flushExposure: null,
    resumeOnVisible: false,
    feedRestore: options.feedRestore || null,
    historyToken: newUploadMutationKey("media-viewer"),
  };
  const viewerHeader=reelsViewerHeaderMarkup({esc,labels:{back:t("viewer.backFeed")}});
  document.body.insertAdjacentHTML("beforeend", '<section class="mediaViewer reelViewer media-fit-' + esc(socialMediaFit) + '" id="mediaViewer" role="dialog" aria-modal="true" aria-labelledby="viewerDialogLabel" tabindex="-1"><span id="viewerDialogLabel" hidden>' + esc(t("viewer.label")) + '</span>' + viewerHeader + '<div class="viewerStage" id="viewerStage"></div><aside class="viewerActionRail" id="viewerActionRail" aria-label="' + esc(t("viewer.actions")) + '"></aside><button class="viewerCommentShortcut" id="viewerCommentShortcut" type="button"><span>' + esc(t("viewer.addComment")) + '</span><i aria-hidden="true">' + solidViewerIcon("comment") + '</i></button></section>');
  const viewer = document.getElementById("mediaViewer");
  viewer.querySelectorAll("[data-viewer-media-fit]").forEach((button) => button.classList.toggle("active", button.dataset.viewerMediaFit === socialMediaFit));
  try { history.pushState({ ...history.state, nexusMediaViewer: mediaViewerState.historyToken }, ""); }
  catch { /* Explicit close remains available when browser history is unavailable. */ }
  const isCurrentSession = () => Boolean(viewer.isConnected && mediaViewerState?.sessionId === sessionId && state.persona === selectedPersona);
  const flushViewerExposure = () => {
    if (!isCurrentSession()) return;
    const exposure = mediaViewerState?.exposure;
    if (!exposure) return;
    mediaViewerState.exposure = null;
    const dwellMs = Math.max(1, Math.min(300000, Math.round(performance.now() - exposure.startedAt)));
    const completed = exposure.mediaKind === "image" ? dwellMs >= 1000 : exposure.maxProgress >= .9;
    queueSocialImpression(exposure.postId, dwellMs, completed);
  };
  mediaViewerState.flushExposure = flushViewerExposure;
  const preloadNeighbors = () => {
    if (!isCurrentSession()) return;
    mediaViewerState.preloads.forEach((media) => {
      if (media instanceof HTMLVideoElement) {
        media.pause();
        media.removeAttribute("src");
        media.load();
      } else media.removeAttribute?.("src");
    });
    mediaViewerState.preloads = [];
    if (mediaViewerState.items.length < 2) return;
    const neighborIndexes = new Set([
      (mediaViewerState.index - 1 + mediaViewerState.items.length) % mediaViewerState.items.length,
      (mediaViewerState.index + 1) % mediaViewerState.items.length,
    ]);
    neighborIndexes.delete(mediaViewerState.index);
    neighborIndexes.forEach((index) => {
      const neighbor = mediaViewerState.items[index];
      const url = "/media/" + neighbor.media.hash + "." + neighbor.media.ext;
      if (neighbor.media.kind === "video") {
        const preload = document.createElement("video");
        preload.preload = "metadata";
        preload.muted = true;
        preload.playsInline = true;
        preload.src = url;
        preload.load();
        mediaViewerState.preloads.push(preload);
      } else {
        const preload = new Image();
        preload.decoding = "async";
        preload.src = url;
        mediaViewerState.preloads.push(preload);
      }
    });
  };
  const render = () => {
    if (!isCurrentSession()) return;
    flushViewerExposure();
    viewer.querySelectorAll("video").forEach((video) => video.pause());
    const item = mediaViewerState.items[mediaViewerState.index];
    const url = "/media/" + item.media.hash + "." + item.media.ext;
    const author = item.author || { id: state.user.id, handle: state.user.handle, earned_sigil: state.sigils?.[item.persona || state.persona] };
    const authorName = author.display_name || author.handle || state.user.handle;
    const authorAvatarUrl = safeInternalMediaUrl(author.avatar);
    const creatorAvatar = authorAvatarUrl ? '<img src="' + esc(authorAvatarUrl) + '" alt="" />' : esc(String(authorName).slice(0, 2).toUpperCase());
    const reactions = item.reactions?.counts || {};
    const reactionTotal = Object.values(reactions).reduce((total, value) => total + Number(value || 0), 0);
    const authorHandle = author.handle || state.user.handle;
    const isViewerOwner = Number(item.user_id || author.id) === Number(state.user?.id) && item.persona === state.persona;
    const viewerOwnerMenu = '<button data-post-manage="' + item.id + '" type="button">' + esc(t("post.manage")) + '</button><button data-post-history="' + item.id + '" type="button">' + esc(t("post.history")) + '</button>';
    const externalAudio = item.external_audio?.provider === "jamendo" ? item.external_audio : null;
    const audioAttribution = externalAudio?.attribution || item.audio_attribution || (t("post.audioOriginal") + " · " + authorName);
    const externalAudioMarkup = externalAudio ? '<div class="studioSound jamendoSound"><audio src="' + esc(externalAudio.audio_url) + '" preload="metadata" data-jamendo-duration="' + Number(externalAudio.duration) + '" data-jamendo-segment="' + Number(externalAudio.segment_seconds) + '" data-jamendo-offset="' + Number(externalAudio.preview_offset || 0) + '"></audio></div>' : '';
    const soundCreditMarkup = externalAudio ? '<a class="viewerSoundCredit" href="' + esc(externalAudio.share_url) + '" target="_blank" rel="noopener noreferrer">♫ ' + esc(externalAudio.attribution + " · " + externalAudio.license) + '</a>' : '';
    document.getElementById("viewerStage").innerHTML = (item.media.kind === "video"
      ? '<video src="' + esc(url) + '" autoplay loop playsinline' + (readSocialMuted() || externalAudio ? ' muted' : '') + ' aria-label="' + esc(t("viewer.videoAria")) + '"></video>' + externalAudioMarkup
      : '<img src="' + esc(url) + '" alt="' + esc(t("viewer.imageBy")) + ' @' + esc(authorHandle) + '" />' + externalAudioMarkup) +
      '<button class="viewerPlayState" type="button" aria-label="' + esc(t("viewer.play")) + '" hidden>▶</button>' +
      '<footer class="viewerCreatorOverlay"><div class="viewerCreatorRow"><button class="viewerCreatorIdentity" data-creator-story="' + esc(authorHandle) + '" type="button" aria-label="' + esc(t("post.openStory") + " " + authorName) + '"><i>' + creatorAvatar + '</i><span>' + usernameSigil(author, item.persona || state.persona) + '<b><bdi dir="auto">' + esc(authorName) + '</bdi></b><small><bdi dir="ltr">@' + esc(authorHandle) + '</bdi></small></span></button><div class="viewerCreatorInline">' + (isViewerOwner ? '' : '<button data-follow="' + Number(author.id || item.user_id) + '" data-active="' + (item.following_me ? 1 : 0) + '" data-pending="' + (item.follow_request_pending ? 1 : 0) + '" type="button">' + esc(followButtonLabel({ active: item.following_me, pending: item.follow_request_pending })) + '</button>') + '<button class="viewerCreatorMore" data-viewer-creator-menu type="button" aria-label="' + esc(t("post.moreCreator")) + '" aria-expanded="false">•••</button><div class="viewerCreatorMenu" hidden>' + (isViewerOwner ? viewerOwnerMenu : '<button data-creator-profile="' + esc(authorHandle) + '" type="button">' + esc(t("post.viewProfile")) + '</button><button data-creator-message="' + esc(authorHandle) + '" type="button">' + esc(t("post.message")) + '</button><button data-not-interested="' + item.id + '" type="button">' + esc(t("post.notInterested")) + '</button><button data-report="' + item.id + '" type="button">' + esc(t("post.report")) + '</button>') + '</div></div></div>' + (item.caption ? expandableCaptionMarkup(captionWithTagsMarkup(item.caption), { className: "viewerCaptionBlock", t, esc }) + captionTranslationButtonMarkup({ language: item.language, locale: interfaceLocale, esc }) : '') + soundCreditMarkup + '</footer>';
    const initialViewerVideo = viewer.querySelector("#viewerStage>video");
    applyPublishedEdits(document.getElementById('viewerStage'),item);
    document.querySelector('#viewerStage .viewerCreatorOverlay')?.insertAdjacentHTML('beforeend',publishingCaption(item,esc));
    const viewerAudio = viewer.querySelector("#viewerStage .jamendoSound audio");
    if (initialViewerVideo && viewerAudio) synchronizeReelSound(initialViewerVideo, viewerAudio, externalAudio);
    wireImageSound(document.getElementById('viewerStage'),readSocialMuted());
    document.getElementById("viewerActionRail").innerHTML = [
      '<button class="viewerRailAvatar" data-creator-profile="' + esc(authorHandle) + '" type="button" aria-label="' + esc(t("post.viewProfile") + " " + authorName) + '"><i>' + creatorAvatar + '</i></button>',
      '<button data-viewer-reactions="' + item.id + '" data-reaction-display="compact" type="button" class="' + (item.reactions?.viewer_reaction ? 'on' : '') + '" aria-label="' + esc(t("viewer.chooseReaction")) + '" aria-expanded="false">' + viewerReactionSummaryMarkup(reactions, item.reactions?.viewer_reaction) + '</button>',
      '<button data-viewer-comments="' + item.id + '" type="button" aria-label="' + esc(t("viewer.comments")) + '"><i class="viewerSolidIcon">' + solidViewerIcon("comment") + '</i><small>' + Number(item.comment_count || 0) + '</small></button>',
      '<button data-save="' + item.id + '" type="button" class="' + (item.saved_by_me ? "on" : "") + '" aria-label="' + esc(t("post.save")) + '"><i class="viewerSolidIcon">' + solidViewerIcon("save") + '</i><small class="railMetricPlaceholder" aria-hidden="true">•</small></button>',
      clipDistributeMarkup({ postId: item.id, repostLabel: t(item.kind === "text" ? "post.retweet" : "post.repost"), repostCount: Number(item.reposts || 0), reposted: item.reposted_by_me === true, iconClass: "viewerSolidIcon" }),
      '<button class="clipMusicDisc clipAudioAction' + (readSocialMuted() ? ' muted' : '') + '" data-viewer-sound data-audio-label="' + esc(audioAttribution) + '" type="button" aria-label="' + esc(t(readSocialMuted() ? "post.enableSound" : "post.disableSound")) + '" aria-pressed="' + String(!readSocialMuted()) + '"><i class="viewerSolidIcon">' + solidViewerIcon(readSocialMuted() ? "mute" : "sound") + '</i><small hidden>' + esc(audioAttribution) + '</small></button>',
      '<button data-viewer-more type="button" aria-label="' + esc(t("post.more")) + '" aria-expanded="false"><i class="viewerSolidIcon">' + solidViewerIcon("more") + '</i><small class="viewerActionWord">' + esc(t("viewer.more")) + '</small></button>',
      '<div class="viewerActionMenu" hidden><button data-not-interested="' + item.id + '" type="button">' + esc(t("post.notInterested")) + '</button><button data-report="' + item.id + '" type="button">' + esc(t("post.report")) + '</button></div>',
      '<div class="viewerReactionTray" hidden>' + REACTION_OPTIONS.map(([kind, icon, key]) => { const label = t(key); return '<button data-reaction="' + kind + '" data-post="' + item.id + '" class="' + (item.reactions?.viewer_reaction === kind ? "on" : "") + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"><span>' + icon + '</span><small>' + esc(label) + '</small></button>'; }).join("") + '</div>',
    ].join("");
    const viewerReactionButton = viewer.querySelector("[data-viewer-reactions]");
    bindExpandableCaptions(viewer, { t });
    bindCaptionTranslations(viewer, { targetLanguage: interfaceLocale, onUnavailable: toast });
    const viewerReactionTray = viewer.querySelector(".viewerReactionTray");
    bindPrimaryReactionControl(viewerReactionButton, viewerReactionTray, viewer, { viewer: true });
    wirePostActions(viewer.querySelector(".viewerActionRail"));
    const actionMoreButton = viewer.querySelector("[data-viewer-more]");
    const actionMenu = viewer.querySelector(".viewerActionMenu");
    actionMoreButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = actionMenu.hasAttribute("hidden");
      actionMenu.toggleAttribute("hidden", !opening);
      actionMoreButton.setAttribute("aria-expanded", String(opening));
    });
    actionMenu?.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      actionMenu.hidden = true;
      actionMoreButton?.setAttribute("aria-expanded", "false");
    }));
    viewer.querySelector("[data-viewer-comments]")?.addEventListener("click", (event) => openViewerComments(Number(event.currentTarget.dataset.viewerComments)));
    viewer.querySelector(".viewerCreatorRow [data-follow]")?.addEventListener("click", (event) => toggleFollow(event.currentTarget));
    bindCreatorDestinations(viewer, { profile: openCreatorProfile, story: openCreatorStory });
    viewer.querySelectorAll("[data-creator-message]").forEach((button) => button.addEventListener("click", () => messageCreator(button.dataset.creatorMessage)));
    viewer.querySelector("[data-post-manage]")?.addEventListener("click", () => openPostLifecycleSheet(item));
    viewer.querySelector("[data-post-history]")?.addEventListener("click", () => openPostLifecycleSheet(item, { historyOnly: true }));
    viewer.querySelector(".viewerCreatorMenu [data-not-interested]")?.addEventListener("click", (event) => hideNotInterested(event.currentTarget));
    viewer.querySelector(".viewerCreatorMenu [data-report]")?.addEventListener("click", (event) => openReportSheet(Number(event.currentTarget.dataset.report)));
    viewer.querySelectorAll(".viewerCreatorMenu button").forEach((button) => button.addEventListener("click", () => {
      if (creatorMenu) creatorMenu.hidden = true;
      creatorMenuButton?.setAttribute("aria-expanded", "false");
    }));
    const creatorMenuButton = viewer.querySelector("[data-viewer-creator-menu]");
    const creatorMenu = viewer.querySelector(".viewerCreatorMenu");
    creatorMenuButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = creatorMenu.hasAttribute("hidden");
      creatorMenu.toggleAttribute("hidden", !opening);
      creatorMenuButton.setAttribute("aria-expanded", String(opening));
    });
    const viewerMedia = viewer.querySelector(".viewerStage>video,.viewerStage>img");
    const viewerVideo = viewer.querySelector(".viewerStage>video");
    applySocialMuted(viewer, readSocialMuted());
    const viewerPlay = viewer.querySelector(".viewerPlayState");
    const headerPlay = viewer.querySelector("[data-viewer-play]");
    const syncViewerPlay = () => {
      if (viewerPlay) {
        viewerPlay.textContent = viewerVideo?.paused ? "▶" : "❚❚";
        viewerPlay.hidden = viewer.classList.contains("viewerCommentsOpen") ? true : !viewerVideo?.paused;
      }
      headerPlay?.classList.toggle("paused", Boolean(viewerVideo?.paused));
      headerPlay?.setAttribute("aria-pressed", String(!viewerVideo?.paused));
    };
    const toggleViewerPlay = () => {
      if (!viewerVideo) return;
      if (viewerVideo.paused) viewerVideo.play().catch(() => {}); else viewerVideo.pause();
      syncViewerPlay();
    };
    bindDoubleTapHeart(viewerMedia, {
      onSingle: () => { if (viewerVideo) toggleViewerPlay(); },
      onHeart: () => primaryHeartForPost(Number(item.id), viewer.querySelector(".viewerStage")),
    });
    viewerVideo?.addEventListener("play", syncViewerPlay);
    viewerVideo?.addEventListener("pause", syncViewerPlay);
    viewerVideo?.addEventListener("loadedmetadata", () => {
      document.getElementById("viewerStage").dataset.aspect = viewerVideo.videoWidth > viewerVideo.videoHeight ? "landscape" : "portrait";
    });
    if (Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0 && typeof item.kind === "string") {
      mediaViewerState.exposure = { postId: Number(item.id), mediaKind: item.media.kind, startedAt: performance.now(), maxProgress: 0 };
      viewerVideo?.addEventListener("timeupdate", () => {
        const exposure = mediaViewerState?.exposure;
        if (!exposure || exposure.postId !== Number(item.id) || !Number.isFinite(viewerVideo.duration) || viewerVideo.duration <= 0) return;
        exposure.maxProgress = Math.max(exposure.maxProgress, viewerVideo.currentTime / viewerVideo.duration);
      });
    }
    viewerPlay?.addEventListener("click", toggleViewerPlay);
    if (headerPlay) headerPlay.onclick = toggleViewerPlay;
    viewer.querySelector("[data-viewer-sound]")?.addEventListener("click", (event) => {
      const muted = !readSocialMuted();
      writeSocialMuted(muted);
      if (viewerVideo) viewerVideo.muted = muted;
      applySocialMuted(document, muted);
      const soundButton = event.currentTarget;
      const soundIcon = soundButton.querySelector(".viewerSolidIcon");
      if (soundIcon) soundIcon.innerHTML = solidViewerIcon(muted ? "mute" : "sound");
      soundButton.setAttribute("aria-label", t(muted ? "post.enableSound" : "post.disableSound"));
    });
    const shortcut = document.getElementById("viewerCommentShortcut");
    shortcut.dataset.comments = String(item.id);
    shortcut.onclick = () => openViewerComments(Number(item.id));
    syncViewerPlay();
    preloadNeighbors();
  };
  const step = (direction) => {
    if (!isCurrentSession()) return;
    if (viewer.querySelector(".viewerCommentsPanel")) dismissCommentOverlay();
    mediaViewerState.index = (mediaViewerState.index + direction + mediaViewerState.items.length) % mediaViewerState.items.length;
    render();
  };
  const applyViewerGesture = (dx, dy) => {
    if (!isCurrentSession() || viewer.querySelector(".viewerCommentsPanel")) return false;
    const decision = decideViewerGesture({ dx, dy });
    if (decision.action !== "step") return false;
    step(decision.offset);
    return true;
  };
  viewer.querySelector("[data-viewer-back]")?.addEventListener("click", () => {
    if (viewer.querySelector(".viewerCommentsPanel")) {
      dismissCommentOverlay();
      return;
    }
    closeMediaViewer();
  });
  viewer.addEventListener("click", (event) => {
    if (!event.target.closest("[data-viewer-reactions], .viewerReactionTray")) {
      const reactionTray = viewer.querySelector(".viewerReactionTray:not([hidden])");
      if (reactionTray) {
        reactionTray.hidden = true;
        viewer.querySelector("[data-viewer-reactions]")?.setAttribute("aria-expanded", "false");
      }
    }
    if (!event.target.closest("[data-viewer-creator-menu], .viewerCreatorMenu")) {
      const creatorMenu = viewer.querySelector(".viewerCreatorMenu:not([hidden])");
      if (creatorMenu) {
        creatorMenu.hidden = true;
        viewer.querySelector("[data-viewer-creator-menu]")?.setAttribute("aria-expanded", "false");
      }
    }
    if (!event.target.closest("[data-viewer-more], .viewerActionMenu")) {
      const actionMenu = viewer.querySelector(".viewerActionMenu:not([hidden])");
      if (actionMenu) {
        actionMenu.hidden = true;
        viewer.querySelector("[data-viewer-more]")?.setAttribute("aria-expanded", "false");
      }
    }
  });
  viewer.addEventListener("keydown", (event) => {
    const commentsPanel = viewer.querySelector(".viewerCommentsPanel");
    const isEditing = event.target.matches?.("input, textarea, select, [contenteditable='true']");
    const reactionTray = viewer.querySelector(".viewerReactionTray:not([hidden])");
    if (event.key === "Escape" && reactionTray) {
      reactionTray.hidden = true;
      viewer.querySelector("[data-viewer-reactions]")?.setAttribute("aria-expanded", "false");
      event.preventDefault();
    } else if (event.key === "Escape" && commentsPanel) {
      dismissCommentOverlay();
      event.preventDefault();
    } else if (event.key === "Escape" && viewer.querySelector(".viewerCreatorMenu:not([hidden])")) {
      viewer.querySelector(".viewerCreatorMenu").hidden = true;
      viewer.querySelector("[data-viewer-creator-menu]")?.setAttribute("aria-expanded", "false");
      event.preventDefault();
    } else if (event.key === "Escape" && viewer.querySelector(".viewerActionMenu:not([hidden])")) {
      viewer.querySelector(".viewerActionMenu").hidden = true;
      viewer.querySelector("[data-viewer-more]")?.setAttribute("aria-expanded", "false");
      event.preventDefault();
    } else if (event.key === "Escape") closeMediaViewer();
    else if (!commentsPanel && !isEditing && event.key === "ArrowUp") { event.preventDefault(); step(-1); }
    else if (!commentsPanel && !isEditing && event.key === "ArrowDown") { event.preventDefault(); step(1); }
  });
  viewer.addEventListener("pointerdown", (event) => {
    if (!isCurrentSession() || event.pointerType === "touch") return;
    mediaViewerState.pointer = null;
    if (viewer.querySelector(".viewerCommentsPanel") || event.target.closest("button, input, textarea, select, a, [contenteditable], .viewerCommentsPanel")) return;
    mediaViewerState.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { viewer.setPointerCapture(event.pointerId); } catch { /* Capture is an enhancement. */ }
  });
  viewer.addEventListener("pointerup", (event) => {
    if (!isCurrentSession() || event.pointerType === "touch") return;
    const start = mediaViewerState?.pointer;
    if (!start || start.id !== event.pointerId) return;
    mediaViewerState.pointer = null;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    applyViewerGesture(dx, dy);
  });
  viewer.addEventListener("pointercancel", () => { if (isCurrentSession()) mediaViewerState.pointer = null; });
  viewer.addEventListener("touchstart", (event) => {
    if (!isCurrentSession()) return;
    mediaViewerState.touch = null;
    if (event.touches.length !== 1 || viewer.querySelector(".viewerCommentsPanel")) return;
    if (event.target.closest("button, input, textarea, select, a, [contenteditable], .viewerCommentsPanel")) return;
    const touch = event.touches[0];
    mediaViewerState.touch = { id: touch.identifier, x: touch.clientX, y: touch.clientY, lastX: touch.clientX, lastY: touch.clientY };
  }, { passive: true });
  viewer.addEventListener("touchmove", (event) => {
    if (!isCurrentSession()) return;
    const start = mediaViewerState?.touch;
    if (!start) return;
    if (event.touches.length !== 1 || viewer.querySelector(".viewerCommentsPanel")) { mediaViewerState.touch = null; return; }
    const touch = Array.from(event.touches).find((item) => item.identifier === start.id);
    if (!touch) { mediaViewerState.touch = null; return; }
    start.lastX = touch.clientX;
    start.lastY = touch.clientY;
    if (Math.max(Math.abs(start.lastX - start.x), Math.abs(start.lastY - start.y)) > 8) event.preventDefault();
  }, { passive: false });
  viewer.addEventListener("touchend", (event) => {
    if (!isCurrentSession()) return;
    const start = mediaViewerState?.touch;
    if (!start) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
    mediaViewerState.touch = null;
    if (!touch || event.touches.length !== 0) return;
    applyViewerGesture(touch.clientX - start.x, touch.clientY - start.y);
  }, { passive: true });
  viewer.addEventListener("touchcancel", () => { if (isCurrentSession()) mediaViewerState.touch = null; }, { passive: true });
  const handleViewerVisibility = () => {
    if (!isCurrentSession()) return document.removeEventListener("visibilitychange", handleViewerVisibility);
    if (viewer.inert) return;
    const video = viewer.querySelector(".viewerStage>video");
    if (!video) return;
    if (document.hidden) {
      mediaViewerState.resumeOnVisible = !video.paused;
      video.pause();
    } else if (mediaViewerState.resumeOnVisible && !viewer.querySelector(".viewerCommentsPanel")) {
      mediaViewerState.resumeOnVisible = false;
      video.play().catch(() => {});
    }
  };
  mediaViewerState.visibilityHandler = handleViewerVisibility;
  document.addEventListener("visibilitychange", handleViewerVisibility);
  render();
  viewer.focus();
  if (options.openComments === true) {
    const postId = Number(mediaViewerState?.items[mediaViewerState.index]?.id || 0);
    queueMicrotask(() => {
      if (isCurrentSession() && postId) void openViewerComments(postId);
    });
  }
}

function closeModerationSheet() {
  trustLoadGate.invalidate();
  document.getElementById("moderationSheet")?.remove();
}

function moderationSheet(title, body, eyebrow = t("moderation.eyebrow")) {
  closeModerationSheet();
  document.body.insertAdjacentHTML("beforeend", [
    '<div class="sheet-backdrop moderation-backdrop" id="moderationSheet">',
    '<section class="account-modal moderation-sheet" role="dialog" aria-modal="true" aria-labelledby="moderationTitle" tabindex="-1">',
    '<button class="sheet-close" type="button" aria-label="' + esc(t("common.close")) + '">×</button>',
    '<small>' + esc(eyebrow) + '</small><h3 id="moderationTitle">' + esc(title) + '</h3>', body,
    '</section></div>',
  ].join(""));
  const sheet = document.querySelector("#moderationSheet .moderation-sheet");
  document.querySelector("#moderationSheet .sheet-close").addEventListener("click", closeModerationSheet);
  const backdrop = document.getElementById("moderationSheet");
  backdrop.addEventListener("click", (event) => { if (event.target.id === "moderationSheet") closeModerationSheet(); });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); closeModerationSheet(); }
  });
  sheet.focus();
  return sheet;
}

const TRUST_SIGNAL_KEYS = Object.freeze({
  POLITICAL_CONTENT: "trust.signalPolitical", NEWS_CLAIM: "trust.signalNews",
  HEALTH_CLAIM: "trust.signalHealth", FINANCIAL_CLAIM: "trust.signalFinancial",
  CREDENTIAL_THEFT_SOLICITATION: "trust.signalCredential", DIRECT_VIOLENT_THREAT: "trust.signalThreat",
  EXPLICIT_ILLEGAL_DRUG_SALE: "trust.signalIllegalSale", AI_GENERATED: "trust.signalAiGenerated",
  AI_ASSISTED: "trust.signalAiAssisted", SOURCE_LINK_PRESENT: "trust.signalSourceLink",
  SOURCE_NOT_PROVIDED: "trust.signalSourceMissing",
});
const TRUST_BASIS_KEYS = Object.freeze({
  LOCAL_TEXT_RULE: "trust.basisLocalText", LOCAL_CONTEXT_RULE: "trust.basisLocalContext",
  AUTHOR_DECLARATION: "trust.basisAuthor", TEXT_STRUCTURE: "trust.basisStructure",
});

function trustSignalMessage(code) {
  const normalized = String(code || "");
  if (normalized.startsWith("SAFETY_CONTEXT_")) return t("trust.signalSafetyContext");
  return t(TRUST_SIGNAL_KEYS[normalized] || "trust.signalMeaning");
}

function trustBasisMessage(basis) {
  return t(TRUST_BASIS_KEYS[String(basis || "")] || "trust.basisUnknown");
}

async function openTrustLens(postId) {
  postId = Number(postId);
  const viewerId = Number(state?.user?.id);
  const viewerPersona = state?.persona;
  const request = trustLoadGate.begin();
  const r = await api("/api/social/posts/" + postId + "/trust");
  const a = r?.assessment;
  const assessmentKeys = new Set(["policyVersion", "engine", "decision", "riskLevel", "labels", "reasons", "provenance", "factualStatus", "visualSafety", "automatedOnly", "humanVerified", "truthPercentage", "assessmentHash", "authorDisputed", "createdAt"]);
  const assessmentLabels = Array.isArray(a?.labels) ? a.labels : [];
  const assessmentReasons = Array.isArray(a?.reasons) ? a.reasons : [];
  const reportRows = Array.isArray(r?.my_reports) ? r.my_reports : [];
  const validAssessment = a && typeof a === "object" && !Array.isArray(a)
    && Object.keys(a).every((key) => assessmentKeys.has(key))
    && typeof a.policyVersion === "string" && a.policyVersion.length >= 1 && a.policyVersion.length <= 80
    && typeof a.engine === "string" && a.engine.length >= 1 && a.engine.length <= 80
    && new Set(["ALLOW", "ALLOW_WITH_CONTEXT", "BLOCK"]).has(a.decision)
    && new Set(["LOW", "CONTEXT", "HIGH"]).has(a.riskLevel)
    && assessmentLabels.length <= 32 && assessmentLabels.every((label) => label && typeof label === "object" && !Array.isArray(label)
      && typeof label.code === "string" && label.code.length <= 80 && typeof label.basis === "string" && label.basis.length <= 80
      && typeof label.meaning === "string" && label.meaning.length <= 500)
    && assessmentReasons.length <= 32 && assessmentReasons.every((reason) => typeof reason === "string" && reason.length <= 500)
    && a.provenance && typeof a.provenance === "object" && !Array.isArray(a.provenance)
    && typeof a.provenance.status === "string" && a.provenance.status.length <= 80 && a.provenance.independentlyVerified === false
    && typeof a.factualStatus === "string" && a.factualStatus.length <= 80
    && typeof a.visualSafety === "string" && a.visualSafety.length <= 100
    && a.automatedOnly === true && a.humanVerified === false && a.truthPercentage === null
    && /^[a-f0-9]{64}$/.test(String(a.assessmentHash || "")) && typeof a.authorDisputed === "boolean"
    && Number.isSafeInteger(Number(a.createdAt)) && Number(a.createdAt) > 0;
  const validReports = reportRows.length <= 100 && reportRows.every((report) => report && typeof report === "object" && !Array.isArray(report)
    && Number.isSafeInteger(Number(report.id)) && Number(report.id) > 0 && typeof report.category === "string" && report.category.length <= 40
    && typeof report.status === "string" && report.status.length <= 80 && typeof report.outcome === "string" && report.outcome.length <= 100
    && typeof report.reason_code === "string" && report.reason_code.length <= 100);
  const validMethodology = r?.methodology?.no_truth_score === true && r.methodology.community_fake_is_opinion === true
    && r.methodology.automated_only === true && r.methodology.visual_classifier_configured === false
    && r.methodology.report_alone_removes_content === false;
  if (!request.isCurrent() || Number(state?.user?.id) !== viewerId || state?.persona !== viewerPersona) return;
  if (!r?.ok || Number(r.post_id) !== postId || Number(r.viewer_id) !== viewerId || r.viewer_persona !== viewerPersona
    || r.privacy_enforced_server_side !== true || typeof r.can_appeal !== "boolean" || !validAssessment || !validReports || !validMethodology) {
    return toast(t("trust.unavailable"));
  }
  const labels = assessmentLabels.length
    ? assessmentLabels.map((label) => '<li><b><bdi dir="ltr">' + esc(label.code || "CONTEXT_SIGNAL") + '</bdi></b><span>' + esc(trustSignalMessage(label.code)) + '</span><small>' + esc(t("trust.signalBasis")) + ': ' + esc(trustBasisMessage(label.basis)) + '</small></li>').join("")
    : '<li><b>' + esc(t("trust.noSignal")) + '</b><span>' + esc(t("trust.noSignalDetail")) + '</span></li>';
  const sheet = moderationSheet(t("trust.title"), [
    '<div class="trust-method"><b><bdi dir="ltr">' + esc(a.riskLevel || "UNAVAILABLE") + '</bdi></b><span>' + esc(t("trust.policy")) + ' <bdi dir="ltr">' + esc(a.policyVersion || "UNAVAILABLE") + '</bdi></span></div>',
    '<ul class="trust-labels">' + labels + '</ul>',
    '<div class="trust-facts">',
    '<p><b>' + esc(t("trust.factualTitle")) + '</b><span>' + esc(t("trust.factualDetail")) + '</span></p>',
    '<p><b>' + esc(t("trust.provenanceTitle")) + '</b><span><bdi dir="ltr">' + esc(a.provenance?.status || "NOT_DECLARED") + '</bdi> · ' + esc(t("trust.independentNo")) + '</span></p>',
    '<p><b>' + esc(t("trust.visualTitle")) + '</b><span><bdi dir="ltr">' + esc(a.visualSafety || "UNAVAILABLE") + '</bdi></span></p>',
    '<p><b>' + esc(t("trust.methodTitle")) + '</b><span>' + esc(t("trust.methodDetail")) + '</span></p>',
    '</div>',
    a.authorDisputed ? '<p class="appeal-note">' + esc(t("trust.authorDisputed")) + '</p>' : '',
    r.can_appeal ? '<details class="appeal-form"><summary>' + esc(t("trust.appealSummary")) + '</summary><form id="appealAssessment" data-appeal-key="' + esc(newUploadMutationKey("moderation-appeal")) + '"><label>' + esc(t("trust.reason")) + '<textarea name="reason" minlength="8" maxlength="500" required></textarea></label><button class="btn ghost" type="submit">' + esc(t("trust.submitAppeal")) + '</button></form></details>' : '',
    '<p class="sheet-note">' + esc(t("trust.communityFakeNote")) + '</p>',
  ].join(""));
  sheet.querySelector("#appealAssessment")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.inFlight === "true") return;
    const reason = String(new FormData(form).get("reason") || "").trim();
    if (reason.length < 8 || reason.length > 500) return toast(t("trust.appealError"));
    const appellantId = Number(state.user.id);
    const appellantPersona = state.persona;
    form.dataset.inFlight = "true";
    const result = await api("/api/social/posts/" + postId + "/appeal", {
      method: "POST", headers: { "Idempotency-Key": form.dataset.appealKey }, body: { reason },
    }).catch(() => null);
    form.dataset.inFlight = "false";
    const valid = result?.ok === true && result.subject_type === "post" && Number(result.subject_id) === Number(postId)
      && Number(result.appellant_id) === appellantId && result.appellant_persona === appellantPersona
      && result.restriction_changed === false && result.author_disputed === true
      && Number.isSafeInteger(Number(result.appeal?.id)) && Number(result.appeal.id) > 0
      && result.appeal?.status === "RECORDED_AUTOMATED_ONLY"
      && typeof result.appeal?.outcome === "string" && typeof result.appeal?.reason_code === "string"
      && typeof result.appeal?.policy_version === "string" && result.appeal.policy_version.length <= 100
      && /^[a-f0-9]{64}$/.test(String(result.appeal?.assessment_hash || ""))
      && result.statement_of_reasons?.automated_only === true
      && result.statement_of_reasons?.human_review_performed === false
      && result.statement_of_reasons?.restriction_changed === false
      && result.statement_of_reasons?.policy_version === result.appeal.policy_version
      && result.statement_of_reasons?.label_status === result.appeal.outcome;
    if (!valid) return toast(t("trust.appealError"));
    closeModerationSheet();
    toast(t("trust.appealSaved"));
  });
  sheet.querySelector("#appealAssessment")?.addEventListener("input", (event) => {
    if (event.currentTarget.dataset.inFlight !== "true") event.currentTarget.dataset.appealKey = newUploadMutationKey("moderation-appeal");
  });
}

function openReportSheet(postId, subjectType = "post", preselect = null) {
  const categories = [
    ["SCAM_FRAUD","report.scam"],["ILLEGAL_GOODS","report.illegal"],["HARASSMENT_THREAT","report.harassment"],
    ["HATE","report.hate"],["SEXUAL_CONTENT","report.sexual"],["CHILD_SAFETY","report.childSafety"],
    ["PERSONAL_DATA","report.personalData"],["MISINFORMATION_CONTEXT","report.misinformation"],
    ["IMPERSONATION","report.impersonation"],["COPYRIGHT","report.copyright"],
  ];
  const sheet = moderationSheet(t("report.title"), [
    '<p>' + esc(t("report.detail")) + '</p>',
    '<form id="reportForm" data-report-key="' + esc(newUploadMutationKey("moderation-report")) + '"><label>' + esc(t("report.category")) + '<select name="category">' + categories.map(([value,key]) => '<option value="' + value + '"' + (preselect === value ? " selected" : "") + '>' + esc(t(key)) + '</option>').join("") + '</select></label>',
    '<label>' + esc(t("report.optionalDetails")) + '<textarea name="details" maxlength="500"></textarea></label>',
    '<button class="btn" type="submit">' + esc(t("report.send")) + '</button></form>',
    '<p class="sheet-note">' + esc(t("report.syntheticNote")) + '</p>',
  ].join(""));
  sheet.querySelector("#reportForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.currentTarget.dataset.inFlight === "true") return;
    const fd = new FormData(event.target);
    const endpoint = subjectType === "comment" ? "/api/comments/" + postId + "/report" : "/api/social/posts/" + postId + "/report";
    const requestedCategory = String(fd.get("category") || "");
    const reporterId = Number(state.user.id);
    const reporterPersona = state.persona;
    event.currentTarget.dataset.inFlight = "true";
    const r = await api(endpoint, { method: "POST", headers: { "Idempotency-Key": event.currentTarget.dataset.reportKey }, body: { category: requestedCategory, details: fd.get("details") } }).catch(() => null);
    event.currentTarget.dataset.inFlight = "false";
    const exact = r?.ok === true && r.subject_type === subjectType && Number(r.subject_id) === Number(postId)
      && Number(r.reporter_id) === reporterId && r.reporter_persona === reporterPersona
      && Number.isSafeInteger(Number(r.report?.id)) && Number(r.report.id) > 0
      && r.report.category === requestedCategory
      && (subjectType === "comment" ? r.content_removed === false : r.enforcement_changed === false);
    if (!exact) return toast(t("report.error"));
    closeModerationSheet();
    toast(t("report.saved"));
  });
  sheet.querySelector("#reportForm").addEventListener("input", (event) => {
    if (event.currentTarget.dataset.inFlight !== "true") event.currentTarget.dataset.reportKey = newUploadMutationKey("moderation-report");
  });
}

function openSupportSheet(postId, authorHandle) {
  const sheet = moderationSheet("Susține @" + (authorHandle || "creator"), [
    '<p>Reacțiile, comentariile și distribuirea rămân gratuite. Suportul este o plată opțională și nu cumpără ranking organic.</p>',
    '<div class="supportAmounts" role="radiogroup" aria-label="Sumă suport"><button type="button" role="radio" aria-checked="true" class="active" data-support-amount="0.10">0,10 USDC</button><button type="button" role="radio" aria-checked="false" data-support-amount="0.50">0,50 USDC</button><button type="button" role="radio" aria-checked="false" data-support-amount="1.00">1 USDC</button></div>',
    '<div class="supportSplit"><span><b>Creator</b><em>90%</em></span><span><b>Nexus</b><em>5%</em></span><span><b>Safety</b><em>3%</em></span><span><b>Infrastructură</b><em>2%</em></span></div>',
    '<button class="btn" id="prepareSupport" type="button">Continuă în wallet</button>',
    '<p class="sheet-note">Demo local cu fonduri reale dezactivate. Tranzacția va necesita o confirmare separată în wallet; Nexus nu semnează automat.</p>',
  ].join(""), "SUPORT DIRECT · OPȚIONAL");
  sheet.querySelectorAll("[data-support-amount]").forEach((button) => button.addEventListener("click", () => {
    sheet.querySelectorAll("[data-support-amount]").forEach((item) => { item.classList.remove("active"); item.setAttribute("aria-checked", "false"); });
    button.classList.add("active"); button.setAttribute("aria-checked", "true");
  }));
  sheet.querySelector("#prepareSupport").addEventListener("click", () => {
    closeModerationSheet();
    activeSlot = "account";
    selectModule("profiles");
    toast("Configurează walletul; plățile reale rămân oprite în demo");
  });
  sheet.dataset.postId = String(postId);
}

function openPrepublicationReview(draft, initial) {
  const codes = initial.statement_of_reasons?.reason_codes || [];
  const sheet = moderationSheet(t("review.title"), [
    '<p>' + esc(t("review.blockedDetail")) + '</p>',
    '<div class="trust-method"><b>BLOCK</b><span>' + esc(codes.join(" · ") || "SAFETY_RULE") + '</span></div>',
    '<form id="reconsiderForm"><label>' + esc(t("review.revisedText")) + '<textarea name="revised_caption" maxlength="2000" required>' + esc(draft.caption) + '</textarea></label>',
    '<label>' + esc(t("review.reason")) + '<textarea name="reason" minlength="8" maxlength="500" required></textarea></label>',
    '<button class="btn ghost" type="submit">' + esc(t("review.run")) + '</button></form>',
    '<p class="review-outcome sheet-note" aria-live="polite">' + esc(t("review.note")) + '</p>',
  ].join(""));
  sheet.querySelector("#reconsiderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const reason = formData.get("reason");
    const revisedCaption = String(formData.get("revised_caption") || "").trim();
    const result = await api("/api/social/moderation/reconsider", {
      method: "POST",
      body: { caption: draft.caption, revised_caption: revisedCaption, kind: draft.kind, provenance: draft.provenance, reason },
    });
    const output = sheet.querySelector(".review-outcome");
    if (!result.ok) { output.textContent = t("review.error"); return; }
    if (result.may_publish) {
      const composer = document.querySelector('#composerForm textarea[name="caption"]');
      if (composer) composer.value = revisedCaption;
      output.textContent = t("review.allowed");
      setTimeout(() => { closeModerationSheet(); toast(t("review.applied")); }, 450);
    } else {
      output.textContent = t("review.stillBlocked");
    }
  });
}

function beginSecondaryEngagement(scope, fingerprint) {
  const previous = secondaryEngagementMutations.get(scope);
  if (previous?.inFlight) return null;
  const intent = previous?.fingerprint === fingerprint
    ? { ...previous, inFlight: true }
    : { fingerprint, key: newUploadMutationKey(scope), inFlight: true };
  secondaryEngagementMutations.set(scope, intent);
  return intent;
}

function finishSecondaryEngagement(scope, intent, success) {
  if (secondaryEngagementMutations.get(scope)?.key !== intent.key) return;
  if (success) secondaryEngagementMutations.delete(scope);
  else secondaryEngagementMutations.set(scope, { ...intent, inFlight: false });
}

function isExactSecondaryEngagement(result, postId) {
  return result?.ok === true && Number(result.post_id) === Number(postId)
    && Number(result.actor_id) === Number(state.user.id) && result.actor_persona === state.persona;
}

async function hideNotInterested(button) {
  const postId = Number(button.dataset.notInterested);
  const scope = `feedback:${postId}`;
  const intent = beginSecondaryEngagement(scope, `${postId}:${state.user.id}:${state.persona}:NOT_INTERESTED:true`);
  if (!intent) return;
  const result = await api("/api/social/posts/" + postId + "/feedback", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { kind: "NOT_INTERESTED", active: true } }).catch(() => null);
  const exact = isExactSecondaryEngagement(result, postId) && result.kind === "NOT_INTERESTED" && result.active === true && result.private === true;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("post.feedbackUnavailable"));
  document.querySelector('article[data-post-id="' + postId + '"]')?.remove();
  currentFeedPosts = currentFeedPosts.filter((post) => Number(post.id) !== postId);
  if (button.closest("#mediaViewer")) closeMediaViewer();
  toast(t("post.hiddenRecommendation"));
}

// A share card exists only because of the repost, so it leaves with it: this is used both by
// the "Anulează repostarea" menu entry and by pressing the repost control a second time.
function removeRepostCards(postId) {
  document.querySelectorAll('[data-repost-entry][data-post-id="' + postId + '"], [data-repost-entry][data-profile-post="' + postId + '"]')
    .forEach((element) => element.remove());
}

// A repost leaves the profile with the same gesture that put it there.
async function undoRepost(button) {
  const postId = Number(button.dataset.repostUndo);
  if (!Number.isSafeInteger(postId) || postId <= 0) return;
  const scope = `repost:${postId}`;
  const intent = beginSecondaryEngagement(scope, `${postId}:${state.user.id}:${state.persona}:repost:false`);
  if (!intent) return;
  const result = await api("/api/posts/" + postId + "/repost", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active: false } }).catch(() => null);
  const exact = isExactSecondaryEngagement(result, postId) && result.reposted_by_me === false;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("post.repostUnavailable"));
  // The card exists because of the repost, so it leaves with it; every other counter stays.
  removeRepostCards(postId);
  document.querySelectorAll('article[data-post-id="' + postId + '"]').forEach((article) => {
    article.querySelectorAll('[data-repost="' + postId + '"]').forEach((counter) => {
      counter.classList.remove("on");
      const small = counter.querySelector("small");
      if (small) small.textContent = String(result.reposts);
    });
  });
  toast(t("x.repost.undone"));
}

// The account-level actions of the ••• menu. Mute is deliberately weaker than block and
// both are reversible from the same place, which is what a reader expects.
async function toggleAuthorMute(button) {
  const targetId = Number(button.dataset.mute);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
  const active = button.dataset.active !== "1";
  const scope = `mute:${targetId}`;
  const intent = beginSecondaryEngagement(scope, `${targetId}:${state.user.id}:${state.persona}:mute:${active}`);
  if (!intent) return;
  const result = await api("/api/profile/mute", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { user_id: targetId, active } }).catch(() => null);
  const exact = result?.ok === true && Number(result.target_id) === targetId && result.muted === active;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("x.menu.relationshipFailed"));
  document.querySelectorAll('[data-mute="' + targetId + '"]').forEach((element) => {
    element.dataset.active = active ? "1" : "0";
    element.textContent = t(active ? "x.menu.unmute" : "x.menu.mute");
  });
  toast(t(active ? "x.menu.muteDone" : "x.menu.unmuteDone"));
  if (active) {
    document.querySelectorAll('article[data-post-author="' + targetId + '"]').forEach((article) => article.remove());
    currentFeedPosts = currentFeedPosts.filter((post) => Number(post.user_id) !== targetId);
  }
}

async function toggleAuthorBlock(button) {
  const targetId = Number(button.dataset.block);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
  const active = button.dataset.active !== "1";
  const scope = `block:${targetId}`;
  const intent = beginSecondaryEngagement(scope, `${targetId}:${state.user.id}:${state.persona}:block:${active}`);
  if (!intent) return;
  const result = await api("/api/profile/block", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { user_id: targetId, active } }).catch(() => null);
  const exact = result?.ok === true && Number(result.target_id) === targetId && result.active === active;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("x.menu.relationshipFailed"));
  document.querySelectorAll('[data-block="' + targetId + '"]').forEach((element) => {
    element.dataset.active = active ? "1" : "0";
    element.textContent = t(active ? "x.menu.unblock" : "x.menu.block");
  });
  toast(t(active ? "x.menu.blockDone" : "x.menu.unblockDone"));
  if (active) {
    document.querySelectorAll('article[data-post-author="' + targetId + '"]').forEach((article) => article.remove());
    currentFeedPosts = currentFeedPosts.filter((post) => Number(post.user_id) !== targetId);
  }
}

function toggleAuthorFavorite(button) {
  const targetId = Number(button.dataset.favorite);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
  const favorites = new Set(readSocialFavorites().map(Number));
  if (favorites.has(targetId)) favorites.delete(targetId);
  else favorites.add(targetId);
  writeSocialFavorites([...favorites]);
  const active = favorites.has(targetId);
  document.querySelectorAll('[data-favorite="' + targetId + '"]').forEach((element) => {
    element.dataset.active = active ? "1" : "0";
    element.textContent = t(active ? "x.menu.unfavorite" : "x.menu.favorite");
  });
  toast(t("x.menu.favoriteDone"));
}

function postLinkFor(postId) {
  return location.origin + location.pathname + "#post-" + Number(postId);
}

// A profile photo is not content: no reactions, no rail, no counters. Close it by tapping
// anywhere, which is the only thing a reader can reasonably want there.
function openProfilePhoto(url, name = "") {
  const safe = safeInternalMediaUrl(url);
  if (!safe) return;
  document.getElementById("profilePhotoLayer")?.remove();
  const host = document.querySelector(".phoneScreen") || app;
  host.insertAdjacentHTML("beforeend", '<div class="profilePhotoLayer" id="profilePhotoLayer" role="dialog" aria-modal="true" aria-labelledby="profilePhotoDialogLabel" tabindex="-1"><span id="profilePhotoDialogLabel" hidden></span><img src="' + esc(safe) + '" alt="' + esc(name) + '" /><button type="button" data-close-profile-photo aria-label="' + esc(t("x.profile.photoClose")) + '">×</button></div>');
  const layer = document.getElementById("profilePhotoLayer");
  const label = document.getElementById("profilePhotoDialogLabel");
  if (label) label.textContent = t("x.profile.photo");
  layer.addEventListener("click", () => layer.remove());
  layer.addEventListener("keydown", (event) => { if (event.key === "Escape") layer.remove(); });
  layer.focus({ preventScroll: true });
}

function copyPostLink(postId) {
  return copyText(postLinkFor(postId), t("x.menu.copyLinkDone"));
}

// "Why am I seeing this" answers with the reasons the server actually used, as keys the interface
// translates, and never with a claim about what other people did.
function showRankingReasons(postId) {
  const post = currentFeedPosts.find((item) => Number(item.id) === Number(postId));
  const reasons = rankingReasonListMarkup(post, { esc, t });
  return moderationSheet(t("x.menu.why"), [
    '<p>' + esc(t("post.whyVisible")) + '</p>',
    reasons || '<p>' + esc(t("feed.empty")) + '</p>',
    '<p class="sheet-note">' + esc(t("post.localPersisted")) + ' · ' + esc(t("post.chainNotSubmitted")) + '</p>',
  ].join(""));
}

async function requestCommunityNote(button) {
  const commentId = Number(button.dataset.commentNote || 0);
  const postId = Number(button.dataset.noteRequest || 0);
  const isComment = Number.isSafeInteger(commentId) && commentId > 0;
  if (!isComment && (!Number.isSafeInteger(postId) || postId <= 0)) return;
  const expectedId = isComment ? commentId : postId;
  const scope = `note-request:${isComment ? "comment" : "post"}:${expectedId}`;
  const intent = beginSecondaryEngagement(scope, `${scope}:${state.user.id}:${state.persona}`);
  if (!intent) return;
  const endpoint = isComment
    ? "/api/comments/" + commentId + "/note-request"
    : "/api/social/posts/" + postId + "/note-request";
  const result = await api(endpoint, { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { reason: "" } }).catch(() => null);
  const exact = result?.ok === true && Number(result.subject_id) === expectedId
    && result.subject_type === (isComment ? "comment" : "post")
    && result.requested_by_me === true && result.enforcement_changed === false && result.note_published === false;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("x.menu.noteRequestFailed"));
  toast(t("x.menu.noteRequested"));
  return moderationSheet(t("x.menu.requestNote"), [
    '<p>' + esc(result.statement || t("x.menu.noteRequestHint")) + '</p>',
    '<p class="sheet-note">' + esc(t("x.menu.noteRequestHint")) + '</p>',
  ].join(""));
}

async function toggleReaction(btn) {
  const postId = Number(btn.dataset.post);
  const reaction = String(btn.dataset.reaction || "");
  const active = !btn.classList.contains("on");
  if (!Number.isSafeInteger(postId) || postId === 0 || !new Set(REACTION_OPTIONS.map(([kind]) => kind)).has(reaction)) return toast(t("post.reactionSaveError"));
  if (postId < 0) {
    const post = currentFeedPosts.find((item) => Number(item.id) === postId)
      || mediaViewerState?.items.find((item) => Number(item.id) === postId);
    if (!post) return toast(t("post.reactionSaveError"));
    post.reactions = post.reactions || { counts: {}, viewer_reaction: null };
    const counts = { ...(post.reactions.counts || {}) };
    const previous = post.reactions.viewer_reaction;
    if (previous) counts[previous] = Math.max(0, Number(counts[previous] || 0) - 1);
    if (active) counts[reaction] = Number(counts[reaction] || 0) + 1;
    post.reactions.counts = counts;
    post.reactions.viewer_reaction = active ? reaction : null;
    document.querySelectorAll('[data-reaction][data-post="' + postId + '"]').forEach((item) => item.classList.toggle("on", post.reactions.viewer_reaction === item.dataset.reaction));
    document.querySelectorAll('[data-reaction-toggle="' + postId + '"],[data-viewer-reactions="' + postId + '"]').forEach((toggle) => {
      applyReactionSummary(toggle, counts, post.reactions.viewer_reaction);
      toggle.setAttribute("aria-expanded", "false");
    });
    const palette = btn.closest(".reactionBar") || btn.closest(".viewerReactionTray");
    palette?.classList.remove("expanded");
    palette?.setAttribute("aria-hidden", "true");
    if (palette?.classList.contains("viewerReactionTray")) palette.hidden = true;
    if (reaction === "FAKE_OPINION") toast(t("post.fakeOpinion"));
    return;
  }
  const intentFingerprint = `${postId}:${state.user.id}:${state.persona}:${reaction}:${active}`;
  const previous = postReactionMutations.get(postId);
  if (previous?.inFlight) return;
  const intent = previous?.fingerprint === intentFingerprint
    ? { ...previous, inFlight: true }
    : { fingerprint: intentFingerprint, key: newUploadMutationKey("post-reaction"), inFlight: true };
  postReactionMutations.set(postId, intent);
  const r = await api("/api/posts/" + postId + "/reaction", {
    method: "POST", headers: { "Idempotency-Key": intent.key }, body: { kind: reaction, active },
  }).catch(() => null);
  const countsValid = r?.counts && typeof r.counts === "object"
    && Object.entries(r.counts).every(([kind, count]) => REACTION_OPTIONS.some(([allowed]) => allowed === kind) && Number.isSafeInteger(Number(count)) && Number(count) >= 0);
  const exactResult = r?.ok === true && Number(r.post_id) === postId
    && Number(r.actor_id) === Number(state.user.id) && r.actor_persona === state.persona
    && r.reaction === reaction && r.active === active
    && r.viewer_reaction === (active ? reaction : null) && countsValid && !("DISLIKE" in r.counts)
    && r.private_dislike_by_me === (active && reaction === "DISLIKE");
  if (!exactResult) {
    postReactionMutations.set(postId, { ...intent, inFlight: false });
    return toast(t("post.reactionSaveError"));
  }
  postReactionMutations.delete(postId);
  const feedPost = currentFeedPosts.find((item) => Number(item.id) === Number(btn.dataset.post));
  if (feedPost) {
    feedPost.reactions = feedPost.reactions || {};
    feedPost.reactions.counts = r.counts || {};
    feedPost.reactions.viewer_reaction = r.viewer_reaction;
  }
  const viewerPost = mediaViewerState?.items.find((item) => Number(item.id) === Number(btn.dataset.post));
  if (viewerPost && viewerPost !== feedPost) {
    viewerPost.reactions = viewerPost.reactions || {};
    viewerPost.reactions.counts = r.counts || {};
    viewerPost.reactions.viewer_reaction = r.viewer_reaction;
  }
  const palette = btn.closest(".reactionBar") || btn.closest(".viewerReactionTray");
  document.querySelectorAll('[data-reaction][data-post="' + postId + '"]').forEach((item) => item.classList.toggle("on", r.viewer_reaction === item.dataset.reaction));
  palette?.classList.remove("expanded");
  palette?.setAttribute("aria-hidden", "true");
  if (palette?.classList.contains("viewerReactionTray")) palette.hidden = true;
  // A reaction can originate in the feed, full-screen viewer, profile grid or post detail. Update every
  // mounted representation from the server-confirmed counts so closing the viewer never reveals stale UI.
  document.querySelectorAll('[data-reaction-toggle="' + postId + '"],[data-viewer-reactions="' + postId + '"]').forEach((toggle) => {
    applyReactionSummary(toggle, r.counts || {}, r.viewer_reaction);
    toggle.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll('[data-reaction="DISLIKE"][data-post="' + btn.dataset.post + '"] small').forEach((label) => { label.textContent = t("reaction.dislike"); });
  if (reaction === "FAKE_OPINION") toast(t("post.fakeOpinion"));
}

function primaryHeartForPost(postId, host) {
  if (!Number.isSafeInteger(postId) || postId === 0) return;
  showDoubleTapHeart(host);
  const button = document.querySelector('[data-reaction="LIKE"][data-post="' + postId + '"]');
  if (button && !button.classList.contains("on")) void toggleReaction(button);
}

// A reply is a comment on the server, so its own controls use the comment endpoints, and
// the counters are read back from the response instead of being guessed in the interface.
function applyCommentReaction(commentId, counts = {}, viewerReaction = null) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  document.querySelectorAll('[data-comment-like="' + commentId + '"]').forEach((element) => {
    element.classList.toggle("on", Boolean(viewerReaction));
    const label = element.querySelector("small");
    if (label) label.textContent = String(total);
    else element.textContent = "♡ " + total;
  });
}

async function toggleCommentLike(button) {
  const commentId = Number(button?.dataset?.commentLike);
  if (!Number.isSafeInteger(commentId) || commentId <= 0) return;
  const active = !button.classList.contains("on");
  const scope = `comment-reaction:${commentId}`;
  const intent = beginSecondaryEngagement(scope, `${commentId}:${state.user.id}:${state.persona}:LIKE:${active}`);
  if (!intent) return;
  const result = await api("/api/comments/" + commentId + "/reaction", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { kind: "LIKE", active } }).catch(() => null);
  const exact = result?.ok === true && Number(result.comment_id) === commentId
    && Number(result.actor_id) === Number(state.user.id) && result.actor_persona === state.persona;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("post.feedbackUnavailable"));
  applyCommentReaction(commentId, result.counts || {}, result.viewer_reaction || null);
}

async function toggleCommentSave(button) {
  const commentId = Number(button?.dataset?.commentSave);
  if (!Number.isSafeInteger(commentId) || commentId <= 0) return;
  const active = !button.classList.contains("on");
  const scope = `comment-save:${commentId}`;
  const intent = beginSecondaryEngagement(scope, `${commentId}:${state.user.id}:${state.persona}:save:${active}`);
  if (!intent) return;
  const result = await api("/api/comments/" + commentId + "/save", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active } }).catch(() => null);
  const exact = result?.ok === true && Number(result.comment_id) === commentId && result.saved === active && result.private === true;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("x.reply.saveFailed"));
  document.querySelectorAll('[data-comment-save="' + commentId + '"]').forEach((element) => {
    element.classList.toggle("on", active);
    element.setAttribute("aria-pressed", String(active));
    element.setAttribute("aria-label", t(active ? "post.saved" : "x.reply.save"));
  });
  toast(t(active ? "x.reply.saved" : "post.removeSaved"));
}

async function toggleCommentShare(button) {
  const commentId = Number(button?.dataset?.commentShare);
  if (!Number.isSafeInteger(commentId) || commentId <= 0 || button.dataset.busy === "1") return;
  const active = !button.classList.contains("on");
  const scope = `comment-share:${commentId}`;
  const intent = beginSecondaryEngagement(scope, `${commentId}:${state.user.id}:${state.persona}:share:${active}`);
  if (!intent) return;
  button.dataset.busy = "1";
  const result = await api("/api/comments/" + commentId + "/share", {
    method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active },
  }).catch(() => null);
  delete button.dataset.busy;
  const exact = result?.ok === true && Number(result.comment_id) === commentId
    && Number(result.actor_id) === Number(state.user.id) && result.actor_persona === state.persona
    && result.shared_by_me === active && Number.isSafeInteger(Number(result.shares)) && Number(result.shares) >= 0
    && result.internal_share === true && result.visibility_changed === false;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("x.reply.shareFailed"));
  document.querySelectorAll('[data-comment-share="' + commentId + '"]').forEach((element) => {
    element.classList.toggle("on", result.shared_by_me === true);
    element.setAttribute("aria-pressed", String(result.shared_by_me === true));
    const counter = element.querySelector("small");
    if (counter) counter.textContent = String(result.shares);
  });
  toast(t(result.shared_by_me ? "x.reply.shared" : "x.reply.unshared"));
}

function wireCommentActionRows(scope) {
  if (!scope) return;
  const bind = (selector, action) => scope.querySelectorAll(selector).forEach((button) => {
    if (button.dataset.commentActionBound === "1") return;
    button.dataset.commentActionBound = "1";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void action(button);
    });
  });
  bind("[data-comment-like]", toggleCommentLike);
  bind("[data-comment-share]", toggleCommentShare);
  bind("[data-comment-save]", toggleCommentSave);
}

async function toggleSave(btn) {
  const postId = Number(btn.dataset.save);
  const active = !btn.classList.contains("on");
  if (Number.isSafeInteger(postId) && postId < 0) {
    const post = currentFeedPosts.find((item) => Number(item.id) === postId)
      || mediaViewerState?.items.find((item) => Number(item.id) === postId);
    if (!post) return toast(t("post.saveError"));
    post.saved_by_me = active;
    document.querySelectorAll('[data-save="' + postId + '"]').forEach((button) => {
      button.classList.toggle("on", active);
      const label = button.querySelector("small");
      if (label) label.textContent = t(active ? "post.saved" : "post.save");
      else button.textContent = t(active ? "post.saved" : "post.save");
      button.setAttribute("aria-label", t(active ? "post.removeSaved" : "post.save"));
    });
    return;
  }
  const scope = `save:${postId}`;
  const intent = beginSecondaryEngagement(scope, `${postId}:${state.user.id}:${state.persona}:save:${active}`);
  if (!intent) return;
  const r = await api("/api/posts/" + postId + "/save", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active } }).catch(() => null);
  const exact = isExactSecondaryEngagement(r, postId) && r.saved === active && r.private === true;
  finishSecondaryEngagement(scope, intent, exact);
  if (exact) {
    btn.classList.toggle("on", r.saved);
    const compactLabel = btn.querySelector("small");
    if (compactLabel) compactLabel.textContent = t(active ? "post.saved" : "post.save");
    else btn.textContent = t(active ? "post.saved" : "post.save");
    btn.setAttribute("aria-label", t(active ? "post.removeSaved" : "post.save"));
  } else toast(t("post.saveError"));
}

function nexusShareIcon(kind) {
  const icons = {
    nexus: '<svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7zM7 9l5 7 5-7"/></svg>',
    repost: '<svg viewBox="0 0 24 24"><path d="m7 7 3-3 3 3M10 4v11a4 4 0 0 0 4 4h3M17 17l3 3-3 3"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-12 7L4 20l1.2-4A8 8 0 1 1 20 11.5Z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-5 16-3.5-6.5ZM11.5 13.5 20 4"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14 14 10M8.5 17.5l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M15.5 6.5l2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  };
  return icons[kind] || icons.more;
}

async function loadNexusShareTargets() {
  const [following, followers, conversations] = await Promise.all([
    api("/api/social/relations?kind=following"), api("/api/social/relations?kind=followers"), api("/api/chat/conversations?persona=social&box=inbox"),
  ]);
  const viewerId = Number(state.user?.id);
  const viewerPersona = state.persona;
  const safeFollowing = isSafeSocialRelationsPage(following, { kind: "following", cursor: "0", viewerId, viewerPersona });
  const safeFollowers = isSafeSocialRelationsPage(followers, { kind: "followers", cursor: "0", viewerId, viewerPersona });
  const safeConversations = conversations?.ok === true && conversations.privacy_enforced_server_side === true
    && Array.isArray(conversations.conversations) && conversations.conversations.length <= 100;
  if (!safeFollowing || !safeFollowers || !safeConversations) return [];
  const people = new Map();
  const add = (person, score = 0, conversationId = null) => {
    const id = Number(person?.user_id ?? person?.id);
    if (!id || id === Number(state.user?.id)) return;
    const previous = people.get(id) || {};
    people.set(id, { ...previous, id, handle: person.handle, name: person.name || person.display_name || person.handle, avatar: person.avatar || previous.avatar || "", conversationId: conversationId || previous.conversationId || null, score: Math.max(Number(previous.score || 0), score) });
  };
  (following.people || []).forEach((person, index) => add(person, 500 - index));
  (followers.people || []).forEach((person, index) => add(person, 400 - index));
  (conversations.conversations || []).forEach((conversation, index) => {
    conversation.participants?.filter((person) => Number(person.id) !== Number(state.user?.id)).forEach((person) => add(person, 1000 - index, conversation.id));
  });
  return [...people.values()].filter((person) => person.handle).sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle)).slice(0, 80);
}

async function sendPostToNexusTarget(target, postId, shareText, shareUrl) {
  let conversationId = Number(target.conversationId || 0);
  if (!conversationId) {
    const created = await api("/api/chat/conversations", { method: "POST", headers: { "Idempotency-Key": newUploadMutationKey("share-conversation") }, body: { kind: "direct", username: target.handle } });
    if (!created.ok) throw new Error(created.error || "Conversația nu a putut fi creată");
    conversationId = Number(created.conversation.id);
    target.conversationId = conversationId;
  }
  const sent = await api("/api/chat/conversations/" + conversationId + "/messages", { method: "POST", headers: { "Idempotency-Key": newUploadMutationKey("share-message") }, body: { kind: "text", body: shareText + (shareUrl ? "\n" + shareUrl : ""), client_nonce: "share:" + postId + ":" + Date.now().toString(36) + ":" + target.id } });
  if (!sent.ok) throw new Error(sent.error || "Postarea nu a fost trimisă");
  if (postId > 0) await api("/api/posts/" + postId + "/share", { method: "POST", headers: { "Idempotency-Key": newUploadMutationKey("share-counter") }, body: { channel: "nexus_message" } });
}

async function sharePost(btn) {
  const postId = Number(btn?.dataset.share);
  const post = currentFeedPosts.find((item) => Number(item.id) === postId)
    || mediaViewerState?.items.find((item) => Number(item.id) === postId);
  if (!post || !Number.isSafeInteger(postId) || postId === 0) return toast(t("post.shareDisabled"));
  document.getElementById("nexusShareBackdrop")?.remove();
  document.body.insertAdjacentHTML("beforeend", '<div class="nexusShareBackdrop" id="nexusShareBackdrop"><section class="nexusShareSheet" role="dialog" aria-modal="true" aria-labelledby="nexusShareTitle" tabindex="-1"><header><span><small>NEXUS ONLY</small><b id="nexusShareTitle">' + esc(t("post.sendInsideNexus")) + '</b></span><button type="button" aria-label="' + esc(t("common.close")) + '">×</button></header><div class="nexusPeopleShare"><label><input type="search" id="nexusShareSearch" autocomplete="off" placeholder="' + esc(t("post.searchPeople")) + '" /><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></label><div class="nexusSharePeople" id="nexusSharePeople"><p>' + esc(t("friends.loading")) + '</p></div><button class="sendNexusShare" id="sendNexusShare" type="button" disabled>' + esc(t("post.send")) + '</button><p id="nexusShareStatus">' + esc(t("post.internalShareOnly")) + '</p></div></section></div>');
  const backdrop = document.getElementById("nexusShareBackdrop");
  const sheet = backdrop.querySelector(".nexusShareSheet");
  const host = document.getElementById("nexusSharePeople");
  const search = document.getElementById("nexusShareSearch");
  const send = document.getElementById("sendNexusShare");
  const status = document.getElementById("nexusShareStatus");
  const close = () => backdrop.remove();
  sheet.querySelector("header button").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  sheet.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  const targets = await loadNexusShareTargets().catch(() => []);
  if (!backdrop.isConnected) return;
  const selected = new Set();
  const renderTargets = (query = "") => {
    const normalized = query.trim().toLowerCase();
    const visible = targets.filter((target) => !normalized || target.handle.toLowerCase().includes(normalized) || String(target.name || "").toLowerCase().includes(normalized));
    host.innerHTML = visible.length ? visible.map((target) => { const avatar = safeInternalMediaUrl(target.avatar); return '<button type="button" data-share-target="' + target.id + '" class="' + (selected.has(target.id) ? "selected" : "") + '"><i>' + (avatar ? '<img src="' + esc(avatar) + '" alt="" />' : esc(String(target.name || target.handle).slice(0, 2).toUpperCase())) + '</i><span>' + esc(target.name || target.handle) + '<small>@' + esc(target.handle) + '</small></span><em>✓</em></button>'; }).join("") : '<p>' + esc(targets.length ? t("search.noResults") : t("post.noSharePeople")) + '</p>';
    host.querySelectorAll("[data-share-target]").forEach((button) => button.addEventListener("click", () => {
      const id = Number(button.dataset.shareTarget);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      renderTargets(search.value);
      send.disabled = selected.size === 0;
    }));
  };
  renderTargets();
  search.addEventListener("input", () => renderTargets(search.value));
  send.addEventListener("click", async () => {
    if (!selected.size || send.disabled) return;
    send.disabled = true;
    status.textContent = t("post.sending");
    const shareText = (post.caption ? String(post.caption).slice(0, 500) : t("post.nexusPost")) + "\n[NEXUS POST " + postId + "]";
    const wanted = targets.filter((target) => selected.has(target.id));
    const results = await Promise.allSettled(wanted.map((target) => sendPostToNexusTarget(target, postId, shareText, "")));
    const sent = results.filter((result) => result.status === "fulfilled").length;
    if (!sent) { send.disabled = false; status.textContent = t("post.shareSendError"); return; }
    toast(t("post.sentInsideNexus"));
    close();
  });
  sheet.focus();
}

async function toggleRepost(btn) {
  const postId = Number(btn.dataset.repost);
  const active = !btn.classList.contains("on");
  if (postId < 0) {
    const post = currentFeedPosts.find((item) => Number(item.id) === postId)
      || mediaViewerState?.items.find((item) => Number(item.id) === postId);
    if (!post) return;
    post.reposted_by_me = active;
    post.reposts = Math.max(0, Number(post.reposts || 0) + (active ? 1 : -1));
    document.querySelectorAll('[data-repost="' + postId + '"]').forEach((button) => {
      button.classList.toggle("on", active);
      const compact = button.querySelector("small");
      if (compact) compact.textContent = String(post.reposts);
      else button.textContent = "⟳ " + t(socialFormat === "tweets" ? "post.retweet" : "post.repost") + " " + post.reposts;
    });
    return toast(t(active ? "post.reposted" : "post.repostWithdrawn"));
  }
  const scope = `repost:${postId}`;
  const intent = beginSecondaryEngagement(scope, `${postId}:${state.user.id}:${state.persona}:repost:${active}`);
  if (!intent) return;
  const result = await api("/api/posts/" + postId + "/repost", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active } }).catch(() => null);
  const exact = isExactSecondaryEngagement(result, postId) && result.active === active
    && result.reposted_by_me === active && Number.isSafeInteger(Number(result.reposts)) && Number(result.reposts) >= 0;
  finishSecondaryEngagement(scope, intent, exact);
  if (!exact) return toast(t("post.repostUnavailable"));
  // Every repost control for this post agrees, on whichever card it lives (the share card and
  // the post's own card are two views of one action).
  syncRepostControls(postId, result);
  // Pressing the same control again is the undo: the share leaves the profile with it.
  if (!result.reposted_by_me) removeRepostCards(postId);
  toast(t(result.reposted_by_me ? "x.repost.done" : "post.repostWithdrawn"));
}

function syncRepostControls(postId, result) {
  document.querySelectorAll('[data-repost="' + postId + '"]').forEach((control) => {
    control.classList.toggle("on", result.reposted_by_me === true);
    const compact = control.querySelector("small");
    if (compact) compact.textContent = String(result.reposts);
    else control.textContent = "⟳ " + t(socialFormat === "tweets" ? "post.retweet" : "post.repost") + " " + result.reposts;
  });
}

async function toggleComments(btn, postCollection = currentFeedPosts) {
  const id = btn.dataset.comments;
  const article = btn.closest("article");
  if (article?.classList.contains("clipCard") && article.querySelector(".clipStage")) {
    openFeedMediaViewer(Number(id), postCollection, { openComments: true });
    return;
  }
  const box = document.getElementById("comments-" + id);
  if (!box) return openViewerComments(Number(id));
  if (!box.classList.contains("hidden")) return closeCommentsDrawer(box);
  box.classList.remove("hidden");
  box.previousElementSibling?.classList.toggle("hidden", box.classList.contains("hidden"));
  box.closest("article")?.classList.toggle("commentsExpanded", !box.classList.contains("hidden"));
  const stage = box.closest("article")?.querySelector(".clipStage");
  stage?.classList.toggle("commentsOpen", !box.classList.contains("hidden"));
  const stageVideo = stage?.querySelector("video");
  const stagePlay = stage?.querySelector("[data-clip-play]");
  if (stageVideo && stagePlay) {
    stagePlay.textContent = stageVideo.paused ? "▶" : "❚❚";
    stagePlay.hidden = false;
    stagePlay.setAttribute("aria-hidden", "false");
  }
  syncCommentsMode();
  if (!box.classList.contains("hidden")) stage?.classList.remove("clipChromeHidden");
  if (!box.classList.contains("hidden")) {
    registerCommentOverlay(box, btn, () => hideCommentsDrawer(box));
    box.focus({ preventScroll: true });
    wireCommentSurfaceControls(box, Number(id));
    if (Number(id) < 0) {
      renderDemoCommentSurface(box, Number(id));
      return;
    }
    await loadCommentList(box, Number(id));
  }
}

function beginCommentMutation(scope, fingerprint) {
  const previous = commentMutationStates.get(scope);
  if (previous?.inFlight) return null;
  const intent = previous?.fingerprint === fingerprint
    ? { ...previous, inFlight: true }
    : { fingerprint, key: newUploadMutationKey(scope), inFlight: true };
  commentMutationStates.set(scope, intent);
  return intent;
}

function finishCommentMutation(scope, intent, success) {
  if (commentMutationStates.get(scope)?.key !== intent.key) return;
  if (success) commentMutationStates.delete(scope);
  else commentMutationStates.set(scope, { ...intent, inFlight: false });
}

function isSafeCommentResult(result, { postId, commentId = null, parentId = undefined, requireBody = false, withdrawn = false } = {}) {
  const comment = result?.comment;
  if (result?.ok !== true || Number(result.post_id) !== Number(postId)
      || Number(result.actor_id) !== Number(state.user.id) || result.actor_persona !== state.persona
      || !comment || Number(comment.post_id) !== Number(postId)
      || Number(comment.user_id) !== Number(state.user.id) || comment.actor_persona !== state.persona
      || !Number.isSafeInteger(Number(comment.id)) || Number(comment.id) <= 0) return false;
  if (commentId !== null && (Number(result.comment_id) !== Number(commentId) || Number(comment.id) !== Number(commentId))) return false;
  if (parentId !== undefined && Number(result.parent_id || 0) !== Number(parentId || 0)) return false;
  if (withdrawn) return result.tombstone === true && comment.status === "withdrawn" && comment.body === "";
  return !requireBody || (comment.status === "active" && typeof comment.body === "string" && comment.body.length > 0 && comment.body.length <= 1000);
}

async function loadCommentList(scope, postId, cursor = 0, requestedSort = null) {
  if (!scope?.isConnected || !Number.isSafeInteger(postId) || postId <= 0) return;
  const sort = requestedSort === "newest" || scope.dataset.commentSortActive === "newest" ? "newest" : "relevant";
  scope.dataset.commentSortActive = sort;
  let gate = commentListLoadGates.get(scope);
  if (!gate) { gate = createLatestRequestGate(); commentListLoadGates.set(scope, gate); }
  const request = gate.begin();
  const viewerId = Number(state.user.id);
  const viewerPersona = state.persona;
  const r = await api("/api/posts/" + postId + "/comments?sort=" + encodeURIComponent(sort) + "&cursor=" + encodeURIComponent(cursor));
  if (!request.isCurrent() || !scope.isConnected || Number(state.user.id) !== viewerId || state.persona !== viewerPersona) return;
  const list = scope.querySelector(".clist");
  if (!list) return;
  const previous = cursor === 0 ? null : commentPageStates.get(scope);
  const commentsValid = Array.isArray(r.comments) && r.comments.length <= 1000
    && r.comments.every((comment) => Number.isSafeInteger(Number(comment.id)) && Number(comment.id) > 0
      && Number(comment.post_id) === postId && Number.isSafeInteger(Number(comment.user_id)) && Number(comment.user_id) > 0
      && comment.actor_persona === viewerPersona && ["active", "withdrawn"].includes(comment.status)
      && typeof comment.body === "string" && comment.body.length <= 1000
      && typeof comment.can_pin === "boolean" && typeof comment.pinned_by_owner === "boolean");
  const nextCursorValid = r.next_cursor === null || (String(Number(cursor) + 20) === r.next_cursor && Number(r.next_cursor) <= 2000);
  const previousContextValid = cursor === 0 || (previous && previous.viewerId === viewerId && previous.viewerPersona === viewerPersona && previous.sort === sort && previous.nextCursor === String(cursor));
  const duplicateFree = !previous || r.comments.every((comment) => !previous.ids.has(Number(comment.id)));
  if (!r.ok || Number(r.post_id) !== postId || Number(r.viewer_id) !== viewerId
      || r.viewer_persona !== viewerPersona || r.sort !== sort || r.cursor !== String(cursor)
      || !nextCursorValid || !commentsValid || !previousContextValid || !duplicateFree) {
    if (cursor === 0) list.innerHTML = "";
    else list.querySelector("[data-comments-more]")?.remove();
    list.insertAdjacentHTML("beforeend", '<div class="commentLoadError" role="status"><b>' + esc(t("comments.loadError")) + '</b><button type="button" data-comments-retry>' + esc(t("common.retry")) + '</button></div>');
    list.querySelector("[data-comments-retry]")?.addEventListener("click", () => loadCommentList(scope, postId, cursor));
    return;
  }
  const comments = cursor === 0 ? r.comments : [...previous.comments, ...r.comments];
  const pageState = { comments, ids: new Set(comments.map((comment) => Number(comment.id))), nextCursor: r.next_cursor, viewerId, viewerPersona, sort };
  commentPageStates.set(scope, pageState);
  scope._nexusComments = comments;
  list.innerHTML = comments.length ? renderCommentThread(comments, postId, sort) : '<p>' + esc(t("comments.empty")) + '</p>';
  queueCommentImpressions(comments.map((comment) => comment.id));
  if (r.next_cursor !== null) list.insertAdjacentHTML("beforeend", '<button class="commentsMore" type="button" data-comments-more="' + esc(r.next_cursor) + '">' + esc(t("comments.more")) + '</button>');
  list.querySelector("[data-comments-more]")?.addEventListener("click", (event) => {
    const next = Number(event.currentTarget.dataset.commentsMore);
    if (Number.isSafeInteger(next)) loadCommentList(scope, postId, next, sort);
  });
  wireCommentReplyInputs(scope);
  wireCommentActionRows(scope);
  scope.querySelectorAll("[data-comment-pin]").forEach((button) => button.addEventListener("click", async () => {
    const commentId = Number(button.dataset.commentPin);
    const active = button.dataset.active !== "1";
    const mutationScope = `comment-pin:${commentId}`;
    const intent = beginCommentMutation(mutationScope, `${commentId}:${viewerId}:${viewerPersona}:${active}`);
    if (!intent) return;
    const result = await api(`/api/comments/${commentId}/pin`, { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { active } }).catch(() => null);
    const exact = result?.ok && Number(result.comment_id) === commentId && Number(result.post_id) === postId
      && Number(result.actor_id) === viewerId && result.actor_persona === viewerPersona
      && result.pinned === active && result.action === (active ? "comment_pinned" : "comment_unpinned");
    finishCommentMutation(mutationScope, intent, exact);
    if (!exact) return toast(t("comments.pinError"));
    loadCommentList(scope, postId);
  }));
  scope.querySelectorAll("[data-comment-love]").forEach((love) => love.addEventListener("click", async () => {
    const commentId = Number(love.dataset.commentLove);
    const mutationScope = `comment-reaction:${commentId}`;
    const intent = beginCommentMutation(mutationScope, `${commentId}:${viewerId}:${viewerPersona}:LOVE:true`);
    if (!intent) return;
    const result = await api("/api/comments/" + commentId + "/reaction", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { kind: "LOVE", active: true } }).catch(() => null);
    const exact = result?.ok === true && Number(result.comment_id) === commentId && Number(result.post_id) === postId
      && Number(result.actor_id) === viewerId && result.actor_persona === viewerPersona
      && result.reaction === "LOVE" && result.active === true && result.viewer_reaction === "LOVE";
    finishCommentMutation(mutationScope, intent, exact);
    if (!exact) return toast(t("comments.reactionError"));
    await loadCommentList(scope, postId);
  }));
  scope.querySelectorAll("[data-comment-edit]").forEach((button) => button.addEventListener("click", async () => {
    const next = prompt(t("comments.editPrompt"), button.dataset.commentCurrent || "");
    if (next === null || !next.trim()) return;
    const commentId = Number(button.dataset.commentEdit);
    const mutationScope = `comment-edit:${commentId}`;
    const intent = beginCommentMutation(mutationScope, `${commentId}:${viewerId}:${viewerPersona}:${next.trim()}`);
    if (!intent) return;
    const result = await api("/api/comments/" + commentId, { method: "PATCH", headers: { "Idempotency-Key": intent.key }, body: { body: next.trim() } }).catch(() => null);
    const exact = isSafeCommentResult(result, { postId, commentId, requireBody: true }) && result.edited === true && result.history_preserved === true;
    finishCommentMutation(mutationScope, intent, exact);
    if (!exact) return toast(t("comments.editError"));
    toast(t("comments.edited"));
    await loadCommentList(scope, postId);
  }));
  scope.querySelectorAll("[data-comment-withdraw]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm(t("comments.withdrawConfirm"))) return;
    const commentId = Number(button.dataset.commentWithdraw);
    const mutationScope = `comment-withdraw:${commentId}`;
    const intent = beginCommentMutation(mutationScope, `${commentId}:${viewerId}:${viewerPersona}:withdraw`);
    if (!intent) return;
    const result = await api("/api/comments/" + commentId, { method: "DELETE", headers: { "Idempotency-Key": intent.key }, body: {} }).catch(() => null);
    const exact = isSafeCommentResult(result, { postId, commentId, withdrawn: true }) && result.history_preserved === true;
    finishCommentMutation(mutationScope, intent, exact);
    if (!exact) return toast(t("comments.withdrawError"));
    toast(t("comments.withdrawn"));
    await loadCommentList(scope, postId);
  }));
  scope.querySelectorAll("[data-comment-report]").forEach((button) => button.addEventListener("click", () => openReportSheet(Number(button.dataset.commentReport), "comment")));
  wireCommentReplies(scope);
  bindCommentProfiles(scope);
}

async function submitComment(e) {
  e.preventDefault();
  const id = e.target.dataset.commentForm;
  const body = String(new FormData(e.target).get("body") || "");
  if (!body.trim()) return;
  const parentId = e.target.querySelector('input[name="body"]').dataset.parentId;
  const postId = Number(id);
  const normalizedParentId = parentId ? Number(parentId) : null;
  if (Number.isSafeInteger(postId) && postId < 0) {
    const post = currentFeedPosts.find((item) => Number(item.id) === postId)
      || mediaViewerState?.items.find((item) => Number(item.id) === postId);
    if (!post) return toast(t("comments.saveError"));
    post.comment_preview = [...(post.comment_preview || []), { id: -Date.now(), handle: state.user.handle, display_name: activePersonaRecord().name || state.user.handle, body: body.trim(), parent_id: normalizedParentId, reactions: { counts: {} } }];
    post.comment_count = Number(post.comment_count || 0) + 1;
    e.target.reset();
    syncPostCommentCount(postId, post.comment_count);
    await refreshOpenCommentSurfaces(postId);
    return;
  }
  const mutationScope = `comment-create:${postId}`;
  const fingerprint = `${postId}:${state.user.id}:${state.persona}:${normalizedParentId || 0}:${body.trim()}`;
  const intent = beginCommentMutation(mutationScope, fingerprint);
  if (!intent) return;
  const r = await api("/api/posts/" + postId + "/comments", { method: "POST", headers: { "Idempotency-Key": intent.key }, body: { body, parent_id: normalizedParentId } }).catch(() => null);
  const exact = isSafeCommentResult(r, { postId, parentId: normalizedParentId, requireBody: true });
  finishCommentMutation(mutationScope, intent, exact);
  if (exact) {
    e.target.reset();
    const input = e.target.querySelector('input[name="body"]');
    delete input.dataset.parentId;
    input.placeholder = t("comments.input");
    e.target.querySelector("[data-cancel-reply]")?.setAttribute("hidden", "");
    syncPostCommentCount(postId);
    await refreshOpenCommentSurfaces(postId);
  } else toast(t("comments.saveError"));
}

function postRecordsForCommentSync(postId) {
  const records = [...currentFeedPosts, ...(mediaViewerState?.items || [])]
    .filter((post) => Number(post?.id) === Number(postId));
  return [...new Set(records)];
}

function syncPostCommentCount(postId, exactCount = undefined) {
  const records = postRecordsForCommentSync(postId);
  const visibleCounts = [...document.querySelectorAll('[data-comments="' + postId + '"] small,[data-viewer-comments="' + postId + '"] small,[data-comment-count-post="' + postId + '"] small')]
    .map((node) => Number(node.textContent)).filter(Number.isFinite);
  const storedCounts = records.map((post) => Number(post.comment_count || 0)).filter(Number.isFinite);
  const count = Number.isFinite(Number(exactCount))
    ? Math.max(0, Number(exactCount))
    : Math.max(0, ...visibleCounts, ...storedCounts) + 1;
  records.forEach((post) => { post.comment_count = count; });
  document.querySelectorAll('[data-comments="' + postId + '"] small,[data-viewer-comments="' + postId + '"] small,[data-comment-count-post="' + postId + '"] small')
    .forEach((label) => { label.textContent = String(count); });
  return count;
}

async function refreshOpenCommentSurfaces(postId) {
  const scopes = [...document.querySelectorAll('.comments[data-comment-post-id="' + postId + '"]')]
    .filter((scope) => scope.isConnected && !scope.classList.contains("hidden"));
  if (postId < 0) {
    scopes.forEach((scope) => renderDemoCommentSurface(scope, postId));
    return;
  }
  await Promise.all(scopes.map((scope) => loadCommentList(scope, postId, 0, scope.dataset.commentSortActive)));
}

function syncCommentsMode() {
  const screen = document.querySelector(".phoneScreen");
  if (!screen) return;
  const active = Boolean(document.querySelector(".clipCommentsDrawer:not(.hidden)"));
  screen.classList.toggle("commentsModeActive", active);
  const nav = screen.querySelector(".appNav");
  if (!nav) return;
  nav.inert = active;
  if (active) nav.setAttribute("aria-hidden", "true");
  else nav.removeAttribute("aria-hidden");
}

function registerCommentOverlay(element, returnFocus, closeView) {
  if (!element || typeof closeView !== "function") return;
  if (commentOverlayNavigation) dismissCommentOverlay({ fromHistory: true, restoreFocus: false });
  const token = newUploadMutationKey("comment-overlay");
  commentOverlayNavigation = { element, returnFocus, closeView, token };
  try { history.pushState({ ...history.state, nexusCommentOverlay: token }, ""); }
  catch { /* Browser history is an enhancement; explicit close remains available. */ }
}

function dismissCommentOverlay({ fromHistory = false, restoreFocus = true } = {}) {
  const current = commentOverlayNavigation;
  if (!current) return false;
  commentOverlayNavigation = null;
  current.closeView();
  if (!fromHistory && history.state?.nexusCommentOverlay === current.token) {
    suppressNextUiPopstate = true;
    history.back();
  }
  if (restoreFocus && current.returnFocus?.isConnected) queueMicrotask(() => current.returnFocus.focus({ preventScroll: true }));
  return true;
}

function hideCommentsDrawer(box) {
  if (!box) return;
  commentListLoadGates.delete(box);
  commentPageStates.delete(box);
  box.classList.add("hidden");
  box.previousElementSibling?.classList.add("hidden");
  box.closest("article")?.classList.remove("commentsExpanded");
  const stage = box.closest("article")?.querySelector(".clipStage");
  stage?.classList.remove("commentsOpen");
  const video = stage?.querySelector("video");
  const play = stage?.querySelector("[data-clip-play]");
  if (video && play) {
    play.textContent = video.paused ? "▶" : "❚❚";
    play.hidden = !video.paused;
    play.setAttribute("aria-hidden", String(!video.paused));
  }
  syncCommentsMode();
}

function closeCommentsDrawer(box) {
  if (commentOverlayNavigation?.element === box && dismissCommentOverlay()) return;
  hideCommentsDrawer(box);
}

window.addEventListener("popstate", () => {
  if (suppressNextUiPopstate) { suppressNextUiPopstate = false; return; }
  const publicProfile = document.getElementById("publicProfileSheet");
  if (publicProfile) { publicProfile.dismissFromHistory(); return; }
  const contact = document.getElementById('messengerContact');
  if (contact) { contact.dismissFromHistory(); return; }
  const demo = document.querySelector('[data-demo-overlay][open]');
  if (demo) { demo.dismissFromHistory(); return; }
  if (document.getElementById('storyViewer')) { closeStoryViewer(); return; }
  if (dismissCommentOverlay({ fromHistory: true })) return;
  if (document.getElementById("mediaViewer")) { closeMediaViewer({ fromHistory: true }); return; }
  if (document.getElementById('thread')?.children.length) { closeActiveThread(); return; }
  if (document.getElementById("socialFeedSwitcherBackdrop")) { closeSocialFeedSwitcher(); return; }
  if (document.getElementById("socialFriendsSwitcherBackdrop")) { closeSocialFriendsSwitcher(); return; }
  if (document.getElementById("profileSwitcherBackdrop")) { closeProfileSwitcher(); return; }
  if (!state) return;
  const personaHomeModule = state.persona === "travel" ? "stay" : state.persona;
  if (document.getElementById("composerForm")) { goHome(); return; }
  const alreadyHome = state.persona === "social"
    ? activeSlot === "primary" && activeModule === "clips" && socialTopView === "mix" && socialLens === "for-you" && socialFormat === "clips"
    : activeSlot === "primary" && activeModule === personaHomeModule;
  if (!alreadyHome) goHome();
});

async function toggleFollow(btn) {
  if (!btn?.isConnected || btn.disabled) return;
  const target = Number(btn.dataset.follow);
  if (!Number.isSafeInteger(target) || target <= 0 || target === Number(state.user?.id)) return toast(t("post.followUpdateError"));
  const selectedPersona = state.persona;
  const pending = btn.dataset.pending === "1";
  const active = pending ? false : btn.dataset.active === "0";
  const intent = `${target}:${selectedPersona}:${active}`;
  if (btn.dataset.followIntent !== intent || !btn.dataset.followKey) {
    btn.dataset.followIntent = intent;
    btn.dataset.followKey = newUploadMutationKey("follow-toggle");
  }
  btn.disabled = true;
  const r = await api("/api/follow", {
    method: "POST",
    headers: { "Idempotency-Key": btn.dataset.followKey },
    body: { user_id: target, persona: selectedPersona, active },
  }).catch(() => null);
  if (!btn.isConnected || state.persona !== selectedPersona) return;
  const valid = Boolean(r?.ok && typeof r.active === "boolean" && typeof r.request_pending === "boolean" && !(r.active && r.request_pending));
  const exact = valid && Number(r.actor_id) === Number(state.user.id) && r.actor_persona === selectedPersona
    && Number(r.target_id) === target && r.target_persona === selectedPersona;
  if (exact) {
    document.querySelectorAll('[data-follow="' + target + '"]').forEach((followButton) => {
      followButton.dataset.active = r.active ? "1" : "0";
      followButton.dataset.pending = r.request_pending ? "1" : "0";
      followButton.textContent = followButtonLabel({ active: r.active, pending: r.request_pending });
      followButton.disabled = false;
      delete followButton.dataset.followIntent;
      delete followButton.dataset.followKey;
    });
    syncAuthorFollow([currentFeedPosts, mediaViewerState?.items], target, r);
    if (r.request_pending) toast(t("post.followRequestSent"));
    if (r.devnet && /^[a-f0-9]{64}$/.test(String(r.devnet.txHash || ""))) toast("Devnet: " + r.devnet.txHash.slice(0, 10) + "…");
  } else {
    btn.disabled = false;
    toast(t("post.followUpdateError"));
  }
}

function closeCreateHub() {
  document.getElementById("createHubBackdrop")?.remove();
}

function openCreateHub(preferredMode = "") {
  closeCreateHub();
  const vp = document.getElementById("screenViewport");
  const socialMode = state.persona === "social";
  const draftLabel = t(socialMode ? "create.drafts" : "create.draft");
  vp.insertAdjacentHTML("beforeend", [
    '<div class="createHubBackdrop" id="createHubBackdrop">',
    '<section class="createHub" role="dialog" aria-modal="true" aria-labelledby="createHubTitle" tabindex="-1">',
    '<header><span><small>' + esc(t("create.eyebrow")) + ' · <bdi dir="ltr">' + esc(state.persona.toUpperCase()) + '</bdi></small><h2 id="createHubTitle">' + esc(t("create.title")) + '</h2></span><button id="closeCreateHub" type="button" aria-label="' + esc(t("common.close")) + '">×</button></header>',
    '<div class="createHubGrid">',
    '<button data-create-action="camera" class="primary"><i>◉</i><b>' + esc(t("create.camera")) + '</b><small>' + esc(t("create.cameraDetail")) + '</small></button>',
    '<button data-create-action="gallery"><i>▧</i><b>' + esc(t("create.gallery")) + '</b><small>' + esc(t("create.galleryDetail")) + '</small></button>',
    socialMode ? '<button data-create-action="story" class="' + (preferredMode === "story" ? "recommended" : "") + '"><i>◌</i><b>Story</b><small>' + esc(t("create.storyDetail")) + '</small></button>' : '',
    socialMode ? '<button data-create-action="clip"><i>▶</i><b>Clip</b><small>' + esc(t("create.clipDetail")) + '</small></button>' : '',
    '<button data-create-action="post"><i>≡</i><b>' + esc(t(socialMode ? "create.post" : "create.publish")) + '</b><small>' + esc(t("create.postDetail")) + '</small></button>',
    '<button data-create-action="drafts"><i>▤</i><b>' + esc(draftLabel) + '</b><small>' + esc(t("create.draftsDetail")) + '</small></button>',
    socialMode ? '<button data-create-action="live" class="wide"><i>●</i><b>Live</b><small>' + esc(t("create.liveDetail")) + '</small></button>' : '',
    '</div><p class="createHubTruth">' + esc(t("create.truth")) + '</p>',
    '</section></div>',
  ].join(""));
  const backdrop = document.getElementById("createHubBackdrop");
  const dialog = backdrop.querySelector(".createHub");
  const close = closeCreateHub;
  document.getElementById("closeCreateHub").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  backdrop.querySelectorAll("[data-create-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.createAction;
    close();
    if (action === "camera") openComposer("post", { camera: true, source: "camera" });
    else if (action === "gallery") openComposer("post", { pick: "all", source: "gallery" });
    else if (action === "clip") openComposer("post", { camera: true, source: "clip_camera" });
    else if (action === "story") openComposer("story", { camera: true, source: "story_camera" });
    else if (action === "drafts") openDraftLibrary();
    else if (action === "live") { activeSlot = "utility"; renderNav(); renderSocialLive(document.getElementById("screenViewport")).then(() => openLiveSetupSheet()); }
    else openComposer("post", { source: "tweet" });
  }));
  dialog.focus();
}

const DRAFT_LIMIT_PER_PROFILE = 20;
const DRAFT_FILE_LIMIT = 20 * 1024 * 1024;
const DRAFT_QUOTA_BYTES_PER_PROFILE = 100 * 1024 * 1024;
const DRAFT_PERSONAS = new Set(["social", "work", "dating", "travel", "market"]);
const DRAFT_FIELDS = new Set(["caption", "visibility", "language", "provenance", "persistent", "duration_hours",
  "studio_aspect", "studio_filter", "studio_intensity", "trim_start", "trim_end", "playback_rate", "mute_original",
  "overlay_text", "overlay_position", "overlay_color", "audio_rights", "audio_attribution", "title", "studio_decorations", "publishing_json", "jamendo_track", "studio_transform"]);

function draftScopeKey(owner, persona) {
  return String(Number(owner)) + ":" + String(persona);
}

function safeDraftRecord(draft, owner = state?.user?.id, persona = state?.persona) {
  return validDraft(draft,{owner,persona,personas:DRAFT_PERSONAS,fields:DRAFT_FIELDS,mediaMimes:CREATOR_MEDIA_MIMES,audioMimes:CREATOR_AUDIO_MIMES,maxFileBytes:DRAFT_FILE_LIMIT});
}

function draftRecordBytes(draft) {
  return draftMediaBytes(draft);
}

function draftDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nexus-social-drafts", 2);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains("drafts")
        ? request.transaction.objectStore("drafts")
        : request.result.createObjectStore("drafts", { keyPath: "id" });
      if (!store.indexNames.contains("owner_persona")) store.createIndex("owner_persona", "ownerPersona", { unique: false });
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const value = cursor.value;
        if (value && !value.ownerPersona && Number.isSafeInteger(Number(value.owner)) && DRAFT_PERSONAS.has(value.persona)) {
          cursor.update({ ...value, ownerPersona: draftScopeKey(value.owner, value.persona) });
        }
        cursor.continue();
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function draftTransaction(mode, callback) {
  const db = await draftDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", mode);
      const store = transaction.objectStore("drafts");
      const result = callback(store);
      transaction.oncomplete = () => resolve(result?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("draft transaction aborted"));
    });
  } finally { db.close(); }
}

async function listDrafts(owner = state.user.id, persona = state.persona, { includeOverflow = false } = {}) {
  const db = await draftDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const store = db.transaction("drafts", "readonly").objectStore("drafts");
      const request = store.index("owner_persona").getAll(draftScopeKey(owner, persona));
      request.onsuccess = () => {
        const safe = request.result.filter((draft) => safeDraftRecord(draft, owner, persona)).sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(includeOverflow ? safe : safe.slice(0, DRAFT_LIMIT_PER_PROFILE));
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function getDraft(id, owner = state.user.id, persona = state.persona) {
  const db = await draftDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("drafts", "readonly").objectStore("drafts").get(id);
      request.onsuccess = () => resolve(safeDraftRecord(request.result, owner, persona) ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function deleteDraft(id) {
  const draft = await getDraft(id);
  if (!draft) return false;
  const removed = await api('/api/creator/drafts/'+encodeURIComponent(id),{method:'DELETE'});
  if (!removed.ok) throw new Error('Draft deletion failed');
  await draftTransaction("readwrite", (store) => store.delete(id));
  return true;
}

async function clearCurrentUserDeviceCache() {
  const ownerId = Number(state?.user?.id);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return false;
  const localPrefixes = [
    `nexus-sigil:${ownerId}:`,
    `nexus-social-favorites:${ownerId}:`,
    `nexus-curiosity-ledger:${ownerId}`,
    `nexus:story-publish:v1:${ownerId}:`,
    `nexus:upload:v1:${ownerId}:`,
  ];
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && localPrefixes.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    }
  } catch { /* server logout remains authoritative */ }
  try {
    await draftTransaction("readwrite", (store) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (Number(cursor.value?.owner) === ownerId) cursor.delete();
        cursor.continue();
      };
    });
  } catch { /* browser storage may be unavailable; no protected response cache exists */ }
  revokeDecryptedAttachmentUrls();
  return true;
}

async function enforceDraftQuota(owner, persona, record) {
  const scoped = await listDrafts(owner, persona, { includeOverflow: true });
  const plan = planDraftEvictions([...scoped.filter((item) => item.id !== record.id), record], {
    maxCount: DRAFT_LIMIT_PER_PROFILE,
    maxBytes: DRAFT_QUOTA_BYTES_PER_PROFILE,
    preserveId: record.id,
    sizeOf: draftRecordBytes,
  });
  // Autosave must never silently delete an older draft to make room for a new one.
  if (plan.overQuota || plan.evictIds.length) throw new Error("draft quota exceeded");
  return { totalBytes: plan.retainedBytes, limitBytes: DRAFT_QUOTA_BYTES_PER_PROFILE };
}

function formatDraftBytes(value) {
  const megabytes = Math.max(0, Number(value) || 0) / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

function saveComposerDraft(form, mode, options = {}) {
  return serializeDraftWrite(form, () => writeComposerDraft(form, mode, options));
}

async function writeComposerDraft(form, mode, { localOnly = false } = {}) {
  if (!form.isConnected || form.dataset.discarding) throw new Error('draft editor closed');
  const owner = Number(state.user.id);
  const persona = state.persona;
  if (!Number.isSafeInteger(owner) || owner <= 0 || !DRAFT_PERSONAS.has(persona) || !new Set(["post", "story"]).has(mode)) throw new Error("invalid draft scope");
  const fields = {};
  [...form.elements].forEach((control) => {
    if (!control.name || control.type === "file" || control.type === "submit") return;
    if (!DRAFT_FIELDS.has(control.name) || /seed|mnemonic|private[_-]?key|password/i.test(control.name)) return;
    fields[control.name] = control.type === "checkbox" ? control.checked : control.value;
  });
  const sourceFile = form.elements.file?.files?.[0] || null;
  const audioFile = form.elements.audio_file?.files?.[0] || null;
  form.dataset.draftId ||= localDraftId();
  const record = {
    id: form.dataset.draftId || localDraftId(), owner, ownerPersona: draftScopeKey(owner, persona),
    persona, mode, updatedAt: Date.now(), fields, sourceFile, audioFile, sourceFiles: [...(form.elements.file?.files || [])],
  };
  if (!safeDraftRecord(record, owner, persona)) throw new Error("draft validation failed");
  if(draftRecordBytes(record)>DRAFT_QUOTA_BYTES_PER_PROFILE)throw new Error('draft quota exceeded');
  await enforceDraftQuota(owner, persona, record);
  await draftTransaction("readwrite", (store) => store.put(record));
  if (Number(state.user.id) !== owner || state.persona !== persona || !form.isConnected) return record.id;
  form.dataset.draftId = record.id;
  if (localOnly) return record.id;
  remoteComposerDraftAttempts.add(form);
  await syncCreatorDraft({form,record,mode,fields,audioFile,uploadMediaResumable,isCurrent:()=>Number(state.user.id)===owner&&state.persona===persona&&form.isConnected});
  committedComposerDrafts.set(form, record);
  toast(t("draft.saved"));
  return record.id;
}

function discardComposerSessionDraft(form) {
  const id = form.dataset.draftId;
  const baseline = committedComposerDrafts.get(form);
  const owner = Number(state.user.id), persona = state.persona;
  return serializeDraftWrite(form, async () => {
    if (!form.isConnected || Number(state.user.id) !== owner || state.persona !== persona) throw new Error('Sesiunea s-a schimbat. Reîncearcă.');
    if (id && !baseline && remoteComposerDraftAttempts.has(form)) {
      const response = await api('/api/creator/drafts/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!response.ok) throw new Error('Draftul online nu a putut fi eliminat. Reîncearcă.');
    }
    if (id) await draftTransaction('readwrite', (store) => {
      if (baseline && baseline.id === id && safeDraftRecord(baseline, owner, persona)) store.put(baseline);
      else store.delete(id);
    });
  });
}

async function openDraftLibrary() {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(openDraftLibrary)) return;
  const owner = Number(state.user.id);
  const persona = state.persona;
  const vp = document.getElementById("screenViewport");
  vp.innerHTML = '<div class="screen scrollScreen draftLibrary"><header><button id="draftBack" type="button" aria-label="' + esc(t("common.close")) + '">‹</button><span><small>CREATOR STUDIO</small><h2>' + esc(t("draft.title")) + '</h2></span></header><p class="draftPrivacy">' + esc(t("draft.privacy")) + ' <bdi dir="ltr">' + esc(state.persona) + '</bdi></p><div id="draftList"><p class="screenSub">' + esc(t("draft.loading")) + '</p></div></div>';
  document.getElementById("draftBack").addEventListener("click", () => openCreateHub());
  let drafts = [];
  let loadFailed = false;
  try { drafts = await listDrafts(owner, persona); } catch { loadFailed = true; }
  const remote=await api('/api/creator/drafts');
  if(remote.ok&&Number(remote.owner_id)===owner&&remote.owner_persona===persona)vp.querySelector('.draftPrivacy').textContent='Drafturi din cont + copii locale · '+persona;
  if(remote.ok && Number(remote.owner_id)===Number(owner) && remote.owner_persona===persona){loadFailed=false;const merged=new Map(drafts.map(d=>[d.id,d]));for(const entry of remote.drafts||[])if(!merged.has(entry.id)||merged.get(entry.id).updatedAt<entry.updatedAt)merged.set(entry.id,{...entry,remote:true,owner,persona,ownerPersona:draftScopeKey(owner,persona)});drafts=[...merged.values()].sort((a,b)=>b.updatedAt-a.updatedAt);}
  const list = document.getElementById("draftList");
  if (!list?.isConnected || Number(state.user.id) !== owner || state.persona !== persona) return;
  if (loadFailed) {
    list.innerHTML = '<div class="draftEmpty draftError" role="status"><i>!</i><b>' + esc(t("draft.openError")) + '</b><button type="button" data-draft-retry>' + esc(t("common.retry")) + '</button></div>';
    list.querySelector("[data-draft-retry]")?.addEventListener("click", openDraftLibrary);
    return;
  }
  if (!drafts.length) { list.innerHTML = '<div class="draftEmpty"><i>▤</i><b>' + esc(t("draft.empty")) + '</b><span>' + esc(t("draft.emptyDetail")) + '</span></div>'; return; }
  const usedBytes = drafts.reduce((total, draft) => total + draftRecordBytes(draft), 0);
  list.innerHTML = '<div class="draftQuota" role="status"><span>' + esc(t("draft.quota")) + '</span><b>' + esc(formatDraftBytes(usedBytes)) + ' / ' + esc(formatDraftBytes(DRAFT_QUOTA_BYTES_PER_PROFILE)) + '</b><progress max="' + DRAFT_QUOTA_BYTES_PER_PROFILE + '" value="' + usedBytes + '"></progress></div>' + drafts.map((draft) => '<article class="draftCard" data-draft-card="' + esc(draft.id) + '"><div>' + (draft.sourceFile?.type?.startsWith("video/") ? "▶" : draft.sourceFile ? "▧" : "≡") + '</div><span><b>' + esc(draft.fields?.caption || t(draft.mode === "story" ? "draft.storyNoText" : "draft.postNoText")) + '</b><small>' + new Date(draft.updatedAt).toLocaleString(interfaceLocale) + ' · <bdi dir="ltr">' + esc(draft.mode) + '</bdi> · ' + esc(formatDraftBytes(draftRecordBytes(draft))) + '</small></span><button data-open-draft="' + esc(draft.id) + '" type="button">' + esc(t("draft.edit")) + '</button><button data-delete-draft="' + esc(draft.id) + '" type="button" aria-label="' + esc(t("draft.delete")) + '">×</button></article>').join("");
  list.querySelectorAll("[data-open-draft]").forEach((button) => button.addEventListener("click", async () => {
    let draft = drafts.find(entry=>entry.id===button.dataset.openDraft);
    if(draft?.remote){try{draft=await hydrateRemoteDraft(draft);}catch{return toast(t('draft.openError'));}}
    if(!draft)draft=await getDraft(button.dataset.openDraft,owner,persona);
    if (!draft || Number(state.user.id) !== owner || state.persona !== persona) return toast(t("draft.unavailable"));
    openComposer(draft.mode, { draft });
  }));
  list.querySelectorAll("[data-delete-draft]").forEach((button) => button.addEventListener("click", async () => {
    let deleted = false;
    try { const entry=drafts.find(d=>d.id===button.dataset.deleteDraft);deleted=entry?.remote?(await api('/api/creator/drafts/'+entry.id,{method:'DELETE'})).ok:await deleteDraft(button.dataset.deleteDraft); } catch { return toast(t("draft.deleteError")); }
    if (!deleted) return toast(t("draft.unavailable"));
    button.closest("article").remove();
    if (!list.querySelector("article")) list.innerHTML = '<div class="draftEmpty"><i>▤</i><b>' + esc(t("draft.empty")) + '</b></div>';
  }));
}

function stopComposerCamera({ discardRecording = true } = {}) {
  composerCameraRequestGate.invalidate();
  stopCameraBackdrop(document.getElementById("composerCameraBackdrop"));
  const recorder = activeRecorder;
  if (recorder && recorder.state !== "inactive") {
    if (discardRecording) discardedComposerRecorders.add(recorder);
    try { recorder.stop(); } catch { /* Release tracks even if recording failed. */ }
  }
  if (activeRecorder === recorder) activeRecorder = null;
  activeFramedTake?.stop();
  activeFramedTake = null;
  activeComposerStream?.getTracks().forEach((track) => track.stop());
  activeComposerStream = null;
  const camera = document.getElementById("composerCamera");
  camera?.classList.remove("ready");
  const preview = camera?.querySelector("#composerCameraVideo");
  if (preview) preview.srcObject = null;
  camera?.querySelector('.cameraLensDialog')?.remove();
  const record = document.getElementById("recordClip"), stop = document.getElementById("stopRecording"), finish = document.getElementById("finishRecording"), finishLayout = document.getElementById("finishLayout");
  if (record) record.hidden = camera?.dataset?.cameraMode ? camera.dataset.cameraMode !== "clip" : false;
  if (stop) stop.hidden = true;
  if (finish) finish.hidden = true;
  if (finishLayout) finishLayout.hidden = true;
}

async function startComposerCamera(sourceInput, facingMode = "environment") {
  const camera = document.getElementById("composerCamera");
  const video = document.getElementById("composerCameraVideo");
  if (!camera || !video) return;
  setCameraComposerState("camera-loading", { force: true });
  stopComposerCamera();
  const request = composerCameraRequestGate.begin();
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    if (!request.isCurrent() || !sourceInput.isConnected) return;
    camera.querySelector(".reelCameraStatus").textContent = t("camera.unavailable");
    camera.querySelector(".cameraRecovery")?.removeAttribute("hidden");
    setCameraComposerState("error", { force: true });
    return;
  }
  try {
    const portrait = cameraSurfaceIsPortrait(camera);
    const preset = camera.dataset.cameraAspect || '9:16';
    const selectedDevice = camera.dataset.deviceId ? { deviceId: camera.dataset.deviceId, label: camera.dataset.deviceLabel || '' } : null;
    const opened = await openCameraPresetStream(facingMode, portrait, preset, navigator.mediaDevices, selectedDevice);
    const { stream, track: videoTrack } = opened;
    if (!request.isCurrent() || !camera.isConnected || !video.isConnected || !sourceInput.isConnected) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    activeComposerStream = stream;
    video.srcObject = stream;
    startCameraBackdrop(video, camera, stream, () => activeComposerStream === stream);
    camera.dataset.facing = facingMode;
    markCameraRequest(camera, facingMode, portrait);
    camera.classList.add("ready");
    setCameraComposerState("camera-ready");
    camera.querySelector(".cameraRecovery")?.setAttribute("hidden", "");
    camera.querySelector(".reelCameraStatus").textContent = t("camera.active");
    showCameraPresetStatus(camera, { facingMode, lens: opened.lens, zoom: opened.zoom, resizeMode: videoTrack?.getSettings?.().resizeMode });
    syncCameraFraming(video, camera);
    showCameraSensorNote(video, camera);
    const flash = document.getElementById("cameraFlash");
    if (flash) flash.hidden = !(facingMode === "environment" && Boolean(videoTrack?.getCapabilities?.().torch));
  } catch (error) {
    if (!request.isCurrent() || !camera.isConnected || !sourceInput.isConnected) return;
    if (camera.dataset.deviceId && error?.name === 'OverconstrainedError') {
      delete camera.dataset.deviceId; delete camera.dataset.deviceLabel;
      return startComposerCamera(sourceInput, facingMode);
    }
    camera.querySelector(".reelCameraStatus").textContent = t("camera.deniedDetail");
    camera.querySelector(".cameraRecovery")?.removeAttribute("hidden");
    setCameraComposerState("error", { force: true });
    toast(t(error?.name === "NotAllowedError" ? "camera.permissionDenied" : "camera.unavailable"));
  }
}

async function openViewerComments(postId) {
  const viewer = document.getElementById("mediaViewer");
  if (!viewer) return;
  if (mediaViewerState) { mediaViewerState.touch = null; mediaViewerState.pointer = null; }
  let panel = viewer.querySelector(".viewerCommentsPanel");
  if (panel) { dismissCommentOverlay(); return; }
  viewer.querySelector(".viewerReactionTray")?.setAttribute("hidden", "");
  viewer.querySelector("[data-viewer-reactions]")?.setAttribute("aria-expanded", "false");
  viewer.querySelector(".viewerActionMenu")?.setAttribute("hidden", "");
  viewer.querySelector("[data-viewer-more]")?.setAttribute("aria-expanded", "false");
  viewer.querySelector(".viewerCreatorMenu")?.setAttribute("hidden", "");
  viewer.querySelector("[data-viewer-creator-menu]")?.setAttribute("aria-expanded", "false");
  const post = mediaViewerState?.items.find((item) => Number(item.id) === Number(postId));
  if (!post) return;
  const returnFocus = viewer.querySelector('[data-viewer-comments="' + Number(postId) + '"]');
  viewer.insertAdjacentHTML("beforeend", '<section class="comments viewerCommentsPanel" role="region" aria-label="' + esc(t("comments.title")) + '" tabindex="-1" data-comment-post-id="' + Number(postId) + '" data-comment-sort-active="relevant">' + commentSurfaceMarkup(post, { closeAttribute: "data-close-viewer-comments", loading: true }) + '</section>');
  viewer.classList.add("viewerCommentsOpen");
  panel = viewer.querySelector(".viewerCommentsPanel");
  const viewerVideo = viewer.querySelector(".viewerStage>video");
  const viewerPlay = viewer.querySelector(".viewerPlayState");
  if (viewerPlay) {
    viewerPlay.textContent = viewerVideo?.paused ? "▶" : "❚❚";
    viewerPlay.hidden = true;
  }
  const closeView = () => {
    commentListLoadGates.delete(panel);
    commentPageStates.delete(panel);
    panel.remove();
    viewer.classList.remove("viewerCommentsOpen");
    if (viewerPlay) viewerPlay.hidden = !viewerVideo?.paused;
  };
  registerCommentOverlay(panel, returnFocus, closeView);
  panel.focus({ preventScroll: true });
  panel.querySelector("[data-close-viewer-comments]").addEventListener("click", () => dismissCommentOverlay());
  wirePostActions(panel, mediaViewerState?.items || currentFeedPosts);
  wireCommentSurfaceControls(panel, postId);
  if (postId < 0) {
    renderDemoCommentSurface(panel, postId);
  }
  else await loadCommentList(panel, postId);
}

function wireComposerCamera(sourceInput, openNativePicker, { onSoundSelection = () => {}, currentSound = () => null, owner = 0, onClose = goHome } = {}) {
  const camera = document.getElementById("composerCamera");
  if (!camera) return;
  const selectedPersona = state.persona;
  const video = document.getElementById("composerCameraVideo");
  const status = camera.querySelector(".reelCameraStatus");
  const capture = document.getElementById("capturePhoto");
  const record = document.getElementById("recordClip");
  const stop = document.getElementById("stopRecording");
  const finish = document.getElementById("finishRecording");
  const finishLayout = document.getElementById("finishLayout");
  const layoutGuide = document.getElementById("cameraLayoutGuide");
  const form = sourceInput.form;
  let timerSeconds = 0;
  let activeFilter = "none";
  let beauty = false;
  const attachPhotoCanvas = async (canvas, name = "nexus-photo") => {
    try {
      setCameraComposerState("processing", { force: true }); persistFilter();
      const blob = await canvasBlob(canvas, 'image/jpeg', .96);
      if (!sourceInput.isConnected || state.persona !== selectedPersona) return;
      const attached = setInputFile(sourceInput, new File([blob], `${name}-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopComposerCamera(); if (!attached) return toast(t("camera.attachError")); camera.hidden = true;
    } catch { setCameraComposerState("error", { force: true }); toast(t("camera.captureError")); }
  };
  const layoutController = createReelLayoutController({ camera, video, guide: layoutGuide, finish: finishLayout, setState: setCameraComposerState, onComplete: attachPhotoCanvas, onError: () => { setCameraComposerState("error", { force: true }); toast(t("camera.captureError")); } });
  const updateCaptureMode = () => {
    const clip = camera.dataset.cameraMode === "clip";
    capture.hidden = clip;
    record.hidden = !clip;
    stop.hidden = true;
    finish.hidden = true;
    layoutController.updateMode(clip);
  };
  const applyFilter = () => {
    const filters = { none: "", vivid: "saturate(1.35) contrast(1.08)", warm: "sepia(.18) saturate(1.2)", mono: "grayscale(1)" };
    const parts = [filters[activeFilter], beauty ? "brightness(1.06) saturate(1.06)" : ""].filter(Boolean);
    video.style.filter = parts.join(" ");
  };
  const persistFilter = () => {
    const studioFilter = form?.elements?.studio_filter;
    const studioIntensity = form?.elements?.studio_intensity;
    if (studioFilter) studioFilter.value = ({ vivid: "VIVID", warm: "WARM", mono: "MONO" })[activeFilter] || "NONE";
    if (studioIntensity) studioIntensity.value = activeFilter === "none" ? "0" : "70";
  };
  const withCountdown = async (action) => {
    const output = document.getElementById("cameraCountdown");
    if (!timerSeconds || !output) return action();
    output.hidden = false;
    for (let remaining = timerSeconds; remaining > 0; remaining -= 1) {
      if (!camera.isConnected) return;
      output.value = String(remaining); output.textContent = String(remaining);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    output.hidden = true;
    return action();
  };
  applyCameraPreset(camera, camera.dataset.cameraAspect || '9:16');
  startComposerCamera(sourceInput, camera.dataset.facing || "environment");
  updateCaptureMode();
  capture.addEventListener("click", () => withCountdown(async () => { if (!video.videoWidth) return toast(t("camera.notReady")); await layoutController.capture(); }));
  finishLayout.addEventListener("click", () => layoutController.complete());
  record.addEventListener("click", () => withCountdown(async () => {
    if (!activeComposerStream || typeof MediaRecorder === "undefined") return toast(t("camera.recordUnsupported"));
    if (activeRecorder) return;
    const stream = activeComposerStream;
    if (!stream.getAudioTracks().length) {
      try {
        const microphone = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        if (!camera.isConnected || activeComposerStream !== stream) { microphone.getTracks().forEach((track) => track.stop()); return; }
        microphone.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch { /* A Reel can still be recorded silently or receive a selected sound. */ }
    }
    const recover = (message) => cameraRecovery(camera, stopComposerCamera, toast, message);
    const recordingProfile = cameraRecordingProfile(camera.dataset.cameraDuration, DRAFT_FILE_LIMIT);
    const framed = framedCameraTake(video, camera, stream);
    if (camera.dataset.cameraFit === 'fit' && !framed) toast('Clipul păstrează cadrul complet, dar acest browser nu poate înregistra fundalul estompat.');
    let recorder;
    try { recorder = createCameraRecorder(framed?.stream || stream, MediaRecorder, recordingProfile); }
    catch { framed?.stop(); return recover(t("camera.recordUnsupported")); }
    activeRecorder = recorder; activeFramedTake = framed;
    let stopRecordingDial = () => {};
    const recording = startBoundedRecording(recorder, {
      maxBytes: DRAFT_FILE_LIMIT,
      maxDurationMs: recordingProfile.durationSeconds * 1000,
      tracks: stream.getTracks(),
      isCurrent: () => activeRecorder === recorder && activeComposerStream === stream && !discardedComposerRecorders.has(recorder) && sourceInput.isConnected && state.persona === selectedPersona,
      onResult: ({ blob, error }) => {
        stopRecordingDial();
        activeFramedTake?.stop(); activeFramedTake = null;
        if (error) { setCameraComposerState("error", { force: true }); return recover(error === "UPLOAD_TOO_LARGE" ? uploadErrorMessage(new UploadClientError(error)) : t("camera.unavailable")); }
        setCameraComposerState("processing-recording");
        persistFilter();
        const attached = setInputFile(sourceInput, new File([blob], "nexus-clip-" + Date.now() + (blob.type === 'video/mp4' ? '.mp4' : '.webm'), { type: blob.type }));
        stopComposerCamera({ discardRecording: false });
        if (!attached) return recover(t("camera.attachError"));
        camera.hidden = true;
      },
    });
    if (recording.settled) return;
    setCameraComposerState("recording");
    stopRecordingDial = startRecordingDial(camera, recordingProfile.durationSeconds);
    record.hidden = true;
    stop.hidden = false;
    finish.hidden = false;
    stop.onclick = recording.stop;
    finish.onclick = recording.stop;
    status.textContent = t("camera.recording");
  }));
  document.getElementById("switchCamera").addEventListener("click", () => {
    delete camera.dataset.deviceId; delete camera.dataset.deviceLabel;
    startComposerCamera(sourceInput, camera.dataset.facing === "user" ? "environment" : "user");
  });
  document.getElementById("retryCamera")?.addEventListener("click", () => startComposerCamera(sourceInput, camera.dataset.facing || "environment"));
  document.getElementById('cameraLensPick')?.addEventListener('click', async () => {
    await openCameraLensChooser({ camera, media: navigator.mediaDevices,
      currentId: activeComposerStream?.getVideoTracks?.()[0]?.getSettings?.().deviceId,
      onError: toast, onSelect: (device) => {
        camera.dataset.deviceId = device.deviceId; camera.dataset.deviceLabel = device.label || '';
        startComposerCamera(sourceInput, 'environment');
      },
    });
  });
  const openGallery = () => { stopComposerCamera(); sourceInput.removeAttribute("capture"); openNativePicker(); };
  document.getElementById("cameraGallery")?.addEventListener("click", openGallery);
  document.getElementById("cameraClose")?.addEventListener("click", () => onClose(layoutController));
  document.getElementById("cameraAddSound")?.addEventListener("click", () => openReelSoundCatalogue({
    api, owner, current: currentSound(), onSelect: (track) => {
      onSoundSelection(track);
      const label = document.querySelector("#cameraAddSound span");
      if (label) label.textContent = `${track.name} · ${track.artist}`;
    },
  }));
  camera.querySelector('[data-camera-mode="clip"]')?.addEventListener("click", (event) => {
    if (!layoutController.select("off", "Schimbarea în modul Video va șterge cadrele fotografiate. Continui?")) return;
    camera.dataset.cameraMode = "clip";
    camera.dataset.cameraDuration = "60";
    camera.querySelectorAll(".reelCameraDuration button").forEach((entry) => {
      const selected = entry === event.currentTarget;
      entry.classList.toggle("active", selected);
      entry.setAttribute("aria-selected", String(selected));
    });
    updateCaptureMode();
  });
  camera.querySelector('[data-camera-mode="photo"]')?.addEventListener("click", (event) => {
    camera.dataset.cameraMode = "photo";
    camera.dataset.cameraDuration = "0";
    camera.querySelectorAll(".reelCameraDuration button").forEach((entry) => {
      const selected = entry === event.currentTarget;
      entry.classList.toggle("active", selected);
      entry.setAttribute("aria-selected", String(selected));
    });
    updateCaptureMode();
  });
  camera.querySelectorAll("[data-camera-filter]").forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.cameraFilter || "none";
    camera.querySelectorAll("[data-camera-filter]").forEach((entry) => entry.classList.toggle("active", entry.dataset.cameraFilter === activeFilter));
    applyFilter();
  }));
  document.getElementById("cameraEffects")?.addEventListener("click", (event) => {
    const rail = document.getElementById("cameraEffectRail"); rail.hidden = !rail.hidden; event.currentTarget.setAttribute("aria-expanded", String(!rail.hidden));
  });
  document.getElementById("cameraTimer")?.addEventListener("click", (event) => {
    timerSeconds = timerSeconds === 0 ? 3 : timerSeconds === 3 ? 10 : 0;
    event.currentTarget.setAttribute("aria-pressed", String(Boolean(timerSeconds)));
    event.currentTarget.querySelector("small").textContent = timerSeconds ? `${timerSeconds}s` : "Timer";
  });
  document.getElementById("cameraBeauty")?.addEventListener("click", (event) => {
    beauty = !beauty; event.currentTarget.setAttribute("aria-pressed", String(beauty)); applyFilter();
  });
  document.getElementById('cameraFit')?.addEventListener('click', () => {
    if (layoutController.selected() !== 'off') return;
    delete camera.dataset.deviceId; delete camera.dataset.deviceLabel;
    applyCameraPreset(camera, camera.dataset.cameraAspect === '9:16' ? '3:4' : '9:16');
    startComposerCamera(sourceInput, camera.dataset.facing || 'environment');
  });
  document.getElementById("cameraToolsMore")?.addEventListener("click", (event) => {
    const tools = event.currentTarget.closest(".reelCameraTools");
    const collapsed = tools.classList.toggle("collapsed");
    event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
    event.currentTarget.querySelector("i").textContent = collapsed ? "⌃" : "⌄";
  });
  const layoutMenu = document.getElementById("cameraLayoutMenu");
  document.getElementById("cameraLayout")?.addEventListener("click", (event) => {
    layoutMenu.hidden = !layoutMenu.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!layoutMenu.hidden));
  });
  layoutMenu?.querySelectorAll("[data-camera-layout]").forEach((button) => button.addEventListener("click", () => {
    const layout = button.dataset.cameraLayout;
    if (!layoutController.select(layout, "Schimbarea layoutului va șterge cadrele fotografiate. Continui?")) return;
    layoutMenu.querySelectorAll("[data-camera-layout]").forEach((entry) => entry.classList.toggle("active", entry === button));
    layoutMenu.hidden = true;
    const trigger = document.getElementById("cameraLayout");
    trigger?.setAttribute("aria-expanded", "false");
    trigger?.setAttribute("aria-pressed", String(layout !== "off"));
  }));
  document.getElementById("cameraFilters")?.addEventListener("click", (event) => {
    const rail = document.getElementById("cameraEffectRail"); rail.hidden = !rail.hidden; event.currentTarget.setAttribute("aria-expanded", String(!rail.hidden));
  });
  document.getElementById("cameraFlash")?.addEventListener("click", async (event) => {
    const track = activeComposerStream?.getVideoTracks?.()[0];
    const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
    try { await track?.applyConstraints?.({ advanced: [{ torch: next }] }); event.currentTarget.setAttribute("aria-pressed", String(next)); }
    catch { toast(t("camera.unavailable")); }
  });
  camera.querySelector('[data-camera-destination="create"]')?.addEventListener("click", () => {
    if (layoutController.hasFrames()) return toast('Finalizează layoutul sau ieși prin X înainte să schimbi modul.');
    stopComposerCamera(); setCameraComposerState("publishing-details", { force: true }); form?.querySelector('textarea[name="caption"]')?.focus();
  });
  camera.querySelector('[data-camera-destination="live"]')?.addEventListener("click", () => {
    if (requestActiveCameraExit()) return;
    stopComposerCamera(); activeSlot = "utility"; renderNav(); renderSocialLive(document.getElementById("screenViewport")).then(() => openLiveSetupSheet());
  });
  return layoutController;
}

function setUploadProgress(value, label) {
  const box = document.getElementById("uploadProgress");
  if (!box) return;
  box.hidden = false;
  box.classList.remove("error");
  box.querySelector("progress").value = value;
  box.querySelector("b").textContent = label;
  box.querySelector("span").textContent = Math.round(value) + "%";
  box.querySelector("small").textContent = t("upload.flow");
}

function setUploadFailure(message) {
  const box = document.getElementById("uploadProgress");
  if (!box) return;
  box.hidden = false;
  box.classList.add("error");
  box.querySelector("b").textContent = t("upload.errorLabel");
  box.querySelector("small").textContent = message;
}

function uploadResumeStorageKey(file, purpose, checksum) {
  return `nexus:upload:v1:${state?.user?.id || "anon"}:${state?.persona || "social"}:${purpose}:${file.size}:${file.lastModified || 0}:${checksum}`;
}

function newUploadMutationKey(scope) {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `nexus-${scope}-${randomId}`;
}

async function fileSha256(file) {
  // The digest is produced on every origin: the platform's hasher when there is one, and the module's own
  // when there is not. Only a file that cannot be read at all is an integrity failure now.
  try {
    return await digestHexOf(file);
  } catch {
    throw new UploadClientError("UPLOAD_INTEGRITY_UNAVAILABLE");
  }
}

class UploadClientError extends Error {
  constructor(code) {
    super(code);
    this.name = "UploadClientError";
    this.code = code;
  }
}

const UPLOAD_ERROR_MESSAGES = Object.freeze({
  UPLOAD_FILE_INVALID: "upload.invalidFile",
  UPLOAD_TOO_LARGE: "upload.tooLarge",
  UPLOAD_INTEGRITY_UNAVAILABLE: "upload.integrityUnavailable",
  UPLOAD_RESUME_STORAGE_UNAVAILABLE: "upload.resumeStorageUnavailable",
  UPLOAD_STATUS_UNAVAILABLE: "upload.statusUnavailable",
  UPLOAD_SESSION_FAILED: "upload.sessionError",
  UPLOAD_PROTOCOL_INVALID: "upload.protocolError",
  UPLOAD_PART_FAILED: "upload.partError",
  UPLOAD_COMPLETE_FAILED: "upload.completeError",
  UPLOAD_CANCELLED: "upload.cancelled",
  STORY_PUBLISH_RECOVERY_UNAVAILABLE: "upload.resumeStorageUnavailable",
});

function uploadErrorMessage(error) {
  return t(UPLOAD_ERROR_MESSAGES[error?.code] || "upload.failed");
}

function readUploadResume(storageKey) {
  try { return JSON.parse(localStorage.getItem(storageKey) || "null"); }
  catch { throw new UploadClientError("UPLOAD_RESUME_STORAGE_UNAVAILABLE"); }
}

function persistUploadResume(storageKey, resume) {
  try { localStorage.setItem(storageKey, JSON.stringify(resume)); }
  catch { throw new UploadClientError("UPLOAD_RESUME_STORAGE_UNAVAILABLE"); }
}

function clearUploadResume(storageKey) {
  try { localStorage.removeItem(storageKey); } catch { /* completion is already durable server-side */ }
}

function isValidUploadSession(upload, file) {
  return Boolean(
    upload && /^[a-f0-9]{32}$/.test(String(upload.id || "")) &&
    Number.isSafeInteger(Number(upload.total_parts)) && Number(upload.total_parts) > 0 &&
    Number.isSafeInteger(Number(upload.chunk_size)) && Number(upload.chunk_size) > 0 &&
    Number(upload.total_bytes) === Number(file.size) && Array.isArray(upload.parts || [])
  );
}

const STORY_PUBLISH_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function storyPublishStorageKey() {
  return `nexus:story-publish:v1:${state?.user?.id || "anon"}:${state?.persona || "social"}`;
}

async function storyPublishFingerprint(body) {
  // The same rule as every other hash in the app: the digests a publish depends on are produced on any
  // origin, not only where the platform has a native hasher.
  const canonical = JSON.stringify({
    caption: String(body.caption || "").trim().slice(0, 500),
    media_hash: body.media_hash || null,
    visibility: body.visibility,
    persistent: body.persistent === true,
    duration_hours: body.persistent === true ? null : Number(body.duration_hours),
  });
  try {
    return await digestHexOf(canonical);
  } catch {
    throw new UploadClientError("UPLOAD_INTEGRITY_UNAVAILABLE");
  }
}

async function prepareStoryPublishIntent(body, proposedKey) {
  const storageKey = storyPublishStorageKey();
  const fingerprint = await storyPublishFingerprint(body);
  let prior = null;
  try { prior = JSON.parse(localStorage.getItem(storageKey) || "null"); }
  catch { throw new UploadClientError("STORY_PUBLISH_RECOVERY_UNAVAILABLE"); }
  const validPrior = prior && prior.version === 1 && prior.fingerprint === fingerprint
    && typeof prior.key === "string" && prior.key.length >= 16 && prior.key.length <= 180
    && Number(prior.userId) === Number(state.user.id) && prior.persona === "social"
    && Number.isSafeInteger(Number(prior.createdAt)) && Date.now() - Number(prior.createdAt) <= STORY_PUBLISH_INTENT_TTL_MS;
  const intent = validPrior ? prior : {
    version: 1,
    fingerprint,
    key: proposedKey,
    userId: Number(state.user.id),
    persona: "social",
    createdAt: Date.now(),
  };
  try { localStorage.setItem(storageKey, JSON.stringify(intent)); }
  catch { throw new UploadClientError("STORY_PUBLISH_RECOVERY_UNAVAILABLE"); }
  return intent;
}

function clearStoryPublishIntent(intent) {
  const storageKey = storyPublishStorageKey();
  try {
    const current = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (current?.fingerprint === intent?.fingerprint && current?.key === intent?.key) localStorage.removeItem(storageKey);
  } catch { /* server-side idempotency still makes the completed publication safe */ }
}

function isSafePublishedStoryResult(result, { body, media, ownerId }) {
  const story = result?.story;
  const expectedCaption = String(body.caption || "").trim().slice(0, 500);
  const expectedLifecycle = body.persistent === true ? "persistent_until_archived" : "expires";
  return Boolean(result?.ok === true && result.action === "story_published"
    && Number(result.owner_id) === Number(ownerId) && result.owner_persona === "social"
    && result.lifecycle === expectedLifecycle && story && typeof story === "object"
    && Number.isSafeInteger(Number(story.id)) && Number(story.id) > 0
    && Number(story.user_id) === Number(ownerId) && story.persona === "social"
    && story.status === "active" && story.caption === expectedCaption
    && story.visibility === body.visibility && story.lifecycle === expectedLifecycle
    && /^[a-f0-9]{64}$/.test(String(story.content_commitment || ""))
    && story.author && Number(story.author.id) === Number(ownerId)
    && (body.persistent === true ? story.expires_at == null : Number.isSafeInteger(Number(story.expires_at)) && Number(story.expires_at) > Math.floor(Date.now() / 1000))
    && (media ? story.media?.hash === media.hash && story.media?.ext === media.ext && story.media?.kind === media.kind : story.media == null));
}

async function uploadMediaResumable(file, purpose, onProgress = () => {}, cancellation = {}) {
  if (!(file instanceof Blob) || !file.size) throw new UploadClientError("UPLOAD_FILE_INVALID");
  if (file.size > 20 * 1024 * 1024) throw new UploadClientError("UPLOAD_TOO_LARGE");
  cancellation.requested = cancellation.requested === true;
  cancellation.request = async () => {
    cancellation.requested = true;
    if (!cancellation.uploadId || cancellation.cancelInFlight) return;
    cancellation.cancelInFlight = true;
    const result = await api(`/api/uploads/${cancellation.uploadId}/cancel`, {
      method: "POST",
      headers: { "Idempotency-Key": cancellation.cancelKey },
      body: {},
    });
    cancellation.cancelInFlight = false;
    if (result.ok && result.upload?.status === "cancelled" && cancellation.storageKey) clearUploadResume(cancellation.storageKey);
  };
  const stopIfCancelled = async () => {
    if (!cancellation.requested) return;
    await cancellation.request();
    throw new UploadClientError("UPLOAD_CANCELLED");
  };
  onProgress(0.02, t("upload.integrity"));
  const checksum = await fileSha256(file);
  await stopIfCancelled();
  const storageKey = uploadResumeStorageKey(file, purpose, checksum);
  let resume = readUploadResume(storageKey);
  if (resume) {
    resume.completionKey ||= newUploadMutationKey("upload-complete");
    resume.cancelKey ||= newUploadMutationKey("upload-cancel");
    resume.partKeys ||= {};
    persistUploadResume(storageKey, resume);
  }
  let upload = null;
  if (resume?.uploadId) {
    const status = await api(`/api/uploads/${resume.uploadId}`);
    if (!status.ok) throw new UploadClientError("UPLOAD_STATUS_UNAVAILABLE");
    if (new Set(["initiated", "uploading", "completed"]).has(status.upload?.status)) upload = status.upload;
    else if (new Set(["cancelled", "failed", "expired"]).has(status.upload?.status)) {
      clearUploadResume(storageKey);
      resume = null;
    } else throw new UploadClientError("UPLOAD_STATUS_UNAVAILABLE");
  }
  if (!upload) {
    resume = resume?.createKey ? {
      ...resume,
      completionKey: resume.completionKey || newUploadMutationKey("upload-complete"),
      cancelKey: resume.cancelKey || newUploadMutationKey("upload-cancel"),
      partKeys: resume.partKeys || {},
    } : {
      createKey: newUploadMutationKey("upload-create"),
      completionKey: newUploadMutationKey("upload-complete"),
      cancelKey: newUploadMutationKey("upload-cancel"),
      partKeys: {},
    };
    // Persist the create key before the request so a lost response cannot create a duplicate session.
    persistUploadResume(storageKey, resume);
    const created = await api("/api/uploads", {
      method: "POST", headers: { "Idempotency-Key": resume.createKey },
      body: { purpose, mime: file.type || "application/octet-stream", total_bytes: file.size, expected_sha256: checksum },
    });
    if (!created.ok) throw new UploadClientError("UPLOAD_SESSION_FAILED");
    upload = created.upload;
    if (!isValidUploadSession(upload, file)) throw new UploadClientError("UPLOAD_PROTOCOL_INVALID");
    resume.uploadId = upload.id;
    persistUploadResume(storageKey, resume);
  }
  cancellation.uploadId = upload.id;
  cancellation.cancelKey = resume.cancelKey;
  cancellation.storageKey = storageKey;
  await stopIfCancelled();
  if (!isValidUploadSession(upload, file)) throw new UploadClientError("UPLOAD_PROTOCOL_INVALID");
  const received = new Set((upload.parts || []).map((part) => Number(part.part_number)));
  let confirmedBytes = Number(upload.received_bytes || 0);
  onProgress(Math.min(.95, confirmedBytes / upload.total_bytes), t("upload.resuming"));
  if (upload.status !== "completed") {
    for (let part = 0; part < upload.total_parts; part++) {
      if (received.has(part)) continue;
      const start = part * upload.chunk_size;
      const chunk = file.slice(start, Math.min(start + upload.chunk_size, file.size));
      resume.partKeys[part] ||= newUploadMutationKey(`upload-part-${part}`);
      persistUploadResume(storageKey, resume);
      const result = await api(`/api/uploads/${upload.id}/parts/${part}`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", "Idempotency-Key": resume.partKeys[part] },
        rawBody: chunk,
      });
      await stopIfCancelled();
      if (!result.ok) throw new UploadClientError("UPLOAD_PART_FAILED");
      confirmedBytes = Number(result.upload?.received_bytes || confirmedBytes + chunk.size);
      onProgress(Math.min(.95, confirmedBytes / upload.total_bytes), `${t("upload.partConfirmed")} ${part + 1}/${upload.total_parts}`);
    }
  }
  onProgress(.97, t("upload.assembling"));
  await stopIfCancelled();
  const completed = await api(`/api/uploads/${upload.id}/complete`, { method: "POST", headers: { "Idempotency-Key": resume.completionKey }, body: {} });
  if (!completed.ok || !completed.media?.hash) throw new UploadClientError("UPLOAD_COMPLETE_FAILED");
  clearUploadResume(storageKey);
  onProgress(1, completed.media?.client_encrypted ? t("upload.encryptedConfirmed") : t("upload.mediaVerified"));
  return completed;
}

function openComposer(mode = "post", options = {}) {
  if (requestActiveCameraExit()) return;
  if (composerExit?.request(() => openComposer(mode, options))) return;
  // Cererea către camera nativă vine DUPĂ protecția draftului existent. Altfel
  // atingerea lui „+” ar putea ocoli dialogul Salvează / Rămâi / Ieși.
  if ((options.camera || NATIVE_CAMERA_SOURCES.has(options.source)) && requestNativeCamera(options.source || "camera")) return;
  activeCameraExit = null;
  activeDraftBackup = null;
  stopComposerCamera();
  clearComposerPreviewUrl();
  const vp = document.getElementById("screenViewport");
  const selectedPersona = state.persona;
  const socialMode = selectedPersona === "social";
  const storyMode = socialMode && mode === "story";
  const selfieFirst = options.facing === "user";
  const tweetMode = socialMode && !storyMode && options.source === "tweet";
  const liveCamera = Boolean(options.camera);
  const modernFlow = socialMode && !storyMode && !tweetMode;
  // Composerul social este altfel „camera first"; în shell camera este cea nativă.
  if (modernFlow && !isNexusShell()) options = { ...options, camera: true };
  const mediaFirst = Boolean(options.camera || options.pick || storyMode || options.source === "clip");
  const sourceLabel = t(options.source === "camera" ? "composer.sourceCamera" : options.source === "story_camera" ? "composer.sourceStoryCamera" : options.source === "clip_camera" ? "composer.sourceClipCamera" : options.source === "gallery" ? "composer.sourceGallery" : options.source === "clip" ? "composer.sourceClip" : storyMode ? "composer.sourceStory" : "composer.sourceDefault");
  const composerClass = ["premiumComposer", storyMode ? "storyComposer" : "", tweetMode ? "tweetComposer" : "", mediaFirst ? "mediaFirstComposer" : "textFirstComposer", options.camera ? "cameraComposer" : ""].filter(Boolean).join(" ");
  const captionMax = tweetMode || storyMode ? 500 : 2000;
  const captionPlaceholder = tweetMode ? "Scrie un tweet Nexus…" : storyMode ? "Adaugă un text…" : "Ce se întâmplă?";
  let selectedJamendoTrack = null;
  let stopAutoSound = () => {};
  vp.innerHTML = [
    '<div class="screen scrollScreen composerScreen"><div class="composer ' + composerClass + '" data-composer-source="' + esc(options.source || (storyMode ? "story" : "post")) + '"' + (options.camera ? ' data-camera-state="camera-loading"' : '') + '>',
    '<header class="composerHead"><button id="closeComposer" type="button" aria-label="' + esc(t("composer.close")) + '">‹</button><span><small>' + esc(t("create.eyebrow")) + ' · <bdi dir="ltr">' + esc(state.persona.toUpperCase()) + '</bdi></small><b>' + (storyMode ? "Story" : (options.source === "clip" ? "Clip" : esc(t("composer.mixedTitle")))) + '</b><em>' + esc(sourceLabel) + '</em></span></header>',
    socialMode ? '<section class="composerIntent" aria-label="Tip creare"><button type="button" data-source-jump="tweet" class="' + (tweetMode ? "active" : "") + '"><i>𝕏</i><span><b>Tweet</b><small>Text rapid</small></span></button><button type="button" data-source-jump="gallery" class="' + (options.source === "gallery" ? "active" : "") + '"><i>▧</i><span><b>Media</b><small>Poze/video</small></span></button><button type="button" data-source-jump="story" class="' + (storyMode ? "active" : "") + '"><i>◌</i><span><b>Story</b><small>Durată flexibilă</small></span></button></section>' : '',
    '<form id="composerForm" data-publish-key="' + esc(newUploadMutationKey("publish")) + '"' + (options.draft ? ' data-draft-id="' + esc(options.draft.id) + '"' : '') + '>',
    options.camera ? reelCameraMarkup({ esc, t, selfieFirst, clipMode: options.source === "clip_camera" }) : '',
    tweetMode ? '<section class="tweetComposerHint"><b>Tweet Nexus</b><span>Text scurt, opinie, întrebare sau update. Poți adăuga media dacă vrei, dar feedul Tweets afișează doar postările text.</span></section>' : '',
    mediaFirst ? '<section class="mediaFirstHint"><b>' + (storyMode ? "Alege media pentru story" : options.source === "clip" ? "Alege clipul" : "Media first") + '</b><span>' + (storyMode ? "Poți seta story temporar sau persistent." : "După alegere primești preview mare, editare și progres de upload.") + '</span></section>' : '',
    '<div class="field captionField"><label>' + (storyMode ? "Story în Social" : tweetMode ? "Tweet" : "Postează în " + esc(state.persona)) + '<small id="captionCounter">0/' + captionMax + '</small></label><textarea name="caption" placeholder="' + captionPlaceholder + '" maxlength="' + captionMax + '"></textarea></div>',
    '<div class="field"><label>Foto sau video</label><input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"' + (storyMode || options.source === "clip" ? "" : " multiple") + ' />' + (storyMode || options.source === "clip" ? '' : '<small>' + esc(t("composer.galleryHint")) + '</small>') + '</div>',
    socialMode ? '<div class="row socialMeta"><label>Audiență<select name="visibility"><option value="public">Public</option><option value="followers">Followers</option><option value="friends">Friends</option><option value="private">Doar eu</option></select></label><label>Limbă<input name="language" maxlength="10" placeholder="ro" /></label></div>' : '',
    socialMode && !storyMode ? '<div class="field"><label>Proveniența conținutului<select name="provenance"><option value="NOT_DECLARED">Nu declar</option><option value="CAMERA_CAPTURED_DECLARED">Creat de mine / cameră (declarație)</option><option value="AI_ASSISTED">Asistat de AI</option><option value="AI_GENERATED">Generat cu AI</option></select><small>Nexus afișează declarația, dar nu pretinde că a verificat-o independent.</small></label></div>' : '',
    storyMode ? '<div class="storyLifecycle"><label><input type="checkbox" name="persistent" /> Păstrează până arhivez eu</label><label>Durată (ore)<input type="number" name="duration_hours" min="1" max="8760" value="24" /></label></div>' : '',
    '<div class="media-preview" id="preview"></div>',
    options.camera ? reelCameraReviewMarkup() : '',
    socialMode && !storyMode ? creatorStudioMarkup({esc,t}) : '',
    '<div class="uploadProgress" id="uploadProgress" hidden><div><b>' + esc(t("upload.initial")) + '</b><span>0%</span></div><progress max="100" value="0"></progress><small>' + esc(t("upload.flow")) + '</small><button id="cancelUpload" type="button" hidden>' + esc(t("upload.cancel")) + '</button></div>',
    '<div class="composerActions"><button class="btn ghost" id="saveDraft" type="button">Salvează draft</button><button class="btn" type="submit">' + (storyMode ? "Publică story" : "Publică") + '</button></div>',
    '</form></div></div>',
  ].join("");
  document.getElementById("closeComposer").addEventListener("click", goHome);
  document.querySelectorAll("[data-create-mode]").forEach((button) => button.addEventListener("click", () => openComposer(button.dataset.createMode, { source: button.dataset.sourceJump || button.dataset.createMode })));
  document.querySelectorAll("[data-source-jump]").forEach((button) => button.addEventListener("click", () => {
    const source = button.dataset.sourceJump;
    if (source === "gallery") return openComposer("post", { pick: "all", source: "gallery" });
    if (source === "story") return openComposer("story", { pick: "all", source: "story" });
    return openComposer("post", { source: "tweet" });
  }));
  document.getElementById("composerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = e.submitter || form.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    if (modernFlow && !isNexusShell() && form.closest('.cameraComposer')?.dataset.cameraState !== 'publishing-details') return;
    const publishKey = form.dataset.publishKey;
    // Read values before disabling.
    const fd = new FormData(form);
    const composerControls = [...form.querySelectorAll("input,select,textarea,button")];
    const priorDisabled = composerControls.map((control) => control.disabled);
    composerControls.forEach((control) => { control.disabled = true; });
    try {
      const file = fd.get("file");
      // A gallery is allowed for a normal post: one video on its own, or up to ten images. The
      // creator studio still edits the cover, which is what the preview shows.
      const pickedFiles = typeof fd.getAll === "function" ? fd.getAll("file").filter((entry) => entry && entry.size) : [];
      const galleryAllowed = !storyMode && socialMode && pickedFiles.length > 1;
      if (galleryAllowed) {
        const videoCount = pickedFiles.filter((entry) => String(entry.type || "").startsWith("video/")).length;
        if (videoCount > 1) return toast(t("publish.oneVideo"));
        if (videoCount === 1 && pickedFiles.length > 1) return toast(t("publish.videoAlone"));
        if (pickedFiles.length > 10) return toast(t("publish.tooManyMedia"));
      }
      const studioValidationKey = creatorStudioValidationKey(fd, file, { socialMode, storyMode });
      if (studioValidationKey) return toast(t(studioValidationKey));
      let media = null;
      let creatorAudio = null;
      const uploadCancellation = {};
      const cancelUploadButton = document.getElementById("cancelUpload");
      if (cancelUploadButton) {
        cancelUploadButton.hidden = !(file && file.size);
        cancelUploadButton.onclick = () => { cancelUploadButton.disabled = true; uploadCancellation.request?.(); };
      }
      if (file && file.size) {
        const up = await uploadMediaResumable(file, storyMode ? "story" : "social_post", (ratio, label) => setUploadProgress(5 + ratio * 57, label), uploadCancellation);
        if (!form.isConnected || state.persona !== selectedPersona) return;
        if (!up.ok) throw new UploadClientError("UPLOAD_COMPLETE_FAILED");
        if (!up.media.available) return toast(t("upload.quarantined"));
        media = up.media;
        setUploadProgress(62, t("upload.mediaVerified"));
      }
      const galleryMedia = [];
      if (galleryAllowed && media) {
        for (const extra of pickedFiles.slice(1, 10)) {
          const upload = await uploadMediaResumable(extra, "social_post", (ratio, label) => setUploadProgress(62 + ratio * 20, label), uploadCancellation);
          if (!form.isConnected || state.persona !== selectedPersona) return;
          if (!upload.ok) throw new UploadClientError("UPLOAD_COMPLETE_FAILED");
          if (!upload.media.available) return toast(t("upload.quarantined"));
          galleryMedia.push({ hash: upload.media.hash, ext: upload.media.ext });
        }
      }
      if (!storyMode && socialMode) {
        const audioFile = fd.get("audio_file");
        if (audioFile && audioFile.size) {
          if (!media) return toast(t("audio.needsMedia"));
          if (!fd.get("audio_rights")) return toast(t("audio.rightsRequired"));
          const audioUpload = await uploadMediaResumable(audioFile, "social_audio", (ratio, label) => setUploadProgress(66 + ratio * 10, label));
          if (!form.isConnected || state.persona !== selectedPersona) return;
          if (!audioUpload.ok) throw new UploadClientError("UPLOAD_COMPLETE_FAILED");
          if (!audioUpload.media.available) return toast(t("upload.audioQuarantined"));
          creatorAudio = audioUpload.media;
        }
      }
      const studioManifest = !storyMode && socialMode && media ? {
        version: 1,
        aspect: fd.get("studio_aspect"),
        filter: fd.get("studio_filter"),
        intensity: Number(fd.get("studio_intensity")),
        trimStartMs: media.kind === "video" ? Math.round(Number(fd.get("trim_start")) * 1000) : 0,
        trimEndMs: media.kind === "video" ? Math.round(Number(fd.get("trim_end")) * 1000) : 0,
        playbackRate: media.kind === "video" ? Number(fd.get("playback_rate")) : 1,
        muteOriginal: media.kind === "video" ? fd.get("mute_original") === "on" : false,
        overlay: { text: String(fd.get("overlay_text") || ""), position: fd.get("overlay_position"), color: fd.get("overlay_color") },
        decorations: readStudioDecorations(form),
        ...(modernFlow ? {transform:readTransform(form)} : {}),
      } : null;
      const body = storyMode ? {
        caption: fd.get("caption"),
        media_hash: media && media.hash,
        visibility: fd.get("visibility") || "followers",
        persistent: fd.get("persistent") === "on",
        duration_hours: Number(fd.get("duration_hours") || 24),
      } : {
        caption: fd.get("caption"),
        persona: selectedPersona,
        kind: (media && media.kind) || "text",
        media_hash: media && media.hash,
        media_ext: media && media.ext,
        media_items: media ? [{ hash: media.hash, ext: media.ext }, ...galleryMedia] : (galleryMedia.length ? galleryMedia : undefined),
        visibility: fd.get("visibility") || "public",
        language: fd.get("language") || null,
        provenance: fd.get("provenance") || "NOT_DECLARED",
        publishing: modernFlow ? readPublishing(form) : undefined,
        studio_manifest: studioManifest,
        audio_hash: creatorAudio && creatorAudio.hash,
        audio_ext: creatorAudio && creatorAudio.ext,
        audio_rights: creatorAudio ? fd.get("audio_rights") : null,
        audio_attribution: creatorAudio ? fd.get("audio_attribution") : "",
        jamendo_selection_token: !creatorAudio && selectedJamendoTrack?.selection_token || undefined,
        jamendo_preview_offset: !creatorAudio && selectedJamendoTrack ? Number(selectedJamendoTrack.preview_offset || 0) : undefined,
      };
      setUploadProgress(88, t("publish.moderating"));
      const storyIntent = storyMode ? await prepareStoryPublishIntent(body, publishKey) : null;
      const mutationKey = storyIntent?.key || publishKey;
      const r = await api(storyMode ? "/api/stories" : "/api/posts", { method: "POST", headers: { "Idempotency-Key": mutationKey }, body });
      if (!form.isConnected || state.persona !== selectedPersona) return;
      const validStoryResult = storyMode && isSafePublishedStoryResult(r, { body, media, ownerId: state.user.id });
      const validPostResult = !storyMode && r?.ok === true && Number(r.owner_id) === Number(state.user.id)
        && r.owner_persona === selectedPersona && r.action === "post_published"
        && Number(r.post?.user_id) === Number(state.user.id) && r.post?.persona === selectedPersona
        && /^[a-f0-9]{64}$/.test(String(r.post?.content_commitment || ""))
        && r.chain?.status === "not_submitted" && Number(r.chain?.value) === 0
        && (!studioManifest || (r.post?.creator_studio?.integrity === "VERIFIED"
          && JSON.stringify(r.post.creator_studio.manifest) === JSON.stringify(studioManifest)
          && /^[a-f0-9]{64}$/.test(String(r.post.creator_studio.manifest_hash || ""))))
        && (!creatorAudio || (r.post?.audio?.hash === creatorAudio.hash && r.post?.audio?.ext === creatorAudio.ext
          && r.post?.audio_rights === fd.get("audio_rights") && r.post?.audio_attribution === String(fd.get("audio_attribution") || "").trim()))
        && (!selectedJamendoTrack || r.post?.external_audio?.id === selectedJamendoTrack.id);
      if (validStoryResult || validPostResult) {
        if(validPostResult && readPublishing(form).saveToDevice)downloadPublishedPost(r.post,{notify:toast}).catch(error=>toast(error.message));
        stopAutoSound();
        composerExit = null;
        clearComposerPreviewUrl();
        if (storyIntent) clearStoryPublishIntent(storyIntent);
        setUploadProgress(100, t("publish.published"));
        if (form.dataset.draftId) await deleteDraft(form.dataset.draftId).catch(() => {});
        toast(storyMode ? t("publish.storySuccess") : t("publish.postSuccess"));
        activeSlot = "primary";
        selectModule("clips");
      } else if (!storyMode && (r.prepublication_reconsideration_available || r.statement_of_reasons?.prepublication_reconsideration_available)) {
        openPrepublicationReview(body, r);
      } else {
        setUploadFailure(t("publish.error"));
        toast(t("publish.error"));
      }
    } catch (error) {
      const message = uploadErrorMessage(error);
      setUploadFailure(message);
      toast(message);
    } finally {
      composerControls.forEach((control, index) => { if (document.body.contains(control)) control.disabled = priorDisabled[index]; });
    }
  });
  document.getElementById("composerForm").addEventListener("input", (event) => {
    event.currentTarget.dataset.publishKey = newUploadMutationKey("publish");
  });
  const sourceInput = document.querySelector('#composerForm input[name="file"]');
  const studioPanel = document.getElementById("creatorStudio");
  const captionBox = document.querySelector('#composerForm textarea[name="caption"]');
  const captionCounter = document.getElementById("captionCounter");
  captionBox?.addEventListener("input", () => { if (captionCounter) captionCounter.textContent = captionBox.value.length + "/" + captionMax; });
  const isCurrent = () => sourceInput.isConnected && sourceInput.form === document.getElementById("composerForm") && state.persona === selectedPersona;
  const picker = bindComposerPicker(sourceInput, {
    isCurrent: isCurrent,
    hasDraft: () => Boolean(sourceInput.files?.length || captionBox?.value.trim() || sourceInput.form.elements.audio_file?.files?.length || options.draft),
    onEmptyCancel: goHome,
    onRecover: () => {
      const camera = document.getElementById("composerCamera");
      camera?.querySelector(".cameraRecovery")?.removeAttribute("hidden");
    },
  });
  const launchNativePicker = picker.launch;
  const applyCreatorPreview = () => {
    if (!studioPanel) return;
    const form = document.getElementById("composerForm");
    const asset = document.querySelector("#preview .studioAsset");
    const stage = document.querySelector("#preview .previewStage");
    if (!asset || !stage) return;
    const manifest = { filter: form.elements.studio_filter.value, intensity: Number(form.elements.studio_intensity.value) };
    asset.style.filter = studioFilterCss(manifest);
    stage.className = "previewStage studioMedia " + studioAspectClass(form.elements.studio_aspect.value);
    stage.querySelector(".studioOverlay")?.remove();
    const text = form.elements.overlay_text.value.trim();
    if (text) {
      const overlay = document.createElement("span");
      overlay.className = "studioOverlay overlay" + form.elements.overlay_position.value + " color" + form.elements.overlay_color.value;
      overlay.textContent = text;
      stage.append(overlay);
    }
    renderStudioDecorations(stage, readStudioDecorations(form), { form, applyPreview: applyCreatorPreview, interactive: document.querySelector(".cameraComposer")?.classList.contains("cameraReview") });
    document.getElementById("studioIntensity").textContent = form.elements.studio_intensity.value + "%";
    if (asset.tagName === "VIDEO") {
      const reviewing = document.querySelector(".cameraComposer")?.classList.contains("cameraReview");
      asset.muted = reviewing || form.elements.mute_original.checked;
      asset.controls = !reviewing;
      asset.loop = Boolean(reviewing);
      if (reviewing) asset.play().catch(() => {});
      asset.playbackRate = Number(form.elements.playback_rate.value);
    }
    if(modernFlow)applyTransform(stage,asset,readTransform(form));
  };
  if (modernFlow) bindPublishingDetails({form:sourceInput.form,api,toast,applyPreview:applyCreatorPreview,openDrafts:openDraftLibrary});
  sourceInput.addEventListener("change", async (e) => {
    if (!isCurrent()) return;
    let savedTrack = null;
    try { savedTrack = JSON.parse(sourceInput.form.elements.jamendo_track?.value || 'null'); } catch {}
    const cameraSound = options.camera ? selectedJamendoTrack || savedTrack : null;
    const file = e.target.files[0];
    stopAutoSound(); selectedJamendoTrack = cameraSound;
    if (!file) { clearComposerPreviewUrl(); if (options.camera) setCameraComposerState("camera-ready", { force: true }); if (studioPanel) studioPanel.hidden = true; document.getElementById("preview").innerHTML = ""; if (options.pick || options.camera) picker.cancel(); return; }
    if (options.camera) setCameraComposerState("processing-recording", { force: true });
    if (!CREATOR_MEDIA_MIMES.has(file.type)) {
      e.target.value = "";
      clearComposerPreviewUrl();
      if (studioPanel) studioPanel.hidden = true;
      document.getElementById("preview").innerHTML = "";
      if (options.camera) {
        const camera = document.getElementById("composerCamera");
        camera?.querySelector(".cameraRecovery")?.removeAttribute("hidden");
        if (camera?.querySelector(".reelCameraStatus")) camera.querySelector(".reelCameraStatus").textContent = t("studio.invalidMediaType");
        setCameraComposerState("error", { force: true });
      }
      return toast(t("studio.invalidMediaType"));
    }
    let previewUrl;
    try { previewUrl = createComposerPreviewUrl(file); }
    catch {
      if (isCurrent() && sourceInput.files[0] === file) {
        if (options.camera) setCameraComposerState("error", { force: true });
        toast(t("studio.previewError"));
      }
      return;
    }
    if (!isCurrent() || sourceInput.files[0] !== file) { clearComposerPreviewUrl(); return; }
    const isVideo = file.type.startsWith("video/");
    document.getElementById("preview").innerHTML = '<div class="previewStage studioMedia aspectOriginal">' + (isVideo
      ? '<video class="studioAsset" src="' + esc(previewUrl) + '" autoplay loop muted playsinline></video>'
      : '<img class="studioAsset" src="' + esc(previewUrl) + '" alt="' + esc(t("studio.previewAlt")) + '" />') + '</div>';
    if (options.camera) setCameraComposerState("review");
    if (studioPanel) {
      studioPanel.hidden = false;
      document.getElementById("studioKind").textContent = t(isVideo ? "studio.video" : "studio.photo");
      document.getElementById("studioTimeline").hidden = !isVideo;
      const video = document.querySelector("#preview video");
      video?.addEventListener("loadedmetadata", () => {
        if (!video.isConnected) return;
        sourceInput.form.elements.trim_end.value = Math.max(.1, Math.min(600, video.duration || 600)).toFixed(1);
      }, { once: true });
      applyCreatorPreview();
      if (isVideo && video || modernFlow) {
        stopAutoSound = mountReelAutoSound({
          panel: document.getElementById("reelAutoSound"), video:video||document.querySelector('#preview img'), file, api, isCurrent, preferredTrack: cameraSound,
          onSelection: (track) => {
            selectedJamendoTrack = track;
            if (sourceInput.form.elements.jamendo_track) sourceInput.form.elements.jamendo_track.value = track ? JSON.stringify(track) : '';
            const soundLabel=document.getElementById('cameraReviewSound');if(soundLabel)soundLabel.textContent=track?`♫ ${track.name} · ${track.artist}`:'♫ Add sound';
            const soundtrack=document.querySelector('#reelAutoSound audio');if(soundtrack)soundtrack.volume=readTransform(sourceInput.form).musicVolume;
            sourceInput.form.dispatchEvent(new Event('input',{bubbles:true}));
            const audioInput = sourceInput.form.elements.audio_file;
            if (track && audioInput?.files?.length) {
              audioInput.value = "";
              document.getElementById("studioAudioStatus").textContent = t("studio.audioFormats");
            }
          },
        });
      }
    }
  });
  studioPanel?.querySelectorAll("input,select").forEach((control) => control.addEventListener("input", applyCreatorPreview));
  document.querySelector('#creatorStudio input[name="audio_file"]')?.addEventListener("change", (event) => {
    const audio = event.target.files[0];
    const status = document.getElementById("studioAudioStatus");
    if (audio) { stopAutoSound(); selectedJamendoTrack = null; }
    if (!audio) status.textContent = t("studio.audioFormats");
    else if (!CREATOR_AUDIO_MIMES.has(audio.type)) status.textContent = t("studio.invalidAudioType");
    else if (audio.size > 20 * 1024 * 1024) status.textContent = t("studio.audioTooLarge");
    else status.textContent = audio.name + " · " + t("studio.rightsStatus");
  });
  let draftBackup;
  function confirmCameraExit(layoutController) {
    return openCameraExitDialog({
      save: async () => {
        if (activeRecorder) throw new Error('Finalizează înregistrarea înainte să salvezi draftul.');
        if (layoutController.hasFrames() && !layoutController.isComplete()) throw new Error('Finalizează toate cadrele layoutului înainte să salvezi draftul.');
        if (layoutController.isComplete() && !sourceInput.files.length && !await layoutController.complete()) throw new Error('Fotografia compusă nu a putut fi salvată.');
        await saveComposerDraft(form, mode);
        composerExit = null; activeCameraExit = null; goHome();
      },
      discard: async () => {
        form.dataset.discarding = 'true';
        draftBackup?.suspend();
        stopComposerCamera();
        try { await discardComposerSessionDraft(form); composerExit = null; activeCameraExit = null; goHome(); }
        catch (error) {
          delete form.dataset.discarding;
          draftBackup?.resume();
          if (sourceInput.isConnected) startComposerCamera(sourceInput, document.getElementById('composerCamera')?.dataset.facing || 'environment');
          throw error;
        }
      },
    });
  }
  document.getElementById("saveDraft").onclick = () => composerExit.saveOnly().catch(() => toast(t("draft.saveError")));
  const cameraLayoutController = liveCamera ? wireComposerCamera(sourceInput, launchNativePicker, {
    onSoundSelection: (track) => { selectedJamendoTrack = track; },
    currentSound: () => selectedJamendoTrack,
    owner: state.user.id,
    onClose: confirmCameraExit,
  }) : null;
  if (cameraLayoutController) activeCameraExit = () => confirmCameraExit(cameraLayoutController);
  if (options.camera) bindCameraReview({ input: sourceInput, studio: studioPanel, caption: captionBox, applyPreview: applyCreatorPreview, releasePreview: clearComposerPreviewUrl, api, beforeRetake:()=>saveComposerDraft(sourceInput.form,mode,{localOnly:true}), beforeNext:()=>modernFlow ? draftBackup?.flush() : true, restart: () => { const camera = document.getElementById("composerCamera"); if (camera) startComposerCamera(sourceInput, camera.dataset.facing || "environment"); } });
  if(modernFlow)bindTransformEditor(sourceInput.form,applyCreatorPreview);
  if (options.draft) {
    Object.entries(options.draft.fields || {}).forEach(([name, value]) => {
      const control = document.getElementById("composerForm").elements[name];
      if (!control) return;
      if (control.type === "checkbox") control.checked = Boolean(value); else control.value = value;
    });
    if(options.draft.sourceFiles?.length>1){const transfer=new DataTransfer();options.draft.sourceFiles.forEach(file=>transfer.items.add(file));sourceInput.files=transfer.files;sourceInput.dispatchEvent(new Event('change',{bubbles:true}));}
    else if (options.draft.sourceFile && setInputFile(sourceInput, options.draft.sourceFile)) { /* preview dispatched */ }
    const audioInput = document.querySelector('#composerForm input[name="audio_file"]');
    if (audioInput && options.draft.audioFile) setInputFile(audioInput, options.draft.audioFile);
  } else if (options.pick) {
    if (options.pick === "video") sourceInput.accept = "video/mp4,video/webm";
    launchNativePicker();
  }
  const form = sourceInput.form;
  if (options.draft) committedComposerDrafts.set(form, options.draft);
  composerExit = bindComposerExit(form, {
    save: () => saveComposerDraft(form, mode), busy: () => activeRecorder || form.querySelector('[type="submit"]').disabled,
    onBusy: () => toast(t("exit.busy")), translate: t, isCurrent,
  });
  if(modernFlow)activeDraftBackup=draftBackup=bindDraftBackup(form,isCurrent,()=>saveComposerDraft(form,mode,{localOnly:true}));
}

async function renderMarket(vp) { return renderMarketWorkspace(vp, { api, toast, state }); }

function isSafeConversationSummary(conversation, viewerId) {
  if (!conversation || typeof conversation !== "object"
    || !Number.isSafeInteger(Number(conversation.id)) || Number(conversation.id) <= 0
    || !["direct", "group"].includes(conversation.kind)
    || !["active", "request"].includes(conversation.status)
    || !PROFILES.some((profile) => profile[0] === conversation.context_persona)
    || !Number.isSafeInteger(Number(conversation.key_epoch)) || Number(conversation.key_epoch) < 1
    || (conversation.title != null && (typeof conversation.title !== "string" || conversation.title.length > 80))
    || !Number.isSafeInteger(Number(conversation.unread)) || Number(conversation.unread) < 0 || Number(conversation.unread) > 10_000
    || !Array.isArray(conversation.participants) || conversation.participants.length < 1 || conversation.participants.length > 50) return false;
  const participants = conversation.participants;
  const participantIds = participants.map((participant) => Number(participant?.id));
  if (new Set(participantIds).size !== participantIds.length || !participantIds.includes(Number(viewerId))) return false;
  if (!participants.every((participant) => participant && typeof participant === "object"
    && Number.isSafeInteger(Number(participant.id)) && Number(participant.id) > 0
    && typeof participant.handle === "string" && /^[a-z0-9_]{2,30}$/.test(participant.handle)
    && typeof participant.display_name === "string" && participant.display_name.length >= 1 && participant.display_name.length <= 80
    && ["owner", "admin", "member"].includes(participant.role)
    && ["active", "pending"].includes(participant.state)
    && (!participant.avatar || Boolean(safeInternalMediaUrl(participant.avatar))))) return false;
  if (conversation.kind === "direct" && participants.length !== 2) return false;
  const last = conversation.last_message;
  return Boolean(last == null || (last && typeof last === "object"
    && Number.isSafeInteger(Number(last.id)) && Number(last.id) > 0
    && Number.isSafeInteger(Number(last.sender_id)) && participantIds.includes(Number(last.sender_id))
    && typeof last.body === "string" && last.body.length <= 4_000
    && typeof last.encryption_mode === "string" && last.encryption_mode.length <= 48
    && ["sent", "delivered", "read", "expired"].includes(last.status)));
}

function isSafeChatTimestamp(value, nullable = false) {
  if (nullable && value == null) return true;
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10_000_000_000;
}

function isSafeThreadEnvelope(envelope, message, requestedDeviceId) {
  if (envelope == null) return true;
  if (!requestedDeviceId || !envelope || typeof envelope !== "object") return false;
  const publicJwk = envelope.sender_public_jwk;
  const publicKeys = publicJwk && typeof publicJwk === "object" && !Array.isArray(publicJwk) ? Object.keys(publicJwk) : [];
  const group = message.encryption_mode === "e2ee_group_v1";
  const legacyV1 = message.encryption_mode === "e2ee_v1" && message.key_epoch == null && message.key_epoch_commitment == null
    && envelope.key_epoch == null && envelope.key_epoch_commitment == null;
  return Number(envelope.message_id) === Number(message.id)
    && Number(envelope.conversation_id) === Number(message.conversation_id)
    && envelope.recipient_device_id === requestedDeviceId
    && envelope.client_nonce === message.client_nonce
    && envelope.sender_device_id === message.sender_device_id
    && envelope.device_set_commitment === message.device_set_commitment
    && Number(envelope.key_epoch) === Number(message.key_epoch)
    && envelope.key_epoch_commitment === message.key_epoch_commitment
    && typeof envelope.sender_device_id === "string" && /^[A-Za-z0-9:_-]{8,80}$/.test(envelope.sender_device_id)
    && typeof envelope.client_nonce === "string" && /^[A-Za-z0-9:_-]{8,80}$/.test(envelope.client_nonce)
    && typeof envelope.iv_b64 === "string" && /^[A-Za-z0-9+/]{16}={0,2}$/.test(envelope.iv_b64)
    && typeof envelope.ciphertext_b64 === "string" && envelope.ciphertext_b64.length >= 24 && envelope.ciphertext_b64.length <= 16_384 && /^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext_b64)
    && typeof envelope.aad_sha256 === "string" && /^[a-f0-9]{64}$/.test(envelope.aad_sha256)
    && typeof envelope.device_set_commitment === "string" && /^[a-f0-9]{64}$/.test(envelope.device_set_commitment)
    && (legacyV1 || (Number.isSafeInteger(Number(envelope.key_epoch)) && Number(envelope.key_epoch) >= 1
      && typeof envelope.key_epoch_commitment === "string" && /^[a-f0-9]{64}$/.test(envelope.key_epoch_commitment)))
    && publicJwk && typeof publicJwk === "object" && publicJwk.kty === "EC" && publicJwk.crv === "P-256"
    && typeof publicJwk.x === "string" && publicJwk.x.length === 43 && typeof publicJwk.y === "string" && publicJwk.y.length === 43
    && publicKeys.every((key) => new Set(["kty", "crv", "x", "y"]).has(key))
    && (!group || (typeof envelope.shared_iv_b64 === "string" && /^[A-Za-z0-9+/]{16}$/.test(envelope.shared_iv_b64)
      && typeof envelope.shared_ciphertext_b64 === "string" && envelope.shared_ciphertext_b64.length >= 24 && envelope.shared_ciphertext_b64.length <= 87_384 && /^[A-Za-z0-9+/]+={0,2}$/.test(envelope.shared_ciphertext_b64)
      && typeof envelope.shared_aad_sha256 === "string" && /^[a-f0-9]{64}$/.test(envelope.shared_aad_sha256)
      && typeof envelope.shared_ciphertext_sha256 === "string" && /^[a-f0-9]{64}$/.test(envelope.shared_ciphertext_sha256)));
}

function isSafeThreadMessage(message, conversation, requestedDeviceId) {
  if (!message || typeof message !== "object"
    || !Number.isSafeInteger(Number(message.id)) || Number(message.id) <= 0
    || Number(message.conversation_id) !== Number(conversation.id)
    || !conversation.participants.some((participant) => Number(participant.id) === Number(message.sender_id))
    || typeof message.sender_handle !== "string" || !/^[a-z0-9_]{2,30}$/.test(message.sender_handle)
    || message.sender_persona !== conversation.context_persona
    || !["text", "image", "video", "file", "encrypted", "encrypted_attachment"].includes(message.kind)
    || typeof message.body !== "string" || message.body.length > 4_000
    || !["plaintext_local", "e2ee_v1", "e2ee_group_v1"].includes(message.encryption_mode)
    || !["sent", "delivered", "read", "expired"].includes(message.status)
    || !isSafeChatTimestamp(message.created_at)
    || !isSafeChatTimestamp(message.expires_at, true)
    || !isSafeChatTimestamp(message.expired_at, true)
    || !Array.isArray(message.receipts) || message.receipts.length > 49
    || (message.attachment_url != null && !safeInternalMediaUrl(message.attachment_url))) return false;
  const hasAttachment = message.attachment_url != null;
  if (message.status === "expired") {
    if (hasAttachment || message.body !== "" || message.envelope != null) return false;
  } else if (hasAttachment !== ["image", "video", "file", "encrypted_attachment"].includes(message.kind)
    || (hasAttachment && !["image", "video", "audio", "file", "encrypted"].includes(message.media_kind))) return false;
  if (message.encryption_mode === "plaintext_local" && message.envelope != null) return false;
  const legacyV1 = message.encryption_mode === "e2ee_v1" && message.key_epoch == null && message.key_epoch_commitment == null;
  if (message.encryption_mode.startsWith("e2ee_") && (message.body !== "" || !["encrypted", "encrypted_attachment"].includes(message.kind)
    || !/^[A-Za-z0-9:_-]{8,80}$/.test(String(message.client_nonce ?? "")) || !/^[A-Za-z0-9:_-]{16,80}$/.test(String(message.sender_device_id ?? ""))
    || !/^[a-f0-9]{64}$/.test(String(message.device_set_commitment ?? ""))
    || (!legacyV1 && (!Number.isSafeInteger(Number(message.key_epoch)) || Number(message.key_epoch) < 1 || !/^[a-f0-9]{64}$/.test(String(message.key_epoch_commitment ?? "")))))) return false;
  if (message.encryption_mode === "plaintext_local" && ["encrypted", "encrypted_attachment"].includes(message.kind)) return false;
  if (message.kind === "encrypted_attachment") {
    const mediaMatch = String(message.attachment_url ?? "").match(/^\/media\/([a-f0-9]{64})\.([a-z0-9]{1,12})$/);
    if (!mediaMatch || mediaMatch[1] !== message.media_hash || message.media_kind !== "encrypted"
      || !Number.isSafeInteger(Number(message.attachment_media_id)) || Number(message.attachment_media_id) < 1) return false;
  }
  const recipientIds = message.receipts.map((receipt) => Number(receipt?.user_id));
  if (new Set(recipientIds).size !== recipientIds.length) return false;
  if (!message.receipts.every((receipt) => receipt && typeof receipt === "object"
    && conversation.participants.some((participant) => Number(participant.id) === Number(receipt.user_id))
    && Number(receipt.user_id) !== Number(message.sender_id)
    && isSafeChatTimestamp(receipt.delivered_at, true) && isSafeChatTimestamp(receipt.read_at, true)
    && (receipt.read_at == null || receipt.delivered_at == null || Number(receipt.read_at) >= Number(receipt.delivered_at)))) return false;
  return isSafeThreadEnvelope(message.envelope, message, requestedDeviceId);
}

function isSafeThreadMeeting(meeting, conversationId, participantIds) {
  return Boolean(meeting && typeof meeting === "object"
    && Number.isSafeInteger(Number(meeting.id)) && Number(meeting.id) > 0
    && Number(meeting.conversation_id) === conversationId
    && participantIds.includes(Number(meeting.created_by))
    && typeof meeting.creator_handle === "string" && /^[a-z0-9_]{2,30}$/.test(meeting.creator_handle)
    && typeof meeting.title === "string" && meeting.title.length >= 1 && meeting.title.length <= 120
    && isSafeChatTimestamp(meeting.starts_at) && isSafeChatTimestamp(meeting.created_at)
    && Number.isSafeInteger(Number(meeting.duration_minutes)) && Number(meeting.duration_minutes) >= 15 && Number(meeting.duration_minutes) <= 480
    && ["scheduled", "cancelled", "completed"].includes(meeting.status));
}

function isSafeThreadCall(call, conversationId, participantIds) {
  return Boolean(call && typeof call === "object"
    && typeof call.call_id === "string" && /^call:[A-Za-z0-9_-]{16,64}$/.test(call.call_id)
    && Number(call.conversation_id) === conversationId
    && participantIds.includes(Number(call.initiated_by))
    && typeof call.initiator_handle === "string" && /^[a-z0-9_]{2,30}$/.test(call.initiator_handle)
    && ["audio", "video"].includes(call.mode)
    && ["ringing", "active", "declined", "ended", "missed", "failed"].includes(call.status)
    && isSafeChatTimestamp(call.expires_at) && isSafeChatTimestamp(call.created_at)
    && isSafeChatTimestamp(call.answered_at, true) && isSafeChatTimestamp(call.ended_at, true));
}

function isSafeMessageMutationResult(result, expected) {
  const message = result?.message;
  const intent = result?.intent;
  const attachmentMediaId = expected.attachmentMediaId == null ? null : Number(expected.attachmentMediaId);
  return Boolean(result?.ok && typeof result.replay === "boolean"
    && intent && typeof intent === "object"
    && Number(intent.conversation_id) === expected.conversationId
    && Number(intent.sender_id) === expected.userId
    && intent.sender_persona === expected.persona
    && intent.client_nonce === expected.clientNonce
    && expected.encryptionModes.includes(intent.encryption_mode)
    && (intent.attachment_media_id == null ? null : Number(intent.attachment_media_id)) === attachmentMediaId
    && message && typeof message === "object"
    && Number.isSafeInteger(Number(message.id)) && Number(message.id) > 0
    && Number(message.conversation_id) === expected.conversationId
    && Number(message.sender_id) === expected.userId
    && message.sender_persona === expected.persona
    && message.sender_handle === expected.handle
    && message.client_nonce === expected.clientNonce
    && message.encryption_mode === intent.encryption_mode
    && (message.attachment_media_id == null ? null : Number(message.attachment_media_id)) === attachmentMediaId
    && message.status === "sent" && typeof message.body === "string" && message.body.length <= 4_000
    && isSafeChatTimestamp(message.created_at)
    && Array.isArray(message.receipts) && message.receipts.length <= 49
    && (message.attachment_url == null || Boolean(safeInternalMediaUrl(message.attachment_url))));
}

async function renderMessages(vp) {
  activityLoadGate.invalidate();
  if (!activeConversationId) threadLoadGate.invalidate();
  const context = state.user.id + ':' + state.persona;
  if (inboxContext !== context) { inboxContext = context; inboxFilter = state.persona; }
  const selectedBox = inboxBox;
  const selectedFilter = inboxFilter;
  const loadRequest = messagesLoadGate.begin();
  vp.innerHTML = inboxShell(t, esc, selectedBox, nexusWordmarkMarkup(), selectedFilter);
  document.getElementById('inbox-home').onclick = goHome;
  bindInboxPresentation(vp.querySelector('.inboxScreen'), { t, box: selectedBox, onInbox: () => { inboxBox = "inbox"; renderMessages(vp); } });
  document.querySelectorAll("[data-inbox-box]").forEach((button) => button.addEventListener("click", () => { inboxBox = button.dataset.inboxBox; activeConversationId = null; renderMessages(vp); }));
  vp.querySelectorAll('[data-inbox-persona]').forEach((button) => { button.onclick = () => { inboxFilter = button.dataset.inboxPersona; activeConversationId = null; renderMessages(vp); }; });
  document.getElementById("new-conversation").addEventListener("click", () => renderConversationCreator());
  const list = document.getElementById("conversation-list");
  bindMessageSearch(vp.querySelector('.inboxScreen'), {
    api, t, esc, openThread,
    validateConversation: isSafeConversationSummary, renderConversation: conversationListItem,
    bindContacts: (host, rows) => bindContactAvatars(host, rows, messengerContactOptions(vp.querySelector('.inboxScreen'))),
    context: { persona: selectedFilter, viewerId: state.user.id, viewerPersona: state.persona, box: selectedBox },
    current: (() => { const id = state.user.id, persona = state.persona; return () => list.isConnected && state.user.id === id && state.persona === persona && inboxFilter === selectedFilter; })(),
  });
  // Wave 14f: the shelf of moments is the first thing this screen prints now, so it is loaded here with the
  // same loader the feed used: the reader's own card is the camera, a card is a peek, and it is this screen's
  // own son - an answer that arrives after the reader left is dropped, not painted over another screen.
  const storyTray = vp.querySelector("#storyRail");
  if (storyTray) void loadStories(storyTray);
  if (selectedBox === "activity") {
    if (loadRequest.isCurrent()) await renderNotificationActivity(list);
    return;
  }
  const response = await api("/api/chat/conversations?persona=" + encodeURIComponent(selectedFilter) + "&box=" + encodeURIComponent(selectedBox) + "&limit=30").catch(() => null);
  if (!loadRequest.isCurrent() || !list?.isConnected || inboxBox !== selectedBox || inboxFilter !== selectedFilter) return;
  const conversations = response?.conversations;
  const validResponse = Boolean(response?.ok && response.privacy_enforced_server_side === true
    && Number(response.viewer_id) === Number(state.user.id) && response.viewer_persona === state.persona
    && response.query?.persona === selectedFilter && response.query?.box === selectedBox && response.query?.limit === 30 && response.query?.cursor === null
    && (response.next_cursor == null || (typeof response.next_cursor === "string" && response.next_cursor.length <= 2048 && response.next_cursor.includes(".")))
    && Array.isArray(conversations) && conversations.length <= 30
    && new Set(conversations.map((conversation) => Number(conversation?.id))).size === conversations.length
    && conversations.every((conversation) => isSafeConversationSummary(conversation, state.user.id)));
  if (!validResponse) {
    list.innerHTML = '<div class="emptyInbox inboxError"><i>!</i><b>' + esc(t("messages.loadError")) + '</b><span>' + esc(t("messages.loadErrorDetail")) + '</span><button type="button" data-inbox-retry>' + esc(t("live.retry")) + '</button></div>';
    list.querySelector("[data-inbox-retry]").addEventListener("click", () => renderMessages(vp));
    return;
  }
  if (!conversations.length) {
    list.innerHTML = '<div class="emptyInbox"><i>◌</i><b>' + esc(selectedBox === "requests" ? t("messages.noRequests") : selectedBox === "sent" ? t("messages.noSent") : t("messages.noConversations")) + '</b><span>' + esc(selectedBox === "inbox" ? t("messages.startByUsername") : t("messages.requestsRespectPrivacy")) + '</span></div>';
    return;
  }
  list.innerHTML = '<div class="chatList">' + conversations.map(conversationListItem).join("") + '</div>' + (response.next_cursor ? '<button type="button" class="inboxLoadMore" data-inbox-cursor="' + esc(response.next_cursor) + '">' + esc(t("messages.loadMore")) + '</button>' : '');
  list.querySelectorAll("[data-conversation]").forEach((button) => { button.dataset.wired = "true"; button.addEventListener("click", () => openThread(Number(button.dataset.conversation))); });
  const contactOptions = messengerContactOptions(vp.querySelector('.inboxScreen'));
  bindContactAvatars(list, conversations, contactOptions);
  list.querySelector("[data-inbox-cursor]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const cursor = button.dataset.inboxCursor;
    button.disabled = true;
    const page = await api("/api/chat/conversations?persona=" + encodeURIComponent(selectedFilter) + "&box=" + encodeURIComponent(selectedBox) + "&limit=30&cursor=" + encodeURIComponent(cursor)).catch(() => null);
    if (!list.isConnected || inboxBox !== selectedBox || inboxFilter !== selectedFilter) return;
    const priorIds = new Set([...list.querySelectorAll("[data-conversation]")].map((item) => Number(item.dataset.conversation)));
    const validPage = page?.ok && Number(page.viewer_id) === Number(state.user.id) && page.viewer_persona === state.persona
      && page.query?.cursor === cursor && page.query?.persona === selectedFilter && page.query?.box === selectedBox
      && Array.isArray(page.conversations) && page.conversations.length <= 30
      && page.conversations.every((conversation) => isSafeConversationSummary(conversation, state.user.id) && !priorIds.has(Number(conversation.id)));
    if (!validPage) { button.disabled = false; return toast(t("messages.loadError")); }
    const chatList = list.querySelector(".chatList");
    chatList.insertAdjacentHTML("beforeend", page.conversations.map(conversationListItem).join(""));
    chatList.querySelectorAll("[data-conversation]").forEach((item) => { if (!item.dataset.wired) { item.dataset.wired = "true"; item.addEventListener("click", () => openThread(Number(item.dataset.conversation))); } });
    bindContactAvatars(list, page.conversations, contactOptions);
    if (page.next_cursor) { button.dataset.inboxCursor = page.next_cursor; button.disabled = false; }
    else button.remove();
  });
  if (activeConversationId && conversations.some((item) => Number(item.id) === activeConversationId)) await openThread(activeConversationId);
}

// The label table and the preference forms live in notification-preferences.js: the inbox and the
// profile menu render the same list from the same source, so the two can never disagree.
function notificationLabel(type) {
  return notificationLabelFromModule(type, t);
}

async function renderNotificationActivity(host) {
  const supportedPersonas = new Set(["all", ...PROFILES.map((profile) => profile[0])]);
  const persona = supportedPersonas.has(inboxFilter) ? inboxFilter : "all";
  const settingsPersona = persona === "all" ? state.persona : persona;
  const loadRequest = activityLoadGate.begin();
  host.innerHTML = '<div class="notificationLoading">' + esc(t("activity.loading")) + '</div>';
  const [result, preferenceResult] = await Promise.all([
    api("/api/notifications?persona=" + encodeURIComponent(persona)),
    api("/api/notification-preferences?persona=" + encodeURIComponent(settingsPersona)),
  ]);
  if (!loadRequest.isCurrent() || !host?.isConnected || inboxBox !== "activity" || inboxFilter !== persona) return;
  if (!result?.ok || !preferenceResult?.ok) {
    host.innerHTML = '<div class="emptyInbox inboxError"><i>!</i><b>' + esc(t("activity.loadError")) + '</b><span>' + esc(t("activity.loadErrorDetail")) + '</span><button type="button" data-notification-retry>' + esc(t("live.retry")) + '</button></div>';
    host.querySelector("[data-notification-retry]")?.addEventListener("click", () => renderNotificationActivity(host));
    return;
  }
  const rows = (Array.isArray(result.notifications) ? result.notifications : []).filter((item) => item && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0 && NOTIFICATION_TYPES.has(item.type));
  const preferences = (Array.isArray(preferenceResult.preferences) ? preferenceResult.preferences : []).filter((pref) => pref && NOTIFICATION_TYPES.has(pref.type));
  const unread = Math.max(0, Number.isSafeInteger(Number(result.unread)) ? Number(result.unread) : 0);
  host.innerHTML = [
    '<section class="notificationCenter"><header><span><small>' + esc(t("activity.eyebrow")) + ' · ' + esc(persona.toUpperCase()) + '</small><b>' + unread.toLocaleString(interfaceLocale) + ' ' + esc(t("activity.unread")) + '</b></span><button type="button" data-notification-read-all data-notification-key="' + esc(newUploadMutationKey("notification-read-all")) + '"' + (unread ? '' : ' disabled') + '>' + esc(t("activity.markAllRead")) + '</button></header>',
    '<div class="notificationList">' + (rows.length ? rows.map((item) => { const actorCount = Math.max(1, Number.isSafeInteger(Number(item.actor_count)) ? Number(item.actor_count) : 1); const read = Number(item.read) === 1; const itemPersona = PROFILES.some((profile) => profile[0] === item.persona) ? item.persona : "social"; return '<button type="button" class="notificationRow ' + (read ? '' : 'unread') + '" data-notification-id="' + Number(item.id) + '" data-notification-key="' + esc(newUploadMutationKey("notification-read")) + '"' + (read ? ' disabled' : '') + '><i>' + (read ? '○' : '●') + '</i><span><b>' + esc(notificationLabel(item.type)) + (actorCount > 1 ? ' · ' + actorCount.toLocaleString(interfaceLocale) : '') + '</b><small>' + esc(item.body) + '</small><em>' + esc(itemPersona) + '</em></span></button>'; }).join("") : '<div class="emptyInbox"><i>◌</i><b>' + esc(t("activity.empty")) + '</b><span>' + esc(t("activity.emptyDetail")) + '</span></div>') + '</div>',
    '<details class="notificationSettings"><summary>' + esc(t("activity.preferencesFor")) + ' ' + esc(settingsPersona) + '</summary><p>' + esc(t("activity.channelTruth")) + '</p><div>' + notificationPreferenceForms(preferences, { esc, t, persona: settingsPersona, newKey: newUploadMutationKey }) + '</div></details></section>',
  ].join("");
  host.querySelector("[data-notification-read-all]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    const read = await api("/api/notifications", { method: "PATCH", headers: { "Idempotency-Key": button.dataset.notificationKey }, body: { read_all: true, persona } }).catch(() => null);
    if (!button.isConnected || !loadRequest.isCurrent()) return;
    const valid = read?.ok === true && Number(read.owner_id) === Number(state.user.id) && read.persona === persona
      && Number.isSafeInteger(Number(read.changed)) && Number(read.changed) >= 0
      && Number.isSafeInteger(Number(read.unread)) && Number(read.unread) >= 0
      && (Number(read.changed) > 0
        ? /^[A-Za-z0-9_-]{16}$/.test(String(read.change_id || ""))
        : read.change_id == null);
    if (!valid) { button.disabled = false; return toast(t("activity.readFailed")); }
    await refreshNotificationBadge();
    await renderNotificationActivity(host);
  });
  host.querySelectorAll("[data-notification-id]").forEach((button) => button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    const notificationId = Number(button.dataset.notificationId);
    const read = await api("/api/notifications/" + notificationId, { method: "PATCH", headers: { "Idempotency-Key": button.dataset.notificationKey }, body: { read: true } }).catch(() => null);
    if (!button.isConnected || !loadRequest.isCurrent()) return;
    const valid = read?.ok === true && Number(read.notification_id) === notificationId
      && Number(read.owner_id) === Number(state.user.id) && read.read === true
      && typeof read.changed === "boolean"
      && Number.isSafeInteger(Number(read.unread)) && Number(read.unread) >= 0
      && (read.changed
        ? /^[A-Za-z0-9_-]{16}$/.test(String(read.change_id || ""))
        : read.change_id == null);
    if (!valid) { button.disabled = false; return toast(t("activity.readOneFailed")); }
    await refreshNotificationBadge();
    await renderNotificationActivity(host);
  }));
  // The forms are the module's: one binding validates and saves the same way on both surfaces.
  bindNotificationPreferenceForms(host, {
    persona: settingsPersona,
    ownerId: Number(state.user.id),
    isCurrent: () => loadRequest.isCurrent(),
    save: (body, key) => api("/api/notification-preferences", { method: "PATCH", headers: { "Idempotency-Key": key }, body }).catch(() => null),
    newKey: newUploadMutationKey,
    t,
  });
}

function conversationListItem(conversation) {
  return renderConversationRow(conversation, { state, activeConversationId, t, esc, safeInternalMediaUrl, usernameSigil, orbitStatusChip, interfaceLocale });
}

function renderConversationCreator() {
  const host = document.getElementById("conversation-create");
  if (!host) return;
  host.innerHTML = '<div class="sheet-backdrop" id="close-conversation"><section class="account-modal" role="dialog" aria-modal="true" aria-labelledby="new-chat-title" tabindex="-1"><button class="sheet-close" id="conversation-x" type="button" aria-label="' + esc(t("conversation.close")) + '">×</button><small>' + esc(t("conversation.eyebrow")) + ' · ' + esc(state.persona.toUpperCase()) + '</small><h3 id="new-chat-title">' + esc(t("conversation.title")) + '</h3><form id="conversation-form" data-conversation-key="' + esc(newUploadMutationKey("conversation-create")) + '"><div class="chatKind"><label><input type="radio" name="kind" value="direct" checked /> ' + esc(t("conversation.direct")) + '</label><label><input type="radio" name="kind" value="group" /> ' + esc(t("conversation.group")) + '</label></div><div class="field"><label>' + esc(t("conversation.usernames")) + '</label><input name="usernames" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="255" placeholder="@username" required /></div><div class="field group-title" hidden><label>' + esc(t("conversation.groupName")) + '</label><input name="title" minlength="1" maxlength="80" /></div><p class="mvx-hint">' + esc(t("conversation.groupHint")) + '</p><button class="btn" type="submit">' + esc(t("conversation.continue")) + '</button><div id="conversation-create-result" aria-live="polite"></div></form></section></div>';
  const close = () => { host.innerHTML = ""; };
  const dialog = host.querySelector(".account-modal");
  document.getElementById("conversation-x").addEventListener("click", close);
  document.getElementById("close-conversation").addEventListener("click", (event) => { if (event.target.id === "close-conversation") close(); });
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  dialog.focus();
  host.querySelectorAll('input[name="kind"]').forEach((input) => input.addEventListener("change", () => {
    if (!input.checked) return;
    const group = input.value === "group";
    host.querySelector(".group-title").hidden = !group;
    host.querySelector('input[name="title"]').required = group;
  }));
  document.getElementById("conversation-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    const data = new FormData(form);
    const kind = data.get("kind");
    const usernames = [...new Set(String(data.get("usernames") || "").split(",").map((item) => item.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
    const selectedPersona = state.persona;
    const normalizedTitle = String(data.get("title") || "").trim();
    const output = document.getElementById("conversation-create-result");
    if (!new Set(["direct", "group"]).has(kind) || usernames.some((username) => !/^[a-z0-9_]{2,30}$/.test(username))) return output.textContent = t("conversation.invalidUsernames");
    if (kind === "direct" && usernames.length !== 1) return output.textContent = t("conversation.directOne");
    if (kind === "group" && usernames.length < 2) return output.textContent = t("conversation.groupTwo");
    if (kind === "group" && usernames.length > 49) return output.textContent = t("conversation.tooMany");
    if (usernames.includes(String(state.user.handle || "").toLowerCase())) return output.textContent = t("conversation.self");
    if (kind === "group" && !normalizedTitle) return output.textContent = t("conversation.groupNameRequired");
    submit.disabled = true;
    output.textContent = t("conversation.creating");
    try {
      const result = await api("/api/chat/conversations", { method: "POST", headers: { "Idempotency-Key": form.dataset.conversationKey }, body: { kind, username: usernames[0], usernames, title: normalizedTitle } });
      if (!form.isConnected || state.persona !== selectedPersona) return;
      const conversationId = Number(result.conversation?.id);
      const otherHandles = Array.isArray(result.conversation?.participants) ? result.conversation.participants.filter((participant) => Number(participant?.id) !== Number(state.user.id)).map((participant) => participant.handle).sort() : [];
      const intentValid = result.intent?.kind === kind && result.intent?.context_persona === selectedPersona
        && Array.isArray(result.intent?.recipient_handles) && JSON.stringify([...result.intent.recipient_handles].sort()) === JSON.stringify([...usernames].sort())
        && result.intent?.title === (kind === "group" ? normalizedTitle : null);
      if (!result.ok || !Number.isSafeInteger(conversationId) || conversationId <= 0
        || !intentValid || !isSafeConversationSummary(result.conversation, state.user.id)
        || result.conversation.kind !== kind || result.conversation.context_persona !== selectedPersona
        || JSON.stringify(otherHandles) !== JSON.stringify([...usernames].sort())) {
        output.textContent = t(result.code === "RATE_LIMITED" ? "conversation.rateLimited" : "conversation.failed");
        return;
      }
      activeConversationId = conversationId;
      inboxBox = "inbox"; inboxFilter = "all";
      close();
      const viewport = document.getElementById("screenViewport");
      if (viewport) renderMessages(viewport);
    } catch {
      if (output.isConnected) output.textContent = t("conversation.failed");
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  });
  document.getElementById("conversation-form").addEventListener("input", (event) => { event.currentTarget.dataset.conversationKey = newUploadMutationKey("conversation-create"); });
}

function messengerContactOptions(root) {
  return createContactOptions({ root, getState: () => state, t, esc, safeInternalMediaUrl, api, openThread,
    activeConversation: () => activeConversationId, openProfile: openCreatorProfile,
    showStories: (stories) => openStoryViewer(0, stories), toast,
    onHistoryBack: retireMessengerHistory,
  });
}

function retireMessengerHistory() {
  return new Promise((resolve) => {
    suppressNextUiPopstate = true;
    window.addEventListener('popstate', resolve, { once: true });
    history.back();
  });
}

function closeActiveThread() {
  threadLoadGate.invalidate();
  revokeDecryptedAttachmentUrls();
  activeConversationId = null;
  document.getElementById("thread")?.replaceChildren();
  threadNavigation.restore();
}

async function openThread(conversationId, targetMessageId = null) {
  if (!Number.isSafeInteger(Number(conversationId)) || Number(conversationId) <= 0) return;
  conversationId = Number(conversationId);
  threadNavigation.enter(targetMessageId, document.querySelector('.inboxScreen'), document.activeElement);
  activeConversationId = conversationId;
  const thread = document.getElementById("thread");
  if (!thread) return;
thread.innerHTML = '<section class="threadPanel"><header id="thread-header"><span><b>' + esc(t("thread.checking")) + '</b><small>Privacy Matrix · deny by default</small></span></header><div id="request-actions"></div><div id="e2ee-safety"></div><div class="threadActions"><button id="video-call" type="button" disabled>▣ Video</button><button id="audio-call" type="button" disabled>◉ Audio</button><button id="schedule-meeting" type="button" disabled>◷ ' + esc(t("thread.meeting")) + '</button><button id="manage-group" type="button" hidden disabled>⚙ ' + esc(t("conversation.group")) + '</button></div><div id="meeting-list"></div><div id="typing-state" aria-live="polite"></div><div class="msgs" id="msgs" aria-live="polite"><p class="screenSub">' + esc(t("thread.loading")) + '</p></div><form id="send-msg" class="messageComposer" data-message-key="' + esc(newUploadMutationKey("message-send")) + '" data-client-nonce="message:' + esc(newUploadMutationKey("message")) + '"><label class="composerSecurity"><input name="secure" type="checkbox" disabled /><span>' + esc(t("thread.encrypt")) + '</span><small id="secure-status">' + esc(t("thread.checkingDevices")) + '</small></label><small class="messageTransportNotice" role="status" hidden>' + esc(t("thread.serverReadable")) + '</small><div class="messageUploadProgress" hidden><progress max="100" value="0"></progress><span>0%</span><button type="button" data-message-upload-cancel>' + esc(t("upload.cancel")) + '</button></div><label class="attachButton" title="' + esc(t("thread.attach")) + '">＋<input name="attachment" type="file" accept="image/*,video/*,.pdf,.docx,.xlsx,.pptx" disabled /></label><input name="body" placeholder="' + esc(t("thread.checkingAccess")) + '" maxlength="4000" autocomplete="off" disabled /><select name="expires" aria-label="' + esc(t("thread.disappearing")) + '" disabled><option value="">' + esc(t("thread.keep")) + '</option><option value="60">1 min</option><option value="3600">1 h</option><option value="86400">24 h</option><option value="604800">7 ' + esc(t("thread.days")) + '</option></select><button type="submit" aria-label="' + esc(t("thread.send")) + '" disabled>➤</button><div id="message-send-result" aria-live="polite"></div></form><p class="threadTruth">' + esc(t("thread.truth")) + '</p></section>';
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "‹";
  back.setAttribute("aria-label", t("thread.back"));
  back.addEventListener("click", closeActiveThread);
  document.getElementById("thread-header").prepend(back);
  enhanceThread(thread, t, { ownerId: Number(state.user.id), persona: state.persona, conversationId });
  mountWindowReturn(thread, threadNavigation, () => loadThread(conversationId), t('messenger.latest'));
  await loadThread(conversationId);
  const sendForm = document.getElementById("send-msg");
  if (activeConversationId !== conversationId || !sendForm) return;
  sendForm.querySelector('input[name="secure"]').addEventListener("change", (event) => {
    sendForm.querySelector('input[name="attachment"]').title = event.target.checked ? t("thread.encryptedAttachmentHint") : t("thread.serverCheckedHint");
    syncMessageTransportChoice(sendForm);
  });
  sendForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    const data = new FormData(form);
    const file = data.get("attachment");
    const expires = data.get("expires");
    const secure = data.get("secure") === "on";
    const output = document.getElementById("message-send-result");
    const body = String(data.get("body") || "");
    if (!body.trim() && !file?.size) return output.textContent = t("thread.messageRequired");
    const attachmentCancellation = {};
    const uploadProgress = form.querySelector(".messageUploadProgress");
    const uploadProgressBar = uploadProgress?.querySelector("progress");
    const uploadProgressText = uploadProgress?.querySelector("span");
    const uploadCancel = uploadProgress?.querySelector("[data-message-upload-cancel]");
    const reportAttachmentProgress = (ratio) => {
      const value = Math.max(0, Math.min(100, Math.round(Number(ratio || 0) * 100)));
      if (uploadProgressBar) uploadProgressBar.value = value;
      if (uploadProgressText) uploadProgressText.textContent = value + "%";
    };
    const finishAttachmentProgress = () => { if (uploadProgress) uploadProgress.hidden = true; };
    if (file?.size && uploadProgress && uploadCancel) {
      uploadProgress.hidden = false;
      uploadCancel.disabled = false;
      uploadCancel.onclick = () => {
        uploadCancel.disabled = true;
        attachmentCancellation.requested = true;
        attachmentCancellation.request?.();
      };
    }
    const intent = {
      conversationId,
      userId: Number(state.user.id),
      persona: state.persona,
      handle: String(state.user.handle || ""),
      messageKey: form.dataset.messageKey,
      clientNonce: form.dataset.clientNonce,
    };
    if (!/^[A-Za-z0-9:_-]{8,80}$/.test(intent.clientNonce)) return output.textContent = t("thread.sendFailed");
    const mutationStillCurrent = () => form.isConnected && activeConversationId === intent.conversationId
      && Number(state.user.id) === intent.userId && state.persona === intent.persona;
    const resetConfirmedIntent = () => {
      if (form.dataset.messageKey !== intent.messageKey || form.dataset.clientNonce !== intent.clientNonce) return;
      form.reset();
      threadNavigation.latest();
      thread.querySelector('.threadWindowReturn')?.remove();
      form.dataset.messageKey = newUploadMutationKey("message-send");
      form.dataset.clientNonce = "message:" + newUploadMutationKey("message");
    };
    submit.disabled = true;
    output.textContent = t("thread.sending");
    if (secure) {
      try {
        const result = file?.size
          ? await encryptChatAttachment(api, {
            conversationId, ownerId: intent.userId, persona: intent.persona, file, caption: body,
            expiresInSeconds: expires ? Number(expires) : null,
            uploadCiphertext: (ciphertext) => uploadMediaResumable(ciphertext, "message_e2ee_attachment", reportAttachmentProgress, attachmentCancellation),
            clientNonce: intent.clientNonce,
            idempotencyKey: intent.messageKey,
          })
          : await encryptChatText(api, {
            conversationId, ownerId: intent.userId, persona: intent.persona, text: body,
            expiresInSeconds: expires ? Number(expires) : null,
            clientNonce: intent.clientNonce,
            idempotencyKey: intent.messageKey,
          });
        if (!mutationStillCurrent()) return;
        const localIntent = result?.local_intent;
        const valid = localIntent && Number(localIntent.conversation_id) === intent.conversationId
          && localIntent.client_nonce === intent.clientNonce
          && ["e2ee_v1", "e2ee_group_v1"].includes(localIntent.encryption_mode)
          && isSafeMessageMutationResult(result, { ...intent, attachmentMediaId: localIntent.attachment_media_id, encryptionModes: [localIntent.encryption_mode] });
        if (!valid) { output.textContent = t("thread.secureSendFailed"); return; }
        resetConfirmedIntent();
        output.textContent = "";
        await loadThread(conversationId);
      } catch (error) {
        if (output.isConnected) output.textContent = error instanceof UploadClientError ? uploadErrorMessage(error) : t("thread.e2eeUnavailable");
      } finally {
        finishAttachmentProgress();
        if (submit.isConnected) submit.disabled = form.dataset.canSend !== "true";
      }
      return;
    }
    let attachmentMediaId = null;
    if (file?.size) {
      if (file.size > 20 * 1024 * 1024) { output.textContent = t("thread.fileTooLarge"); submit.disabled = form.dataset.canSend !== "true"; return; }
      let upload;
      try { upload = await uploadMediaResumable(file, "message_attachment", reportAttachmentProgress, attachmentCancellation); }
      catch (error) { finishAttachmentProgress(); output.textContent = uploadErrorMessage(error); submit.disabled = form.dataset.canSend !== "true"; return; }
      finishAttachmentProgress();
      if (!mutationStillCurrent()) return;
      if (!upload?.ok || !upload.media) { output.textContent = t("thread.attachmentFailed"); submit.disabled = form.dataset.canSend !== "true"; return; }
      if (!upload.media.available) { output.textContent = t("thread.attachmentQuarantine"); submit.disabled = form.dataset.canSend !== "true"; return; }
      attachmentMediaId = upload.media.id;
    }
    try {
      const result = await api("/api/chat/conversations/" + conversationId + "/messages", { method: "POST", headers: { "Idempotency-Key": intent.messageKey }, body: { body, attachment_media_id: attachmentMediaId, client_nonce: intent.clientNonce, expires_in_seconds: expires ? Number(expires) : null } });
      if (!mutationStillCurrent()) return;
      if (isSafeMessageMutationResult(result, { ...intent, attachmentMediaId, encryptionModes: ["plaintext_local"] })) {
        resetConfirmedIntent();
        output.textContent = "";
        await loadThread(conversationId);
      } else output.textContent = t("thread.sendFailed");
    } catch {
      if (output.isConnected) output.textContent = t("thread.sendFailed");
    } finally {
      if (submit.isConnected) submit.disabled = form.dataset.canSend !== "true";
    }
  });
  sendForm.addEventListener("input", (event) => {
    if (event.target.id === "message-send-result") return;
    event.currentTarget.dataset.messageKey = newUploadMutationKey("message-send");
    event.currentTarget.dataset.clientNonce = "message:" + newUploadMutationKey("message");
  });
  document.getElementById("schedule-meeting").addEventListener("click", () => scheduleMeeting(conversationId));
  document.getElementById("video-call").addEventListener("click", () => startDirectCall({ conversationId, mode: "video" }));
  document.getElementById("audio-call").addEventListener("click", () => startDirectCall({ conversationId, mode: "audio" }));
  document.querySelector('#send-msg [name="body"]').addEventListener("input", () => signalTyping(conversationId));
}

function syncMessageTransportChoice(form) {
  const secure = form?.querySelector('input[name="secure"]');
  const notice = form?.querySelector(".messageTransportNotice");
  if (notice) notice.hidden = !secure || secure.checked || form.dataset.canSend !== "true";
}

async function loadThread(conversationId) {
  if (!Number.isSafeInteger(Number(conversationId)) || Number(conversationId) <= 0) return;
  conversationId = Number(conversationId);
  const selectedUserId = Number(state.user.id);
  const selectedPersona = state.persona;
  revokeDecryptedAttachmentUrls();
  const loadRequest = threadLoadGate.begin();
  let device = null;
  let deviceError = "";
  try {
    device = await currentChatDevice();
  } catch (error) {
    deviceError = error?.message === "E2EE requires HTTPS or localhost" ? "secure_context_required" : "device_unavailable";
  }
  if (!loadRequest.isCurrent() || activeConversationId !== conversationId || Number(state.user.id) !== selectedUserId || state.persona !== selectedPersona) return;
  const selectedTarget = threadNavigation.target;
  const deviceQuery = messageWindowQuery(device?.deviceId, selectedTarget);
  const requestedDeviceId = device?.deviceId || null;
  const r = await api("/api/chat/conversations/" + conversationId + "/messages" + deviceQuery).catch(() => null);
  const box = document.getElementById("msgs");
  if (!loadRequest.isCurrent() || activeConversationId !== conversationId || Number(state.user.id) !== selectedUserId || state.persona !== selectedPersona || !box?.isConnected) return;
  const conversation = r?.conversation;
  const participantIds = Array.isArray(conversation?.participants) ? conversation.participants.map((participant) => Number(participant?.id)) : [];
  const validResponse = Boolean(r?.ok && r.privacy_enforced_server_side === true
    && Number(r.query?.conversation_id) === conversationId && (r.query?.device_id ?? null) === requestedDeviceId && r.query?.viewer_persona === selectedPersona
    && (r.query?.around_message_id ?? null) === selectedTarget
    && (!selectedTarget || r.messages?.some((message) => message.id === selectedTarget))
    && isSafeConversationSummary(conversation, selectedUserId) && (conversation.blocked === false || conversation.blocked === 0)
    && Array.isArray(r.messages) && r.messages.length <= 500
    && new Set(r.messages.map((message) => Number(message?.id))).size === r.messages.length
    && r.messages.every((message) => isSafeThreadMessage(message, conversation, requestedDeviceId))
    && r.messages.every((message, index, messages) => index === 0 || Number(messages[index - 1].id) < Number(message.id))
    && Array.isArray(r.meetings) && r.meetings.length <= 100 && r.meetings.every((meeting) => isSafeThreadMeeting(meeting, conversationId, participantIds))
    && Array.isArray(r.calls) && r.calls.length <= 50 && r.calls.every((call) => isSafeThreadCall(call, conversationId, participantIds))
    && Array.isArray(conversation?.typing) && conversation.typing.length <= 49
    && conversation.typing.every((item) => item && typeof item === "object" && participantIds.includes(Number(item.id))
      && Number(item.id) !== selectedUserId && typeof item.handle === "string" && /^[a-z0-9_]{2,30}$/.test(item.handle)));
  if (!validResponse) {
    document.querySelectorAll("#send-msg input,#send-msg textarea,#send-msg select,#send-msg button,#video-call,#audio-call").forEach((control) => { control.disabled = true; });
    document.getElementById("send-msg").dataset.canSend = "false";
    setThreadHeader(document.getElementById("thread-header"), '<button type="button" id="thread-back" aria-label="' + esc(t("thread.back")) + '">‹</button><span><b>' + esc(t("thread.unavailable")) + '</b><small>' + esc(t("thread.accessDenied")) + '</small></span>');
    document.getElementById("thread-back").addEventListener("click", closeActiveThread);
    box.innerHTML = '<div class="threadLoadError"><b>' + esc(t("thread.loadError")) + '</b><span>' + esc(t("thread.loadErrorDetail")) + '</span><button type="button" data-thread-retry>' + esc(t("live.retry")) + '</button></div>';
    box.querySelector("[data-thread-retry]").addEventListener("click", () => loadThread(conversationId));
    return;
  }
  const participants = conversation.participants;
  const messages = r.messages;
  const others = participants.filter((participant) => Number(participant.id) !== Number(state.user.id));
  const me = participants.find((participant) => Number(participant.id) === Number(state.user.id));
  const title = r.conversation.kind === "group" ? (r.conversation.title || t("messages.group")) : (others[0]?.display_name || others[0]?.handle || t("messages.conversation"));
  const online = false; // No presence disclosure until explicit, persona-scoped consent is implemented.
  setThreadHeader(document.getElementById("thread-header"), '<button type="button" id="thread-back" aria-label="' + esc(t("thread.back")) + '">‹</button><span><b>' + esc(title) + '</b><small>' + personaBadge(r.conversation.context_persona) + ' · ' + (online ? esc(t("thread.onlineNow")) : participants.length.toLocaleString(interfaceLocale) + ' ' + esc(participants.length === 1 ? t("thread.participant") : t("thread.participants"))) + '</small></span><em>' + esc(t("thread.localDemo")) + '</em>', safeInternalMediaUrl(others[0]?.avatar));
  document.getElementById("thread-back").addEventListener("click", closeActiveThread);
  const pendingDirect = r.conversation.status === "request" && r.conversation.request_recipient_id === state.user.id;
  const threadAvatar = document.querySelector('#thread-header .threadAvatar');
  if (threadAvatar) {
    threadAvatar.disabled = conversation.kind !== 'direct';
    const root = document.querySelector('.inboxScreen');
    threadAvatar.onclick = () => openContactCard(root, conversation, threadAvatar, messengerContactOptions(root));
  }
  const pendingGroup = r.conversation.kind === "group" && me?.state === "pending";
  const requestHost = document.getElementById("request-actions");
  if (pendingDirect || pendingGroup) {
    requestHost.innerHTML = '<div class="messageRequest"><span><b>' + esc(pendingGroup ? t("thread.groupInvite") : t("thread.messageRequest")) + '</b><small>' + esc(t("thread.requestSafety")) + '</small></span><button type="button" data-decision="decline" data-decision-key="' + esc(newUploadMutationKey("conversation-decision")) + '">' + esc(t("thread.decline")) + '</button><button type="button" data-decision="accept" data-decision-key="' + esc(newUploadMutationKey("conversation-decision")) + '">' + esc(t("thread.accept")) + '</button></div>';
    requestHost.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled) return;
      const decision = button.dataset.decision;
      const decisionKey = button.dataset.decisionKey;
      const actorId = Number(state.user.id);
      const actorPersona = state.persona;
      const controls = [...requestHost.querySelectorAll("[data-decision]")];
      controls.forEach((control) => { control.disabled = true; });
      const result = await api("/api/chat/conversations/" + conversationId + "/decision", { method: "POST", headers: { "Idempotency-Key": decisionKey }, body: { decision } }).catch(() => null);
      if (!requestHost.isConnected || activeConversationId !== conversationId || Number(state.user.id) !== actorId || state.persona !== actorPersona) return;
      const validResult = result?.ok && Number(result.conversation_id) === conversationId
        && Number(result.actor_id) === actorId && result.actor_persona === actorPersona
        && result.decision === decision && result.membership_state === (decision === "accept" ? "active" : "declined")
        && ["active", "declined"].includes(result.conversation_status);
      if (!validResult) { controls.forEach((control) => { control.disabled = false; }); return toast(t("thread.requestUnavailable")); }
      toast(decision === "accept" ? t("thread.requestAccepted") : t("thread.requestDeclined"));
      if (decision === "decline") { activeConversationId = null; return renderMessages(document.getElementById("screenViewport")); }
      loadThread(conversationId);
    }));
  } else if (r.conversation.status === "request") {
    requestHost.innerHTML = '<div class="messageRequest waiting"><span><b>' + esc(t("thread.requestSent")) + '</b><small>' + esc(t("thread.oneMessageUntilAccepted")) + '</small></span></div>';
  } else requestHost.innerHTML = "";
  const manageButton = document.getElementById("manage-group");
  const canManage = r.conversation.kind === "group" && new Set(["owner", "admin"]).has(me?.role);
  manageButton.hidden = !canManage;
  manageButton.disabled = !canManage;
  if (canManage) manageButton.onclick = () => manageGroup(conversationId, r.conversation);
  const meetings = (Array.isArray(r.meetings) ? r.meetings : []).filter((meeting) => meeting && typeof meeting === "object").map((meeting) => '<span><b>◷ ' + esc(meeting.title) + '</b><small>' + new Date(meeting.starts_at * 1000).toLocaleString(interfaceLocale) + ' · ' + Number(meeting.duration_minutes || 0).toLocaleString(interfaceLocale) + ' min</small></span>');
  const calls = (Array.isArray(r.calls) ? r.calls : []).filter((call) => call && typeof call === "object").slice(0, 3).map((call) => '<span><b>' + (call.mode === "video" ? '▣' : '◉') + ' ' + esc(t("thread.call")) + ' ' + esc(call.mode) + '</b><small>' + esc(call.status) + ' · @' + esc(call.initiator_handle) + '</small></span>');
  document.getElementById("meeting-list").innerHTML = meetings.length || calls.length ? '<div class="meetingList">' + meetings.concat(calls).join("") + '</div>' : '';
  const typing = Array.isArray(r.conversation.typing) ? r.conversation.typing.filter((item) => item && item.handle) : [];
  document.getElementById("typing-state").textContent = typing.length ? typing.map((item) => '@' + item.handle).join(', ') + ' ' + t("thread.typing") : '';
  let keyMaterial = null;
  let safety = null;
  let safetyError = "";
  if (device) {
    const material = await api("/api/chat/conversations/" + conversationId + "/key-material").catch(() => null);
    if (!loadRequest.isCurrent() || activeConversationId !== conversationId || Number(state.user.id) !== selectedUserId || state.persona !== selectedPersona) return;
    if (material?.ok) {
      try {
        keyMaterial = await validateConversationKeyMaterial(material, {
          conversationId, viewerId: selectedUserId, persona: selectedPersona, currentDeviceId: device.deviceId,
        });
        if (keyMaterial.ready) safety = await observeConversationSafety(keyMaterial);
      } catch { keyMaterial = null; safetyError = "invalid_material"; }
    }
  }
  const safetyHost = document.getElementById("e2ee-safety");
  if (safetyError) {
    safetyHost.innerHTML = '<div class="securityState"><b>' + esc(t("thread.keyCheckFailed")) + '</b><span>' + esc(t("thread.e2eeRemainsOff")) + '</span></div>';
  } else if (safety) {
    const changed = safety.state === "changed";
    const verified = safety.state === "verified";
    safetyHost.innerHTML = '<details class="securityState" ' + (changed ? 'open' : '') + '><summary><b>' + esc(changed ? t("thread.keysChanged") : verified ? t("thread.identityVerified") : t("thread.verifyIdentity")) + '</b></summary><span>' + esc(changed ? t("thread.keysChangedDetail") : t("thread.compareSafety")) + '</span><code>' + esc(safety.display) + '</code><span>' + Number(safety.device_count || 0).toLocaleString(interfaceLocale) + ' ' + esc(t("thread.activeDevices")) + '</span><button type="button" id="verify-e2ee-safety">' + esc(verified ? t("thread.verifyAgain") : t("thread.comparedCode")) + '</button></details>';
    document.getElementById("verify-e2ee-safety").addEventListener("click", async (event) => {
      if (!window.confirm(t("thread.confirmSafety"))) return;
      if (event.currentTarget.disabled) return;
      event.currentTarget.disabled = true;
      try {
        await verifyConversationSafety(keyMaterial);
        toast(t("thread.identitySaved"));
        loadThread(conversationId);
      } catch { toast(t("thread.verifyFailed")); if (event.currentTarget.isConnected) event.currentTarget.disabled = false; }
    });
  } else safetyHost.innerHTML = "";
  const renderedMessages = await Promise.all(messages.map(async (message, index) => {
    const attachmentUrl = safeInternalMediaUrl(message.attachment_url);
    const attachment = attachmentUrl && !message.encryption_mode?.startsWith("e2ee_") ? (message.media_kind === "image" ? '<img src="' + esc(attachmentUrl) + '" alt="' + esc(t("thread.attachment")) + '" />' : ["video", "audio"].includes(message.media_kind) ? '<' + message.media_kind + ' src="' + esc(attachmentUrl) + '" controls preload="metadata"></' + message.media_kind + '>' : '<a href="' + esc(attachmentUrl) + '" download>' + esc(t("thread.downloadAttachment")) + '</a>') : '';
    const receipts = Array.isArray(message.receipts) ? message.receipts : [];
    const receipt = message.sender_id === state.user.id ? (receipts.some((item) => item.read_at) ? '<b class="receipt read">✓✓</b>' : receipts.some((item) => item.delivered_at) ? '<b class="receipt">✓✓</b>' : '<b class="receipt">✓</b>') : '';
    let body = message.body;
    let encryptionBadge = "";
    if (message.status !== "expired" && message.encryption_mode?.startsWith("e2ee_")) {
      encryptionBadge = '<span class="encryptedBadge">🔒 E2EE</span>';
      if (message.kind === "encrypted_attachment") {
        body = "";
      } else try {
        body = device ? await decryptChatMessage(message, device) : t("thread.encryptedUnavailable");
      } catch {
        body = t("thread.encryptedUnavailable");
      }
    }
    const encryptedAttachment = message.status !== "expired" && message.kind === "encrypted_attachment" ? '<div class="e2eeAttachment" data-e2ee-attachment="' + message.id + '"><button type="button" data-e2ee-open>' + esc(t("thread.decryptAttachment")) + '</button><small>' + esc(t("thread.encryptedAttachmentWarning")) + '</small></div>' : '';
    const content = message.status === "expired" ? '<p class="expiredMessage">◷ ' + esc(t("thread.messageExpired")) + '</p>' : encryptionBadge + attachment + encryptedAttachment + (body ? '<p>' + esc(body) + '</p>' : '');
    const day = messageDayLabel(message.created_at, messages[index - 1]?.created_at, interfaceLocale);
    return (day ? '<div class="messageDay">' + esc(day) + '</div>' : '') + '<div data-message-id="' + message.id + '" class="msg ' + (message.sender_id === state.user.id ? "me" : "other") + '">' + (conversation.kind !== 'group' || message.sender_id === state.user.id ? '' : '<small>@' + esc(message.sender_handle) + '</small>') + content + '<time>' + (message.expires_at && message.status !== "expired" ? esc(t("thread.disappears")) + ' · ' : '') + new Date(message.created_at * 1000).toLocaleTimeString(interfaceLocale, { hour: "2-digit", minute: "2-digit" }) + receipt + '</time></div>';
  }));
  if (!loadRequest.isCurrent() || activeConversationId !== conversationId || !box.isConnected) return;
  const previousPosition = messageScrollPosition(box);
  box.innerHTML = renderedMessages.length ? renderedMessages.join("") : '<p class="screenSub">' + esc(t("thread.noMessages")) + '</p>';
  box.onclick = async (event) => {
    const button = event.target.closest?.("[data-e2ee-open]");
    if (!button || !box.contains(button)) return;
    const host = button.closest("[data-e2ee-attachment]");
    const message = messages.find((item) => item.id === Number(host.dataset.e2eeAttachment));
    if (!device || !message) return toast(t("thread.deviceCannotDecrypt"));
    const generation = decryptedAttachmentGeneration;
    const controller = new AbortController();
    decryptedAttachmentControllers.add(controller);
    button.disabled = true;
    button.textContent = t("thread.decryptingLocal");
    try {
      const clear = await decryptChatAttachment(message, device, fetch, { signal: controller.signal });
      const stillAuthorizedView = generation === decryptedAttachmentGeneration && !controller.signal.aborted
        && host.isConnected && activeConversationId === conversationId
        && Number(state?.user?.id) === selectedUserId && state?.persona === selectedPersona;
      if (!stillAuthorizedView) return;
      const url = URL.createObjectURL(clear.blob);
      decryptedAttachmentUrls.add(url);
      host.dataset.decrypted = "true";
      host.innerHTML = '<a href="' + esc(url) + '" download="' + esc(clear.name) + '">' + esc(t("thread.download")) + ' ' + esc(clear.name) + '</a><small>' + esc(clear.mime || t("thread.file")) + ' · ' + esc(t("thread.decryptedLocally")) + (clear.text ? ' · ' + esc(clear.text) : '') + '</small>';
    } catch (error) {
      if (error?.name !== "AbortError" && button.isConnected && generation === decryptedAttachmentGeneration) {
        button.disabled = false;
        button.textContent = t("thread.retryDecrypt");
        toast(t("thread.decryptFailed"));
      }
    } finally {
      decryptedAttachmentControllers.delete(controller);
    }
  };
  const canSend = r.conversation.context_persona === selectedPersona && me?.state === "active" && (r.conversation.status === "active" || (r.conversation.status === "request" && r.conversation.created_by === state.user.id && messages.length === 0));
  document.querySelectorAll("#send-msg input,#send-msg textarea,#send-msg select,#send-msg button").forEach((control) => { control.disabled = !canSend; });
  const messageForm = document.getElementById("send-msg");
  if (messageForm) messageForm.dataset.canSend = String(canSend);
  const secureInput = document.querySelector("#send-msg input[name='secure']");
  const secureStatus = document.getElementById("secure-status");
  const e2eeReady = canSend && Boolean(keyMaterial?.ready) && !safetyError && safety?.state !== "changed";
  secureInput.disabled = !e2eeReady;
  secureInput.checked = e2eeReady;
  syncMessageTransportChoice(messageForm);
  if (deviceError) secureStatus.textContent = t(deviceError === "secure_context_required" ? "thread.httpsRequired" : "thread.deviceUnavailable");
  else if (!keyMaterial) secureStatus.textContent = t("thread.availableAfterAccept");
  else if (!keyMaterial.ready) secureStatus.textContent = t("thread.waitingSecureDevice") + ": " + (Array.isArray(keyMaterial.users_without_devices) ? keyMaterial.users_without_devices : []).map((handle) => "@" + handle).join(", ");
  else if (safetyError) secureStatus.textContent = t("thread.invalidVerification");
  else if (safety?.state === "changed") secureStatus.textContent = t("thread.compareAgain");
  else secureStatus.textContent = safety?.state === "verified" ? t("thread.readyVerified") : t("thread.readyVerifyRecommended");
  const canInteract = r.conversation.context_persona === selectedPersona && me?.state === "active" && r.conversation.status === "active";
  const callReady = callCapability();
  const directCallReady = canInteract && r.conversation.kind === "direct" && callReady.ready;
  for (const id of ["video-call", "audio-call"]) {
    const button = document.getElementById(id);
    button.disabled = !directCallReady;
    button.title = directCallReady ? t("thread.localP2P") : (r.conversation.kind !== "direct" ? t("thread.groupCallBlocked") : window.isSecureContext === false ? t("messenger.httpsCalls") : t("thread.callUnavailable"));
  }
  const callStatus = document.getElementById("thread-call-status");
  callStatus.hidden = directCallReady;
  callStatus.textContent = document.getElementById("audio-call").title;
  if (r.conversation.context_persona !== selectedPersona) callStatus.textContent = t("messenger.identityRequired") + " " + r.conversation.context_persona;
  document.getElementById("schedule-meeting").disabled = !canInteract;
  document.querySelector("#send-msg [name='body']").placeholder = canSend ? t("thread.writeMessage") : (r.conversation.status === "request" ? t("thread.waitForAccept") : t("thread.acceptToReply"));
  threadNavigation.position(box, previousPosition);
  if (selectedTarget) return; // Reading a search window must not acknowledge an entire unseen history.
  const latestMessageId = messages.reduce((max, message) => Math.max(max, Number(message.id) || 0), 0);
  const readResult = await api("/api/chat/conversations/" + conversationId + "/read", {
    method: "POST",
    headers: { "Idempotency-Key": "thread-read:" + selectedUserId + ":" + selectedPersona + ":" + conversationId + ":" + latestMessageId },
    body: { through_message_id: latestMessageId },
  }).catch(() => null);
  if (!loadRequest.isCurrent() || activeConversationId !== conversationId || Number(state.user.id) !== selectedUserId || state.persona !== selectedPersona) return;
  if (readResult?.ok && Number(readResult.conversation_id) === conversationId
    && Number(readResult.viewer_id) === selectedUserId && readResult.viewer_persona === selectedPersona
    && Number(readResult.through_message_id) === latestMessageId) refreshMessageBadge();
}

function isBoundAuxiliaryMutation(result, expected) {
  if (!result?.ok || !result.intent || typeof result.intent !== "object" || Array.isArray(result.intent)) return false;
  return Object.entries(expected).every(([key, value]) => result.intent[key] === value);
}

async function sendTypingState(conversationId, active, actorId, actorPersona) {
  if (Number(state?.user?.id) !== actorId || state?.persona !== actorPersona) return;
  const scope = actorId + ":" + actorPersona + ":" + conversationId + ":" + String(active);
  let mutationKey = typingMutationKeys.get(scope);
  if (!mutationKey) {
    mutationKey = newUploadMutationKey("thread-typing");
    if (typingMutationKeys.size >= 64) typingMutationKeys.delete(typingMutationKeys.keys().next().value);
    typingMutationKeys.set(scope, mutationKey);
  }
  const result = await api("/api/chat/conversations/" + conversationId + "/typing", {
    method: "POST",
    headers: { "Idempotency-Key": mutationKey },
    body: { active },
  }).catch(() => null);
  if (isBoundAuxiliaryMutation(result, { conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, active })
    && Number(result.expires_in_seconds) === (active ? 8 : 0)
    && typingMutationKeys.get(scope) === mutationKey) typingMutationKeys.delete(scope);
}

function signalTyping(conversationId) {
  conversationId = Number(conversationId);
  const actorId = Number(state?.user?.id);
  const actorPersona = state?.persona;
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0 || !Number.isSafeInteger(actorId) || !actorPersona) return;
  const now = Date.now();
  const lastSentAt = Number(typingLastSentAt.get(conversationId) || 0);
  if (now - lastSentAt > 2500) {
    typingLastSentAt.set(conversationId, now);
    sendTypingState(conversationId, true, actorId, actorPersona);
  }
  clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(() => {
    sendTypingState(conversationId, false, actorId, actorPersona);
  }, 3000);
}

function closeThreadActionSheet(host) {
  if (host) host.innerHTML = "";
}

function manageGroup(conversationId, conversation) {
  if (!Number.isSafeInteger(Number(conversationId)) || Number(conversationId) <= 0 || !conversation || conversation.kind !== "group") return;
  conversationId = Number(conversationId);
  const members = (Array.isArray(conversation.participants) ? conversation.participants : [])
    .filter((participant) => participant && Number.isSafeInteger(Number(participant.id)) && Number(participant.id) > 0 && participant.state === "active" && participant.role !== "owner");
  const host = document.getElementById("global-sheet");
  host.innerHTML = '<div class="sheet-backdrop" id="close-thread-action"><section class="account-modal" role="dialog" aria-modal="true" aria-labelledby="group-admin-title" tabindex="-1"><button class="sheet-close" id="thread-action-x" type="button" aria-label="' + esc(t("group.close")) + '">×</button><small>' + esc(t("group.eyebrow")) + '</small><h3 id="group-admin-title">' + esc(t("group.title")) + '</h3><form id="group-admin-form" data-thread-action-key="' + esc(newUploadMutationKey("group-admin")) + '"><div class="field"><label>' + esc(t("group.action")) + '</label><select name="action"><option value="rename">' + esc(t("group.rename")) + '</option><option value="add">' + esc(t("group.add")) + '</option><option value="remove">' + esc(t("group.remove")) + '</option></select></div><div class="field" data-group-field="rename"><label>' + esc(t("group.newTitle")) + '</label><input name="title" minlength="1" maxlength="80" value="' + esc(conversation.title || "") + '" /></div><div class="field" data-group-field="add" hidden><label>' + esc(t("group.inviteUsername")) + '</label><input name="username" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="31" placeholder="@username" /></div><div class="field" data-group-field="remove" hidden><label>' + esc(t("group.removeMember")) + '</label><select name="member_id"><option value="">' + esc(members.length ? t("group.chooseMember") : t("group.noRemovableMembers")) + '</option>' + members.map((member) => '<option value="' + Number(member.id) + '">@' + esc(member.handle) + '</option>').join("") + '</select></div><p class="mvx-hint">' + esc(t("group.truth")) + '</p><button class="btn" type="submit">' + esc(t("group.save")) + '</button><div id="group-admin-result" aria-live="polite"></div></form></section></div>';
  const dialog = host.querySelector("[role='dialog']");
  const form = document.getElementById("group-admin-form");
  const close = () => closeThreadActionSheet(host);
  document.getElementById("thread-action-x").addEventListener("click", close);
  document.getElementById("close-thread-action").addEventListener("click", (event) => { if (event.target.id === "close-thread-action") close(); });
  const syncFields = () => {
    const action = form.elements.action.value;
    form.querySelectorAll("[data-group-field]").forEach((field) => { field.hidden = field.dataset.groupField !== action; });
    form.elements.title.required = action === "rename";
    form.elements.username.required = action === "add";
    form.elements.member_id.required = action === "remove";
  };
  form.elements.action.addEventListener("change", syncFields);
  form.addEventListener("input", () => { form.dataset.threadActionKey = newUploadMutationKey("group-admin"); });
  syncFields();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const output = document.getElementById("group-admin-result");
    if (submit.disabled) return;
    const action = form.elements.action.value;
    const title = String(form.elements.title.value || "").trim();
    const username = String(form.elements.username.value || "").trim().replace(/^@/, "").toLowerCase();
    const memberId = Number(form.elements.member_id.value);
    const actorId = Number(state?.user?.id);
    const actorPersona = state?.persona;
    if (action === "rename" && (!title || title.length > 80)) return output.textContent = t("group.invalidTitle");
    if (action === "add" && !/^[a-z0-9_]{2,30}$/.test(username)) return output.textContent = t("conversation.invalidUsernames");
    const target = action === "remove" ? members.find((member) => Number(member.id) === memberId) : null;
    if (action === "remove" && !target) return output.textContent = t("group.invalidMember");
    submit.disabled = true;
    output.textContent = t("group.saving");
    const path = action === "remove" ? "/api/chat/conversations/" + conversationId + "/group/members/" + memberId : "/api/chat/conversations/" + conversationId + "/group";
    const expectedKeyEpoch = Number(conversation.key_epoch);
    const body = action === "rename" ? { title, expected_title: conversation.title ?? null }
      : action === "add" ? { username, expected_key_epoch: expectedKeyEpoch }
        : { expected_key_epoch: expectedKeyEpoch };
    const result = await api(path, { method: action === "remove" ? "DELETE" : "PATCH", headers: { "Idempotency-Key": form.dataset.threadActionKey }, body }).catch(() => null);
    if (!form.isConnected || activeConversationId !== conversationId || Number(state?.user?.id) !== actorId || state?.persona !== actorPersona) return;
    const expected = { conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, action,
      ...(action === "rename" ? {} : { expected_key_epoch: expectedKeyEpoch }) };
    const targetBound = action === "remove" ? result?.intent?.target_id === memberId
      : action === "add" ? result?.intent?.target_handle === username && Number.isSafeInteger(Number(result?.intent?.target_id))
        : result?.intent?.title === title && (result.intent.expected_title ?? null) === (conversation.title ?? null);
    const conversationBound = action === "remove" ? Number(result?.key_epoch) === expectedKeyEpoch + 1 : (isSafeConversationSummary(result?.conversation, actorId)
      && Number(result.conversation.id) === conversationId && result.conversation.kind === "group" && result.conversation.context_persona === actorPersona);
    if (!isBoundAuxiliaryMutation(result, expected) || !targetBound || !conversationBound) { submit.disabled = false; output.textContent = t("group.failed"); return; }
    toast(t(action === "rename" ? "group.renamed" : action === "add" ? "group.invited" : "group.removed"));
    close();
    loadThread(conversationId);
  });
  dialog.focus();
}

function localDateTimeInputValue(timestampMs) {
  const date = new Date(timestampMs);
  const part = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + part(date.getMonth() + 1) + "-" + part(date.getDate()) + "T" + part(date.getHours()) + ":" + part(date.getMinutes());
}

function scheduleMeeting(conversationId) {
  if (!Number.isSafeInteger(Number(conversationId)) || Number(conversationId) <= 0) return;
  conversationId = Number(conversationId);
  const host = document.getElementById("global-sheet");
  const earliest = Date.now() + (5 * 60 * 1000);
  const latest = Date.now() + (366 * 24 * 60 * 60 * 1000);
  host.innerHTML = '<div class="sheet-backdrop" id="close-thread-action"><section class="account-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-title" tabindex="-1"><button class="sheet-close" id="thread-action-x" type="button" aria-label="' + esc(t("meeting.close")) + '">×</button><small>' + esc(t("meeting.eyebrow")) + '</small><h3 id="meeting-title">' + esc(t("meeting.title")) + '</h3><form id="meeting-form" data-thread-action-key="' + esc(newUploadMutationKey("meeting-create")) + '"><div class="field"><label>' + esc(t("meeting.name")) + '</label><input name="title" required minlength="1" maxlength="100" /></div><div class="field"><label>' + esc(t("meeting.when")) + '</label><input name="starts_at" type="datetime-local" required min="' + esc(localDateTimeInputValue(earliest)) + '" max="' + esc(localDateTimeInputValue(latest)) + '" /></div><div class="field"><label>' + esc(t("meeting.duration")) + '</label><select name="duration"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option><option value="90">90 min</option><option value="120">120 min</option></select></div><p class="mvx-hint">' + esc(t("meeting.truth")) + '</p><button class="btn" type="submit">' + esc(t("meeting.schedule")) + '</button><div id="meeting-result" aria-live="polite"></div></form></section></div>';
  const dialog = host.querySelector("[role='dialog']");
  const form = document.getElementById("meeting-form");
  const close = () => closeThreadActionSheet(host);
  document.getElementById("thread-action-x").addEventListener("click", close);
  document.getElementById("close-thread-action").addEventListener("click", (event) => { if (event.target.id === "close-thread-action") close(); });
  form.addEventListener("input", () => { form.dataset.threadActionKey = newUploadMutationKey("meeting-create"); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const output = document.getElementById("meeting-result");
    if (submit.disabled) return;
    const title = String(form.elements.title.value || "").trim();
    const startsAtMs = new Date(form.elements.starts_at.value).getTime();
    const durationMinutes = Number(form.elements.duration.value);
    const startsAt = Math.floor(startsAtMs / 1000);
    const actorId = Number(state?.user?.id);
    const actorPersona = state?.persona;
    const now = Date.now();
    if (!title || title.length > 100) return output.textContent = t("meeting.invalidTitle");
    if (!Number.isFinite(startsAtMs) || startsAtMs < now + (5 * 60 * 1000) || startsAtMs > now + (366 * 24 * 60 * 60 * 1000)) return output.textContent = t("meeting.invalidStart");
    if (!new Set([15, 30, 45, 60, 90, 120]).has(durationMinutes)) return output.textContent = t("meeting.invalidDuration");
    submit.disabled = true;
    output.textContent = t("meeting.saving");
    const result = await api("/api/chat/conversations/" + conversationId + "/meetings", { method: "POST", headers: { "Idempotency-Key": form.dataset.threadActionKey }, body: { title, starts_at: startsAt, duration_minutes: durationMinutes } }).catch(() => null);
    if (!form.isConnected || activeConversationId !== conversationId || Number(state?.user?.id) !== actorId || state?.persona !== actorPersona) return;
    const meeting = result?.meeting;
    const meetingBound = Number.isSafeInteger(Number(meeting?.id)) && Number(meeting.id) > 0
      && Number(meeting.conversation_id) === conversationId && Number(meeting.created_by) === actorId
      && meeting.title === title && Number(meeting.starts_at) === startsAt && Number(meeting.duration_minutes) === durationMinutes;
    if (!isBoundAuxiliaryMutation(result, { conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, title, starts_at: startsAt, duration_minutes: durationMinutes }) || !meetingBound) {
      submit.disabled = false; output.textContent = t("meeting.failed"); return;
    }
    toast(t("meeting.saved"));
    close();
    loadThread(conversationId);
  });
  dialog.focus();
}

async function renderProfiles(vp) {
  const selectedPersona = state.persona;
  const loadRequest = profileLoadGate.begin();
  // Every panel the drawer can open, in the drawer's own order. There is no second navigation on this
  // screen any more: the three bars are the index, and the panels are the destinations.
  const profileViews = ["profile", "wallet", "access", "privacy", "notifications", "settings"];
  if (profileSettingsView !== "edit" && !profileViews.includes(profileSettingsView)) profileSettingsView = "profile";
  vp.innerHTML = '<div class="screen scrollScreen accountScreen"><div class="notificationLoading">' + esc(t("profile.loading")) + '</div></div>';
  const [accountResponse, publicProfile] = await Promise.all([
    api("/api/account").catch(() => null),
    api("/api/profiles/" + encodeURIComponent(state.user.handle) + "?persona=" + encodeURIComponent(selectedPersona)).catch(() => null),
  ]);
  if (!loadRequest.isCurrent() || !vp?.isConnected || state.persona !== selectedPersona) return;
  if (!publicProfile?.ok || !publicProfile.profile || typeof publicProfile.profile !== "object") {
    vp.innerHTML = '<div class="screen scrollScreen accountScreen"><div class="emptyInbox inboxError"><i>!</i><b>' + esc(t("profile.loadError")) + '</b><span>' + esc(t("profile.loadErrorDetail")) + '</span><button type="button" data-profile-retry>' + esc(t("common.retry")) + '</button></div></div>';
    vp.querySelector("[data-profile-retry]")?.addEventListener("click", () => renderProfiles(vp));
    return;
  }
  const account = accountResponse?.ok ? accountResponse : { ok: false, providers: {}, funding: {} };
  const activeTabId = (view) => (view === "edit" ? "profile" : view);
  vp.innerHTML = '<div class="screen scrollScreen accountScreen" data-profile-settings-view="' + esc(profileSettingsView) + '"><div id="profile-preview"></div><div id="pedit" class="profileSettingsArea" hidden></div><div id="profile-menu-root"></div><div id="account-sheet"></div></div>';
  renderProfilePreview(publicProfile);
  // The drawer is markup first and behaviour later: it renders with the screen so the bars have
  // something to open, and it is bound once the panels exist.
  document.getElementById("profile-menu-root").innerHTML = profileMenuMarkup({ esc, t, active: activeTabId(profileSettingsView) });

  const edit = document.getElementById("pedit");
  const u = state.user;
  const persona = activePersonaRecord();
  let personaLanguages = [];
  try { personaLanguages = JSON.parse(persona.content_languages || "[]"); } catch { personaLanguages = []; }
  const walletAddressCandidate = String(account.ok ? account.address : (u.linked_wallet || u.mvx_address || ""));
  const address = /^erd1[a-z0-9]{58}$/.test(walletAddressCandidate) ? walletAddressCandidate : "";
  const canFund = Boolean(account.ok && account.funding?.crypto_transfer === true && address);
  const providerRows = account.ok ? [
    ["Email", account.providers.email, account.providers.email_verified ? t("security.verified") : t("security.unverified")],
    ["Google", account.providers.google, account.providers.google ? t("security.connected") : t("security.disconnected")],
    ["Facebook", account.providers.facebook, account.providers.facebook ? t("security.connected") : t("security.disconnected")],
    ["xPortal", account.providers.xportal, account.providers.xportal ? t("security.connected") : t("security.optional")],
  ] : [];
  // The panels are markup and nothing else: this screen keeps every write, binding and validation,
  // and the module receives the values that are already resolved here.
  edit.innerHTML = profileSettingsPanelsMarkup({
    esc, t, account, persona, selectedPersona, personaLanguages, address, canFund, providerRows, user: u,
    mutationKey: newUploadMutationKey, interfaceLocale, readSocialMuted, socialMediaFit, socialPresentation,
    tickerSpeedLabelKey, readTickerSpeed,
  });
  // The city and the age the band prints are identity, so the settings screen edits them too: the picker
  // is the one the hero already uses, it writes the field this form saves, and nothing leaves on its own —
  // the same Save carries it with everything else.
  const paintProfileLocation = (value) => {
    const chosen = String(value ?? "").trim();
    const button = edit.querySelector("[data-owner-location]");
    const field = edit.querySelector("[data-profile-location]");
    if (field) field.value = chosen;
    if (button) {
      button.dataset.ownerLocation = chosen;
      const label = button.querySelector("span");
      if (label) label.textContent = chosen || t("profile.locationAdd");
    }
    // Choosing a city is a change to the form the way typing is: the submission key moves with it.
    edit.querySelector("#profile-form")?.dispatchEvent(new Event("input", { bubbles: true }));
  };
  // The age a date of birth stands for, counted the way a birthday is: the day has to have happened this
  // year for the year to count. The server keeps the record and is the judge; this is the sentence the form
  // shows while somebody is still typing, and a day out of range is refused before a request is made.
  function profileAgeFromBirthDate(value, now = Date.now()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
    const today = new Date(now);
    let age = today.getUTCFullYear() - year;
    const monthDelta = today.getUTCMonth() + 1 - month;
    if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) age -= 1;
    return age >= 13 && age <= 120 ? age : null;
  }
  const refreshProfileIdentityFields = () => {
    // The panels are markup built once, so the two fields the hero can write as well are read back from
    // the record every time a panel opens: what the profile holds is what Settings shows.
    const record = activePersonaRecord();
    paintProfileLocation(record?.location || "");
    const birth = edit.querySelector("[data-profile-birth]");
    if (birth) birth.value = typeof record?.birth_date === "string" ? record.birth_date : "";
  };
  bindLocationPicker(edit, { esc, t, onSelect: (value) => { paintProfileLocation(value); } });
  // The drawer is the switcher for the whole screen: the hero asks it for a panel through
  // `profileSectionSwitcher`, and the panels below are shown one at a time.

  const setProfileSettingsView = (nextView) => {
    if (nextView !== "edit" && !profileViews.includes(nextView)) return;
    profileSettingsView = nextView;
    const screen = vp.querySelector(".accountScreen");
    if (!screen) return;
    screen.dataset.profileSettingsView = nextView;
    // A panel names every view it belongs to (the Save row follows the profile and the privacy
    // panels), so the attribute is read as a list instead of as a single name.
    screen.querySelectorAll("[data-profile-panel]").forEach((panel) => {
      const active = String(panel.dataset.profilePanel || "").split(/\s+/).includes(activeTabId(nextView));
      panel.classList.toggle("profilePanelInactive", !active);
      panel.setAttribute("aria-hidden", String(!active));
    });
    // The drawer is this screen's only navigation, so it marks the row that is open.
    markProfileMenuActive(screen, activeTabId(nextView));
    // Opening a panel reads the record again, so a value the hero wrote is the value the panel shows.
    refreshProfileIdentityFields();
    const heroView = nextView === "profile"; edit.hidden = heroView;
    document.getElementById("profile-preview").hidden = !heroView;
    screen.scrollTo({ top: 0, behavior: "smooth" });
  };
  profileSectionSwitcher = (view) => setProfileSettingsView(profileMenuView(view));
  // The hero edits facts the band prints, so the screen offers the same render to the button that saves
  // them: one hook, set where the screen is built, and no module owns the navigation.
  profileScreenRefresher = () => renderProfiles(vp);
  bindProfileMenu(vp, {
    onSelect: (id) => setProfileSettingsView(profileMenuView(id)),
    onLogout: () => { void logoutFromProfile(); },
  });
  // The bar above the panels carries the way back to the hero, because the hero is what the drawer
  // replaced while a settings panel is open.
  vp.querySelector("[data-profile-back]")?.addEventListener("click", () => setProfileSettingsView("profile"));
  const preferenceHost = vp.querySelector("#profile-notification-prefs");
  void (async () => {
    const preferences = await api("/api/notification-preferences?persona=" + encodeURIComponent(selectedPersona)).catch(() => null);
    if (!loadRequest.isCurrent() || !preferenceHost?.isConnected) return;
    if (!preferences?.ok) {
      preferenceHost.innerHTML = '<p class="settingsNote">' + esc(t("activity.loadError")) + '</p>';
      return;
    }
    preferenceHost.innerHTML = notificationPreferenceForms(preferences.preferences, { esc, t, persona: selectedPersona, newKey: newUploadMutationKey });
    bindNotificationPreferenceForms(preferenceHost, {
      persona: selectedPersona,
      ownerId: Number(state.user.id),
      isCurrent: () => loadRequest.isCurrent() && state.persona === selectedPersona,
      save: (body, key) => api("/api/notification-preferences", { method: "PATCH", headers: { "Idempotency-Key": key }, body }).catch(() => null),
      newKey: newUploadMutationKey,
      t,
    });
  })();
  // The settings form holds the policy (visibility, messages, languages, region, prices, profile kind);
  // the name, the description, the location, the photo and the cover are edited where they are read.
  setProfileSettingsView(profileSettingsView);
  // The sign-out is the one setting that moved out of the removed header: it lives next to the sessions
  // it ends, and the identity is edited on the profile itself now.
  document.getElementById("profile-settings-logout")?.addEventListener("click", () => { void logoutFromProfile(); });
  const deviceSettingLabels = {
    sound: () => [readSocialMuted() ? t("profile.soundOff") : t("profile.soundOn"), String(!readSocialMuted())],
    fit: () => [socialMediaFit === "fill" ? t("profile.fitFill") : t("profile.fitFit"), String(socialMediaFit === "fill")],
    presentation: () => [socialPresentation === "immersive" ? t("profile.presentationImmersive") : t("profile.presentationCards"), String(socialPresentation === "immersive")],
    // A three-state row is not a toggle, so it reports no pressed state: its value is the state.
    ticker: () => [t(tickerSpeedLabelKey(readTickerSpeed())), null],
  };
  vp.querySelectorAll("[data-device-setting]").forEach((row) => row.addEventListener("click", () => {
    const kind = row.dataset.deviceSetting;
    if (kind === "sound") { writeSocialMuted(!readSocialMuted()); applySocialMuted(document, readSocialMuted()); }
    if (kind === "fit") setSocialMediaFit(socialMediaFit === "fill" ? "fit" : "fill");
    if (kind === "presentation") setSocialPresentation(socialPresentation === "immersive" ? "cards" : "immersive");
    // The band re-paces without being re-rendered: the loop keeps its position.
    if (kind === "ticker") { writeTickerSpeed(nextTickerSpeed(readTickerSpeed())); applyTickerSpeed(document, readTickerSpeed()); }
    const [label, pressed] = deviceSettingLabels[kind]();
    const value = row.querySelector("strong");
    if (value) value.textContent = label;
    if (pressed) row.setAttribute("aria-pressed", pressed);
  }));
  bindProfilePullRefresh(vp.querySelector(".accountScreen"), refreshActiveProfile);

  document.getElementById("copy-address")?.addEventListener("click", () => copyText(address, t("wallet.addressCopied")));
  document.getElementById("topup-wallet")?.addEventListener("click", () => { if (canFund) renderTopupSheet(address, account); });
  document.getElementById("refresh-assets")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = t("wallet.refreshing");
    const fresh = await api("/api/account?refresh=1").catch(() => null);
    if (!button.isConnected || state.persona !== selectedPersona) return;
    renderAssetList(fresh);
    button.disabled = false;
    button.textContent = t("wallet.refresh");
  });

  const usernameButton = document.getElementById("save-username");
  const usernameInput = edit.querySelector('input[name="username"]');
  usernameInput.addEventListener("input", () => { usernameButton.dataset.usernameKey = newUploadMutationKey("username-claim"); });
  usernameButton.addEventListener("click", async () => {
    const input = edit.querySelector('input[name="username"]');
    const msg = document.getElementById("username-msg");
    const username = (input?.value || "").trim().replace(/^@/, "").toLowerCase();
    if (usernameButton.disabled) return;
    if (!/^[a-z0-9_]{2,30}$/.test(username)) { msg.textContent = t("wallet.usernameInvalid"); return; }
    const usernameKey = usernameButton.dataset.usernameKey;
    usernameButton.disabled = true;
    input.disabled = true;
    msg.textContent = t("wallet.usernameChecking");
    const result = await api("/api/claim-username", { method: "POST", headers: { "Idempotency-Key": usernameKey }, body: { username } }).catch(() => null);
    if (!usernameButton.isConnected || state.persona !== selectedPersona) return;
    if (!result?.ok || Number(result.owner_id) !== Number(state.user.id) || result.username !== username
      || !result.user || Number(result.user.id) !== Number(state.user.id) || result.user.handle !== username) {
      usernameButton.disabled = false;
      input.disabled = false;
      msg.textContent = t("wallet.usernameUnavailable");
      return;
    }
    state.user = result.user;
    msg.textContent = t("wallet.usernameSaved");
    toast(t("wallet.usernameSaved"));
    renderHeader();
    renderProfiles(vp);
  });
  document.getElementById("copy-nexus-username").addEventListener("click", () => copyText("@" + state.user.handle, t("wallet.usernameCopied")));
  document.getElementById("edit-orbit-status").addEventListener("click", openSigilSwitcher);
  document.getElementById("open-nexus-pay").addEventListener("click", () => {
    activeSlot = "primary";
    activeModule = "pay";
    renderNav(); renderRail(); renderInfoPanel(); renderView();
  });


  const localWallet = window.NexusDeviceWallet?.deviceWalletStatus(address);
  const deviceStatus = document.getElementById("device-wallet-status");
  if (deviceStatus) deviceStatus.textContent = localWallet?.available
    ? t("security.deviceWalletAvailable")
    : t("security.deviceWalletMissing");
  const sessionArea = document.getElementById("session-stepup-area");
  const accountSessionsLoadGate = createLatestRequestGate();
  const mountSessionXPortal = async (endpoint) => {
    sessionArea.innerHTML = '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">' + esc(t("auth.preparingXportal")) + '</p><div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="' + esc(t("auth.xportalQr")) + '"></div><div id="mvx-wc-link" class="wc-link"></div>';
    await xPortalFlow({ endpoint });
  };
  const loadAccountSessions = async () => {
    const host = document.getElementById("account-session-list");
    if (!host) return;
    const request = accountSessionsLoadGate.begin();
    host.innerHTML = '<p class="mvx-hint">' + esc(t("sessions.loading")) + '</p>';
    const result = await api("/api/account/sessions").catch(() => null);
    if (!request.isCurrent() || !host.isConnected || state.persona !== selectedPersona) return;
    if (!result?.ok || !Array.isArray(result.sessions)) {
      host.innerHTML = '<p class="security-warning">' + esc(t("sessions.loadFailed")) + '</p>';
      return;
    }
    const sessions = result.sessions.filter((session) => session && typeof session === "object"
      && Number.isSafeInteger(Number(session.id)) && Number(session.id) > 0
      && typeof session.device_label === "string" && session.device_label.length >= 1 && session.device_label.length <= 80
      && ["social", "work", "dating", "travel", "market"].includes(session.persona)
      && Number.isFinite(Number(session.last_seen_at)) && Number(session.last_seen_at) > 0
      && typeof session.current === "boolean").slice(0, 100);
    if (sessions.length !== result.sessions.length || sessions.filter((session) => session.current).length !== 1) {
      host.innerHTML = '<p class="security-warning">' + esc(t("sessions.invalidResponse")) + '</p>';
      return;
    }
    host.innerHTML = sessions.map((session) => '<article class="accountSession ' + (session.current ? 'current' : '') + '"><i>◇</i><span><b>' + esc(session.device_label) + (session.current ? ' · ' + esc(t("sessions.thisDevice")) : '') + '</b><small>' + esc(t("sessions.profile")) + ' ' + esc(session.persona) + ' · ' + esc(t("sessions.active")) + ' ' + esc(new Date(Number(session.last_seen_at) * 1000).toLocaleString(interfaceLocale)) + '</small></span>' + (session.current ? '<em>' + esc(t("sessions.current")) + '</em>' : '<button type="button" data-revoke-session="' + Number(session.id) + '" data-revoke-key="' + esc(newUploadMutationKey("session-revoke")) + '">' + esc(t("sessions.revoke")) + '</button>') + '</article>').join('') || '<p class="mvx-hint">' + esc(t("sessions.empty")) + '</p>';
    host.querySelectorAll("[data-revoke-session]").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled) return;
      if (account.providers?.email) {
        const password = document.getElementById("session-current-password")?.value || "";
        if (!password) return toast(t("sessions.confirmPassword"));
        button.disabled = true;
        const revoked = await api("/api/account/sessions/" + button.dataset.revokeSession + "/revoke", { method: "POST", headers: { "Idempotency-Key": button.dataset.revokeKey }, body: { current_password: password } }).catch(() => null);
        if (!button.isConnected || state.persona !== selectedPersona) return;
        if (!revoked?.ok) { button.disabled = false; return toast(t("sessions.revokeFailed")); }
        toast(t("sessions.revoked"));
        await loadAccountSessions();
        return;
      }
      button.disabled = true;
      await mountSessionXPortal("/api/account/sessions/" + button.dataset.revokeSession + "/revoke");
      if (button.isConnected) button.disabled = false;
    }));
  };
  const chatDevicesLoadGate = createLatestRequestGate();
  const isSafeOwnerChatDevice = (device) => device && typeof device === "object" && !Array.isArray(device)
    && !("public_jwk" in device) && !("private_jwk" in device) && !("activation_token" in device)
    && /^[a-zA-Z0-9:_-]{16,80}$/.test(String(device.device_id || ""))
    && typeof device.label === "string" && device.label.length >= 1 && device.label.length <= 80
    && device.key_algorithm === "ECDH-P256"
    && ["active", "pending_recovery", "expired", "revoked"].includes(device.status)
    && Number.isSafeInteger(Number(device.registered_at)) && Number(device.registered_at) > 0
    && (device.status !== "pending_recovery" || (Number.isSafeInteger(Number(device.activation_expires_at)) && Number(device.activation_expires_at) > 0));
  const loadChatDevices = async () => {
    const host = document.getElementById("account-chat-device-list");
    if (!host) return;
    const request = chatDevicesLoadGate.begin();
    host.innerHTML = '<p class="mvx-hint">' + esc(t("e2eeDevices.loading")) + '</p>';
    const result = await api("/api/chat/devices").catch(() => null);
    if (!request.isCurrent() || !host.isConnected || state.persona !== selectedPersona) return;
    if (!result?.ok || Number(result.query?.owner_id) !== Number(u.id)
      || result.public_keys_exposed_in_account_inventory !== false || result.private_keys_on_server !== false
      || !Array.isArray(result.devices) || result.devices.length > 100) {
      host.innerHTML = '<p class="security-warning">' + esc(t("e2eeDevices.loadFailed")) + '</p>';
      return;
    }
    const devices = result.devices.filter(isSafeOwnerChatDevice);
    if (devices.length !== result.devices.length || new Set(devices.map((device) => device.device_id)).size !== devices.length) {
      host.innerHTML = '<p class="security-warning">' + esc(t("e2eeDevices.invalidResponse")) + '</p>';
      return;
    }
    host.innerHTML = devices.map((device) => {
      const active = device.status === "active";
      const pending = device.status === "pending_recovery";
      const activity = Number(device.last_seen_at || device.registered_at || 0) * 1000;
      const stateLabel = active ? esc(t("e2eeDevices.active")) + ' ' + esc(new Date(activity).toLocaleString(interfaceLocale))
        : pending ? esc(t("e2eeDevices.pendingUntil")) + ' ' + esc(new Date(Number(device.activation_expires_at) * 1000).toLocaleTimeString(interfaceLocale))
          : esc(t(device.status === "expired" ? "e2eeDevices.expiredDetail" : "e2eeDevices.revokedDetail"));
      const action = active || pending ? '<button type="button" data-revoke-chat-device="' + esc(device.device_id) + '" data-revoke-device-key="' + esc(newUploadMutationKey("e2ee-device-revoke")) + '">' + esc(t("e2eeDevices.revoke")) + '</button>' : '<em>' + esc(t(device.status === "expired" ? "e2eeDevices.expired" : "e2eeDevices.revoked")) + '</em>';
      return '<article class="accountSession chatKeyDevice ' + (active ? 'current' : pending ? 'pending' : 'revoked') + '"><i>' + (active ? '◇' : pending ? '◌' : '×') + '</i><span><b>' + esc(device.label) + '</b><small>ECDH-P256 · ' + stateLabel + '</small></span>' + action + '</article>';
    }).join('') || '<p class="mvx-hint">' + esc(t("e2eeDevices.empty")) + '</p>';
    host.querySelectorAll("[data-revoke-chat-device]").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled || !window.confirm(t("e2eeDevices.confirmRevoke"))) return;
      const deviceId = button.dataset.revokeChatDevice;
      const endpoint = "/api/chat/devices/" + encodeURIComponent(deviceId) + "/revoke";
      if (account.providers?.email) {
        const password = document.getElementById("session-current-password")?.value || "";
        if (!password) return toast(t("sessions.confirmPassword"));
        button.disabled = true;
        const revoked = await api(endpoint, { method: "POST", headers: { "Idempotency-Key": button.dataset.revokeDeviceKey }, body: { current_password: password } }).catch(() => null);
        if (!button.isConnected || state.persona !== selectedPersona) return;
        const exactRevocation = revoked?.ok && revoked.intent?.owner_id === Number(u.id) && revoked.intent?.device_id === deviceId
          && revoked.intent?.action === "revoke" && revoked.status === "revoked" && revoked.reversible === false
          && revoked.historical_access_transferred === false && isSafeOwnerChatDevice(revoked.device)
          && revoked.device.device_id === deviceId && revoked.device.status === "revoked";
        if (!exactRevocation) { button.disabled = false; return toast(t("e2eeDevices.revokeFailed")); }
        toast(t("e2eeDevices.revokeSuccess"));
        await loadChatDevices();
        return;
      }
      button.disabled = true;
      await mountSessionXPortal(endpoint);
      if (button.isConnected) button.disabled = false;
    }));
  };
  let selectedRecoveryFile = null;
  let pendingRecoveryActivation = null;
  const recoveryStatus = document.getElementById("e2ee-recovery-status");
  const recoveryPassphrase = () => document.getElementById("e2ee-recovery-passphrase")?.value || "";
  const recoveryFileInput = document.getElementById("restore-e2ee-file");
  const recoveryRestoreButton = document.getElementById("restore-e2ee-recovery");
  const recoveryActivateButton = document.getElementById("activate-e2ee-recovery");
  const recoveryScreenActive = () => Boolean(recoveryStatus?.isConnected && Number(state?.user?.id) === Number(u.id) && state.persona === selectedPersona);
  try {
    const accountBinding = await computeRecoveryAccountBinding({ userId: u.id, mvxAddress: u.mvx_address || u.linked_wallet });
    pendingRecoveryActivation = await readPendingRecoveryActivation({ accountBinding });
  }
  catch { pendingRecoveryActivation = null; }
  if (pendingRecoveryActivation && Number(pendingRecoveryActivation.expiresAt) * 1000 > Date.now()) {
    recoveryActivateButton.hidden = false;
    recoveryActivateButton.disabled = false;
    recoveryStatus.textContent = t("recovery.pendingRecovered") + " " + new Date(pendingRecoveryActivation.expiresAt * 1000).toLocaleTimeString() + ".";
  } else if (pendingRecoveryActivation) {
    pendingRecoveryActivation = null;
    await clearPendingRecoveryActivation().catch(() => {});
  }
  recoveryFileInput?.addEventListener("change", () => {
    selectedRecoveryFile = recoveryFileInput.files?.[0] || null;
    const allowedType = selectedRecoveryFile && (selectedRecoveryFile.type === "application/json" || (!selectedRecoveryFile.type && /\.json$/i.test(selectedRecoveryFile.name)));
    const allowed = allowedType && selectedRecoveryFile.size > 0 && selectedRecoveryFile.size <= 64 * 1024;
    recoveryRestoreButton.disabled = !allowed;
    recoveryStatus.textContent = allowed
      ? t("recovery.packageSelected") + " " + selectedRecoveryFile.name + ". " + t("recovery.enterAndConfirm")
      : selectedRecoveryFile ? t("recovery.packageRejected") : t("security.restoreEmptyOnly");
  });
  document.getElementById("create-e2ee-recovery")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const passphrase = recoveryPassphrase();
    if ([...passphrase].length < 14 || passphrase !== passphrase.trim()) return toast(t("recovery.passphraseInvalid"));
    if (!window.confirm(t("recovery.confirmCreate"))) return;
    button.disabled = true;
    recoveryStatus.textContent = t("recovery.creating");
    try {
      const accountBinding = await computeRecoveryAccountBinding({ userId: u.id, mvxAddress: u.mvx_address || u.linked_wallet });
      const recovery = await provisionRecoveryDevice(api, passphrase, accountBinding, u.id);
      if (!recoveryScreenActive()) return;
      const blob = new Blob([JSON.stringify(recovery.bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = recovery.filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      document.getElementById("e2ee-recovery-passphrase").value = "";
      pendingRecoveryActivation = recovery.activation;
      let refreshSafe = true;
      try { await persistPendingRecoveryActivation(recovery.activation); }
      catch { refreshSafe = false; }
      recoveryActivateButton.hidden = false;
      recoveryActivateButton.disabled = false;
      recoveryStatus.textContent = t("recovery.downloadRequested") + " " + new Date(recovery.activation.expiresAt * 1000).toLocaleTimeString() + ". " + t(refreshSafe ? "recovery.refreshSafe" : "recovery.refreshUnsafe");
      toast(t("recovery.packageReady"));
      await loadChatDevices();
    } catch {
      if (recoveryScreenActive()) {
        recoveryStatus.textContent = t("recovery.createFailed");
        toast(t("recovery.packageCreateFailed"));
      }
    } finally { if (button.isConnected) button.disabled = false; }
  });
  recoveryActivateButton?.addEventListener("click", async () => {
    if (recoveryActivateButton.disabled) return;
    if (!pendingRecoveryActivation || Number(pendingRecoveryActivation.expiresAt) * 1000 <= Date.now()) {
      pendingRecoveryActivation = null;
      await clearPendingRecoveryActivation().catch(() => {});
      recoveryActivateButton.hidden = true;
      return toast(t("recovery.prepareAgain"));
    }
    if (!window.confirm(t("recovery.confirmActivate"))) return;
    recoveryActivateButton.disabled = true;
    recoveryStatus.textContent = t("recovery.activating");
    try {
      const activated = await activateProvisionedRecoveryDevice(api, pendingRecoveryActivation, u.id);
      if (!recoveryScreenActive()) return;
      pendingRecoveryActivation = null;
      await clearPendingRecoveryActivation();
      recoveryActivateButton.hidden = true;
      recoveryStatus.textContent = t("recovery.active");
      toast(t(activated.replay ? "recovery.alreadyActive" : "recovery.activated"));
      await loadChatDevices();
    } catch {
      if (!recoveryScreenActive()) return;
      recoveryStatus.textContent = t("recovery.activationRefused");
      toast(t("recovery.notActivated"));
      if (Date.now() >= Number(pendingRecoveryActivation?.expiresAt || 0) * 1000) {
        pendingRecoveryActivation = null;
        await clearPendingRecoveryActivation();
        recoveryActivateButton.hidden = true;
      } else recoveryActivateButton.disabled = false;
    }
  });
  recoveryRestoreButton?.addEventListener("click", async () => {
    if (recoveryRestoreButton.disabled) return;
    const passphrase = recoveryPassphrase();
    if (!selectedRecoveryFile) return toast(t("recovery.chooseFirst"));
    if ([...passphrase].length < 14 || passphrase !== passphrase.trim()) return toast(t("recovery.enterFullPassphrase"));
    if (!window.confirm(t("recovery.confirmRestore"))) return;
    recoveryRestoreButton.disabled = true;
    recoveryStatus.textContent = t("recovery.verifying");
    try {
      const accountBinding = await computeRecoveryAccountBinding({ userId: u.id, mvxAddress: u.mvx_address || u.linked_wallet });
      const restored = await restoreRecoveryDevice(api, await selectedRecoveryFile.text(), passphrase, accountBinding, u.id);
      if (!recoveryScreenActive()) return;
      document.getElementById("e2ee-recovery-passphrase").value = "";
      recoveryStatus.textContent = t("recovery.restored");
      toast(t("recovery.restoredToast"));
      await loadChatDevices();
    } catch {
      if (recoveryScreenActive()) {
        recoveryStatus.textContent = t("recovery.restoreRefused");
        toast(t("recovery.invalidPackage"));
      }
    } finally { if (recoveryRestoreButton.isConnected) recoveryRestoreButton.disabled = false; }
  });
  document.getElementById("refresh-sessions")?.addEventListener("click", loadAccountSessions);
  document.getElementById("refresh-chat-devices")?.addEventListener("click", loadChatDevices);
  document.getElementById("sign-out-all")?.addEventListener("click", async () => {
    if (!window.confirm(t("security.logoutAllConfirm"))) return;
    if (account.providers?.email) {
      const password = document.getElementById("session-current-password")?.value || "";
      if (!password) return toast(t("sessions.confirmPassword"));
      const result = await api("/auth/logout-all", { method: "POST", body: { current_password: password } });
      if (!result.ok) return toast(t("security.logoutAllFailed"));
      await clearCurrentUserDeviceCache();
      location.reload();
      return;
    }
    await mountSessionXPortal("/auth/logout-all");
  });
  loadAccountSessions();
  loadChatDevices();

  const lifecycleStatus = document.getElementById("account-lifecycle-status");
  const exportList = document.getElementById("account-export-list");
  const cancelDeletion = document.getElementById("cancel-account-deletion");
  const requestExport = document.getElementById("request-account-export");
  const requestDeletion = document.getElementById("request-account-deletion");
  const deletionConfirmation = document.getElementById("deletion-confirmation");
  const deletionAcknowledge = document.getElementById("deletion-onchain-ack");
  const lifecycleLoadGate = createLatestRequestGate();
  const accountExportPathPattern = /^\/api\/account\/exports\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  requestExport.dataset.mutationKey = newUploadMutationKey("account-export");
  requestDeletion.dataset.mutationKey = newUploadMutationKey("account-deletion-request");
  if (cancelDeletion) cancelDeletion.dataset.mutationKey = newUploadMutationKey("account-deletion-cancel");
  const rotateDeletionKey = () => { requestDeletion.dataset.mutationKey = newUploadMutationKey("account-deletion-request"); };
  deletionConfirmation?.addEventListener("input", rotateDeletionKey);
  deletionAcknowledge?.addEventListener("change", rotateDeletionKey);
  const lifecyclePassword = () => document.getElementById("lifecycle-current-password")?.value || "";
  const mountLifecycleXPortal = async (endpoint, extra = {}) => {
    const area = document.getElementById("lifecycle-xportal-area");
    area.innerHTML = '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">' + esc(t("auth.preparingXportal")) + '</p><div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="' + esc(t("auth.xportalQr")) + '"></div><div id="mvx-wc-link" class="wc-link"></div>';
    await xPortalFlow({ endpoint, extra });
  };
  const loadAccountLifecycle = async () => {
    const request = lifecycleLoadGate.begin();
    const [status, exports] = await Promise.all([api("/api/account/deletion").catch(() => null), api("/api/account/exports").catch(() => null)]);
    if (!request.isCurrent() || !lifecycleStatus?.isConnected || state.persona !== selectedPersona) return;
    const lifecycleOwnerValid = Number(status?.owner_id) === Number(state.user.id);
    const deletionStateValid = status?.ok && lifecycleOwnerValid && status.request && new Set(["requested", "blocked_legal_hold", "purging"]).has(status.request.state)
      && Number.isSafeInteger(Number(status.request.execute_after)) && Number(status.request.execute_after) > 0
      && typeof status.cancellable === "boolean";
    if (deletionStateValid) {
      const date = new Date(Number(status.request.execute_after) * 1000).toLocaleString(interfaceLocale);
      lifecycleStatus.innerHTML = '<article class="lifecyclePending"><b>' + esc(t("lifecycle.scheduled")) + '</b><span>' + esc(t("lifecycle.graceEnds")) + ' ' + esc(date) + '.</span><small>' + esc(status.request.state === 'blocked_legal_hold' ? t("lifecycle.legalHold") : t("lifecycle.canCancel")) + '</small></article>';
      cancelDeletion.hidden = !status.cancellable;
    } else if (status?.ok && lifecycleOwnerValid && !status.request) {
      lifecycleStatus.innerHTML = '<p class="lifecycleActive">● ' + esc(t("lifecycle.active")) + '</p>';
      cancelDeletion.hidden = true;
    } else lifecycleStatus.innerHTML = '<p class="security-warning">' + esc(t("lifecycle.statusUnavailable")) + '</p>';
    if (!exports?.ok || Number(exports.owner_id) !== Number(state.user.id) || !Array.isArray(exports.exports)) { exportList.innerHTML = '<p class="security-warning">' + esc(t("lifecycle.exportsUnavailable")) + '</p>'; return; }
    const validExports = exports.exports.filter((item) => item && typeof item === "object" && item.download_url
      && accountExportPathPattern.test(String(item.download_url))
      && Number.isSafeInteger(Number(item.expires_at)) && Number(item.expires_at) * 1000 > Date.now()).slice(0, 20);
    exportList.innerHTML = validExports.map((item) => '<a class="accountExportReady" href="' + esc(item.download_url) + '" download><span><b>' + esc(t("lifecycle.exportReady")) + '</b><small>' + esc(t("lifecycle.expires")) + ' ' + esc(new Date(Number(item.expires_at) * 1000).toLocaleTimeString(interfaceLocale)) + '</small></span><em>' + esc(t("lifecycle.download")) + ' ↓</em></a>').join('');
  };
  requestExport?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    if (!account.providers?.email) return mountLifecycleXPortal("/api/account/export");
    const password = lifecyclePassword();
    if (!password) return toast(t("sessions.confirmPassword"));
    button.disabled = true;
    const result = await api("/api/account/export", { method: "POST", headers: { "Idempotency-Key": button.dataset.mutationKey }, body: { current_password: password } }).catch(() => null);
    if (!button.isConnected || state.persona !== selectedPersona) return;
    button.disabled = false;
    const downloadUrl = String(result?.export?.download_url || "");
    if (!result?.ok || Number(result.owner_id) !== Number(state.user.id) || result.secrets_excluded !== true
      || !accountExportPathPattern.test(downloadUrl)) return toast(t("lifecycle.exportFailed"));
    await loadAccountLifecycle();
    if (button.isConnected) location.assign(downloadUrl);
  });
  requestDeletion?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    const confirmation = deletionConfirmation?.value || "";
    const acknowledge = Boolean(deletionAcknowledge?.checked);
    if (confirmation !== "DELETE NEXUS" || !acknowledge) return toast(t("lifecycle.completeConfirmations"));
    if (!window.confirm(t("lifecycle.scheduleConfirm"))) return;
    if (!account.providers?.email) return mountLifecycleXPortal("/api/account/deletion-request", { confirmation, acknowledge_onchain: true });
    const password = lifecyclePassword();
    if (!password) return toast(t("sessions.confirmPassword"));
    button.disabled = true;
    const result = await api("/api/account/deletion-request", { method: "POST", headers: { "Idempotency-Key": button.dataset.mutationKey }, body: { current_password: password, confirmation, acknowledge_onchain: true } }).catch(() => null);
    if (!button.isConnected || state.persona !== selectedPersona) return;
    button.disabled = false;
    const validDeletion = result?.ok && Number(result.owner_id) === Number(state.user.id)
      && Number.isSafeInteger(Number(result.deletion?.id)) && Number(result.deletion.id) > 0
      && result.deletion?.state === "requested" && Number.isSafeInteger(Number(result.deletion?.execute_after))
      && Number(result.deletion.execute_after) > 0 && result.deletion?.grace_days === 30
      && result.deletion?.cancellable === true && result.onchain_data_erasable === false;
    if (!validDeletion) return toast(t("lifecycle.scheduleFailed"));
    toast(t("lifecycle.scheduledToast"));
    await loadAccountLifecycle();
  });
  cancelDeletion?.addEventListener("click", async () => {
    if (cancelDeletion.disabled) return;
    if (!account.providers?.email) return mountLifecycleXPortal("/api/account/deletion-cancel");
    const password = lifecyclePassword();
    if (!password) return toast(t("sessions.confirmPassword"));
    cancelDeletion.disabled = true;
    const result = await api("/api/account/deletion-cancel", { method: "POST", headers: { "Idempotency-Key": cancelDeletion.dataset.mutationKey }, body: { current_password: password } }).catch(() => null);
    if (!cancelDeletion.isConnected || state.persona !== selectedPersona) return;
    cancelDeletion.disabled = false;
    if (!result?.ok || Number(result.owner_id) !== Number(state.user.id) || result.cancelled !== true
      || !Number.isSafeInteger(Number(result.request_id)) || Number(result.request_id) <= 0) return toast(t("lifecycle.cancelFailed"));
    toast(t("lifecycle.cancelled"));
    await loadAccountLifecycle();
  });
  loadAccountLifecycle();
  document.getElementById("sign-out").addEventListener("click", async () => {
    await endCurrentCall(true);
    const result = await api("/auth/logout", { method: "POST" }).catch(() => null);
    if (!result?.ok) return toast(t("security.logoutAllFailed"));
    await clearCurrentUserDeviceCache();
    location.reload();
  });

  document.getElementById("link-xportal").addEventListener("click", () => {
    const area = document.getElementById("link-wallet-area");
    const needsPassword = Boolean(u.email);
    area.innerHTML = [
      needsPassword ? '<div class="field"><label>' + esc(t("security.linkPassword")) + '</label><input id="link-current-password" type="password" autocomplete="current-password" value="" /></div>' : '',
      '<button class="btn small" id="start-link-xportal" type="button">' + esc(t("security.continueLink")) + '</button>',
      '<p class="mvx-hint" id="mvx-wc-status" role="status" aria-live="polite">' + esc(t("security.linkPreparing")) + '</p>',
      '<div id="mvx-wc-qr" class="wc-qr" role="img" aria-label="' + esc(t("security.linkQr")) + '"></div>',
      '<div id="mvx-wc-link" class="wc-link"></div>',
    ].join("");
    document.getElementById("start-link-xportal").addEventListener("click", () => {
      const currentPassword = document.getElementById("link-current-password")?.value || "";
      xPortalFlow({ endpoint: "/auth/mvx/link", extra: { current_password: currentPassword } });
    });
  });

  const profileForm = document.getElementById("profile-form");
  profileForm.addEventListener("input", () => { profileForm.dataset.profileKey = newUploadMutationKey("profile-save"); });
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const output = document.getElementById("profile-save-status");
    if (submit.disabled) return;
    const submissionKey = form.dataset.profileKey;
    const fd = new FormData(form);
    const profileKind = String(fd.get("profile_kind") || "");
    const visibility = String(fd.get("visibility") || "");
    const discoverability = String(fd.get("discoverability") || "");
    const messagePolicy = String(fd.get("message_policy") || "");
    const interfaceLocale = String(fd.get("interface_locale") || "auto");
    const contentLanguages = [...new Set(String(fd.get("content_languages") || "").split(",").map((item) => item.trim()).filter(Boolean))];
    const regionCode = String(fd.get("region_code") || "").trim().toUpperCase();
    // The city the band prints and the date it derives the age from: the picker writes the one, the calendar
    // writes the other, and an empty date is a choice that clears it instead of a validation error.
    const location = String(fd.get("location") || "").trim();
    const birthRaw = String(fd.get("birth_date") ?? "").trim();
    const birth = birthRaw === "" ? null : birthRaw;
    const nearEnabled = fd.get("near_enabled") === "on";
    const privateAccessEnabled = fd.get("private_access_enabled") === "on";
    const privateAccessPrice = Number(fd.get("private_access_price"));
    const privateAccessPriceCents = Math.round(privateAccessPrice * 100);
    const privateAccessMonthPriceCents = Math.round(Number(fd.get("private_access_month_price")) * 100);
    const privateAccessForeverPriceCents = Math.round(Number(fd.get("private_access_forever_price")) * 100);
    const privateAccessCurrency = String(fd.get("private_access_currency") || "");
    const privateAccessDays = Number(fd.get("private_access_days"));
    const languagePattern = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
    if (!new Set(["personal", "creator", "business"]).has(profileKind)) return output.textContent = t("profileEdit.invalidKind");
    if (!new Set(["public", "followers", "friends", "private"]).has(visibility)) return output.textContent = t("profileEdit.invalidVisibility");
    if (!new Set(["public", "hidden"]).has(discoverability)) return output.textContent = t("profileEdit.invalidDiscoverability");
    if (!new Set(["everyone", "requests", "followers", "nobody"]).has(messagePolicy)) return output.textContent = t("profileEdit.invalidMessagePolicy");
    if (!new Set(["auto", "ro", "en", "pl", "ar"]).has(interfaceLocale)) return output.textContent = t("profileEdit.invalidLocale");
    if (contentLanguages.length > 10 || contentLanguages.some((item) => !languagePattern.test(item))) return output.textContent = t("profileEdit.invalidLanguages");
    if (regionCode && !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(regionCode)) return output.textContent = t("profileEdit.invalidRegion");
    if (nearEnabled && !regionCode) return output.textContent = t("profileEdit.nearNeedsRegion");
    if (location.length > 80) return output.textContent = t("profileEdit.invalidCity");
    if (birth !== null && !profileAgeFromBirthDate(birth)) return output.textContent = t("profileEdit.birthOutOfRange");
    if (!Number.isFinite(privateAccessPrice) || privateAccessPriceCents < 100 || privateAccessPriceCents > 1000000) return output.textContent = t("profileEdit.invalidPrivatePrice");
    if (!Number.isInteger(privateAccessMonthPriceCents) || privateAccessMonthPriceCents < 100 || privateAccessMonthPriceCents > 100000000) return output.textContent = t("profileEdit.invalidPrivatePrice");
    if (!Number.isInteger(privateAccessForeverPriceCents) || privateAccessForeverPriceCents < 100 || privateAccessForeverPriceCents > 1000000000) return output.textContent = t("profileEdit.invalidPrivatePrice");
    if (!new Set(["USD", "EUR", "USDC", "USDT", "EGLD"]).has(privateAccessCurrency)) return output.textContent = t("profileEdit.invalidPrivateCurrency");
    if (!Number.isInteger(privateAccessDays) || privateAccessDays < 1 || privateAccessDays > 365) return output.textContent = t("profileEdit.invalidPrivateDays");
    // The day and the number the old field wrote travel together: when the date field changed, the number is
    // cleared with it, so a profile shows the age the day stands for or no age at all. The field only speaks
    // when it changed, so saving this form for some other setting cannot clear a day nobody touched.
    const record = activePersonaRecord();
    const previousBirth = typeof record?.birth_date === "string" ? record.birth_date : null;
    const birthChanged = String(birth ?? "") !== String(previousBirth ?? "");
    const profileControls = [...form.querySelectorAll("input,select,textarea,button")];
    const releaseProfileForm = () => profileControls.forEach((control) => { control.disabled = false; });
    profileControls.forEach((control) => { control.disabled = true; });
    output.textContent = t("profileEdit.saving");
    const result = await api("/api/persona/" + selectedPersona, { method: "PATCH", headers: { "Idempotency-Key": submissionKey }, body: {
      visibility, discoverability, profile_kind: profileKind,
      message_policy: messagePolicy, interface_locale: interfaceLocale,
      content_languages: contentLanguages, region_code: regionCode, near_enabled: nearEnabled,
      location, ...(birthChanged ? { birth_date: birth, age: null } : {}),
      private_access: { enabled: privateAccessEnabled, price_cents: privateAccessPriceCents, month_price_cents: privateAccessMonthPriceCents, forever_price_cents: privateAccessForeverPriceCents, currency: privateAccessCurrency, duration_days: privateAccessDays },
    } }).catch(() => null);
    if (!form.isConnected || state.persona !== selectedPersona) return;
    if (!result?.ok || form.dataset.profileKey !== submissionKey
      || Number(result.owner_id) !== Number(state.user.id) || result.requested_persona !== selectedPersona
      || !result.persona || Number(result.persona.user_id) !== Number(state.user.id)
      || result.persona.persona !== selectedPersona
      || result.persona.visibility !== visibility
      || result.persona.discoverability !== discoverability
      || result.persona.message_policy !== messagePolicy
      || result.persona.interface_locale !== interfaceLocale
      || Boolean(result.persona.near_enabled) !== nearEnabled
      || String(result.persona.region_code || "") !== regionCode
      || String(result.persona.location || "") !== location
      || String(result.persona.birth_date || "") !== String(birth || "")
      || (birthChanged && result.persona.age !== null)) {
      releaseProfileForm();
      output.textContent = t("profileEdit.saveFailed");
      return;
    }
    state.profiles = state.profiles.map((profile) => profile?.persona === selectedPersona ? result.persona : profile);
    syncInterfaceLocale(); renderHeader(); renderNav(); toast(t("profile.saved")); renderProfiles(vp);
  });
  const dev = await api("/api/devnet");
  const dl = document.getElementById("devnet-list");
  if (dev.ok && dev.actions.length) dl.innerHTML = dev.actions.map((a) => '<a class="devnet-badge" href="' + esc(a.explorer_url) + '" target="_blank" rel="noopener">◈ ' + esc(a.action) + ' · ' + esc(a.tx_hash.slice(0, 10)) + '…</a><br/>').join("");
  else dl.innerHTML = '<p class="screenSub">Nicio acțiune încă.</p>';
}

function renderProfilePreview(result) {
  const host = document.getElementById("profile-preview");
  // The panels belong to the screen this preview is rendered into, so the switch is the hook
  // `renderProfiles` sets: the hero asks for a panel, it never owns the navigation.
  const selectProfileSection = (id) => profileSectionSwitcher?.(id);
  renderOwnerProfileExperience(host, result, { esc, safeUrl: safeInternalMediaUrl, t, bioMarkup: (text) => profileBioMarkup(text, esc), locale: interfaceLocale,
    controls: (post) => profileWhisperControls(post),
    visibilityLabel: (visibility) => t(visibilityLabelKey(visibility)),
    onRendered: (renderedHost, renderedPosts) => { wirePostActions(renderedHost, renderedPosts); profileHeroEditor.bindHeroInlineEdit(renderedHost); profileHeroEditor.bindHeroLocation(renderedHost); },
    onStory: (index, stories) => openStoryViewer(index, stories),
    onSettings: () => selectProfileSection("access"),
    // The lock beside the name is the setting behind it: the press opens the panel that edits who can
    // read this profile, instead of leaving the person to hunt for it in the drawer.
    onVisibility: () => selectProfileSection("privacy"),
   // The avatar opens the active story when there is one, otherwise the profile photo alone;
   // the rail shows saved-story albums instead of a "new story" tile.
   onAvatarPhoto: (url, name) => openProfilePhoto(url, name),
   albums: Array.isArray(result.profile?.highlights) ? result.profile.highlights : [],
    // The content tabs live inside the hero: when a settings panel replaced the hero,
    // selecting a tab must bring the hero back instead of updating a hidden grid.
    onContentTab: () => { if (host.hidden) selectProfileSection("profile"); },
    // A whisper conversation belongs to the tab that opened it: leaving the tab closes it
    // instead of leaving the screen in comments mode behind an empty list.
    onTabLeave: () => document.querySelectorAll("#profile-preview .clipCommentsDrawer:not(.hidden)").forEach((drawer) => closeCommentsDrawer(drawer)),
    onOpenPost: (id, posts) => { const media = posts.filter((post) => post.media && safeInternalMediaUrl("/media/" + post.media.hash + "." + post.media.ext)); const index = media.findIndex((post) => Number(post.id) === id); if (index >= 0) openMediaViewer(media, index); },
    // A shared reply opens the reply itself, inside the conversation it came from.
    onOpenReply: (commentId) => { void openReplyDeepLink(commentId); },
    // Pinning is a write of its own, so it does not travel through the hero editor: the profile says what
    // happened, the server decides whether a fourth pin fits, and the page is drawn again from the record.
    onPinPost: async (postId, pinned) => {
      const result = await api("/api/posts/" + Number(postId) + "/pin", {
        method: "POST", headers: { "Idempotency-Key": newUploadMutationKey("post-pin") }, body: { pinned },
      }).catch(() => null);
      if (!result?.ok) {
        // The button was disabled for the press: on a refusal nothing on the profile changed, so all that is
        // owed is the sentence that says why.
        toast(t(result?.code === "PIN_LIMIT" ? "profile.pinLimit" : "profile.pinFailed"));
        return;
      }
      toast(t(pinned ? "profile.pinnedSaved" : "profile.unpinnedSaved"));
      profileScreenRefresher?.();
    },
    // The bar of tabs is the owner's own: moving one tab writes the order for this profile, and the bar the
    // owner sees is then the bar the server keeps. A refused write puts the saved order back on the screen.
    onTabsOrder: async (order) => {
      const result = await api("/api/persona/" + encodeURIComponent(state.persona), {
        method: "PATCH", headers: { "Idempotency-Key": newUploadMutationKey("tabs-order") }, body: { tabs_order: order },
      }).catch(() => null);
      toast(t(result?.ok ? "profile.tabsOrderSaved" : "profile.tabsOrderFailed"));
      if (!result?.ok) profileScreenRefresher?.();
    },
  });
}

function renderAssetList(account) {
  const list = document.getElementById("asset-list");
  if (!list) return;
  if (!account?.ok || account.portfolio_status === "unavailable") {
    list.innerHTML = '<p class="empty-assets">' + esc(t("wallet.balanceUnavailable")) + '</p>';
    return;
  }
  const assets = Array.isArray(account.assets) ? account.assets.filter((asset) => asset && typeof asset === "object"
    && /^[A-Z0-9-]{1,32}$/.test(String(asset.symbol || ""))
    && /^\d+(?:\.\d+)?$/.test(String(asset.amount || ""))
    && Number(asset.amount) > 0).slice(0, 100) : [];
  if (!assets.length) {
    list.innerHTML = '<p class="empty-assets">' + esc(t("wallet.noPositiveAssets")) + '</p>';
    return;
  }
  list.innerHTML = '<div class="asset-list">' + assets.map((asset) => '<div><i>' + esc(String(asset.symbol).slice(0, 2)) + '</i><span><b>' + esc(asset.symbol) + '</b><small>' + esc(String(asset.name || asset.symbol).slice(0, 80)) + (asset.verified === true ? " · " + esc(t("wallet.verified")) : " · ESDT") + '</small></span><strong>' + esc(asset.amount) + '</strong></div>').join("") + '</div>';
}

function renderTopupSheet(address, account) {
  const host = document.getElementById("account-sheet");
  if (!host || !/^erd1[a-z0-9]{58}$/.test(String(address || ""))) return;
  host.innerHTML = '<div class="sheet-backdrop" id="close-topup"><section class="account-modal" role="dialog" aria-modal="true" aria-labelledby="topup-title"><button class="sheet-close" id="topup-x" type="button" aria-label="' + esc(t("common.close")) + '">×</button><small>' + esc(t("wallet.topUpLabel")) + '</small><h3 id="topup-title">' + esc(t("wallet.receive")) + '</h3><p>' + esc(t("wallet.receiveTruth")) + ' <b>' + esc(String(account.network || "MultiversX")) + '</b>.</p><button class="address-row" id="topup-copy" type="button"><span>' + esc(address) + '</span><b>' + esc(t("common.copy")) + '</b></button><div class="funding-options"><button type="button" id="fund-crypto"><b>' + esc(t("wallet.cryptoTransfer")) + '</b><small>' + esc(t("wallet.cryptoAvailable")) + '</small></button><button type="button" disabled><b>' + esc(t("wallet.cardTransfer")) + '</b><small>' + esc(t("wallet.onRampGated")) + '</small></button></div><p class="gas-note">' + esc(t("wallet.wrongChainWarning")) + '</p></section></div>';
  const close = () => { host.innerHTML = ""; };
  document.getElementById("topup-x").addEventListener("click", close);
  document.getElementById("close-topup").addEventListener("click", (e) => { if (e.target.id === "close-topup") close(); });
  document.getElementById("topup-copy").addEventListener("click", () => copyText(address, t("wallet.addressCopied")));
  document.getElementById("fund-crypto").addEventListener("click", () => copyText(address, t("wallet.addressCopied")));
}

async function copyText(value, message) {
  let copied = false;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    try { area.select(); copied = document.execCommand("copy") === true; }
    catch { copied = false; }
    finally { area.remove(); }
  }
  toast(copied ? message : t("common.copyFailed"));
  return copied;
}

async function switchPersona(persona) {
  stopLiveMedia();
  stopComposerCamera();
  resetSocialImpressionSession();
  socialSearchLoadGate.invalidate();
  socialFeedLoadGate.invalidate();
  socialFriendsLoadGate.invalidate();
  storyLoadGate.invalidate();
  threadLoadGate.invalidate();
  revokeDecryptedAttachmentUrls();
  activeConversationId = null;
  await endCurrentCall(true);
  const r = await api("/api/persona/switch", { method: "POST", body: { persona } });
  if (r.ok) {
    state.persona = persona;
    activeSlot = "primary";
    activeModule = persona === "social" ? "clips" : persona === "travel" ? "stay" : persona;
    if (persona === "social") { socialTopView = "mix"; socialLens = "for-you"; socialFormat = "clips"; feedMode = "reels"; reelsLensFeed = "for-you"; }
    syncInterfaceLocale(); connectStream(); toast("Profil activ: " + persona); renderShell(); renderView();
    startPresenceHeartbeat();
  }
}

// ---------- simple module screens ----------
function renderPay(vp) {
  return renderM12PayWorkspace(vp, { api, toast, state });
}
function renderPrive(vp) {
  return renderPriveGate(vp, { api, toast, state });
}
function renderDating(vp) {
  return renderDatingWorkspace(vp, { api, toast, state, openConversation: (conversationId) => { if (!Number.isSafeInteger(conversationId) || conversationId < 1) return; activeConversationId = conversationId; activeModule = "chat"; activeSlot = "inbox"; renderView(); renderNav(); } });
}
function renderWork(vp) { renderWorkWorkspace(vp, { api, toast, state }); }
function renderStay(vp) { return renderStayWorkspace(vp, { api, toast, state }); }
function renderRide(vp) { return renderRideWorkspace(vp, { api, toast, state }); }
function renderWatch(vp) { return renderWatchWorkspace(vp, { api, toast, state, uploadMedia: uploadMediaResumable }); }
function renderKids(vp) {
  return renderWatchWorkspace(vp, { api, toast, state, uploadMedia: uploadMediaResumable }, "family");
}
function renderMusic(vp) { return renderMusicWorkspace(vp, { api, toast, state, uploadMedia: uploadMediaResumable }); }
function renderGrow(vp) { return renderGrowWorkspace(vp, { api, toast, state }); }
function renderCreator(vp) { return renderM12CreatorWorkspace(vp, { api, toast, state }); }
function renderNode(vp) { return renderM12NodeWorkspace(vp, { api, toast, state }); }

function renderGenericModule(vp, m) {
  renderGenericScreen(vp, m[2], m[5], m[6]);
}

function renderGenericScreen(vp, title, tag, features) {
  vp.innerHTML = [
    '<div class="screen genericScreen">',
    '<div class="genericHead"><div class="genericOrb"><span>◇</span><i></i><b></b></div><span><small>LOCAL · REAL</small><h2>' + esc(title) + '</h2><p>' + esc(tag) + '</p></span></div>',
    '<div class="featureStack">' + features.map((f, i) => '<button data-f="' + i + '"><i>' + String(i + 1).padStart(2, "0") + '</i><span>' + esc(f) + '</span><em>›</em></button>').join("") + '</div>',
    '<button class="moduleAction" id="genAction">Continuă · verifică proof pe devnet</button>',
    '</div>',
  ].join("");
  document.getElementById("genAction").addEventListener("click", async () => {
    const r = await api("/api/actions", { method: "POST", body: { action: title.toLowerCase(), label: title } });
    if (r.ok) toast("Devnet: " + r.devnet.txHash.slice(0, 10) + "…");
  });
}

function renderDevnet() {
  const vp = document.getElementById("screenViewport");
  vp.innerHTML = '<div class="screen scrollScreen"><h2>Acțiuni Devnet</h2><p class="screenSub">Dovezi persistente · MultiversX devnet</p><div id="devnet-list">Se încarcă…</div></div>';
  api("/api/devnet").then((dev) => {
    const dl = document.getElementById("devnet-list");
    if (dev.ok && dev.actions.length) dl.innerHTML = dev.actions.map((a) => '<a class="devnet-badge" href="' + esc(a.explorer_url) + '" target="_blank" rel="noopener">◈ ' + esc(a.action) + ' · ' + esc(a.tx_hash.slice(0, 10)) + '…</a><br/>').join("");
    else dl.innerHTML = '<p class="screenSub">Nicio acțiune încă.</p>';
  });
}

function renderNotifications() {
  const vp = document.getElementById("screenViewport");
  vp.innerHTML = '<div class="screen scrollScreen"><h2>Notificări</h2><div id="notif-list">Se încarcă…</div></div>';
  api("/api/notifications").then((n) => {
    const box = document.getElementById("notif-list");
    if (n.ok && n.notifications.length) box.innerHTML = n.notifications.map((x) => '<div class="list-item"><div><b>' + esc(x.type) + '</b><br/><small>' + esc(x.body) + '</small></div></div>').join("");
    else box.innerHTML = '<p class="screenSub">Nicio notificare.</p>';
  });
}

function connectStream() {
  nexusEventStream?.close();
  const generation = ++nexusEventStreamGeneration;
  if (navigator.onLine === false) return;
  const viewerId = Number(state?.user?.id);
  const viewerPersona = state?.persona;
  if (!Number.isSafeInteger(viewerId) || viewerId <= 0 || !viewerPersona) return;
  const es = new EventSource("/api/stream");
  nexusEventStream = es;
  const isCurrent = () => nexusEventStream === es && nexusEventStreamGeneration === generation
    && Number(state?.user?.id) === viewerId && state?.persona === viewerPersona;
  const parsePayload = (event, maxLength = 4096) => {
    if (!isCurrent() || typeof event?.data !== "string" || event.data.length < 2 || event.data.length > maxLength) return null;
    try {
      const payload = JSON.parse(event.data);
      return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
    } catch { return null; }
  };
  const isRecipientBound = (payload) => Number(payload?.recipient_id) === viewerId && payload?.recipient_persona === viewerPersona;
  es.addEventListener("hello", (event) => {
    const payload = parsePayload(event);
    if (!payload?.ok || Number(payload.viewer_id) !== viewerId || payload.viewer_persona !== viewerPersona) {
      es.close();
      if (nexusEventStream === es) nexusEventStream = null;
      return;
    }
    refreshMessageBadge();
    refreshNotificationBadge();
  });
  es.addEventListener("post", () => { if (isCurrent() && (activeModule === "clips" || activeModule === "signal")) renderView(); });
  const invalidateSocialDiscovery = (event) => {
    const payload = parsePayload(event);
    const targetId = Number(payload?.target_id || payload?.request_id);
    if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
    socialSearchLoadGate.invalidate();
    socialFeedLoadGate.invalidate();
    socialFriendsLoadGate.invalidate();
    if (activeModule === "clips" || activeModule === "signal") renderView();
  };
  es.addEventListener("relationship-changed", invalidateSocialDiscovery);
  es.addEventListener("follow-changed", invalidateSocialDiscovery);
  es.addEventListener("follow-request-changed", invalidateSocialDiscovery);
  es.addEventListener("notification-changed", (event) => {
    const payload = parsePayload(event);
    const valid = Number(payload?.recipient_id) === viewerId
      && PROFILES.some((profile) => profile[0] === payload?.recipient_persona)
      && NOTIFICATION_TYPES.has(payload?.type)
      && new Set(["created", "grouped", "read", "read_all"]).has(payload?.action)
      && /^[A-Za-z0-9_-]{16}$/.test(String(payload?.change_id || ""))
      && (payload.notification_id == null || (Number.isSafeInteger(Number(payload.notification_id)) && Number(payload.notification_id) > 0))
      && Number.isSafeInteger(Number(payload.unread)) && Number(payload.unread) >= 0 && Number(payload.unread) <= 9999
      && Number.isSafeInteger(Number(payload.unread_non_message)) && Number(payload.unread_non_message) >= 0
      && Number(payload.unread_non_message) <= Number(payload.unread);
    if (!valid || seenNotificationChanges.has(payload.change_id)) return;
    seenNotificationChanges.add(payload.change_id);
    if (seenNotificationChanges.size > 512) seenNotificationChanges.delete(seenNotificationChanges.values().next().value);
    unreadActivityCount = Number(payload.unread_non_message);
    if (document.getElementById("phoneNav")) renderNav();
    if (activeModule === "chat" && inboxBox === "activity"
      && (inboxFilter === "all" || inboxFilter === payload.recipient_persona)) renderMessages(document.getElementById("screenViewport"));
  });
  es.addEventListener("message", (event) => {
    const payload = parsePayload(event);
    if (!isRecipientBound(payload) || !Number.isSafeInteger(Number(payload.conversation_id)) || Number(payload.conversation_id) <= 0
      || !Number.isSafeInteger(Number(payload.message_id)) || Number(payload.message_id) <= 0
      || !new Set(["plaintext_local", "e2ee_v1", "e2ee_group_v1"]).has(payload.encryption_mode)) return;
    if (!readConversationPreferences({ ownerId: viewerId, persona: viewerPersona, conversationId: Number(payload.conversation_id) }).muted) toast(t("messages.newMessage"));
    refreshMessageBadge();
    if (activeModule === "chat") renderView();
  });
  es.addEventListener("typing", (event) => {
    if (activeModule !== "chat" || !activeConversationId) return;
    const payload = parsePayload(event);
    if (!isRecipientBound(payload) || payload.actor_persona !== viewerPersona || typeof payload.active !== "boolean"
      || !Number.isSafeInteger(Number(payload.user_id)) || Number(payload.user_id) <= 0 || Number(payload.user_id) === viewerId) return;
    if (Number(payload.conversation_id) === activeConversationId) loadThread(activeConversationId);
  });
  es.addEventListener("call-invite", (event) => {
    const payload = parsePayload(event, 32 * 1024);
    if (isRecipientBound(payload) && payload.transport === "local_webrtc_p2p" && payload.secure_context_required === true) handleCallInvite(payload).catch(() => {});
  });
  es.addEventListener("call-state", (event) => {
    const payload = parsePayload(event, 32 * 1024);
    if (isRecipientBound(payload)) handleCallState(payload).catch(() => {});
  });
  es.addEventListener("call-signal", (event) => {
    const payload = parsePayload(event, 96 * 1024);
    if (isRecipientBound(payload)) handleCallSignal(payload).catch(() => {});
  });
}

init();
