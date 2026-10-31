import { useSyncExternalStore } from 'react';
import { sheetPreviewHeight, sheetPreviewPostId, subscribeSheetPreview } from './sheetPreview';

/**
 * Cât loc ia foaia de comentarii deschisă **pentru o postare anume**, ca valoare de stare.
 *
 * Pagina și foaia stau în arbori React diferiți (foaia e într-un `Modal`), deci nu se pot vorbi prin
 * props: foaia scrie măsurătoarea în `lib/sheetPreview.ts`, iar pagina o citește de aici. `0` înseamnă
 * „nicio foaie deschisă pentru postarea mea", adică pagina își păstrează înălțimea de până acum.
 *
 * Snapshot-urile sunt două numere, nu un obiect: `useSyncExternalStore` compară prin identitate, iar un
 * obiect construit la fiecare citire ar arăta mereu „schimbat" și ar randa în buclă.
 */
export function useSheetPreview(postId: number): number {
  const openPost = useSyncExternalStore(subscribeSheetPreview, sheetPreviewPostId, sheetPreviewPostId);
  const height = useSyncExternalStore(subscribeSheetPreview, sheetPreviewHeight, sheetPreviewHeight);
  return openPost > 0 && openPost === Math.round(Number(postId) || 0) ? height : 0;
}
