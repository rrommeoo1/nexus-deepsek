let marketSection = "browse";
let staySection = "explore";
let rideSection = "map";
let renderEpoch = 0;

const h = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const key = (scope) => `${scope}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
const money = (cents) => `${(Number(cents || 0) / 100).toFixed(2)} TEST-USDC`;
const when = (seconds) => new Date(Number(seconds) * 1000).toLocaleString();
const valid = (result, deps, persona) => result?.ok === true && Number(result.viewer_id) === Number(deps.state.user.id) && result.viewer_persona === persona;

function frame(vp, { kind, title, subtitle, tabs, active, onTab }) {
  vp.innerHTML = `<div class="screen scrollScreen fairScreen ${kind}Screen">
    <header class="fairHero"><span><small>TRUST & TRANSACTION KERNEL</small><h2>${h(title)}</h2><p>${h(subtitle)}</p></span><i>${kind === "market" ? "◇" : kind === "stay" ? "⌂" : "↗"}</i></header>
    <aside class="fairTruth"><b>Demo local</b><span>Quote verificabil · 0 fonduri reale · review numai după tranzacție</span></aside>
    <nav class="fairTabs" aria-label="${h(title)}">${tabs.map(([id, label]) => `<button type="button" data-fair-tab="${id}" class="${active === id ? "active" : ""}">${h(label)}</button>`).join("")}</nav>
    <main id="fair-content" aria-live="polite"><div class="fairLoading">Se încarcă…</div></main>
  </div>`;
  vp.querySelectorAll("[data-fair-tab]").forEach((button) => button.addEventListener("click", () => onTab(button.dataset.fairTab)));
}

function listingCard(listing, viewerId) {
  const mine = Number(listing.seller_id) === Number(viewerId);
  return `<article class="marketCard"><header><span><small>${h(listing.category)} · ${h(listing.discovery_scope)}</small><h3>${h(listing.title)}</h3></span><b>${money(listing.price_cents)}</b></header><p>${h(listing.description)}</p><footer><span>@${h(listing.seller_handle)} · ${h(listing.public_location || "Worldwide")}</span><em>${h(listing.sale_mode)}</em></footer>${mine ? `<strong>${Number(listing.pending_offer_count || 0)} oferte · ${h(listing.status)}</strong>` : listing.offered_by_me ? "<strong>Ofertă trimisă ✓</strong>" : `<form data-market-offer="${Number(listing.id)}"><input name="amount" type="number" min="1" step="0.01" value="${(Number(listing.price_cents) / 100).toFixed(2)}" aria-label="Valoare ofertă" required><button>Oferă</button></form>`}</article>`;
}

async function renderMarketContent(vp, deps, epoch) {
  const host = vp.querySelector("#fair-content");
  if (marketSection === "sell") {
    host.innerHTML = `<form id="market-create" class="fairForm"><h3>Publică un anunț</h3><label>Titlu<input name="title" maxlength="120" required></label><label>Descriere<textarea name="description" maxlength="2000" required></textarea></label><div class="fairGrid"><label>Categorie<select name="category"><option value="electronics">Electronice</option><option value="home">Casă</option><option value="fashion">Modă</option><option value="vehicles">Vehicule</option><option value="sports">Sport</option><option value="collectibles">Colecții</option><option value="services">Servicii</option><option value="other">Altele</option></select></label><label>Preț TEST-USDC<input name="price" type="number" min="1" step="0.01" required></label><label>Vânzare<select name="sale_mode"><option value="free_classified">Contact direct</option><option value="protected_checkout">Checkout protejat</option></select></label><label>Vizibilitate<select name="discovery_scope"><option value="local">Near me</option><option value="global">Global</option></select></label></div><label>Locație publică aproximativă<input name="public_location" maxlength="100"></label><button>Publică local</button><small>Produsele interzise sunt refuzate de politica de categorie; plățile reale rămân oprite.</small></form>`;
    host.querySelector("#market-create").addEventListener("submit", async (event) => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await deps.api("/api/market/listings", { method: "POST", headers: { "Idempotency-Key": key("market-listing") }, body: { title: data.title, description: data.description, category: data.category, price_cents: Math.round(Number(data.price) * 100), sale_mode: data.sale_mode, discovery_scope: data.discovery_scope, public_location: data.public_location } });
      deps.toast(result.ok ? "Anunț publicat" : (result.error || "Publicarea a eșuat")); if (result.ok) { marketSection = "browse"; renderMarketWorkspace(vp, deps); }
    });
    return;
  }
  if (marketSection === "offers") {
    const [mine, received] = await Promise.all([deps.api("/api/market/offers?scope=mine"), deps.api("/api/market/offers?scope=received")]);
    if (epoch !== renderEpoch || !valid(mine, deps, "market") || !valid(received, deps, "market")) return void (host.innerHTML = '<div class="fairError">Ofertele nu au putut fi verificate.</div>');
    host.innerHTML = `<div class="fairColumns"><section><h3>Trimise</h3>${mine.offers.length ? mine.offers.map((item) => `<article class="compactCard"><b>${h(item.title)}</b><span>${money(item.amount_cents)} · ${h(item.status)}</span>${item.status === "pending" ? `<button data-offer-withdraw="${item.id}">Retrage</button>` : ""}</article>`).join("") : '<p class="fairEmpty">Nicio ofertă.</p>'}</section><section><h3>Primite</h3>${received.offers.length ? received.offers.map((item) => `<article class="compactCard"><b>${h(item.title)}</b><span>@${h(item.buyer_handle)} · ${money(item.amount_cents)} · ${h(item.status)}</span>${item.status === "pending" ? `<button data-offer-accept="${item.id}">Acceptă local</button>` : ""}</article>`).join("") : '<p class="fairEmpty">Nicio ofertă primită.</p>'}</section></div>`;
    host.querySelectorAll("[data-offer-withdraw]").forEach((button) => button.addEventListener("click", () => marketOfferAction(vp, deps, button.dataset.offerWithdraw, "withdraw")));
    host.querySelectorAll("[data-offer-accept]").forEach((button) => button.addEventListener("click", () => marketOfferAction(vp, deps, button.dataset.offerAccept, "accept")));
    return;
  }
  if (marketSection === "orders") {
    const result = await deps.api("/api/market/orders");
    if (epoch !== renderEpoch || !valid(result, deps, "market") || result.settlement !== "LOCAL_DEMO_NO_PAYMENT") return void (host.innerHTML = '<div class="fairError">Comenzile nu au putut fi verificate.</div>');
    host.innerHTML = `<section class="fairList"><h3>Comenzi protejate local</h3>${result.orders.length ? result.orders.map((order) => `<article class="transactionCard"><header><b>${h(order.title)}</b><strong>${money(order.quoted_amount_cents)}</strong></header><p>${h(order.viewer_role)} · ${h(order.status)} · @${h(order.viewer_role === "seller" ? order.buyer_handle : order.seller_handle)}</p><footer>${order.status === "local_unfunded" ? `${order.viewer_role === "seller" ? `<button data-market-order="${order.id}" data-action="fulfill">Marchează predat</button>` : ""}<button data-market-order="${order.id}" data-action="cancel">Anulează</button>` : order.status === "fulfilled" && order.viewer_role === "buyer" ? `<button data-market-order="${order.id}" data-action="complete">Confirmă primirea</button>` : order.status === "completed" ? `<button data-review="market/orders" data-subject="${order.id}">Lasă review</button>` : ""}</footer></article>`).join("") : '<p class="fairEmpty">Nicio comandă.</p>'}</section>`;
    host.querySelectorAll("[data-market-order]").forEach((button) => button.addEventListener("click", () => transactionAction(vp, deps, `/api/market/orders/${button.dataset.marketOrder}`, button.dataset.action)));
    wireReviews(host, vp, deps);
    return;
  }
  const result = await deps.api("/api/market/listings");
  if (epoch !== renderEpoch || !valid(result, deps, "market") || result.settlement !== "LOCAL_DEMO_NO_PAYMENT") return void (host.innerHTML = '<div class="fairError">Catalogul nu a putut fi verificat.</div>');
  host.innerHTML = `<section class="marketCatalog"><header><h3>Near me + Global</h3><span>${result.listings.length} anunțuri</span></header><div class="marketGrid">${result.listings.length ? result.listings.map((item) => listingCard(item, deps.state.user.id)).join("") : '<p class="fairEmpty">Niciun anunț activ.</p>'}</div></section>`;
  host.querySelectorAll("[data-market-offer]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); const amount = Math.round(Number(new FormData(form).get("amount")) * 100);
    const result = await deps.api(`/api/market/listings/${form.dataset.marketOffer}/offers`, { method: "POST", headers: { "Idempotency-Key": key("market-offer") }, body: { amount_cents: amount, message: "Ofertă Nexus Market" } });
    deps.toast(result.ok ? "Oferta a fost trimisă" : (result.error || "Oferta a eșuat")); if (result.ok) renderMarketWorkspace(vp, deps);
  }));
}

async function marketOfferAction(vp, deps, id, action) {
  const result = await deps.api(`/api/market/offers/${id}/${action}`, { method: "POST", headers: { "Idempotency-Key": key(`market-${action}`) }, body: {} });
  deps.toast(result.ok ? "Oferta a fost actualizată" : (result.error || "Acțiunea a eșuat")); if (result.ok) renderMarketWorkspace(vp, deps);
}

async function transactionAction(vp, deps, url, action) {
  const result = await deps.api(url, { method: "PATCH", headers: { "Idempotency-Key": key(`transaction-${action}`) }, body: { action } });
  deps.toast(result.ok ? "Starea a fost actualizată" : (result.error || "Acțiunea a eșuat")); if (result.ok) deps.rerender(vp);
}

function wireReviews(host, vp, deps) {
  host.querySelectorAll("[data-review]").forEach((button) => button.addEventListener("click", async () => {
    const comment = globalThis.prompt?.("Review verificat (1–5 stele):", "Experiență bună în demo") || "";
    if (!comment) return;
    const result = await deps.api(`/api/${button.dataset.review}/${button.dataset.subject}/reviews`, { method: "POST", headers: { "Idempotency-Key": key("transaction-review") }, body: { rating: 5, comment } });
    deps.toast(result.ok ? "Review înregistrat" : (result.error || "Review indisponibil")); if (result.ok) deps.rerender(vp);
  }));
}

export async function renderMarketWorkspace(vp, deps) {
  const epoch = ++renderEpoch;
  frame(vp, { kind: "market", title: "Nexus Market", subtitle: "Anunțuri locale și globale · oferte sigure în demo", tabs: [["browse", "Descoperă"], ["sell", "Vinde"], ["offers", "Oferte"], ["orders", "Comenzi"]], active: marketSection, onTab: (next) => { marketSection = next; renderMarketWorkspace(vp, deps); } });
  return renderMarketContent(vp, { ...deps, rerender: (target) => renderMarketWorkspace(target, deps) }, epoch);
}

function stayCard(item, viewerId) {
  const mine = Number(item.host_id) === Number(viewerId);
  return `<article class="stayCard"><div class="stayArt"><span>⌂</span></div><header><span><small>${h(item.public_location)}</small><h3>${h(item.title)}</h3></span><b>${money(item.nightly_cents)} / noapte</b></header><p>${h(item.description)}</p><footer><span>@${h(item.host_handle)} · max ${item.max_guests}</span><em>${h(item.cancellation_policy)}</em></footer>${mine ? `<strong>${h(item.status)} · adresa vizibilă doar ție și oaspeților confirmați</strong>` : `<form data-stay-book="${item.id}"><input name="check_in" type="datetime-local" required><input name="check_out" type="datetime-local" required><input name="guests" type="number" min="1" max="${item.max_guests}" value="1" required><button>Rezervă local</button></form>`}</article>`;
}

export async function renderStayWorkspace(vp, deps) {
  const epoch = ++renderEpoch;
  frame(vp, { kind: "stay", title: "Nexus Stay", subtitle: "Rezervări fără suprapuneri · adresă protejată", tabs: [["explore", "Explore"], ["host", "Găzduiește"], ["trips", "Călătorii"]], active: staySection, onTab: (next) => { staySection = next; renderStayWorkspace(vp, deps); } });
  const host = vp.querySelector("#fair-content");
  if (staySection === "host") {
    const mine = await deps.api("/api/stay/listings?mine=1");
    if (epoch !== renderEpoch || !valid(mine, deps, "travel")) return void (host.innerHTML = '<div class="fairError">Proprietățile nu au putut fi verificate.</div>');
    host.innerHTML = `<form id="stay-create" class="fairForm"><h3>Adaugă proprietate</h3><label>Titlu<input name="title" maxlength="120" required></label><label>Descriere<textarea name="description" maxlength="2000" required></textarea></label><div class="fairGrid"><label>Oraș / zonă publică<input name="public_location" maxlength="100" required></label><label>Adresa privată<input name="private_address" maxlength="200" required></label><label>Preț/noapte TEST-USDC<input name="nightly" type="number" min="1" step="0.01" required></label><label>Oaspeți max<input name="max_guests" type="number" min="1" max="32" value="2" required></label></div><label>Anulare<select name="cancellation_policy"><option value="flexible">Flexibilă</option><option value="moderate">Moderată</option><option value="strict">Strictă</option></select></label><button>Publică local</button></form><section class="fairList"><h3>Proprietățile mele</h3>${mine.listings.map((item) => stayCard(item, deps.state.user.id)).join("") || '<p class="fairEmpty">Nicio proprietate.</p>'}</section>`;
    host.querySelector("#stay-create").addEventListener("submit", async (event) => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await deps.api("/api/stay/listings", { method: "POST", headers: { "Idempotency-Key": key("stay-listing") }, body: { title: data.title, description: data.description, public_location: data.public_location, private_address: data.private_address, nightly_cents: Math.round(Number(data.nightly) * 100), max_guests: Number(data.max_guests), cancellation_policy: data.cancellation_policy } });
      deps.toast(result.ok ? "Proprietate publicată" : (result.error || "Publicarea a eșuat")); if (result.ok) renderStayWorkspace(vp, deps);
    });
    return;
  }
  if (staySection === "trips") {
    const result = await deps.api("/api/stay/bookings");
    if (epoch !== renderEpoch || !valid(result, deps, "travel") || result.address_visibility !== "PARTICIPANTS_ONLY") return void (host.innerHTML = '<div class="fairError">Rezervările nu au putut fi verificate.</div>');
    host.innerHTML = `<section class="fairList"><h3>Rezervări</h3>${result.bookings.length ? result.bookings.map((item) => `<article class="transactionCard"><header><b>${h(item.title)}</b><strong>${money(item.total_cents)}</strong></header><p>${when(item.check_in)} → ${when(item.check_out)} · ${h(item.status)}</p><span class="privateAddress">Adresă protejată: ${h(item.private_address)}</span>${item.status === "confirmed_local_no_payment" ? `<footer><button data-stay-action="${item.id}" data-action="cancel">Anulează</button></footer>` : item.status === "completed" ? `<footer><button data-review="stay/bookings" data-subject="${item.id}">Review dublu-orb</button></footer>` : ""}</article>`).join("") : '<p class="fairEmpty">Nicio rezervare.</p>'}</section>`;
    host.querySelectorAll("[data-stay-action]").forEach((button) => button.addEventListener("click", () => transactionAction(vp, { ...deps, rerender: (target) => renderStayWorkspace(target, deps) }, `/api/stay/bookings/${button.dataset.stayAction}`, button.dataset.action)));
    wireReviews(host, vp, { ...deps, rerender: (target) => renderStayWorkspace(target, deps) });
    return;
  }
  const result = await deps.api("/api/stay/listings");
  if (epoch !== renderEpoch || !valid(result, deps, "travel") || result.private_address_policy !== "HIDDEN_UNTIL_BOOKING" || result.listings.some((item) => Object.hasOwn(item, "private_address"))) return void (host.innerHTML = '<div class="fairError">Catalogul Stay a fost refuzat: verificarea privacy nu a trecut.</div>');
  host.innerHTML = `<section class="stayGrid">${result.listings.map((item) => stayCard(item, deps.state.user.id)).join("") || '<p class="fairEmpty">Nicio proprietate activă.</p>'}</section>`;
  host.querySelectorAll("[data-stay-book]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(form); const checkIn = Math.floor(new Date(String(data.get("check_in"))).getTime() / 1000), checkOut = Math.floor(new Date(String(data.get("check_out"))).getTime() / 1000);
    const result = await deps.api(`/api/stay/listings/${form.dataset.stayBook}/book`, { method: "POST", headers: { "Idempotency-Key": key("stay-book") }, body: { check_in: checkIn, check_out: checkOut, guest_count: Number(data.get("guests")) } });
    deps.toast(result.ok ? "Rezervare confirmată local" : (result.error || "Perioada nu este disponibilă")); if (result.ok) { staySection = "trips"; renderStayWorkspace(vp, deps); }
  }));
}

function rideMap() {
  return `<section class="rideMap" aria-label="Hartă Ride locală"><div class="road r1"></div><div class="road r2"></div><div class="road r3"></div><div class="userDot" title="Poziția rămâne pe dispozitiv"><i></i><span>Tu</span></div><button class="car c1" aria-label="Mașină demo la 3 minute">↗<span>3 min</span></button><button class="car c2" aria-label="Mașină demo la 5 minute">↗<span>5 min</span></button><button class="car c3" aria-label="Mașină demo la 8 minute">↗<span>8 min</span></button><div class="mapLegend"><b>Mașini sintetice</b><span>Nicio locație reală de șofer nu este pretinsă</span></div></section>`;
}

export async function renderRideWorkspace(vp, deps) {
  const epoch = ++renderEpoch;
  frame(vp, { kind: "ride", title: "Nexus Ride", subtitle: "Hartă demo · zone private · preț TEST-USDC clar", tabs: [["map", "Hartă"], ["request", "Cere cursă"], ["drive", "Condu"], ["trips", "Curse"]], active: rideSection, onTab: (next) => { rideSection = next; renderRideWorkspace(vp, deps); } });
  const host = vp.querySelector("#fair-content");
  if (rideSection === "request") {
    host.innerHTML = `${rideMap()}<form id="ride-request" class="fairForm rideRequest"><h3>Cere o cursă</h3><div class="fairGrid"><label>Zona de preluare<input name="pickup_zone" maxlength="100" required></label><label>Destinație aproximativă<input name="dropoff_zone" maxlength="100" required></label><label>Ora<input name="requested_at" type="datetime-local" required></label><label>Locuri<input name="seats" type="number" min="1" max="8" value="1" required></label><label>Quote TEST-USDC<input name="fare" type="number" min="1" step="0.01" required></label><label>PIN cursă<input name="trip_pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label></div><button>Caută șofer local</button><small>PIN-ul îl comunici șoferului la preluare. Nexus stochează numai hash-ul.</small></form>`;
    host.querySelector("#ride-request").addEventListener("submit", async (event) => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await deps.api("/api/ride/requests", { method: "POST", headers: { "Idempotency-Key": key("ride-request") }, body: { pickup_zone: data.pickup_zone, dropoff_zone: data.dropoff_zone, requested_at: Math.floor(new Date(data.requested_at).getTime() / 1000), seats: Number(data.seats), quoted_fare_cents: Math.round(Number(data.fare) * 100), trip_pin: data.trip_pin } });
      deps.toast(result.ok ? "Cursa este deschisă" : (result.error || "Cererea a eșuat")); if (result.ok) { rideSection = "trips"; renderRideWorkspace(vp, deps); }
    });
    return;
  }
  if (rideSection === "drive") {
    const [driver, open] = await Promise.all([deps.api("/api/ride/driver"), deps.api("/api/ride/requests?scope=open")]);
    if (epoch !== renderEpoch || !valid(driver, deps, "travel") || !valid(open, deps, "travel")) return void (host.innerHTML = '<div class="fairError">Modul Driver nu a putut fi verificat.</div>');
    host.innerHTML = `${rideMap()}${driver.driver ? `<section class="driverPanel"><header><span><small>${h(driver.driver.verification_status)}</small><h3>${h(driver.driver.vehicle_label)}</h3></span><strong>${h(driver.driver.status)}</strong></header><button id="driver-toggle" ${driver.driver.status === "on_trip" ? "disabled" : ""}>${driver.driver.status === "available" ? "Oprește disponibilitatea" : "Devino disponibil"}</button></section>` : `<form id="driver-create" class="fairForm"><h3>Profil șofer demo</h3><label>Mașină<input name="vehicle_label" maxlength="100" required></label><label>Locuri<input name="seats" type="number" min="1" max="8" value="4" required></label><label class="ack"><input name="ack" type="checkbox" required> Înțeleg că verificarea este exclusiv sintetică și locală.</label><button>Activează demo</button></form>`}<section class="fairList"><h3>Cereri eligibile</h3>${open.requests.length ? open.requests.map((ride) => `<article class="transactionCard"><header><b>${h(ride.pickup_zone)} → ${h(ride.dropoff_zone)}</b><strong>${money(ride.quoted_fare_cents)}</strong></header><p>${when(ride.requested_at)} · ${ride.seats} loc(uri)</p><button data-ride-accept="${ride.id}">Acceptă cursa</button></article>`).join("") : '<p class="fairEmpty">Nicio cerere disponibilă sau profilul nu este online.</p>'}</section>`;
    host.querySelector("#driver-create")?.addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = await deps.api("/api/ride/driver", { method: "POST", headers: { "Idempotency-Key": key("ride-driver") }, body: { vehicle_label: data.get("vehicle_label"), seats: Number(data.get("seats")), demo_acknowledged: data.get("ack") === "on" } }); deps.toast(result.ok ? "Profil demo creat" : (result.error || "Activarea a eșuat")); if (result.ok) renderRideWorkspace(vp, deps); });
    host.querySelector("#driver-toggle")?.addEventListener("click", async () => { const result = await deps.api("/api/ride/driver", { method: "PATCH", headers: { "Idempotency-Key": key("ride-availability") }, body: { available: driver.driver.status !== "available" } }); deps.toast(result.ok ? "Disponibilitate actualizată" : (result.error || "Actualizarea a eșuat")); if (result.ok) renderRideWorkspace(vp, deps); });
    host.querySelectorAll("[data-ride-accept]").forEach((button) => button.addEventListener("click", async () => { const result = await deps.api(`/api/ride/requests/${button.dataset.rideAccept}/accept`, { method: "POST", headers: { "Idempotency-Key": key("ride-accept") }, body: {} }); deps.toast(result.ok ? "Cursă acceptată" : (result.error || "Cursa nu mai este disponibilă")); if (result.ok) { rideSection = "trips"; renderRideWorkspace(vp, deps); } }));
    return;
  }
  if (rideSection === "trips") {
    const result = await deps.api("/api/ride/requests?scope=mine");
    if (epoch !== renderEpoch || !valid(result, deps, "travel") || result.precise_location_stored !== false || result.requests.some((ride) => Object.hasOwn(ride, "trip_pin_hash"))) return void (host.innerHTML = '<div class="fairError">Cursele au fost refuzate: verificarea privacy nu a trecut.</div>');
    host.innerHTML = `<section class="fairList"><h3>Cursele mele</h3>${result.requests.length ? result.requests.map((ride) => `<article class="transactionCard"><header><b>${h(ride.pickup_zone)} → ${h(ride.dropoff_zone)}</b><strong>${money(ride.quoted_fare_cents)}</strong></header><p>${h(ride.viewer_role)} · ${h(ride.status)} ${ride.driver_handle ? `· @${h(ride.driver_handle)}` : ""}</p><footer>${ride.status === "matched" && ride.viewer_role === "driver" ? `<button data-ride-action="${ride.id}" data-action="start">Pornește cu PIN</button>` : ""}${ride.status === "in_trip" && ride.viewer_role === "driver" ? `<button data-ride-action="${ride.id}" data-action="complete">Finalizează</button>` : ""}${["open", "matched"].includes(ride.status) ? `<button data-ride-action="${ride.id}" data-action="cancel">Anulează</button>` : ""}${ride.status === "completed" ? `<button data-review="ride/requests" data-subject="${ride.id}">Review dublu-orb</button>` : ""}</footer></article>`).join("") : '<p class="fairEmpty">Nicio cursă.</p>'}</section>`;
    host.querySelectorAll("[data-ride-action]").forEach((button) => button.addEventListener("click", async () => { const pin = button.dataset.action === "start" ? (globalThis.prompt?.("PIN-ul de 4 cifre primit de la rider:", "") || "") : ""; const result = await deps.api(`/api/ride/requests/${button.dataset.rideAction}`, { method: "PATCH", headers: { "Idempotency-Key": key(`ride-${button.dataset.action}`) }, body: { action: button.dataset.action, trip_pin: pin } }); deps.toast(result.ok ? "Cursa a fost actualizată" : (result.error || "Acțiunea a eșuat")); if (result.ok) renderRideWorkspace(vp, deps); }));
    wireReviews(host, vp, { ...deps, rerender: (target) => renderRideWorkspace(target, deps) });
    return;
  }
  host.innerHTML = `${rideMap()}<section class="rideMapActions"><button id="locate-device">Folosește poziția pe dispozitiv</button><span id="location-truth">Locația exactă nu este trimisă serverului.</span></section><section class="rideSafety"><b>Safety by design</b><span>Zone aproximative înainte de match · PIN la preluare · identitatea șoferului separată · SOS și routing real rămân gates de producție.</span></section>`;
  host.querySelector("#locate-device").addEventListener("click", () => {
    const status = host.querySelector("#location-truth");
    if (!navigator.geolocation) return void (status.textContent = "Geolocația nu este disponibilă pe acest dispozitiv.");
    status.textContent = "Solicit permisiunea…";
    navigator.geolocation.getCurrentPosition((position) => { const dot = host.querySelector(".userDot"); dot.style.setProperty("--ux", `${20 + Math.abs(position.coords.longitude * 7) % 60}%`); dot.style.setProperty("--uy", `${20 + Math.abs(position.coords.latitude * 7) % 55}%`); status.textContent = `Poziție detectată local (±${Math.round(position.coords.accuracy)} m); coordonatele nu au fost trimise.`; }, () => { status.textContent = "Permisiunea a fost refuzată sau HTTPS lipsește."; }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });
}
