import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { draftScope } from '../lib/draftsClient';
import { nexusApi } from '../lib/nexusApi';
import { firstAddress } from '../lib/profileBioText';
import { searchLocations } from '../lib/profileGazetteer';
import {
  ageIsDerived,
  draftBio,
  handleChanged,
  handleWords,
  profileDraft,
  profileEditBody,
  profileEditDirty,
  profileEditIssues,
  profileSaveAccepted,
  savedProfilePatch,
  PROFILE_EDIT_LIMITS,
  HANDLE_PATTERN,
  type HandleAvailability,
  type MediaPick,
  type ProfileDraft,
} from '../lib/profileEdit';
import { mediaSourceForPath, type ProfileView } from '../lib/socialTypes';
import { uploadErrorMessage, uploadMediaResumable } from '../lib/uploadClient';
import { RemoteImageSource } from './PostMedia';
import { socialTokens } from '../theme/social';

/**
 * The words the record's own visibility values are read as (`profile.experience`'s map, `onboarding.js`
 * `visibilityLabelKey`): the switch offers two of them, and the line under it says which one the record
 * holds right now - a profile set to `friends` is not silently shown as either end of the switch.
 */
const VISIBILITY_WORDS: Record<string, string> = {
  public: 'Public',
  friends: 'Prieteni',
  followers: 'Urmăritori',
  private: 'Privat',
};

/**
 * The editor behind `Editează profilul`, the first of the header's two wide buttons: the portrait, the name,
 * the handle, the description with its own character count, the place, the year, what the profile shows and
 * the address inside the description.
 *
 * The **cover** is no longer edited here: the owner removed the cover band from the native profile
 * (`MIGRATION.md` §19.2, `docs/PARITY-MATRIX.md`), and a field that arranges a picture nothing draws would be
 * a control without a subject. Nothing is written about the cover either, so the stored picture stays on the
 * server, untouched and unused — `profileEditBody` only carries a cover when the draft has one.
 *
 * It is the phone's reading of the web's hero editor (`profile-hero-edit.js`) and of the record's own route
 * (`PATCH /api/persona/:persona`), with the places where the phone has nothing to draw: the picker's own square
 * crop where the web draws a cover sheet, and a typed year where the web edits a calendar day.
 *
 * Three rules the web's editor states and this one keeps:
 *  - the bytes go up before the record is written, so a photo that could not be stored is never written
 *    as an address (`photoUrl` before `save`);
 *  - one request carries only the fields that actually changed, and a save is offered only when one of
 *    them did (`profileEditDirty`);
 *  - what the route echoed back is what the screen shows: a save that was not written is reported, not
 *    drawn (`profileSaveAccepted`).
 */
