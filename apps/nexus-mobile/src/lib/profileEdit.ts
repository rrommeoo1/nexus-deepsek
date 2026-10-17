import { firstAddress, withAddress } from './profileBioText';
import type { ProfileView } from './socialTypes';

/**
 * What the pencil on the band saves, as the record's own two doors state it.
 *
 * The values are the route's, not this shell's: `PATCH /api/persona/:persona` (`apps/nexus-web/lib/api.js`
 * 3091-3275) takes `name`, `bio`, `location`, `age`, `avatar`, `cover`, `cover_focus` and `visibility`,
 * with the limits `sanitizeText(name, 50)`, `sanitizeText(bio, 300)`, `sanitizeText(location, 80)` and
 * an age that is one whole year between 13 and 120. `GET /api/onboarding/handle` answers whether a
 * handle is free, and `POST /api/onboarding` is the one route in the record that can claim one - the
 * web's own editor never changes a handle, because a handle is claimed once.
 *
 * The area is the phone's own, and it is written down rather than hidden: a switch over the two states
 * a person thinks in (public or not, while the record may also hold `friends`), an age typed as a year
 * (the web edits a calendar day and derives the age from it), and a link field that edits the address
 * inside the description, because the profile record has no link column and the description is the one
 * place where an address is read as a link.
 */
export const PROFILE_EDIT_LIMITS = { name: 50, bio: 300, location: 80, handle: 30, ageMin: 13, ageMax: 120 } as const;

/** `NEXUS_HANDLE_PATTERN` of `public/onboarding.js:9`, and the shape the record's own column accepts. */
export const HANDLE_PATTERN = /^[a-z0-9_]{2,30}$/;

/** A photo that was picked on the phone and not uploaded yet. */
export type MediaPick = { uri: string; name: string; size: number; mime: string | null };

/** What the editor holds while it is open. Every field is a string, because every field is typed. */
export type ProfileDraft = {
  name: string;
  handle: string;
  bio: string;
  /** The address inside the description: the record's one place for an external link. */
  link: string;
  location: string;
  age: string;
  /** The two states the switch offers; the record itself may also hold `friends` or `followers`. */
  visibility: string;
  avatar: MediaPick | null;
  cover: MediaPick | null;
  /** `cover_focus`: which 0-100 stripe of the picture the 168px band shows. */
  coverFocus: number;
};

/** The editor opens on what the record says, and nothing is invented for a field the record lacks. */
export function profileDraft(profile: ProfileView | null | undefined): ProfileDraft {
  const age = profile?.age;
  return {
    name: String(profile?.name ?? ''),
    handle: String(profile?.handle ?? '').replace(/^@/, ''),
    bio: String(profile?.bio ?? ''),
    link: firstAddress(profile?.bio),
    location: String(profile?.location ?? ''),
    age: typeof age === 'number' && Number.isFinite(age) ? String(age) : '',
    visibility: String(profile?.visibility ?? 'public'),
    avatar: null,
    cover: null,
    coverFocus: Number.isInteger(profile?.cover_focus) ? Number(profile?.cover_focus) : 35,
  };
}

/**
 * The age a reader is shown is derived from the date of birth when the record holds one
 * (`api.js:2999`, `Number.isInteger(derivedAge) ? derivedAge : profile.age`), so a year typed here
 * cannot win over that day. The field says so instead of pretending the number was saved.
 */
export function ageIsDerived(profile: ProfileView | null | undefined): boolean {
  return Boolean((profile as { birth_date?: string | null } | null | undefined)?.birth_date);
}

/** The description the editor would save: what was typed, with the link field folded into it. */
export function draftBio(draft: ProfileDraft): string {
  return withAddress(draft.bio, draft.link).trim();
}

/** The whole age rule of the route in one place: an empty field clears the number, anything else is 13 to 120. */
export function draftAge(draft: ProfileDraft): { value: number | null | undefined; reason: string } {
  const typed = draft.age.trim();
  if (!typed) return { value: null, reason: '' };
  if (!/^\d{1,3}$/.test(typed)) return { value: undefined, reason: 'Vârsta se scrie ca un număr întreg de ani.' };
  const value = Number(typed);
  if (value < PROFILE_EDIT_LIMITS.ageMin || value > PROFILE_EDIT_LIMITS.ageMax) {
    return { value: undefined, reason: `Vârsta se scrie între ${PROFILE_EDIT_LIMITS.ageMin} și ${PROFILE_EDIT_LIMITS.ageMax} de ani.` };
  }
  return { value, reason: '' };
}

