/**
 * Cadrul unei miniaturi de clip, ca socoteală pură (runda 49).
 *
 * Până acum o celulă de clip din Profil și din Căutare nu arăta nimic din clip: `ProfileTile` desena o
 * placă întunecată cu un disc de redare, adică exact ce arată și azi când nu există niciun cadru. Ownerul
 * a cerut **fotografia clipului** în grilă („thumbnail real"), iar telefonul are deja ce trebuie: playerul
 * din `expo-video` poate cere un cadru (`generateThumbnailsAsync`) din chiar fișierul pe care îl redă, cu
 * sesiunea atașată, iar `expo-image` poate desena cadrul acela direct.
 *
 * Modulul acesta ține **numai numerele** — cât de lat, la ce secundă, cât de multe cadrane ținem minte — ca
 * `scripts/test-poster-frame.cjs` să le poată verifica în Node simplu, fără un modul nativ. Fișierul care
 * chiar atinge nativele este `lib/videoPoster.ts`.
 *
 * Modulul este **pur**: nu importează nimic.
 */

/**
 * Lățimea maximă a unui cadru, în pixeli fizici.
 *
 * O celulă are ~150 dp lățime, iar telefonul de dezvoltare are densitatea 2,6 — adică ~392 px. Un cadru de
 * 360 px umple celula fără să țină degeaba în memorie o imagine de 1080 px: o miniatură se decupează
 * (`contentFit: 'cover'`) pe 9:16, deci se vede bucata din mijloc, nu tot cadrul.
 */
export const POSTER_MAX_WIDTH = 360;

/**
 * Secunda din care se ia cadrul.
 *
 * Nu secunda 0: primele cadre ale multor clipuri sunt negre (o estompare de la negru, un prim cadru gol),
 * iar o miniatură neagră arată exact ca placa de dinainte, adică reparația nu s-ar vedea. La 0,4 s clipul a
 * început deja.
 */
export const POSTER_AT_SECONDS = 0.4;

/**
 * Câte cadre ținem minte deodată. Un cadru este un `Bitmap` nativ, deci memoria lui nu e gratuită: două
 * zecimi dintr-un perete (12 celule × 3 coloane) ajung, iar un cadru ieșit din cache se regenerează din
 * fișierul deja descărcat.
 */
export const POSTER_CACHE_LIMIT = 24;

/**
 * Câte cadre se generează **simultan**. Fiecare înseamnă un `MediaMetadataRetriever` care citește capul
 * clipului; două deodată umplu un perete de 12 celule fără să pună 12 decodoare una peste alta.
 */
export const POSTER_CONCURRENCY = 2;

/**
 * Cheia unui cadru: fișierul plus lățimea cerută. Media de pe server este adresată după conținut
 * (`<sha256>.<ext>`), deci `uri` este chiar identitatea fișierului și nu poate deveni învechită.
 */
export function posterKeyOf(uri: string, width: number = POSTER_MAX_WIDTH): string {
  const source = String(uri ?? '');
  if (!source) return '';
  return `${source}#w${Math.max(1, Math.round(Number(width) || POSTER_MAX_WIDTH))}`;
}

/**
 * Lățimea cerută pentru o celulă de `cellWidth` puncte, la o densitate dată, cu un plafon: sub 2 px pe
 * punct cadrul arată încețoșat, peste `POSTER_MAX_WIDTH` nu se câștigă nimic vizibil.
 */
export function posterWidthFor(cellWidth: number, density = 2.6): number {
  const points = Math.max(0, Number(cellWidth) || 0);
  const scale = Number(density) > 0 ? Number(density) : 1;
  const wanted = Math.round(points * scale);
  if (wanted <= 0) return POSTER_MAX_WIDTH;
  return Math.max(120, Math.min(POSTER_MAX_WIDTH, wanted));
}

/**
 * Secunda din care se ia cadrul, pentru un clip a cărui durată se știe deja (`player.duration`).
 *
 * Un clip de sub o secundă n-ar avea cadru la 0,4 s; se ia mijlocul lui. O durată necunoscută (0, `NaN`,
 * negativă — playerul nu a încărcat încă) nu schimbă regula generală.
 */
export function posterTimeFor(duration?: number | null): number {
  const total = Number(duration);
  if (!Number.isFinite(total) || total <= 0) return POSTER_AT_SECONDS;
  if (total <= POSTER_AT_SECONDS * 2) return Math.round((total / 2) * 100) / 100;
  return POSTER_AT_SECONDS;
}

/**
 * Ce chei ies din cache când intră una nouă.
 *
 * `order` este ordinea în care au intrat cheile (cea mai veche prima, cea mai recentă ultima), deci
 * rezultatul este exact atâtea chei câte trebuie ca să încapă `incoming` intrări noi. O listă deja sub
 * plafon nu scoate nimic.
 */
export function posterEvictions(order: readonly string[], limit: number = POSTER_CACHE_LIMIT, incoming = 1): string[] {
  const cap = Math.max(1, Math.round(Number(limit) || POSTER_CACHE_LIMIT));
  const fresh = Math.max(0, Math.round(Number(incoming) || 0));
  const over = order.length + fresh - cap;
  if (over <= 0) return [];
  return order.slice(0, Math.min(order.length, over));
}
