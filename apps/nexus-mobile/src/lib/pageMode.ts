/**
 * Cum se citește o pagină de cuvinte: hârtie sau noapte.
 *
 * Runda 46 (owner): pagina de text avea un singur aspect — hârtia caldă Kindle — iar cititorul nu putea
 * cere altceva. Cerința are două fețe, iar ele nu trebuie confundate:
 *
 *   `paper` — hârtia caldă de până acum, cu cerneala ei închisă. Aspectul *produsului*, nu al autorului:
 *             tema aleasă de autor rămâne doar accentul (`lib/textStyle.ts::pagePaletteOf`);
 *   `night` — negru mat, cu cerneală deschisă. Aceleași litere, aceeași măsură, același flux: se schimbă
 *             doar tratamentul de culoare, niciodată structura paginii.
 *
 * **Decizia de persistență** (documentată și în `HANDOFF.md`): modul este o **preferință a cititorului**,
 * nu a postării. Un om care citește noaptea nu vrea să comute fiecare pagină, iar o pagină nu are de ce să
 * poarte o culoare pe care cititorul ei a ales-o. Preferința trăiește în acest modul, ca limba cititorului
 * (`lib/language.ts`): o valoare de sesiune, citită de orice suprafață prin `useSyncExternalStore`, fără
 * rescrierea vreunei postări. Aplicația nu are un strat de persistență locală (nici `AsyncStorage`, nici
 * `expo-secure-store` nu sunt dependențe), deci o valoare de sesiune este exact ce poate promite
 * arhitectura de azi — și este onest spus, în loc să fie inventat un „salvat pentru totdeauna".
 *
 * Modulul este **pur**: nu importă nimic, deci `scripts/test-page-mode.cjs` îl încarcă în Node simplu.
 */

/** Cele două fețe ale citirii. */
export type PageMode = 'paper' | 'night';

/** Ce se scrie pe control: o literă mare pentru hârtie, o lună pentru noapte. */
export type PageModeOption = {
  id: PageMode;
  /** Cuvântul scurt, pentru cititorul de ecran și pentru eticheta controlului. */
  label: string;
  /** Semnul desenat: singurul lucru care intră în rândul capului. */
  glyph: string;
  /** Ce înseamnă, într-o propoziție — `accessibilityHint`, nu text vizibil. */
  hint: string;
};

export const PAGE_MODES: readonly PageModeOption[] = Object.freeze([
  Object.freeze({ id: 'paper', label: 'Hârtie', glyph: '☀', hint: 'Pagina de hârtie caldă, cu cerneală închisă.' }),
  Object.freeze({ id: 'night', label: 'Noapte', glyph: '☾', hint: 'Fundal negru mat, cu text deschis.' }),
]);

/** Ordinea în care se comută: două fețe, deci un singur pas. */
export function nextPageMode(mode: PageMode): PageMode {
  return mode === 'night' ? 'paper' : 'night';
}

/** Eticheta unui mod; o valoare necunoscută se citește ca hârtie, ca un rând vechi să nu rămână fără nume. */
export function pageModeLabel(mode: unknown): string {
  return PAGE_MODES.find((entry) => entry.id === mode)?.label ?? 'Hârtie';
}

/** Modul este întunecat? O singură întrebare, ca să nu se răspândească `mode === 'night'` prin ecrane. */
export function isNightMode(mode: unknown): boolean {
  return mode === 'night';
}

const listeners = new Set<() => void>();
let readerMode: PageMode = 'paper';

/** Modul ales de cititor acum. */
export function activePageMode(): PageMode {
  return readerMode;
}

/**
 * Alege modul. Nimic nu se schimbă — și nimeni nu este anunțat — când răspunsul e același, deci un control
 * care își setează propria valoare curentă nu poate intra în buclă de randare.
 */
export function setReaderPageMode(next: PageMode): void {
  const value: PageMode = next === 'night' ? 'night' : 'paper';
  if (value === readerMode) return;
  readerMode = value;
  for (const listener of [...listeners]) listener();
}

/** Comută și întoarce modul nou (pentru un control cu o singură atingere). */
export function togglePageMode(): PageMode {
  setReaderPageMode(nextPageMode(readerMode));
  return readerMode;
}

/** Cine vrea să afle când se schimbă modul (`useSyncExternalStore`). */
export function subscribePageMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Doar pentru teste: o sesiune nouă începe pe hârtie. */
export function resetReaderPageMode(): void {
  readerMode = 'paper';
}
