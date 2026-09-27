import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let sequence = 0;
function request(method, url, body = {}, cookie = "", idempotencyKey = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url, socket: { remoteAddress: "127.0.0.161" },
    headers: { "content-type": "application/json", cookie, ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method) ? { "idempotency-key": idempotencyKey || `m6m8-default-${String(++sequence).padStart(8, "0")}` } : {}) },
    on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; }, once() { return this; }, destroy() {},
  };
}
function response() { return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); } }; }
async function call(state, method, path, body, cookie, key = null) { const res = response(); await handleRequest(request(method, path, body, cookie, key), res, state.context); return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} }; }
function cookie(repo, userId, persona) { const session = issueSession(userId, persona); repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt }); return `nexus_session=${session.token}`; }
function fixture() {
  const db = openDb(":memory:"), repo = createRepo(db), events = [];
  const context = { db, repo, sse: { publish(type, payload, channels) { events.push({ type, payload, channels }); return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } } };
  const users = ["owner", "alice", "bob", "charlie"].map((name) => repo.createUser({ handle: `fair_${name}`, displayName: name }));
  for (const user of users) for (const persona of ["social", "market", "travel"]) repo.ensurePersona(user.id, persona, { visibility: "public" });
  const [owner, alice, bob, charlie] = users;
  const cookies = Object.fromEntries(users.flatMap((user) => [[`${user.handle}:market`, cookie(repo, user.id, "market")], [`${user.handle}:travel`, cookie(repo, user.id, "travel")], [`${user.handle}:social`, cookie(repo, user.id, "social")]]));
  return { db, repo, context, events, owner, alice, bob, charlie, c: (user, persona) => cookies[`${user.handle}:${persona}`] };
}

test("M6 Market creates replay-safe listings and one accepted offer/order", async () => {
  const state = fixture();
  try {
    const denied = await call(state, "GET", "/api/market/listings", {}, state.c(state.owner, "social"));
    assert.equal(denied.status, 404); assert.equal(denied.body.code, "VERTICAL_PERSONA_REQUIRED");
    const payload = { title: "Camera", description: "Synthetic item in excellent condition", category: "electronics", price_cents: 12000, sale_mode: "protected_checkout", discovery_scope: "global", public_location: "Warsaw" };
    const created = await call(state, "POST", "/api/market/listings", payload, state.c(state.owner, "market"), "m6-listing-replay-000001");
    const replay = await call(state, "POST", "/api/market/listings", payload, state.c(state.owner, "market"), "m6-listing-replay-000001");
    assert.equal(created.status, 201); assert.deepEqual(replay.body, created.body); assert.equal(created.body.real_value, 0);
    const prohibited = await call(state, "POST", "/api/market/listings", { ...payload, title: "stolen weapon" }, state.c(state.owner, "market"), "m6-listing-prohibited-01");
    assert.equal(prohibited.status, 422); assert.equal(prohibited.body.code, "MARKET_PROHIBITED_ITEM");
    const listingId = created.body.listing.id;
    const aliceOffer = await call(state, "POST", `/api/market/listings/${listingId}/offers`, { amount_cents: 11000, message: "Alice offer" }, state.c(state.alice, "market"), "m6-offer-alice-000001");
    const bobOffer = await call(state, "POST", `/api/market/listings/${listingId}/offers`, { amount_cents: 11500, message: "Bob offer" }, state.c(state.bob, "market"), "m6-offer-bob-000001");
    assert.equal(aliceOffer.status, 201); assert.equal(bobOffer.status, 201);
    const winner = await call(state, "POST", `/api/market/offers/${bobOffer.body.offer.id}/accept`, {}, state.c(state.owner, "market"), "m6-accept-bob-000001");
    const loser = await call(state, "POST", `/api/market/offers/${aliceOffer.body.offer.id}/accept`, {}, state.c(state.owner, "market"), "m6-accept-alice-000001");
    assert.equal(winner.status, 201); assert.equal(winner.body.order.buyer_id, state.bob.id); assert.equal(winner.body.real_value, 0);
    assert.equal(loser.status, 409); assert.equal(loser.body.code, "MARKET_OFFER_NOT_MUTABLE");
    assert.equal(state.repo.listMarketOrders(state.alice.id).length, 0);
  } finally { state.db.close(); }
});

