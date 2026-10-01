import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { statSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

test("Social feed stays bounded, deterministic and inside the local regression budget", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const viewer = repo.createUser({ handle: "perf_viewer", displayName: "Performance Viewer" });
    repo.ensurePersona(viewer.id, "social", { visibility: "public" });
    for (let authorIndex = 0; authorIndex < 80; authorIndex += 1) {
      const author = repo.createUser({ handle: `perf_author_${authorIndex}`, displayName: `Author ${authorIndex}` });
      repo.ensurePersona(author.id, "social", { visibility: "public" });
      for (let postIndex = 0; postIndex < 5; postIndex += 1) {
        repo.createPost({
          userId: author.id,
          persona: "social",
          caption: `Deterministic post ${authorIndex}:${postIndex}`,
          visibility: postIndex === 4 ? "followers" : "public",
          regionCode: "RO-B",
          language: "ro",
        });
      }
    }
    const started = performance.now();
    const first = repo.listSocialFeed(viewer.id, { viewerPersona: "social", lens: "for-you", limit: 30, regionCode: "RO-B" });
    const elapsedMs = performance.now() - started;
    const second = repo.listSocialFeed(viewer.id, { viewerPersona: "social", lens: "for-you", limit: 30, regionCode: "RO-B" });
    assert.equal(first.length, 30);
    assert.deepEqual(second.map((post) => post.id), first.map((post) => post.id));
    assert.equal(new Set(first.map((post) => post.id)).size, first.length);
    assert.equal(first.every((post) => post.visibility === "public"), true);
    // A wide local CI guard catches accidental unbounded work without pretending
    // to be a production latency SLO or device benchmark.
    assert.equal(elapsedMs < 4000, true, `local feed regression: ${elapsedMs.toFixed(1)}ms`);

    const plan = db.prepare(`EXPLAIN QUERY PLAN
      SELECT p.id FROM posts p JOIN users author ON author.id = p.user_id
      WHERE p.persona = 'social' AND p.status = 'active' AND author.traffic_class = 'HUMAN_ORGANIC'
      ORDER BY p.created_at DESC, p.id DESC LIMIT 360`).all().map((row) => String(row.detail)).join("\n");
    assert.match(plan, /idx_posts_social_lens/);
  } finally { db.close(); }
});

