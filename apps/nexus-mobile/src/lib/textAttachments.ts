/**
 * The media a TEXT page carries: pick it in the phone's own gallery, show it in the composer, and
 * upload it only when the page is published.
 *
 * The picker is Android's own (`expo-image-picker`), and the upload is the same resumable pipeline
 * every other post uses (`uploadDraftMedia` -> `POST /api/uploads`), so a text page with a photograph
 * is a POST with `media_items`, never a Reel. A draft keeps the local URI until the publish, which is
 * why a failed publish never costs the user the attachment.
 */

import * as ImagePicker from 'expo-image-picker';
import { draftScope, uploadDraftMedia } from './draftsClient';
import type { EditorIdentity } from './capturePublish';
import type { MediaRef } from './publishClient';
import { MAX_TEXT_ATTACHMENTS, type TextAttachment } from './textDraft';
import { extensionOf, uploadMimeForName } from './uploadClient';

/** The extensions the server's `MIME_EXTENSIONS` knows; the picker's HEIC/MOV answers are refused. */
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};

export class TextAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TextAttachmentError';
  }
}

export type TextAttachmentPick = {
  attachments: TextAttachment[];
  /** Files the gallery offered but the server cannot store (HEIC, MOV, ...), by name. */
  skipped: string[];
};

function nameFromUri(uri: string): string {
  const tail = uri.split('/').pop() || '';
  return decodeURIComponent(tail.split(/[?#]/)[0] ?? '');
}

function attachmentFromAsset(asset: ImagePicker.ImagePickerAsset, kind: 'image' | 'video'): TextAttachment | null {
  if (asset.type !== kind) return null;
  const mime = typeof asset.mimeType === 'string' && asset.mimeType ? asset.mimeType.toLowerCase() : null;
  let name = (asset.fileName || nameFromUri(asset.uri) || `attachment.${kind === 'video' ? 'mp4' : 'jpg'}`).trim();
  if (!extensionOf(name)) {
    const extension = mime ? MIME_EXTENSION[mime] : null;
    if (extension) name = `${name || 'attachment'}.${extension}`;
  }
  if (!uploadMimeForName(name)) return null;
  return {
    uri: asset.uri,
    name: name.slice(0, 120),
    mime,
    size: Number.isFinite(Number(asset.fileSize)) ? Math.max(0, Number(asset.fileSize)) : 0,
    kind,
  };
}

/**
 * One gallery visit. Photographs may be chosen several at a time; a clip is always alone, because the
 * server refuses a video beside another item (`one video per post`) and the composer must not build a
 * draft the publish would reject.
 */
export async function pickTextAttachments(
  kind: 'image' | 'video',
  remaining: number = MAX_TEXT_ATTACHMENTS,
): Promise<TextAttachmentPick> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new TextAttachmentError('Jungle Book nu poate deschide galeria. Permite accesul la fotografii din setările telefonului.');
  }
  const room = Math.max(1, Math.min(MAX_TEXT_ATTACHMENTS, Math.trunc(remaining) || 1));
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    allowsMultipleSelection: kind === 'image',
    selectionLimit: kind === 'image' ? room : 1,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return { attachments: [], skipped: [] };
  const attachments: TextAttachment[] = [];
  const skipped: string[] = [];
  for (const asset of result.assets) {
    const attachment = attachmentFromAsset(asset, kind);
    if (attachment) attachments.push(attachment);
    else skipped.push(asset.fileName || nameFromUri(asset.uri) || 'fișier');
  }
  return { attachments: attachments.slice(0, room), skipped };
}

export type AttachmentUploadProgress = { index: number; total: number; percent: number };

/**
 * Uploads the page's attachments in order and answers the `{hash, ext}` list the publish sends as
 * `media_items`. A refused format is named before any upload starts, so a page with one HEIC among
 * four photographs does not spend three uploads before failing.
 */
export async function uploadTextAttachments(
  identity: EditorIdentity,
  attachments: TextAttachment[],
  onProgress?: (progress: AttachmentUploadProgress) => void,
): Promise<MediaRef[]> {
  if (!attachments.length) return [];
  for (const attachment of attachments) {
    if (!uploadMimeForName(attachment.name)) {
      throw new TextAttachmentError(`„${attachment.name}” nu este într-un format acceptat. Folosește JPEG, PNG, WebP, MP4 sau WebM.`);
    }
  }
  const scope = draftScope(identity.userId, identity.persona);
  const refs: MediaRef[] = [];
  for (let index = 0; index < attachments.length; index++) {
    const attachment = attachments[index];
    const media = await uploadDraftMedia({
      scope,
      purpose: 'social_post',
      source: {
        uri: attachment.uri,
        name: attachment.name,
        size: attachment.size > 0 ? attachment.size : undefined,
      },
      mime: uploadMimeForName(attachment.name),
      onProgress: (progress) => onProgress?.({
        index,
        total: attachments.length,
        percent: progress.total > 0 ? Math.min(100, Math.round((progress.sent / progress.total) * 100)) : 0,
      }),
    });
    refs.push({ hash: media.hash, ext: media.ext });
  }
  return refs;
}