test("M6 Market lifecycle gates verified reviews behind completion", async () => {
  const state = fixture();
  try {
    const listing = await call(state, "POST", "/api/market/listings", { title: "Bike", description: "Local synthetic bicycle", category: "vehicles", price_cents: 20000, sale_mode: "free_classified", discovery_scope: "local", public_location: "Krakow" }, state.c(state.owner, "market"));
    const premature = await call(state, "POST", `/api/market/orders/999/reviews`, { rating: 5, comment: "No transaction" }, state.c(state.alice, "market"));
    assert.equal(premature.status, 409, JSON.stringify(premature.body)); assert.equal(premature.body.code, "REVIEW_NOT_ELIGIBLE");
    const offer = await call(state, "POST", `/api/market/listings/${listing.body.listing.id}/offers`, { amount_cents: 19000, message: "Ready" }, state.c(state.alice, "market"));
    const accepted = await call(state, "POST", `/api/market/offers/${offer.body.offer.id}/accept`, {}, state.c(state.owner, "market"));
    const fulfilled = await call(state, "PATCH", `/api/market/orders/${accepted.body.order.id}`, { action: "fulfill" }, state.c(state.owner, "market"));
    const completed = await call(state, "PATCH", `/api/market/orders/${accepted.body.order.id}`, { action: "complete" }, state.c(state.alice, "market"));
    assert.equal(fulfilled.body.order.status, "fulfilled"); assert.equal(completed.body.order.status, "completed");
    const review = await call(state, "POST", `/api/market/orders/${accepted.body.order.id}/reviews`, { rating: 5, comment: "Verified transaction" }, state.c(state.alice, "market"));
    assert.equal(review.status, 201); assert.equal(review.body.visibility, "IMMEDIATE");
    const publicReviews = await call(state, "GET", `/api/market/reviews?user_id=${state.owner.id}`, {}, state.c(state.bob, "market"));
    assert.equal(publicReviews.body.reviews.length, 1); assert.equal(publicReviews.body.reviews[0].comment, "Verified transaction");
  } finally { state.db.close(); }
});

test("M7 Stay hides exact address from discovery and prevents overlapping bookings", async () => {
  const state = fixture();
  try {
    const created = await call(state, "POST", "/api/stay/listings", { title: "Quiet loft", description: "Synthetic stay for local validation", public_location: "Cluj-Napoca centre", private_address: "Secret Street 10", nightly_cents: 7000, max_guests: 3, cancellation_policy: "moderate" }, state.c(state.owner, "travel"));
    assert.equal(created.status, 201, JSON.stringify(created.body)); assert.equal(created.body.real_value, 0);
    const discovery = await call(state, "GET", "/api/stay/listings", {}, state.c(state.bob, "travel"));
    assert.equal(discovery.body.private_address_policy, "HIDDEN_UNTIL_BOOKING"); assert.equal(Object.hasOwn(discovery.body.listings[0], "private_address"), false);
    const checkIn = Math.floor(Date.now() / 1000) + 2 * 86400, checkOut = checkIn + 3 * 86400;
    const first = await call(state, "POST", `/api/stay/listings/${created.body.listing.id}/book`, { check_in: checkIn, check_out: checkOut, guest_count: 2 }, state.c(state.alice, "travel"), "m7-book-alice-000001");
    const overlap = await call(state, "POST", `/api/stay/listings/${created.body.listing.id}/book`, { check_in: checkIn + 86400, check_out: checkOut + 86400, guest_count: 1 }, state.c(state.bob, "travel"), "m7-book-bob-000001");
    assert.equal(first.status, 201); assert.equal(first.body.booking.total_cents, 21000); assert.equal(first.body.booking.private_address, "Secret Street 10");
    assert.equal(overlap.status, 409); assert.equal(overlap.body.code, "STAY_DATES_UNAVAILABLE");
    const outsider = await call(state, "GET", "/api/stay/bookings", {}, state.c(state.bob, "travel"));
    assert.equal(outsider.body.bookings.length, 0);
    const cancel = await call(state, "PATCH", `/api/stay/bookings/${first.body.booking.id}`, { action: "cancel" }, state.c(state.alice, "travel"));
    assert.equal(cancel.body.booking.status, "cancelled");
  } finally { state.db.close(); }
});

test("M7 Stay reviews are double blind and become visible together", () => {
  const state = fixture();
  try {
    const listing = state.repo.createStayListing({ hostId: state.owner.id, title: "Past stay", description: "Completed fixture", publicLocation: "Paris", privateAddress: "Private 2", nightlyCents: 5000, maxGuests: 2, cancellationPolicy: "flexible" });
    const now = Math.floor(Date.now() / 1000), booking = state.repo.bookStay({ guestId: state.alice.id, listingId: listing.id, checkIn: now + 3600, checkOut: now + 7200, guestCount: 1 });
    state.repo.transitionStayBooking({ userId: state.owner.id, bookingId: booking.id, action: "complete", atSeconds: now + 7201 });
    const first = state.repo.createTransactionReview({ vertical: "stay", subjectId: booking.id, reviewerId: state.alice.id, rating: 5, comment: "Great host", atSeconds: now });
    assert.equal(first.visible, 0); assert.equal(state.repo.listTransactionReviews({ vertical: "stay", revieweeId: state.owner.id, atSeconds: now }).length, 0);
    state.repo.createTransactionReview({ vertical: "stay", subjectId: booking.id, reviewerId: state.owner.id, rating: 5, comment: "Great guest", atSeconds: now });
    assert.equal(state.repo.listTransactionReviews({ vertical: "stay", revieweeId: state.owner.id, atSeconds: now }).length, 1);
    assert.equal(state.repo.listTransactionReviews({ vertical: "stay", revieweeId: state.alice.id, atSeconds: now }).length, 1);
  } finally { state.db.close(); }
});

