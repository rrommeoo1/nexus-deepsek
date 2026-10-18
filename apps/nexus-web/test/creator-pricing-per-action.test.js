import assert from "node:assert/strict";
import test from "node:test";

import { pricingView, normalizePricingInput } from "../lib/creator-pricing.js";
import { withMonetizedAuthors } from "../lib/creator-monetized.js";

test("each action carries its own price and zero means free", () => {
  const partial = normalizePricingInput({ free: false, prices: { appreciation: 200, comment: 0 } });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.prices, { appreciation: 200, comment: 0, share: 0 });
  assert.equal(partial.monetized, true);
  assert.equal(partial.free, false);

  const everythingFree = normalizePricingInput({ free: false, prices: { appreciation: 0, comment: 0, share: 0 } });
  assert.equal(everythingFree.ok, true);
  assert.equal(everythingFree.monetized, false);
  assert.equal(everythingFree.free, true);

  const missing = normalizePricingInput({ free: false, prices: { share: 300 } });
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.prices, { appreciation: 0, comment: 0, share: 300 });
});

test("the floor applies only to the actions that are actually paid", () => {
  const atFloor = normalizePricingInput({ free: false, prices: { appreciation: 3, comment: 0, share: 0 } });
  assert.equal(atFloor.ok, true);
  const below = normalizePricingInput({ free: false, prices: { appreciation: 2, comment: 0, share: 0 } });
  assert.equal(below.ok, false);
  assert.equal(below.code, "PRICE_BELOW_SETTLEMENT_COST");
});

test("free plus a price is still a contradiction, and a negative price is refused", () => {
  assert.equal(normalizePricingInput({ free: true, prices: { comment: 200 } }).code, "FREE_WITH_PRICES");
  assert.equal(normalizePricingInput({ free: false, prices: { comment: -1 } }).code, "PRICE_INVALID");
});

test("the view prints JUNGLE, derives monetized, and explains its floor", () => {
  const free = pricingView({ free: true, actions: {} });
  assert.equal(free.display_currency, "JUNGLE");
  assert.equal(free.monetized, false);
  assert.equal(free.free, true);
  assert.equal(free.floor_cents, 3);
  assert.equal(free.floor_reason, "POLICY_V3");
  assert.match(free.floor_basis.message, /0\.03 JUNGLE/);

  const paid = pricingView({ free: false, actions: { comment: { id: 7, price_cents: 200 } } });
  assert.equal(paid.monetized, true);
  assert.equal(paid.free, false);
  assert.equal(paid.actions.comment.chargeable, true);
  assert.equal(paid.actions.share.chargeable, false);
});

test("the author decorator marks every handle in a nested payload and leaves the rest alone", () => {
  const payload = {
    items: [
      { id: 1, handle: "paid", display_name: "Paid", nested: { author: { id: 2, handle: "free" } } },
      { id: 9, caption: "no handle here" },
    ],
    conversation: { id: 3, handle: "paid", peer: { id: 4, handle: "paid" } },
  };
  const decorated = withMonetizedAuthors(payload, new Set([1, 3, 4]));
  assert.equal(decorated.items[0].monetized, true);
  assert.equal(decorated.items[0].nested.author.monetized, false);
  assert.equal("monetized" in decorated.items[1], false);
  assert.equal(decorated.conversation.monetized, true);
  assert.equal(decorated.conversation.peer.monetized, true);
});

test("a payload without a flag set is returned exactly as it was", () => {
  const payload = { author: { id: 1, handle: "someone" } };
  assert.deepEqual(withMonetizedAuthors(payload, null), { author: { id: 1, handle: "someone" } });
  assert.equal("monetized" in payload.author, false);
});
