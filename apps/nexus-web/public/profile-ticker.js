// The ticker band is the profile's one moving part: a read-only loop of what the record already
// says, directly above the content tabs. Nothing in it is an action - no button, no link, no field -
// so the band can never become a second, unmanaged door into the profile, and every value is escaped
// text rather than markup.
//
// It has exactly one knob, its speed, and that knob is global (Appearance, per device) instead of
// per profile: an owner cannot slow the band down for somebody else. The seconds-per-item constant
// below is the single place where that pacing is defined.

export const PROFILE_TICKER_SECONDS_PER_ITEM = 6;
export const PROFILE_TICKER_MIN_SPAN = 26;
export const PROFILE_TICKER_MAX_SPAN = 120;
export const PROFILE_TICKER_FRAGMENTS = 8;
export const PROFILE_TICKER_FRAGMENT_MAX = 96;
export const PROFILE_TICKER_SPEED_KEY = "nexus-ticker-speed-v1";

// Slow, medium and fast are multipliers over the pacing constant, never fixed durations, so the band
// travels at the same speed whether it carries four items or twelve.
export const PROFILE_TICKER_SPEEDS = Object.freeze([
  Object.freeze({ id: "slow", factor: 1.7, label: "profile.tickerSlow" }),
  Object.freeze({ id: "medium", factor: 1, label: "profile.tickerMedium" }),
  Object.freeze({ id: "fast", factor: 0.62, label: "profile.tickerFast" }),
]);

const DEFAULT_SPEED = "medium";

export function tickerSpeedId(value) {
  return PROFILE_TICKER_SPEEDS.some((speed) => speed.id === value) ? value : DEFAULT_SPEED;
}

export function tickerSpeedLabelKey(value) {
  return PROFILE_TICKER_SPEEDS.find((speed) => speed.id === tickerSpeedId(value)).label;
}

export function nextTickerSpeed(value) {
  const index = PROFILE_TICKER_SPEEDS.findIndex((speed) => speed.id === tickerSpeedId(value));
  return PROFILE_TICKER_SPEEDS[(index + 1) % PROFILE_TICKER_SPEEDS.length].id;
}

// A browser without storage, a private window or a damaged value all fall back to the same default:
// the band is decoration, and decoration never blocks the profile from rendering.
export function readTickerSpeed(storage = globalThis.localStorage) {
  try {
    return tickerSpeedId(storage?.getItem(PROFILE_TICKER_SPEED_KEY));
  } catch {
    return DEFAULT_SPEED;
  }
}

export function writeTickerSpeed(value, storage = globalThis.localStorage) {
  const id = tickerSpeedId(value);
  try {
    storage?.setItem(PROFILE_TICKER_SPEED_KEY, id);
  } catch {
    /* the choice stays for this session only */
  }
  return id;
}

// One cycle has to be long enough to read and short enough to notice, and it grows with the number
// of items so a profile with a long description does not turn the band into a sprint.
export function profileTickerSpan(items, speed = DEFAULT_SPEED) {
  const count = Math.max(1, Math.floor(Number(items)) || 1);
  const factor = PROFILE_TICKER_SPEEDS.find((entry) => entry.id === tickerSpeedId(speed)).factor;
  const seconds = Math.round(count * PROFILE_TICKER_SECONDS_PER_ITEM * factor);
  return Math.min(PROFILE_TICKER_MAX_SPAN, Math.max(PROFILE_TICKER_MIN_SPAN, seconds));
}

// The speed is a CSS variable on the band, so changing it never re-renders the profile: the loop
// keeps its position and only its pace changes.
export function applyTickerSpeed(root, value) {
  const id = tickerSpeedId(value);
  root?.querySelectorAll?.(".ownerTicker[data-owner-ticker-count]").forEach((band) => {
    const span = profileTickerSpan(band.dataset.ownerTickerCount, id);
    band.style?.setProperty("--tickerSpan", span + "s");
  });
  return id;
}

