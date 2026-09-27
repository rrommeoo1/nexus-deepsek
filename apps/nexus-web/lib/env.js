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

export function walletConnectAttestation(env = process.env, origin = "") {
  const projectIdConfigured = /^[a-f0-9]{32}$/i.test(String(env.NEXUS_WC_PROJECT_ID ?? ""));
  const dashboardAttested = String(env.NEXUS_WC_PROJECT_ATTESTED ?? "").toLowerCase() === "true";
  const attestedOrigins = String(env.NEXUS_WC_ATTESTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const originAttested = Boolean(origin) && attestedOrigins.includes(String(origin));
  return {
    ready: projectIdConfigured && dashboardAttested && originAttested,
    projectIdConfigured,
    dashboardAttested,
    originAttested,
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
