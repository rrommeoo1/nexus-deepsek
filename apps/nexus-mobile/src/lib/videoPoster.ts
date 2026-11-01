import { useEffect, useState } from 'react';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { immediateMediaUri } from './mediaCache';
import {
  POSTER_CACHE_LIMIT, POSTER_CONCURRENCY, POSTER_MAX_WIDTH,
  posterEvictions, posterKeyOf, posterTimeFor,
} from './posterFrame';
import { mediaSourceFor, type MediaItem } from './socialTypes';

/**
 * Cadrul real al unui clip, pentru celulele din Profil și din Căutare (runda 49).
 *
 * Ownerul a refuzat placa neagră cu un disc de redare: o grilă de clipuri arăta doisprezece dreptunghiuri
 * goale. Telefonul poate însă cere un cadru din chiar fișierul pe care `expo-video` îl redă deja — cu
 * sesiunea atașată, fiindcă anteturile trec prin `MediaMetadataRetriever` — iar `expo-image` știe să
 * deseneze referința nativă întoarsă. Deci nu se inventează o a doua tehnologie: se folosește playerul care
 * există, o singură dată, în afara ecranului.
 *
 * Trei reguli, ca o grilă să nu devină un player cu doisprezece decodoare:
 *
 *   · **un cadru per fișier și lățime** (`lib/posterFrame.ts::posterKeyOf`), ținut minte până iese din
 *     cache — o celulă care se remontează nu mai cere nimic;
 *   · **cel mult `POSTER_CONCURRENCY` generări deodată**; restul așteaptă în coadă;
 *   · **playerul se eliberează imediat** după ce cadrul a fost luat. Cadrul este o referință la un `Bitmap`
 *     de sine stătător, nu la player.
 *
 * Un eșec (fișier refuzat, codec necunoscut, clip prea scurt) nu se vede nicăieri: celula rămâne placa
 * ei, exact ca înainte de rundă. O grilă nu are unde să scrie o eroare.
 */

/** Cadrele ținute minte, în ordinea intrării (cea mai veche prima). */
const posters = new Map<string, VideoThumbnail>();
/** Generările în curs, ca două celule cu același clip să nu pornească două decodoare. */
const pending = new Map<string, Promise<VideoThumbnail | null>>();
/** Lucrările care așteaptă un loc liber. */
const queue: (() => void)[] = [];
let running = 0;

/** Cadrul deja cunoscut pentru o sursă, sau `null`. */
export function cachedVideoPoster(item?: MediaItem | null, width: number = POSTER_MAX_WIDTH): VideoThumbnail | null {
  const source = mediaSourceFor(item);
  if (!source) return null;
  return posters.get(posterKeyOf(source.uri, width)) ?? null;
}

function remember(key: string, frame: VideoThumbnail): void {
  for (const stale of posterEvictions([...posters.keys()], POSTER_CACHE_LIMIT, 1)) posters.delete(stale);
  posters.set(key, frame);
}

/** Un loc liber din `POSTER_CONCURRENCY`, apoi lucrarea. */
function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          queue.shift()?.();
        });
    };
    if (running < POSTER_CONCURRENCY) run();
    else queue.push(run);
  });
}

async function generate(source: { uri: string; headers: Record<string, string> }, width: number): Promise<VideoThumbnail | null> {
  /**
   * Un clip deja descărcat se citește de pe disc; altfel se cere cadrul direct de la server, cu anteturile
   * sesiunii. Nu se descarcă clipul întreg pentru o miniatură: `MediaMetadataRetriever` citește numai
   * bucata de care are nevoie.
   */
  const local = immediateMediaUri(source);
  const player = createVideoPlayer(local ?? source);
  try {
    const [frame] = await player.generateThumbnailsAsync([posterTimeFor(player.duration)], { maxWidth: width });
    return frame ?? null;
  } finally {
    player.release();
  }
}

/**
 * Cadrul unui clip: cel cunoscut, sau cel cerut acum. `null` înseamnă „nu există (încă)" — celula desenează
 * placa ei, iar când cadrul sosește hook-ul o re-randează.
 */
export function requestVideoPoster(item?: MediaItem | null, width: number = POSTER_MAX_WIDTH): Promise<VideoThumbnail | null> {
  const source = mediaSourceFor(item);
  if (!source) return Promise.resolve(null);
  const key = posterKeyOf(source.uri, width);
  const known = posters.get(key);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = schedule(() => generate(source, width).catch(() => null))
    .then((frame) => {
      if (frame) remember(key, frame);
      return frame;
    })
    .finally(() => { pending.delete(key); });
  pending.set(key, task);
  return task;
}

/**
 * Cadrul pentru o celulă, ca valoare de stare.
 *
 * Se montează pentru **fiecare** celulă, dar nu cere nimic dacă altcineva a cerut deja același fișier, iar
 * după ce cadrul a sosit nu mai cere nimic niciodată. `item` este ținut într-o referință pentru că o grilă
 * construiește obiecte noi la fiecare randare: efectul depinde numai de cheia fișierului.
 *
 * Cadrul se **citește** în randare din cache-ul modulului (o citire, ca `cachedMediaUri` la poze) și se
 * ține minte sub cheia lui: când grila trece la alt clip, celula nu mai arată o clipă cadrul celui vechi.
 */
export function useVideoPoster(item?: MediaItem | null, width: number = POSTER_MAX_WIDTH): VideoThumbnail | null {
  const source = mediaSourceFor(item);
  const key = source ? posterKeyOf(source.uri, width) : '';
  const [loaded, setLoaded] = useState<{ key: string; frame: VideoThumbnail | null }>({
    key, frame: key ? posters.get(key) ?? null : null,
  });
  const frame = loaded.key === key ? loaded.frame : (key ? posters.get(key) ?? null : null);

  useEffect(() => {
    if (!key || posters.get(key)) return;
    let live = true;
    requestVideoPoster(item, width)
      .then((next) => { if (live && next) setLoaded({ key, frame: next }); })
      .catch(() => undefined);
    return () => { live = false; };
    // `item` is read through `key`: the effect only re-runs when the file or the width changes, which is
    // exactly when the item it captures is the new one (a grid builds new objects on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);

  return frame;
}

/** Golit pentru teste și pentru deconectare: niciun cadru ținut minte, nicio generare în curs. */
export function resetVideoPosters(): void {
  posters.clear();
  pending.clear();
  queue.length = 0;
  running = 0;
}
