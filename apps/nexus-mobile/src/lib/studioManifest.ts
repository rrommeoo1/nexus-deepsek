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

function decorationBase(id: string, type: StudioDecoration['type'], x: number, y: number, index: number): StudioDecoration {
  return {
    id, type, assetId: '', text: '', x: percent(x), y: percent(y), scale: 1, rotation: 0,
    zIndex: index + 1, opacity: 1, style: 'classic', align: 'center', color: '#ffffff',
    background: 'transparent', animation: 'none', startMs: 0, endMs: 600000,
    timezone: zone(), locationPrecision: 'area', dynamic: false,
  };
}

export function studioManifestFor(capture: LocalCapture, draft: LocalDraft): StudioManifest | null {
  const decorations: StudioDecoration[] = [];
  const text = draft.overlayText.trim();
  if (text.length > 120) throw new Error('Textul peste imagine are cel mult 120 de caractere. Scurtează textul înainte de publicare; draftul rămâne salvat.');
  if (text) {
    const id = `text-${capture.name.slice(0, 13)}`;
    decorations.push({ ...decorationBase(id, 'TEXT', draft.overlayX, draft.overlayY, 0), text });
  }
  for (const sticker of (draft.stickers ?? []).slice(0, 12 - decorations.length)) {
    const base = decorationBase(sticker.id, sticker.type, sticker.x, sticker.y, decorations.length);
    decorations.push(sticker.type === 'LOCATION'
      ? { ...base, text: sticker.text, style: 'pill-light', color: '#111111', background: '#ffffff', timezone: sticker.timezone }
      : { ...base, style: sticker.type === 'TIME' ? 'digital' : 'date', dynamic: true, timezone: sticker.timezone });
  }
  if (!decorations.length) return null;
  return {
    version: 1, aspect: capture.framing === '9:16' ? 'VERTICAL_9_16' : 'ORIGINAL', filter: 'NONE', intensity: 0,
    trimStartMs: 0, trimEndMs: capture.kind === 'video' ? 600000 : 0,
    playbackRate: 1, muteOriginal: false,
    overlay: { text: '', position: 'BOTTOM', color: 'WHITE' }, decorations,
    transform: { rotation: 0, zoom: 1, x: 50, y: 50, ratio: capture.framing === '9:16' ? 9 / 16 : 3 / 4, originalVolume: 1, musicVolume: 0.7 },
  };
}
