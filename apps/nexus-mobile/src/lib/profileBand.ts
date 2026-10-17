import type { ProfileView } from './socialTypes';

/**
 * The profile band: the one moving line under the header's buttons, and the sheet it opens.
 *
 * The owner's decision (`MIGRATION.md` §20.1) is native-first: the band is not a transcription of a web
 * stylesheet any more. It carries, in this order, the description, the place, the month and year the
 * account was created, the age and the kind of account — each one present only when the payload really
 * carries it, so a missing fact leaves no gap and no stray separator.
 *
 * Two rules about the age, because it is the one number that goes stale on its own:
 *
 *   1. when the payload carries the owner's calendar date (`birth_date`, which the server sends to the
 *      owner alone), the age is derived here on every render — at the birthday, after midnight, and when
 *      the app comes back to the foreground;
 *   2. when it does not (anybody else's record, because a birth date is a stronger fact than an age),
 *      the number the server derived at read time is printed as it came. This file never invents a
 *      date of birth, and never guesses a birthday it was not given (`docs/BACKEND-ONLY.md`).
 *
 * The calendar is the reader's: a birthday happens at local midnight on the device, not at the UTC
 * midnight the server happens to run on. Every function here takes the moment it reads as an argument,
 * so the tests can pin a time zone and a night.
 */

/** The five readings, in the order the band prints them. */
export type BandKind = 'bio' | 'location' | 'member' | 'age' | 'account';

/** One row of the sheet, with the words the band prints for the same fact. */
export type BandRow = {
  kind: BandKind;
  /** The row's own label in the sheet (`Descriere`, `Locație`, …). */
  label: string;
  /** The value alone, as the sheet prints it on its own line. */
  value: string;
  /** The value as the band prints it, glue words included (`Membru din octombrie 2025`). */
  text: string;
  /** The glyph a reading carries in the band, when it has one (`Cont privat` wears the lock). */
  icon?: string;
};

/** One reading of the band: what a reader sees travelling, and what a screen reader hears. */
export type BandItem = { kind: BandKind; text: string; icon?: string };

/** `.ownerTicker` travelled one run in about 48 seconds; this band keeps that pace. */
export const BAND_SECONDS = 48;
/** The width the 48 seconds are measured on: one phone's column, so a longer run travels longer. */
export const BAND_NOMINAL_WIDTH = 360;
/** No cycle is quicker than the nominal one, and none is slower than two and a half of them. */
export const BAND_MIN_MS = BAND_SECONDS * 1000;
export const BAND_MAX_MS = BAND_SECONDS * 2500;

const BIRTH_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function calendarParts(now: number, timeZone?: string): { year: number; month: number; day: number } | null {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    if (!year || !month || !day) return null;
    return { year, month, day };
  } catch {
    /** A zone name this engine does not know falls back to the device's own calendar, never to a guess. */
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
}

/** `YYYY-MM-DD` as the server's `normaliseBirthDate` accepts it: a day the calendar really has. */
export function normaliseBirthDate(value?: string | null): string | null {
  const match = BIRTH_DATE.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200) return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  return match[0];
}

/**
 * The age on the reader's calendar. The birthday has to have happened today for the year to count, so
 * somebody born on 29 February turns a year older on 1 March in a common year — the rule the server's
 * own `deriveAge` reaches, because both read the same two numbers: the month and the day.
 */
export function bandAge(birthDate?: string | null, now: number = Date.now(), timeZone?: string): number | null {
  const normalised = normaliseBirthDate(birthDate);
  if (!normalised) return null;
  const [year, month, day] = normalised.split('-').map(Number);
  const today = calendarParts(now, timeZone);
  if (!today) return null;
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/** `Membru din octombrie 2025` — the month the account was created, from the server's unix seconds. */
export function memberSince(joinedAt?: number | null, timeZone?: string, now: number = Date.now()): string {
  const seconds = Number(joinedAt);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const today = calendarParts(now, timeZone);
  const created = calendarParts(date.getTime(), timeZone);
  if (today && created && (created.year > today.year || (created.year === today.year && created.month > today.month))) return '';
  try {
    const zone = timeZone || undefined;
    const month = new Intl.DateTimeFormat('ro-RO', { month: 'long', timeZone: zone }).format(date);
    const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: zone }).format(date);
    return `${month} ${year}`;
  } catch {
    return `${new Intl.DateTimeFormat('ro-RO', { month: 'long' }).format(date)} ${date.getFullYear()}`;
  }
}

