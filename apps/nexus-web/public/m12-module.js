const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = (cents) => `${(Number(cents || 0) / 100).toFixed(2)} TEST-USDC`;
const randomHex = (bytes = 32) => {
  const data = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(data);
  return [...data].map((value) => value.toString(16).padStart(2, "0")).join("");
};

function shell(host, { eyebrow, title, subtitle, tabs, active, body }) {
  host.innerHTML = `<div class="screen scrollScreen m12Screen"><header class="m12Head"><span><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></span><i>◇</i></header>
    <nav class="m12Tabs" aria-label="${esc(title)}">${tabs.map(([id, label]) => `<button type="button" data-m12-tab="${id}" class="${id === active ? "active" : ""}">${esc(label)}</button>`).join("")}</nav>
    <div class="m12Truth"><b>LOCAL · ZERO FONDURI REALE</b><span>Nicio stare demo nu este prezentată drept settlement, payout sau descentralizare verificată.</span></div>
    <div class="m12Body">${body}</div></div>`;
}

let payTab = "send";
export async function renderM12PayWorkspace(host, deps) {
  const history = payTab === "history" ? await deps.api("/api/pay/history") : null;
  const historyCards = history?.ok && history.transfers.length
    ? history.transfers.map((item) => `<article class="m12Row"><i>${item.direction === "sent" ? "↗" : "↙"}</i><span><b>@${esc(item.direction === "sent" ? item.recipient_handle : item.sender_handle)}</b><small>${esc(item.display_amount || item.atomic_amount)} ${esc(item.token_id)} · ${esc(item.status)}</small></span><em>${esc(item.network)}</em></article>`).join("")
    : `<div class="m12Empty"><i>◎</i><b>Nicio intenție locală</b><span>Istoricul real va apărea numai după verificarea settlementului.</span></div>`;
  shell(host, {
    eyebrow: "NEXUS PAY · EXACT BINDING", title: "Trimite prin username", subtitle: "Alias → adresă → rețea → token → sumă, toate legate într-un receipt expirabil.",
    tabs: [["send", "Trimite"], ["history", "Istoric privat"]], active: payTab,
    body: payTab === "history" ? historyCards : `<section class="m12Panel payComposer"><h3>Pregătește transferul</h3><form id="m12-pay-form"><label>Username Nexus<input name="username" placeholder="@username" autocomplete="off" required></label><div class="m12Grid"><label>Activ<select name="asset"><option value="TEST-USDC">TEST-USDC</option><option value="EGLD">EGLD</option></select></label><label>Sumă<input name="amount" inputmode="decimal" placeholder="10.00" required></label></div><label>Scop privat opțional<input name="purpose" maxlength="140" placeholder="Scopul este păstrat doar ca hash"></label><button>Verifică și creează quote</button></form><div id="m12-pay-result" aria-live="polite"></div></section>`,
  });
  host.querySelectorAll("[data-m12-tab]").forEach((button) => button.addEventListener("click", () => { payTab = button.dataset.m12Tab; renderM12PayWorkspace(host, deps); }));
  const form = host.querySelector("#m12-pay-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form), output = host.querySelector("#m12-pay-result");
    output.innerHTML = `<p class="m12Loading">Verific binding-ul exact…</p>`;
    const quote = await deps.api("/api/pay/quotes", { method: "POST", body: Object.fromEntries(data) });
    if (!quote.ok) { output.innerHTML = `<p class="m12Error">${esc(quote.error)}</p>`; return; }
    const item = quote.quote;
    output.innerHTML = `<article class="payBinding"><header><i>✓</i><span><small>RECEIPT LOCAL EXPIRABIL</small><b>@${esc(item.alias)}</b></span></header><dl><div><dt>Sumă</dt><dd>${esc(item.display_amount)} ${esc(item.token_id)}</dd></div><div><dt>Atomic</dt><dd>${esc(item.atomic_amount)}</dd></div><div><dt>Rețea</dt><dd>${esc(item.network)} · ${esc(item.chain_id)}</dd></div><div><dt>Wallet</dt><dd>${esc(item.receiver_address.slice(0, 12))}…${esc(item.receiver_address.slice(-8))}</dd></div></dl><button id="m12-pay-intent">Creează intenția nesemnată</button><p>Semnarea și broadcast-ul sunt oprite în demo.</p></article>`;
    output.querySelector("#m12-pay-intent").addEventListener("click", async (click) => {
      click.currentTarget.disabled = true;
      const result = await deps.api("/api/pay/intents", { method: "POST", body: { receipt_id: item.id, receipt_hash: item.receipt_hash } });
      if (!result.ok) { click.currentTarget.disabled = false; deps.toast(result.error); return; }
      click.currentTarget.textContent = "Intenție locală creată · fără fonduri";
      deps.toast("Binding salvat; semnarea rămâne dezactivată");
    }, { once: true });
  });
}

