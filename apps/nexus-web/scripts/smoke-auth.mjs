// Temporary local HTTP smoke test for auth + MultiversX login (no external egress).
import { createServer } from "node:http";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { createSseHub } from "../lib/sse.js";
import { handleRequest } from "../lib/api.js";
import { UserSecretKey } from "@multiversx/sdk-core";

const db = openDb(":memory:");
const repo = createRepo(db);
const sse = createSseHub();

const server = createServer((req, res) => handleRequest(req, res, { db, repo, sse }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

function parseSetCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0];
}

async function post(path, body, cookie) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json(), cookie: parseSetCookie(res) };
}

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name); }
}

// 1. client-only wallet proof + signup
const email = "alice@example.invalid";
const password = "hunter2secret";
const walletInit = await post("/auth/email/signup-init", { email });
const localKey = UserSecretKey.generate();
const localAddress = localKey.generatePublicKey().toAddress("erd").toBech32();
const localSignature = Buffer.from(localKey.sign(Buffer.from(walletInit.json.message, "utf8"))).toString("hex");
const signup = await post("/auth/email/signup", {
  email,
  display_name: "Alice",
  password,
  wallet_proof: { nonce: walletInit.json.nonce, address: localAddress, signature: localSignature },
});
ok("signup returns 201", signup.res.status === 201 && signup.json.ok === true);
ok("signup creates a labelled local session", signup.cookie.startsWith("nexus_session=") && signup.json.email_status === "local_demo_unverified");
ok("signup binds the device wallet without a seed response", signup.json.wallet?.address === localAddress && !("mnemonic" in signup.json));
const cookie = signup.cookie;

// 2. me with cookie
const me = await fetch(base + "/api/me", { headers: { cookie } });
const meJson = await me.json();
ok("me is authenticated with cookie", me.status === 200 && meJson.user.email === "alice@example.invalid");

// 3. logout + relogin (persisted password verifies)
await post("/auth/logout", {}, cookie);
const badLogin = await post("/auth/email/login", { email: "alice@example.invalid", password: "wrongpass" });
ok("login rejects wrong password", badLogin.res.status === 401);
const goodLogin = await post("/auth/email/login", { email: "alice@example.invalid", password: "hunter2secret" });
ok("login accepts correct password", goodLogin.res.status === 200 && goodLogin.json.ok === true);

const reset = await post("/auth/email/reset-request", { email });
ok("LAN reset never returns a usable bearer", reset.res.status === 503 && !("reset_token" in reset.json));

// 4. Origin-unbound legacy login routes stay retired; xPortal uses NativeAuth.
const legacy = await post("/auth/mvx/challenge", { address: signup.json.wallet.address, persona: "social" });
ok("legacy wallet challenge is retired", legacy.res.status === 410 && legacy.json.ok === false);

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
db.close();
process.exit(fail ? 1 : 0);
