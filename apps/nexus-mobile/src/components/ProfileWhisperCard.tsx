import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ReactionControl } from './ReactionControl';
import { RemoteImageSource } from './PostMedia';
import { openCommentsPage, openReplyThread } from '../lib/commentNavigation';
import { setPostReaction, setPostRepost } from '../lib/postInteractions';
import { whySignals, type ArchivePost, type SharedReplyCard } from '../lib/profileContent';
import { initialsFor, mediaSourceForPath, relativeTime, type ReactionSummary } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The two cards of the profile's words, drawn to `profile-experience.css` and measured against
 * `docs/web-ref/profile/tab-3.dom.json` (the Whisper tab, where a card sits fully in view):
 *
 *   `.ownerWhisperCard`        x=12 w=445, padding 12, `border:1px solid #22323b`, `border-left:2px solid
 *                              rgba(33,234,220,.42)`, radius 16, `gap:8px`,
 *                              `linear-gradient(160deg,#0b141c,#081019)`, ink #eef8fb
 *   `.ownerSharedReplyCard`    the same card with a quieter left edge (`#2a4a53`)
 *   `.postRepostedBy`          12px #8ff5ee, `padding:0 2px`, `margin-bottom:6px`, its `<b>` at 600, the
 *                              handle of whoever shared it at #9fb0ba and the post's author at #8e9ca5
 *   `.ownerWhisperHead`        disc 38px, ring `rgba(33,234,220,.5)`, plate #09131c, `gap:10px`
 *   `.ownerWhisperWho`         name 14px/1.2, then `@handle · acum 17 zile` at 11.5px #93a5ae
 *   `.ownerWhisperBody`        15px/1.45 #dbe7ec
 *   `.rankReason`              11px/1.35 #9fb4bd, `margin:3px 0 7px`, its label #7fd8cf
 *   `.ownerWhisperActions`     38px plates (`ReactionControl`'s whisper variant holds their measurements)
 *   `.ownerSharedReplyOpen`    36px, `padding:0 12px`, `#2c4d55` edge, #0e1c25 plate, 12px #8ff5ee
 *
 * Every word is the ro-RO bundle's own, never a paraphrase: `x.repost.mine` („Ai repostat") and `x.repost.by`
 * („a repostat") open a share, `profile.sharedReplyOn` („la postarea") names the post a shared reply came from,
 * `profile.openReply` is the button that opens it, `comments.title` is the conversation's door and
 * `post.repost` with `x.repost.undo` are the two readings of the repost press.
 *
 * The whisper's head prints the identity of the profile the archive belongs to, because that is what the web
 * prints there: `whisperCards` reuses the hero's own `name`/`avatarMarkup` and `profile.handle`
 * (`profile-experience.js:188-204`, `:276-278`). A whisper that arrived as a repost says who shared it on
 * its first line, which is what makes the two readings different rather than duplicated.
 *
 * One honest difference, written down rather than hidden: the web opens a conversation *inside* the card
 * (`data-comments` swaps in a drawer) and floats the reaction palette above its own button. This app opens
 * the conversation as its own page — the same door `PostCard` already uses — so a card carries the count and
 * the press, never a second list of replies drawn inside a card.
 */
export function ProfileWhisperCard({ post, author, woven = false }: {
  post: ArchivePost;
  /** The identity the card's head prints: the profile the archive belongs to. */
  author: { name?: string | null; handle?: string | null; avatar?: string | null };
  /** The Flow weaves this card into its stream: `.ownerFlowStream>.ownerWhisperCard{margin:6px 10px}`. */
  woven?: boolean;
}) {
  const [summary, setSummary] = useState<ReactionSummary | null>(post.reactions ?? null);
  const [reposted, setReposted] = useState(Boolean(post.reposted_by_me));
  const [notice, setNotice] = useState('');

  const reposter = post.__repost ?? null;
  const signals = whySignals(post);
  const handle = String(author.handle || '');
  const name = String(author.name || handle || 'Jungle Book');
  const caption = String(post.caption || '');
  const commentTotal = Math.max(0, Number(post.comment_count) || 0);
  const repostTotal = Math.max(0, Number(post.reposts) || 0);

  const fail = (cause: unknown) => setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');

  const react = (kind: string, active: boolean) => {
    setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: active ? kind : null }));
    setPostReaction(post.id, kind, active)
      .then((answer) => setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction }))
      .catch(fail);
  };

  const repostIt = () => {
    const next = !reposted;
    setReposted(next);
    setPostRepost(post.id, next)
      .then((answer) => setReposted(Boolean(answer.reposted_by_me ?? answer.active)))
      .catch((cause) => { setReposted(!next); fail(cause); });
  };


  return (
    <View style={[styles.card, woven && styles.woven]}>
      <WhisperPlate />

      {reposter ? (
        <View style={styles.repostLine}>
          <Text accessible={false} style={styles.repostGlyph}>⟳</Text>
          <Text style={styles.repostWho}>{reposter.mine ? 'Ai repostat' : 'a repostat'}</Text>
          {!reposter.mine && reposter.reposter?.handle
            ? <Text style={styles.repostHandle}>{`@${reposter.reposter.handle}`}</Text>
            : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Postarea lui @${handle || 'junglebook'}`}
        onPress={() => openCommentsPage(post)}
        style={styles.open}
      >
        <WhisperHead author={{ name, handle, avatar: author.avatar ?? null }} at={post.created_at} />
        {caption ? <Text style={styles.body}>{caption}</Text> : null}
      </Pressable>

      {/** `rankingReasonMarkup(post, { context: 'profile' })` — the reader's own signals, never an order claim. */}
      {signals ? (
        <Text style={styles.reason}>
          <Text accessible={false} style={styles.reasonGlyph}>{'✦ '}</Text>
          <Text style={styles.reasonLabel}>{signals.label}</Text>
          {` ${signals.sentences}`}
        </Text>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actions}>
        {/** `control.summary` of `app.js`, in the plate the whisper's own row gives it. */}
        <ReactionControl variant="whisper" summary={summary} onReact={react} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comentarii"
          onPress={() => openCommentsPage(post)}
          style={styles.action}
        >
          <Text accessible={false} style={styles.actionGlyph}>◌</Text>
          <Text style={styles.actionCount}>{String(commentTotal)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reposted ? 'Anulează repostarea' : 'Repost'}
          accessibilityState={{ selected: reposted }}
          onPress={repostIt}
          style={[styles.action, reposted && styles.actionOn]}
        >
          <Text accessible={false} style={[styles.actionGlyph, reposted && styles.actionOnInk]}>⟳</Text>
          <Text style={[styles.actionCount, reposted && styles.actionOnCount]}>{String(repostTotal)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A reply that was shared from a conversation (`profile-experience.js:292-308`): the other kind of internal
 * share. Its head is the reply's own author — the reply is not the profile's — its first line names the post
 * it came from, and its one press opens that reply in the thread it was written in (`openReplyThread`, the
 * web's `openReplyDeepLink` through `data-open-reply`).
 */
export function ProfileSharedReplyCard({ reply, woven = false }: {
  reply: SharedReplyCard;
  woven?: boolean;
}) {
  const handle = reply.author.handle || '';
  const name = reply.author.name || handle || 'Jungle Book';
  const body = String(reply.comment.body || '');

  return (
    <View style={[styles.card, styles.sharedCard, woven && styles.woven]}>
      <WhisperPlate />

      <View style={styles.repostLine}>
        <Text accessible={false} style={styles.repostGlyph}>⟳</Text>
        <Text style={styles.repostWho}>{reply.mine ? 'Ai repostat' : 'a repostat'}</Text>
        {/**
         * `profile.sharedReplyOn` = „la postarea", and the handle follows it. The sentence is printed only
         * while the payload named the author whose post it was: „la postarea" with nothing after it names
         * no one, and a sentence that trails off is worse than no sentence.
         */}
        {reply.onPostBy ? <Text style={styles.repostMuted}>{`la postarea ${reply.onPostBy}`}</Text> : null}
      </View>

      <WhisperHead author={{ name, handle, avatar: reply.author.avatar }} at={reply.at} />
      {body ? <Text style={styles.body}>{body}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deschide răspunsul în conversație"
        onPress={() => openReplyThread(reply.post, Number(reply.comment.id))}
        style={styles.openReply}
      >
        <Text accessible={false} style={styles.openReplyText}>Deschide răspunsul în conversație</Text>
      </Pressable>
    </View>
  );
}

/**
 * `.ownerWhisperCard{background:linear-gradient(160deg,#0b141c,#081019)}`, written as the SVG gradient the
 * rest of this app already uses for a CSS gradient (the story tray): the plate is the first stop's colour,
 * the gradient runs from the top-left corner, and `pointerEvents="none"` keeps it out of every press.
 */
function WhisperPlate() {
  return (
    /** The clip is the plate's own: the card itself stays open, because the palette floats out of it. */
    <View pointerEvents="none" style={styles.plate}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxWhisperCard" x1="0" y1="0" x2="0.34" y2="0.94">
            <Stop offset="0" stopColor="#0b141c" />
            <Stop offset="1" stopColor="#081019" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#nxWhisperCard)" />
      </Svg>
    </View>
  );
}

/**
 * `.ownerWhisperHead`: the 38px disc, the name it belongs to, and the `@handle · time` line under it. The
 * disc is a decoration — the identity is the very next line — which is how the web leaves it too (`<img
 * alt="">` on a shared reply's avatar).
 */
function WhisperHead({ author, at }: {
  author: { name: string; handle: string; avatar?: string | null };
  at?: number | string | null;
}) {
  const avatar = mediaSourceForPath(author.avatar);
  const line = [author.handle ? `@${author.handle}` : '', relativeTime(at)].filter(Boolean).join(' · ');
  return (
    <View style={styles.head}>
      <View accessible={false} style={styles.miniAvatar}>
        {avatar ? <RemoteImageSource source={avatar} fit="cover" style={styles.miniAvatarImage} /> : null}
        {!avatar ? <Text style={styles.miniAvatarInitials}>{initialsFor(author.name, author.handle)}</Text> : null}
      </View>
      <View style={styles.who}>
        <Text style={styles.name} numberOfLines={1}>{author.name}</Text>
        {line ? <Text style={styles.meta} numberOfLines={1}>{line}</Text> : null}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  /** `.ownerWhisperCard{gap:8px;padding:12px;border:1px solid #22323b;border-left:2px solid rgba(33,234,220,.42);border-radius:16px}` */
  card: {
    gap: socialTokens.archive.cardGap,
    padding: socialTokens.archive.cardPadding,
    borderWidth: 1,
    borderLeftWidth: 2,
    borderColor: socialTokens.archive.cardBorder,
    borderLeftColor: socialTokens.archive.cardEdge,
    borderRadius: socialTokens.archive.cardRadius,
    backgroundColor: socialTokens.archive.cardSurface,
  },
  /**
   * `background:linear-gradient(160deg,#0b141c,#081019)` — the plate keeps its own rounded clip, and the
   * card around it stays open so the reaction palette can float above the button that opened it.
   */
  plate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: socialTokens.archive.cardRadius,
    overflow: 'hidden',
  },
  /** `.ownerSharedReplyCard{border-left-color:#2a4a53}` — the share's edge is quieter than a whisper's. */
  sharedCard: { borderLeftColor: socialTokens.archive.cardShareEdge },
  /** `.ownerFlowStream>.ownerWhisperCard{grid-column:1/-1;margin:6px 10px}` once tiles were woven above it. */
  woven: {
    marginVertical: socialTokens.archive.cardFlowMarginTop,
    marginHorizontal: socialTokens.archive.cardFlowMarginHorizontal,
  },
  /** The head and the body are the one press the card offers outside its controls (`data-post-open`). */
  open: { gap: socialTokens.archive.cardGap },
  /** `.postRepostedBy{gap:5px;margin-bottom:6px;padding:0 2px;color:#8ff5ee;font-size:12px}` */
  repostLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: socialTokens.archive.repostLineGap,
    paddingHorizontal: 2,
    marginBottom: socialTokens.archive.repostLineMarginBottom,
  },
  repostGlyph: { color: socialTokens.archive.repostLineInk, fontSize: socialTokens.archive.repostLineSize },
  repostWho: { color: socialTokens.archive.repostLineInk, fontSize: socialTokens.archive.repostLineSize, fontWeight: '600' },
  /** `.postRepostedBy bdi{color:#9fb0ba}` — the handle of whoever shared it. */
  repostHandle: { color: socialTokens.archive.repostLineHandle, fontSize: socialTokens.archive.repostLineSize },
  /** `.ownerSharedReplyCard .postRepostedBy span{color:#8e9ca5;font-weight:400}` — whose post it came from. */
  repostMuted: { color: socialTokens.archive.repostLineMuted, fontSize: socialTokens.archive.repostLineSize },
  /** `.ownerWhisperHead{display:flex;align-items:center;gap:10px}` */
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** `.ownerWhisperAvatar{width:38px;height:38px;border:1px solid rgba(33,234,220,.5);border-radius:50%;background:#09131c}` */
  miniAvatar: {
    flexGrow: 0,
    flexShrink: 0,
    width: socialTokens.archive.miniAvatar,
    height: socialTokens.archive.miniAvatar,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: socialTokens.archive.miniAvatarBorder,
    borderRadius: socialTokens.archive.miniAvatarRadius,
    backgroundColor: socialTokens.archive.miniAvatarSurface,
  },
  miniAvatarImage: { width: '100%', height: '100%' },
  miniAvatarInitials: { color: socialTokens.archive.miniAvatarInk, fontSize: socialTokens.archive.miniAvatarSize, fontWeight: '700' },
  /** `.ownerWhisperWho{display:grid;gap:2px;min-width:0}` */
  who: { flex: 1, minWidth: 0, gap: 2 },
  /** `.ownerWhisperWho b{font-size:14px;line-height:1.2}` */
  name: { color: socialTokens.archive.cardInk, fontSize: socialTokens.archive.cardNameSize, lineHeight: 16.8 },
  /** `.ownerWhisperWho small{color:#93a5ae;font-size:11.5px}` */
  meta: { color: socialTokens.archive.cardMetaInk, fontSize: socialTokens.archive.cardMetaSize },
  /** `.ownerWhisperBody{color:#dbe7ec;font-size:15px;line-height:1.45}` */
  body: {
    color: socialTokens.archive.cardBodyInk,
    fontSize: socialTokens.archive.cardBodySize,
    lineHeight: socialTokens.archive.cardBodyLineHeight,
  },
  /** `.rankReason{margin:3px 0 7px;color:#9fb4bd;font-size:11px;line-height:1.35}` */
  reason: {
    marginTop: socialTokens.archive.reasonMarginTop,
    marginBottom: socialTokens.archive.reasonMarginBottom,
    color: socialTokens.archive.reasonInk,
    fontSize: socialTokens.archive.reasonSize,
    lineHeight: socialTokens.archive.reasonLineHeight,
  },
  reasonGlyph: { color: socialTokens.archive.reasonInk },
  reasonLabel: { color: socialTokens.archive.reasonLabelInk },
  /** The app's own ink for a refused write, the one `PostCard` prints. */
  notice: { color: '#ffb4b4', fontSize: 12 },
  /** `.ownerWhisperActions{display:flex;align-items:center;gap:6px}` */
  actions: { flexDirection: 'row', alignItems: 'center', gap: socialTokens.archive.actionGap },
  /** `.ownerWhisperAction{min-height:38px;padding:0 10px;border:1px solid transparent;border-radius:11px}` */
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: socialTokens.archive.actionGap,
    minHeight: socialTokens.archive.actionMinHeight,
    paddingHorizontal: socialTokens.archive.actionPaddingHorizontal,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: socialTokens.archive.actionRadius,
    backgroundColor: socialTokens.archive.actionSurface,
  },
  actionOn: { borderColor: socialTokens.archive.actionOnBorder },
  /** `.ownerWhisperAction i{font-size:14px}` — the mark keeps the plate's own ink. */
  actionGlyph: { color: socialTokens.archive.actionInk, fontSize: socialTokens.archive.actionGlyphSize },
  actionOnInk: { color: socialTokens.archive.actionOnInk },
  /** `.ownerWhisperAction small{font-size:12px;color:#c7d5dc}` */
  actionCount: { color: socialTokens.archive.actionCountInk, fontSize: socialTokens.archive.actionCountSize, fontWeight: '700' },
  actionOnCount: { color: socialTokens.archive.actionCountOnInk },
  /** `.ownerSharedReplyOpen{min-height:36px;padding:0 12px;border:1px solid #2c4d55;border-radius:12px;background:#0e1c25}` */
  openReply: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: socialTokens.archive.openReplyMinHeight,
    paddingHorizontal: socialTokens.archive.openReplyPaddingHorizontal,
    borderWidth: 1,
    borderColor: socialTokens.archive.openReplyBorder,
    borderRadius: socialTokens.archive.openReplyRadius,
    backgroundColor: socialTokens.archive.openReplySurface,
  },
  openReplyText: { color: socialTokens.archive.openReplyInk, fontSize: socialTokens.archive.openReplySize },
});