// A description is prose, and the band shows the pieces of it that read as headlines: the lines the
// owner wrote, split on the separators people actually type. Three fragments at most, because the
// band is a summary of the profile and not a second copy of it.
export function profileTickerFragments(bio, limit = PROFILE_TICKER_FRAGMENTS) {
  const max = Math.max(0, Math.floor(Number(limit)) || 0);
  if (!max) return [];
  return String(bio ?? "")
    .split(/\r?\n|[·|]|(?<=[.!?…])\s+/u)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((fragment) => (fragment.length > PROFILE_TICKER_FRAGMENT_MAX
      ? fragment.slice(0, PROFILE_TICKER_FRAGMENT_MAX - 1).trimEnd() + "…"
      : fragment));
}

// The order is the order a profile is read in: where the person is, who they are, what they have
// published, and then their own words.
export function profileTickerItems(profile, { t, locale = "ro-RO", limit = PROFILE_TICKER_FRAGMENTS } = {}) {
  const tr = typeof t === "function" ? t : (key) => key;
  const count = (key) => Math.max(0, Number(profile?.counts?.[key]) || 0).toLocaleString(locale);
  const items = [];
  const location = String(profile?.location || "").trim();
  if (location) items.push({ kind: "location", icon: "📍", value: location });
  // An age is a number the owner declared, so it travels next to the place: it is printed with the unit
  // the interface language uses, and a profile that carries none simply has no such item. It is never
  // derived here - nothing in this band computes an age from a date.
  const age = profile?.age;
  if (Number.isInteger(age) && age >= 13 && age <= 120) {
    items.push({ kind: "age", icon: "🎂", count: age.toLocaleString(locale), label: tr("profile.years") });
  }
  const handle = String(profile?.handle || "").trim();
  if (handle) items.push({ kind: "handle", value: "@" + handle });
  items.push({ kind: "posts", count: count("posts"), label: tr("profile.posts") });
  items.push({ kind: "followers", count: count("followers"), label: tr("profile.followers") });
  items.push({ kind: "following", count: count("following"), label: tr("profile.following") });
  for (const fragment of profileTickerFragments(profile?.bio, limit)) {
    items.push({ kind: "bio", value: fragment });
  }
  return items;
}

// The band carries the same text twice: the second run is what enters the screen while the first one
// leaves it, and because both runs are identical the loop closes without a jump. The dots, the icons
// and the values are spans - there is no interactive element to focus anywhere inside it.
export function profileTickerMarkup(profile, { esc, t, locale = "ro-RO", speed = DEFAULT_SPEED, limit } = {}) {
  const items = profileTickerItems(profile, { t, locale, limit });
  const run = items.map((item) => '<span class="ownerTickerItem">'
    + '<i class="ownerTickerSep" aria-hidden="true"></i>'
    + (item.icon ? '<i class="ownerTickerIcon" aria-hidden="true">' + escape(esc, item.icon) + "</i>" : "")
    + (item.label
      ? '<span class="ownerTickerCount"><b>' + escape(esc, item.count) + "</b><small>" + escape(esc, item.label) + "</small></span>"
      : '<span class="ownerTickerValue">' + escape(esc, item.value) + "</span>")
    + "</span>").join("");
  return '<div class="ownerTicker" data-owner-ticker data-owner-ticker-count="' + items.length + '"'
    + ' style="--tickerSpan:' + profileTickerSpan(items.length, speed) + 's" aria-hidden="true">'
    + '<div class="ownerTickerTrack"><span class="ownerTickerRun">' + run + "</span>"
    + '<span class="ownerTickerRun">' + run + "</span></div></div>";
}

// The profile renders through the caller's escaping; a direct call still escapes, because a band that
// can be built without an escaper is a band that will eventually be built without one.
function escape(esc, value) {
  if (typeof esc === "function") return esc(String(value ?? ""));
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}
