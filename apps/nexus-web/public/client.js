const HTTP_ERROR_CONTRACT = Object.freeze({
  400: ["BAD_REQUEST", "errors.badRequest", false],
  401: ["AUTH_REQUIRED", "errors.authRequired", false],
  403: ["FORBIDDEN", "errors.forbidden", false],
  404: ["NOT_FOUND", "errors.notFound", false],
  409: ["CONFLICT", "errors.conflict", false],
  413: ["PAYLOAD_TOO_LARGE", "errors.payloadTooLarge", false],
  423: ["ACCOUNT_LOCKED", "errors.accountLocked", false],
  429: ["RATE_LIMITED", "errors.rateLimited", true],
});

function retryAfterSeconds(response) {
  const value = Number(response?.headers?.get?.("retry-after"));
  return Number.isFinite(value) && value >= 0 && value <= 3600 ? value : null;
}

function requestTrace(response) {
  const value = String(response?.headers?.get?.("x-request-id") || "");
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : null;
}

export function normalizeApiResult(response, payload) {
  const httpStatus = Number(response?.status || 0);
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  if (response?.ok && source.ok !== false) return { ...source, ok: true, httpStatus };
  const fallback = HTTP_ERROR_CONTRACT[httpStatus]
    || (httpStatus >= 500 ? ["SERVICE_UNAVAILABLE", "errors.serviceUnavailable", true] : ["REQUEST_FAILED", "errors.requestFailed", false]);
  const code = typeof source.code === "string" && /^[A-Z0-9_]{2,80}$/.test(source.code) ? source.code : fallback[0];
  const retryable = typeof source.retryable === "boolean" ? source.retryable : (code === "IDEMPOTENCY_IN_PROGRESS" || fallback[2]);
  return {
    ...source,
    ok: false,
    code,
    error: typeof source.error === "string" && source.error ? source.error : "request failed",
    errorKey: typeof source.errorKey === "string" ? source.errorKey : fallback[1],
    httpStatus,
    retryable,
    retryAfter: retryAfterSeconds(response),
    requestId: requestTrace(response),
  };
}

export function apiErrorMessage(result, translate = (key) => key) {
  if (!result || result.ok !== false) return "";
  const translated = translate(result.errorKey || "errors.requestFailed");
  return translated && translated !== result.errorKey ? translated : String(result.error || "request failed");
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const method = String(opts.method || "GET").toUpperCase();
  const mutating = new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method);
  if (mutating && !headers["Idempotency-Key"] && !headers["idempotency-key"]) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    headers["Idempotency-Key"] = `nexus-ui-${random}`;
  }
  const init = { method, headers, credentials: "same-origin" };
  if (opts.rawBody !== undefined) {
    init.body = opts.rawBody;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const offline = () => ({
    ok: false,
    code: "OFFLINE",
    error: "Nexus nu poate contacta serverul. Conținutul local rămâne vizibil, dar acțiunea nu a fost confirmată.",
    errorKey: "errors.offline",
    httpStatus: 0,
    retryable: true,
    retryAfter: null,
    requestId: null,
  });
  // Mutations are never queued or presented as successful while the browser is
  // offline. Draft-only UI remains local and can be submitted explicitly later.
  if (mutating && globalThis.navigator?.onLine === false) return offline();
  const maxAttempts = method === "GET" ? 3 : 1;
  let res;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(path, init);
      break;
    } catch {
      if (attempt === maxAttempts || globalThis.navigator?.onLine === false) return offline();
      await new Promise((resolve) => setTimeout(resolve, (attempt * 70) + Math.floor(Math.random() * 31)));
    }
  }
  if (!res) return offline();
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return normalizeApiResult(res, await res.json());
    } catch {
      return normalizeApiResult(res, {
        ok: false, code: "INVALID_RESPONSE", error: "server returned invalid JSON",
        errorKey: "errors.invalidResponse", retryable: res.status >= 500,
      });
    }
  }
  const text = await res.text().catch(() => "");
  return res.ok
    ? { ok: true, httpStatus: res.status, text }
    : normalizeApiResult(res, { ok: false, error: text || "request failed" });
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = String(msg ?? "");
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
