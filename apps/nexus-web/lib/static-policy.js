const DEVICE_LAB_ROUTES = new Map([
  ["/diagnostics/e2ee-device-lab", "/diagnostics/e2ee-device-lab.html"],
  ["/diagnostics/e2ee-device-lab.html", "/diagnostics/e2ee-device-lab.html"],
  ["/diagnostics/e2ee-device-lab.js", "/diagnostics/e2ee-device-lab.js"],
]);

export function resolveStaticRequest(requestUrl, { nodeEnv = process.env.NODE_ENV, deviceLab = process.env.NEXUS_DEVICE_LAB } = {}) {
  const rawPath = String(requestUrl ?? "/").split("?")[0];
  if (!rawPath.startsWith("/") || rawPath.includes("\\") || rawPath.includes("\0")) return { ok: false, status: 404 };
  const rawSegments = rawPath.split("/");
  const decodedSegments = [];
  try {
    for (const segment of rawSegments) {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0")) return { ok: false, status: 404 };
      if (decoded.startsWith(".")) return { ok: false, status: 404 };
      decodedSegments.push(decoded);
    }
  } catch {
    return { ok: false, status: 404 };
  }
  const canonicalPath = decodedSegments.join("/") || "/";
  const policyPath = canonicalPath.toLowerCase();
  if (policyPath === "/diagnostics" || policyPath.startsWith("/diagnostics/")) {
    if (canonicalPath !== policyPath) return { ok: false, status: 404 };
    const allowed = DEVICE_LAB_ROUTES.get(policyPath);
    if (!allowed || nodeEnv === "production" || deviceLab !== "true") return { ok: false, status: 404 };
    return { ok: true, relativePath: allowed };
  }
  return { ok: true, relativePath: canonicalPath === "/" ? "/index.html" : canonicalPath };
}
