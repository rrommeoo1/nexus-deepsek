import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");

test("Trust Lens UI states evidence limits instead of presenting a truth score", () => {
  assert.match(app, /a\.truthPercentage === null/);
  assert.match(app, /r\?\.methodology\?\.no_truth_score === true/);
  assert.match(app, /r\.methodology\.automated_only === true/);
  assert.match(app, /r\.methodology\.visual_classifier_configured === false/);
  assert.match(app, /trustBasisMessage\(label\.basis\)/);
  for (const language of ["ro", "en", "pl", "ar"]) {
    const start = locale.indexOf(`${language}: {`);
    const end = locale.indexOf("\n  },", start);
    const catalogue = locale.slice(start, end);
    assert.match(catalogue, /"trust\.factualDetail"/);
    assert.match(catalogue, /"trust\.methodDetail"/);
    assert.match(catalogue, /"trust\.communityFakeNote"/);
  }
});

test("moderation reads and appeals are exact viewer, profile and assessment bound", () => {
  assert.match(app, /Number\(r\.post_id\) !== postId/);
  assert.match(app, /Number\(r\.viewer_id\) !== viewerId/);
  assert.match(app, /r\.viewer_persona !== viewerPersona/);
  assert.match(app, /r\.privacy_enforced_server_side !== true/);
  assert.match(app, /result\.statement_of_reasons\?\.human_review_performed === false/);
  assert.match(app, /result\.statement_of_reasons\?\.restriction_changed === false/);
  assert.match(api, /Number\(post\.user_id\) !== Number\(auth\.user\.id\)/);
  assert.match(api, /assessment_hash: currentAssessment\.assessmentHash/);
});

test("community reports remain context signals and never become vote-count takedowns", () => {
  assert.match(api, /enforcement_changed: false/);
  assert.match(api, /report_alone_removes_content: false/);
  assert.match(api, /restriction_changed: false, author_disputed: true/);
  assert.match(app, /r\.methodology\.community_fake_is_opinion === true/);
});
