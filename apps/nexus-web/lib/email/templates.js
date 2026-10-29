/**
 * The four messages this product sends, as plain data: `{ subject, html, text, link }`.
 *
 * Written by hand for the clients people actually read mail in: one 600 px column, tables instead of
 * flexbox (Outlook), inline styles (Gmail strips `<style>`), no web font, no tracking pixel, no
 * remote image — a message that renders the same in a phone's preview line and in a desktop client.
 * Every message carries the link as text as well as a button, because a button can be stripped and a
 * link cannot. Nothing here reads a secret: a caller passes the already-built link and the expiry.
 */
const BRAND = {
  bg: "#090e14",
  panel: "#131c26",
  line: "#243444",
  text: "#eff4fa",
  muted: "#95a5b7",
  accent: "#20e0d0",
  accentInk: "#04211f",
  footer: "#6c7c8c",
};

export const EMAIL_KINDS = Object.freeze(["verify_email", "reset_password", "password_changed", "email_changed"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The one place a URL enters HTML: already-encoded query, escaped for the attribute. */
function safeHref(value) {
  const raw = String(value ?? "");
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(raw)) return "";
  return escapeHtml(raw);
}

function layout({ preheader, heading, intro, buttonLabel, link, after, footer }) {
  const href = safeHref(link);
  const button = href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px">
        <tr><td align="center" bgcolor="${BRAND.accent}" style="border-radius:12px">
          <a href="${href}" style="display:inline-block;padding:15px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${BRAND.accentInk};text-decoration:none;border-radius:12px">${escapeHtml(buttonLabel)}</a>
        </td></tr>
      </table>`
    : "";
  const fallback = href
    ? `<p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted}">
        Dacă butonul nu funcționează, copiază adresa în browser:<br />
        <span style="color:${BRAND.accent};word-break:break-all">${href}</span>
      </p>`
    : "";
  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:18px">
      <tr><td style="padding:28px 26px 6px">
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.accent}">Jungle Book · Nexus</p>
        <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:29px;color:${BRAND.text}">${escapeHtml(heading)}</h1>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:${BRAND.text}">${intro}</p>
        ${button}
        ${fallback}
        <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted}">${after}</p>
      </td></tr>
      <tr><td style="padding:16px 26px 24px;border-top:1px solid ${BRAND.line}">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.footer}">${footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function greeting(handle) {
  const clean = String(handle ?? "").trim();
  if (!clean) return "Salut!";
  return `Salut, @${escapeHtml(clean.replace(/^@/, ""))}!`;
}

function humanDuration(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return "câteva minute";
  // Romanian inserts "de" from twenty up ("30 de minute"); the reset link says exactly 30.
  const count = (n, one, unit) => (n === 1 ? one : (n >= 20 ? `${n} de ${unit}` : `${n} ${unit}`));
  if (value % (60 * 24) === 0) return count(value / (60 * 24), "24 de ore", "zile");
  if (value % 60 === 0) return count(value / 60, "o oră", "ore");
  return count(value, "un minut", "minute");
}

function supportLine(support) {
  return support
    ? `Nu ai cerut tu? Scrie-ne la ${escapeHtml(support)} și ignoră mesajul.`
    : "Nu ai cerut tu? Ignoră mesajul: fără confirmare, nimic nu se schimbă.";
}

/** Link targets are fixed paths on the deployment that sent the mail; a token is the only variable. */
export function emailLink(origin, page, token) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  return `${base}/${page}?token=${encodeURIComponent(String(token ?? ""))}`;
}

/**
 * The messages. `ctx` is `{ origin, token, handle, minutes, support }`; every kind returns the same
 * shape so the caller never has to know which template it chose.
 */
export function renderEmail(kind, ctx = {}) {
  const handle = String(ctx.handle ?? "").replace(/^@/, "");
  const support = String(ctx.support ?? "");
  const minutes = Number(ctx.minutes ?? 60);
  const link = ctx.link || emailLink(ctx.origin, kind === "verify_email" ? "verify-email.html" : "reset-password.html", ctx.token);
  const expire = humanDuration(minutes);

  if (kind === "verify_email") {
    return {
      kind,
      subject: "Confirmă adresa de email pentru Nexus",
      link,
      html: layout({
        preheader: `Linkul expiră în ${expire}.`,
        heading: "Confirmă-ți adresa de email",
        intro: `${greeting(handle)} Bine ai venit în Jungle Book. Confirmă adresa ca să-ți poți recupera contul dacă uiți parola.`,
        buttonLabel: "Confirmă adresa",
        link,
        after: `Linkul expiră în <strong style="color:${BRAND.text}">${escapeHtml(expire)}</strong> și poate fi folosit o singură dată. ${supportLine(support)}`,
        footer: "Mesaj automat de la Jungle Book. Confirmarea nu îți schimbă parola și nu îți creează un portofel.",
      }),
      text: [
        `${handle ? `Salut, @${handle}!` : "Salut!"} Bine ai venit în Jungle Book.`,
        "",
        "Confirmă adresa de email ca să-ți poți recupera contul dacă uiți parola:",
        link,
        "",
        `Linkul expiră în ${expire} și poate fi folosit o singură dată.`,
        "Nu ai cerut tu? Ignoră mesajul: fără confirmare, nimic nu se schimbe.",
        support ? `Suport: ${support}` : "",
        "",
        "Mesaj automat de la Jungle Book.",
      ].filter(Boolean).join("\n"),
    };
  }

  if (kind === "reset_password") {
    return {
      kind,
      subject: "Resetează parola Nexus",
      link,
      html: layout({
        preheader: `Linkul expiră în ${expire}.`,
        heading: "Setează o parolă nouă",
        intro: `${greeting(handle)} Am primit o cerere de resetare a parolei pentru contul tău. Alege o parolă nouă de minimum 8 caractere.`,
        buttonLabel: "Alege parola nouă",
        link,
        after: `Linkul expiră în <strong style="color:${BRAND.text}">${escapeHtml(expire)}</strong>, poate fi folosit o singură dată, iar toate sesiunile deschise vor fi deconectate după schimbare. ${supportLine(support)}`,
        footer: "Mesaj automat de la Jungle Book. Nimeni din echipă nu îți va cere parola, nici prin email, nici prin telefon.",
      }),
      text: [
        `${handle ? `Salut, @${handle}!` : "Salut!"}`,
        "",
        "Am primit o cerere de resetare a parolei pentru contul tău Nexus. Alege o parolă nouă:",
        link,
        "",
        `Linkul expiră în ${expire} și poate fi folosit o singură dată.`,
        "După schimbare, toate sesiunile deschise sunt deconectate.",
        "Nu ai cerut tu? Ignoră mesajul; parola rămâne neschimbată.",
        support ? `Suport: ${support}` : "",
        "",
        "Mesaj automat de la Jungle Book.",
      ].filter(Boolean).join("\n"),
    };
  }

  if (kind === "password_changed") {
    return {
      kind,
      subject: "Parola Nexus a fost schimbată",
      link: "",
      html: layout({
        preheader: "Dacă nu ai schimbat tu parola, cere imediat un link de resetare.",
        heading: "Parola ta a fost schimbată",
        intro: `${greeting(handle)} Parola contului tău Nexus a fost schimbată, iar toate celelalte sesiuni au fost deconectate. Te poți autentifica deja cu parola nouă.`,
        buttonLabel: "",
        link: "",
        after: `Dacă nu ai schimbat tu parola, cere imediat un link nou din „Ai uitat parola?”. ${supportLine(support)}`,
        footer: "Mesaj automat de la Jungle Book. Din motive de securitate, acest mesaj nu conține niciun link de resetare.",
      }),
      text: [
        `${handle ? `Salut, @${handle}!` : "Salut!"}`,
        "",
        "Parola contului tău Nexus a fost schimbată și toate celelalte sesiuni au fost deconectate.",
        "Dacă nu ai schimbat tu parola, cere imediat un link nou din „Ai uitat parola?”.",
        support ? `Suport: ${support}` : "",
        "",
        "Mesaj automat de la Jungle Book.",
      ].filter(Boolean).join("\n"),
    };
  }

  if (kind === "email_changed") {
    return {
      kind,
      subject: "Adresa de email a contului Nexus a fost schimbată",
      link: "",
      html: layout({
        preheader: "Adresa nouă trebuie confirmată din mesajul trimis pe ea.",
        heading: "Adresa de email a fost schimbată",
        intro: `${greeting(handle)} Adresa contului tău Nexus a fost schimbată. Mesajele de securitate merg de acum la adresa nouă, iar cea veche nu mai poate recupera contul.`,
        buttonLabel: "",
        link: "",
        after: `Dacă nu ai schimbat tu adresa, scrie-ne imediat. ${supportLine(support)}`,
        footer: "Mesaj automat de la Jungle Book.",
      }),
      text: [
        `${handle ? `Salut, @${handle}!` : "Salut!"}`,
        "",
        "Adresa de email a contului tău Nexus a fost schimbată; mesajele de securitate merg la adresa nouă.",
        "Dacă nu ai schimbat tu adresa, scrie-ne imediat.",
        support ? `Suport: ${support}` : "",
        "",
        "Mesaj automat de la Jungle Book.",
      ].filter(Boolean).join("\n"),
    };
  }

  throw new Error(`email template necunoscut: ${String(kind)}`);
}
