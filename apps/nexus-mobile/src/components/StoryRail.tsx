import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RemoteImageSource, RemoteVideo } from './PostMedia';
import {
  initialsFor, mediaKindOf, mediaSourceFor, mediaSourceForPath, type StoryView,
} from '../lib/socialTypes';

/**
 * The shelf of moments, drawn to the measurements of the web tray
 * (`feed-surface.css:156-200`, measured live in `docs/web-ref/messages/inbox-0.dom.json`):
 *
 *   `#storyRail.stories`        437x160 at y=134, gap 10, padding 8/2/6, gradient teal -> violet
 *   `.storyCard`                98x150 (the reader's own) / 98x126 (one with a picture), radius 16
 *   `.storyPrism`               98x126, radius 15, `linear-gradient(160deg,#1a2b3d,#0a121c)`
 *   `.storyName`                band under the picture: 11px/800, padding 26/8/8, gradient to rgba(3,8,14,.88)
 *   `.storyUnseen .storyPrism`  `0 0 0 2px rgba(36,240,210,.85), 0 0 0 4px rgba(9,14,22,.9), 0 0 22px rgba(36,240,210,.22)`
 *   `.storyViewed .storyPrism`  `0 0 0 2px rgba(135,183,220,.16)` + `saturate(.55) brightness(.8)`
 *   `.createPrism`              dashed 1px `rgba(36,240,210,.5)`, initials 20px `var(--teal)` = #20e0d0
 *   `.storyAddBadge`            26x26 circle, `linear-gradient(145deg,#5cf6e7,#12bfb4)`, 2px `#0a1119` edge, `+` 17px/900
 *
 * `saturate(.55) brightness(.8)` has no React Native equivalent; a seen card carries the same dimming
 * through `opacity` on its picture and keeps the measured ring. That single substitution is the only
 * value in this file that is not the CSS number, and it is listed in `docs/parity-report/INDEX.md`.
 */