let creatorTab = "studio";
export async function renderM12CreatorWorkspace(host, deps) {
  const result = await deps.api("/api/creator/dashboard");
  if (!result.ok) { host.innerHTML = `<p class="m12Error">${esc(result.error)}</p>`; return; }
  const dashboard = result.dashboard;
  const products = dashboard.products.map((item) => `<article class="m12Row"><i>${item.kind === "tip" ? "$" : "◇"}</i><span><b>${esc(item.title)}</b><small>${esc(item.kind)} · ${esc(item.split_version)}</small></span><em>${money(item.price_cents)}</em></article>`).join("") || `<div class="m12Empty"><i>↟</i><b>Niciun produs de support</b><span>Definește un tip sau membership. Plata rămâne oprită local.</span></div>`;
  const ledger = dashboard.received.map((item) => `<article class="m12Row"><i>◎</i><span><b>${money(item.quoted_cents)}</b><small>${esc(item.status)} · creator ${money(item.creator_share_cents)}</small></span><em>${esc(item.commitment.slice(0, 8))}…</em></article>`).join("") || `<div class="m12Empty"><i>◎</i><b>Ledger gol</b><span>Like-urile și comentariile nu creează bani.</span></div>`;
  const body = creatorTab === "studio" ? `<section class="m12MetricGrid"><article><small>Disponibil real</small><b>${money(dashboard.totals.creator_available_cents)}</b><span>demo_unpaid exclus</span></article><article><small>Creator Fund</small><b>${money(dashboard.creator_fund.pool_cents)}</b><span>${esc(dashboard.creator_fund.reason)}</span></article></section><section class="m12Panel"><h3>Produs transparent</h3><form id="m12-product-form"><div class="m12Grid"><label>Tip<select name="kind"><option value="tip">Tip direct · 90/5/3/2</option><option value="membership">Membership · 85/10/3/2</option></select></label><label>Preț cenți<input name="price_cents" type="number" min="100" value="500" required></label></div><label>Titlu<input name="title" maxlength="80" required></label><label>Zile membership<input name="interval_days" type="number" min="1" max="366" value="30"></label><button>Creează produs local</button></form></section><section class="m12List">${products}</section>`
    : creatorTab === "support" ? `<section class="m12Panel"><h3>Susține un creator Nexus</h3><form id="m12-catalog-form"><label>Username<input name="username" placeholder="@creator" required></label><button>Vezi produsele</button></form><div id="m12-catalog-result"></div></section>`
      : `<section class="m12List">${ledger}</section>`;
  shell(host, { eyebrow: "CREATOR ECONOMY · NO PAY-PER-LIKE", title: "Creator", subtitle: "Support voluntar, split versionat și ledger privat fără trafic cumpărat.", tabs: [["studio", "Studio"], ["support", "Susține"], ["ledger", "Ledger"]], active: creatorTab, body });
  host.querySelectorAll("[data-m12-tab]").forEach((button) => button.addEventListener("click", () => { creatorTab = button.dataset.m12Tab; renderM12CreatorWorkspace(host, deps); }));
  host.querySelector("#m12-product-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    data.price_cents = Number(data.price_cents); data.interval_days = data.kind === "membership" ? Number(data.interval_days) : null;
    const created = await deps.api("/api/creator/products", { method: "POST", body: data });
    if (!created.ok) return deps.toast(created.error); deps.toast("Produs local creat"); renderM12CreatorWorkspace(host, deps);
  });
  host.querySelector("#m12-catalog-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const username = String(new FormData(event.currentTarget).get("username") || "").replace(/^@/, "");
    const output = host.querySelector("#m12-catalog-result"), catalog = await deps.api(`/api/creator/catalog?username=${encodeURIComponent(username)}`);
    if (!catalog.ok) { output.innerHTML = `<p class="m12Error">${esc(catalog.error)}</p>`; return; }
    output.innerHTML = catalog.catalog.products.map((item) => `<article class="supportQuote"><span><b>${esc(item.title)}</b><small>${esc(item.split_version)}</small></span><em>${money(item.price_cents)}</em><button data-support-product="${item.id}">Creează intent local</button></article>`).join("") || `<p class="m12Empty">Creatorul nu are produse active.</p>`;
    output.querySelectorAll("[data-support-product]").forEach((button) => button.addEventListener("click", async () => {
      const intent = await deps.api("/api/creator/support-intents", { method: "POST", body: { product_id: Number(button.dataset.supportProduct) } });
      if (!intent.ok) return deps.toast(intent.error); button.disabled = true; button.textContent = "Demo · zero fonduri"; deps.toast(intent.economic_effect);
    }));
  });
}