test("M8 Ride exposes synthetic map truth and has one driver winner with PIN start", async () => {
  const state = fixture();
  try {
    const socialDenied = await call(state, "GET", "/api/ride/requests", {}, state.c(state.alice, "social"));
    assert.equal(socialDenied.status, 404);
    for (const driver of [state.bob, state.charlie]) {
      const profile = await call(state, "POST", "/api/ride/driver", { vehicle_label: `${driver.handle} car`, seats: 4, demo_acknowledged: true }, state.c(driver, "travel"));
      assert.equal(profile.body.verification_truth, "LOCAL_SYNTHETIC_ONLY", JSON.stringify(profile.body));
      const available = await call(state, "PATCH", "/api/ride/driver", { available: true }, state.c(driver, "travel"));
      assert.equal(available.body.driver.status, "available");
    }
    const requestAt = Math.floor(Date.now() / 1000) + 900;
    const created = await call(state, "POST", "/api/ride/requests", { pickup_zone: "Old Town north", dropoff_zone: "Airport terminal", requested_at: requestAt, seats: 2, quoted_fare_cents: 1800, trip_pin: "4729" }, state.c(state.alice, "travel"));
    assert.equal(created.status, 201); assert.equal(created.body.precise_location_stored, false); assert.equal(Object.hasOwn(created.body.request, "trip_pin_hash"), false);
    const winner = await call(state, "POST", `/api/ride/requests/${created.body.request.id}/accept`, {}, state.c(state.bob, "travel"));
    const loser = await call(state, "POST", `/api/ride/requests/${created.body.request.id}/accept`, {}, state.c(state.charlie, "travel"));
    assert.equal(winner.status, 200); assert.equal(winner.body.request.driver_id, state.bob.id); assert.equal(loser.status, 409);
    const wrongPin = await call(state, "PATCH", `/api/ride/requests/${created.body.request.id}`, { action: "start", trip_pin: "1111" }, state.c(state.bob, "travel"));
    assert.equal(wrongPin.status, 409); assert.equal(wrongPin.body.code, "RIDE_PIN_OR_STATE_INVALID");
    const started = await call(state, "PATCH", `/api/ride/requests/${created.body.request.id}`, { action: "start", trip_pin: "4729" }, state.c(state.bob, "travel"));
    assert.throws(() => state.repo.upsertRideDriver({ userId: state.bob.id, vehicleLabel: "unsafe reset", seats: 4, verificationStatus: "synthetic_demo" }), { code: "RIDE_DRIVER_BUSY" });
    const completed = await call(state, "PATCH", `/api/ride/requests/${created.body.request.id}`, { action: "complete", trip_pin: "" }, state.c(state.bob, "travel"));
    assert.equal(started.body.request.status, "in_trip"); assert.equal(completed.body.request.status, "completed");
    assert.equal(Object.hasOwn(completed.body.request, "trip_pin_hash"), false); assert.equal(state.repo.getRideDriver(state.bob.id).status, "available");
  } finally { state.db.close(); }
});

test("M6-M8 schema, UI and zero-value boundaries are wired", () => {
  const schema = String(SCHEMA), ui = readFileSync(new URL("../public/fair-verticals.js", import.meta.url), "utf8"), app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8"), api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8"), css = readFileSync(new URL("../public/fair-verticals.css", import.meta.url), "utf8");
  assert.match(schema, /UNIQUE\(listing_id, buyer_id\)/); assert.match(schema, /idx_stay_bookings_overlap/); assert.match(schema, /trip_pin_hash TEXT NOT NULL/); assert.match(schema, /UNIQUE\(vertical, subject_id, reviewer_id\)/);
  assert.match(ui, /renderMarketWorkspace/); assert.match(ui, /renderStayWorkspace/); assert.match(ui, /renderRideWorkspace/); assert.match(ui, /navigator\.geolocation/); assert.match(ui, /Nicio locație reală de șofer nu este pretinsă/);
  assert.match(app, /case "ride": renderRide/); assert.match(css, /\.rideMap/); assert.doesNotMatch(ui, /WhatsApp|Telegram|messenger\.com/i);
  assert.match(api, /RIDE_PROVIDERS_NOT_CONFIGURED/); assert.match(api, /process\.env\.NODE_ENV === "production"/);
});
