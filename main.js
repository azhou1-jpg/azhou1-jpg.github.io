/* Alice Zhou — site behaviour. No dependencies.
   Exposed as window.initSite() because the page content is injected
   after the visitor unlocks it. */
window.initSite = function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */
  var toggle = document.getElementById('theme-toggle');

  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncToggleLabel() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    toggle.setAttribute('title', 'Switch to ' + next + ' theme');
  }

  if (toggle) {
    syncToggleLabel();
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncToggleLabel();
    });
  }

  /* ---------- mobile index menu ---------- */
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('menu-toggle');
  var menuClose = document.getElementById('menu-close');

  function openMenu() {
    menu.hidden = false;
    document.body.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    var first = menu.querySelector('a');
    if (first) first.focus();
  }

  function closeMenu(refocus) {
    menu.hidden = true;
    document.body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (refocus) menuBtn.focus();
  }

  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () {
      if (menu.hidden) { openMenu(); } else { closeMenu(true); }
    });
    if (menuClose) menuClose.addEventListener('click', function () { closeMenu(true); });

    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') { closeMenu(true); return; }
      if (e.key !== 'Tab') return;
      var items = menu.querySelectorAll('a, button');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // If the viewport grows past the mobile breakpoint, don't strand the overlay.
    window.matchMedia('(min-width: 60rem)').addEventListener('change', function (e) {
      if (e.matches && !menu.hidden) closeMenu(false);
    });
  }

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    revealables.forEach(function (el) { io.observe(el); });

    // Safety net: anything on screen but still hidden shortly after init.
    setTimeout(function () {
      revealables.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 400);
  }

  /* ---------- scroll: progress bar, sticky border, active nav ---------- */
  var bar = document.querySelector('.bar');
  var progress = document.getElementById('progress-bar');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-desktop a'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (bar) bar.classList.toggle('stuck', y > 8);

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progress.style.width = (pct * 100) + '%';
    }

    if (sections.length) {
      var marker = y + window.innerHeight * 0.28;
      var active = null;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= marker) active = sections[i];
      }
      // Near the bottom of the page, the last section wins.
      if (y + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        active = sections[sections.length - 1];
      }
      navLinks.forEach(function (a) {
        var match = active && a.getAttribute('href') === '#' + active.id;
        if (match) { a.setAttribute('aria-current', 'true'); }
        else { a.removeAttribute('aria-current'); }
      });
    }

    ticking = false;
  }

  function requestScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }

  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);
  onScroll();
};
