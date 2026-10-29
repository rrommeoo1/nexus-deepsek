/* The behaviour of `verify-email.html`: one confirmation, one honest answer. */
(function () {
  'use strict';

  var link = window.NexusEmailLink;
  var token = link.readToken();

  function fail(message) {
    link.hide('state-working');
    link.hide('state-done');
    link.show('state-failed');
    link.write('failed-message', message || 'Linkul este invalid, a expirat sau a fost deja folosit. Cere unul nou mai jos.');
    link.write('resend-status', '');
    link.wireResend('/auth/email/verification/send', 'resend-status');
  }

  if (!token) {
    fail('Linkul nu conține un cod de confirmare. Deschide-l din mesajul primit pe email.');
    return;
  }
  link.offerApp('verify', token);
  link.clearAddressBar();

  link.post('/auth/email/verification/confirm', { token: token }).then(function (result) {
    if (!result.ok || !result.body || result.body.ok !== true) {
      fail(result.body && result.body.error ? result.body.error : '');
      return;
    }
    link.hide('state-working');
    link.show('state-done');
    link.write('done-handle', result.body.handle
      ? 'Contul @' + result.body.handle + ' este confirmat. Te poți autentifica cu emailul și parola.'
      : 'Contul este confirmat. Te poți autentifica cu emailul și parola.');
  }).catch(function () {
    fail('Serverul nu a răspuns. Verifică rețeaua și deschide linkul din nou.');
  });
}());
