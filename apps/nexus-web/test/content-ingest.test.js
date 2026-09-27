// Tests for the out-of-band CC/PD catalog ingest (scripts/content-ingest.mjs) and its
// rollback (scripts/content-unseed.mjs). No network access is exercised here.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_SOURCE_HOSTS, ALLOWED_ORIGIN_HOSTS, INGEST_SCHEMA, INGEST_MARKER, MAX_MEDIA_BYTES,
  licenceDecision, captionSafety, captionGate, stripJpegMetadata, stripPngMetadata,
  stripWebpMetadata, trimCaption, parseArgs, planSummary, admitMedia, cleanCredit,
  videoDerivativeOrder, parseContentRange, resolveVideoAsset, MAX_VIDEO_SECONDS, publishedEntry,
} from "../scripts/content-ingest.mjs";
import { parseArgs as parseUnseedArgs, planUnseed } from "../scripts/content-unseed.mjs";

test("licence admission accepts only public domain and reuse-friendly CC licences", () => {
  for (const licence of ["CC BY-SA 4.0", "CC0", "Public domain", "CC BY 4.0", "by 2.0", "by-sa 4.0", "pdm"]) {
    assert.equal(licenceDecision(licence).allowed, true, licence);
  }
  for (const licence of ["", "CC BY-NC 4.0", "by-nc 2.0", "CC BY-ND", "fair use", "GFDL", "unknown"]) {
    assert.equal(licenceDecision(licence).allowed, false, licence);
  }
});

test("caption gate blocks disallowed terms before any write", () => {
  assert.equal(captionSafety("A quiet mountain road at sunrise").safe, true);
  assert.equal(captionSafety("Explicit nudity in the frame").safe, false);
  assert.equal(captionGate("A quiet mountain road at sunrise", "text").ok, true);
  assert.equal(captionGate("gore and corpse", "text").ok, false);
});

test("jpeg metadata stripping removes APP1/APP13/COM and keeps image segments", () => {
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x06]), Buffer.from("Exif")]);
  const comment = Buffer.concat([Buffer.from([0xff, 0xfe, 0x00, 0x07]), Buffer.from("note!")]);
  const sos = Buffer.concat([Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.from([0x11, 0x22, 0x33])]);
  const source = Buffer.concat([Buffer.from([0xff, 0xd8]), exif, comment, sos]);
  const cleaned = stripJpegMetadata(source);
  assert.equal(cleaned[0], 0xff);
  assert.equal(cleaned[1], 0xd8);
  assert.ok(!cleaned.includes(Buffer.from("Exif")));
  assert.ok(!cleaned.includes(Buffer.from("note!")));
  assert.ok(cleaned.includes(Buffer.from([0xff, 0xda])));
  assert.equal(stripJpegMetadata(Buffer.from("not-an-image")).toString(), "not-an-image");
});

test("png text chunks are removed while decoder chunks survive", () => {
  const chunk = (type, body) => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, Buffer.from(type, "ascii"), body, Buffer.alloc(4)]);
  };
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const source = Buffer.concat([signature, chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from("Author\0someone")), chunk("IDAT", Buffer.from([1, 2, 3])), chunk("IEND", Buffer.alloc(0))]);
  const cleaned = stripPngMetadata(source);
  assert.ok(!cleaned.includes(Buffer.from("tEXt")));
  assert.ok(cleaned.includes(Buffer.from("IHDR")));
  assert.ok(cleaned.includes(Buffer.from("IDAT")));
  assert.ok(cleaned.includes(Buffer.from("IEND")));
});

