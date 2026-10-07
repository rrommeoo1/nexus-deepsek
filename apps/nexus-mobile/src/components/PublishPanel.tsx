/**
 * The details screen of the capture editor: every option the web's composer offers, the honest state
 * of the account copy, and the two actions that write to the server.
 *
 * The wording of each choice comes from `publishClient.ts` (`VISIBILITY_LABELS`,
 * `PROVENANCE_LABELS`, `AUDIO_RIGHTS_LABELS`), so the app and the site name the same rule the same
 * way. Nothing here decides anything on its own: the panel reports what the user typed, the editor
 * validates and sends it, and a button is only offered when the action it triggers can succeed.
 */

import { useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import type { CaptureFlowProgress } from '../lib/capturePublish';
import type { LocalCapture, LocalDraft } from '../lib/localCapture';
import { PUBLISHING_LIMITS, captionWithToken, type LocationPrecision } from '../lib/publishing';
import {
  AUDIO_RIGHTS_LABELS, CREATOR_AUDIO_RIGHTS, CONTENT_PROVENANCE, POST_VISIBILITIES,
  PROVENANCE_LABELS, VISIBILITY_LABELS,
  type ContentProvenance, type CreatorAudioRights, type PostVisibility,
} from '../lib/publishClient';

export type PublishPanelProps = {
  capture: LocalCapture;
  draft: LocalDraft;
  /** Writes into the local draft; the editor saves the manifest on every call. */
  onChange: (patch: Partial<LocalDraft>) => void;
  /** `false` while `/api/me` has not answered or could not be read: the account buttons are off. */
  accountReady: boolean;
  /** One sentence about the account copy, shown above the form. */
  accountNote: string;
  /** A flow is running; every field and button is locked. */
  busy: boolean;
  /** `null` when nothing is uploading. */
  progress: CaptureFlowProgress | null;
  /** The sentence of the last success. */
  note: string | null;
  /** The sentence of the last refusal. */
  error: string | null;
  /** A catalog preview is selected: it has no file to upload, so it cannot be published here. */
  catalogAudio: boolean;
  /** The MIME type of the chosen audio file, `null` when it is outside the server's list. */
  audioMime: string | null;
  /** The MIME type of the capture, `null` when the format is outside the server's list (HEIC, MOV). */
  captureMime: string | null;
  /** The id of the post this capture became; the panel then reports it instead of offering buttons. */
  publishedId: number | null;
  onPublish: () => void;
  onBackup: () => void;
  onSaveDraft: () => void;
  onClose: () => void;
};

/** The phase names of an upload, in the words the progress line uses. */
const PHASE_LABELS: Record<CaptureFlowProgress['phase'], string> = {
  hashing: 'Se calculează amprenta fișierului',
  uploading: 'Se încarcă fișierul',
  verifying: 'Se verifică fișierul încărcat',
  completed: 'Încărcarea s-a încheiat',
  writing: 'Se scrie postarea',
};

const PRECISIONS: readonly { value: LocationPrecision; label: string }[] = [
  { value: 'exact', label: 'Exactă' },
  { value: 'area', label: 'Zonă' },
  { value: 'city', label: 'Oraș' },
];

function Choice<T extends string>({
  options, value, disabled, onSelect,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onSelect(option.value)}
            style={[styles.choice, active && styles.choiceActive, disabled && styles.dimmed]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingRow({
  label, hint, value, disabled, onChange,
}: {
  label: string; hint: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.muted}>{hint}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#39414d', true: '#ff315f' }}
        thumbColor="#f6f8fb"
      />
    </View>
  );
}

export function PublishPanel(props: PublishPanelProps) {
  const {
    capture, draft, onChange, busy, progress, note, error, publishedId,
  } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const locked = busy || publishedId !== null;
  const details = draft.publishing;
  const audioFile = Boolean(draft.audioUri);

  // Every reason the publish button is off, in the order the user would meet them. A button that can
  // only fail is not offered, and the sentence that explains it is shown instead.
  const refusals: string[] = [];
  if (publishedId === null) {
    if (!props.accountReady) refusals.push('Contul nu a putut fi citit, deci postarea nu poate fi trimisă acum. Verifică conexiunea și redeschide editorul.');
    if (props.catalogAudio) refusals.push('Melodia aleasă din catalog are doar previzualizare: serverul are nevoie de fișierul audio încărcat. Alege un fișier de pe telefon sau elimină melodia.');
    if (props.captureMime === null) refusals.push('Serverul acceptă fotografii JPEG, PNG, WebP și clipuri MP4 sau WebM. Formatul acestei capturi nu este acceptat; filmează din nou într-un format acceptat.');
    if (audioFile && props.audioMime === null) refusals.push('Pentru audio, serverul acceptă MP3, WAV sau OGG. Fișierul ales rămâne doar în previzualizare.');
  }
  const canPublish = publishedId === null && props.accountReady && !busy && refusals.length === 0;
  const canBackup = publishedId === null && props.accountReady && !busy;

  function addToken(prefix: '#' | '@') {
    const raw = tokenInput.trim();
    if (!raw) return;
    try {
      onChange({ description: captionWithToken(draft.description, `${prefix}${raw.replace(/\s+/g, '')}`) });
      setTokenInput('');
      setTokenError(null);
    } catch (failure) {
      setTokenError(failure instanceof Error ? failure.message : 'Eticheta nu a putut fi adăugată.');
    }
  }

  const progressLabel = progress
    ? `${PHASE_LABELS[progress.phase]}…${progress.phase === 'writing' ? '' : ` ${progress.percent}%`}`
    : null;

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.previewCard}>
          {capture.kind === 'photo'
            ? <Image source={{ uri: capture.uri }} style={styles.thumbnail} resizeMode="cover" />
            : <View style={[styles.thumbnail, styles.videoTile]}><Text style={styles.videoTileText}>▶ VIDEO</Text></View>}
          <View style={styles.previewCopy}>
            <Text style={styles.previewTitle}>{capture.kind === 'photo' ? 'Fotografie' : 'Clip video'} · {capture.framing}</Text>
            <Text style={styles.muted}>Captura originală este păstrată pe telefon.</Text>
            {draft.overlayText ? <Text style={styles.muted}>Text pe imagine: {draft.overlayText}</Text> : null}
          </View>
        </View>

        <Text style={styles.muted}>{props.accountNote}</Text>

        <Text style={styles.label}>Titlu</Text>
        <TextInput
          accessibilityLabel="Titlul postării"
          editable={!locked}
          maxLength={PUBLISHING_LIMITS.title}
          onChangeText={(title) => onChange({ title, publishing: { ...details, title } })}
          placeholder="Adaugă un titlu"
          placeholderTextColor="#84909b"
          style={styles.input}
          value={details.title}
        />

        <Text style={styles.label}>Descriere</Text>
        <TextInput
          accessibilityLabel="Descrierea postării"
          editable={!locked}
          maxLength={PUBLISHING_LIMITS.captionInput}
          multiline
          onChangeText={(description) => onChange({ description })}
          placeholder="Scrie o descriere, #hashtaguri…"
          placeholderTextColor="#84909b"
          style={[styles.input, styles.description]}
          value={draft.description}
        />
        <Text style={styles.muted}>
          {draft.description.length}/{PUBLISHING_LIMITS.caption} caractere
          {draft.description.length > PUBLISHING_LIMITS.caption
            ? ` · serverul păstrează primele ${PUBLISHING_LIMITS.caption}`
            : ''}
        </Text>
        <View style={styles.tokenRow}>
          <TextInput
            accessibilityLabel="Hashtag sau mențiune"
            editable={!locked}
            onChangeText={setTokenInput}
            placeholder="hashtag sau handle"
            placeholderTextColor="#84909b"
            style={[styles.input, styles.tokenInput]}
            value={tokenInput}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Adaugă hashtag" disabled={locked} onPress={() => addToken('#')} style={[styles.tokenButton, locked && styles.dimmed]}><Text style={styles.tokenButtonText}># Adaugă</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Adaugă mențiune" disabled={locked} onPress={() => addToken('@')} style={[styles.tokenButton, locked && styles.dimmed]}><Text style={styles.tokenButtonText}>@ Adaugă</Text></Pressable>
        </View>
        {tokenError ? <Text style={styles.error}>{tokenError}</Text> : null}
        <Text style={styles.muted}>Mențiunea se scrie în descriere, exact ca pe site. Etichetarea persoanelor cu cont (id) nu este încă portată în aplicație.</Text>


        <Text style={styles.label}>Locație</Text>
        <TextInput
          accessibilityLabel="Locația postării"
          editable={!locked}
          maxLength={PUBLISHING_LIMITS.location}
          onChangeText={(location) => onChange({ publishing: { ...details, location } })}
          placeholder="Oraș, loc"
          placeholderTextColor="#84909b"
          style={styles.input}
          value={details.location}
        />
        <Choice
          disabled={locked}
          onSelect={(locationPrecision) => onChange({ publishing: { ...details, locationPrecision } })}
          options={PRECISIONS}
          value={details.locationPrecision}
        />

        <Text style={styles.label}>Link</Text>
        <TextInput
          accessibilityLabel="Linkul postării"
          autoCapitalize="none"
          editable={!locked}
          keyboardType="url"
          maxLength={PUBLISHING_LIMITS.link}
          onChangeText={(link) => onChange({ publishing: { ...details, link } })}
          placeholder="https://…"
          placeholderTextColor="#84909b"
          style={styles.input}
          value={details.link}
        />
        <Text style={styles.muted}>Doar o adresă HTTPS publică trece de verificarea serverului.</Text>

        <Text style={styles.label}>Cine poate vedea</Text>
        <Choice
          disabled={locked}
          onSelect={(visibility: PostVisibility) => onChange({ visibility })}
          options={POST_VISIBILITIES.map((item) => ({ value: item, label: VISIBILITY_LABELS[item] }))}
          value={draft.visibility}
        />

        <Text style={styles.label}>Opțiuni</Text>
        <SettingRow
          disabled={locked}
          hint="Cine nu poate comenta nu poate nici să răspundă."
          label="Permite comentarii"
          onChange={(allowComments) => onChange({ publishing: { ...details, allowComments } })}
          value={details.allowComments}
        />
        <SettingRow
          disabled={locked}
          hint="Alți utilizatori pot distribui postarea mai departe."
          label="Permite repostarea"
          onChange={(allowRepost) => onChange({ publishing: { ...details, allowRepost } })}
          value={details.allowRepost}
        />
        <SettingRow
          disabled={locked}
          hint="Descărcarea fișierului original de către ceilalți."
          label="Permite descărcarea"
          onChange={(allowDownload) => onChange({ publishing: { ...details, allowDownload } })}
          value={details.allowDownload}
        />
        <SettingRow
          disabled={locked}
          hint="Marcajul Nexus se aplică pe fotografia publicată."
          label="Watermark Nexus"
          onChange={(watermark) => onChange({ publishing: { ...details, watermark } })}
          value={details.watermark}
        />
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Salvează pe dispozitiv după publicare</Text>
            <Text style={styles.muted}>Nu este încă disponibil în aplicație: rămâne oprit și este raportat corect serverului.</Text>
          </View>
          <Switch disabled value={false} trackColor={{ false: '#39414d', true: '#ff315f' }} thumbColor="#f6f8fb" />
        </View>

        <Text style={styles.label}>Declarația despre conținut</Text>
        <Choice
          disabled={locked}
          onSelect={(provenance: ContentProvenance) => onChange({ provenance })}
          options={CONTENT_PROVENANCE.map((item) => ({ value: item, label: PROVENANCE_LABELS[item] }))}
          value={draft.provenance}
        />
        <Text style={styles.muted}>Declarația este scrisă de autor și afișată ca atare; serverul nu o verifică și nici aplicația nu o presupune.</Text>


        {draft.audioName ? (
          <>
            <Text style={styles.label}>Audio</Text>
            <Text style={styles.muted}>{draft.audioName}</Text>
            {audioFile ? (
              <>
                <Text style={styles.muted}>Dreptul de folosire, obligatoriu pentru un fișier încărcat:</Text>
                <Choice
                  disabled={locked}
                  onSelect={(audioRights: CreatorAudioRights) => onChange({ audioRights })}
                  options={CREATOR_AUDIO_RIGHTS.map((item) => ({ value: item, label: AUDIO_RIGHTS_LABELS[item] }))}
                  value={draft.audioRights ?? 'ORIGINAL_OWNED'}
                />
                <TextInput
                  accessibilityLabel="Atribuirea audio"
                  editable={!locked}
                  maxLength={120}
                  onChangeText={(audioAttribution) => onChange({ audioAttribution })}
                  placeholder="Atribuire (ex. Artist — Titlu, CC BY)"
                  placeholderTextColor="#84909b"
                  style={styles.input}
                  value={draft.audioAttribution ?? ''}
                />
              </>
            ) : (
              <Text style={styles.muted}>
                {draft.jamendoAttribution
                  ? `Melodie din catalog, licență CC BY. Atribuirea obligatorie: ${draft.jamendoAttribution}`
                  : 'Melodie din catalog, pentru previzualizare.'}
              </Text>
            )}
          </>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel={moreOpen ? 'Ascunde explicațiile' : 'Arată explicațiile'} onPress={() => setMoreOpen(!moreOpen)}>
          <Text style={styles.doneText}>{moreOpen ? 'Ascunde explicațiile' : 'Ce se întâmplă la publicare'}</Text>
        </Pressable>
        {moreOpen ? (
          <Text style={styles.muted}>
            Fișierul urcă pe server, apoi postarea se scrie cu titlul, descrierea, locația, linkul și
            opțiunile de mai sus. Dacă rețeaua cade la jumătate, cererea se reia cu aceeași cheie, iar
            serverul scrie postarea o singură dată. Copia din cont a draftului se șterge după publicare,
            iar fișierul rămâne pe telefon până închizi editorul.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {progressLabel ? <Text style={styles.progress}>{progressLabel}</Text> : null}
        {publishedId !== null ? (
          <Text style={styles.success}>Postarea #{publishedId} este publicată. Copia din cont a draftului a fost ștearsă.</Text>
        ) : null}
        {note && publishedId === null ? <Text style={styles.success}>{note}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {refusals.map((reason) => <Text key={reason} style={styles.muted}>{reason}</Text>)}

        {publishedId !== null ? (
          <Pressable accessibilityRole="button" onPress={props.onClose} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Închide editorul și șterge copia locală</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canPublish }}
              disabled={!canPublish}
              onPress={props.onPublish}
              style={[styles.primaryButton, !canPublish && styles.dimmed]}
            >
              <Text style={styles.primaryText}>{busy ? 'Se publică…' : 'Publică'}</Text>
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canBackup }}
                disabled={!canBackup}
                onPress={props.onBackup}
                style={[styles.secondaryButton, !canBackup && styles.dimmed]}
              >
                <Text style={styles.secondaryText}>Salvează în cont</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={locked} onPress={props.onSaveDraft} style={[styles.secondaryButton, locked && styles.dimmed]}>
                <Text style={styles.secondaryText}>Doar pe telefon</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </>
  );
}


const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 24 },
  previewCard: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#1c222b', borderRadius: 14, padding: 10 },
  thumbnail: { width: 72, height: 104, borderRadius: 8 },
  videoTile: { backgroundColor: '#293240', justifyContent: 'center', alignItems: 'center' },
  videoTileText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  previewCopy: { flex: 1, gap: 6 },
  previewTitle: { color: '#fff', fontWeight: '800' },
  muted: { color: '#aab5c2', fontSize: 12, lineHeight: 18 },
  label: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { color: '#fff', backgroundColor: '#1c222b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  description: { minHeight: 110, textAlignVertical: 'top' },
  tokenRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tokenInput: { flex: 1, fontSize: 14 },
  tokenButton: { backgroundColor: '#1c222b', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 },
  tokenButtonText: { color: '#ff6384', fontWeight: '800', fontSize: 12 },
  choiceGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: '#1c222b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  choiceActive: { backgroundColor: '#ff315f' },
  choiceText: { color: '#aab5c2', fontSize: 13, fontWeight: '700' },
  choiceTextActive: { color: '#fff' },
  dimmed: { opacity: 0.45 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1c222b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  settingCopy: { flex: 1, gap: 3 },
  settingLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  doneText: { color: '#ff6384', fontWeight: '800' },
  footer: { gap: 8, paddingTop: 10 },
  progress: { color: '#aab5c2', fontSize: 12, textAlign: 'center' },
  success: { color: '#8be3b0', fontSize: 12, lineHeight: 18 },
  error: { color: '#ff9b9b', fontSize: 12, lineHeight: 18 },
  primaryButton: { backgroundColor: '#ff315f', borderRadius: 14, padding: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, backgroundColor: '#1c222b', borderRadius: 14, padding: 13, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

