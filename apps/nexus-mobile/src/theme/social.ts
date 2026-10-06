/**
 * Social shell values, extracted from the existing web stylesheets — not a new design system.
 *
 * Sources for every number below:
 *   apps/nexus-web/public/styles.css:21            .appNav / .appNav button / i / createNav
 *   apps/nexus-web/public/styles.css:59            .appNav button i svg
 *   apps/nexus-web/public/feed-surface.css:642-643 .appNav.social widths
 *   apps/nexus-web/public/feed-surface.css:824-855 monochrome Social shell
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
    barTopBorder: 'rgba(255,255,255,0.13)',
    glassBorder: 'rgba(255,255,255,0.22)',
    markBorder: 'rgba(255,255,255,0.12)',
    markBackground: 'rgba(4,5,7,0.74)',
    markActiveBorder: 'rgba(255,255,255,0.42)',
    markActiveBackground: '#090a0c',
    markActiveShadow: 'rgba(255,255,255,0.12)',
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
    headerSurface: 'rgba(8,13,20,0.94)',
    headerSurfaceEnd: 'rgba(8,13,20,0.78)',
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
    borderTopWidth: 1,
    /** `.appNav:before` — the shared glass the seven marks sit in. */
    glass: { insetInline: 6, top: 4, height: 50, radius: 26, borderWidth: 1 },
    /** `.appNav button` */
    mark: { height: 50, maxWidth: 64, paddingVertical: 5, paddingHorizontal: 2, radius: 17, pressedScale: 0.95 },
    /** `.appNav button i` (Social monochrome size) */
    disc: { size: 32, radius: 12, borderWidth: 1, glyphSize: 20 },
    /** `.appNav button i svg` */
    icon: { size: 25, strokeWidth: 1.7 },
    /** `.appNav.social .createNav i` — 44px so the circle stays inside the 50px glass. */
    create: { size: 44, radius: 19, borderWidth: 5, glyphSize: 23 },
  },
  feedHeader: {
    minHeight: 56,
    paddingTop: 10,
    paddingBottom: 9,
    paddingInline: 12,
    gap: 6,
    wordmarkWidth: 76,
    wordmarkHeight: 20,
    modeBadge: { size: 38, radius: 13, innerRadius: 12, glyphSize: 15 },
    iconButton: { size: 40, radius: 13, iconSize: 21, strokeWidth: 1.7 },
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
