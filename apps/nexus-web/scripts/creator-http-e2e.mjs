// F1 prin HTTP real: server local, douÄƒ conturi, rutele din `MONETIZATION-SPEC.md` Â§4.3.
//
// De ce un script È™i nu un test unitar: `test/creator-settlement.test.js` cheamÄƒ funcÈ›iile direct, deci
// nu dovedeÈ™te nimic despre rutare, despre cookie-ul de sesiune, despre `NEXUS_SETTLE_DEMO` citit din
// mediu sau despre antetul `Idempotency-Key`. Aici fiecare pas trece prin serverul aplicaÈ›iei, exact cum
// ar trece un client.
//
// Ce NU este aici, deliberat: `depositTreasury`, `payCreatorPayout` È™i `reconcileCreatorLedger` nu au rutÄƒ
// Ã®n Â§4.3, deci se cheamÄƒ ca funcÈ›ii pe aceeaÈ™i bazÄƒ â€” scriptul spune asta la fiecare pas. Niciun ban
// real, niciun apel de reÈ›ea: baza e un director temporar, È™ters la final.
//
// Rulare: `node scripts/creator-http-e2e.mjs` (sau `npm run test:creator-http`).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { issueSession } from "../lib/security.js";
import { depositTreasury, payCreatorPayout, reconcileCreatorLedger } from "../lib/creator-settlement.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..");
const results = [];
let failures = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` â€” ${detail}` : ""}`);
}

function assertStep(name, condition, detail) {
  record(name, Boolean(condition), detail);
  return Boolean(condition);
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(base, child, deadlineMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    if (child.exitCode !== null) throw new Error(`serverul a ieÈ™it cu codul ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return await response.json();
    } catch { /* Ã®ncÄƒ porneÈ™te */ }
    await new Promise((step) => setTimeout(step, 300));
  }
  throw new Error("serverul nu a rÄƒspuns la /health Ã®n 30s");
}

function startServer({ dataDir, port, httpsPort, settleDemo }) {
  const env = {
    ...process.env, NODE_ENV: "development", PORT: String(port), HTTPS_PORT: String(httpsPort),
    NEXUS_DATA_DIR: dataDir,
  };
  delete env.NEXUS_SETTLE_DEMO;
  if (settleDemo) env.NEXUS_SETTLE_DEMO = "1";
  const child = spawn(process.execPath, ["server.js"], { cwd: WEB_ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  return { child, output: () => output };
}

async function stopServer(handle) {
  const { child } = handle;
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((done) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); done(); }, 4000);
    child.once("exit", () => { clearTimeout(timer); done(); });
  });
}

