# Nexus Social — localized Trust and moderation sheets v1

Packet: `NX-WEB-SOCIAL-P01-LOCALIZE-TRUST-MODERATION-SHEETS-042`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

Trust Lens, author dispute, report and pre-publication automated review surfaces
now use the active Social persona locale in Romanian, English, Polish and Arabic.
The catalogue includes every report category and the complete success, failure and
blocked/reviewed states.

Trust Lens preserves the product's evidence boundary:

- it states when a post has not been fact-checked;
- it never invents or displays a truth percentage;
- “Fake?” is explicitly a community opinion, not a factual verdict;
- an author provenance declaration is not presented as independent verification;
- deterministic local text rules are not presented as human or external visual
  review.

Machine-readable assessment codes remain visible for audit, inside LTR bidi
isolation. Their user explanations and technical-basis labels come from the local
catalogue rather than the backend-provided `meaning` field. Unknown codes receive a
truthful generic context explanation; malformed assessments fail closed with a
stable unavailable message.

Report, appeal and reconsideration failures do not expose raw backend error strings.
Synthetic/test reports remain explicitly excluded from enforcement. A successful
automated reconsideration updates the draft only and still requires a separate
explicit Publish action.

External sharing, production providers, real payments and chain submission remain
disabled.

## Findings resolved

- **High:** Trust, appeal, report and reconsideration errors could surface raw
  backend strings inside sensitive safety UI. Stable localized errors now replace
  raw detail.
- **Medium:** backend-provided label meanings were rendered directly and were
  Romanian-only. Known codes now map to controlled localized explanations; unknown
  codes use a generic non-verdict explanation.
- **Medium:** malformed or incomplete Trust assessments could cause fragile UI or
  ambiguous values. Object/array checks and explicit unavailable fallbacks now fail
  closed.
- **Medium:** report categories and automated-review states mixed Romanian literals
  into EN/PL/AR. Catalogue parity now covers the complete bounded surface.
- **Medium:** dynamic safety codes and policy/status identifiers could reorder in
  Arabic. Machine identifiers now use explicit LTR bidi isolation.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused tests including modal accessibility: `116/116` PASS.
- Full suite: `209/209` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Existing Trust contract checks: `truthPercentage === null`, factual status
  `NOT_FACT_CHECKED`, deterministic moderation, idempotent reports and synthetic
  exclusion remain PASS.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the honest result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. It is not legal approval, a DSA conformity
assessment, a native-language review, a production model evaluation or an
independent T0/T1 safety audit.

## Scope boundary

This packet covers Trust Lens, author disputes, content/comment reports and
pre-publication reconsideration. The optional-support payment sheet, Create, Live,
Messages, Profile and login remain later bounded localization packets. Human/formal
legal and safety release gates remain external.
