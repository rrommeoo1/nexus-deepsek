/**
 * Tokens de design extrase 1:1 din CSS-ul web — nu un sistem nou, nu valori estimate.
 *
 * Sursă: docs/web-ref/_tokens/css-variables.json, generat cu tools/web-ref/extract-tokens.mjs din
 * apps/nexus-web/public/*.css la viewport-ul telefonului (469x1021 CSS px, DPR 2.6).
 * Regenerare: node tools/web-ref/make-native-tokens.mjs
 *
 * `webCssVariables` păstrează numele originale (`--nx-cyan`), iar `webTokens` le dă nume de
 * identificator pentru cod. Ambele liste conțin exact valorile web.
 */

export const webCssVariables = {
  // nx — styles.css, p3-visual-foundation.css
  '--nx-border': 'rgba(160,190,255,.24)',
  '--nx-cyan': '#37f7ff',
  '--nx-glass': 'rgba(12,24,40,.58)',
  '--nx-glass-strong': 'rgba(18,33,54,.74)',
  '--nx-muted': '#91a5b7',
  '--nx-pink': '#ff4d88',
  '--nx-teal': '#24f0d2',
  '--nx-text': '#effbff',
  '--nx-viewport-height': '100dvh',
  '--nx-violet': '#8c62ff',
  '--nx-void': '#00030a',
  // core — social-design.css, styles.css, screen-shell.css
  '--bg': '#090e14',
  '--bubble': '#243640',
  '--cyan': '#6ce9e4',
  '--glass': 'rgba(11,22,34,.58)',
  '--glass2': 'rgba(20,33,51,.42)',
  '--gold': '#f7b94c',
  '--line': '#ffffff14',
  '--muted': '#95a5b7',
  '--nexus-screen-radius': '18px',
  '--panel': '#131c26',
  '--panel2': '#0d1822',
  '--pink': '#ff4f8f',
  '--purple': '#9692ff',
  '--softText': '#dff7ff',
  '--teal': '#20e0d0',
  '--text': '#eff4fa',
  '--violet': '#8b5cff',
  '--void': '#02050b',
  '--void2': '#07101a',
  // nx67 — styles.css
  '--nx67-cyan': '#00e5ff',
  '--nx67-line': 'rgba(135,183,220,.22)',
  '--nx67-muted': '#a9bac5',
  '--nx67-panel': 'rgba(10,18,28,.76)',
  '--nx67-panel-strong': 'rgba(8,15,24,.92)',
  '--nx67-teal': '#24ead8',
  '--nx67-void': '#0a0a0f',
} as const;

export const webTokens = {
  colors: {
    nxBorder: 'rgba(160,190,255,.24)',
    nxCyan: '#37f7ff',
    nxGlass: 'rgba(12,24,40,.58)',
    nxGlassStrong: 'rgba(18,33,54,.74)',
    nxMuted: '#91a5b7',
    nxPink: '#ff4d88',
    nxTeal: '#24f0d2',
    nxText: '#effbff',
    nxViewportHeight: '100dvh',
    nxViolet: '#8c62ff',
    nxVoid: '#00030a',
    bg: '#090e14',
    bubble: '#243640',
    cyan: '#6ce9e4',
    glass: 'rgba(11,22,34,.58)',
    glass2: 'rgba(20,33,51,.42)',
    gold: '#f7b94c',
    line: '#ffffff14',
    muted: '#95a5b7',
    nexusScreenRadius: '18px',
    panel: '#131c26',
    panel2: '#0d1822',
    pink: '#ff4f8f',
    purple: '#9692ff',
    softText: '#dff7ff',
    teal: '#20e0d0',
    text: '#eff4fa',
    violet: '#8b5cff',
    void: '#02050b',
    void2: '#07101a',
    nx67Cyan: '#00e5ff',
    nx67Line: 'rgba(135,183,220,.22)',
    nx67Muted: '#a9bac5',
    nx67Panel: 'rgba(10,18,28,.76)',
    nx67PanelStrong: 'rgba(8,15,24,.92)',
    nx67Teal: '#24ead8',
    nx67Void: '#0a0a0f',
  },
} as const;

export type WebTokenName = keyof typeof webCssVariables;
