// Nexus owner profile — the description is text, but a link inside it stays a link.
//
// The description is the one place where an owner can point somewhere else, and it is read as text:
// the lines the owner wrote are kept, and only an explicit `http(s)` address becomes an anchor.
// Escaping happens first and the anchor is built from the escaped text, so what a description can
// produce is always an `http` or `https` href — `javascript:` and `data:` stay plain text.

// A link ends where whitespace or markup starts. The browser decodes the escaped attribute again, so
// a query string keeps reading as `&` on screen while the href carries `&amp;`.
const LINK_PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
  ));
}

// A sentence that ends with a link puts its full stop right after the address: the punctuation
// belongs to the sentence, not to the link. A closing bracket is only taken back while it has no
// opening bracket inside the address, so `.../wiki/Foo_(bar)` keeps its own parenthesis.
function splitTrailingPunctuation(match) {
  let value = match;
  let tail = "";
  for (;;) {
    const last = value.slice(-1);
    if (!last) break;
    if (/[.,;:!?\]}\u2019\u201d\u2026]/.test(last)) { tail = last + tail; value = value.slice(0, -1); continue; }
    if (last === ")" && value.split("(").length < value.split(")").length) {
      tail = last + tail;
      value = value.slice(0, -1);
      continue;
    }
    break;
  }
  return [value, tail];
}

// The description stays text: what comes back is the same text with the addresses turned into
// anchors, so a profile is read exactly as it was written and only the links behave like links.
export function profileBioMarkup(text, esc = escapeHtml) {
  const raw = String(text ?? "");
  if (!raw) return "";
  return esc(raw).replace(LINK_PATTERN, (match) => {
    const [value, tail] = splitTrailingPunctuation(match);
    if (!value) return match;
    const href = /^www\./i.test(value) ? "https://" + value : value;
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + value + '</a>' + tail;
  });
}
