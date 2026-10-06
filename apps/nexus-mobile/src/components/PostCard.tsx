import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { compactCount, initialsFor, internalMediaUrl, relativeTime, type SocialPost } from '../lib/socialTypes';
import { mediaUrl } from '../lib/nexusApi';
import { socialTokens } from '../theme/social';

/**
 * One post, drawn with the values of the web card (styles.css:8 `.post`, :31 the tweets surface):
 * a 14px card on #0b151e with a 1px #22313c edge, the author above the media, the caption under it,
 * and the counters the server already returned. Nothing is invented: an absent counter prints nothing.
 */
export function PostCard({ post, onOpen }: { post: SocialPost; onOpen?: (post: SocialPost) => void }) {
  const [playVideo, setPlayVideo] = useState(false);
  const avatar = internalMediaUrl(post.author?.avatar);
  const cover = mediaUrl(post.media ? { hash: post.media.hash, ext: post.media.ext } : null);
  const isVideo = post.media?.kind === 'video';
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Postarea lui @${handle}`} onPress={() => onOpen?.(post)} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatarWrap}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} accessibilityIgnoresInvertColors />
            : <Text style={styles.avatarInitials}>{initialsFor(name, handle)}</Text>}
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

      {cover && !isVideo ? <Image source={{ uri: cover }} resizeMode="contain" style={styles.media} accessibilityIgnoresInvertColors /> : null}
      {cover && isVideo ? (
        playVideo
          ? <VideoPost uri={cover} />
          : (
            <Pressable accessibilityRole="button" accessibilityLabel="Redă clipul" onPress={() => setPlayVideo(true)} style={[styles.media, styles.videoCover]}>
              <Text style={styles.play}>▶</Text>
            </Pressable>
          )
      ) : null}

      <View style={styles.counters}>
        {compactCount(post.view_stats?.viewers) ? <Text style={styles.counter}>{`${compactCount(post.view_stats?.viewers)} vizualizări`}</Text> : null}
        {compactCount(post.comment_count) ? <Text style={styles.counter}>{`${compactCount(post.comment_count)} comentarii`}</Text> : null}
      </View>
    </Pressable>
  );
}

function VideoPost({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView style={styles.media} player={player} contentFit="contain" nativeControls />;
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
  media: { width: '100%', height: 380, marginTop: 10, borderRadius: 12, backgroundColor: '#000000' },
  videoCover: { alignItems: 'center', justifyContent: 'center' },
  play: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  counters: { flexDirection: 'row', gap: 14, marginTop: 10, minHeight: 16 },
  counter: { color: socialTokens.colors.muted, fontSize: 12 },
});
