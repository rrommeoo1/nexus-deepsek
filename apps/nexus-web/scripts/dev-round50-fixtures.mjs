// Local-only fixtures for the Round 50 device verification (Jungle Book).
//
//   node scripts/dev-round50-fixtures.mjs --inspect
//   node scripts/dev-round50-fixtures.mjs --confirm-local-db [--author r49verify]
//
// Why this file exists: two of the round's visual checks need content the local database did
// not have — an authored article long enough to be read over eight pages while the comments
// sheet is open, and a decorated post (stickers, a clock, a place) on a photo and on a clip.
// Unit tests cannot prove either; the phone has to show them.
//
// The rules it obeys, the ones `dev-social-fixtures.mjs` already obeys (docs/TEST-DATA.md):
//
//   · it writes **only** to the local database and the local content-addressed store: no
//     network, no wallet, no secret on disk, no production deployment (NODE_ENV guard);
//   · the author is a **local test account** (`--author`, default `r49verify`), never the
//     owner's account, and no post leaves this machine — a local database is the audience;
//   · every fixture is **add-only and idempotent**: each post carries a `[r50-…]` marker in
//     its caption, and a second run finds the marker and creates nothing;
//   · nothing is deleted, renamed or hidden: `--inspect` only reads.
import { DB_PATH, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { normalizeCreatorStudio } from "../lib/creator-studio.js";

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const withValue = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withValue) return withValue.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};
const authorHandle = flag("--author", "r49verify");
const inspect = argv.includes("--inspect");
const confirmed = argv.includes("--confirm-local-db");
const dryRun = argv.includes("--dry-run");

if (process.env.NODE_ENV === "production") {
  console.error("[r50] refuzat: rulează doar pe mașina de dezvoltare (NODE_ENV=production).");
  process.exit(2);
}
if (!inspect && !confirmed && !dryRun) {
  console.error("[r50] adaugă --confirm-local-db (scrie postări în baza locală) sau --inspect / --dry-run (numai citesc).");
  process.exit(2);
}

const ARTICLE_MARKER = "[r50-article] ";
const PHOTO_MARKER = "[r50-sticker-photo-2] ";
const VIDEO_MARKER = "[r50-sticker-video] ";
const PLAIN_VIDEO_MARKER = "[r50-plain-video] ";
const ARTICLE_SECOND_MARKER = "[r50-article-2] ";

/**
 * The article. Sixteen numbered chapters, deliberately longer than any page, so the flow
 * engine really paginates it: on the reduced preview above the comments sheet the same text
 * must not fit in fewer than eight pages, or Priority 2 has nothing to swipe.
 *
 * The chapter number is printed in the text itself, so a screenshot says *which* page the
 * reader is on even when the folio at the foot is too small to read.
 */
