import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';

/**
 * The activity box of the inbox — `renderNotificationActivity` (`app.js:7879-7945`) and the preference
 * forms beside it (`notification-preferences.js:6-83`), read from the same three endpoints:
 *
 *   GET   /api/notifications?persona=…          app.js:7886  — the rows and the unread count
 *   PATCH /api/notifications        {read_all}  app.js:7907  — mark everything read
 *   PATCH /api/notifications/:id    {read}      app.js:7923  — mark one row read
 *   GET   /api/notification-preferences?persona app.js:7887  — the twelve per-type preferences
 *   PATCH /api/notification-preferences         :7941        — save one preference
 *
 * The labels are the Romanian block of `interface-locale.js` (`activity.*`), verbatim, and the twelve
 * types are `NOTIFICATION_LABEL_KEYS` (`notification-preferences.js:6-10`). Every answer is validated
 * with the web's own conditions before it is painted, so a half-answer changes nothing on screen.
 */

/** `NOTIFICATION_LABEL_KEYS` (`notification-preferences.js:6-10`) in the Romanian block. */
const LABELS: Record<string, string> = {
  reaction: 'Reacții', comment: 'Comentarii', follow: 'Follow și cereri', mention: 'Mențiuni',
  story: 'Stories', message: 'Mesaje', call: 'Apeluri și întâlniri', live: 'Live',
  moderation: 'Moderare', security: 'Securitate', payment: 'Plăți', system: 'Sistem',
};
/** `NOTIFICATION_TYPES` — the key set the server may send. */
const TYPES = new Set(Object.keys(LABELS));
/** `MANDATORY_TYPES` (`notification-preferences.js:13`) — not a preference: how an account hears about itself. */
const MANDATORY = new Set(['security', 'system']);
/** `PREVIEWS` (`:14`) and the `QUIET_PATTERN` (`:15`). */
const PREVIEWS = ['generic', 'sender', 'content'] as const;
const PREVIEW_LABELS: Record<string, string> = { generic: 'Generic', sender: 'Expeditor', content: 'Conținut' };
const QUIET = /^([01]\d|2[0-3]):[0-5]\d$/;
/** `PROFILES` of the app — the personas an activity row may belong to (`app.js:7880`). */
const PERSONAS = ['social', 'dating', 'work', 'travel', 'market'];
const CHANGE_ID = /^[A-Za-z0-9_-]{16}$/;

const COPY = {
  loading: 'Se încarcă activitatea…',
  loadError: 'Activitatea nu poate fi încărcată',
  loadErrorDetail: 'Preferințele rămân fail-closed. Verifică legătura și reîncearcă.',
  retry: 'Reîncearcă',
  eyebrow: 'ACTIVITATE',
  unread: 'necitite',
  markAllRead: 'Marchează tot citit',
  empty: 'Nicio activitate aici',
  emptyDetail: 'Notificările apar numai dacă respectă profilul și preferințele tale.',
  preferencesFor: 'Preferințe pentru profilul',
  channelTruth: 'Notificările in-app sunt disponibile. Push și email rămân blocate până la provider și consimțământ explicit. Securitate și Sistem nu pot fi oprite.',
  mandatory: 'obligatoriu pentru siguranța contului ·',
  profileScoped: 'separat pentru',
  inApp: 'În aplicație',
  preview: 'Previzualizare',
  quiet: 'Ore de liniște',
  save: 'Salvează',
  saving: 'Salvez…',
  saved: 'Preferință salvată ✓',
  saveFailed: 'Preferința nu a fost salvată',
  invalidQuiet: 'Completează ambele ore de liniște sau lasă-le pe ambele goale.',
  readFailed: 'Notificările nu au fost actualizate',
  readOneFailed: 'Notificarea nu a fost actualizată',
};

type NotificationRow = { id: number; type: string; body?: string; persona?: string; read?: number; actor_count?: number };
type Preference = { type: string; in_app?: number; preview?: string; quiet_start?: string | null; quiet_end?: string | null };

