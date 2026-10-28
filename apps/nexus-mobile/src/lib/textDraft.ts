/**
 * The composer's local draft: the words, the look and the publishing details of a text post that has
 * not been sent yet.
 *
 * It is deliberately separate from `localCapture`'s manifest, which belongs to one media file and is
 * named after it. A text post has no file, so its draft lives in its own directory and survives both
 * a refusal from the server and a cold start of the app. Nothing here talks to the network: the
 * account backup (`/api/creator/drafts`) still belongs to the media flow, and the text composer
 * publishes or keeps the draft on the phone.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { emptyPublishing, readPublishing, type PublishingDetails } from './publishing';
import {
  CONTENT_PROVENANCE, POST_VISIBILITIES, type ContentProvenance, type PostVisibility,
} from './publishClient';
import { readTextStyle, TEXT_MAX_CHARS, type TextStyle } from './textStyle';
import {
  appendMediaBlock, documentFromPlainText, documentPlainText, readEditorialDocument,
  type EditorialDocument,
} from './editorialDocument';

export type TextAttachment = {
  /** The local file the picker handed over; uploaded only when the post is published. */
  uri: string;
  name: string;
  mime: string | null;
  size: number;
  kind: 'image' | 'video';
};

/** The server's own rule for a post gallery: up to ten, one video and nothing beside it. */
export const MAX_TEXT_ATTACHMENTS = 5;

export type TextDraft = {
  version: 1;
  /** The words of the post, at most `TEXT_MAX_CHARS` in the editor. */
  body: string;
  /** The block document the page is drawn from; older drafts are migrated in `loadTextDraft`. */
  document: EditorialDocument;
  /** The authored look; `readTextStyle` keeps a half-written or older draft openable. */
  style: TextStyle;
  publishing: PublishingDetails;
  visibility: PostVisibility;
  provenance: ContentProvenance;
  /**
   * The author pressed the X on the detected place.
   *
   * It lives in the draft, not in the composer, because it is a decision about *this page*: a cold start, a
   * refusal from the server or a return after a phone call must not put a location back that the author
   * removed. `publishing.location` is already empty in that case; this flag is what stops the automatic
   * detection from filling it again.
   */
  locationDismissed: boolean;
  /** Photographs or one clip that travel with the page (`media_items` of the publish). */
  attachments: TextAttachment[];
  updatedAt: number;
};

const DRAFT_FILE = 'current.json';

function draftsDirectory(): Directory {
  return new Directory(Paths.document, 'nexus-text-drafts');
}

function draftFile(): File {
  return new File(draftsDirectory(), DRAFT_FILE);
}

export function emptyTextDraft(): TextDraft {
  return {
    version: 1,
    body: '',
    document: documentFromPlainText(''),
    style: readTextStyle(null),
    publishing: emptyPublishing(),
    visibility: 'public',
    provenance: 'NOT_DECLARED',
    locationDismissed: false,
    attachments: [],
    updatedAt: Date.now(),
  };
}

export function touchTextDraft(draft: TextDraft): TextDraft {
  return { ...draft, updatedAt: Date.now() };
}

function readVisibility(value: unknown): PostVisibility {
  return POST_VISIBILITIES.includes(value as PostVisibility) ? value as PostVisibility : 'public';
}

function readProvenance(value: unknown): ContentProvenance {
  return CONTENT_PROVENANCE.includes(value as ContentProvenance) ? value as ContentProvenance : 'NOT_DECLARED';
}

/**
 * The attachments of a stored draft. A half-written entry, a duplicate or a second clip is dropped
 * rather than opening a draft the publish would refuse; an older draft simply has none.
 */
export function readTextAttachments(value: unknown): TextAttachment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: TextAttachment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const source = entry as Record<string, unknown>;
    const uri = typeof source.uri === 'string' ? source.uri.trim() : '';
    const kind = source.kind === 'image' || source.kind === 'video' ? source.kind : null;
    if (!uri || !kind || seen.has(uri)) continue;
    if (kind === 'video' && result.length > 0) continue;
    if (result.some((item) => item.kind === 'video')) continue;
    seen.add(uri);
    result.push({
      uri,
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'attachment',
      mime: typeof source.mime === 'string' && source.mime ? source.mime : null,
      size: Number.isFinite(Number(source.size)) ? Math.max(0, Number(source.size)) : 0,
      kind,
    });
    if (result.length >= MAX_TEXT_ATTACHMENTS) break;
  }
  return result;
}

/** A corrupt or absent draft opens as an empty one; it never hides the composer behind an error. */
export function loadTextDraft(): TextDraft {
  try {
    const file = draftFile();
    if (!file.exists) return emptyTextDraft();
    const value: unknown = JSON.parse(file.textSync());
    if (!value || typeof value !== 'object') return emptyTextDraft();
    const source = value as Partial<TextDraft>;
    if (source.version !== 1 || typeof source.body !== 'string') return emptyTextDraft();
    const body = source.body.slice(0, TEXT_MAX_CHARS);
    const attachments = readTextAttachments(source.attachments);
    const stored = readEditorialDocument(source.document);
    let document = stored ?? documentFromPlainText(body, attachments.map((item) => ({ mediaType: item.kind })));
    if (!document.blocks.length && attachments.length) {
      attachments.forEach((item, index) => {
        document = appendMediaBlock(document, index, item.kind);
      });
    }
    return {
      version: 1,
      body: documentPlainText(document),
      document,
      style: readTextStyle(source.style),
      publishing: readPublishing(source.publishing),
      visibility: readVisibility(source.visibility),
      provenance: readProvenance(source.provenance),
      /** An older draft never had the flag: nobody had removed a place in it. */
      locationDismissed: source.locationDismissed === true,
      attachments,
      updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : Date.now(),
    };
  } catch {
    return emptyTextDraft();
  }
}

/** Written through a temporary file, so a crash mid-write can never leave half a JSON document. */
export function saveTextDraft(draft: TextDraft): void {
  const directory = draftsDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const temporary = new File(directory, `${DRAFT_FILE}.tmp`);
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(draft));
  temporary.moveSync(draftFile(), { overwrite: true });
}

export function discardTextDraft(): void {
  const file = draftFile();
  if (file.exists) file.delete();
  const temporary = new File(draftsDirectory(), `${DRAFT_FILE}.tmp`);
  if (temporary.exists) temporary.delete();
}
