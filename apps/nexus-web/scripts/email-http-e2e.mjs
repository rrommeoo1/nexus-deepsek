/**
 * The whole email-auth flow over real HTTP, on a disposable instance — no mocks, no owner data.
 *
 * `npm run test:email-http` starts `server.js` with a temporary `NEXUS_DATA_DIR`, a temporary capture
 * mailbox and port 5099, then drives: register → captured message → confirm (and a second confirm that
 * must fail) → login → reset request (and an unknown address that must answer identically) → reset
 * confirm (and a replay that must fail) → login with the old password (must fail) and the new one (must
 * succeed) → the password-changed notice. It also asserts that no API answer and no log line carries a
 * token. Everything is deleted at the end; `C:\Nexus\data` is never opened.
 *
 * The capture adapter is the point of the exercise: it proves the full path without a mail provider.
 * With a provider configured (`NEXUS_EMAIL_PROVIDER=resend`), the same script proves the full path with
 * a real delivery — and then `verification.delivery` is `provider` instead of `captured_locally`.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.NEXUS_E2E_PORT ?? 5099);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "nexus-e2e-data-"));
const captureDir = join(dataDir, "mail-capture");
const results = [];

function check(label, condition, detail = "") {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
}

let keyCounter = 0;

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      // `/auth/email/login` sits behind the replay boundary every mutation uses: one key per attempt.
      "idempotency-key": `e2e-email-auth-${++keyCounter}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload };
}

function latestMail() {
  const files = readdirSync(captureDir).filter((name) => name.endsWith(".json")).sort();
  return files.length ? JSON.parse(readFileSync(join(captureDir, files[files.length - 1]), "utf8")) : null;
}

function tokenOf(mail) {
  const match = String(mail?.text ?? "").match(/[?&]token=([A-Za-z0-9_-]{20,})/);
  return match ? match[1] : "";
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: APP,
  env: {
    ...process.env,
    NODE_ENV: "development",
    NEXUS_DEPLOYMENT_MODE: "local",
    NEXUS_DATA_DIR: dataDir,
    NEXUS_EMAIL_CAPTURE_DIR: captureDir,
    NEXUS_EMAIL_LINK_ORIGIN: BASE,
    NEXUS_EMAIL_RESPONSE_FLOOR_MS: "0",
    NEXUS_SESSION_SECRET: "e2e-local-secret-that-is-long-enough-0123456789",
    PORT: String(PORT),
    HOST: "127.0.0.1",
    HTTPS_PORT: "3445",
    NEXUS_REQUEST_LOG: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += String(chunk); });
server.stderr.on("data", (chunk) => { serverLog += String(chunk); });

async function waitForHealth(deadlineMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

try {
  check("server starts on a throwaway instance", await waitForHealth(), `${BASE} · data ${dataDir}`);

  const capabilities = await (await fetch(`${BASE}/api/auth-capabilities`)).json();
  check("capabilities report the mail flows as available",
    capabilities?.email?.configured === true && capabilities?.email?.delivery === "captured_locally",
    String(capabilities?.email?.delivery));

  const status = await fetch(`${BASE}/api/email/status`);
  check("/api/email/status answers locally", status.status === 200);

  const email = "e2e.owner@junglebook.test";
  const registered = await post("/auth/email/register", { email, password: "parola-initiala-1", handle: "e2eowner" });
  check("register creates the account", registered.status === 201 && registered.body?.created === true, String(registered.body?.user?.handle));
  check("register reports a captured message, not a delivery",
    registered.body?.verification?.delivery === "captured_locally" && registered.body?.verification?.delivered === false);

  const verifyMail = latestMail();
  check("the confirmation message exists locally", Boolean(verifyMail) && /Confirm/.test(String(verifyMail.subject)), String(verifyMail?.subject));
  const verifyToken = tokenOf(verifyMail);
  check("register never returns the token", !JSON.stringify(registered.body).includes(verifyToken));
  check("the confirmation link points at the configured origin",
    String(verifyMail?.text).includes(`${BASE}/verify-email.html?token=`),
    String(verifyMail?.text).split("\n").find((line) => line.startsWith("http")) ?? "");

  const inbox = await (await fetch(`${BASE}/api/dev/mail-capture`)).json();
  check("the dev inbox lists the captured message", inbox?.messages?.length === 1 && inbox?.delivery === "captured_locally");

  const confirmed = await post("/auth/email/verification/confirm", { token: verifyToken });
  check("confirm marks the address verified", confirmed.status === 200 && confirmed.body?.verified === true, String(confirmed.body?.handle));
  const confirmedAgain = await post("/auth/email/verification/confirm", { token: verifyToken });
  check("the same link cannot be used twice", confirmedAgain.status === 400 && confirmedAgain.body?.code === "EMAIL_TOKEN_INVALID");

  const loginBefore = await post("/auth/email/login", { email, password: "parola-initiala-1" });
  check("login works with the confirmed account", loginBefore.status === 200);

  const resetRequested = await post("/auth/email/reset-request", { email });
  check("reset-request answers without revealing anything",
    resetRequested.status === 202 && Object.keys(resetRequested.body).sort().join(",") === "ok,requested");
  const unknown = await post("/auth/email/reset-request", { email: "nobody@junglebook.test" });
  check("an unknown address gets the identical answer",
    unknown.status === 202 && JSON.stringify(unknown.body) === JSON.stringify(resetRequested.body));

  const resetMail = latestMail();
  check("the reset message exists locally", Boolean(resetMail) && /Reseteaz/.test(String(resetMail.subject)), String(resetMail?.subject));
  const resetToken = tokenOf(resetMail);

  const reset = await post("/auth/email/reset-confirm", { token: resetToken, password: "parola-noua-2" });
  check("reset-confirm changes the password and revokes sessions",
    reset.status === 200 && reset.body?.sessions_revoked === true, String(reset.body?.handle));
  const replay = await post("/auth/email/reset-confirm", { token: resetToken, password: "parola-treia-3" });
  check("a spent reset link is refused", replay.status === 400 && replay.body?.code === "EMAIL_TOKEN_INVALID");

  const oldPassword = await post("/auth/email/login", { email, password: "parola-initiala-1" });
  const newPassword = await post("/auth/email/login", { email, password: "parola-noua-2" });
  check("the old password stops working", oldPassword.status === 401);
  check("the new password works", newPassword.status === 200);

  const notice = latestMail();
  check("a password-changed notice was produced", /schimbat/.test(String(notice?.subject ?? "")), String(notice?.subject));
  check("the notice carries no link", !/https?:\/\//.test(String(notice?.text ?? "")));

  check("no API answer or log line carries a token",
    Boolean(verifyToken) && !serverLog.includes(verifyToken) && !serverLog.includes(resetToken));
} catch (error) {
  check("the run finished without an exception", false, String(error?.stack ?? error));
} finally {
  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(dataDir, { recursive: true, force: true });
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("server log tail:\n" + serverLog.split("\n").slice(-30).join("\n"));
  process.exitCode = 1;
}