function articleText(marker = ARTICLE_MARKER) {
  const chapters = [
    ["Pădurea care se mută noaptea", "Am măsurat pădurea din capătul străzii timp de nouă nopți, cu un caiet și un ceas de mână. Nu s-a mutat niciun copac. S-au mutat umbrele, cu nouăzeci de centimetri spre răsărit, și cu ele s-au mutat și sunetele: la ora unu se auzea un pârâu care nu există, la ora trei o pasăre care nu cântă în octombrie."],
    ["Ce spune un trotuar", "Un trotuar este cea mai cinstită hartă a unui oraș: el arată unde merge lumea când nu are treabă. Am numărat, între două stații, trei sute patruzeci de pași și unsprezece oameni care s-au oprit. Niciunul nu s-a oprit pentru că era ceva de văzut. Toți s-au oprit pentru că suna telefonul."],
    ["O bancă, două povești", "Banca a cincea din parc are două povești, iar amândouă sunt adevărate. Dimineața este a celui care citește ziarul și nu-l deranjează nimeni. După-amiaza este a celor care împart o pungă de semințe cu porumbeii. Seara nu este a nimănui, iar asta este, probabil, cea mai frumoasă parte a ei."],
    ["Fotografia ca măsurătoare", "Am încercat să fotografiez liniștea. Nu se poate. Ce se poate fotografia este pauza dintre două lucruri care se mișcă, iar pauza aceea ține o zecime de secundă. Tot ce am reușit să prind a fost un câine care se uită la un tramvai, și în fotografie se vede exact cât de mult contează o asemenea privire."],
    ["Trei cești de cafea", "Prima ceașcă este a trezirii, a doua este a lucrului, a treia este a scuzei că lucrez încă. Le-am băut în aceeași cafenea timp de un an, iar chelnerul a început să le aducă fără să mă întrebe. Asta este, cred, cea mai apropiată formă de prietenie pe care o poate da un oraș unui străin."],
    ["Despre vântul din octombrie", "Vântul din octombrie nu are direcție, are intenții. Intră pe sub haină ca să-ți spună că ai ieșit prea târziu, aruncă frunzele exact în fața ta ca să te oprească un pas, și apoi se retrage, politicos, ca și cum ar fi fost doar o coincidență. Nu este niciodată o coincidență."],
    ["Cum arată o zi bună", "O zi bună are trei lucruri, în ordinea aceasta: o dimineață fără grabă, o conversație care nu avea un subiect, și o seară în care nu ai verificat nimic. Am notat o sută de zile bune în doi ani. Nouăzeci și patru au început la fel: cu o fereastră deschisă și cu nimeni care să ceară ceva."],
    ["Ghidul scurt al orașului", "Dacă ai o singură zi într-un oraș pe care nu-l cunoști, nu merge la obiective. Mergi la piață, cumpără ceva ce nu știi cum se mănâncă, întreabă pe cineva cum se mănâncă. Vei afla mai multe despre oraș din răspunsul acela decât din orice ghid, și vei avea și un motiv să te întorci."],
    ["O listă de lucruri mici", "Să închizi ușa fără să trântești. Să spui mulțumesc și să aștepți răspunsul. Să lași un loc liber în autobuz. Să nu comentezi ce nu ți s-a cerut. Să taci o secundă înainte de a răspunde la o întrebare importantă. Lucrurile acestea nu se văd într-o fotografie, dar se văd în toate celelalte."],
    ["Zgomotul de fond", "Orașul are un zgomot de fond pe care nu-l auzi până nu pleci. La întoarcere îl auzi imediat: este un amestec de ventilație, cauciuc și conversații tăiate. Prima săptămână îl urăști. A doua săptămână îl observi. A treia săptămână adormi mai greu fără el, și atunci ai o problemă mai interesantă decât zgomotul."],
    ["Despre a aștepta", "Nu știu să aștept. Am încercat: am stat într-o coadă la poștă patruzeci de minute, cu telefonul în buzunar, ca să văd dacă pot. Am reușit, dar la final am observat că socoteam minutele. Așteptarea adevărată trebuie să fie fără socoteală, altfel este doar o muncă în care nu faci nimic."],
    ["Un oraș în două culori", "Iarna, orașul are două culori: gri și maro. Vara are douăzeci, dar nu le ține minte. De aceea fotografiile de iarnă par triste și cele de vară par false: prima spune adevărul despre lumină, a doua despre ce ne-am dori. Îmi plac amândouă, dar numai prima mă face să scriu."],
    ["Ce lasă în urmă un tren", "Un tren lasă în urmă trei lucruri: un sunet care se tot îndepărtează, o linie de aer mișcat printre buruieni și un om care se uită după el. Al treilea este singurul care rămâne mai mult de un minut, și este singurul despre care nu se poate scrie nimic nou, oricât de mult ai vrea."],
    ["Metoda celor trei întrebări", "Înainte să scriu despre un loc, îmi pun trei întrebări: cine stă aici dimineața, cine stă aici seara, și cine nu stă niciodată. Răspunsurile sunt aproape întotdeauna mai interesante decât clădirea, fiindcă o clădire nu are obiceiuri, iar oamenii au, și obiceiurile lor se văd în felul în care se așază pe o bancă."],
    ["Mica teorie a trotuarelor", "Un trotuar bun are trei calități: este suficient de lat pentru două umbrele, se udă uniform și are un loc unde te poți opri fără să încurci pe nimeni. Ultima este cea pe care o ratează aproape toate orașele, și este singura care contează pentru cineva care merge încet și se uită în jur."],
    ["Încheiere, fără concluzie", "Nu am o concluzie. Am nouă nopți de măsurători, un caiet pe jumătate plin și o fotografie reușită. Textul acesta este, de fapt, o scuză ca să mai ies o dată la aceeași oră, pe aceeași stradă, cu același ceas de mână. Dacă cititorul ajunge până aici, probabil are și el o stradă la care se întoarce."],
  ];
  return `${marker}Jungle Book · un oraș mic, citit încet\n\n${chapters
    .map(([heading, text], index) => `${index + 1}. ${heading}\n\n${text}`)
    .join("\n\n")}`;
}


