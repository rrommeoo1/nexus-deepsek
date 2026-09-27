// Wave 6u contracts: the client can hash what it sends even where the platform refuses to.
// The bug this pins: `crypto.subtle` does not exist on an insecure origin (a phone on http://192.168.x.x),
// and every upload hashes its bytes before the first request, so a photograph never left the phone.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Sha256, digestHexOf, hexOf, sha256Hex } from "../public/sha256.js";

const node = (bytes) => createHash("sha256").update(bytes).digest("hex");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("the pure implementation agrees with the platform on the published vectors", () => {
  assert.equal(sha256Hex(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex(new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  assert.equal(hexOf(new Uint8Array([0, 15, 16, 255])), "000f10ff");
});

test("every message length around a block boundary hashes the same as the platform", () => {
  // 55/56 and 119/120 are where the length never fits in the last block and a second one is needed.
  const lengths = [0, 1, 2, 3, 54, 55, 56, 57, 63, 64, 65, 66, 118, 119, 120, 121, 127, 128, 129, 200, 1023, 1024, 1025];
  for (const length of lengths) {
    const bytes = randomBytes(length);
    assert.equal(sha256Hex(new Uint8Array(bytes)), node(bytes), `length ${length}`);
  }
});

test("the digest does not depend on how the bytes were handed over", () => {
  const bytes = randomBytes(4096);
  const hasher = new Sha256();
  for (let offset = 0; offset < bytes.length; offset += 37) hasher.update(new Uint8Array(bytes.subarray(offset, offset + 37)));
  assert.equal(hasher.digestHex(), node(bytes));
  // A hash that is read twice must not change what it says.
  assert.equal(hasher.digestHex(), node(bytes));
  const split = new Sha256();
  split.update(new Uint8Array(bytes.subarray(0, 64)));
  split.update(new Uint8Array(bytes.subarray(64)));
  assert.equal(split.digestHex(), node(bytes));
});

test("a file is hashed on an origin that has no platform hasher", async () => {
  const bytes = randomBytes(3 * 1024 * 1024 + 123); // larger than one read block, like a phone photograph
  const blob = new Blob([bytes], { type: "image/jpeg" });
  assert.equal(await digestHexOf(blob, { subtle: null }), node(bytes));
  // The native path is used when the platform offers one, and it must agree with the fallback.
  assert.equal(await digestHexOf(blob), node(bytes));
  assert.equal(await digestHexOf(blob, { subtle: globalThis.crypto.subtle }), node(bytes));
  assert.equal(await digestHexOf("abc", { subtle: null }), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("the upload no longer refuses to hash just because the origin is not secure", () => {
  // The old line threw UPLOAD_INTEGRITY_UNAVAILABLE before any request: that is what a phone on the local
  // network hit, with no upload session, no media row, and only a generic message.
  assert.equal(app.includes('if (!globalThis.crypto?.subtle) throw new UploadClientError("UPLOAD_INTEGRITY_UNAVAILABLE")'), false);
  // The story-publish fingerprint had the same guard, so a phone could not publish a story either.
  assert.match(app, /async function storyPublishFingerprint\(body\) \{[\s\S]*?return await digestHexOf\(canonical\);/);
  assert.match(app, /async function fileSha256\(file\) \{\n  \/\/ The digest is produced on every origin[\s\S]*?\n  try \{\n    return await digestHexOf\(file\);/);
  assert.match(app, /import \{ digestHexOf \} from "\.\/sha256\.js\?v=[0-9a-z-]+";/);
});
