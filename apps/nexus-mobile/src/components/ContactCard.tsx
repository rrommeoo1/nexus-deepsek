import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Conversation, StoryView } from '../lib/socialTypes';
import { initialsFor, mediaSourceForPath } from '../lib/socialTypes';
import { fetchContactStories } from '../lib/stories';
import { openSocialProfile } from '../lib/profileNavigation';
import { useRelation } from '../lib/relations';
import { RemoteImageSource } from './PostMedia';
import { RelationButton } from './RelationButton';
import { StoryViewer } from './StoryViewer';

/**
 * `#messengerContact` — the second tap target of an inbox row (`messenger-shell.js:24` draws the
 * avatar as its own button, `messenger-contact.js:82-108` is the dialog it opens):
 *
 *   messenger-spaces.css:26   `.messengerContact` — min(360px, 100vw-24px), padding 20, border 1px
 *                             #375775, radius 20, #0e1a27, max-height 85dvh
 *   :27                       the close disc: 44x44, top/end 8, radius 50%, #13283b, 28px mark
 *   :28                       `.contactPhoto` 132x132 radius 16 on #244154, `h2` 22px at 12px/6px
 *   :29                       `.contactQuickActions` — 4 equal columns, gap 4, margin-top 20, and each
 *                             button is a 76px column of a 26px mark over its label (`:13` type)
 *   :31                       `.contactStory` — a 44px band on the photo, #071b28e8, #73fff0
 *   messenger-contact.js:83-84 the four actions and the keys they print
 *   messenger-shell.js:8      `personaBadge` — the five persona names
 *   contact-stories.js:22-25  the peer's stories, read only when the card is opened for a Social peer
 *
 * The call actions report the product's own sentence for a call that cannot start
 * (`thread.callUnavailable`, «Apel indisponibil pe acest dispozitiv»): calls need the SFU and this
 * build ships no call client, so the control is drawn and says why instead of being absent. The profile
 * action opens the same profile surface the web opens (`openProfile(peer.handle)`), filled from the same
 * `GET /api/profiles/:handle` the rest of the app reads.
 */
const COPY = {
  close: 'Închide',
  message: 'Mesaj Jungle Book',
  audio: 'Apel audio',
  video: 'Apel video',
  profile: 'Profil',
  story: 'Story',
  callUnavailable: 'Apel indisponibil pe acest dispozitiv',
};

/** `personaBadge` of `messenger-shell.js:7-11` — the five names, and nothing for anything else. */
const PERSONAS: Record<string, string> = {
  social: 'Social', dating: 'Dating', work: 'Work', travel: 'Travel', market: 'Market',
};

/** `messenger-contact.js:55-60` — the four marks, 24x24, `stroke:currentColor`, width 1.7. */
const MARKS: Record<string, string> = {
  message: 'M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z',
  audio: 'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z',
  video: 'm15 9 6-3v12l-6-3Z',
  profile: 'M4 21v-2a8 8 0 0 1 16 0v2Z',
};

function Mark({ kind, ink = '#e4f7ff' }: { kind: keyof typeof MARKS; ink?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'video' ? <Rect x={3} y={5} width={12} height={14} rx={3} /> : null}
      {kind === 'profile' ? <Circle cx={12} cy={7} r={4} /> : null}
      <Path d={MARKS[kind]} />
    </Svg>
  );
}


