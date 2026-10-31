import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { nexusApi } from '../lib/nexusApi';
import { useNavReserve } from '../components/AppNav';
import { ProfileTile } from '../components/ProfileTile';
import { RemoteImageSource } from '../components/PostMedia';
import { RelationButton } from '../components/RelationButton';
import { BrandAvatar } from '../components/BrandAvatar';
import { rememberPayload, useRelation } from '../lib/relations';
import { mediaSourceForPath, type SearchProfile, type SocialPost, type SocialSearchPage } from '../lib/socialTypes';
import { openSocialProfile } from '../lib/profileNavigation';
import { openTagPage } from '../lib/tagNavigation';
import { GRID_COLUMNS, GRID_GAP, tileSize } from '../lib/profileGrid';
import { blackSilver } from '../theme/blackSilver';
import { socialTokens } from '../theme/social';

/**
 * Căutarea și explorarea, pe un singur ecran (runda 45).
 *
 * Ce era înainte: un câmp, un buton „Caută", iar rezultatele erau **carduri** ale `PostCard` — fiecare
 * rezultat se desena ca o postare întreagă (autor, descriere, rând de reacții), într-o listă cu o coloană.
 * Ownerul a cerut altceva: fără antet deasupra câmpului, o grilă de trei coloane cu miniaturi 9:16 ale
 * postărilor populare, și **numai numărul real de vizualizări** pe fiecare miniatură. Plus căutare automată
 * la tastare, cu oameni, postări și subiecte.
 *
 * Deci ecranul are două fețe, pe aceeași listă:
 *
 *   · **explorare** (câmpul e gol): peretele postărilor recomandate de server (`GET /api/social/feed`,
 *     lentila `for-you` — aceeași pe care o citește feed-ul) — trei coloane, 9:16, cifra în colț;
 *   · **rezultate** (de la două caractere): oameni (avatar, nume, `@handle` — aranjamentul cerut),
 *     subiecte (`GET /api/social/tags`) și postările care conțin cuvântul, în aceeași grilă.
 *
 * Trei lucruri pe care ecranul nu le inventează:
 *
 *   · **serverul** hotărăște ce se poate găsi (`repo.searchSocial`: conturi publice `HUMAN_ORGANIC`,
 *     postări active), iar ecranul oglindește regula celor două caractere în loc să trimită o cerere pe
 *     care serverul o refuză;
 *   · **cifra** este `view_stats.viewers` din payload — numărul pe care îl numără serverul (`impressions.ts`
 *     trimite doar citirile care s-au întâmplat), nu o estimare;
 *   · **citirea** este ruta care există deja (`/post/[id]`, prin `ProfileTile`): același cititor, aceleași
 *     reacții, aceleași comentarii, aceleași benzi de citire. Nu există un al doilea reader pentru căutare.
 *
 * Miniaturile sunt virtualizate de `FlatList` (`numColumns={3}`), iar un clip este o **poză de afiș** cu un
 * disc de redare, nu un player: un perete de treizeci de celule nu are voie să țină treizeci de decodoare.
 */
const DEBOUNCE_MS = 320;
/** Sub atât serverul refuză căutarea (`api.js`, `SOCIAL_SEARCH_QUERY_INVALID`), deci nici nu o cerem. */
const MIN_QUERY = 2;
/** Câte postări alcătuiesc peretele de explorare: destul pentru trei ecrane de grilă. */
const EXPLORE_LIMIT = 30;

/** `GET /api/social/feed` — partea din răspuns pe care o citește peretele. */
type FeedPage = { ok: true; posts?: SocialPost[] };
/** `GET /api/social/tags` — subiectele pe care serverul le numără deja (`repo.trendingTags`). */
type TrendingTag = { kind?: string; tag?: string; display?: string; authors?: number; posts?: number };
type TrendingPage = { ok: true; tags?: TrendingTag[] };

/** Un răspuns de căutare, ținut împreună cu întrebarea lui. */
type Answer = { query: string; term: string; profiles: SearchProfile[]; posts: SocialPost[] };

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

