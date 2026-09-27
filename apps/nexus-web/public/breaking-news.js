// The Breaking lens, third state: before P9 it could only say "disabled". Now an allow-listed
// aggregator may answer, and this module renders that answer.
//
// A headline is somebody else's text, so nothing in it is trusted: every field is escaped here, no
// markup from the payload survives, and a link is built only for a host the server said it had
// allow-listed. The rows carry no script and no image from the source; the source name is text.
//
// The module owns its escaping fallback for the same reason the band and the drawer do: a renderer that
// can be called without an escaper is a renderer that will eventually be called without one.
export const BREAKING_HOSTS_MAX = 16;
export const BREAKING_TITLE_MAX = 180;

export function breakingAllowedHosts(provider) {
  const hosts = Array.isArray(provider?.allowed_hosts) ? provider.allowed_hosts : [];
  return hosts
    .map((host) => String(host ?? "").trim().toLowerCase())
    .filter((host) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host))
    .slice(0, BREAKING_HOSTS_MAX);
}

// Only an https address on an allow-listed host becomes a link. Everything else is printed as text: a
// headline may keep its words without sending the reader to a host nobody approved.
export function breakingNewsHref(value, hosts) {
  let parsed;
  try {
    parsed = new URL(String(value ?? ""));
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!(Array.isArray(hosts) ? hosts : []).includes(host)) return null;
  return parsed.toString();
}

export function breakingNewsItems(payload, hosts) {
  const items = Array.isArray(payload?.news) ? payload.news : [];
  return items
    .map((item) => ({
      title: String(item?.title ?? "").trim(),
      source: String(item?.source ?? "").trim(),
      href: breakingNewsHref(item?.url, hosts),
      published_at: Number.isFinite(Number(item?.published_at)) ? Number(item.published_at) : null,
    }))
    .filter((item) => item.title)
    .slice(0, 40);
}

// The provider line is where truth about freshness lives: a snapshot that could not be refreshed says
// so instead of pretending to be live.
export function breakingProviderLine(provider, { t }) {
  const tr = typeof t === "function" ? t : (key) => key;
  const name = String(provider?.name ?? "").trim();
  const parts = [];
  if (name) parts.push(tr("feed.breakingSource") + " " + name);
  if (provider?.stale === true) parts.push(tr("feed.breakingStale"));
  return parts.join(" · ");
}

function escape(esc, value) {
  if (typeof esc === "function") return esc(String(value ?? ""));
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

// One card: the headline, the source and the time, and - this is the whole reason the card is a card -
// what can be done with it. A headline whose own address points somewhere the owner never approved keeps
// its words and loses its link, and the card says which of the two it is instead of looking like a link
// that does nothing when pressed. No image and no category travel with a card, because the aggregator
// sends neither: a chip or a picture here would be invented, and this lens invents nothing.
// A relative stamp is passed in, because the feed already owns relative time formatting and the lens
// should not invent a second one.
export function breakingNewsCardMarkup(item, { esc, t, stamp = "" } = {}) {
  const tr = typeof t === "function" ? t : (key) => key;
  const title = escape(esc, item.title);
  const heading = item.href
    ? '<a class="breakingNewsTitle" href="' + escape(esc, item.href) + '" target="_blank" rel="noopener noreferrer">' + title + "</a>"
    : '<b class="breakingNewsTitle">' + title + "</b>";
  const meta = [item.source, stamp].filter(Boolean).map((value) => escape(esc, value)).join(" · ");
  const held = item.href ? "" : '<span class="breakingNewsHeld">' + escape(esc, tr("feed.breakingNoLink")) + "</span>";
  const line = [meta, held].filter(Boolean).join(" · ");
  return '<li class="breakingNewsCard" data-breaking-item>'
    + '<span class="breakingNewsCardMark" aria-hidden="true">▤</span>'
    + '<span class="breakingNewsCardBody">' + heading
    + (line ? '<small class="breakingNewsMeta">' + line + "</small>" : "")
    + "</span>"
    + (item.href ? '<em class="breakingNewsCardOut" aria-hidden="true">↗</em>' : "")
    + "</li>";
}

export function breakingNewsMarkup(payload, { esc, t, locale = "ro-RO", stamp = () => "" } = {}) {
  const tr = typeof t === "function" ? t : (key) => key;
  const hosts = breakingAllowedHosts(payload?.provider);
  const items = breakingNewsItems(payload, hosts);
  const line = breakingProviderLine(payload?.provider, { t: tr });
  const header = '<header class="breakingNewsHead"><b>' + escape(esc, tr("feed.breaking")) + "</b>"
    + (line ? "<small>" + escape(esc, line) + "</small>" : "")
    + "</header>";
  if (!items.length) {
    return '<div class="breakingNews" data-breaking-news data-breaking-state="empty">' + header
      + '<p class="breakingNewsEmpty">' + escape(esc, tr("feed.breakingEmpty")) + "</p></div>";
  }
  const rows = items.map((item) => breakingNewsCardMarkup(item, {
    esc, t: tr, stamp: typeof stamp === "function" ? stamp(item.published_at) : "",
  })).join("");
  return '<div class="breakingNews" data-breaking-news data-breaking-state="ready"'
    + (payload?.provider?.stale === true ? ' data-breaking-stale="1"' : "") + ">"
    + header + '<ol class="breakingNewsList">' + rows + "</ol>"
    + '<p class="breakingNewsNote">' + escape(esc, tr("feed.breakingNote")) + "</p></div>";
}
