/* Decrypts payload.enc with the visitor's password and swaps it in.
   Matches the scheme written by .src/build.mjs. */
(function () {
  'use strict';

  var ITERATIONS = 250000;
  var form = document.getElementById('gate-form');
  var input = document.getElementById('pw');
  var button = document.getElementById('gate-btn');
  var msg = document.getElementById('gate-msg');

  if (!form || !window.crypto || !window.crypto.subtle) {
    if (msg) msg.textContent = 'This browser can’t decrypt the page. Email me and I’ll send a PDF.';
    return;
  }

  var cached = null;      // the ciphertext, fetched once
  var fetching = null;

  function payload() {
    if (cached) return Promise.resolve(cached);
    if (!fetching) {
      fetching = fetch('/payload.enc', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('payload ' + r.status);
          return r.text();
        })
        .then(function (b64) {
          var bin = atob(b64.trim());
          var bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          cached = bytes;
          return bytes;
        });
    }
    return fetching;
  }

  function decrypt(password) {
    return payload().then(function (bytes) {
      var salt = bytes.slice(0, 16);
      var iv = bytes.slice(16, 28);
      var data = bytes.slice(28);
      var enc = new TextEncoder();

      return crypto.subtle
        .importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
        .then(function (base) {
          return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
          );
        })
        .then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
        })
        .then(function (plain) {
          return new TextDecoder().decode(plain);
        });
    });
  }

  function reveal(html, animate) {
    document.body.className = '';
    document.body.innerHTML = html;
    if (window.initSite) window.initSite();
    if (animate) {
      document.body.classList.add('just-unlocked');
      setTimeout(function () { document.body.classList.remove('just-unlocked'); }, 900);
    }
    // Honour a deep link like /#curious that was used to open the page.
    if (location.hash) {
      var target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
  }

  function attempt(password, animate) {
    button.disabled = true;
    input.setAttribute('aria-invalid', 'false');
    msg.className = 'gate-msg';
    msg.textContent = 'Unlocking…';

    return decrypt(password).then(
      function (html) {
        try { sessionStorage.setItem('key', password); } catch (e) {}
        reveal(html, animate);
      },
      function (err) {
        button.disabled = false;
        msg.className = 'gate-msg is-error';
        if (err && /payload/.test(String(err.message))) {
          msg.textContent = 'Couldn’t load the page contents. Try refreshing.';
        } else {
          msg.textContent = 'That’s not it. Try again.';
          input.setAttribute('aria-invalid', 'true');
          input.select();
        }
      }
    );
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) return;
    attempt(value, true);
  });

  input.addEventListener('input', function () {
    if (msg.classList.contains('is-error')) {
      msg.className = 'gate-msg';
      msg.textContent = '';
      input.setAttribute('aria-invalid', 'false');
    }
  });

  // Already unlocked in this tab: go straight in, no flash of the form.
  var remembered = null;
  try { remembered = sessionStorage.getItem('key'); } catch (e) {}
  if (remembered) {
    document.body.classList.add('resuming');
    decrypt(remembered).then(
      function (html) { reveal(html, false); },
      function () {
        try { sessionStorage.removeItem('key'); } catch (e) {}
        document.body.classList.remove('resuming');
        input.focus();
      }
    );
  } else {
    input.focus();
  }
})();
