// Autentificare locală în WebView-ul Nexus de pe telefon, prin Chrome DevTools
// Protocol. Rulează doar pe mașina de dezvoltare: `nexus-dev.ps1 -Action login`
// descoperă socket-ul `webview_devtools_remote_<pid>`, îl redirecționează prin adb
// și ne dă adresa websocket a paginii. Noi conducem DOM-ul exact ca un utilizator
// (completăm #email-login-form și îl trimitem), apoi confirmăm sesiunea pe /api/me.
//
// De ce CDP și nu `adb shell input text`: clientul Nexus este o pagină web
// servită prin adb reverse, iar tastele injectate depind de focus-ul nativ și de
// layout-ul tastaturii. CDP vorbește direct cu DOM-ul, deci rezultatul este
// determinist și verificabil.
//
// Node 22+ are WebSocket global, deci nu e nevoie de nicio dependență nouă.

const [wsUrl, emailArg, passwordArg] = process.argv.slice(2);
const email = (emailArg || "test@nexus.ro").trim().toLowerCase();
const password = passwordArg || "test1234";

if (!wsUrl) {
  console.error("[!] lipsește adresa websocket (ws://...); rulează `npm run dev:login`.");
  process.exit(2);
}
if (typeof WebSocket !== "function") {
  console.error(`[!] WebSocket global indisponibil (Node ${process.version}); este nevoie de Node 22+.`);
  process.exit(2);
}

const TOTAL_TIMEOUT_MS = 30_000;
const CALL_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 400;

const socket = new WebSocket(wsUrl);
const pending = new Map();
let nextId = 1;
let socketClosed = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} a depășit ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function fail(message) {
  console.error(`[!] ${message}`);
  try { socket.close(); } catch { /* deja închis */ }
  process.exit(1);
}

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await withTimeout(
    send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }),
    CALL_TIMEOUT_MS,
    "evaluarea CDP",
  );
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(detail || "evaluarea a eșuat");
  }
  return result.result?.value;
}

const readSession = () => evaluate("fetch('/api/me', { cache: 'no-store' }).then((r) => r.json())");
const sameEmail = (value) => String(value || "").trim().toLowerCase() === email;

function report(label, session) {
  const user = session.user;
  console.log(`[ok] ${label}: @${user.handle ?? "?"} (id ${user.id}) <${user.email ?? email}>`);
  console.log(`[ok] email verificat: ${user.email_verified ? "da" : "nu"} | onboarding necesar: ${session.needs_onboarding ? "da" : "nu"}`);
  console.log(`[ok] persona activă: ${session.persona ?? "?"}`);
  socket.close();
  process.exit(0);
}

socket.addEventListener("message", (event) => {
  let message;
  try { message = JSON.parse(event.data); } catch { return; }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message || "eroare CDP"));
  else resolve(message.result ?? {});
});

socket.addEventListener("close", () => {
  socketClosed = new Error("conexiunea CDP s-a închis înainte de confirmarea sesiunii");
  for (const { reject } of pending.values()) reject(socketClosed);
  pending.clear();
});

socket.addEventListener("error", () => fail(`nu mă pot conecta la WebView prin CDP (${wsUrl})`));

socket.addEventListener("open", () => {
  run().catch((error) => fail(String(error?.message ?? error)));
});

async function run() {
  await withTimeout(send("Runtime.enable"), CALL_TIMEOUT_MS, "Runtime.enable");
  await withTimeout(send("Page.enable"), CALL_TIMEOUT_MS, "Page.enable");

  const current = await readSession();
  if (current?.ok && current.user?.id) {
    if (sameEmail(current.user.email)) {
      report("deja autentificat", current);
    }
    // Sesiunea este un cookie: cât timp există una activă, clientul web nu mai
    // afișează formularul de autentificare, deci contul nu poate fi schimbat de aici.
    fail(`există deja o sesiune pentru <${current.user.email ?? current.user.id}>; ieși din cont în clientul de pe telefon, apoi rulează din nou.`);
  }

  const formPresent = await evaluate("Boolean(document.getElementById('email-login-form'))");
  if (!formPresent) {
    fail("pagina nu conține formularul de autentificare (WebView-ul arată alt ecran); rulează `npm run dev:reload`.");
  }

  // Selectorii sunt cei folosiți de aplicația web (apps/nexus-web/public/app.js):
  // emailLogin citește FormData după name=nexus_login_email/nexus_login_password,
  // deci setarea valorilor + submit este suficientă. Evenimentele `input` sunt
  // trimise ca formularul să-și regenereze cheia de idempotență.
  const submitted = await evaluate(`(() => {
    const set = (element, value) => {
      element.focus();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const form = document.getElementById('email-login-form');
    set(document.getElementById('nexus-login-email'), ${JSON.stringify(email)});
    set(document.getElementById('nexus-login-password'), ${JSON.stringify(password)});
    form.requestSubmit();
    return { email: document.getElementById('nexus-login-email').value };
  })()`);
  console.log(`[login] formular trimis pentru ${submitted.email}`);

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    if (socketClosed) throw socketClosed;
    try {
      const session = await readSession();
      if (session?.ok && session.user?.id && sameEmail(session.user.email)) {
        report("autentificat", session);
      }
    } catch (error) {
      // location.reload() după login distruge contextul JS; reîncercăm până revine.
      lastError = error;
    }
  }
  fail(`nu am confirmat sesiunea în ${TOTAL_TIMEOUT_MS / 1000}s${lastError ? ` (${lastError.message})` : ""}.`);
}

