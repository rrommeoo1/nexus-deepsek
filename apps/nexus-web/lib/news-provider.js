// Nexus Breaking news gate (P9). Until now the lens was deliberately truthful: with no approved
// signed-source provider it answered "disabled" instead of inventing headlines. The owner's decision is
// an allow-list of aggregators, so this module is the one place where those providers are named and
// contacted:
//   - nothing is contacted at import time, and nothing is contacted unless the environment names a
//     provider from the registry, so a default checkout still performs no external request;
//   - only https URLs on a host that the registry entry allows may be fetched, and an item whose link
//     points anywhere else keeps its headline and loses its link;
//   - every request has a timeout and a response-size cap, the result is cached per provider, and a
//     provider that fails degrades to the last snapshot (marked stale) or to the honest disabled state.
// A headline is never generated here: if no provider answered, the lens says so.
import { sanitizeText } from "./transport.js";

export const NEWS_REQUEST_TIMEOUT_MS = 6_000;
export const NEWS_RESPONSE_MAX_BYTES = 512 * 1024;
export const NEWS_CACHE_TTL_SECONDS = 900;
export const NEWS_MAX_ITEMS = 30;
// An aggregator is asked for more candidates than the lens will show: a candidate that turns out unusable
// (no headline, a link nobody allowed) must shorten nothing but its own row.
export const NEWS_ASK_MULTIPLIER = 3;
export const NEWS_TITLE_MAX = 180;
export const NEWS_SOURCE_MAX = 60;

// The approved aggregators. A registry entry is a promise: this is the only host the app will ever ask
// for news, and the response shape is the one its parser reads. `parse` returns raw candidates; the
// normalisation below (escaping, length, allow-list) is shared by every provider.
// The parser of an aggregator is written once and referenced by every entry that uses the same shape.
function parseGdeltArticles(body, limit) {
  return (Array.isArray(body?.articles) ? body.articles : []).slice(0, limit).map((item) => ({
    title: item?.title,
    url: item?.url,
    source: item?.domain || item?.sourcecountry,
    published_at: item?.seendate,
    language: item?.language,
  }));
}

export const NEWS_PROVIDER_REGISTRY = Object.freeze({
  gdelt: Object.freeze({
    name: "GDELT",
    documented: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    hosts: Object.freeze(["api.gdeltproject.org"]),
    requires_token: false,
    url: ({ query, limit }) => `https://api.gdeltproject.org/api/2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${limit}&sort=HybridRel&format=json`,
    parse: parseGdeltArticles,
  }),
  newsapi: Object.freeze({
    name: "NewsAPI",
    documented: "https://newsapi.org/docs/endpoints/top-headlines",
    hosts: Object.freeze(["newsapi.org"]),
    requires_token: true,
    url: ({ query, limit }) => `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(query)}&pageSize=${limit}&language=en`,
    headers: ({ token }) => ({ "x-api-key": token }),
    parse: (body, limit) => (Array.isArray(body?.articles) ? body.articles : []).slice(0, limit).map((item) => ({
      title: item?.title,
      url: item?.url,
      source: item?.source?.name,
      published_at: item?.publishedAt,
      language: null,
    })),
  }),
  // A loopback fixture, so the whole path (fetch, normalise, cache, route, render) can be proven on one
  // machine with no external network at all. It is refused in production, it speaks http only on
  // 127.0.0.1, and the address has to be given explicitly - there is no default anyone could ship.
  "local-fixture": Object.freeze({
    name: "Local fixture",
    documented: "apps/nexus-web/.env.example",
    hosts: Object.freeze(["127.0.0.1"]),
    requires_token: false,
    loopback: true,
    url: ({ fixtureUrl }) => fixtureUrl,
    parse: parseGdeltArticles,
  }),
});

export const NEWS_REGISTRY_IDS = Object.freeze(Object.keys(NEWS_PROVIDER_REGISTRY));

// A hostname only: no scheme, no path, no port, no wildcard. An operator may extend the allow-list, but
// never with something that could be read as a second destination.
export function isPlainNewsHost(value) {
  const host = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host);
}