async function call(base, cookie, method, path, { body, key } = {}) {
  const headers = { "content-type": "application/json", "user-agent": "nexus-e2e/1.0" };
  if (cookie) headers.cookie = cookie;
  if (key) headers["idempotency-key"] = key;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { status: response.status, body: payload, raw: text };
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "nexus-f1-e2e-"));
  const dbPath = join(dataDir, "nexus.sqlite");
  const port = await freePort();
  const httpsPort = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let server = null;
  let seeded = null;
  try {
    // ---- 1. datele: douÄƒ conturi, trei intenÈ›ii, o trezorerie ----
    const db = openDb(dbPath);
    try {
      const repo = createRepo(db);
      const creator = repo.createUser({ handle: "creator_e2e", displayName: "SYSTEM_TEST Creator" });
      const supporter = repo.createUser({ handle: "supporter_e2e", displayName: "SYSTEM_TEST Supporter" });
      for (const user of [creator, supporter]) repo.ensurePersona(user.id, "social", { visibility: "public" });
      const product2 = repo.createCreatorSupportProduct({ creatorId: creator.id, kind: "tip", title: "SYSTEM_TEST 2 JBc", priceCents: 200 });
      const product3 = repo.createCreatorSupportProduct({ creatorId: creator.id, kind: "tip", title: "SYSTEM_TEST 3 JBc", priceCents: 300 });
      const intent2 = repo.createCreatorSupportIntent({ supporterId: supporter.id, productId: product2.id });
      const intent3 = repo.createCreatorSupportIntent({ supporterId: supporter.id, productId: product3.id });
      const intent1 = repo.createCreatorSupportIntent({ supporterId: supporter.id, productId: product2.id });
      const creatorSession = issueSession(creator.id, "social");
      const supporterSession = issueSession(supporter.id, "social");
      repo.insertSession({
        tokenHash: creatorSession.tokenHash, userId: creator.id, persona: "social", expiresAt: creatorSession.expiresAt,
        deviceId: "e2e0000000000000000000000000000", deviceLabel: "E2E creator",
      });
      repo.insertSession({
        tokenHash: supporterSession.tokenHash, userId: supporter.id, persona: "social", expiresAt: supporterSession.expiresAt,
        deviceId: "e2e0000000000000000000000000001", deviceLabel: "E2E supporter",
      });
      // `depositTreasury` nu are rutÄƒ (Â§4.3): trezoreria se alimenteazÄƒ ca funcÈ›ie, pe aceeaÈ™i bazÄƒ.
      const deposit = depositTreasury({ db, amountCents: 10000, reference: "e2e-local" });
      seeded = {
        creatorId: creator.id,
        intentTwo: String(intent2.id), intentThree: String(intent3.id), intentUnsettled: String(intent1.id),
        creatorCookie: `nexus_session=${creatorSession.token}`,
        depositCents: Number(deposit?.amount_cents ?? 10000),
        grossTwo: Number(intent2.gross_cents), grossThree: Number(intent3.gross_cents),
      };
      console.log(`[seed] creator=${creator.id} intents=${seeded.intentTwo}/${seeded.intentThree}/${seeded.intentUnsettled} treasury=${seeded.depositCents}`);
    } finally { db.close(); }


    // ---- 2. serverul, cu steagul de decontare PORNIT (doar local) ----
    server = startServer({ dataDir, port, httpsPort, settleDemo: true });
    const health = await waitForHealth(base, server.child);
    assertStep("server local rÄƒspunde la /health", health?.ok !== false, `health=${JSON.stringify(health)}`);

    const ledger0 = await call(base, seeded.creatorCookie, "GET", "/api/creator/ledger");
    assertStep("GET /api/creator/ledger fÄƒrÄƒ intrÄƒri",
      ledger0.status === 200 && Number(ledger0.body?.totals?.available_cents) === 0,
      `status=${ledger0.status} available=${ledger0.body?.totals?.available_cents}`);

    // ---- 3. decontarea unei plÄƒÈ›i de 2 JBc ----
    const settleTwo = await call(base, seeded.creatorCookie, "POST", `/api/creator/support-intents/${seeded.intentTwo}/settle`, { body: {}, key: "e2e-settle-0001-abcd" });
    const settlementTwo = settleTwo.body?.settlement;
    const sharesTwo = settlementTwo
      ? ["creator_share_cents", "nexus_fee_cents", "safety_reserve_cents", "infra_cents"].map((field) => Number(settlementTwo[field]))
      : [];
    const sumTwo = sharesTwo.reduce((sum, value) => sum + value, 0);
    assertStep("POST settle 2 JBc â†’ 201, split complet",
      settleTwo.status === 201 && Number(settlementTwo?.gross_cents) === seeded.grossTwo,
      `status=${settleTwo.status} gross=${settlementTwo?.gross_cents} shares=${sharesTwo.join("/")}`);
    assertStep("split-ul Ã®nchide gross-ul exact", sumTwo === seeded.grossTwo, `${sumTwo} = ${seeded.grossTwo}`);
    assertStep("creatorul primeÈ™te peste 50%", sharesTwo[0] / seeded.grossTwo >= 0.5,
      `${sharesTwo[0]}/${seeded.grossTwo} = ${((sharesTwo[0] / seeded.grossTwo) * 100).toFixed(2)}%`);
    const availableAfterTwo = Number(settleTwo.body?.available_cents);
    assertStep("soldul creatorului = partea lui", availableAfterTwo === sharesTwo[0], `${availableAfterTwo} = ${sharesTwo[0]}`);

    // ---- 4. aceeaÈ™i intenÈ›ie, din nou: refuz, fÄƒrÄƒ intrÄƒri noi ----
    const ledgerBeforeReplay = await call(base, seeded.creatorCookie, "GET", "/api/creator/ledger");
    const settleReplay = await call(base, seeded.creatorCookie, "POST",
      `/api/creator/support-intents/${seeded.intentTwo}/settle`, { body: {}, key: "e2e-settle-0001-abcd" });
    const settleFreshKey = await call(base, seeded.creatorCookie, "POST",
      `/api/creator/support-intents/${seeded.intentTwo}/settle`, { body: {}, key: "e2e-settle-0002-abcdef" });
    const ledgerAfterReplay = await call(base, seeded.creatorCookie, "GET", "/api/creator/ledger");
    assertStep("aceeași cheie → același decont, fără intrări noi",
      settleReplay.status === 201 && settleReplay.body?.settlement?.id === settlementTwo?.id,
      `status=${settleReplay.status} id=${settleReplay.body?.settlement?.id}`);
    assertStep("cheie nouă pe aceeași intenție → 409 ALREADY_SETTLED",
      settleFreshKey.status === 409 && settleFreshKey.body?.code === "ALREADY_SETTLED",
      `status=${settleFreshKey.status} code=${settleFreshKey.body?.code}`);
    assertStep("refuzul nu scrie nimic",
      JSON.stringify(ledgerBeforeReplay.body?.totals ?? {}) === JSON.stringify(ledgerAfterReplay.body?.totals ?? {}),
      `${JSON.stringify(ledgerAfterReplay.body?.totals ?? {})}`);

    // ---- 5. a doua platÄƒ, 3 JBc, apoi rambursarea ei ----
    const settleThree = await call(base, seeded.creatorCookie, "POST", `/api/creator/support-intents/${seeded.intentThree}/settle`, { body: {}, key: "e2e-settle-0003-abcd" });
    assertStep("POST settle 3 JBc â†’ 201", settleThree.status === 201,
      `status=${settleThree.status} available=${settleThree.body?.available_cents}`);
    const refund = await call(base, seeded.creatorCookie, "POST", `/api/creator/support-intents/${seeded.intentThree}/refund`,
      { body: { reason: "e2e: rambursare de verificare" }, key: "e2e-refund-0001-abcd" });
    assertStep("POST refund â†’ 201, reversed=true", refund.status === 201 && refund.body?.reversed === true,
      `status=${refund.status} reversed=${JSON.stringify(refund.body?.reversed)}`);
    const refundAgain = await call(base, seeded.creatorCookie, "POST", `/api/creator/support-intents/${seeded.intentThree}/refund`,
      { body: { reason: "e2e: a doua rambursare" }, key: "e2e-refund-0002-abcd" });
    assertStep("a doua rambursare â†’ 409", refundAgain.status === 409, `status=${refundAgain.status} code=${refundAgain.body?.code}`);
    const ledgerAfterRefund = await call(base, seeded.creatorCookie, "GET", "/api/creator/ledger");
    assertStep("soldul revine la partea primei plÄƒÈ›i",
      Number(ledgerAfterRefund.body?.totals?.available_cents) === availableAfterTwo,
      `available=${ledgerAfterRefund.body?.totals?.available_cents} aÈ™teptat=${availableAfterTwo}`);



    // ---- 6. cererea de retragere, cu È™i fÄƒrÄƒ Idempotency-Key ----
    const noKey = await call(base, seeded.creatorCookie, "POST", "/api/creator/payouts", { body: { amount_cents: 50 } });
    assertStep("cerere fÄƒrÄƒ Idempotency-Key â†’ 400", noKey.status === 400 && noKey.body?.code === "IDEMPOTENCY_KEY_REQUIRED",
      `status=${noKey.status} code=${noKey.body?.code}`);
    const tooBig = await call(base, seeded.creatorCookie, "POST", "/api/creator/payouts", { body: { amount_cents: 999999 }, key: "e2e-payout-big-0001" });
    assertStep("cerere peste sold â†’ 409 INSUFFICIENT_FUNDS", tooBig.status === 409 && tooBig.body?.code === "INSUFFICIENT_FUNDS",
      `status=${tooBig.status} code=${tooBig.body?.code}`);
    const payoutOne = await call(base, seeded.creatorCookie, "POST", "/api/creator/payouts", { body: { amount_cents: 50 }, key: "e2e-payout-0001-abcd" });
    const payoutReplay = await call(base, seeded.creatorCookie, "POST", "/api/creator/payouts", { body: { amount_cents: 50 }, key: "e2e-payout-0001-abcd" });
    const payoutConflict = await call(base, seeded.creatorCookie, "POST", "/api/creator/payouts", { body: { amount_cents: 70 }, key: "e2e-payout-0001-abcd" });
    const payouts = await call(base, seeded.creatorCookie, "GET", "/api/creator/payouts");
    assertStep("aceeaÈ™i cheie â†’ aceeaÈ™i cerere (replay), un singur rÃ¢nd",
      payoutOne.status === 201 && payoutReplay.body?.payout?.id === payoutOne.body?.payout?.id
      && Array.isArray(payouts.body?.payouts) && payouts.body.payouts.length === 1,
      `id=${payoutOne.body?.payout?.id} replay=${payoutReplay.body?.replay} rows=${payouts.body?.payouts?.length}`);
    assertStep("aceeaÈ™i cheie cu altÄƒ sumÄƒ â†’ 409 IDEMPOTENCY_CONFLICT",
      payoutConflict.status === 409 && payoutConflict.body?.code === "IDEMPOTENCY_CONFLICT",
      `status=${payoutConflict.status} code=${payoutConflict.body?.code}`);

    // ---- 7. plata retragerii È™i reconcilierea: funcÈ›ii, nu rute ----
    await stopServer(server);
    server = null;
    const auditDb = openDb(dbPath);
    let paid = null;
    let reconciled = null;
    try {
      paid = payCreatorPayout({ db: auditDb, creatorId: seeded.creatorId, payoutId: payoutOne.body.payout.id });
      reconciled = reconcileCreatorLedger(auditDb);
    } finally { auditDb.close(); }
    assertStep("plata retragerii mutÄƒ banii Ã®n payout_clearing", paid?.payout?.status === "paid", `status=${paid?.payout?.status}`);
    assertStep("reconcilierea trece pe baza acestei rulÄƒri", reconciled?.ok === true,
      `ok=${reconciled?.ok} differences=${JSON.stringify(reconciled?.differences)}`);

    // ---- 8. cu steagul OPRIT: decontarea e refuzatÄƒ ----
    server = startServer({ dataDir, port, httpsPort, settleDemo: false });
    await waitForHealth(base, server.child);
    const disabled = await call(base, seeded.creatorCookie, "POST",
      `/api/creator/support-intents/${seeded.intentUnsettled}/settle`, { body: {}, key: "e2e-settle-0004-abcd" });
    assertStep("fÄƒrÄƒ NEXUS_SETTLE_DEMO â†’ 409 SETTLEMENT_DISABLED",
      disabled.status === 409 && disabled.body?.code === "SETTLEMENT_DISABLED",
      `status=${disabled.status} code=${disabled.body?.code}`);
    const ledgerDisabled = await call(base, seeded.creatorCookie, "GET", "/api/creator/ledger");
    assertStep("refuzul nu a scris nimic",
      Number(ledgerDisabled.body?.totals?.available_cents) === availableAfterTwo - 50,
      `available=${ledgerDisabled.body?.totals?.available_cents} aÈ™teptat=${availableAfterTwo - 50}`);
  } finally {
    if (server) await stopServer(server);
    rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(`\n[creator-http-e2e] ${results.length - failures}/${results.length} verificÄƒri au trecut`);
  console.log("[creator-http-e2e] depositTreasury, payCreatorPayout È™i reconcileCreatorLedger NU au rutÄƒ Ã®n Â§4.3: au fost chemate ca funcÈ›ii, pe aceeaÈ™i bazÄƒ.");
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(`[creator-http-e2e] a eÈ™uat: ${error?.stack ?? error}`);
  process.exitCode = 1;
});





