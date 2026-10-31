/**
 * Ce se vede deasupra foii de comentarii (runda 48), ca **fel de prezentare**, nu ca o a doua compunere.
 *
 * Runda 47 a potrivit postarea în locul rămas, dar a făcut-o schimbând potrivirea imaginii în `contain`:
 * poza se vedea întreagă, adică exact ce ownerul **nu** vrea —
 *
 *   „o poză în Feed/Profil nu arată burta persoanei, iar în comentarii apare imaginea completă și o arată.
 *    Nu vreau schimbarea asta. Previzualizarea trebuie să păstreze exact aceeași decupare ca postarea din
 *    Feed/Profil." (owner, 31 octombrie 2026)
 *
 * Decuparea nu este o alegere a previzualizării: este o consecință a **formei cutiei** în care se desenează
 * imaginea. `cover` nu decupează după pixeli, ci după raportul dintre lățimea și înălțimea cutiei: aceeași
 * imagine pusă într-o cutie cu **același raport** iese decupată identic, oricât de mică ar fi cutia. Deci
 * previzualizarea nu are voie să schimbe felul potrivirii (`cover` rămâne `cover`, `portrait-cover` rămâne
 * `portrait-cover`) — are voie doar să micșoreze **cutia**, păstrându-i raportul.
 *
 * De aici două feluri de previzualizare, și numai două:
 *
 *   `media`  o compoziție cu poză sau clip: cutia este pagina întreagă micșorată proporțional, ca să încapă
 *            pe locul rămas. Raportul rămâne al paginii, deci decuparea rămâne a paginii;
 *   `words`  o pagină de cuvinte: nu se micșorează nimic (un articol la 48 % este ilizibil). Pagina primește
 *            locul rămas și se **re-pagina** pe el, cu tipografia ei neatinsă.
 *
 * Modulul este **pur**: nu importează nimic, deci `scripts/test-comments-preview.cjs` îl încarcă în Node
 * simplu și verifică socoteala fără un telefon.
 */

/**
 * Felul prezentării unei compoziții publicate.
 *
 * `page` este pagina întreagă — ce desenează feed-ul, profilul, căutarea și ruta unei postări. `commentsPreview`
 * este previzualizarea de deasupra foii de comentarii: **numai conținutul** postării, fără capul autorului,
 * fără descriere, fără benzi de lizibilitate și fără niciun îndemn social.
 */
export type ContentPresentation = 'page' | 'commentsPreview';

/** Ce fel de previzualizare primește o compoziție, după felul postării (`stageFor`). */
export type CommentsPreviewKind = 'media' | 'words';

/**
 * Un clip și o fotografie se micșorează cu cutia lor; o pagină de cuvinte se re-pagina pe locul rămas.
 *
 * Un citat (`quote`) este o pagină de cuvinte: are text, nu o imagine de acoperit. Un articol cu fotografii
 * (`article`) este tot o pagină de cuvinte — fotografiile lui sunt blocuri în flux, cu raportul lor propriu,
 * deci se decupează la fel oricât de înaltă ar fi pagina din jur.
 */
export function commentsPreviewKindOf(stage: string): CommentsPreviewKind {
  return stage === 'media' || stage === 'reel' ? 'media' : 'words';
}


export type CommentsPreviewFrameInput = {
  /** Felul postării (`stageFor(post)`), nu felul previzualizării: modulul îl clasifică singur. */
  stage: string;
  /** Lățimea paginii (fereastra): aceeași pe care o are compoziția în Feed/Profil. */
  pageWidth: number;
  /** Înălțimea paginii întregi — cea pe care compoziția o are când foaia este închisă. */
  pageHeight: number;
  /** Locul rămas deasupra foii (`previewRoomOf`). */
  room: number;
};

export type CommentsPreviewFrame = {
  /** Lățimea cutiei în care se desenează compoziția. */
  width: number;
  /** Înălțimea cutiei în care se desenează compoziția. */
  height: number;
  /** `true` când compoziția a fost micșorată întreagă (media), `false` când s-a re-paginat (cuvinte). */
  scaled: boolean;
  /** Cât de mult s-a micșorat compoziția: 1 înseamnă neatinsă. */
  scale: number;
  kind: CommentsPreviewKind;
};

/**
 * Cutia previzualizării.
 *
 * Pentru `media`, cutia este pagina întreagă micșorată uniform până încape pe înălțimea locului rămas:
 * **raportul se păstrează**, deci `cover` decupează exact ca în Feed/Profil (aceeași compoziție, mai mică).
 * Nu se întoarce niciodată `contain`: o cutie cu alt raport ar arăta părți ale fotografiei pe care pagina
 * le ascunde.
 *
 * Pentru `words`, cutia este pagina la lățimea ei, cu înălțimea locului rămas: pagina se re-pagina, deci
 * tipografia rămâne la mărimea de citit.
 *
 * Măsurători stricate (zero, `NaN`, negative) nu inventează o cutie: se întoarce cutia paginii, iar
 * apelantul nu are o previzualizare de desenat.
 */
export function commentsPreviewFrameOf(input: CommentsPreviewFrameInput): CommentsPreviewFrame {
  const kind = commentsPreviewKindOf(input.stage);
  const pageWidth = Math.max(0, Math.round(Number(input.pageWidth) || 0));
  const pageHeight = Math.max(0, Math.round(Number(input.pageHeight) || 0));
  const room = Math.max(0, Math.round(Number(input.room) || 0));
  if (pageWidth <= 0 || pageHeight <= 0 || room <= 0) {
    return { width: pageWidth, height: 0, scaled: false, scale: 0, kind };
  }
  if (kind === 'words') {
    return { width: pageWidth, height: Math.min(room, pageHeight), scaled: false, scale: 1, kind };
  }
  if (room >= pageHeight) {
    /** Nicio foaie nu ia nimic: compoziția rămâne exact pagina ei. */
    return { width: pageWidth, height: pageHeight, scaled: false, scale: 1, kind };
  }
  /**
   * Micșorarea: înălțimea devine locul rămas, iar lățimea scade în aceeași proporție. Rotunjirea la pixel
   * poate mișca raportul cu mai puțin de o zecime de procent — sub un pixel de decupare, adică invizibil,
   * și cu mult sub ce ar însemna o schimbare de `fit`.
   */
  const scale = room / pageHeight;
  const width = Math.max(1, Math.min(pageWidth, Math.round(pageWidth * scale)));
  return { width, height: room, scaled: true, scale, kind };
}

/**
 * Raportul cutiei micșorate, ca un consumator să poată verifica împreună cu raportul paginii că decuparea
 * s-a păstrat (`frame.width / frame.height === pageWidth / pageHeight`, în limita rotunjirii la pixel).
 *
 * Este folosită de teste și de rapoarte; interfața nu are nevoie de ea.
 */
export function commentsPreviewAspectOf(frame: CommentsPreviewFrame): number {
  return frame.height > 0 ? frame.width / frame.height : 0;
}
