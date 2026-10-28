import { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteImage, RemoteVideo } from './PostMedia';
import { mediaKindOf, type MediaItem } from '../lib/socialTypes';
import { TEXT_MEDIA_FRAME_DEFAULT, type TextMediaFrame } from '../lib/textStyle';

/**
 * The lead block of an authored article (`PostStage: 'article'`).
 *
 * The owner's rule (25 October 2026): a photograph must not force a page of words into the Reel
 * composition, and a very tall picture must not be stretched or cropped to fill the first page
 * either. The block therefore lives inside the first page of the paged reading, is bounded by the
 * reader (`PostTextReading` gives it a measured slice of the page), and draws every picture with
 * `contain`, so the whole frame survives. The words that do not fit continue on the next page,
 * exactly as they do for a page without pictures.
 *
 * A second pass (same day) made the block the author's own: one finger moves it, two fingers scale
 * it in the composer, and the saved frame (`textStyle.media`) is drawn here. The reader passes the
 * unscaled cap as `baseHeight`, so the zoom a reader sees is the zoom its author arranged.
 *
 * A press opens a photograph on its own, full screen, with the whole frame still `contain` and a
 * counter when the author attached more than one. A clip is played in place, because a clip is not
 * a photograph with a viewer: the article keeps its words beside the lead.
 */
export function ArticleMediaBlock({ items, frame, baseHeight, active = false, muted = true, onError, style }: {
  items: MediaItem[];
  /** The authored frame; absent means the reference block (`scale: 1`, centred). */
  frame?: TextMediaFrame;
  /** The measured, unscaled cap of the block (the reader's 34%-of-page slice). */
  baseHeight?: number;
  /** Only the article the reader is looking at may decode its clip. */
  active?: boolean;
  muted?: boolean;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const photos = items.filter((item) => mediaKindOf(item) === 'image');
  const clip = items.find((item) => mediaKindOf(item) === 'video') ?? null;
  const { width: screenWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [playing, setPlaying] = useState(true);

  if (!photos.length && !clip) return null;

  const artwork = frame ?? TEXT_MEDIA_FRAME_DEFAULT;
  const base = Math.max(40, baseHeight ?? (width || screenWidth) * 0.75);
  const contentWidth = Math.max(1, width * artwork.scale);
  const contentHeight = Math.max(1, base * artwork.scale);
  const left = (width - contentWidth) / 2 + artwork.x * width;
  const top = artwork.y * base;
  const openViewer = (index: number) => {
    setViewer({ open: true, index });
  };
  const closeViewer = () => setViewer((current) => ({ ...current, open: false }));

  return (
    <>
      <View
        style={[styles.block, style]}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      >
        <View style={[styles.framed, { width: contentWidth, height: contentHeight, left, top }]}>
          {clip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Oprește clipul articolului' : 'Redă clipul articolului'}
              onPress={() => setPlaying((value) => !value)}
              style={styles.fill}
            >
              <RemoteVideo
                item={clip}
                fit="contain"
                style={styles.fill}
                active={Boolean(active) && playing}
                muted={muted}
                loop
                onError={onError}
              />
              {!playing || !active ? (
                <View pointerEvents="none" style={styles.playDisc}>
                  <View style={styles.playGlyph} />
                </View>
              ) : null}
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={photos.length > 1}
              style={styles.fill}
            >
              {photos.map((item, index) => (
                <Pressable
                  key={`${item.hash ?? 'photo'}-${index}`}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Deschide fotografia ${index + 1} din ${photos.length}`}
                  onPress={() => openViewer(index)}
                  style={[styles.page, contentWidth ? { width: contentWidth } : null]}
                >
                  <RemoteImage item={item} fit="contain" style={styles.fill} onError={onError} />
                  {photos.length > 1 ? (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{`${index + 1}/${photos.length}`}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>


      <PhotoViewer
        photos={photos}
        open={viewer.open}
        startIndex={viewer.index}
        onClose={closeViewer}
        onError={onError}
      />
    </>
  );
}

/**
 * One photograph at a time, full screen, with a swipe between the photographs of the page.
 *
 * It lives beside `ArticleMediaBlock` because both the legacy lead block and the document reader
 * open the same viewer: a press must show the photograph itself, never a second rendering of the
 * post. The caller owns *which* photograph was pressed; this component owns the paging.
 */
export function PhotoViewer({ photos, open, startIndex, onClose, onError }: {
  photos: MediaItem[];
  open: boolean;
  startIndex: number;
  onClose: () => void;
  onError?: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewerPage, setViewerPage] = useState(startIndex);
  const viewerScroll = useRef<ScrollView>(null);
  const openedAt = useRef(startIndex);

  useEffect(() => {
    if (!open) return;
    openedAt.current = startIndex;
    setViewerPage(startIndex);
    // `contentOffset` is honoured on Android, but iOS needs the hand after layout.
    const timer = setTimeout(() => {
      viewerScroll.current?.scrollTo({ x: startIndex * screenWidth, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [open, screenWidth, startIndex]);

  const closeViewer = onClose;
  const viewerHeight = Math.max(160, screenHeight - insets.top - insets.bottom - 76);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeViewer}
    >
      <View
        accessibilityViewIsModal
        style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
      >
        <View style={styles.viewerBar}>
          <Text style={styles.viewerTitle}>{`Fotografia ${viewerPage + 1} din ${photos.length}`}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Închide fotografia"
            onPress={closeViewer}
            style={styles.close}
          >
            <Text style={styles.closeText}>Închide</Text>
          </Pressable>
        </View>
        <ScrollView
          key={`viewer-${openedAt.current}-${open ? 'open' : 'closed'}`}
          ref={viewerScroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={photos.length > 1}
          contentOffset={{ x: startIndex * screenWidth, y: 0 }}
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            setViewerPage(Math.max(0, Math.round(event.nativeEvent.contentOffset.x / screenWidth)));
          }}
        >
          {photos.map((item, index) => (
            <View
              key={`full-${item.hash ?? 'photo'}-${index}`}
              style={{ width: screenWidth, height: viewerHeight }}
            >
              <RemoteImage item={item} fit="contain" style={styles.fill} onError={onError} />
            </View>
          ))}
        </ScrollView>
        {photos.length > 1 ? (
          <Text style={styles.viewerCount}>{`${Math.min(viewerPage + 1, photos.length)}/${photos.length}`}</Text>
        ) : null}
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  block: { width: '100%', height: '100%', overflow: 'hidden' },
  /** The author's framed block: it is exactly what `textStyle.media` describes. */
  framed: { position: 'absolute', overflow: 'hidden' },
  page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, backgroundColor: 'rgba(8,10,13,0.72)',
  },
  countText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  playDisc: {
    position: 'absolute', left: '50%', top: '50%', width: 48, height: 48, marginLeft: -24, marginTop: -24,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,10,13,0.64)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  playGlyph: {
    width: 0, height: 0, marginLeft: 4, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ffffff',
  },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerBar: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 12,
  },
  viewerTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  close: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  closeText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  viewerCount: {
    alignSelf: 'center', color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(8,10,13,0.72)',
  },
});