export function SearchScreen({ initialQuery = '' }: { initialQuery?: string } = {}) {
  const navReserve = useNavReserve();
  const [query, setQuery] = useState(initialQuery);
  /**
   * Răspunsul primit, **cu întrebarea lui**: `query` este textul pentru care a răspuns serverul, deci un
   * răspuns vechi nu poate fi afișat sub o întrebare nouă — nu are cine să-l șteargă la fiecare tastă,
   * fiindcă nu este niciodată citit dacă nu se potrivește.
   */
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failed, setFailed] = useState<{ query: string; message: string } | null>(null);
  const [explore, setExplore] = useState<SocialPost[]>([]);
  const [trending, setTrending] = useState<TrendingTag[]>([]);
  const [exploreError, setExploreError] = useState('');
  /**
   * Biletul cererii: fiecare întrebare trimisă ia un număr, iar un răspuns care nu mai poartă biletul de
   * acum este aruncat. Așa o căutare veche, mai lentă, nu poate să scrie peste una nouă — fără
   * `AbortController` și fără o a doua listă.
   */
  const ticket = useRef(0);

  /**
   * Peretele de explorare și subiectele: o singură cerere fiecare, la deschidere.
   *
   * Subiectele vin separat fiindcă sunt o **sugestie**, nu un rezultat: dacă serverul nu le poate da (alt
   * profil decât Social, de pildă), peretele rămâne întreg și doar rândul de subiecte lipsește.
   */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const feed = await nexusApi<FeedPage>(`/api/social/feed?lens=for-you&format=all&limit=${EXPLORE_LIMIT}`);
        if (alive) setExplore(feed.posts ?? []);
      } catch (cause) {
        if (alive) setExploreError(describe(cause));
      }
      try {
        const tags = await nexusApi<TrendingPage>('/api/social/tags?kind=hashtag&limit=30');
        if (alive) setTrending(tags.tags ?? []);
      } catch {
        if (alive) setTrending([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  /** Ce s-a cerut acum: textul curat, fără `@`, și dacă are destule caractere cât să merite o cerere. */
  const asked = query.trim();
  const asking = asked.replace(/^@/, '').length >= MIN_QUERY;

  /**
   * Căutarea automată: nu mai există buton.
   *
   * `setTimeout` ține locul butonului (320 ms după ultima tastă), iar efectul se reia la fiecare literă,
   * deci o cerere pornită pentru „cra" moare când apare „crac". Sub două caractere nu se cere nimic —
   * serverul ar răspunde oricum cu un refuz, iar ecranul arată peretele de explorare.
   */
  useEffect(() => {
    if (!asking) {
      /** Niciun `setState` aici: se anulează biletul, iar starea se citește derivat (`fresh`). */
      ticket.current += 1;
      return;
    }
    const mine = ticket.current + 1;
    ticket.current = mine;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = await nexusApi<SocialSearchPage>(`/api/social/search?q=${encodeURIComponent(asked)}`);
          if (mine !== ticket.current) return;
          /** Oamenii din răspuns intră în singurul depozit de relații (`lib/relations.ts`). */
          rememberPayload(page);
          setAnswer({ query: asked, term: page.query ?? asked, profiles: page.profiles ?? [], posts: page.posts ?? [] });
          setFailed(null);
        } catch (cause) {
          if (mine !== ticket.current) return;
          setAnswer(null);
          setFailed({ query: asked, message: describe(cause) });
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [asked, asking]);

  /**
   * Starea ecranului, **derivată** din textul din câmp și din răspunsul care îi corespunde: un răspuns
   * pentru altă întrebare nu este afișat, iar „se caută" este exact lipsa unui răspuns proaspăt.
   */
  const fresh = answer && answer.query === asked ? answer : null;
  const failure = failed && failed.query === asked ? failed.message : '';
  const term = fresh?.term ?? '';
  const profiles = fresh?.profiles ?? [];
  const posts = fresh?.posts ?? [];
  const loading = asking && !fresh && !failure;
  const hint = !asking && asked.length === 1 ? 'Scrie cel puțin 2 caractere.' : '';
  const error = failure || (term ? '' : exploreError);

  /**
   * Subiectele care se potrivesc: serverul dă doar cele pe care le numără deja (minim doi autori), deci
   * aici nu se inventează un tag dintr-un cuvânt — se filtrează lista reală.
   */
  const tagMatches = useMemo(() => {
    const needle = (term || asked).replace(/^[@#]/, '').toLowerCase();
    if (needle.length < MIN_QUERY) return [] as TrendingTag[];
    return trending
      .filter((entry) => String(entry.tag ?? '').toLowerCase().includes(needle))
      .slice(0, 6);
  }, [asked, term, trending]);

  /** Ce desenează grila: rezultatele căutării când există o întrebare, peretele altfel. */
  const wall = term ? posts : explore;
  const clear = useCallback(() => setQuery(''), []);
  const emptyWall = !loading && !error && wall.length === 0;
  /**
   * Lățimea listei, măsurată: celula primește o lățime **fixă** (`tileSize`, aceeași aritmetică pe care o
   * descrie peretele profilului).
   *
   * Fără ea, un rând cu un singur rezultat se întindea pe tot ecranul: celula are `flexGrow: 1` + 9:16, deci
   * un singur copil al rândului își lua toată lățimea și se făcea de trei ori mai înalt decât ecranul
   * (văzut pe telefon la căutarea „dimen", cu o singură postare). O grilă de trei coloane trebuie să aibă
   * trei coloane și când are un singur rând plin pe jumătate.
   */
  const [listWidth, setListWidth] = useState(0);
  const cell = tileSize(listWidth - 2 * GRID_GAP, GRID_COLUMNS, GRID_GAP);


  return (
    <View style={styles.screen}>
      {/**
       * Câmpul este **primul rând** al ecranului (runda 45): antetul de shell (logo + pastilele Social /
       * Prieteni) nu se mai desenează pentru acest slot (`app/index.tsx`), fiindcă un câmp de căutare sub
       * un al doilea antet de aplicație este un rând de titlu deasupra unui rând de căutare.
       */}
      <View style={styles.searchRow}>
        <View style={styles.field}>
          <Svg width={17} height={17} viewBox="0 0 18 18" pointerEvents="none">
            <Circle cx={7.5} cy={7.5} r={5.6} stroke={socialTokens.colors.muted} strokeWidth={1.6} fill="none" />
            <Line x1={11.8} y1={11.8} x2={16.2} y2={16.2} stroke={socialTokens.colors.muted} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Caută oameni, postări, subiecte"
            placeholderTextColor={socialTokens.colors.muted}
            accessibilityLabel="Caută oameni și conținut"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={socialTokens.archive.tilePinnedFirstEdge}
          />
          {query.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" onPress={clear} style={styles.clearDoor} hitSlop={8}>
              <Text allowFontScaling={false} style={styles.clearGlyph}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={wall}
        keyExtractor={(post) => `wall-${post.id}`}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          setListWidth((previous) => (previous === width ? previous : width));
        }}
        contentContainerStyle={[styles.list, { paddingBottom: navReserve + 24 }]}
        /**
         * Virtualizarea: nouă celule se desenează, restul așteaptă. Fereastra de cinci ecrane ține scroll-ul
         * lin în timp ce celulele ieșite din cadru se desprind — de aceea niciun clip nu rămâne „viu" pe
         * perete: miniaturile nu sunt playere (`ProfileTile` desenează doar o poză și un disc).
         */
        initialNumToRender={GRID_COLUMNS * 3}
        maxToRenderPerBatch={GRID_COLUMNS * 3}
        windowSize={5}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={(
          <View>
            {tagMatches.length ? (
              <>
                <Text style={styles.sectionLabel}>Subiecte</Text>
                <View style={styles.tags}>
                  {tagMatches.map((entry) => (
                    <Pressable
                      key={`tag-${entry.tag}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Subiectul #${entry.tag}`}
                      onPress={() => openTagPage(entry.tag)}
                      style={styles.tag}
                    >
                      <Text allowFontScaling={false} numberOfLines={1} style={styles.tagText}>{`#${entry.display || entry.tag}`}</Text>
                      {entry.posts ? <Text allowFontScaling={false} style={styles.tagCount}>{`${entry.posts}`}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {profiles.length ? (
              <>
                <Text style={styles.sectionLabel}>Oameni</Text>
                <View style={styles.people}>
                  {profiles.map((person) => <AccountRow key={`person-${person.id}`} person={person} />)}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>{term ? `Postări cu „${term}”` : 'Populare acum'}</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={socialTokens.archive.tilePinnedFirstEdge} />
                <Text style={styles.muted}>Se caută…</Text>
              </View>
            ) : null}
            {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
            {hint ? <Text style={styles.muted}>{hint}</Text> : null}
            {emptyWall && !hint && !error ? (
              <Text style={styles.muted}>
                {term ? `Niciun rezultat pentru „${term}”.` : 'Peretele nu a putut fi citit încă.'}
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          /**
           * O celulă a peretelui: `ProfileTile` în felia `explore` — poza sau pagina postării, plus cifra
           * reală de vizualizări. Atingerea deschide ruta de citire existentă (`/post/[id]`), cu reacțiile,
           * comentariile și benzile ei. Lățimea este fixă (`cell`), ca un rând pe jumătate plin să nu-și
           * întindă celulele peste tot ecranul.
           */
          cell.width > 0 ? (
            <View style={{ width: cell.width }}>
              <ProfileTile post={item} mode="explore" />
            </View>
          ) : null
        )}
      />
    </View>
  );
}


/**
 * Un cont, așa cum arată o căutare de oameni: poza rotundă, numele, `@handle`.
 *
 * Ușa relației (`RelationButton`) rămâne pe rând: este singurul lucru de pe ecran care scrie ceva, iar
 * numărul de urmăritori nu se inventează — `person.followers` vine din `repo.searchSocial` și se tipărește
 * doar când există.
 */
function AccountRow({ person }: { person: SearchProfile }) {
  const avatar = mediaSourceForPath(person.avatar);
  const name = person.name || person.handle;
  const relation = useRelation(person.id);
  const open = () => openSocialProfile(person.handle);
  return (
    <View style={styles.person}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={open} style={styles.avatar}>
        {avatar ? <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} /> : <BrandAvatar size={44} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={open} style={styles.personText}>
        <Text allowFontScaling={false} numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text allowFontScaling={false} numberOfLines={1} style={styles.personMeta}>
          {person.followers ? `@${person.handle} · ${person.followers} urmăritori` : `@${person.handle}`}
        </Text>
      </Pressable>
      <RelationButton
        variant="compact"
        target={{ userId: person.id, handle: person.handle, name, persona: 'social' }}
        relation={relation}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  /** `.phoneScreen` — câmpul întunecat al aplicației, nu negru: ecranul stă în același loc ca feed-ul. */
  screen: { flex: 1, backgroundColor: blackSilver.matteBlack },
  /** Câmpul de căutare, primul rând, cu 8 dp de aer sub el. */
  searchRow: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: 12, borderRadius: 14, borderWidth: 1,
    borderColor: socialTokens.colors.markBorder, backgroundColor: '#101a22',
  },
  input: { flex: 1, minHeight: 42, color: socialTokens.colors.text, fontSize: 14, paddingVertical: 0 },
  clearDoor: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  clearGlyph: { color: socialTokens.colors.muted, fontSize: 13, fontWeight: '800' },
  /**
   * Grila: trei coloane despărțite de `GRID_GAP`, fără o a doua socoteală de lățime. Celula
   * (`ProfileTile.tile`) are `flexGrow: 1` + `aspectRatio: 9/16`, deci cele trei se împart exact pe lățimea
   * rândului și își iau înălțimea din ea — aceeași aritmetică pe care o descrie `tileSize`.
   */
  list: { paddingHorizontal: GRID_GAP, paddingTop: 2 },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  sectionLabel: {
    color: socialTokens.colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1,
    marginTop: 10, marginBottom: 6, paddingHorizontal: 2,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6, paddingHorizontal: 2 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 10,
    borderRadius: 17, borderWidth: 1, borderColor: socialTokens.colors.markBorder, backgroundColor: '#0e1a22',
  },
  tagText: { color: socialTokens.colors.text, fontSize: 12.5, fontWeight: '700' },
  tagCount: { color: socialTokens.colors.muted, fontSize: 11 },
  people: { gap: 2, marginBottom: 6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, paddingHorizontal: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    backgroundColor: blackSilver.graphite, alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  personText: { flex: 1, minWidth: 0 },
  personName: { color: socialTokens.colors.text, fontSize: 14.5, fontWeight: '700' },
  personMeta: { color: socialTokens.colors.muted, fontSize: 12.5, marginTop: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 2 },
  muted: { color: socialTokens.colors.muted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 2, paddingVertical: 4 },
  error: { color: '#ffb3c0', fontSize: 12.5, lineHeight: 18, paddingHorizontal: 2, paddingVertical: 4 },
});