/**
 * The decorations of the photo, in the exact form `creator-studio.js` accepts: five labels at
 * five positions and three sizes (`1`, `1.35`, `1.8` — the three presets of
 * `overlayPresets.ts`), carrying a text, an emoji, a large line, a clock and a place. If the
 * comments preview scales the composition, all five must shrink by the same factor and stay on
 * the same percentage of the *picture*.
 */
function photoManifest() {
  const spot = (id, type, text, x, y, scale, extra = {}) => ({
    id, type, assetId: "", text, x, y, scale, rotation: 0,
    zIndex: 3, opacity: 1, style: "classic", align: "center",
    color: "#ffffff", background: "transparent", animation: "none",
    timezone: "UTC", locationPrecision: "area", dynamic: false, startMs: 0, endMs: 0,
    ...extra,
  });
  return normalizeCreatorStudio({
    version: 1, aspect: "ORIGINAL", filter: "NONE", intensity: 0,
    trimStartMs: 0, trimEndMs: 0, playbackRate: 1, muteOriginal: false,
    overlay: { text: "", position: "BOTTOM", color: "WHITE" },
    decorations: [
      spot("r50-text-jungle", "TEXT", "Jungle Book", 50, 82, 1),
      spot("r50-sticker-frog", "TEXT", "🐸🌴", 22, 26, 1.35),
      spot("r50-text-large", "TEXT", "Runda 50", 78, 44, 1.8),
      spot("r50-clock", "TIME", "", 50, 12, 1, { style: "digital", timezone: "Europe/Bucharest", dynamic: true }),
      spot("r50-place", "LOCATION", "București", 30, 62, 1, {
        style: "pill-light", color: "#111111", background: "#ffffff", locationPrecision: "city",
      }),
    ],
    transform: { rotation: 0, zoom: 1, x: 50, y: 50, ratio: 3 / 4, originalVolume: 1, musicVolume: 0.7 },
  }, { mediaKind: "image" });
}

/** The clip keeps two labels, so a video preview proves the same geometry as a photo. */
function videoManifest() {
  const spot = (id, text, x, y, scale) => ({
    id, type: "TEXT", assetId: "", text, x, y, scale, rotation: 0,
    zIndex: 3, opacity: 1, style: "classic", align: "center",
    color: "#ffffff", background: "transparent", animation: "none",
    timezone: "UTC", locationPrecision: "area", dynamic: false, startMs: 0, endMs: 600000,
  });
  return normalizeCreatorStudio({
    version: 1, aspect: "VERTICAL_9_16", filter: "NONE", intensity: 0,
    trimStartMs: 0, trimEndMs: 600000, playbackRate: 1, muteOriginal: false,
    overlay: { text: "", position: "BOTTOM", color: "WHITE" },
    decorations: [
      spot("r50-clip-emoji", "🎬", 24, 24, 1.35),
      spot("r50-clip-text", "Clip cu sticker", 50, 78, 1.8),
    ],
    transform: { rotation: 0, zoom: 1, x: 50, y: 50, ratio: 9 / 16, originalVolume: 1, musicVolume: 0.7 },
  }, { mediaKind: "video" });
}


