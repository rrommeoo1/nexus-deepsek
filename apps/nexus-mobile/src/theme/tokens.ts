/**
 * Design values extracted from the existing web UI, not a new design system.
 * The login values are the final computed styles at 469 × 1022 CSS px
 * (Xiaomi 17 Pro: 1220 × 2656 physical px at 416 dpi override).
 * Sources: apps/nexus-web/public/styles.css,
 *          apps/nexus-web/public/p3-visual-foundation.css,
 *          apps/nexus-web/public/feed-surface.css,
 *          apps/nexus-web/public/app.js:nexusWordmarkMarkup().
 * Add feed, profile and menu sections only when those screens are approved
 * for migration, extracting each screen from the web first.
 */
export const nexusTokens = {
  source: {
    viewport: { width: 469, height: 1022 },
    styleSheets: ['styles.css', 'p3-visual-foundation.css', 'feed-surface.css'],
    fontStack: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    wordmarkFunction: 'nexusWordmarkMarkup',
  },
  colors: {
    canvas: '#000000',
    card: '#050608',
    panel: '#08090b',
    input: '#030405',
    button: '#0a0b0d',
    disabledButton: '#090a0c',
    providerMark: '#17191d',
    walletBadge: 'rgba(0,0,0,0.09)',
    white: '#ffffff',
    text: '#f7fbff',
    label: '#f5f5f5',
    tagline: '#a9abb0',
    providerNote: '#96999f',
    separator: '#85888e',
    disabledText: '#a0a2a7',
    walletText: '#050608',
    version: '#9fb4c1',
    authError: '#96999f',
    fieldBorder: 'rgba(255,255,255,0.2)',
    panelBorder: 'rgba(255,255,255,0.17)',
    buttonBorder: 'rgba(255,255,255,0.22)',
    disabledBorder: 'rgba(255,255,255,0.12)',
    rule: 'rgba(255,255,255,0.28)',
  },
  login: {
    root: {
      paddingVertical: 18, paddingHorizontal: 14,
      backgroundImage: 'radial-gradient(95% 52% at 50% 100%, rgba(76,142,102,.075), transparent 72%)',
      animation: 'none',
    },
    card: {
      maxWidth: 430, paddingTop: 26, paddingHorizontal: 18, paddingBottom: 28,
      borderWidth: 1, borderRadius: 30,
      shadow: '0 24px 72px rgba(0,0,0,.72)',
    },
    brand: {
      height: 40, fontSize: 34, fontWeight: '500', letterSpacing: 7.82,
      gap: 12, marginTop: 3, marginBottom: 8,
      fontStack: 'Inter, Arial, Helvetica, sans-serif',
      cssGlyph: {
        width: 40, height: 40,
        clipPath: 'polygon(0 16%,30% 0,63% 40%,63% 8%,100% 29%,100% 84%,70% 100%,37% 60%,37% 92%,0 71%)',
        angleDeg: 145,
        gradient: ['#ffffff', '#ffffff', '#a8a8a8', '#545454'],
        stops: [0, 0.38, 0.62, 1],
        shadow: 'inset 0 0 0 1px rgba(255,255,255,.28)',
      },
    },
    tagline: { maxWidth: 330, fontSize: 12, lineHeight: 18, marginBottom: 20 },
    box: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 18,
      marginBottom: 14, borderWidth: 1, borderRadius: 22,
      topRule: 'linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent)',
      topRuleOpacity: 0.45, topRuleHeight: 1, topRuleHorizontalInset: 16, topRuleTop: -1 },
    title: { fontSize: 11, fontWeight: '700', letterSpacing: 2.09,
      marginBottom: 14, textTransform: 'uppercase' },
    button: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 16,
      borderWidth: 1, borderRadius: 15, marginBottom: 10,
      fontSize: 14, fontWeight: '800', letterSpacing: 0.14, gap: 8 },
    provider: { height: 53.42, disabledOpacity: 0.42,
      markSize: 28, markRadius: 9, markMarginRight: 10,
      badgeFontSize: 11, badgeFontWeight: '700', badgePaddingVertical: 3, badgePaddingHorizontal: 6,
      badgeBorderRadius: 10 },
    providerNote: { fontSize: 13, lineHeight: 19.5,
      marginHorizontal: 4, marginTop: -2, marginBottom: 6 },
    separator: { fontSize: 12, letterSpacing: 0.96, gap: 12, ruleHeight: 1,
      marginTop: 22, marginBottom: 14,
      rule: 'linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)' },
    field: { gap: 6, marginBottom: 12, labelFontSize: 12,
      inputHeight: 50, inputFontSize: 16, inputPaddingVertical: 11,
      inputPaddingHorizontal: 12, inputBorderWidth: 1, inputRadius: 14 },
    forgot: { minHeight: 44, padding: 12, marginTop: 7, marginBottom: -6,
      fontSize: 13, fontWeight: '650', lineHeight: 17.55 },
    signupNote: { fontSize: 11, lineHeight: 15.95, marginTop: 2, gap: 7 },
    version: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginTop: 1,
      paddingVertical: 1, paddingHorizontal: 4, borderRadius: 5,
      backgroundColor: '#0b1a22d9', borderColor: '#ffffff2e' },
  },
  graphics: {
    // Exact SVG returned by the existing web function; its CSS may recolour
    // text/gradient/circuits to white on the Social feed.
    wordmarkSvg: '<svg viewBox="0 0 132 34"><defs><linearGradient id="nexus-wordmark-x" x1="0" x2="1"><stop stop-color="#00efff"/><stop offset="1" stop-color="#a66cff"/></linearGradient></defs><text x="1" y="24" fill="#f4fbff" font-size="22" font-family="Arial,Helvetica,sans-serif" letter-spacing="5">NE</text><text x="44" y="24" fill="url(#nexus-wordmark-x)" font-size="22" font-family="Arial,Helvetica,sans-serif">X</text><text x="61" y="24" fill="#f4fbff" font-size="22" font-family="Arial,Helvetica,sans-serif" letter-spacing="5">US</text><path d="M91 8h27m-17 6h24m-31 6h30m-20 6h14" fill="none" stroke="#27dfe9" stroke-width="1" opacity=".65"/><circle cx="121" cy="8" r="1.6" fill="#9d72ff"/><circle cx="127" cy="14" r="1.6" fill="#27dfe9"/><circle cx="126" cy="20" r="1.6" fill="#9d72ff"/></svg>',
  },
} as const;