export function ContactCard({ conversation, viewerId, onClose, onOpenThread, onStories }: {
  /** The row whose avatar was pressed. */
  conversation: Conversation;
  viewerId?: number;
  onClose: () => void;
  /** `action === 'message'` opens the thread the row already opens (`messenger-contact.js:44`). */
  onOpenThread: () => void;
  /** The peer's stories, handed to the same full-screen reader the shelf uses. */
  onStories?: (stories: StoryView[]) => void;
}) {
  const peer = (conversation.participants ?? []).find((person) => person.id !== viewerId) ?? conversation.participants?.[0];
  const persona = PERSONAS[String(conversation.context_persona || '')] ? String(conversation.context_persona) : '';
  const title = peer?.display_name || peer?.handle || 'Jungle Book';
  const avatar = mediaSourceForPath(peer?.avatar);
  const [status, setStatus] = useState('');
  const [stories, setStories] = useState<StoryView[] | null>(null);
  const [storiesOpen, setStoriesOpen] = useState(false);
  /**
   * The peer's relation, from the one store. `messenger-contact.js` has no follow action of its own; the
   * app's rule is that every place a face is printed answers the same question the same way, so the card
   * carries the chip the feed card, the comment row and the search result carry.
   */
  const relation = useRelation(peer?.id);
  const relationTarget = Number.isSafeInteger(Number(peer?.id)) && Number(peer?.id) > 0 && Number(peer?.id) !== Number(viewerId)
    && peer?.handle
    ? { userId: Number(peer.id), handle: String(peer.handle), name: title, persona: persona || 'social' }
    : null;

  /**
   * `messenger-contact.js:109-128` — the peer's stories are read for a Social peer only, and the band is
   * drawn only when the answer really carried rows for this peer.
   */
  useEffect(() => {
    if (!peer?.id || persona !== 'social') return;
    let alive = true;
    fetchContactStories(peer.id, viewerId)
      .then((items) => { if (alive && items?.length) setStories(items); })
      .catch(() => { /* the card stays without the band, exactly as the web's `.catch(() => {})` */ });
    return () => { alive = false; };
  }, [peer?.id, persona, viewerId]);

  const act = useCallback((action: 'message' | 'audio' | 'video' | 'profile') => {
    if (action === 'message') { onClose(); onOpenThread(); return; }
    if (action === 'profile') { openSocialProfile(peer?.handle, onClose); return; }
    /** Calls are the server's own surface (SFU); this build has none, so the card says so. */
    setStatus(COPY.callUnavailable);
  }, [onClose, onOpenThread, peer?.handle]);

  /** `messenger-contact.js:116-125` — the band re-reads before it opens, and says so when nothing is left. */
  const openStory = useCallback(() => {
    const peerId = Number(peer?.id || 0);
    if (!peerId) return;
    setStatus('');
    fetchContactStories(peerId, viewerId)
      .then((items) => {
        if (!items?.length) { setStatus('Profil indisponibil'); return; }
        setStories(items);
        setStoriesOpen(true);
        onStories?.(items);
      })
      .catch(() => setStatus('Profil indisponibil'));
  }, [onStories, peer?.id, viewerId]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={COPY.close} onPress={onClose} style={styles.dismiss} />
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.close} onPress={onClose} style={styles.close}>
            <Text style={styles.closeMark}>×</Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${peer?.handle || title}`} onPress={() => openSocialProfile(peer?.handle, onClose)} style={styles.photo}>
            <RemoteImageSource source={avatar} fit="cover" style={styles.photoImage} />
            {!avatar ? <Text style={styles.photoInitials}>{initialsFor(title, peer?.handle)}</Text> : null}
            {stories?.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${COPY.story} · ${title}`}
                onPress={openStory}
                style={styles.story}
              >
                <Text style={styles.storyText}>{COPY.story}</Text>
              </Pressable>
            ) : null}
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${peer?.handle || title}`} onPress={() => openSocialProfile(peer?.handle, onClose)}><Text style={styles.name} numberOfLines={2}>{title}</Text></Pressable>
          {persona ? <Text style={styles.persona}>{persona}</Text> : null}
          {relationTarget ? <RelationButton variant="compact" target={relationTarget} relation={relation} viewerUserId={viewerId ?? null} style={styles.relation} /> : null}

          <View style={styles.actions}>
            {([
              ['message', COPY.message], ['audio', COPY.audio], ['video', COPY.video], ['profile', COPY.profile],
            ] as const).map(([action, label]) => (
              <Pressable
                key={action}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => act(action)}
                style={styles.action}
              >
                <Mark kind={action} />
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
        </View>
      </View>

      {storiesOpen && stories?.length ? (
        <StoryViewer stories={stories} startIndex={0} onClose={() => setStoriesOpen(false)} viewerId={viewerId ?? null} />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** `.messengerContact::backdrop{background:#0009}` */
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'rgba(0,0,0,0.6)' },
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** `.messengerContact{width:min(360px,100vw-24px);padding:20px;border:1px solid #375775;border-radius:20px;background:#0e1a27}` */
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderWidth: 1,
    borderColor: '#375775',
    borderRadius: 20,
    backgroundColor: '#0e1a27',
    alignItems: 'center',
  },
  /** `.messengerContact>[data-contact-close]{position:absolute;inset-inline-end:8px;top:8px;width:44px;height:44px;border-radius:50%;background:#13283b}` */
  close: { position: 'absolute', right: 8, top: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#13283b' },
  closeMark: { color: '#ffffff', fontSize: 28, lineHeight: 30 },
  /** `.contactPhoto{width:132px;height:132px;border-radius:16px;background:#244154;font-size:32px}` */
  photo: { width: 132, height: 132, borderRadius: 16, overflow: 'hidden', backgroundColor: '#244154', alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: '100%', height: '100%' },
  photoInitials: { color: '#eef7fc', fontSize: 32 },
  /** `.contactStory{position:absolute;inset-inline:0;bottom:0;min-height:44px;background:#071b28e8;color:#73fff0;font-size:15px}` */
  story: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,27,40,0.91)' },
  storyText: { color: '#73fff0', fontSize: 15 },
  /** `.messengerContact h2{font-size:22px;margin:12px 0 6px}` */
  name: { color: '#eef7fc', fontSize: 22, fontWeight: '700', marginTop: 12, marginBottom: 6, textAlign: 'center' },
  /** `.conversationPersona` — the pill the row and the card both print. */
  persona: { color: '#8fd6cf', fontSize: 12, fontWeight: '600' },
  /** The relation chip sits between the persona line and the four quick actions, centred like both. */
  relation: { alignSelf: 'center', marginTop: 10 },
  /** `.contactQuickActions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:20px}` */
  actions: { flexDirection: 'row', gap: 4, marginTop: 20, alignSelf: 'stretch' },
  /** `button{min-height:76px;gap:8px;padding:6px 2px;border-radius:12px;background:#14293c;color:#e4f7ff;font-size:13px}` */
  action: { flexGrow: 1, flexBasis: 0, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 6, borderRadius: 12, backgroundColor: '#14293c' },
  actionText: { color: '#e4f7ff', fontSize: 13, textAlign: 'center' },
  /** The `p[role=status]` of `messenger-contact.js:84` — the sentence the card answers with. */
  status: { color: '#9fd7f7', fontSize: 12, lineHeight: 17, marginTop: 10, minHeight: 17, textAlign: 'center' },
  /** The profile the card opens: the same surface the app already reads, behind its own return. */
  profileScreen: { flex: 1, backgroundColor: '#000000' },
  profileBack: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  profileBackText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