const db = openDb();
let failed = false;
try {
  const repo = createRepo(db);
  const author = repo.getUserByHandle(authorHandle);
  if (!author) throw new Error(`R50_AUTHOR_MISSING: @${authorHandle} nu există pe această bază locală.`);
  if (!repo.getPersona(author.id, "social")) throw new Error(`R50_PERSONA_MISSING: @${authorHandle} nu are persona social.`);

  const pickMedia = (kind, mime) => (mime
    ? db.prepare("SELECT * FROM media WHERE kind = ? AND mime = ? AND scan_status = 'ready_local_validation' ORDER BY id LIMIT 1").get(kind, mime)
    : null)
    ?? db.prepare("SELECT * FROM media WHERE kind = ? AND scan_status = 'ready_local_validation' ORDER BY id LIMIT 1").get(kind);

  /**
   * A **real photograph** is what the visual checks need. The local store also carries
   * placeholders from earlier rounds (one of them a 1×1 transparent PNG), and a decoration over
   * a transparent pixel proves nothing: the media is picked by size, not by id order, and a
   * photo smaller than 200 kB is skipped on purpose.
   */
  const pickPhoto = () => db.prepare(`SELECT * FROM media WHERE kind = 'image'
    AND scan_status = 'ready_local_validation' AND size > 200000 AND mime = 'image/jpeg'
    ORDER BY size DESC LIMIT 1`).get()
    ?? db.prepare(`SELECT * FROM media WHERE kind = 'image' AND scan_status = 'ready_local_validation'
      AND size > 200000 ORDER BY size DESC LIMIT 1`).get();
  const image = pickPhoto();
  const clip = pickMedia("video", "video/mp4") ?? pickMedia("video");

  /** The same grant a real upload writes: a post may only claim media its author owns. */
  const grant = (row) => row && repo.insertMedia({
    hash: row.hash, ext: row.ext, mime: row.mime, detectedMime: row.detected_mime, kind: row.kind,
    size: row.size, uploadedBy: author.id, purpose: "social_post",
    scanStatus: row.scan_status, scanReason: row.scan_reason,
  });

  /**
   * The fixture a marker names, if it is already there. `substr` rather than `LIKE`: a marker
   * carries `[` and `]`, and SQLite's `LIKE` only honours an escape character when the query
   * names one — a `LIKE` that silently matched nothing would make every run create everything
   * again (round 50 found that the hard way).
   */
  const existingId = (marker) => db.prepare("SELECT id FROM posts WHERE user_id = ? AND substr(caption, 1, ?) = ? ORDER BY id LIMIT 1")
    .get(author.id, marker.length, marker)?.id ?? null;

  const report = {
    database: DB_PATH,
    author: `@${author.handle} (id ${author.id})`,
    image: image ? `${image.hash.slice(0, 12)}… ${image.mime}` : null,
    clip: clip ? `${clip.hash.slice(0, 12)}… ${clip.mime}` : null,
    created: {},
    reused: {},
    comments: 0,
  };

  if (inspect) {
    const posts = db.prepare(`SELECT id, kind, substr(caption, 1, 44) AS head, media_id,
      text_style_json IS NOT NULL AS styled, media_edit_json IS NOT NULL AS decorated
      FROM posts WHERE user_id = ? ORDER BY id`).all(author.id);
    console.log(JSON.stringify({ ...report, posts }, null, 1));
  } else if (dryRun) {
    console.log(`[r50] dry-run: autor @${author.handle}, imagine ${report.image}, clip ${report.clip}`);
    console.log(`[r50] articol de ${articleText().length} caractere; manifestele foto/clip trec validarea serverului`);
  } else {
    /** One fixture: created once, found again by its marker. */
    const publish = (marker, body) => {
      const known = existingId(marker);
      if (known) {
        report.reused[marker] = known;
        return known;
      }
      const post = repo.createPost({ userId: author.id, persona: "social", ...body });
      report.created[marker] = post.id;
      return post.id;
    };

    /**
     * A post may only claim media its author owns, and a post that carries a manifest claims it
     * too — the article included, because a post with media always stores a (possibly empty)
     * manifest. Grants are written first and are `INSERT OR IGNORE`, so a second run adds nothing.
     */
    grant(image);
    grant(clip);

    const articleId = publish(ARTICLE_MARKER, {
      kind: image ? "image" : "text",
      caption: articleText(),
      mediaId: image ? image.id : null,
      visibility: "public", language: "ro",
      /** An authored look is what makes the server treat the post as an article page. */
      textStyle: { theme: "paper" },
    });
    grant(image);
    const photoId = publish(PHOTO_MARKER, {
      kind: "image",
      caption: `${PHOTO_MARKER}Fotografie cu cinci decorațiuni: text, emoji, un text mare, un ceas și un loc.`,
      mediaId: image.id, visibility: "public", language: "ro", mediaEdit: photoManifest(),
    });

    grant(clip);
    const videoId = publish(VIDEO_MARKER, {
      kind: "video",
      caption: `${VIDEO_MARKER}Clip cu două decorațiuni, ca previzualizarea să aibă ce micșora.`,
      mediaId: clip.id, visibility: "public", language: "ro", mediaEdit: videoManifest(),
    });

    /** A plain clip too: the profile wall needs a video cell with no decorations at all. */
    const plainId = publish(PLAIN_VIDEO_MARKER, {
      kind: "video",
      caption: `${PLAIN_VIDEO_MARKER}Clip fără decorațiuni, pentru grila de profil.`,
      mediaId: clip.id, visibility: "public", language: "ro",
    });

    /**
     * The article that is *read* on the phone: the same sixteen chapters, but over a real
     * photograph, so the preview above the comments sheet has a media block, a visible crop and
     * a page count that can be read in the folio.
     */
    const articleSecondId = publish(ARTICLE_SECOND_MARKER, {
      kind: "image",
      caption: articleText(ARTICLE_SECOND_MARKER),
      mediaId: image.id, visibility: "public", language: "ro",
      textStyle: { theme: "paper" },
    });

    /** Three comments on the article, so the sheet has a list to scroll while a page turns. */
    const commenters = db.prepare(`SELECT u.id FROM users u JOIN personas p ON p.user_id = u.id AND p.persona = 'social'
      WHERE u.id <> ? ORDER BY u.id LIMIT 3`).all(author.id);
    const bodies = [
      "Am citit tot până la capitolul opt. Merită fiecare filă.",
      "Banca a cincea este și banca mea. Mulțumesc.",
      "Aștept partea a doua, cu măsurătorile din noiembrie.",
    ];
    if (db.prepare("SELECT COUNT(*) AS n FROM comments WHERE post_id = ?").get(articleId).n === 0) {
      commenters.forEach((commenter, index) => {
        repo.addSocialComment({ userId: commenter.id, postId: articleId, body: bodies[index] ?? bodies[0] });
        report.comments += 1;
      });
    }

    console.log(`[r50] ${JSON.stringify(report, null, 1)}`);
    console.log(`[r50] gata: articol ${articleId}, foto ${photoId}, clip ${videoId}, clip simplu ${plainId}, articol 2 ${articleSecondId}`);
    console.log(`[r50] pe telefon: /post/${articleSecondId} (articol), /post/${photoId} (foto), /post/${videoId} (clip)`);
  }
} catch (error) {
  console.error(`[r50] a eșuat: ${String(error?.message ?? error)}`);
  failed = true;
} finally {
  db.close();
}
process.exitCode = failed ? 1 : 0;