/** What the address field refuses: anything that is not `http(s)`, the one kind of link the band opens. */
export function linkReason(link: string): string {
  const value = String(link ?? '').trim();
  if (!value) return '';
  return /^https?:\/\/[^\s]+$/i.test(value) ? '' : 'Linkul se scrie întreg, cu http:// sau https://.';
}

/**
 * Every field that must be right before a save is attempted. The name and the handle are required -
 * they are the identity the record cannot be without - while the description, the address and the year
 * are refused only when they are wrong, never when they are empty.
 */
export function profileEditIssues(draft: ProfileDraft, profile?: ProfileView | null): Record<string, string> {
  const issues: Record<string, string> = {};
  const name = draft.name.trim();
  if (!name) issues.name = 'Numele afișat nu poate rămâne gol.';
  else if (name.length > PROFILE_EDIT_LIMITS.name) issues.name = `Numele are cel mult ${PROFILE_EDIT_LIMITS.name} de caractere.`;
  const handle = draft.handle.trim().replace(/^@/, '').toLowerCase();
  if (!handle) issues.handle = 'Numele de utilizator nu poate rămâne gol.';
  else if (!HANDLE_PATTERN.test(handle)) {
    issues.handle = `Numele de utilizator are cel mult ${PROFILE_EDIT_LIMITS.handle} de caractere: litere mici, cifre sau _.`;
  }
  if (draftBio(draft).length > PROFILE_EDIT_LIMITS.bio) {
    issues.bio = `Descrierea are cel mult ${PROFILE_EDIT_LIMITS.bio} de caractere.`;
  }
  if (draft.location.trim().length > PROFILE_EDIT_LIMITS.location) {
    issues.location = `Locația are cel mult ${PROFILE_EDIT_LIMITS.location} de caractere.`;
  }
  const link = linkReason(draft.link);
  if (link) issues.link = link;
  if (!ageIsDerived(profile)) {
    const age = draftAge(draft);
    if (age.reason) issues.age = age.reason;
  }
  return issues;
}

/** Whether the draft still holds the handle the record shows. */
export function handleChanged(draft: ProfileDraft, profile?: ProfileView | null): boolean {
  const shown = String(profile?.handle ?? '').replace(/^@/, '').toLowerCase();
  return draft.handle.trim().replace(/^@/, '').toLowerCase() !== shown;
}

/**
 * The body of the one save, holding only the fields that actually changed: the same rule the web's
 * editor follows (`profile-hero-edit.js:598-613`, "one request carries only the fields that actually
 * changed"). The two photo addresses arrive already uploaded, because the bytes go up before the
 * profile is written - a photo that could not be stored must not be written as an address.
 */
export function profileEditBody(
  profile: ProfileView | null | undefined,
  draft: ProfileDraft,
  media: { avatar?: string; cover?: string } = {},
): { body: Record<string, unknown>; fields: string[] } {
  const body: Record<string, unknown> = {};
  const name = draft.name.trim();
  if (name && name !== String(profile?.name ?? '').trim()) body.name = name;
  const bio = draftBio(draft);
  if (bio !== String(profile?.bio ?? '').trim()) body.bio = bio;
  const location = draft.location.trim();
  if (location !== String(profile?.location ?? '').trim()) body.location = location;
  if (!ageIsDerived(profile)) {
    const age = draftAge(draft);
    const shown = typeof profile?.age === 'number' ? profile.age : null;
    if (age.value !== undefined && age.value !== shown) body.age = age.value;
  }
  // The switch writes the word the person chose, and an untouched switch writes nothing - a record
  // that reads `friends` is not silently turned into `private` by a save that changed the name.
  if (draft.visibility && draft.visibility !== String(profile?.visibility ?? '')) body.visibility = draft.visibility;
  if (media.avatar && media.avatar !== String(profile?.avatar ?? '')) body.avatar = media.avatar;
  const cover = media.cover;
  if (cover && cover !== String(profile?.cover ?? '')) body.cover = cover;
  // The crop travels with the picture (`profile-hero-edit.js:607`: a cover written without the position the
  // owner arranged would drop the frame back into the middle of it). The phone lets it travel on its own as
  // well, because this header draws the frame the record holds - but only while there is a picture to
  // frame: a profile without a cover has nothing to move, and a focus is never written on its own.
  const focus = Number(draft.coverFocus);
  if (focus !== Number(profile?.cover_focus ?? 35) && (cover || profile?.cover)) body.cover_focus = focus;
  return { body, fields: Object.keys(body) };
}

