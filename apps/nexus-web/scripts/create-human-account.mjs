// Create (or verify) one real local email+password Nexus account against a
// running server. The device wallet is generated locally; only the public
// address + signature are sent, exactly like the browser signup flow.
// No external network egress is used.
//
//   node scripts/create-human-account.mjs
//   BASE=http://localhost:5000 node scripts/create-human-account.mjs

import { UserSecretKey } from "@multiversx/sdk-core";

const BASE = process.env.BASE || "http://localhost:5000";
const EMAIL = process.env.NEXUS_ACCOUNT_EMAIL || "romeo@nexus.local";
const PASSWORD = process.env.NEXUS_ACCOUNT_PASSWORD || "NexusDeepsek!2026";
const HANDLE = process.env.NEXUS_ACCOUNT_HANDLE || "romeo";
const DISPLAY_NAME = process.env.NEXUS_ACCOUNT_NAME || "Romeo";

function rid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2)) + "-" + Date.now();
}

async function post(path, body, key) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key, origin: BASE },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") || "" };
}

console.log("Target: " + BASE);
console.log("Email : " + EMAIL);
console.log("Handle: " + HANDLE);

const probe = await post("/auth/email/login", { email: EMAIL, password: PASSWORD }, rid());
if (probe.status === 200) {
  console.log("\nAccount already exists and the password works.");
  console.log("Login OK (reused).");
  process.exit(0);
}

const init = await post("/auth/email/signup-init", { email: EMAIL }, rid());
if (init.status !== 200 || !init.json?.nonce || !init.json?.message) {
  console.error("\nFAILED signup-init: " + init.status + " " + JSON.stringify(init.json));
  process.exit(1);
}

const secret = UserSecretKey.generate();
const address = secret.generatePublicKey().toAddress("erd").toBech32();
const signature = Buffer.from(secret.sign(Buffer.from(init.json.message, "utf8"))).toString("hex");

const signup = await post("/auth/email/signup", {
  email: EMAIL,
  password: PASSWORD,
  handle: HANDLE,
  display_name: DISPLAY_NAME,
  wallet_proof: { nonce: init.json.nonce, address, signature },
}, rid());

if (signup.status === 409) {
  console.log("\nAccount already exists (409). " + JSON.stringify(signup.json));
  const retry = await post("/auth/email/login", { email: EMAIL, password: PASSWORD }, rid());
  console.log("Login retry status: " + retry.status);
  process.exit(retry.status === 200 ? 0 : 1);
}
if (signup.status !== 201 || !signup.json?.ok) {
  console.error("\nFAILED signup: " + signup.status + " " + JSON.stringify(signup.json));
  process.exit(1);
}

console.log("\nCREATED account.");
console.log("  nexus handle : " + signup.json?.user?.handle);
console.log("  display name : " + signup.json?.user?.display_name);
console.log("  wallet addr  : " + (signup.json?.wallet?.address || address));
console.log("  email status : " + signup.json?.email_status);
console.log("  session      : " + (signup.setCookie.startsWith("nexus_session=") ? "issued" : "NOT issued"));

const login = await post("/auth/email/login", { email: EMAIL, password: PASSWORD }, rid());
console.log("\nLOGIN CHECK: " + login.status + " " + (login.json?.ok ? "OK" : "FAILED"));
if (login.status !== 200) {
  console.error(JSON.stringify(login.json));
  process.exit(1);
}

console.log("\n=== CREDENTIALS ===");
console.log("URL      : " + BASE);
console.log("EMAIL    : " + EMAIL);
console.log("PASSWORD : " + PASSWORD);
console.log("HANDLE   : " + signup.json?.user?.handle);