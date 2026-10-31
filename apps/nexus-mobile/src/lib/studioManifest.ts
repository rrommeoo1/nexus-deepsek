import type { LocalCapture, LocalDraft, LocalSticker } from './localCapture';

/** The exact decoration keys accepted by apps/nexus-web/lib/creator-studio.js. */
export type StudioDecoration = {
  id: string;
  type: 'TEXT' | LocalSticker['type'];
  assetId: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  style: string;
  align: 'center';
  color: string;
  background: string;
  animation: 'none';
  startMs: number;
  endMs: number;
  timezone: string;
  locationPrecision: 'area';
  dynamic: boolean;
};

export type StudioManifest = {
  version: 1;
  aspect: 'ORIGINAL' | 'VERTICAL_9_16';
  filter: 'NONE';
  intensity: 0;
  trimStartMs: 0;
  trimEndMs: number;
  playbackRate: 1;
  muteOriginal: false;
  overlay: { text: ''; position: 'BOTTOM'; color: 'WHITE' };
  decorations: StudioDecoration[];
  transform: { rotation: 0; zoom: 1; x: 50; y: 50; ratio: number; originalVolume: 1; musicVolume: 0.7 };
};

function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function zone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

function decorationBase(id: string, type: StudioDecoration['type'], x: number, y: number, index: number, scale = 1): StudioDecoration {
  return {
    id, type, assetId: '', text: '', x: percent(x), y: percent(y), scale, rotation: 0,
    zIndex: index + 1, opacity: 1, style: 'classic', align: 'center', color: '#ffffff',
    background: 'transparent', animation: 'none', startMs: 0, endMs: 600000,
    timezone: zone(), locationPrecision: 'area', dynamic: false,
  };
}

/**
 * The decorations this draft will publish, in the exact form the manifest stores them.
 *
 * Round 41 (owner, 31 October 2026): the composer used to keep its own renderer for what it drew over
 * the clip — a different type size, a different box, a different rectangle — so the preview and the
 * published post disagreed about the same two numbers. The preview now draws *these* decorations with
 * the reader's own layer (`components/PostOverlay`), because they are the very records the publish will
 * send: one list, one geometry, no second guess about what a text "should" look like.
 */
export function studioDecorations(capture: LocalCapture, draft: LocalDraft): StudioDecoration[] {
  const decorations: StudioDecoration[] = [];
  const text = draft.overlayText.trim();
  /**
   * Mărimea (runda 46): una din cele trei preseturi, scrisă în manifest ca `scale`. Este singurul loc în
   * care mărimea din editor ajunge în postarea publicată, iar randatorul (`components/PostOverlay`) o
   * citește de aici — deci previzualizarea și pagina publicată nu pot ajunge la două mărimi diferite.
   */
  if (text) {
    const id = `text-${capture.name.slice(0, 13)}`;
    decorations.push({ ...decorationBase(id, 'TEXT', draft.overlayX, draft.overlayY, 0, readScale(draft.overlayScale)), text });
  }
  for (const sticker of (draft.stickers ?? []).slice(0, 12 - decorations.length)) {
    const base = decorationBase(sticker.id, sticker.type, sticker.x, sticker.y, decorations.length, readScale(sticker.scale));
    decorations.push(sticker.type === 'LOCATION'
      ? { ...base, text: sticker.text, style: 'pill-light', color: '#111111', background: '#ffffff', timezone: sticker.timezone }
      : { ...base, style: sticker.type === 'TIME' ? 'digital' : 'date', dynamic: true, timezone: sticker.timezone });
  }
  return decorations;
}

/**
 * O mărime validă pentru manifest, oricât de vechi ar fi draftul: fără câmp → `1`, iar o valoare absurdă
 * se ține în intervalul pe care serverul îl acceptă (`scale` între 0.4 și 3).
 */
function readScale(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 1;
  return Math.min(3, Math.max(0.4, number));
}

export function studioManifestFor(capture: LocalCapture, draft: LocalDraft): StudioManifest | null {
  const text = draft.overlayText.trim();
  if (text.length > 120) throw new Error('Textul peste imagine are cel mult 120 de caractere. Scurtează textul înainte de publicare; draftul rămâne salvat.');
  const decorations = studioDecorations(capture, draft);
  if (!decorations.length) return null;
  return {
    version: 1, aspect: capture.framing === '9:16' ? 'VERTICAL_9_16' : 'ORIGINAL', filter: 'NONE', intensity: 0,
    trimStartMs: 0, trimEndMs: capture.kind === 'video' ? 600000 : 0,
    playbackRate: 1, muteOriginal: false,
    overlay: { text: '', position: 'BOTTOM', color: 'WHITE' }, decorations,
    transform: { rotation: 0, zoom: 1, x: 50, y: 50, ratio: capture.framing === '9:16' ? 9 / 16 : 3 / 4, originalVolume: 1, musicVolume: 0.7 },
  };
}
