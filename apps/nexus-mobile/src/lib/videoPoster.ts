import { useEffect, useState } from 'react';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { immediateMediaUri } from './mediaCache';
import {
  POSTER_CACHE_LIMIT, POSTER_CONCURRENCY, POSTER_MAX_WIDTH,
  posterEvictions, posterKeyOf, posterRetryDelay, posterTimeFor,
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
 * Un eșec (fișier refuzat, codec necunoscut, clip prea scurt, o cerere pornită înainte ca fișierul să fie
 * descărcat) nu se vede ca o eroare: celula arată placa ei de rezervă și încearcă din nou, din ce în ce mai
 * rar (`lib/posterFrame.ts::posterRetryDelay`), până reușește sau până renunță. O grilă nu are unde să scrie
 * un mesaj — dar nici nu are voie să rămână neagră fiindcă prima încercare a fost prea devreme (runda 50).
 */

/** Cadrele ținute minte, în ordinea intrării (cea mai veche prima). */
const posters = new Map<string, VideoThumbnail>();
/** Generările în curs, ca două celule cu același clip să nu pornească două decodoare. */
const pending = new Map<string, Promise<VideoThumbnail | null>>();
/**
 * Câte celule **desenează acum** o cheie (runda 50).
 *
 * Un cadru ținut de un perete nu iese din cache nici dacă e cel mai vechi: altfel o derulare ar scoate
 * exact cadrele de pe ecran, iar celula ar cere din nou ce tocmai avea. Se numără, fiindcă același clip
 * poate sta în două celule (arhiva și explorarea) în același timp.
 */
const held = new Map<string, number>();
/** Câte încercări a pierdut o cheie: pauza dintre ele crește (`posterRetryDelay`). */
const failures = new Map<string, number>();
/** Lucrările care așteaptă un loc liber. */
const queue: (() => void)[] = [];
let running = 0;

/** Cadrul deja cunoscut pentru o sursă, sau `null`. */
export function cachedVideoPoster(item?: MediaItem | null, width: number = POSTER_MAX_WIDTH): VideoThumbnail | null {
  const source = mediaSourceFor(item);
  if (!source) return null;
  return posters.get(posterKeyOf(source.uri, width)) ?? null;
}

/**
 * Intrarea unui cadru nou, cu ieșirile potrivite: cheile libere cele mai vechi ies, cheile ținute de o
 * celulă rămân, iar cadrul care soseste acum este cel mai nou.
 */
function remember(key: string, frame: VideoThumbnail): void {
  failures.delete(key);
  const free = [...posters.keys()].filter((entry) => entry !== key && !held.has(entry));
  for (const stale of posterEvictions(free, POSTER_CACHE_LIMIT, 1)) posters.delete(stale);
  posters.delete(key);
  posters.set(key, frame);
}

/** O celulă a atins cadrul: cheia trece la capătul cel mai nou, deci nu iese următoarea. */
function touch(key: string): void {
  const frame = posters.get(key);
  if (!frame) return;
  posters.delete(key);
  posters.set(key, frame);
}

function hold(key: string): void {
  if (!key) return;
  held.set(key, (held.get(key) ?? 0) + 1);
}

function release(key: string): void {
  if (!key) return;
  const count = (held.get(key) ?? 0) - 1;
  if (count > 0) held.set(key, count);
  else held.delete(key);
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
  if (known) {
    touch(key);
    return Promise.resolve(known);
  }
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = schedule(() => generate(source, width).catch(() => null))
    .then((frame) => {
      // Un eșec se numără, ca celula să poată aștepta din ce în ce mai mult înainte de a cere din nou.
      // Un succes șterge socoteala: următoarea cerere (altă lățime, alt ecran) pornește imediat.
      if (frame) remember(key, frame);
      else failures.set(key, (failures.get(key) ?? 0) + 1);
      return frame;
    })
    .finally(() => { pending.delete(key); });
  pending.set(key, task);
  return task;
}

/** Ce arată celula cât timp cadrul nu este (încă) acolo. */
export type VideoPosterStatus = 'ready' | 'loading' | 'failed';

export type VideoPoster = {
  /** Cadrul, dacă a sosit. */
  frame: VideoThumbnail | null;
  /**
   * `ready` — cadrul este aici (sau celula nu are ce încărca);
   * `loading` — se lucrează, celula arată suprafața ei neutră;
   * `failed` — încercarea de acum a eșuat, celula arată placa de rezervă și **așteaptă** o reîncercare.
   */
  status: VideoPosterStatus;
};

/**
 * Cadrul pentru o celulă, ca valoare de stare (runda 50).
 *
 * Runda 49 cerea cadrul o singură dată și, dacă prima cerere pierdea (fișierul încă se descărca, anteturile
 * sesiunii veneau după), celula rămânea placa ei pentru tot restul montării — celula neagră din captură.
 * Acum hook-ul:
 *
 *   · **ține** cheia cât timp celula este montată, deci un cadru de pe ecran nu iese din cache la derulare;
 *   · **așteaptă** între încercări (`posterRetryDelay`: 1,5 s → 4 s → 9 s), apoi se oprește și spune
 *     `failed`, ca o grilă să nu repornească decodoare la nesfârșit;
 *   · **pornește din nou** când celula este remontată: socoteala încercărilor stă în modul, deci o celulă
 *     care apare iar după un eșec nu o ia de la zero și nu cere ce deja știe că nu vine.
 *
 * `item` este ținut într-o referință pentru că o grilă construiește obiecte noi la fiecare randare: efectul
 * depinde numai de cheia fișierului. Cadrul se citește în randare din cache-ul modulului (o citire, ca
 * `cachedMediaUri` la poze) și se ține minte sub cheia lui, deci o celulă reciclată nu arată o clipă
 * cadrul clipului dinainte.
 */
export function useVideoPoster(item?: MediaItem | null, width: number = POSTER_MAX_WIDTH): VideoPoster {
  const source = mediaSourceFor(item);
  const key = source ? posterKeyOf(source.uri, width) : '';
  const [seen, setSeen] = useState<{ key: string; status: VideoPosterStatus }>({ key, status: 'loading' });
  const frame = key ? posters.get(key) ?? null : null;

  useEffect(() => {
    if (!key) return;
    hold(key);
    if (posters.has(key)) touch(key);
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (status: VideoPosterStatus) => { if (live) setSeen({ key, status }); };
    const ask = () => {
      settle(posters.has(key) ? 'ready' : 'loading');
      requestVideoPoster(item, width)
        .then((next) => {
          if (!live) return;
          if (next) { settle('ready'); return; }
          settle('failed');
          const wait = posterRetryDelay(failures.get(key) ?? 1);
          if (wait != null) timer = setTimeout(ask, wait);
        })
        .catch(() => undefined);
    };
    ask();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      release(key);
    };
    // `item` is read through `key`: the effect only re-runs when the file or the width changes, which is
    // exactly when the item it captures is the new one (a grid builds new objects on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);

  const status: VideoPosterStatus = !key || frame
    ? 'ready'
    : seen.key === key
      ? seen.status
      : failures.has(key) ? 'failed' : 'loading';
  return { frame, status };
}

/** Golit pentru teste și pentru deconectare: niciun cadru ținut minte, nicio generare în curs. */
export function resetVideoPosters(): void {
  posters.clear();
  pending.clear();
  failures.clear();
  queue.length = 0;
  running = 0;
}