export function ActivityCenter({ filter, activePersona, viewerId }: {
  /** What the module plate is on (`inboxFilter` of `app.js:7881`), so the two reads name the same profiles. */
  filter: string;
  /** The active profile of the account (`state.persona`), the fallback the web uses for settings. */
  activePersona: string;
  viewerId: number;
}) {
  const listPersona = ['all', ...PERSONAS].includes(filter) ? filter : 'all';
  const settingsPersona = listPersona === 'all' ? activePersona : listPersona;
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    Promise.all([
      nexusApi<Record<string, any>>(`/api/notifications?persona=${encodeURIComponent(listPersona)}`).catch(() => null),
      nexusApi<Record<string, any>>(`/api/notification-preferences?persona=${encodeURIComponent(settingsPersona)}`).catch(() => null),
    ]).then(([notifications, prefs]) => {
      if (!alive) return;
      if (!notifications?.ok || !prefs?.ok) { setError(COPY.loadError); return; }
      const list = (Array.isArray(notifications.notifications) ? notifications.notifications : [])
        .filter((row: NotificationRow) => row && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0 && TYPES.has(String(row.type)));
      setRows(list);
      setPreferences((Array.isArray(prefs.preferences) ? prefs.preferences : [])
        .filter((pref: Preference) => pref && TYPES.has(String(pref.type))));
      setUnread(Math.max(0, Number.isSafeInteger(Number(notifications.unread)) ? Number(notifications.unread) : 0));
    });
    return () => { alive = false; };
  }, [activePersona, listPersona, nonce, settingsPersona]);

  /** `app.js:7903-7918` — mark everything read, then read the surface again. */
  const markAllRead = useCallback(async () => {
    if (busy || !unread) return;
    setBusy(true);
    setNotice('');
    try {
      const answer = await nexusApi<Record<string, any>>('/api/notifications', {
        method: 'PATCH', body: JSON.stringify({ read_all: true, persona: listPersona }),
      });
      const valid = answer?.ok === true && Number(answer.owner_id) === Number(viewerId) && answer.persona === listPersona
        && Number.isSafeInteger(Number(answer.changed)) && Number(answer.changed) >= 0
        && Number.isSafeInteger(Number(answer.unread)) && Number(answer.unread) >= 0
        && (Number(answer.changed) > 0 ? CHANGE_ID.test(String(answer.change_id || '')) : answer.change_id == null);
      if (!valid) { setNotice(COPY.readFailed); return; }
      setNonce((value) => value + 1);
    } catch { setNotice(COPY.readFailed); } finally { setBusy(false); }
  }, [busy, listPersona, unread, viewerId]);

  /** `app.js:7919-7935` — one row read, validated the same way. */
  const markRead = useCallback(async (id: number) => {
    const answer = await nexusApi<Record<string, any>>(`/api/notifications/${id}`, {
      method: 'PATCH', body: JSON.stringify({ read: true }),
    }).catch(() => null);
    const valid = answer?.ok === true && Number(answer.notification_id) === id
      && Number(answer.owner_id) === Number(viewerId) && answer.read === true
      && typeof answer.changed === 'boolean'
      && Number.isSafeInteger(Number(answer.unread)) && Number(answer.unread) >= 0
      && (answer.changed ? CHANGE_ID.test(String(answer.change_id || '')) : answer.change_id == null);
    if (!valid) { setNotice(COPY.readOneFailed); return; }
    setNonce((value) => value + 1);
  }, [viewerId]);

  if (!rows && !error) {
    return <Text style={styles.loading}>{COPY.loading}</Text>;
  }

  if (error) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>{COPY.loadError}</Text>
        <Text style={styles.emptyDetail}>{COPY.loadErrorDetail}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={COPY.retry} onPress={() => { setError(''); setNonce((value) => value + 1); }} style={styles.retry}>
          <Text style={styles.retryText}>{COPY.retry}</Text>
        </Pressable>
      </View>
    );
  }


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{`${COPY.eyebrow} · ${listPersona.toUpperCase()}`}</Text>
          <Text style={styles.unread}>{`${unread.toLocaleString()} ${COPY.unread}`}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={COPY.markAllRead}
          disabled={!unread || busy}
          onPress={() => void markAllRead()}
          style={[styles.markAll, (!unread || busy) && styles.off]}
        >
          <Text style={styles.markAllText}>{COPY.markAllRead}</Text>
        </Pressable>
      </View>

      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <View style={styles.list}>
        {(rows ?? []).length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{COPY.empty}</Text>
            <Text style={styles.emptyDetail}>{COPY.emptyDetail}</Text>
          </View>
        ) : (rows ?? []).map((row) => {
          const read = Number(row.read) === 1;
          const actors = Math.max(1, Number.isSafeInteger(Number(row.actor_count)) ? Number(row.actor_count) : 1);
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={LABELS[row.type] ?? 'Activitate Nexus'}
              disabled={read}
              onPress={() => void markRead(row.id)}
              style={[styles.row, !read && styles.rowUnread]}
            >
              <Text accessible={false} style={[styles.dot, !read && styles.dotUnread]}>{read ? '○' : '●'}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {`${LABELS[row.type] ?? 'Activitate Nexus'}${actors > 1 ? ` · ${actors.toLocaleString()}` : ''}`}
                </Text>
                <Text style={styles.rowBody} numberOfLines={2}>{row.body ?? ''}</Text>
                <Text style={styles.rowPersona}>{personaOf(row)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.settings}>
        <Text style={styles.settingsSummary}>{`${COPY.preferencesFor} ${settingsPersona}`}</Text>
        <Text style={styles.channelTruth}>{COPY.channelTruth}</Text>
        {preferences.map((pref) => (
          <PreferenceForm key={pref.type} pref={pref} persona={settingsPersona} ownerId={viewerId} />
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * One preference form (`notification-preferences.js:27-45` and the write path `:50-83`): the in-app
 * switch, the preview choice, the quiet pair, and the save. The quiet pair is validated before the call
 * and the answer is accepted only when the record that comes back is the record that was asked for.
 */
function PreferenceForm({ pref, persona, ownerId }: { pref: Preference; persona: string; ownerId: number }) {
  const mandatory = MANDATORY.has(pref.type);
  const [inApp, setInApp] = useState(Number(pref.in_app) === 1 || mandatory);
  const [preview, setPreview] = useState(PREVIEWS.includes(pref.preview as typeof PREVIEWS[number]) ? String(pref.preview) : 'generic');
  const [quietStart, setQuietStart] = useState(String(pref.quiet_start || ''));
  const [quietEnd, setQuietEnd] = useState(String(pref.quiet_end || ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const save = useCallback(async () => {
    if (busy) return;
    const start = quietStart.trim();
    const end = quietEnd.trim();
    const validTime = (value: string) => !value || QUIET.test(value);
    if (!validTime(start) || !validTime(end) || Boolean(start) !== Boolean(end)) { setResult(COPY.invalidQuiet); return; }
    const chosen = persona === 'dating' ? 'generic' : preview;
    if (!PREVIEWS.includes(chosen as typeof PREVIEWS[number])) { setResult('Alege o previzualizare validă.'); return; }
    setBusy(true);
    setResult(COPY.saving);
    try {
      const answer = await nexusApi<Record<string, any>>('/api/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          persona, type: pref.type, in_app: inApp, preview: chosen,
          quiet_start: start, quiet_end: end, push: false, email: false,
        }),
      });
      const valid = answer?.ok === true && Number(answer.owner_id) === Number(ownerId)
        && answer.persona === persona && answer.type === pref.type
        && answer.preference?.persona === persona && answer.preference?.type === pref.type
        && PREVIEWS.includes(answer.preference?.preview)
        && [answer.preference?.in_app, answer.preference?.push, answer.preference?.email]
          .every((value: unknown) => Number(value) === 0 || Number(value) === 1);
      setResult(valid ? COPY.saved : COPY.saveFailed);
    } catch { setResult(COPY.saveFailed); } finally { setBusy(false); }
  }, [busy, inApp, ownerId, persona, pref.type, preview, quietEnd, quietStart]);

  return (
    <View style={styles.pref}>
      <View style={styles.prefHead}>
        <Text style={styles.prefLabel}>{LABELS[pref.type] ?? 'Activitate Nexus'}</Text>
        <Text style={styles.prefScope}>{`${mandatory ? COPY.mandatory : COPY.profileScoped} ${persona}`}</Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={COPY.inApp}
        accessibilityState={{ checked: inApp, disabled: mandatory }}
        disabled={mandatory}
        onPress={() => setInApp((value) => !value)}
        style={styles.check}
      >
        <Text accessible={false} style={styles.checkBox}>{inApp ? '✓' : ''}</Text>
        <Text style={styles.checkLabel}>{COPY.inApp}</Text>
      </Pressable>

      <Text style={styles.prefFieldLabel}>{COPY.preview}</Text>
      <View style={styles.previews}>
        {PREVIEWS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={PREVIEW_LABELS[value]}
            accessibilityState={{ selected: preview === value, disabled: value === 'content' && persona === 'dating' }}
            disabled={value === 'content' && persona === 'dating'}
            onPress={() => setPreview(value)}
            style={[styles.preview, preview === value && styles.previewOn, value === 'content' && persona === 'dating' && styles.off]}
          >
            <Text style={[styles.previewText, preview === value && styles.previewTextOn]}>{PREVIEW_LABELS[value]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.prefFieldLabel}>{COPY.quiet}</Text>
      <View style={styles.quietRow}>
        <TextInput
          value={quietStart}
          onChangeText={setQuietStart}
          placeholder="HH:MM"
          placeholderTextColor="#5d707b"
          accessibilityLabel="Început ore de liniște"
          maxLength={5}
          style={styles.quietInput}
        />
        <TextInput
          value={quietEnd}
          onChangeText={setQuietEnd}
          placeholder="HH:MM"
          placeholderTextColor="#5d707b"
          accessibilityLabel="Sfârșit ore de liniște"
          maxLength={5}
          style={styles.quietInput}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${COPY.save} · ${LABELS[pref.type] ?? ''}`}
        disabled={busy}
        onPress={() => void save()}
        style={[styles.save, busy && styles.off]}
      >
        <Text style={styles.saveText}>{COPY.save}</Text>
      </Pressable>

      <Text accessibilityLiveRegion="polite" style={styles.prefResult}>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.notificationLoading{padding:28px;text-align:center;color:#7be7de}` */
  loading: { padding: 28, textAlign: 'center', color: '#7be7de', fontSize: 14 },
  screen: { flex: 1 },
  /** `.notificationCenter{display:grid;gap:12px;padding-bottom:24px}` inside the inbox's own 16px inset. */
  content: { gap: 12, paddingBottom: 24 },
  /** `>header{padding:12px 14px;border:1px solid rgba(90,222,236,.22);border-radius:18px;background:linear-gradient(135deg,rgba(10,34,45,.88),rgba(12,15,34,.86))}` */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(90,222,236,0.22)',
    borderRadius: 18,
    backgroundColor: '#0a222d',
  },
  headerText: { gap: 3, flexShrink: 1 },
  /** `>header small{color:#75e7e1;font-size:10px;letter-spacing:.12em}` */
  eyebrow: { color: '#75e7e1', fontSize: 10, letterSpacing: 1.2 },
  /** `>header b{font-size:16px}` */
  unread: { color: '#e9f1f4', fontSize: 16, fontWeight: '700' },
  /** `>header button{min-height:38px;padding:8px 11px;border:1px solid rgba(50,228,218,.42);border-radius:13px;background:#0d292e;color:#79eee5;font-weight:700}` */
  markAll: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(50,228,218,0.42)', borderRadius: 13, backgroundColor: '#0d292e' },
  markAllText: { color: '#79eee5', fontSize: 13, fontWeight: '700' },
  off: { opacity: 0.45 },
  notice: { color: '#ffc6c6', fontSize: 12, lineHeight: 17 },
  /** `.notificationList{display:grid;gap:7px}` */
  list: { gap: 7 },
  /** `.notificationRow{padding:11px 12px;border:1px solid rgba(127,164,183,.18);border-radius:16px;background:rgba(7,17,27,.82);grid-template-columns:16px 1fr;gap:9px}` */
  row: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(127,164,183,0.18)',
    borderRadius: 16,
    backgroundColor: 'rgba(7,17,27,0.82)',
  },
  /** `.notificationRow.unread{border-color:rgba(48,228,216,.4);background:linear-gradient(100deg,rgba(14,46,54,.94),rgba(12,20,35,.9))}` */
  rowUnread: { borderColor: 'rgba(48,228,216,0.4)', backgroundColor: '#0e2e36' },
  dot: { color: '#54e6db', fontSize: 10, width: 16, lineHeight: 16 },
  dotUnread: { color: '#54e6db' },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  /** `.notificationRow b{font-size:13px}` */
  rowLabel: { color: '#e9f1f4', fontSize: 13, fontWeight: '700' },
  /** `.notificationRow small{color:#a9bac2;line-height:1.4}` */
  rowBody: { color: '#a9bac2', fontSize: 12, lineHeight: 17 },
  /** `.notificationRow em{color:#68838f;font-size:10px;text-transform:uppercase}` */
  rowPersona: { color: '#68838f', fontSize: 10, textTransform: 'uppercase' },
  /** `.notificationSettings{padding:12px 14px;border:1px solid rgba(119,108,231,.3);border-radius:18px;background:rgba(11,15,31,.82)}` */
  settings: { gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(119,108,231,0.3)', borderRadius: 18, backgroundColor: 'rgba(11,15,31,0.82)' },
  /** `>summary{color:#dbe5ff;font-weight:750}` */
  settingsSummary: { color: '#dbe5ff', fontSize: 14, fontWeight: '800' },
  /** `>p{color:#8fa0b2;font-size:11px;line-height:1.45}` */
  channelTruth: { color: '#8fa0b2', fontSize: 11, lineHeight: 16 },
  /** `form{padding:10px;border:1px solid rgba(101,127,154,.2);border-radius:14px;background:rgba(6,15,25,.8)}` */
  pref: { gap: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(101,127,154,0.2)', borderRadius: 14, backgroundColor: 'rgba(6,15,25,0.8)' },
  prefHead: { gap: 2 },
  prefLabel: { color: '#e9f1f4', fontSize: 12, fontWeight: '700' },
  prefScope: { color: '#758996', fontSize: 10 },
  prefFieldLabel: { color: '#aebdc5', fontSize: 11 },
  /** `form>label{color:#aebdc5;font-size:11px;display:flex;align-items:center;gap:5px}` */
  check: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  checkBox: { width: 16, color: '#79eee5', fontSize: 13 },
  checkLabel: { color: '#aebdc5', fontSize: 11 },
  previews: { flexDirection: 'row', gap: 6 },
  preview: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#2a4651', borderRadius: 9, backgroundColor: '#091722' },
  previewOn: { borderColor: '#79eee5', backgroundColor: '#0d292e' },
  previewText: { color: '#d9e8ec', fontSize: 11 },
  previewTextOn: { color: '#79eee5' },
  quietRow: { flexDirection: 'row', gap: 6 },
  quietInput: { width: 77, minHeight: 32, paddingHorizontal: 6, borderWidth: 1, borderColor: '#2a4651', borderRadius: 9, backgroundColor: '#091722', color: '#d9e8ec', fontSize: 12 },
  /** `.notificationSettings form>button{min-height:38px;border:1px solid rgba(50,228,218,.42);border-radius:13px;background:#0d292e;color:#79eee5}` */
  save: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(50,228,218,0.42)', borderRadius: 13, backgroundColor: '#0d292e' },
  saveText: { color: '#79eee5', fontSize: 13, fontWeight: '700' },
  prefResult: { color: '#79eee5', fontSize: 11 },
  /** `.emptyInbox` — the same box the conversation list prints when it has nothing. */
  emptyBox: { minHeight: 110, padding: 14, gap: 8, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#dce7e9', fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptyDetail: { color: '#8e9ca5', fontSize: 12, lineHeight: 18, maxWidth: 260, textAlign: 'center', marginTop: 5 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14 },
  retryText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
/** One activity row (`app.js:7900`), with the persona the web falls back to. */
function personaOf(row: NotificationRow): string {
  return PERSONAS.includes(String(row.persona)) ? String(row.persona) : 'social';
}