test("first-party Social assets remain within explicit transfer-size regression budgets", () => {
  const sizes = {
    app: statSync(new URL("../public/app.js", import.meta.url)).size,
    locale: statSync(new URL("../public/interface-locale.js", import.meta.url)).size,
    css: ["styles.css", "p1-requests.css", "p2-clips.css", "p2-messaging.css", "p3-visual-foundation.css", "social-human-ux.css", "messenger-spaces.css"]
      .reduce((total, file) => total + statSync(new URL(`../public/${file}`, import.meta.url)).size, 0),
  };
  // The bounded recovery allowance covers pull-to-refresh, four-direction viewer
  // navigation, readable exclusive comments, the Nexus-only Send sheet and the
  // avatar-centric owner profile with its four bounded panels and device settings.
  // It also covers the X-surface wave: the tapped post page with its reply thread, one
  // pull-to-refresh gesture for every screen, the full per-post action menu and the real
  // view counters; wave two: the internal repost surface (profile shares, feed candidates,
  // undo) plus the reaction popover and the reply staircase; and wave three: the media
  // gallery, the tag pages and the trending block. This is a source regression guard, not a
  // production compressed-transfer SLO, so the allowance moves only together with a named
  // surface. app.js is close to the point where the next wave must extract a module instead:
  // wave three (P6) therefore put the whole community-note surface in post-detail.js and left
  // app.js with a single chip, which is why this number did not move again. Wave five (P7) kept the
  // same discipline: the clip panel is its own module (clip-options.js) and app.js only imports it.
  // Wave six (P8) follows it as well: the identity sheet, its validation and its submission live in
  // onboarding.js, and app.js carries only the glue that shows it once and the hero edit that saves
  // where the name and bio are read. Wave 6c (P8c) took the hero edit out of app.js for exactly this
  // reason — the pencil, the two fields and the location picker are profile-hero-edit.js now — so the
  // allowance comes down instead of up for the first time. Wave 6d (P8d) grew that module to the whole
  // identity (photo, cover, location) and deleted the four fields the settings form was duplicating, so
  // the allowance comes down a second time. The compact comments wave adds the shared five-action row,
  // real save/share wiring and root-versus-reply composer state; keep that named surface below 618 KB.
  // Jamendo audio is implemented in its own module. The camera creator wave adds the bounded
  // hardware controller glue: duration, timer, torch, filter persistence and Live handoff. The
  // sizeable camera catalogue/markup stays in reel-camera-surface.js rather than this entrypoint.
  // The capture-recovery patch adds the bounded photo/video review transition, retake action and
  // adaptive 15s/60s/10m recorder wiring; keep that named repair within the next 2 KB only.
  assert.equal(sizes.app <= 628_000, true, `app.js budget exceeded: ${sizes.app}`);
  // The interface locale is the single source of truth for four languages, so every new
  // surface costs copy in RO/EN/PL/AR. The X-surface wave adds the post page, the reply
  // actions, the real view counters and the profile albums, which is what this allowance
  // names. It is still a regression guard: a surface without a name does not move it. Wave
  // three (P6) adds the community-note engine: the note card, the composer, the rating
  // pair, the honest perspective labels and the status wording, in four languages. Wave four
  // (P5) adds the reply context line, the reply share and the profile section. Wave five (P7)
  // adds the whole clip panel: captions, speed, auto-advance, data saver, download, offline,
  // and the honest sentences that say what the platform refuses. Wave six (P8) adds the first-run
  // identity sheet (handle, name, persona, visibility, bio) and the hero that edits itself.
  // Wave 6g (P9) added the four Breaking sentences a reader sees when an aggregator answered, and wave 6h
  // (P10) is the surface that moves this number: the ranking vocabulary in four languages - the thirteen
  // reason sentences, the two negative terms a reader can act on, and the profile wording that says the
  // line there names signals instead of an order.
  // Wave 6s is the surface that moves this number: five new sentences in four languages (a save that
  // says there is nothing to write, a photo failure that says the words were kept, an editor that says it
  // reopened over the chosen photo, and the two notes the feed switcher used to print in Romanian).
  // Wave 9v is the surface that moves this number: the identity fields the band prints are edited in the
  // settings panel too - the city picker, the age the owner declares with its honest hint and its two
  // validation lines, what the lock beside the name stands for, and the sentence that says a cover photo
  // is being chosen - in four languages. It moves by 2 kB, which is what those ten sentences cost.
  // Wave 10 is the surface that moves it again, by 5 kB: the edit page (its title, its hint, the five row
  // names, the two cover modes and what they mean, the two sentences that say who may read the profile,
  // the door to the prices, and the two answers a written setting can have), the shelf of saved stories
  // that can replace the cover, and the two words a presence dot can stand for - in four languages.
  // Wave 12 is the surface that moves this number, by 3 kB: the five tab names the bar no longer prints but
  // still reads out, the three filter words, what a pin says before and after it is pressed, the two answers a
  // saved tab order can have, and the word "views" beside a clip - in four languages.
  // Reel metadata adds the expand/collapse labels; the progressive reply tree adds its two compact
  // disclosure labels in all four supported languages.
  assert.equal(sizes.locale <= 366_700, true, `locale budget exceeded: ${sizes.locale}`);
  // Wave 6e (P8e) put the settings drawer and the read-only ticker band in their own modules, and wave 6f
  // took the handle, the location and the three counters out of the hero so the band is the only place
  // they are printed, which is a net saving in profile-experience.css. Wave 6g (P9) is the surface that
  // moves this number: the Breaking lens rows - headline, source, time, the stale-snapshot marker and the
  // honest note - plus the two comments that explain them. The allowance is a source regression guard, not
  // a compressed-transfer SLO, so it moves once per named surface and by as little as that surface costs.
  // Wave 6i (P11) is the surface that moves this number the second time, and it moves it by 1.2 kB: a
  // landscape phone is a phone, so a coarse pointer with a short viewport gets the app full-bleed instead
  // of the desktop showcase frame and its 0.88 scale. That one rule replaces a screen of shrunken text.
  // The lower-left reel metadata is a named mobile surface: author/follow, soundtrack and a bounded,
  // scrollable three-line caption. Its allowance includes both the feed and full-screen viewer states.
  // Automatic Reel sound adds one compact attributed selection card, five alternatives and manual
  // search states. The 4 kB allowance is the complete surface, not an open-ended CSS increase.
  assert.equal(sizes.css <= 368_000, true, `CSS budget exceeded: ${sizes.css}`);
});
