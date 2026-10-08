export function commentTimeMs(value?: number | string | null): number | null {
  const numeric = typeof value === 'number' ? value : /^\d+$/.test(String(value ?? '')) ? Number(value) : NaN;
  const stamp = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(String(value ?? ''));
  return Number.isFinite(stamp) && stamp > 0 ? stamp : null;
}

/** A compact age for list rows, from seconds through years. */
export function commentRelativeTime(value?: number | string | null, now = Date.now()): string {
  const stamp = commentTimeMs(value);
  if (stamp === null) return '';
  const seconds = Math.max(0, Math.floor((now - stamp) / 1000));
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'zi' : 'zile'}`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} ${months === 1 ? 'lună' : 'luni'}`;
  const years = Math.floor(days / 365);
  return `${Math.max(1, years)} ${years === 1 ? 'an' : 'ani'}`;
}

/** The exact local date is reserved for the comment opened on its own screen. */
export function commentFullDate(value?: number | string | null): string {
  const stamp = commentTimeMs(value);
  if (stamp === null) return '';
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(stamp));
}