export function StoryRail({ stories, owner, onOpenStory, onAddStory }: {
  stories: StoryView[];
  /** The reader's own record: the door to the camera, exactly like the web's first card. */
  owner: { display_name?: string | null; handle?: string; avatar?: string | null };
  onOpenStory: (index: number) => void;
  onAddStory: () => void;
}) {
  const selfName = String(owner.display_name || owner.handle || '').trim();
  const selfInitials = initialsFor(selfName, owner.handle);
  const selfAvatar = mediaSourceForPath(owner.avatar);

  return (
    <View accessibilityLabel="Stories" style={styles.tray}>
      {/* `linear-gradient(90deg,rgba(32,224,208,.05),transparent 46%,rgba(140,98,255,.06))` */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxStoryTray" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#20e0d0" stopOpacity={0.05} />
            <Stop offset="0.46" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#8c62ff" stopOpacity={0.06} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#nxStoryTray)" />
      </Svg>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Story-ul tău"
          onPress={onAddStory}
          style={styles.ownCard}
        >
          <View style={[styles.prism, styles.createPrism]}>
            {selfAvatar ? <RemoteImageSource source={selfAvatar} fit="cover" style={styles.media} /> : null}
            {!selfAvatar ? <Text style={styles.createInitials}>{selfInitials}</Text> : null}
            <View style={styles.addBadge}><Text style={styles.addBadgeText}>+</Text></View>
          </View>
          <Text style={styles.ownLabel} numberOfLines={1}>Story-ul tău</Text>
        </Pressable>

        {stories.map((story, index) => (
          <StoryCard key={story.id} story={story} onPress={() => onOpenStory(index)} />
        ))}
      </ScrollView>
    </View>
  );
}

function StoryCard({ story, onPress }: { story: StoryView; onPress: () => void }) {
  const name = String(story.author?.display_name || story.author?.handle || '?');
  const item = story.media ?? null;
  const kind = mediaKindOf(item);
  const seen = Boolean(story.viewed_by_me);
  const source = kind === 'image' ? mediaSourceFor(item) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={String(story.caption || name)}
      onPress={onPress}
      style={styles.card}
    >
      <View style={[styles.prism, seen ? styles.prismSeen : styles.prismUnseen]}>
        {source ? <RemoteImageSource source={source} fit="cover" style={[styles.media, seen && styles.mediaSeen]} /> : null}
        {kind === 'video' ? (
          <RemoteVideo item={item} style={[styles.media, seen && styles.mediaSeen]} active={false} muted loop={false} fit="cover" />
        ) : null}
        {!item ? <Text style={styles.initials}>{initialsFor(name, story.author?.handle)}</Text> : null}
        <View style={styles.nameBand}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="nxStoryName" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#03080e" stopOpacity={0} />
                <Stop offset="1" stopColor="#03080e" stopOpacity={0.88} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#nxStoryName)" />
          </Svg>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  /** `.inboxScreen>.stories{height:160px;margin:0 0 12px;padding:8px 2px 6px;gap:10px}` */
  tray: { height: 160, marginBottom: 12, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10 },
  /** `.inboxScreen .stories .storyCard{width:98px;height:150px;gap:7px;border-radius:16px}` */
  card: { width: 98, borderRadius: 16 },
  /** `.feedStoryOwn{gap:3px}` — the reader's own card keeps the line under its picture. */
  ownCard: { width: 98, borderRadius: 16, gap: 3 },
  /** `.storyPrism{width:98px;height:126px;border-radius:15px;overflow:hidden;background:linear-gradient(160deg,#1a2b3d,#0a121c)}` */
  prism: {
    width: 98,
    height: 126,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a121c',
  },
  /** `.createPrism{border:1px dashed rgba(36,240,210,.5)!important;background:linear-gradient(160deg,rgba(16,42,49,.9),rgba(12,20,34,.9))!important}` */
  createPrism: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(36,240,210,0.5)', backgroundColor: 'rgba(14,31,41,0.9)' },
  /** `.storyUnseen .storyPrism` — the accent ring around the picture, drawn as a shadow so the picture keeps its size. */
  prismUnseen: { boxShadow: '0 0 0 2px rgba(36,240,210,0.85), 0 0 0 4px rgba(9,14,22,0.9), 0 0 22px rgba(36,240,210,0.22)' },
  /** `.storyViewed .storyPrism{box-shadow:0 0 0 2px rgba(135,183,220,.16)}` */
  prismSeen: { boxShadow: '0 0 0 2px rgba(135,183,220,0.16)' },
  /** `.inboxScreen .stories .storyPrism img,.storyPrism video{position:relative;z-index:1;width:100%;height:100%;object-fit:cover}` */
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  /** `filter:saturate(.55) brightness(.8)` — replaced by the same dimming through opacity (documented limit). */
  mediaSeen: { opacity: 0.72 },
  /** `.storyInitials{...color:#fff;font-size:19px;font-weight:800}` (measured on the live card). */
  initials: { color: '#ffffff', fontSize: 19, fontWeight: '800' },
  /** `.createPrism>b{color:var(--teal)}` — measured 19px/800 white over the dashed disc. */
  createInitials: { color: '#20e0d0', fontSize: 19, fontWeight: '800' },
  /** `.storyAddBadge{inset-inline-end:6px;bottom:6px;width:26px;height:26px;border:2px solid #0a1119;border-radius:50%}` */
  addBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#0a1119',
    backgroundColor: '#12bfb4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `linear-gradient(145deg,#5cf6e7,#12bfb4)` + `+` 17px/900 `#03110f`. */
  addBadgeText: { color: '#03110f', fontSize: 17, fontWeight: '900', lineHeight: 18 },
  /** `.feedStoryOwn>span{max-width:98px;color:#cad6da;font-size:11px;text-align:center}` */
  ownLabel: { maxWidth: 98, color: '#cad6da', fontSize: 11, textAlign: 'center' },
  /** `.storyName{position:absolute;left:0;right:0;bottom:0;padding:26px 8px 8px;overflow:hidden}` */
  nameBand: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 26, paddingHorizontal: 8, paddingBottom: 8 },
  /** `.storyName{color:#fff;font-size:11px;font-weight:800;line-height:1.2;text-shadow:0 1px 8px rgba(0,0,0,.7)}` */
  name: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});

