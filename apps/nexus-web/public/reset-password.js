/* The behaviour of `reset-password.html`: one token, one new hash, one honest answer. */
(function () {
  'use strict';

  var link = window.NexusEmailLink;
  var token = link.readToken();
  var MIN = 8;
  var MAX = 256;

  function fail(message) {
    link.hide('state-form');
    link.hide('state-done');
    link.show('state-failed');
    link.write('failed-message', message || 'Linkul este invalid, a expirat sau a fost deja folosit. Cere unul nou mai jos.');
    link.wireResend('/auth/email/reset-request', 'resend-status');
  }

  if (!token) {
    fail('Linkul nu conține un cod de resetare. Deschide-l din mesajul primit pe email.');
    return;
  }
  link.offerApp('reset-password', token);
  // The token stays in memory only: after this line the address bar no longer carries it.
  link.clearAddressBar();

  var form = document.getElementById('reset-form');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var password = document.getElementById('new-password').value;
    var confirmation = document.getElementById('confirm-password').value;
    var status = document.getElementById('form-status');
    if (password.length < MIN || password.length > MAX) {
      status.className = 'status error';
      link.write('form-status', 'Parola trebuie să aibă între ' + MIN + ' și ' + MAX + ' caractere.');
      return;
    }
    // Byte for byte, exactly as typed: the same rule the phone and the server apply.
    if (password !== confirmation) {
      status.className = 'status error';
      link.write('form-status', 'Cele două parole nu coincid.');
      return;
    }
    status.className = 'status';
    link.write('form-status', 'Se salvează…');
    document.getElementById('submit-button').disabled = true;
    link.post('/auth/email/reset-confirm', { token: token, password: password }).then(function (result) {
      if (!result.ok || !result.body || result.body.ok !== true) {
        document.getElementById('submit-button').disabled = false;
        fail(result.body && result.body.error ? result.body.error : '');
        return;
      }
      link.hide('state-form');
      link.show('state-done');
      link.write('done-handle', result.body.handle
        ? 'Parola contului @' + result.body.handle + ' a fost schimbată, iar sesiunile vechi au fost deconectate.'
        : 'Parola a fost schimbată, iar sesiunile vechi au fost deconectate.');
    }).catch(function () {
      document.getElementById('submit-button').disabled = false;
      status.className = 'status error';
      link.write('form-status', 'Serverul nu a răspuns. Verifică rețeaua și încearcă din nou.');
    });
  });
}());