// The status an owner sees is derived from configuration alone, so it can be reported without contacting
// anybody: a provider that is not named, or a key that is missing, is "disabled" with the reason.
export function newsProviderConfig(env = process.env) {
  const id = String(env.NEXUS_NEWS_PROVIDER ?? "").trim().toLowerCase();
  const provider = Object.prototype.hasOwnProperty.call(NEWS_PROVIDER_REGISTRY, id) ? NEWS_PROVIDER_REGISTRY[id] : null;
  if (!provider) {
    return {
      status: "disabled",
      reason: id
        ? `"${sanitizeText(id, 40)}" is not an approved news aggregator`
        : "No approved news aggregator is configured",
      registry: NEWS_REGISTRY_IDS.slice(),
    };
  }
  const token = String(env.NEXUS_NEWS_PROVIDER_TOKEN ?? "").trim();
  if (provider.requires_token && !token) {
    return { status: "disabled", id, name: provider.name, reason: `${provider.name} needs its provider key configured`, registry: NEWS_REGISTRY_IDS.slice() };
  }
  // The loopback fixture exists for local proof, so production refuses it outright.
  const fixtureUrl = String(env.NEXUS_NEWS_FIXTURE_URL ?? "").trim();
  if (provider.loopback) {
    if (env.NODE_ENV === "production") {
      return { status: "disabled", id, name: provider.name, reason: `${provider.name} exists for local proof and is refused in production`, registry: NEWS_REGISTRY_IDS.slice() };
    }
    if (!fixtureUrl) {
      return { status: "disabled", id, name: provider.name, reason: `${provider.name} needs NEXUS_NEWS_FIXTURE_URL`, registry: NEWS_REGISTRY_IDS.slice() };
    }
  }
  const extraHosts = String(env.NEXUS_NEWS_PROVIDER_HOSTS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(isPlainNewsHost);
  const limit = Math.max(1, Math.min(Number(env.NEXUS_NEWS_MAX_ITEMS) || NEWS_MAX_ITEMS, NEWS_MAX_ITEMS));
  const ttl = Math.max(60, Math.min(Number(env.NEXUS_NEWS_CACHE_TTL_SECONDS) || NEWS_CACHE_TTL_SECONDS, 86_400));
  const timeout = Math.max(1_000, Math.min(Number(env.NEXUS_NEWS_TIMEOUT_MS) || NEWS_REQUEST_TIMEOUT_MS, 20_000));
  return {
    status: "ready",
    id,
    name: provider.name,
    hosts: [...new Set([...provider.hosts, ...extraHosts])],
    query: sanitizeText(env.NEXUS_NEWS_QUERY ?? "world", 120) || "world",
    fixtureUrl: provider.loopback ? fixtureUrl : undefined,
    loopback: provider.loopback === true,
    limit,
    ttlSeconds: ttl,
    timeoutMs: timeout,
    token,
  };
}

// The allow-list check is the gate: a URL is followed only when it is https and its host is one of the
// hosts this provider was approved for. A loopback fixture is the single exception, and it has to be
// asked for explicitly - it never becomes the default for anybody.
export function allowlistedNewsUrl(value, config, { allowHttpLoopback = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(value ?? ""));
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!(config?.hosts ?? []).includes(host)) return null;
  if (parsed.protocol === "https:") return parsed.toString();
  if (allowHttpLoopback && parsed.protocol === "http:" && host === "127.0.0.1") return parsed.toString();
  return null;
}

// A headline is text from somebody else, so it is flattened before it is stored or rendered: markup,
// entities, control characters and the bidi overrides that make two different headlines look identical
// all go away, and the length is capped.
export function sanitizeNewsText(value, max) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x?[0-9a-f]+;?/gi, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39|#34);/gi, " ")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Math.max(1, Math.floor(Number(max) || 1));
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

// Dates from an aggregator arrive in whatever shape that aggregator uses. ISO strings and GDELT's
// "20260920T134500Z" both become epoch milliseconds, and an unreadable date becomes null rather than now.
export function newsTimestamp(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const gdelt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  const iso = gdelt ? `${gdelt[1]}-${gdelt[2]}-${gdelt[3]}T${gdelt[4]}:${gdelt[5]}:${gdelt[6]}Z` : text;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

// One candidate becomes one item, or nothing at all: a headline without text is not news.
export function normalizeNewsItem(candidate, config) {
  const title = sanitizeNewsText(candidate?.title, NEWS_TITLE_MAX);
  if (!title) return null;
  return {
    title,
    url: allowlistedNewsUrl(candidate?.url, config),
    source: sanitizeNewsText(candidate?.source, NEWS_SOURCE_MAX) || config?.name || "",
    published_at: newsTimestamp(candidate?.published_at),
    language: sanitizeNewsText(candidate?.language, 12) || null,
  };
}

export function normalizeNewsItems(candidates, config) {
  const items = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const item = normalizeNewsItem(candidate, config);
    if (item) items.push(item);
    if (items.length >= (config?.limit ?? NEWS_MAX_ITEMS)) break;
  }
  return items;
}

