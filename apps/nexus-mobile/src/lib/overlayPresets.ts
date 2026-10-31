/**
 * Cele **trei** mărimi ale unui element scris peste imagine — text, sticker, emoji — și ciclul de patru
 * atingeri prin care se trece prin ele.
 *
 * Runda 46 (owner): „același ciclu previzibil de patru atingeri pentru text, stickere și emoji". Ciclul nu
 * este o a patra mărime: a patra atingere **revine** la prima. De aceea aici nu există decât trei preseturi,
 * iar funcția care le parcurge întoarce perechea (mărimea de aplicat acum, indicele următor).
 *
 * O singură sursă pentru amândouă suprafețele: compozitorul scrie `scale` în decorarea pe care o publică
 * (`lib/studioManifest.ts`), iar pagina publicată o citește prin același randator (`components/PostOverlay`).
 * Deci mărimea din editor și cea din postarea publicată sunt *aceeași valoare*, nu două socoteli care trebuie
 * ținute sincron.
 *
 * Valorile stau în intervalul pe care serverul îl acceptă (`apps/nexus-web/lib/creator-studio.js`: `scale`
 * între 0.4 și 3), iar cea mare nu depășește 1.8 — un text de 120 de caractere la 1.8 ar acoperi imaginea.
 *
 * Modulul este **pur**: nu importă nimic, deci `scripts/test-overlay-presets.cjs` îl încarcă în Node simplu.
 */

export type OverlayPresetId = 'small' | 'medium' | 'large';

export type OverlayPreset = {
  id: OverlayPresetId;
  /** Cuvântul scurt care se citește pe control. */
  label: string;
  /** Factorul scris în manifest (`StudioDecoration.scale`). */
  scale: number;
};

/**
 * Exact trei. `small` este mărimea normală (1 = ce se publica până acum), deci un draft vechi se
 * deschide pe ea fără nicio migrare.
 */
export const OVERLAY_PRESETS: readonly OverlayPreset[] = Object.freeze([
  Object.freeze({ id: 'small', label: 'Mic', scale: 1 }),
  Object.freeze({ id: 'medium', label: 'Mediu', scale: 1.35 }),
  Object.freeze({ id: 'large', label: 'Mare', scale: 1.8 }),
]);

/** Câte mărimi are ciclul — a patra atingere nu este o mărime, ci întoarcerea la prima. */
export const OVERLAY_PRESET_COUNT = OVERLAY_PRESETS.length;

/** Un indice adus în ciclu: orice număr întreg, oricât de mare sau de negativ, cade pe 0…2. */
export function presetIndex(index: number): number {
  const value = Math.trunc(Number(index) || 0);
  return ((value % OVERLAY_PRESET_COUNT) + OVERLAY_PRESET_COUNT) % OVERLAY_PRESET_COUNT;
}

/** Mărimea de la un indice (indicele se normalizează întâi). */
export function presetAt(index: number): OverlayPreset {
  return OVERLAY_PRESETS[presetIndex(index)];
}

/**
 * O atingere a unui instrument: **aplică** mărimea de acum și **avansează** la următoarea.
 *
 * Ordinea este cea cerută de owner: prima atingere pune mărimea normală, a doua pe cea medie, a treia pe
 * cea mare, iar a patra revine la normală — fiindcă `presetIndex(3)` este `0`.
 */
export function takePreset(index: number): { preset: OverlayPreset; index: number } {
  const current = presetIndex(index);
  return { preset: OVERLAY_PRESETS[current], index: (current + 1) % OVERLAY_PRESET_COUNT };
}

/** `scale` de la un indice, pentru scrierile în draft. */
export function presetScale(index: number): number {
  return presetAt(index).scale;
}

/**
 * Indicele unei mărimi citite dintr-un draft: cea mai apropiată valoare oferită.
 *
 * Un manifest vechi are `scale: 1`, deci se deschide pe `small`. O valoare dintr-un manifest viitor (sau
 * editată de mână) nu este refuzată: se citește ca mărimea cea mai apropiată, ca pagina să arate ce scrie
 * în ea în loc să sară la o mărime inventată.
 */
export function presetIndexForScale(scale: unknown): number {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) return 0;
  let best = 0;
  for (let index = 1; index < OVERLAY_PRESET_COUNT; index += 1) {
    if (Math.abs(OVERLAY_PRESETS[index].scale - value) < Math.abs(OVERLAY_PRESETS[best].scale - value)) best = index;
  }
  return best;
}

/** Eticheta mărimii de la un indice, pentru cititorul de ecran („Mărime: Mediu"). */
export function presetLabel(index: number): string {
  return presetAt(index).label;
}

/**
 * Scrie o mărime pe o listă de decorări, după id.
 *
 * Compozitorul ține textul și stickerele în două locuri (textul în `overlayText`, stickerele în listă), deci
 * funcția aceasta lucrează pe forma publicată (`StudioDecoration`) — o singură formă, aceeași pe care o
 * citește randatorul. Un id care nu există nu schimbă nimic: o atingere nu poate inventa un element.
 */
export function withPresetScale<T extends { id: string; scale: number }>(items: readonly T[], id: string, index: number): T[] {
  const scale = presetScale(index);
  return items.map((item) => (item.id === id ? { ...item, scale } : item));
}
