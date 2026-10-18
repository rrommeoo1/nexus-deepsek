/**
 * `monetized` for every author object in a payload, without touching a single builder.
 *
 * The flag is a property of the creator, not of the screen: a profile charges for at least one
 * action (`repo.monetizedAuthorIds()`, one query) and every place its name appears must say so.
 * Rather than teaching a dozen builders the same field — and forgetting one — the response is
 * walked once, and any object that looks like an author (a string `handle` and a numeric `id`)
 * gets the boolean. Nothing else is added, nothing is removed, and an endpoint written tomorrow
 * inherits the flag without being edited.
 */

/** True for a plain author-shaped object: `handle` plus a numeric `id`. */
function isAuthor(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.handle !== "string" || value.handle.length === 0) return false;
  const id = Number(value.id);
  return Number.isSafeInteger(id) && id > 0;
}

function mark(value, ids, seen) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) mark(item, ids, seen);
    return value;
  }
  if (isAuthor(value)) value.monetized = ids.has(Number(value.id));
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object") mark(child, ids, seen);
  }
  return value;
}

/** Adds `monetized` to every author object in `payload`; `null` ids leaves the payload untouched. */
export function withMonetizedAuthors(payload, ids) {
  if (!ids || typeof ids.has !== "function") return payload;
  return mark(payload, ids, new Set());
}
