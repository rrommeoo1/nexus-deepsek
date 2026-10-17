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
  /** Final Reels cascade: feed-surface.css .clipStage:before and the immersive rail. */
  reels: {
    veil: [
      { offset: '0%', color: 'rgba(0,0,0,0.34)' },
      { offset: '23%', color: 'rgba(0,0,0,0)' },
      { offset: '64%', color: 'rgba(0,0,0,0)' },
      { offset: '100%', color: 'rgba(0,0,0,0.52)' },
    ],
    railIconSize: 29,
    viewer: { commentsMediaFraction: 0.34, railRight: 12, railBottom: 100, creatorBottom: 106 },
  },
  /** Final compact comment cascade: feed-surface.css:3182-3240, 3032-3036, 2533-2538. */
  comments: {
    surface: '#0b0d10',
      listPaddingHorizontal: 12,
    listPaddingTop: 5,
    listPaddingBottom: 8,
    threadMaxWidth: 480,
    threadGap: 4,
    rowMinHeight: 64,
    rowMarginBottom: 4,
    rowPaddingVertical: 5,
    rowPaddingHorizontal: 8,
    rowRadius: 10,
    rowBorder: 'rgba(255,255,255,0.08)',
    rowBackgroundTop: '#171a1f',
    rowBackgroundBottom: '#111318',
    replyBackgroundTop: '#14171b',
    replyBackgroundBottom: '#0f1114',
    replyBorder: 'rgba(255,255,255,0.065)',
    indentStep: 10,
    maxIndent: 3,
    threadLine: 'rgba(255,255,255,0.12)',
    avatarSize: 36,
    avatarBackground: '#121418',
    columnGap: 7,
    headerHeight: 16,
    nameSize: 12,
    handleSize: 10,
    timeSize: 9,
    bodySize: 12,
    bodyLineHeight: 16,
    bodyColor: '#f1f2f3',
      actionHeight: 44,
      actionIconSize: 20,
      actionCounterSize: 11,
    actionMuted: '#8b9197',
    toggleHeight: 25,
    toggleColor: '#aeb4ba',
    composerInputHeight: 42,
    composerInputRadius: 23,
    composerInputBackground: '#141414',
    composerInputBorder: 'rgba(255,255,255,0.15)',
    composerInputFontSize: 15,
    composerSendBackground: '#ffffff',
    composerSendInk: '#050505',
  },
  /** FEED_MODES → API contract, copied from feed-surface.js; titles are the keys the web prints. */
  feedModes: [
    { id: 'reels', glyph: '▶', title: 'Reels', format: 'clips', lens: null },
    { id: 'whispers', glyph: '❝', title: 'Șoapte', format: 'tweets', lens: 'for-you' },
    { id: 'news', glyph: '▤', title: 'Știri', format: 'posts', lens: 'breaking' },
  ],
  /**
   * `profile-experience.css:178-197` — the band above the content tabs, the app's one moving part.
   * Two tracks of readings (`.ownerTickerTrack`), 22px of fade at each edge because the `.ownerTicker`
   * carries `mask-image`, one hairline between the rows, and four of the readings are doors: a 40px
   * target that turns cyan under the finger (`.ownerTickerAction`). Every value is the stylesheet's.
   */
  ticker: {
    /** The band's own surface: `rgba(8,16,23,.72)` over the hero, which is black. */
    surface: 'rgba(8,16,23,0.72)',
    /** What that surface resolves to over black — the native stand-in for the 22px mask (see the band). */
    fadeInk: '#060c11',
    border: 'rgba(32,45,53,0.85)',
    rowBorder: 'rgba(32,45,53,0.55)',
    ink: '#cfe0e4',
    countInk: '#eef8fb',
    labelInk: '#93a5ae',
    doorInk: '#7ff0e6',
    dot: '#2fbdb3',
    dotOpacity: 0.75,
    fade: 22,
    itemPaddingBlock: 9,
    itemPaddingInlineEnd: 14,
    minTarget: 40,
    sepSize: 3,
    sepMarginEnd: 11,
    iconMarginEnd: 6,
    iconSize: 11,
    fontSize: 12.5,
    countGap: 4,
    labelSize: 11.5,
    lineHeight: 1.3,
    /**
     * The floor of one reading. `.ownerTickerAction{min-width:40px;min-height:40px}` gives it to the
     * readings that are doors; the phone gives it to every reading, so both rows always measure the same
     * and every reading's vertical centre is the band's centre - the one line height the product asked for.
     */
    readingHeight: 40,
    /** `.ownerBio a{color:#67f5ed;text-decoration:underline}` — a link in the words the band carries. */
    linkInk: '#67f5ed',
    /**
     * `.ownerTickerRow{display:flex;align-items:center;gap:6px}` with the pencil's own
     * `.ownerHeroActions{flex:0 0 auto;padding-right:10px}`. The row adds no inset of its own - the hero's
     * own 14px is what the stylesheet's `padding-left:14px` gives it - and the button keeps the same 14px
     * from the right edge, so the band is inset the same amount on both sides. The button is a sibling of
     * the band, never a passenger inside it, so it can neither cover a reading nor take its place.
     */
    rowGap: 6,
    /** `.ownerHeroActions .heroIconButton{position:relative;width:44px;height:44px;border-radius:13px}`. */
    editSize: 44,
    editRadius: 13,
    editInk: '#8fc9c6',
    /** `.ownerHeroActions .heroIconButton:hover,.ownerHeroActions .heroIconButton:focus-visible` */
    editBorderOn: '#2fbdb3',
    editSurfaceOn: '#0d1a22',
    editInkOn: '#dff9f6',
  },
  /**
   * `profile-experience.css:210-215`, `:303-307`, `:344-363` — the name line of the hero, and the one
   * button that closes it. The line is a row: the presence dot (`.ownerPresence`), the name, the sign of
   * who may read the profile (`.ownerVisibility`), and then the three bars (`.ownerMenuSlot` +
   * `.ownerMenuButton` + `.ownerMenuBars`) at the far end. Every value is the stylesheet's, and where the
   * stylesheet knows the shell (the account screen this app is) the value is the shell's override from
   * `feed-surface.css:970-975`.
   */
  hero: {
    /** `.ownerIdentityText{gap:10px}`: what the words and the bars keep between them. */
    rowGap: 10,
    /** `.ownerIdentityText h1{gap:6px}`: the reading between the dot, the name and the lock. */
    wordGap: 6,
    /** `.ownerIdentityText h1 .ownerPresence{width:14px;height:14px;margin:0 2px 0 0}` */
    presenceSize: 14,
    presenceMarginEnd: 2,
    /** `.ownerPresence i{width:9px;height:9px;background:#39e58e;box-shadow:0 0 8px #39e58e}` */
    presenceDot: 9,
    presenceOnline: '#39e58e',
    presenceGlow: 8,
    /** `.ownerPresence.isAway i{background:#ffd166;box-shadow:0 0 9px rgba(255,209,102,.75)}` */
    presenceAway: '#ffd166',
    presenceAwayGlow: 9,
    presenceAwayGlowOpacity: 0.75,
    /** `button.ownerVisibility{width:26px;height:26px;margin-left:6px;border-radius:9px}` */
    visibilitySize: 26,
    visibilityRadius: 9,
    visibilityMarginStart: 6,
    /** `.ownerVisibility i{font-size:13px}`, and the shell's `color:#fff!important` for the whole chip. */
    visibilityGlyphSize: 13,
    visibilityInk: '#ffffff',
    /** `.ownerMenuButton{width:44px;height:40px;border-radius:12px}` */
    menuWidth: 44,
    menuHeight: 40,
    menuRadius: 12,
    /** `.ownerMenuBars{width:20px;gap:4px}` with three `b` of `height:2px;border-radius:2px`. */
    barsWidth: 20,
    barsGap: 4,
    barHeight: 2,
    barRadius: 2,
    /** The bars are painted in the button's own ink, which the shell makes white. */
    menuInk: '#ffffff',
    /** `.ownerMenuButton[aria-expanded=true]` on the shell: `border-color:rgba(255,255,255,.34);background:#0a0b0d`. */
    menuOpenBorder: 'rgba(255,255,255,0.34)',
    menuOpenSurface: '#0a0b0d',
  },
  /**
   * The new profile header: the owner's own design decision (`docs/PARITY-MATRIX.md`, `MIGRATION.md` §19.2) —
   * the reference profile's arrangement, drawn with the product's own ink. The cover band is gone, the circle
   * is the reference's 92dp, and the identity under the top row is a block of two columns: the words on the
   * left, the circle on the right.
   *
   * Every value is the measurement the owner gave (approximated from the captures at ~2.6 density) and is
   * written here once so no screen re-derives a number: the numbers are checked by
   * `scripts/test-profile-header.cjs` at the ratios the phone really paints (px ÷ 2.6).
   */
  identity: {
    /** A row of 44dp aims, so every mark in it is a real touch target (`minTarget` below is the floor). */
    topRowHeight: 44,
    topRowGap: 6,
    minTarget: 44,
    iconSize: 22,
    /** The big circle of the reference: 92dp, with the story ring instead of the old 2dp white edge. */
    avatarSize: 92,
    storyRingWidth: 3,
    storyRingIdle: 'rgba(255,255,255,0.28)',
    storyRingUnseen: '#2fbdb3',
    /** The name the reference prints large: ~28sp bold, the handle ~15sp under it. */
    nameSize: 28,
    lineHeightRatio: 1.16,
    handleSize: 15,
    /** The fixed counters: big bold numbers over small grey words, all pressable. */
    statCountSize: 20,
    statLabelSize: 14,
    statGap: 22,
    statCountInk: '#ffffff',
    statLabelInk: '#96a2ad',
    /** What the words and the circle keep between them. */
    identityGap: 14,
    wordsTopGap: 6,
    /** The row of full-width buttons: ~38dp tall, fully round, 8dp apart from each other. */
    buttonTopGap: 14,
    /** The words under the buttons: the description, the link, the place and the age. */
    bioTopGap: 12,
    bioSize: 13.5,
    bioLines: 3,
    linkInk: '#67f5ed',
    metaSize: 13,
    metaInk: '#96a2ad',
    paddingHorizontal: 14,
    /** `.ownerHero{padding:12px 14px 0}` keeps the hero's own top inset, and this header keeps it too. */
    paddingTop: 12,
  },
  /**
   * The relation controls (`lib/relations.ts`). One button, drawn from these values on every screen, so the
   * header, a list row and a conversation row cannot drift apart: same height, same ink, same word.
   */
  relations: {
    /** The reference row: ~38dp tall, fully round, 8dp between the buttons. */
    buttonHeight: 38,
    buttonRadius: 19,
    buttonGap: 8,
    /** The round entry that holds the menu (block / mute) — 38dp drawn, 44dp aimed. */
    roundSize: 38,
    minTarget: 44,
    /** `profile-experience.css` accent: `#2fbdb3` for the border, `#67f5ed` for ink that leads somewhere. */
    accent: '#2fbdb3',
    accentInk: '#04120f',
    neutralSurface: '#12181d',
    neutralBorder: 'rgba(255,255,255,0.17)',
    neutralInk: '#eef4f7',
    busyInk: '#9fb2bb',
    dangerInk: '#ff8b98',
    labelSize: 14,
    compactHeight: 32,
    compactRadius: 16,
    compactLabelSize: 13,
    compactPaddingInline: 12,
    menuSurface: '#0b151d',
    menuBorder: '#26343d',
    menuRadius: 16,
    menuWidth: 210,
    menuRowHeight: 44,
    menuLabelSize: 13.5,
    menuPadding: 6,
    errorInk: '#ffb3bd',
    errorSize: 12,
  },
  /**
   * The content region under the hero: the grid, the list of words, the shelf of saved stories and the
   * empty states. Every value is read from `profile-experience.css` (`.ownerPostGrid`, `.ownerTile`,
   * `.ownerWhisperList`, `.ownerWhisperCard`, `.ownerMomentsPanel`, `.ownerEmpty`) and from the rules
   * `feed-surface.css` adds for the shared reply (`.postRepostedBy`) and the repost badge
   * (`.profileRepostBadge`), so the phone draws the archive with the web's own measurements rather than
   * with a look of its own.
   */
  archive: {
    /** `.ownerPostGrid{grid-template-columns:repeat(3,1fr);gap:2px;background:#060b11;min-height:210px}` */
    gridColumns: 3,
    gridGap: 2,
    gridMinHeight: 210,
    gridSurface: '#060b11',
    /** `.ownerTile{position:relative;aspect-ratio:1;background:#101923;color:#dce8ec}` */
    tileSurface: '#101923',
    tileInk: '#dce8ec',
    /** `.ownerTileChip{background:rgba(6,11,17,.74);color:#eafeff}` */
    tileChipSurface: 'rgba(6,11,17,0.74)',
    tileChipInk: '#eafeff',
    /** `.ownerTilePlay{left:7px;bottom:7px;width:26px;height:24px;border-radius:9px;font-size:10px}` */
    tilePlayWidth: 26,
    tilePlayHeight: 24,
    tilePlayRadius: 9,
    tilePlaySize: 10,
    tileChipInset: 7,
    /** `.ownerTileViews{left:37px;bottom:7px;gap:4px;height:24px;padding:0 7px;border-radius:9px;font-size:11.5px}` */
    tileViewsStart: 37,
    tileViewsGap: 4,
    tileViewsSize: 11.5,
    /** `.profileTile.isPinnedFirst{outline:1px solid #2fbdb3;outline-offset:-1px}` */
    tilePinnedFirstEdge: '#2fbdb3',
    /** `.ownerTilePinned{top:7px;left:7px;font-size:12px}` */
    tilePinnedSize: 12,
    /** `.ownerPin{top:6px;right:6px;width:30px;height:30px;border-radius:10px}`, border rgba(120,150,170,.35), ink #9fb2bb */
    pinInset: 6,
    pinSize: 30,
    pinRadius: 10,
    pinBorder: 'rgba(120,150,170,0.35)',
    pinInk: '#9fb2bb',
    /** `.profileRepostBadge{top:6px;left:6px;padding:1px 5px;border-radius:9px;background:rgba(11,23,32,.8);color:#8ff5ee;font-size:11px;font-weight:700}` */
    repostBadgeSurface: 'rgba(11,23,32,0.8)',
    repostBadgeInk: '#8ff5ee',
    repostBadgeSize: 11,
    repostBadgePadding: 5,
    repostBadgeRadius: 9,
    /** `.postRepostedBy{gap:5px;margin-bottom:6px;padding:0 2px;color:#8ff5ee;font-size:12px}` with `b{font-weight:600}` */
    repostLineGap: 5,
    repostLineMarginBottom: 6,
    repostLineSize: 12,
    repostLineInk: '#8ff5ee',
    /** `.postRepostedBy span{color:#8e9ca5}` — the post's author in the shared reply's line. */
    repostLineMuted: '#8e9ca5',
    /** `.postRepostedBy bdi{color:#9fb0ba}` — the handle of whoever shared a whisper of someone else's. */
    repostLineHandle: '#9fb0ba',
    /** `.ownerWhisperList{gap:10px;padding:12px 12px 0;background:#060b11}` */
    listGap: 10,
    listPaddingTop: 12,
    listPaddingHorizontal: 12,
    /** `.ownerWhisperCard{gap:8px;padding:12px;border:1px solid #22323b;border-left:2px solid rgba(33,234,220,.42);border-radius:16px;color:#eef8fb}` */
    cardGap: 8,
    cardPadding: 12,
    cardBorder: '#22323b',
    cardEdge: 'rgba(33,234,220,0.42)',
    cardRadius: 16,
    /** `background:linear-gradient(160deg,#0b141c,#081019)` — the first stop is the card's surface. */
    cardSurface: '#0b141c',
    cardInk: '#eef8fb',
    /** `.ownerFlowStream>.ownerWhisperCard{margin:6px 10px}` once a row of tiles was woven above it. */
    cardFlowMarginTop: 6,
    cardFlowMarginHorizontal: 10,
    /** `.ownerSharedReplyCard{border-left-color:#2a4a53}` — the share's edge is quieter than a whisper's. */
    cardShareEdge: '#2a4a53',
    /** `.ownerWhisperHead i{width:38px;height:38px;border-radius:19px;border:1px solid rgba(33,234,220,.5)}` */
    miniAvatar: 38,
    miniAvatarRadius: 19,
    miniAvatarBorder: 'rgba(33,234,220,0.5)',
    miniAvatarSurface: '#09131c',
    miniAvatarInk: '#ddffff',
    miniAvatarSize: 13,
    /** `.ownerWhisperHead b{font-size:14px;line-height:1.2}` with its `small{color:#93a5ae;font-size:11.5px}`. */
    cardNameSize: 14,
    cardMetaInk: '#93a5ae',
    cardMetaSize: 11.5,
    /** `.ownerWhisperBody{color:#dbe7ec;font-size:15px;line-height:1.45}` */
    cardBodyInk: '#dbe7ec',
    cardBodySize: 15,
    cardBodyLineHeight: 21.75,
    /** `.ownerWhisperActions{gap:6px}` with `button{min-height:38px;padding:0 10px;border-radius:11px;font-size:12px}` */
    actionGap: 6,
    actionMinHeight: 38,
    actionPaddingHorizontal: 10,
    actionRadius: 11,
    actionSurface: 'rgba(15,30,49,0.5)',
    actionInk: '#9fb2bc',
    actionSize: 12,
    /** `button[aria-pressed=true]{border-color:#27dccc;color:#6eecdf}` */
    actionOnBorder: '#27dccc',
    actionOnInk: '#6eecdf',
    /** `.ownerWhisperAction i{font-size:14px}` — the mark of the comment and the repost presses. */
    actionGlyphSize: 14,
    /** `.ownerWhisperAction small{font-size:12px;color:#c7d5dc}` — the two counts beside those marks. */
    actionCountSize: 12,
    actionCountInk: '#c7d5dc',
    /** `.ownerWhisperAction.on small{color:#6eecdf}` — a repost already done reads in the row's own ink. */
    actionCountOnInk: '#6eecdf',
    /**
     * `.ownerWhisperAction .reactionSummaryGlyphs .reactionMetric b{font-size:15px}` and `em{font-size:12px}`,
     * both `color:inherit`: the same summary a card's action row prints, one step quieter, in the plate's
     * own ink (`measured in docs/web-ref/profile/tab-3.dom.json`).
     */
    actionMetricGlyphSize: 15,
    actionMetricCountSize: 12,
    /**
     * `.rankReason{margin:3px 0 7px;color:#9fb4bd;font-size:11px;line-height:1.35}` with
     * `.rankReasonLabel{color:#7fd8cf}` (`styles.css`): the one line a whisper card adds when the feed gave
     * the post a reason, and the label that says which question it answers.
     */
    reasonMarginTop: 3,
    reasonMarginBottom: 7,
    reasonSize: 11,
    reasonLineHeight: 14.85,
    reasonInk: '#9fb4bd',
    reasonLabelInk: '#7fd8cf',
    /** `.ownerOpenReply{min-height:36px;padding:0 12px;border:1px solid #2c4d55;border-radius:12px;background:#0e1c25;color:#8ff5ee;font-size:12px}` */
    openReplyMinHeight: 36,
    openReplyPaddingHorizontal: 12,
    openReplyBorder: '#2c4d55',
    openReplyRadius: 12,
    openReplySurface: '#0e1c25',
    openReplyInk: '#8ff5ee',
    openReplySize: 12,
    /** `.ownerMomentsPanel{padding:6px 0 10px}` with `header{padding:0 14px 6px}` and a row `{gap:12px;padding:2px 14px}`. */
    momentsPaddingTop: 6,
    momentsPaddingBottom: 10,
    momentsHeaderPaddingHorizontal: 14,
    momentsHeaderPaddingBottom: 6,
    momentsHeaderSize: 13,
    momentsRowGap: 12,
    momentsRowPaddingHorizontal: 14,
    momentsRowPaddingVertical: 2,
    /** `.ownerMoment{flex:0 0 54px}` with `.ownerMomentCircle{width:50px;height:50px;border:2px solid #27ded2}`. */
    momentWidth: 54,
    momentCircle: 50,
    momentCircleBorder: '#27ded2',
    momentCircleSurface: '#0b1720',
    momentCircleInk: '#2ce8dc',
    momentCircleSize: 20,
    momentTitleMarginTop: 4,
    momentTitleSize: 10,
    /**
     * `.ownerMomentsPanel button{color:#aebac1}` — what each tile is called. The header's own `b` keeps the
     * shell's ink (`color:#f7f7f7` on the phone shell, `feed-surface.css`), because the panel never
     * overrides it.
     */
    momentTitleInk: '#aebac1',
    momentHeaderInk: '#f7f7f7',
    /** `.ownerEmpty{min-height:208px;padding:24px 24px 34px;gap:6px;color:#93a6b0}` */
    emptyMinHeight: 208,
    emptyPaddingTop: 24,
    emptyPaddingHorizontal: 24,
    emptyPaddingBottom: 34,
    emptyGap: 6,
    emptyInk: '#93a6b0',
    /** `.ownerEmpty b{color:#e7f2f6;font-size:15px;font-weight:600}` with its `span{font-size:14px;line-height:1.4}`. */
    emptyTitleInk: '#e7f2f6',
    emptyTitleSize: 15,
    emptyDetailSize: 14,
    emptyDetailLineHeight: 19.6,
    /** `.ownerEmpty svg{width:34px;height:34px;color:#4fd9d0}` */
    emptyIconSize: 34,
    emptyIconInk: '#4fd9d0',
  },
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
