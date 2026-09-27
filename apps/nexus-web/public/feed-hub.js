// The drawer of the marks, and what is behind it. Wave 14g replaced the source panel and the two bar
// buttons that looked the same with a single button, and the owner asked for a drawer that is small and
// has no words in it - one tile per module of Nexus and one tile that ends the session. Wave 14h took
// that button off the bar and wave 14i put it back, on the right of the bar, because the mark the owner
// wanted gone was the gear drawn over the reel - so the drawer is opened from that button and from the
// `menu` mark of the bottom bar, and it sits above the bar. The reveal itself (the layer, the backdrop,
// the focus, Esc, the tap outside) lives in feed-surface.js beside the drawer, and this module only
// decides what the drawer holds and what each tile does.
//
// The tiles are rebuilt every time the drawer opens, never earlier: the module being read is marked from
// the state at that moment, so a drawer that moved never answers from a stale list.
import { bindFeedHub, feedQuickDrawerMarkup, feedQuickTilesMarkup } from "./feed-surface.js?v=20260923-wave14i";

// `ctx` is the application: its translator, its state and the actions that already exist. Nothing is
// duplicated here that the app already knows how to do.
export function createFeedHub(ctx) {
  const { t, esc, profiles, state } = ctx;
  let hub = null;

  // Two of the personas wear their initials as a mark (SK, WK). A drawer of marks asks for the mark of the
  // module each one belongs to instead, and those are the marks the module rail already prints, so nothing
  // here is a drawing the application did not have.
  const PERSONA_MARKS = Object.freeze({ social: "▶", work: "▣" });

  const modules = () => profiles.map((profile) => ({ id: profile[0], glyph: PERSONA_MARKS[profile[0]] || profile[3], title: profile[1], color: profile[4], active: profile[0] === state.persona }));

  return {
    // Mounted once per phone screen, with the shell: the drawer has to outlive every header re-render.
    mount(screen) {
      if (!screen || hub) return hub;
      screen.insertAdjacentHTML("beforeend", feedQuickDrawerMarkup({ t, esc }));
      hub = bindFeedHub(screen, {
        build: () => feedQuickTilesMarkup({ esc, modules: modules() }),
        onModule: (id) => { void ctx.module(id); },
        onLogout: () => ctx.logout(),
      });
      return hub;
    },
    close: () => hub?.close(),
  };
}
