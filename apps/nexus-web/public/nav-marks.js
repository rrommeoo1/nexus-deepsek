// The marks of the bottom bar, and the names they are read out with. They lived in app.js until wave 14h,
// which is the wave the transfer allowance in p1-performance-budget said would have to extract a module:
// the bar grew two marks (friends and search) and the reader's own face, and a surface that moves that
// number is a surface that moves out. Nothing here draws with an emoji - every mark is one path or one
// inline picture, because an emoji is a different drawing on every device - and nothing here decides where
// a mark goes or what it does: the bar in app.js owns that.
export function navIconMarkup(slot, fallback) {
  const paths = {
    primary: '<path d="M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z"/>',
    inbox: '<path d="M4 5.5h16v11H9l-5 3v-14Z"/>',
    utility: '<path d="M8 9a5 5 0 0 0 0 6M16 9a5 5 0 0 1 0 6M5 6a9 9 0 0 0 0 12M19 6a9 9 0 0 1 0 12"/><circle cx="12" cy="12" r="2.5"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    // Wave 14h: the three marks the owner added to the bottom bar, drawn like the rest of them.
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 21 21"/>',
    friends: '<circle cx="9" cy="8.5" r="3.6"/><path d="M2.6 20a6.4 6.4 0 0 1 12.8 0"/><path d="M15.8 5.6a3.5 3.5 0 0 1 0 6.1M17.6 20a6.2 6.2 0 0 0-2.1-4.5"/>',
  };
  if (slot === "create") return "+";
  if (!paths[slot]) return fallback;
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths[slot] + '</svg>';
}

// Three of the marks are not places of their own - the drawer of the bar, the search screen and the
// relations - so their names are keys the app already prints elsewhere: the bar reads out a name it
// already had instead of new copy in four languages. Every other mark is named from the `nav.` block.
export const NAV_LABEL_KEYS = Object.freeze({ menu: "header.changeProfile", search: "search.title", friends: "header.friends" });

// The last mark is the reader: the picture of the persona being read, inside the circle the shell already
// draws for a person. It is written inline because the shell counts seven stylesheets to the byte, and a
// persona with no picture keeps the outline it always had.
export function navFaceMarkup({ esc, persona, slot, icon }) {
  if (slot !== "account" || !persona?.avatar) return navIconMarkup(slot, icon);
  return '<img src="' + esc(persona.avatar) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
}
