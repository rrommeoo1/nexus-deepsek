// Minimal .env loader (no external dependency). Reads KEY=VALUE pairs from the
// app's .env file into process.env, without overriding variables already set.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(file = process.env.NEXUS_ENV_FILE ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".env")) {
  if (!existsSync(file)) return false;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

/**
 * The Reown/WalletConnect project id the login page already publishes.
 *
 * It is public by construction: `/auth/mvx/init` hands it to every page that opens the xPortal login, so
 * it is not a secret. A preview deployment can therefore run the login without anyone pasting runtime
 * variables, and the only origin those defaults cover is the deployment's own `NEXUS_ORIGIN` — the one
 * address the owner controls. Production (anything that is not `NEXUS_DEPLOYMENT_MODE=preview`) still
 * refuses to start without the three variables, and an explicit environment value always wins.
 *
 * This is the owner's own project ("Jungle Book" in WalletConnect Cloud), the only one whose allowlist
 * contains `https://nexus-deepsek-production.up.railway.app`. The previous default belonged to a project
 * nobody here controls and had no public origin at all, so the relay answered every request from the
 * deployed origin with 3000 "origin not allowed" (HANDOFF §0.15).
 */
export const PUBLIC_WALLETCONNECT_PROJECT_ID = "37628068772ce00f33f91f4d51273722";

function splitOrigins(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function walletConnectAttestation(env = process.env, origin = "") {
  const requestedOrigin = String(origin ?? "");
  const previewMode = String(env.NEXUS_DEPLOYMENT_MODE ?? "").trim().toLowerCase() === "preview";
  const deploymentOrigin = String(env.NEXUS_ORIGIN ?? "").trim();
  // Preview defaults exist for exactly one origin: the deployment's own address. A request that names
  // any other origin inherits nothing, so the default can never attest a host nobody configured.
  const defaultsApply = previewMode && Boolean(deploymentOrigin) && requestedOrigin === deploymentOrigin;

  const configuredProjectId = String(env.NEXUS_WC_PROJECT_ID ?? "").trim();
  const projectId = configuredProjectId || (defaultsApply ? PUBLIC_WALLETCONNECT_PROJECT_ID : "");
  const projectIdConfigured = /^[a-f0-9]{32}$/i.test(projectId);

  const configuredAttested = String(env.NEXUS_WC_PROJECT_ATTESTED ?? "").trim().toLowerCase();
  const dashboardAttested = configuredAttested ? configuredAttested === "true" : defaultsApply;

  const configuredOrigins = splitOrigins(env.NEXUS_WC_ATTESTED_ORIGINS);
  const attestedOrigins = configuredOrigins.length ? configuredOrigins : (defaultsApply ? [deploymentOrigin] : []);
  const originAttested = Boolean(requestedOrigin) && attestedOrigins.includes(requestedOrigin);

  return {
    ready: projectIdConfigured && dashboardAttested && originAttested,
    projectIdConfigured,
    dashboardAttested,
    originAttested,
    projectId: projectIdConfigured ? projectId : "",
  };
}

export function validateRuntimeConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return { ok: true, mode: "local" };
  const deploymentMode = String(env.NEXUS_DEPLOYMENT_MODE ?? "production").trim().toLowerCase();
  const isPreview = deploymentMode === "preview";
  const failures = [];
  if (String(env.NEXUS_SESSION_SECRET ?? "").length < 32) failures.push("NEXUS_SESSION_SECRET");
  if (!isPreview) {
    if (!/^[a-f0-9]{32}$/i.test(String(env.NEXUS_WC_PROJECT_ID ?? ""))) failures.push("NEXUS_WC_PROJECT_ID");
    const wcAttestation = walletConnectAttestation(env, env.NEXUS_ORIGIN);
    if (!wcAttestation.dashboardAttested) failures.push("NEXUS_WC_PROJECT_ATTESTED");
    if (!wcAttestation.originAttested) failures.push("NEXUS_WC_ATTESTED_ORIGINS");
  }
  if (!String(env.NEXUS_ACCEPTED_ORIGINS ?? "").trim()) failures.push("NEXUS_ACCEPTED_ORIGINS");
  if (env.NEXUS_RATE_LIMIT_MODE !== "trusted-edge") failures.push("NEXUS_RATE_LIMIT_MODE");
  if (env.NEXUS_TRUST_PROXY !== "1") failures.push("NEXUS_TRUST_PROXY");
  if (!isAbsolute(String(env.NEXUS_DATA_DIR ?? ""))) failures.push("NEXUS_DATA_DIR");
  if (env.NEXUS_MEDIA_STORAGE_PROVIDER && env.NEXUS_MEDIA_STORAGE_PROVIDER !== "local-content-addressed") failures.push("NEXUS_MEDIA_STORAGE_PROVIDER");
  try {
    const origin = new URL(String(env.NEXUS_ORIGIN ?? ""));
    if (origin.protocol !== "https:") failures.push("NEXUS_ORIGIN");
  } catch {
    failures.push("NEXUS_ORIGIN");
  }
  if (failures.length) throw new Error(`production runtime configuration invalid: ${[...new Set(failures)].join(",")}`);
  return { ok: true, mode: isPreview ? "preview" : "production" };
}