test("webp exif chunks are dropped and the riff size is repaired", () => {
  const size = (length) => { const head = Buffer.alloc(4); head.writeUInt32LE(length, 0); return head; };
  const fourcc = (name, body) => Buffer.concat([Buffer.from(name, "ascii"), size(body.length), body]);
  const payload = Buffer.concat([fourcc("VP8 ", Buffer.from([9, 9, 9, 9])), fourcc("EXIF", Buffer.from("gps-metadata"))]);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(payload.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  const cleaned = stripWebpMetadata(Buffer.concat([header, payload]));
  assert.ok(!cleaned.includes(Buffer.from("EXIF")));
  assert.ok(cleaned.includes(Buffer.from("VP8 ")));
  assert.equal(cleaned.readUInt32LE(4), cleaned.length - 8);
});

test("media admission refuses unsupported containers instead of writing them", () => {
  const repo = { insertMedia: () => { throw new Error("must not be called"); } };
  const result = admitMedia(repo, { buffer: Buffer.from("x"), mime: "application/ogg", userId: 19, purpose: "social_post" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /mime_not_supported/);
});

test("captions are bounded and credits are de-duplicated", () => {
  assert.ok(trimCaption("a".repeat(400), 120).length <= 121);
  assert.equal(trimCaption("short caption", 120), "short caption");
  assert.equal(cleanCredit("Unknown author Unknown author"), "Unknown author");
  assert.equal(cleanCredit('<a href="#">Espino Family</a>'), "Espino Family");
});

test("ingest plan is explicit about egress and budgets", () => {
  const plan = planSummary();
  assert.equal(plan.schema, INGEST_SCHEMA);
  assert.equal(plan.marker, INGEST_MARKER);
  assert.equal(plan.runtime_offline, true);
  assert.equal(plan.outbound_fetch, true);
  assert.equal(plan.max_media_bytes, MAX_MEDIA_BYTES);
  assert.ok(plan.allowlisted_hosts.includes("commons.wikimedia.org"));
  assert.ok(ALLOWED_SOURCE_HOSTS.includes("ro.wikipedia.org"));
  assert.ok(ALLOWED_ORIGIN_HOSTS.includes("thumb.wikimedia.org"));
  assert.equal(plan.metadata_stripping["image/jpeg"].includes("APP1"), true);
});

test("cli flags are parsed without implicit writes", () => {
  const flags = parseArgs(["--apply", "--user", "19", "--confirm-live-db", "--only", "clips", "--limit", "3", "--no-stories"]);
  assert.equal(flags.apply, true);
  assert.equal(flags.user, 19);
  assert.equal(flags.only, "clips");
  assert.equal(flags.limit, 3);
  assert.equal(flags.noStories, true);
  assert.equal(parseArgs([]).apply, false);
});

test("video derivatives stay on the Commons asset cluster and are ordered lightest first", () => {
  const ordered = videoDerivativeOrder([
    { transcodekey: "480p.vp9.webm", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/x.webm/x.webm.480p.vp9.webm", type: 'video/webm; codecs="vp9, opus"' },
    { transcodekey: "240p.vp9.webm", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/x.webm/x.webm.240p.vp9.webm", type: "video/webm" },
    { transcodekey: "720p.vp9.webm", src: "https://evil.example.com/x.webm.720p.vp9.webm", type: "video/webm" },
    { transcodekey: "1080p.vp9.webm", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/x.webm/x.webm.1080p.vp9.webm", type: "video/webm" },
  ]);
  assert.deepEqual(ordered.map((entry) => entry.key), ["240p.vp9.webm", "480p.vp9.webm", "1080p.vp9.webm"]);
  assert.equal(ordered[0].mime, "video/webm");
  assert.equal(videoDerivativeOrder(null).length, 0);
  assert.equal(videoDerivativeOrder([{ transcodekey: "240p.vp9.webm", src: "http://upload.wikimedia.org/x.webm" }]).length, 0);
});

test("a ranged content-range header reveals the true object size without a download", () => {
  assert.equal(parseContentRange("bytes 0-2047/30448117"), 30448117);
  assert.equal(parseContentRange("bytes=0-1023/1200000"), 1200000);
  assert.equal(parseContentRange(""), 0);
  assert.equal(parseContentRange(null), 0);
});

test("a video without derivatives keeps its original asset untouched", async () => {
  const source = { provider: "wikimedia_commons", assetUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/x.webm", mime: "video/webm", declaredBytes: 1024, derivatives: [], duration: 12 };
  const resolved = await resolveVideoAsset(source);
  assert.equal(resolved, source);
  assert.equal(resolved.derivativeKey, undefined);
});

test("the plan states the clip duration policy next to the byte budget", () => {
  const plan = planSummary();
  assert.equal(plan.max_video_seconds, MAX_VIDEO_SECONDS);
  assert.match(plan.video_derivatives, /transcode/);
});

test("a published receipt names the derivative that was actually stored", () => {
  const entry = publishedEntry({
    kind: "video",
    source: { provider: "wikimedia_commons", licence: "CC BY 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:x.webm" },
    result: { post: { id: 75 }, media: { id: 66 }, caption: "caption", bytes: 5872025, source: { derivativeKey: "240p.vp9.webm" } },
  });
  assert.equal(entry.derivative, "240p.vp9.webm");
  assert.equal(entry.bytes, 5872025);
  assert.equal(entry.post_id, 75);
  assert.equal(entry.media_id, 66);
  // An untouched original reports null instead of a stale derivative key.
  assert.equal(publishedEntry({ kind: "image", source: {}, result: { post: { id: 1 }, media: { id: 2 }, source: {} } }).derivative, null);
});

test("unseed with --post stays narrow and never expands to a full rollback", () => {
  const flags = parseUnseedArgs(["--post", "26", "--apply", "--confirm-live-db", "--user", "19"]);
  assert.deepEqual(flags.posts, [26]);
  assert.equal(flags.apply, true);
  const db = {
    prepare(sql) {
      if (sql.includes("FROM posts")) return { get: (id) => (Number(id) === 26 ? { id: 26, user_id: 19 } : undefined), all: () => [] };
      if (sql.includes("FROM stories")) return { get: () => undefined, all: () => [] };
      if (sql.includes("FROM content_sources")) return { all: () => [] };
      return { get: () => undefined, all: () => [] };
    },
  };
  const plan = planUnseed(db, { userId: 19, posts: flags.posts });
  // Receipts exist on disk for this account, but a targeted cleanup must stay targeted.
  assert.deepEqual(plan.postIds, [26]);
  assert.deepEqual(plan.storyIds, []);
  assert.ok(plan.receipts >= 0);
});