/**
 * A save is offered only when something real changed: the fields the route would write, or a photo
 * that was chosen and not stored yet (`profile-hero-edit.js:604-612`).
 */
export function profileEditDirty(
  profile: ProfileView | null | undefined,
  draft: ProfileDraft,
  media: { avatar?: string; cover?: string } = {},
): boolean {
  if (draft.avatar || draft.cover) return true;
  return profileEditBody(profile, draft, media).fields.length > 0;
}

/** What `GET /api/onboarding/handle` answers (`repo.handleAvailability`), or `null` while nothing is asked. */
export type HandleAvailability = { handle?: string; available?: boolean; reason?: string | null } | null;

/** The one line under the handle field: the route's own three answers, in the interface's words. */
export function handleWords(
  availability: HandleAvailability,
  draft: ProfileDraft,
  profile?: ProfileView | null,
): { tone: 'idle' | 'busy' | 'good' | 'bad'; text: string } {
  const typed = draft.handle.trim().replace(/^@/, '').toLowerCase();
  if (!typed) return { tone: 'idle', text: '' };
  if (!handleChanged(draft, profile)) return { tone: 'idle', text: 'Numele de utilizator al acestui profil.' };
  if (!HANDLE_PATTERN.test(typed)) {
    return { tone: 'bad', text: `Cel mult ${PROFILE_EDIT_LIMITS.handle} de caractere: litere mici, cifre sau _.` };
  }
  if (!availability || String(availability.handle ?? '') !== typed) return { tone: 'busy', text: 'Se verifică…' };
  if (availability.available) return { tone: 'good', text: 'Liber: poate fi revendicat la salvare.' };
  if (availability.reason === 'handle_invalid') return { tone: 'bad', text: 'Nu este un nume de utilizator valid.' };
  return { tone: 'bad', text: 'Este deja folosit de altcineva.' };
}

/**
 * Whether the route wrote what it was sent: the web's own check (`profile-hero-edit.js:622-630`), field by
 * field, over the row the route echoes back. A save the server quietly dropped must never be drawn as if
 * it had landed, which is exactly the bug that check was written for.
 */
export function profileSaveAccepted(body: Record<string, unknown>, row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const saved = row as Record<string, unknown>;
  return Object.entries(body).every(([key, value]) => {
    if (key === 'age') return (saved.age === null || saved.age === undefined ? null : Number(saved.age)) === value;
    if (key === 'cover_focus') return Number(saved.cover_focus ?? 35) === Number(value);
    return String(saved[key] ?? '').trim() === String(value ?? '').trim();
  });
}

/**
 * The header's own reading of what was just written: the fields the route changed, taken from the row it
 * echoed back so the hero and the band show the stored values and not the ones that were typed.
 */
export function savedProfilePatch(body: Record<string, unknown>, row: unknown): Partial<ProfileView> {
  const saved = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const patch: Partial<ProfileView> = {};
  const text = (key: 'name' | 'bio' | 'location' | 'visibility' | 'avatar' | 'cover') => {
    if (key in body) patch[key] = String(saved[key] ?? body[key] ?? '');
  };
  text('name');
  text('bio');
  text('location');
  text('visibility');
  text('avatar');
  text('cover');
  if ('age' in body) {
    const value = saved.age ?? body.age;
    patch.age = value === null || value === undefined || value === '' ? null : Number(value);
  }
  if ('cover_focus' in body) patch.cover_focus = Number(saved.cover_focus ?? body.cover_focus ?? 35);
  return patch;
}

