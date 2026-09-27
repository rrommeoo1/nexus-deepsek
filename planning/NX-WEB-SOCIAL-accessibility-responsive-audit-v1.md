# Nexus Social — accessibility and responsive interaction audit v1

Packet: `NX-WEB-SOCIAL-P03-ACCESSIBILITY-AND-RESPONSIVE-INTERACTION-AUDIT-037`  
Prepared: 2026-09-03  
Classification: local implementation evidence, **not** WCAG certification or a real-device approval

## Scope

This packet standardizes keyboard and assistive-technology behavior for every
current Nexus surface with `role="dialog"` and `aria-modal="true"`. It also adds
coarse-pointer target overrides, visible focus for native interactive elements,
high-contrast preferences and preserves the existing reduced-motion gates.

## Modal contract

- One shared manager discovers the top rendered dialog and gives unlabelled new
  implementations no special bypass. Current modal markup is separately checked
  for an accessible label.
- `Tab` and `Shift+Tab` wrap inside the top dialog. Hidden, inert,
  `aria-hidden="true"`, non-rendered and ancestor-hidden controls are excluded.
- All branches outside the active dialog are temporarily isolated with both
  `inert` and `aria-hidden`. Their exact previous attribute values are restored.
- Nested dialogs are supported: closing a child restores the exact invoking
  control inside the parent and keeps the parent isolated; closing the final
  dialog restores its external opener.
- Pointer and keyboard-generated click openers are tracked. A synchronous
  feature-level `.focus()` before the mutation observer runs does not overwrite
  the invoking control.
- Media viewer and moderation no longer own a second, conflicting copy of the
  app-level inert/ARIA state.

## Responsive and preference behavior

- Coarse-pointer controls default to at least 44 CSS pixels in height. Compact
  header selectors and creator/menu controls with older `!important` dimensions
  receive final, more specific 44-pixel overrides.
- Focus rings include buttons, inputs, textareas, selects, links and explicit
  tab stops.
- `prefers-contrast: more` raises border and muted-text contrast.
- Existing `prefers-reduced-motion: reduce` rules remain active for stories,
  unread indicators, Live and feed motion.
- Cache versions for the application script and stylesheet were advanced so a
  phone reload does not retain the older interaction layer.

## Deterministic verification

The local test harness includes an executable fake DOM, not regex-only evidence.
It exercises:

1. opener → modal → close → original opener restoration;
2. synchronous dialog focus before observer delivery;
3. nested parent → child → parent-control restoration;
4. exact removal of temporary app `inert`/`aria-hidden` state;
5. exclusion of controls below hidden ancestors from the Tab boundary.

Source-shape checks additionally cover all current modal labels, focus styles,
coarse-pointer overrides, contrast preference and reduced motion. The ordinary
product suite, local synthetic actors and release gate remain required after this
focused test.

## Explicit limitations and external gate

This is not a declaration of WCAG 2.2 conformance. Automated browser access to
`http://127.0.0.1:3000` was denied by a saved local Browser permission, so no
browser-computed-style claim is made in this packet. Representative Android/iOS
screen-reader, switch-control, keyboard, zoom/reflow, color/contrast measurement
and trusted-HTTPS testing still require an authorized real-device accessibility
matrix and independent T1 review.