export function ProfileEditSheet({ visible, profile, persona, onClose, onSaved }: {
  visible: boolean;
  profile: ProfileView | null;
  /** The active profile this record edits: the route refuses any other one (`ACTIVE_PERSONA_REQUIRED`). */
  persona: string;
  onClose: () => void;
  /** The row the route wrote, so the hero and the band read the new values without a second fetch. */
  onSaved: (patch: Partial<ProfileView>) => void;
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraft(profile));
  /**
   * The answer the handle route gave, kept together with the name it answers for: a draft typed over it
   * reads as unanswered at once, so an answer is never drawn next to a name it was not given for.
   */
  const [checked, setChecked] = useState<{ handle: string; answer: HandleAvailability } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  /**
   * The editor opens on what the record says: every opening starts from the record, never from a draft the
   * last opening left behind, and a record that changed underneath it (a save echoed back) starts from the
   * new one. This is React's own "adjusting state when a prop changes"
   * (`react.dev/learn/you-might-not-need-an-effect`): a guarded pass in render rather than an effect, so no
   * painted frame ever shows the old draft.
   */
  const [openedFor, setOpenedFor] = useState({ open: visible, profile });
  if (openedFor.open !== visible || openedFor.profile !== profile) {
    setOpenedFor({ open: visible, profile });
    if (visible) {
      setDraft(profileDraft(profile));
      setChecked(null);
      setError('');
    }
  }

  const edit = useCallback((change: Partial<ProfileDraft>) => setDraft((previous) => ({ ...previous, ...change })), []);
  const issues = useMemo(() => profileEditIssues(draft, profile), [draft, profile]);
  const dirty = useMemo(() => profileEditDirty(profile, draft), [profile, draft]);
  const derivedAge = ageIsDerived(profile);
  /** The route's answer stands only for the name the draft holds right now; any other name is unanswered. */
  const typedHandle = draft.handle.trim().replace(/^@/, '').toLowerCase();
  const availability = checked && checked.handle === typedHandle ? checked.answer : null;
  const handleState = handleWords(availability, draft, profile);
  const suggestions = useMemo(() => (visible ? searchLocations(draft.location) : []), [visible, draft.location]);

  /**
   * "Verificare disponibilitate în timp real" is the record's own route: `GET /api/onboarding/handle`
   * (`repo.handleAvailability`, which excludes the account's own handle and is rate-limited to 40 answers
   * a quarter of an hour). It is asked once the typed handle is well formed, only while it is a different
   * handle from the one the record holds, and only after the typing has settled.
   */
  useEffect(() => {
    if (!visible) return;
    const typed = draft.handle.trim().replace(/^@/, '').toLowerCase();
    if (!handleChanged(draft, profile) || !HANDLE_PATTERN.test(typed)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      nexusApi<{ ok: true; handle?: string; available?: boolean; reason?: string | null }>(
        `/api/onboarding/handle?handle=${encodeURIComponent(typed)}`,
      )
        .then((answer) => { if (!cancelled && alive.current) setChecked({ handle: typed, answer }); })
        .catch(() => { if (!cancelled && alive.current) setChecked(null); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, draft, profile]);

  /**
   * A chosen file, as the uploader needs it: the name decides the MIME, the size is the file's own. The portrait
   * is cropped square by the picker, so the disc shows the middle of what was chosen and the header's circle
   * shows those same pixels. The cover is not picked here at all (`MIGRATION.md` §19.2).
   */
  async function pickPhoto(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Galerie: aplicația are nevoie de permisiune ca să poată citi poza.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const extension = String(asset.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
    const pick: MediaPick = {
      uri: asset.uri,
      name: String(asset.fileName || `avatar.${extension}`),
      size: Number(asset.fileSize ?? 0),
      mime: asset.mimeType ?? null,
    };
    edit({ avatar: pick });
  }

  /**
   * The bytes first: `/api/uploads` sessions with the record's own purposes (`profile_cover`,
   * `profile_avatar`), and the address the route accepts back (`/media/<hash>.<ext>`, the shape
   * `api.js:3216` matches an upload grant against).
   */
  async function photoUrl(pick: MediaPick | null, purpose: 'profile_avatar' | 'profile_cover'): Promise<string | undefined> {
    if (!pick) return undefined;
    const media = await uploadMediaResumable(
      { uri: pick.uri, name: pick.name, ...(pick.size > 0 ? { size: pick.size } : {}) },
      { purpose, scope: draftScope(Number(profile?.user_id) || 0, persona), ...(pick.mime ? { mime: pick.mime } : {}) },
    );
    if (!media?.hash || !media?.ext) throw new Error('Poza nu a putut fi stocată.');
    return `/media/${media.hash}.${media.ext}`;
  }

  /**
   * One press, one save. The handle is the one field with a door of its own and it is not this route:
   * only `POST /api/onboarding` writes `users.handle` (`repo.claimHandle`), after the same availability
   * answer the field is already showing, and it writes the name, the visibility and the description in
   * the same call - which is why it carries the values the form holds and never invented ones.
   */
  async function save(): Promise<void> {
    if (saving || Object.keys(issues).length || !dirty) return;
    const handle = draft.handle.trim().replace(/^@/, '').toLowerCase();
    const claimed = handleChanged(draft, profile);
    setSaving(true);
    setError('');
    try {
      if (claimed) {
        await nexusApi('/api/onboarding', {
          method: 'POST',
          body: JSON.stringify({
            handle,
            display_name: draft.name.trim(),
            persona,
            visibility: String(profile?.visibility ?? 'public'),
            bio: draftBio(draft),
          }),
        });
      }
      /** The portrait goes up first, and only then is the record written (`photoUrl` before `save`). */
      const avatar = await photoUrl(draft.avatar, 'profile_avatar');
      const { body } = profileEditBody(profile, draft, { avatar });
      if (!Object.keys(body).length) {
        onSaved(claimed ? { handle } : {});
        onClose();
        return;
      }
      const result = await nexusApi<{ ok: true; persona?: Record<string, unknown> }>(
        `/api/persona/${encodeURIComponent(persona)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      if (!profileSaveAccepted(body, result.persona)) {
        setError('Serverul nu a scris toate valorile; profilul arată încă ce ține minte.');
        return;
      }
      onSaved({ ...savedProfilePatch(body, result.persona), ...(claimed ? { handle } : {}) });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : uploadErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  /** What the preview reads: the file that was just picked, or what the record holds right now. */
  const avatarSource = draft.avatar ? { uri: draft.avatar.uri, headers: {} } : mediaSourceForPath(profile?.avatar);
  const bioLength = draftBio(draft).length;
  const canSave = dirty && !Object.keys(issues).length && !saving;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View accessible={false} style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Editează profilul</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Închide fără să salvezi" onPress={onClose} style={styles.close}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
            {/**
             * The portrait comes first, because it is the face of the header this editor edits. The cover field
             * that used to stand above it is gone with the native cover band (`MIGRATION.md` §19.2).
             */}
            <View style={styles.field}>
              <Text style={styles.label}>Poză de profil</Text>
              <View style={styles.avatarRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Schimbă poza de profil" onPress={() => void pickPhoto()} style={styles.avatar}>
                  {avatarSource ? (
                    <RemoteImageSource source={avatarSource} fit="cover" style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>＋</Text>
                  )}
                </Pressable>
                <Text style={styles.hint}>Atinge discul: galeria decupează pătrat, iar cercul arată mijlocul.</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nume afișat</Text>
              <TextInput
                value={draft.name}
                onChangeText={(name) => edit({ name })}
                maxLength={PROFILE_EDIT_LIMITS.name}
                accessibilityLabel="Nume afișat"
                placeholder="Numele din header"
                placeholderTextColor={socialTokens.colors.muted}
                style={[styles.input, issues.name ? styles.inputBad : null]}
              />
              {issues.name ? <Text style={styles.problem}>{issues.name}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nume de utilizator</Text>
              <View style={styles.handleRow}>
                <Text style={styles.handleAt}>@</Text>
                <TextInput
                  value={draft.handle}
                  onChangeText={(handle) => edit({ handle })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={PROFILE_EDIT_LIMITS.handle}
                  accessibilityLabel="Nume de utilizator"
                  style={[styles.input, styles.handleInput, issues.handle || handleState.tone === 'bad' ? styles.inputBad : null]}
                />
              </View>
              <Text style={[styles.state, handleState.tone === 'bad' ? styles.stateBad : handleState.tone === 'good' ? styles.stateGood : null]}>
                {handleState.text}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Descriere</Text>
              <TextInput
                value={draft.bio}
                onChangeText={(bio) => edit({ bio, link: draft.link && bio.includes(draft.link) ? draft.link : firstAddress(bio) })}
                multiline
                maxLength={PROFILE_EDIT_LIMITS.bio}
                accessibilityLabel="Descriere"
                placeholder="Ce vrei să se citească în bandă"
                placeholderTextColor={socialTokens.colors.muted}
                style={[styles.input, styles.bio, issues.bio ? styles.inputBad : null]}
              />
              <Text style={styles.counter}>{`${bioLength}/${PROFILE_EDIT_LIMITS.bio}`}</Text>
              {issues.bio ? <Text style={styles.problem}>{issues.bio}</Text> : null}
            </View>

            {/**
             * The external link. The profile record has no column for one - the description is its only
             * place for an address, and the web already reads one there as a link - so this field edits the
             * address inside the description instead of inventing a field the record cannot hold.
             */}
            <View style={styles.field}>
              <Text style={styles.label}>Link extern</Text>
              <TextInput
                value={draft.link}
                onChangeText={(link) => edit({ link })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Link extern"
                placeholder="https://www.linkedin.com/in/…"
                placeholderTextColor={socialTokens.colors.muted}
                style={[styles.input, issues.link ? styles.inputBad : null]}
              />
              <Text style={styles.hint}>Adresa se scrie în descriere, unde profilul o citește ca link; gol o scoate.</Text>
              {issues.link ? <Text style={styles.problem}>{issues.link}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Locație</Text>
              <TextInput
                value={draft.location}
                onChangeText={(location) => edit({ location })}
                maxLength={PROFILE_EDIT_LIMITS.location}
                accessibilityLabel="Locație"
                placeholder="Orașul afișat în bandă"
                placeholderTextColor={socialTokens.colors.muted}
                style={[styles.input, issues.location ? styles.inputBad : null]}
              />
              {suggestions.length ? (
                <View style={styles.suggestions}>
                  {suggestions.map((city) => (
                    <Pressable key={city} accessibilityRole="button" accessibilityLabel={city} onPress={() => edit({ location: city })} style={styles.suggestion}>
                      <Text style={styles.suggestionText}>{city}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.hint}>Sugestiile vin din lista inclusă în aplicație, nu de la rețea; ce scrii rămâne ce se salvează.</Text>
              {issues.location ? <Text style={styles.problem}>{issues.location}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vârstă</Text>
              {derivedAge ? (
                <Text style={[styles.input, styles.readOnly]}>{profile?.age ? `${profile.age} ani` : 'Fără vârstă afișată'}</Text>
              ) : (
                <TextInput
                  value={draft.age}
                  onChangeText={(age) => edit({ age: age.replace(/[^0-9]/gu, '') })}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="Vârstă"
                  placeholder="Ani"
                  placeholderTextColor={socialTokens.colors.muted}
                  style={[styles.input, issues.age ? styles.inputBad : null]}
                />
              )}
              <Text style={styles.hint}>
                {derivedAge
                  ? 'Vârsta se calculează din data nașterii înregistrate, deci se schimbă doar acolo.'
                  : 'Un an întreg; gol șterge vârsta din profil.'}
              </Text>
              {issues.age ? <Text style={styles.problem}>{issues.age}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vizibilitate</Text>
              <View style={styles.choices}>
                {(['public', 'private'] as const).map((choice) => {
                  const on = (draft.visibility === 'public') === (choice === 'public');
                  return (
                    <Pressable
                      key={choice}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={choice === 'public' ? 'Public' : 'Privat'}
                      onPress={() => edit({ visibility: choice })}
                      style={[styles.choice, on ? styles.choiceOn : null]}
                    >
                      <Text style={[styles.choiceText, on ? styles.choiceTextOn : null]}>
                        {choice === 'public' ? 'Public' : 'Privat'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>{`Profilul are acum semnul „${VISIBILITY_WORDS[draft.visibility] ?? VISIBILITY_WORDS.private}”.`}</Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!dirty ? <Text style={styles.saveHint}>Nimic nu s-a schimbat încă.</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={() => void save()}
              style={[styles.save, !canSave ? styles.saveOff : null]}
            >
              {saving ? (
                <ActivityIndicator color={socialTokens.ticker.editInkOn} />
              ) : (
                <Text style={styles.saveText}>Salvează</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** `.coverSheetBackdrop{position:fixed;inset:0;background:rgba(2,6,10,.74)}` */
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,10,0.74)' },
  /** `.coverSheet{max-height:92vh;padding:14px 16px 18px;border:1px solid #23414c;border-radius:22px 22px 0 0;background:#08131c}` */
  sheet: {
    maxHeight: '92%',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#23414c',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomWidth: 0,
    backgroundColor: '#08131c',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sheetTitle: { flex: 1, minWidth: 0, color: '#eef8fb', fontSize: 16, fontWeight: '800' },
  /** `.coverSheetClose{width:44px;height:44px;border:1px solid #23343d;border-radius:13px;background:#0b141c;color:#dff;font-size:22px}` */
  close: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#23343d', borderRadius: 13, backgroundColor: '#0b141c',
  },
  closeGlyph: { color: '#ddffff', fontSize: 22, lineHeight: 26 },
  /** `.heroEditorPanel .heroField{display:grid;gap:5px}` — one card's worth of fields, in one column. */
  fields: { gap: 12, paddingBottom: 10 },
  field: { gap: 5 },
  /** `.heroEditorPanel .heroField>span{color:#9fb2bb;font-size:11.5px;line-height:1.2}` */
  label: { color: '#9fb2bb', fontSize: 11.5, lineHeight: 14 },
  /** `.heroEditorPanel .heroEditorInput{min-height:42px;padding:9px 11px;border:1px solid #263a44;border-radius:12px;background:#0b1720;color:#eef8fb;font-size:14px}` */
  input: {
    minHeight: 42, paddingHorizontal: 11, paddingVertical: 9,
    borderWidth: 1, borderColor: '#263a44', borderRadius: 12, backgroundColor: '#0b1720',
    color: '#eef8fb', fontSize: 14, lineHeight: 20,
  },
  /** A field that is wrong right now wears the refusal; `.heroEditorPanel input:focus{border-color:#67f5ed}` is the other state. */
  inputBad: { borderColor: '#e2607a' },
  readOnly: { color: '#9fb2bb', paddingTop: 12 },
  /** `.heroEditorPanel textarea.heroEditorInput{min-height:76px;line-height:1.45}` */
  bio: { minHeight: 76, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: '#8b9ca6', fontSize: 11.5 },
  problem: { color: '#ffb3c1', fontSize: 12, lineHeight: 16 },
  state: { color: '#8b9ca6', fontSize: 12, lineHeight: 16 },
  stateGood: { color: '#5df0a8' },
  stateBad: { color: '#ffb3c1' },
  /** `.coverSheetHint{color:#8b9ca6;font-size:12px;line-height:1.45}` */
  hint: { flexShrink: 1, minWidth: 0, color: '#8b9ca6', fontSize: 12, lineHeight: 17 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handleAt: { color: '#9fb2bb', fontSize: 14 },
  handleInput: { flex: 1, minWidth: 0 },
  /** `.coverSheetFrame{border:1px solid #24404a;border-radius:16px;background:#0b1219}` — the cover band's
   * frame, the reframing control and the badge over it are gone with the native cover (`MIGRATION.md` §19.2),
   * so their rules no longer exist: a control that arranges a picture nothing draws has no subject. */
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /** The header's own disc: 78px, white edge, its own well (`.ownerAvatar` on the phone shell). */
  avatar: {
    width: 78, height: 78, flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    padding: 2, borderWidth: 2, borderColor: '#ffffff', borderRadius: 39, backgroundColor: '#090a0c', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 37 },
  avatarInitials: { color: '#ffffff', fontSize: 22, lineHeight: 26 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 },
  suggestion: {
    minHeight: 38, justifyContent: 'center', paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#26343d', borderRadius: 14, backgroundColor: '#0f1a23',
  },
  suggestionText: { color: '#9fb2bb', fontSize: 12.5 },
  /** The two states of the mode switch: `.onboardingChoices button{min-height:44px}`, side by side. */
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    minHeight: 44, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#26343d', borderRadius: 14, backgroundColor: '#0f1a23',
  },
  choiceOn: { borderColor: '#2fbdb3', backgroundColor: '#0d2a2c' },
  choiceText: { color: '#9fb2bb', fontSize: 13 },
  choiceTextOn: { color: '#dff9f6' },
  actions: { gap: 8, paddingTop: 4 },
  error: { color: '#ffb3c1', fontSize: 12.5, lineHeight: 17 },
  saveHint: { color: '#8b9ca6', fontSize: 12 },
  /** `.coverSheet menu button{min-height:48px;border-radius:14px;background:#101a23;font-weight:700}`, in the save's own colour. */
  save: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#167d7b', borderRadius: 14, backgroundColor: '#101a23',
  },
  /** A save with nothing to save is drawn, and says why by staying out of reach. */
  saveOff: { opacity: 0.5 },
  saveText: { color: '#5af2e8', fontSize: 15, fontWeight: '700' },
});
