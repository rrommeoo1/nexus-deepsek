/*
 * The two pages an emailed link can open (`verify-email.html`, `reset-password.html`).
 *
 * Same palette as the product (`--teal:#20e0d0`, `--bg:#090e14`), one column, no framework, and no
 * inline script: the CSP in `server.js` allows `script-src 'self'` only, so everything lives here.
 *
 * What these pages promise:
 *   - the token is read from `?token=` and sent to the API in a POST body, never rendered into the
 *     page, never put in a referrer, and cleared from the address bar as soon as it is captured;
 *   - the phone can hand the same token to the installed app (`nexusdev://`), and the page says plainly
 *     when that happened;
 *   - a failure shows the server's own sentence, plus the way to get a fresh link.
 */
(function () {
  'use strict';

  var TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

  function readToken() {
    var params = new URLSearchParams(window.location.search || '');
    var token = String(params.get('token') || '').trim();
    return TOKEN_PATTERN.test(token) ? token : '';
  }

  /** The token leaves the visible URL at once: a screenshot or a shared tab must not carry it. */
  function clearAddressBar() {
    if (!window.history || !window.history.replaceState) return;
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (error) { /* older webviews */ }
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json', Origin: window.location.origin },
      body: JSON.stringify(body || {}),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        return { status: response.status, ok: response.ok, body: payload || {} };
      });
    });
  }

  function element(id) {
    return document.getElementById(id);
  }

  function show(id) {
    var node = element(id);
    if (node) node.hidden = false;
  }

  function hide(id) {
    var node = element(id);
    if (node) node.hidden = true;
  }

  function write(id, text) {
    var node = element(id);
    if (node) node.textContent = String(text == null ? '' : text);
  }

  /** The app deep link for this token. Android resolves `nexusdev://` to the installed dev build. */
  function appLink(route, token) {
    return 'nexusdev://' + route + '?token=' + encodeURIComponent(token);
  }

  function offerApp(route, token) {
    var anchor = element('open-in-app');
    if (!anchor) return;
    if (!token || !/android/i.test(navigator.userAgent || '')) return;
    anchor.href = appLink(route, token);
    anchor.hidden = false;
  }

  /** The "ask for another link" form both pages fall back to. */
  function wireResend(path, statusId) {
    var form = element('resend-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var field = element('resend-email');
      var email = field && field.value ? field.value.trim() : '';
      if (!email) return;
      write(statusId, 'Se trimite…');
      post(path, { email: email }).then(function (result) {
        write(statusId, result.status === 202 || result.ok
          ? 'Dacă adresa are un cont, mesajul a plecat. Verifică inboxul și folderul de spam.'
          : (result.body.error || 'Cererea nu a putut fi trimisă. Încearcă din nou.'));
      }).catch(function () {
        write(statusId, 'Serverul nu a răspuns. Verifică rețeaua și încearcă din nou.');
      });
    });
  }

  window.NexusEmailLink = {
    readToken: readToken,
    clearAddressBar: clearAddressBar,
    post: post,
    show: show,
    hide: hide,
    write: write,
    offerApp: offerApp,
    wireResend: wireResend,
  };
}());