/**
 * The age the band prints: the date of birth when this reader has it, the server's own number when they
 * do not. A date of birth that does not derive an age is not papered over with the fixed one — the row
 * simply does not appear, because a wrong age is worse than no age.
 */
export function displayAge(profile?: ProfileView | null, now: number = Date.now(), timeZone?: string): number | null {
  if (!profile) return null;
  /** A date of birth that is present but unusable is not replaced by the fixed age: the row stays out. */
  if (String(profile.birth_date ?? '').trim()) return bandAge(profile.birth_date, now, timeZone);
  const age = Number(profile.age);
  return Number.isInteger(age) && age >= 13 && age <= 130 ? age : null;
}

/** The five readings of a record, in the owner's order, with every absent fact left out. */
export function bandRows(
  profile?: ProfileView | null,
  now: number = Date.now(),
  options: { timeZone?: string } = {},
): BandRow[] {
  if (!profile) return [];
  const rows: BandRow[] = [];
  const bio = String(profile.bio ?? '').replace(/\s+/gu, ' ').trim();
  if (bio) rows.push({ kind: 'bio', label: 'Descriere', value: bio, text: bio });
  const location = String(profile.location ?? '').trim();
  if (location) rows.push({ kind: 'location', label: 'Locație', value: location, text: location });
  const since = memberSince(profile.joined_at, options.timeZone, now);
  if (since) rows.push({ kind: 'member', label: 'Membru din', value: since, text: `Membru din ${since}` });
  const age = displayAge(profile, now, options.timeZone);
  if (age !== null) rows.push({ kind: 'age', label: 'Vârstă', value: `${age} ani`, text: `${age} ani` });
  const visibility = String(profile.visibility ?? '').trim();
  if (visibility) {
    const open = visibility === 'public';
    rows.push({
      kind: 'account',
      label: 'Tipul contului',
      value: open ? 'Cont public' : 'Cont privat',
      text: open ? 'Cont public' : 'Cont privat',
      icon: open ? '🔓' : '🔒',
    });
  }
  return rows;
}

/** What the band travels: the rows' own words, in the same order. */
export function bandItems(rows: BandRow[]): BandItem[] {
  return rows.map((row) => ({ kind: row.kind, text: row.text, icon: row.icon }));
}

/** One spoken reading of the band, so the line is not five unrelated fragments to a screen reader. */
export function bandLabel(items: BandItem[]): string {
  return items.map((item) => item.text).join(' · ');
}

/**
 * How long one run takes to travel: the 48 seconds the band was asked for, measured on a 360-wide
 * column, so a longer run moves at the same speed instead of finishing sooner. Zero means "do not
 * animate at all", which is what a run that has not been measured yet gets.
 */
export function bandCycleMs(runWidth: number): number {
  if (!(runWidth > 0)) return 0;
  const span = Math.round((runWidth / BAND_NOMINAL_WIDTH) * BAND_SECONDS * 1000);
  return Math.min(BAND_MAX_MS, Math.max(BAND_MIN_MS, span));
}

/**
 * How many copies of the run fill the strip: the run plus its echoes. A strip narrower than the band
 * would leave a hole where the loop closes, so the copies are counted from both widths.
 */
export function bandCopies(runWidth: number, bandWidth: number): number {
  if (!(runWidth > 0)) return 2;
  const needed = Math.ceil((Math.max(0, bandWidth) + runWidth) / runWidth);
  return Math.min(12, Math.max(2, needed));
}