let nodeTab = "status";
export async function renderM12NodeWorkspace(host, deps) {
  const [status, contract] = await Promise.all([deps.api("/api/node/status"), deps.api("/api/node/protocol-contract")]);
  if (!status.ok || !contract.ok) { host.innerHTML = `<p class="m12Error">Node status indisponibil.</p>`; return; }
  const network = status.network;
  const manifests = network.own_manifests.map((item) => `<article class="nodeManifest"><header><span><small>${esc(item.trust_class)} · ${esc(item.protocol_version)}</small><b>${esc(item.node_id)}</b></span><em>${esc(item.state)}</em></header><p>${item.service_roles.map(esc).join(" · ")}</p><div><button data-node-commit="${esc(item.node_id)}">Adaugă commitment</button><button data-node-checkpoint="${esc(item.node_id)}">Checkpoint demo</button></div></article>`).join("") || `<div class="m12Empty"><i>N</i><b>Niciun manifest candidat</b><span>Înregistrarea locală nu pornește un nod și nu îl publică în rețea.</span></div>`;
  const body = nodeTab === "status" ? `<section class="nodeStatusOrb"><i>${network.active_nodes}</i><span><b>${esc(network.mode)}</b><small>${esc(network.health)}</small></span></section><section class="m12MetricGrid"><article><small>Noduri active</small><b>${network.active_nodes}</b><span>Genesis local inclus</span></article><article><small>Noduri public verificate</small><b>${network.verified_public_nodes}</b><span>claim descentralizare: NU</span></article><article><small>Replicare observată</small><b>${network.observed_replication}/${network.replication_target}</b><span>R=1 cere backup</span></article><article><small>Reward pool</small><b>0</b><span>raw traffic nu este plătit</span></article></section>`
    : nodeTab === "join" ? `<section class="m12Panel"><h3>Manifest candidat</h3><form id="m12-node-form"><div class="m12Grid"><label>Trust<select name="trust_class"><option value="T0">T0 · light peer</option><option value="T1">T1 · open full node</option></select></label><label>Protocol<input value="1.0.0" disabled></label></div><fieldset><legend>Roluri locale</legend>${contract.roles.map((role) => `<label><input type="checkbox" name="roles" value="${esc(role)}"> ${esc(role)}</label>`).join("")}</fieldset><button>Înregistrează fără publicare</button></form></section>`
      : `<section class="m12List">${manifests}</section>`;
  shell(host, { eyebrow: "NODE NETWORK · D0 HONEST", title: "Nexus Node", subtitle: "Protocolul poate crește de la un Genesis Node, dar candidații locali nu sunt noduri verificate.", tabs: [["status", "Status"], ["join", "Join"], ["evidence", "Evidence"]], active: nodeTab, body });
  host.querySelectorAll("[data-m12-tab]").forEach((button) => button.addEventListener("click", () => { nodeTab = button.dataset.m12Tab; renderM12NodeWorkspace(host, deps); }));
  host.querySelector("#m12-node-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), roles = data.getAll("roles");
    const result = await deps.api("/api/node/manifests", { method: "POST", body: { trust_class: data.get("trust_class"), protocol_version: "1.0.0", service_roles: roles } });
    if (!result.ok) return deps.toast(result.error); nodeTab = "evidence"; deps.toast("Manifest candidat salvat; nodul nu este online"); renderM12NodeWorkspace(host, deps);
  });
  host.querySelectorAll("[data-node-commit]").forEach((button) => button.addEventListener("click", async () => {
    const now = Math.floor(Date.now() / 1000), result = await deps.api("/api/node/commitments", { method: "POST", body: { node_id: button.dataset.nodeCommit, event_count: 0, range_start: now, range_end: now, payload_hash: randomHex() } });
    deps.toast(result.ok ? "Commitment local creat · fără quorum" : result.error);
  }));
  host.querySelectorAll("[data-node-checkpoint]").forEach((button) => button.addEventListener("click", async () => {
    const now = Math.floor(Date.now() / 1000), result = await deps.api("/api/node/checkpoints", { method: "POST", body: { node_id: button.dataset.nodeCheckpoint, shard_key: "local:demo", event_from: now, event_to: now, reducer_version: "1.0.0", state_root: randomHex(), backup_receipt_hash: randomHex() } });
    deps.toast(result.ok ? "Checkpoint demo creat · replica neverificată" : result.error);
  }));
}
