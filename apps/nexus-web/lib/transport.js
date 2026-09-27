export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

export function redirect(res, location, status = 302) {
  res.writeHead(status, { location });
  res.end();
}

export function parseCookies(req) {
  const out = {};
  const rawHeader = req.headers.cookie;
  const header = Array.isArray(rawHeader) ? rawHeader.join("; ") : rawHeader;
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    let value = part.slice(idx + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep raw
    }
    out[key] = value;
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true, sameSite = "Lax", path = "/", secure = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  parts.push(`SameSite=${sameSite}`);
  parts.push(`Path=${path}`);
  const next = parts.join("; ");
  const existing = typeof res.getHeader === "function"
    ? res.getHeader("Set-Cookie")
    : (res.headers?.["Set-Cookie"] ?? res.headers?.["set-cookie"]);
  if (!existing) res.setHeader("Set-Cookie", next);
  else res.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : [existing]), next]);
}

export function clearCookie(res, name, options = {}) {
  setCookie(res, name, "", { ...options, maxAge: 0 });
}

export function readBody(req, limit = 21 * 1024 * 1024) {
  if (Buffer.isBuffer(req.nexusCachedBody)) {
    if (req.nexusCachedBody.length > limit) return Promise.reject(new Error("body too large"));
    return Promise.resolve(req.nexusCachedBody);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      req.nexusCachedBody = Buffer.concat(chunks);
      resolve(req.nexusCachedBody);
    });
    req.on("error", reject);
  });
}

export async function readJson(req, limit) {
  const body = await readBody(req, limit);
  if (body.length === 0) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("invalid json");
  }
}

export function sanitizeText(value, max = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
