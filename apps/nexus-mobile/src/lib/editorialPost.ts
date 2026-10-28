import { API_ORIGIN } from './apiOrigin';
import {
  documentFromPlainText, readEditorialDocument, type EditorialDocument, type EditorialTypography,
} from './editorialDocument';
import { mediaKindOf, postMediaItems, type MediaItem, type SocialPost } from './socialTypes';
import type { TextSizeId, TextStyle } from './textStyle';

/**
 * The document a post is read with, and the files it points at.
 *
 * New posts persist `text_style.document`. A post written before the document existed still reads as
 * it always did, because this helper answers `null` unless the server row really carries a document.
 * That keeps every old page byte-for-byte compatible while new pages can place two photos.
 */
export function editorialDocumentForPost(post?: SocialPost | null): EditorialDocument | null {
  const document = post?.text_style?.document;
  if (document) {
    const read = readEditorialDocument(document);
    if (read && read.blocks.length) return read;
  }
  return null;
}

/** Drafts and tests often hold a body without a document yet; this is the migration the composer uses. */
export function editorialDocumentForBody(
  body: string,
  style?: TextStyle | null,
  media: { mediaType?: 'image' | 'video' }[] = [],
): EditorialDocument {
  const stored = style?.document ? readEditorialDocument(style.document) : null;
  if (stored && stored.blocks.length) return stored;
  return documentFromPlainText(body, media);
}

export type EditorialMediaSource = {
  mediaIndex: number;
  mediaType: 'image' | 'video';
  /** A local `file://` URI for a draft, or the absolute `/media/...` URL for a published post. */
  uri: string;
  /** Present for a published post, so `RemoteImage`/`RemoteVideo` can attach the session headers. */
  item?: MediaItem | null;
};

function absoluteMediaUri(item: MediaItem): string {
  const hash = String(item.hash || '');
  const ext = String(item.ext || '');
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-z0-9]{2,8}$/.test(ext)) return '';
  return `${API_ORIGIN}/media/${hash}.${ext}`;
}

export function editorialMediaForPost(post?: SocialPost | null): EditorialMediaSource[] {
  return postMediaItems(post ?? { id: 0 }).slice(0, 5).map((item, mediaIndex) => ({
    mediaIndex,
    mediaType: mediaKindOf(item) === 'video' ? 'video' : 'image',
    uri: absoluteMediaUri(item),
    item,
  }));
}

export function editorialMediaForAttachments(
  attachments: { uri: string; kind: 'image' | 'video' }[],
): EditorialMediaSource[] {
  return attachments.slice(0, 5).map((attachment, mediaIndex) => ({
    mediaIndex,
    mediaType: attachment.kind,
    uri: attachment.uri,
    item: null,
  }));
}

/** The automatic typography preset: media and long articles get the compact, readable page. */
export function editorialSizeFor(document: EditorialDocument, style: TextStyle): TextSizeId {
  const chosen: EditorialTypography = document.typography ?? 'auto';
  if (chosen !== 'auto') return chosen;
  const characters = document.blocks.reduce((total, block) => (
    total + (block.type === 'paragraph' || block.type === 'heading' ? Array.from(block.text).length : 0)
  ), 0);
  if (characters > 2400) return 'small';
  if (document.blocks.some((block) => block.type === 'media')) return 'small';
  return style.size === 'large' ? 'large' : style.size;
}
