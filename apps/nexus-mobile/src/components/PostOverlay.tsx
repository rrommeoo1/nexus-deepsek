import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { StudioDecoration } from '../lib/studioManifest';
import {
  OVERLAY_KINDS, clampOverlayPosition, mediaContentRect, overlayFontSize, overlayMaxWidth, overlayPadding,
  overlayWindow, type OverlayFit, type OverlayKind, type OverlayRect,
} from '../lib/overlayFrame';

/**
 * The words and stickers placed over a picture — **one** renderer for the two places they appear.
 *
 * The composer and the reader used to be two renderers with two coordinate systems: the preview drew a
 * dark 27-point box inside a centred 9:16 frame, and the published page drew a transparent 40-point label
 * inside the cropped content rectangle (`lib/overlayFrame.ts` tells the whole of it). The owner saw the
 * difference as „textul devine prea mare și stă în alt loc".
 *
 * Since round 41 there is one: this layer. A surface hands it the room it owns (`bounds`), the aspect its
 * media has, the rule the media is drawn with (`cover`/`contain`) and the decorations the manifest
 * carries; it measures the content rectangle with `mediaContentRect` and prints the labels inside it.
 * The composer passes `onMove`, which is the only difference — a label you can drag is still the same
 * label, drawn with the same type, the same padding and the same percentages, so a drag in the preview
 * lands where the reader will see it.
 */

/** `21:05` / `31.10` — a clock or a date sticker, in the author's own time zone. */
export function overlayTextOf(item: StudioDecoration, now: number): string {
  if (item.type !== 'TIME' && item.type !== 'DATE') return item.text;
  if (!now) return '…';
  try {
    return new Intl.DateTimeFormat('ro-RO', item.type === 'TIME'
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: item.timezone }
      : { day: '2-digit', month: '2-digit', timeZone: item.timezone }).format(new Date(now));
  } catch { return ''; }
}

/** The kinds this layer draws. A manifest may carry others (a poll, a filter); they are not labels. */
export function isOverlayLabel(item: StudioDecoration): boolean {
  return OVERLAY_KINDS.includes(item.type as OverlayKind);
}

function OverlayLabel({
  item, now, rect, window, onMove,
}: {
  item: StudioDecoration;
  now: number;
  /** The content rectangle the label lives in: its percentages are read against this, not the phone. */
  rect: OverlayRect;
  /**
   * The part of the content rectangle the reader can actually see: a `cover` rectangle is wider than the
   * phone, and a label placed near its edge used to be half cut by the screen. The label is kept inside
   * this window, in both surfaces, so a text is never half a word.
   */
  window: { left: number; top: number; right: number; bottom: number };
  /** Given, the label may be dragged; the callback reports the new fraction of the content rectangle. */
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const kind = item.type as OverlayKind;
  const location = kind === 'LOCATION';
  const clock = kind === 'TIME' || kind === 'DATE';
  const padding = overlayPadding(kind);
  const fontSize = overlayFontSize(kind, rect.width);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(onMove),
    onMoveShouldSetPanResponder: () => Boolean(onMove),
    onPanResponderMove: (_, gesture) => setDrag({ dx: gesture.dx, dy: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      setDrag({ dx: 0, dy: 0 });
      if (!onMove || !rect.width || !rect.height) return;
      // The same fractions the manifest stores, moved by the gesture's own distance over the content
      // rectangle — the rectangle the reader will measure, not the box this label happens to sit in.
      onMove(
        item.id,
        clampOverlayPosition((item.x / 100) + gesture.dx / rect.width),
        clampOverlayPosition((item.y / 100) + gesture.dy / rect.height),
      );
    },
  }), [item.id, item.x, item.y, onMove, rect.height, rect.width]);
  /**
   * Where the label really stands: its own centre, held inside the visible window so no part of it is cut
   * by the crop. Same numbers in the composer and in the reader — the offset is computed from the label's
   * measured size, not guessed.
   */
  const centreX = (item.x / 100) * rect.width;
  const centreY = (item.y / 100) * rect.height;
  const lowX = window.left + size.width / 2;
  const highX = window.right - size.width / 2;
  const lowY = window.top + size.height / 2;
  const highY = window.bottom - size.height / 2;
  const heldX = highX < lowX ? (window.left + window.right) / 2 : Math.max(lowX, Math.min(highX, centreX));
  const heldY = highY < lowY ? (window.top + window.bottom) / 2 : Math.max(lowY, Math.min(highY, centreY));
  return (
    <View
      {...(onMove ? pan.panHandlers : {})}
      pointerEvents={onMove ? 'auto' : 'none'}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
      }}
      style={[styles.label, {
        left: `${item.x}%`, top: `${item.y}%`, maxWidth: `${overlayMaxWidth(kind) * 100}%`,
        backgroundColor: item.background, borderRadius: location ? 22 : 0,
        paddingHorizontal: padding.horizontal, paddingVertical: padding.vertical,
        opacity: item.opacity,
        transform: [
          { translateX: -size.width / 2 + drag.dx + (heldX - centreX) },
          { translateY: -size.height / 2 + drag.dy + (heldY - centreY) },
          { rotate: `${item.rotation}deg` }, { scale: item.scale },
        ],
      }]}
    >
      <Text style={[styles.text, { color: item.color, fontSize, letterSpacing: clock ? 1 : 0 }, location && styles.locationText]}>
        {overlayTextOf(item, now)}
      </Text>
    </View>
  );
}
/**
 * The layer itself: a box the size of the content rectangle, centred in the room, with one label per
 * decoration. `pointerEvents` stays `none` unless the layer is told how to move a label, so a reader can
 * tap the clip through it.
 */
export function PostOverlay({
  decorations, bounds, ratio, fit, now = 0, onMove,
}: {
  decorations: StudioDecoration[];
  /** The room the media was drawn in (the page, the preview surface), in points. */
  bounds: { width: number; height: number };
  /** Width over height of the content: the manifest's `transform.ratio`. */
  ratio: number;
  fit: OverlayFit;
  now?: number;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const labels = decorations.filter(isOverlayLabel);
  const rect = mediaContentRect({ width: bounds.width, height: bounds.height, ratio, fit });
  if (!labels.length || !rect.width || !rect.height) return null;
  /**
   * The part of the content rectangle the screen can show, in the rectangle's own coordinates. A `cover`
   * rectangle is wider than the phone, so its outer columns are cropped — a label placed there was half a
   * word on the reader's phone while the author had seen it whole in the composer (owner, round 41:
   * „textul iese din ecran"). Both surfaces measure this window with the same two numbers.
   */
  const window = overlayWindow({ width: bounds.width, height: bounds.height, rect });
  return (
    <View
      pointerEvents={onMove ? 'box-none' : 'none'}
      style={{
        position: 'absolute', width: rect.width, height: rect.height,
        left: rect.left, top: rect.top,
      }}
    >
      {labels.map((item) => (
        <OverlayLabel key={item.id} item={item} now={now} rect={rect} window={window} onMove={onMove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800', textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 7 },
  locationText: { textShadowRadius: 0 },
});