// Snapshots live in memory, per provider: the lens is one request away from the same list, and an
// aggregator that rate-limits gets asked once per window instead of once per viewer.
const NEWS_SNAPSHOTS = new Map();

export function resetNewsSnapshots() {
  NEWS_SNAPSHOTS.clear();
}

export function readNewsSnapshotCache(id) {
  return NEWS_SNAPSHOTS.get(id) ?? null;
}

// The read itself. It never throws into a route: every failure becomes a status a person can read.
export async function readBreakingNews({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), cache = null } = {}) {
  const config = newsProviderConfig(env);
  if (config.status !== "ready") return { status: "disabled", reason: config.reason, registry: config.registry, items: [] };
  const store = cache ?? NEWS_SNAPSHOTS;
  const cached = store.get(config.id) ?? null;
  const stamp = now();
  if (cached && cached.expires_at > stamp) {
    return { status: "ready", provider: providerDescriptor(config, cached, false), items: cached.items, cached: true };
  }
  const provider = NEWS_PROVIDER_REGISTRY[config.id];
  const askLimit = Math.min(config.limit * NEWS_ASK_MULTIPLIER, NEWS_MAX_ITEMS * NEWS_ASK_MULTIPLIER);
  // The request itself has to pass the same gate the links pass: a provider whose address is not on its
  // own allow-list is not contacted at all.
  const target = allowlistedNewsUrl(provider.url({ ...config, limit: askLimit }), config, { allowHttpLoopback: config.loopback === true });
  if (!target) {
    return { status: "disabled", reason: `${config.name} is configured with an address that is not on its allow-list`, registry: NEWS_REGISTRY_IDS.slice(), items: [] };
  }
  let text = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response;
    try {
      response = await fetchImpl(target, {
        signal: controller.signal,
        headers: { accept: "application/json", ...(provider.headers ? provider.headers(config) : {}) },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response?.ok) throw new Error(`${provider.name} answered ${response?.status ?? "nothing"}`);
    const payload = await response.text();
    if (payload.length > NEWS_RESPONSE_MAX_BYTES) throw new Error(`${provider.name} answered more than ${NEWS_RESPONSE_MAX_BYTES} bytes`);
    text = payload;
  } catch (error) {
    // A failing aggregator is a status, not an outage: the last snapshot is served marked stale, and
    // without one the lens stays truthful about having nothing.
    const reason = `${provider.name} could not be reached (${sanitizeText(error?.message ?? "unknown", 120)})`;
    if (cached) return { status: "ready", provider: providerDescriptor(config, cached, true, reason), items: cached.items, cached: true, stale: true };
    return { status: "disabled", reason, registry: NEWS_REGISTRY_IDS.slice(), items: [] };
  }
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    const reason = `${provider.name} answered something that is not news json`;
    if (cached) return { status: "ready", provider: providerDescriptor(config, cached, true, reason), items: cached.items, cached: true, stale: true };
    return { status: "disabled", reason, registry: NEWS_REGISTRY_IDS.slice(), items: [] };
  }
  const items = normalizeNewsItems(provider.parse(body, askLimit), config);
  const snapshot = { items, fetched_at: stamp, expires_at: stamp + config.ttlSeconds * 1_000 };
  store.set(config.id, snapshot);
  return { status: "ready", provider: providerDescriptor(config, snapshot, false), items, cached: false };
}

function providerDescriptor(config, snapshot, stale, reason = "") {
  return {
    status: "ready",
    id: config.id,
    name: config.name,
    // The client may only build a link for these hosts, so the list travels with the answer.
    allowed_hosts: config.hosts.slice(),
    fetched_at: snapshot.fetched_at,
    expires_at: snapshot.expires_at,
    stale: Boolean(stale),
    reason: reason || undefined,
  };
}

export function writeNewsSnapshotCache(id, snapshot) {
  NEWS_SNAPSHOTS.set(id, snapshot);
  return snapshot;
}
