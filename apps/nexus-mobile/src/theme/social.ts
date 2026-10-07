/**
 * Social shell values, extracted from the existing web stylesheets — not a new design system.
 *
 * Sources for every number below:
 *   apps/nexus-web/public/styles.css:21            .appNav / .appNav button / i / createNav
 *   apps/nexus-web/public/styles.css:59            .appNav button i svg
 *   apps/nexus-web/public/feed-surface.css:642-643 .appNav.social widths
 *   apps/nexus-web/public/feed-surface.css:1673-1689 Social shell (green; it wins over the 824-855
 *                                                  monochrome block, which `:has` specificity overrides)
 *   apps/nexus-web/public/styles.css:21            .navBadge unread pill
 *   apps/nexus-web/public/social-human-ux.css:69-81 wave 14h/14i bar geometry
 *   apps/nexus-web/public/feed-surface.css:16-80   .appHeader.feedHeader
 *   apps/nexus-web/public/feed-surface.css:130-137 .feedQuickDrawer / tiles
 *   apps/nexus-web/public/styles.css:8,29,31       .post
 *   apps/nexus-web/public/nav-marks.js             the seven marks
 * The screens consume these tokens; nothing re-derives a colour or a size locally.
 */
export const socialTokens = {
  colors: {
    /** `.phoneScreen:has(.appNav.social){background:#000}` */
    screen: '#000000',
    /** `.appNav.social:before` — the shared glass, green-black in the Social theme. */
    glassBorder: 'rgba(126,173,142,0.2)',
    glassFillTop: 'rgba(12,19,15,0.97)',
    glassFillBottom: 'rgba(2,7,4,0.99)',
    glassHighlight: 'rgba(175,211,187,0.07)',
    markBorder: 'rgba(255,255,255,0.12)',
    markBackground: 'rgba(5,11,7,0.7)',
    markActiveBorder: 'rgba(159,197,171,0.34)',
    markActiveBackground: 'rgba(12,24,16,0.88)',
    markActiveShadow: 'rgba(75,135,95,0.11)',
    /** `.navBadge` — the unread count printed over the disc of the mark that owns it. */
    navBadgeSurface: '#f14359',
    navBadgeInk: '#ffffff',
    navBadgeRing: '#071019',
    createBorder: 'rgba(255,255,255,0.46)',
    createInk: '#050608',
    createShadow: 'rgba(255,255,255,0.18)',
    white: '#ffffff',
    drawerBorder: 'rgba(255,255,255,0.28)',
    drawerSurface: '#050608',
    tileBorder: 'rgba(255,255,255,0.22)',
    tileSurface: '#0b0c0e',
    postBorder: '#22313c',
    postSurface: '#0b151e',
    cardSurface: '#071019',
    cardSurface2: '#0b1720',
    /** `.appHeader:not(.feedHeader)` — plain black with a 1px line (feed-surface.css:1181-1186). */
    appHeaderSurface: '#000000',
    appHeaderLine: 'rgba(255,255,255,0.12)',
    /** Whispers and News print the header on `rgba(1,5,3,.96)` closed by `--nexus-green-line`. */
    feedHeaderSurface: 'rgba(1,5,3,0.96)',
    greenLine: 'rgba(112,164,130,0.16)',
    /** The wordmark of the feed is the quiet violet of Reels; every other screen paints it white. */
    wordmarkReels: '#baa8dc',
    /** `.headerSwitches .modeBadge` in the Social theme. */
    badgeSurface: '#08090b',
    badgeBorder: 'rgba(255,255,255,0.22)',
    badgeInk: 'rgb(238,248,251)',
    muted: '#96a2ad',
    text: '#f5f8fa',
  },
  nav: {
    /** --nav-h:60px; padding 4px 7px max(6px, safe-area-bottom); padding-inline 8px (4px under 380px) */
    height: 60,
    paddingTop: 4,
    paddingBottomMin: 6,
    paddingInline: 8,
    paddingInlineNarrow: 4,
    gap: 1,
    /** `.appNav.social` carries no top border; the bar itself is the gradient (feed-surface.css:1673-1677). */
    fill: [
      { offset: 0, color: 'rgba(3,8,5,0.25)' },
      { offset: 0.52, color: 'rgba(2,7,4,0.97)' },
      { offset: 1, color: '#010302' },
    ],
    shadow: 'rgba(20,64,39,0.11)',
    shadowRadius: 28,
    shadowOffsetY: -10,
    /** `.appNav:before` — the shared glass the seven marks sit in. */
    glass: {
      insetInline: 6,
      top: 4,
      height: 50,
      radius: 26,
      borderWidth: 1,
      shadow: 'rgba(13,49,29,0.16)',
      shadowRadius: 24,
      shadowOffsetY: -8,
    },
    /**
     * `.appNav button` — the seven marks share the row by weight: 63.15px each and 68px for the create
     * circle, which is the width the web gives them (x = 8/72/136/200/269/334/398 at 469px).
     * `.appNav.social>button{max-width:64px}` (feed-surface.css:643) puts a ceiling on that row, and the
     * ceiling is written on the six drawn marks: the create cell keeps the wider share the bar was built
     * around, because the 52px circle is centred in it rather than stretched to it.
     */
    mark: { height: 50, widthShare: 63.15, createWidthShare: 68, maxWidth: 64, paddingVertical: 5, paddingHorizontal: 2, radius: 24, pressedScale: 0.95 },
    /**
     * `.appNav.social button i` — a 32px disc, round, green-black when it is the open place. The web sets a
     * `border-color` on it but never a width, so the captured disc draws no ring (`borderWidth: 0`).
     */
    disc: { size: 32, radius: 16, borderWidth: 0, glyphSize: 20 },
    /** `.appNav button i svg` */
    icon: { size: 25, strokeWidth: 1.7 },
    /** `.appNav.social .createNav i` — 52px, lifted 8px, the circle the bar was built around. */
    create: { size: 52, radius: 26, borderWidth: 4, glyphSize: 27, glyphWeight: '300' as const, lift: 8 },
    /**
     * `.navBadge` (styles.css:21) — the red pill the web prints over the disc of a mark that owns unread
     * work, moved to the top-right corner of that disc by `.appNav .navBadge{right:-5px;top:0}`.
     */
    badge: {
      minWidth: 19,
      height: 19,
      paddingInline: 5,
      radius: 10,
      borderWidth: 2,
      fontSize: 8,
      offsetRight: -5,
      offsetTop: 0,
      /** The web prints `Math.min(unread, 99)` in the pill and the raw sum in the label. */
      maxCount: 99,
    },
  },
  /**
   * `.appHeader.feedHeader` — the bar the three readings share (feed-surface.css:16-80, 96-97,
   * 1007-1012, 1215, 1230). Height 72, wordmark 80 wide, one 38×40 pill column, one 42px door.
   */
  feedHeader: {
    height: 72,
    paddingTop: 10,
    paddingBottom: 9,
    paddingInline: 12,
    gap: 6,
    wordmarkWidth: 80,
    /** The reading's own glass: Reels floats over the clip, Whispers and News sit on green-black. */
    fillReels: [
      { offset: 0, color: 'rgba(2,6,12,0.62)' },
      { offset: 1, color: 'rgba(2,6,12,0)' },
    ],
    /** `.feedModes` — the 42px grid column is 38px wide and vertically centred. */
    modePill: { width: 38, height: 40 },
    /** `.feedModes button i` — one 28px disc with a faint edge, whichever reading is open. */
    glyph: { size: 28, radius: 14, borderWidth: 1, fontSize: 12, lineHeight: 14, borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.035)' },
    /**
     * The disc of the open reading. Reels shrinks its glyph to 17px and lights it violet
     * (feed-surface.css:1748-1761); Whispers answers in green, News in grey (1843-1900).
     */
    glyphActive: {
      reels: { size: 17, radius: 8.5, fontSize: 13, lineHeight: 15, borderColor: 'rgba(233,224,255,0.68)', background: '#9b3cff', backgroundEnd: '#642be0', glow: 'rgba(140,52,255,0.38)' },
      whispers: { size: 28, radius: 14, fontSize: 12, lineHeight: 14, borderColor: 'rgba(132,188,151,0.32)', background: 'rgba(66,134,88,0.13)', backgroundEnd: '', glow: '' },
      news: { size: 28, radius: 14, fontSize: 12, lineHeight: 14, borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.055)', backgroundEnd: '', glow: '' },
    },
    /** `.feedHeaderIcon` — the one door of the feed bar. */
    iconButton: { size: 42, radius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(3,4,7,0.78)', iconSize: 23, strokeWidth: 1.7 },
    iconGap: 5,
  },
  /**
   * `.appHeader:not(.feedHeader)` — every Social screen that is not the feed. Two columns of 124px and
   * the rest, and the three switches of the header (social-human-ux.css:23-26, feed-surface.css:1181-1211).
   */
  appHeader: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 8,
    paddingInline: 10,
    gap: 8,
    wordmarkWidth: 124,
    switchesGap: 3,
    /** `.headerSwitches .modeBadge` — one pill per switch, 44px tall, radius 17. */
    badge: { height: 44, radius: 17, paddingInline: 6, gap: 3, borderWidth: 1, fontSize: 11, letterSpacing: -0.11 },
  },
  /** `.wordmarkBuild` — the build number pinned to the bottom-left corner of the wordmark. */
  wordmarkBadge: {
    fontSize: 9,
    /** The web sets `line-height:9px`; with the 1px padding and 1px ring that is the 13px badge it prints. */
    lineHeight: 9,
    paddingHorizontal: 4,
    paddingVertical: 1,
    radius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    background: 'rgba(11,26,34,0.85)',
    offsetBottom: 1,
  },
  drawer: {
    top: 62,
    right: 10,
    gap: 9,
    paddingTop: 14,
    paddingInline: 10,
    paddingBottom: 10,
    radius: 17,
    borderWidth: 1,
    gridColumns: 3,
    tileSize: 40,
    tileGap: 8,
    tileRadius: 13,
    tileGlyphSize: 14,
  },
  post: {
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    radius: 14,
    narrowMarginBottom: 8,
  },
  /** FEED_MODES → API contract, copied from feed-surface.js; titles are the keys the web prints. */
  feedModes: [
    { id: 'reels', glyph: '▶', title: 'Reels', format: 'clips', lens: null },
    { id: 'whispers', glyph: '❝', title: 'Șoapte', format: 'tweets', lens: 'for-you' },
    { id: 'news', glyph: '▤', title: 'Știri', format: 'posts', lens: 'breaking' },
  ],
} as const;

/** The five profiles of the account, as the rail and the drawer already print them. */
export const profileModules = [
  { id: 'social', title: 'Social', glyph: 'SK', color: '#9a61ff' },
  { id: 'work', title: 'Work', glyph: 'WK', color: '#2fb7ff' },
  { id: 'dating', title: 'Dating', glyph: '♥', color: '#ff4f7d' },
  { id: 'travel', title: 'Travel', glyph: '✈', color: '#32d6d0' },
  { id: 'market', title: 'Market', glyph: '◇', color: '#ffb94e' },
] as const;

/** The drawer prints ▶ for Social and ▣ for Work instead of their initials. */
export const drawerMarks: Record<string, string> = { social: '▶', work: '▣' };
