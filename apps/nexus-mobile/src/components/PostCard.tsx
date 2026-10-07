import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CommentsSheet } from './CommentsSheet';
import { MediaViewer } from './MediaViewer';
import { RemoteImage, RemoteImageSource, type MediaFit } from './PostMedia';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import {
  compactCount, initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems, REACTION_GLYPHS,
  reactionTotal, relativeTime, SOCIAL_REACTIONS, viewerReaction, type SocialPost,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * One post, drawn with the values of the web card (styles.css:8 `.post`): a 14px card on #0b151e with
 * a 1px #22313c edge, the author above the media, the caption under it, and the action row the web
 * wires in `wirePostActions()` - reaction, comments, save, repost, share.
 *
 * The media is fetched through `mediaSourceFor*`, which is the whole reason the phone used to show a
 * black rectangle: `/media/…` answers 401 for a caller without a session, so the picture request has to
 * carry the same session the rest of the app carries.
 */
export function PostCard({ post, onOpen, fit = 'cover' }: {
  post: SocialPost;
  onOpen?: (post: SocialPost) => void;
  fit?: MediaFit;
}) {
  const items = postMediaItems(post);
  const cover = items[0] ?? post.media ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const avatar = mediaSourceForPath(post.author?.avatar);
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;

  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [summary, setSummary] = useState(post.reactions ?? null);
  const [saved, setSaved] = useState(Boolean(post.saved_by_me));
  const [reposted, setReposted] = useState(Boolean(post.reposted_by_me));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const mine = viewerReaction(summary);

  function fail(cause: unknown) {
    setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');
  }

  const react = (kind: string) => {
    const nextActive = mine !== kind;
    setPaletteOpen(false);
    setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: nextActive ? kind : null }));
    setPostReaction(post.id, kind, nextActive)
      .then((answer) => setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction }))
      .catch(fail);
  };

  const save = () => {
    const next = !saved;
    setSaved(next);
    setPostSaved(post.id, next).then((answer) => setSaved(answer.saved)).catch((cause) => { setSaved(!next); fail(cause); });
  };

  const repostIt = () => {
    const next = !reposted;
    setReposted(next);
    setPostRepost(post.id, next)
      .then((answer) => setReposted(Boolean(answer.reposted_by_me ?? answer.active)))
      .catch((cause) => { setReposted(!next); fail(cause); });
  };

  // Sharing stays internal on this product: the server answers with its own sentence and the card prints it.
  const share = () => { sharePost(post.id).catch(fail); };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Postarea lui @${handle}`}
        onPress={() => onOpen?.(post)}
        style={styles.card}
      >
        <View style={styles.head}>
          <View style={styles.avatarWrap}>
            <RemoteImageSource source={avatar} fit="cover" style={styles.avatar} />
            {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, handle)}</Text> : null}
          </View>
          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {`@${handle}`}{relativeTime(post.created_at) ? ` · ${relativeTime(post.created_at)}` : ''}
            </Text>
          </View>
        </View>

        {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

        {cover ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isVideo ? 'Redă clipul pe tot ecranul' : 'Deschide media pe tot ecranul'}
            onPress={() => setViewerOpen(true)}
            style={[styles.media, isVideo ? styles.mediaClip : styles.mediaImage, (isVideo || mediaFailed) && styles.mediaCenter]}
          >
            {isVideo ? <Text style={styles.play}>▶</Text> : null}
            {!isVideo && mediaFailed ? <Text style={styles.unavailable}>Media nu a putut fi afișată.</Text> : null}
            {!isVideo && !mediaFailed ? (
              <RemoteImage item={cover} fit={fit} style={styles.mediaFill} onError={() => setMediaFailed(true)} />
            ) : null}
          </Pressable>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.counters}>
          {compactCount(post.view_stats?.viewers) ? <Text style={styles.counter}>{`${compactCount(post.view_stats?.viewers)} vizualizări`}</Text> : null}
          <Text style={styles.counter}>{`❤ ${reactionTotal(summary) ? compactCount(reactionTotal(summary)) : ''}`.trim()}</Text>
          {compactCount(post.comment_count) ? <Text style={styles.counter}>{`${compactCount(post.comment_count)} comentarii`}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reacționează"
            accessibilityState={{ selected: Boolean(mine) }}
            onPress={() => setPaletteOpen((open) => !open)}
            style={styles.action}
          >
            <Text style={styles.actionGlyph}>{mine ? REACTION_GLYPHS[mine] : '🤍'}</Text>
            <Text style={styles.actionText}>Reacție</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Comentarii" onPress={() => setCommentsOpen(true)} style={styles.action}>
            <Text style={styles.actionGlyph}>💬</Text>
            <Text style={styles.actionText}>Comentarii</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
            accessibilityState={{ selected: saved }}
            onPress={save}
            style={styles.action}
          >
            <Text style={styles.actionGlyph}>{saved ? '🔖' : '🏷'}</Text>
            <Text style={styles.actionText}>Salvează</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reposted ? 'Anulează redistribuirea' : 'Redistribuie'}
            accessibilityState={{ selected: reposted }}
            onPress={repostIt}
            style={styles.action}
          >
            <Text style={styles.actionGlyph}>🔁</Text>
            <Text style={styles.actionText}>Redistribuie</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Distribuie" onPress={share} style={styles.action}>
            <Text style={styles.actionGlyph}>↗</Text>
            <Text style={styles.actionText}>Distribuie</Text>
          </Pressable>
        </View>

        {paletteOpen ? (
          <View style={styles.palette}>
            {SOCIAL_REACTIONS.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={kind}
                accessibilityState={{ selected: mine === kind }}
                onPress={() => react(kind)}
                style={[styles.paletteButton, mine === kind && styles.paletteOn]}
              >
                <Text style={styles.paletteGlyph}>{REACTION_GLYPHS[kind]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Pressable>

      {commentsOpen ? <CommentsSheet post={post} onClose={() => setCommentsOpen(false)} /> : null}

      <MediaViewer post={viewerOpen ? post : null} onClose={() => setViewerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: socialTokens.post.marginBottom,
    padding: socialTokens.post.padding,
    borderWidth: socialTokens.post.borderWidth,
    borderColor: socialTokens.colors.postBorder,
    borderRadius: socialTokens.post.radius,
    backgroundColor: socialTokens.colors.postSurface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820',
  },
  avatar: { width: '100%', height: '100%' },
  avatarInitials: { color: socialTokens.colors.text, fontSize: 13, fontWeight: '800' },
  headText: { flex: 1, minWidth: 0 },
  name: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: socialTokens.colors.muted, fontSize: 12, marginTop: 2 },
  title: { color: socialTokens.colors.text, fontSize: 16, fontWeight: '800', marginTop: 10 },
  caption: { color: socialTokens.colors.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
  /**
   * `.post > .media` — the picture keeps a real aspect ratio instead of a frozen pixel height: a clip
   * holds the phone's 9:16 frame (web cards use `object-fit:contain` on a video-aspect stage,
   * `feed-surface.css:2607-2615`), a photo holds 4:5 (the web skeleton ratio, :257). Tapping the stage
   * opens `MediaViewer`, the full-screen `reelViewer` of the web.
   */
  media: { width: '100%', marginTop: 10, borderRadius: 12, backgroundColor: '#000000', overflow: 'hidden' },
  mediaClip: { aspectRatio: 9 / 16 },
  mediaImage: { aspectRatio: 4 / 5 },
  mediaCenter: { alignItems: 'center', justifyContent: 'center' },
  mediaFill: { width: '100%', height: '100%' },
  unavailable: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  play: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  notice: { color: '#ffb4b4', fontSize: 12, marginTop: 8 },
  counters: { flexDirection: 'row', gap: 14, marginTop: 10, minHeight: 16 },
  counter: { color: socialTokens.colors.muted, fontSize: 12 },
  /** `app.js wirePostActions()` — the five presses the web gives every card, in the same order. */
  actions: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: socialTokens.colors.postBorder,
  },
  action: { alignItems: 'center', justifyContent: 'center', minWidth: 54, gap: 3, paddingVertical: 4 },
  actionGlyph: { fontSize: 17 },
  actionText: { color: socialTokens.colors.muted, fontSize: 11, fontWeight: '600' },
  palette: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, padding: 8, borderRadius: 16,
    backgroundColor: '#0d141b', borderWidth: 1, borderColor: socialTokens.colors.postBorder,
  },
  paletteButton: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  paletteOn: { backgroundColor: 'rgba(255,49,95,0.32)' },
  paletteGlyph: { fontSize: 20 },
});
