/* iSKOLEKTIB UI layer: styled dropdowns + interactive gradients.
   Loaded after script.js. Does not change any app data or logic. */
(function () {
  'use strict';

  /* ---------- 1. Styled dropdowns ----------
     The native <select> stays in the page (script.js still reads and writes it);
     a button + listbox replaces what the person sees. Touch devices keep the native picker. */
  var SELECT_IDS = ['hs-course', 'hs-year', 'hs-type', 'f-course', 'f-year', 'f-type', 'm-sort'];
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var pop = null, openCS = null;

  var CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var CHEV = '<svg class="ico cs-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function enhance(id) {
    var sel = document.getElementById(id);
    if (!sel || sel.dataset.cs) return;
    sel.dataset.cs = '1';
    var label = document.querySelector('label[for="' + id + '"]');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cs-btn';
    btn.id = id + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (label) { if (!label.id) label.id = id + '-label'; btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id); label.setAttribute('for', btn.id); }
    btn.innerHTML = '<span class="cs-text"></span>' + CHEV;
    sel.classList.add('cs-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.insertAdjacentElement('afterend', btn);

    var cs = { sel: sel, btn: btn, active: -1, typed: '', typedAt: 0 };
    function sync() {
      var o = sel.options[sel.selectedIndex];
      btn.firstChild.textContent = o ? o.textContent : '';
      btn.classList.toggle('is-placeholder', !sel.value);
      btn.disabled = sel.disabled;
    }
    cs.sync = sync;
    // Programmatic `.value = ...` (used all over script.js) keeps the label in step
    Object.defineProperty(sel, 'value', {
      configurable: true,
      get: function () { return valueDesc.get.call(sel); },
      set: function (v) { valueDesc.set.call(sel, v); sync(); }
    });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    sync();

    btn.addEventListener('click', function () { openCS === cs ? close(true) : open(cs); });
    btn.addEventListener('keydown', function (e) {
      if (openCS === cs) return;
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) > -1) { e.preventDefault(); open(cs); }
    });
  }

  function open(cs) {
    if (openCS) close(false);
    openCS = cs;
    var sel = cs.sel;
    pop = document.createElement('div');
    pop.className = 'cs-pop';
    pop.setAttribute('role', 'listbox');
    pop.id = cs.btn.id + '-list';
    var html = '';
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      html += '<div class="cs-opt' + (i === sel.selectedIndex ? ' is-selected' : '') + (o.value === '' ? ' is-all' : '') + '" role="option" id="' + pop.id + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel.selectedIndex) + '"><span>' + o.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' + CHECK + '</div>';
    }
    pop.innerHTML = html;
    document.body.appendChild(pop);
    cs.btn.setAttribute('aria-expanded', 'true');
    cs.btn.setAttribute('aria-controls', pop.id);
    setActive(Math.max(0, sel.selectedIndex), true);
    place();
    requestAnimationFrame(function () { if (pop) pop.classList.add('is-open'); });

    pop.addEventListener('pointermove', function (e) {
      var o = e.target.closest('.cs-opt');
      if (o) { setActive(Number(o.dataset.i), false); var r = o.getBoundingClientRect(); o.style.setProperty('--mx', (e.clientX - r.left) + 'px'); }
    });
    pop.addEventListener('pointerdown', function (e) { e.preventDefault(); });   // keep focus on the button
    pop.addEventListener('click', function (e) {
      var o = e.target.closest('.cs-opt');
      if (o) choose(Number(o.dataset.i));
    });
  }

  function place() {
    if (!pop || !openCS) return;
    var r = openCS.btn.closest('.hs-field, .field') ? openCS.btn.closest('.hs-field, .field').getBoundingClientRect() : openCS.btn.getBoundingClientRect();
    var vh = window.innerHeight, gap = 8;
    var below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
    var want = Math.min(pop.scrollHeight, 360);
    var up = below < want && above > below;
    var avail = Math.max(160, up ? above : below);
    pop.style.maxHeight = Math.min(360, avail) + 'px';
    var w = Math.max(r.width, 310);
    var left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
    pop.style.width = w + 'px';
    pop.style.left = left + 'px';
    pop.classList.toggle('is-up', up);
    if (up) { pop.style.top = 'auto'; pop.style.bottom = (vh - r.top + gap) + 'px'; }
    else { pop.style.bottom = 'auto'; pop.style.top = (r.bottom + gap) + 'px'; }
  }

  function setActive(i, scroll) {
    if (!pop) return;
    var items = pop.children;
    if (i < 0 || i >= items.length) return;
    if (openCS.active > -1 && items[openCS.active]) items[openCS.active].classList.remove('is-active');
    openCS.active = i;
    items[i].classList.add('is-active');
    openCS.btn.setAttribute('aria-activedescendant', items[i].id);
    if (scroll) items[i].scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    var cs = openCS, sel = cs.sel;
    var changed = sel.selectedIndex !== i;
    sel.selectedIndex = i;
    cs.sync();
    close(true);
    if (changed) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function close(refocus) {
    if (!openCS) return;
    var cs = openCS, p = pop;
    openCS = null; pop = null;
    cs.btn.setAttribute('aria-expanded', 'false');
    cs.btn.removeAttribute('aria-activedescendant');
    cs.btn.removeAttribute('aria-controls');
    if (p) { p.classList.remove('is-open'); setTimeout(function () { p.remove(); }, 120); }
    if (refocus) cs.btn.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!openCS) return;
    var n = pop.children.length, a = openCS.active;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(n - 1, a + 1), true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, a - 1), true); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0, true); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1, true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(a); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {          // type-ahead
      var now = Date.now();
      openCS.typed = (now - openCS.typedAt > 700 ? '' : openCS.typed) + e.key.toLowerCase();
      openCS.typedAt = now;
      for (var k = 0; k < n; k++) {
        if (pop.children[k].textContent.trim().toLowerCase().indexOf(openCS.typed) === 0) { setActive(k, true); break; }
      }
    }
  });
  document.addEventListener('pointerdown', function (e) {
    if (openCS && !e.target.closest('.cs-pop') && !e.target.closest('.cs-btn')) close(false);
  });
  window.addEventListener('resize', function () { close(false); });
  window.addEventListener('scroll', function (e) { if (openCS && !(e.target.closest && e.target.closest('.cs-pop'))) place(); }, { passive: true, capture: true });

  if (!coarse) SELECT_IDS.forEach(enhance);

  /* ---------- 2. Interactive gradients ----------
     Pointer position becomes CSS variables; the stylesheet turns them into glows.
     Only on devices with a real pointer. */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var HOSTS = '.pick, .home-panel, .stat, .quick-btn, .card-grid .card, .welcome, .home-close, .role-card';
  var root = document.documentElement;
  var tick = false, lastEvt = null;

  function onMove() {
    tick = false;
    var e = lastEvt; if (!e) return;
    root.style.setProperty('--gx', (e.clientX / window.innerWidth * 100).toFixed(1) + '%');
    root.style.setProperty('--gy', (e.clientY / window.innerHeight * 100).toFixed(1) + '%');
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var hero = t.closest('.home-hero');
    if (hero) {
      var hr = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - hr.left) / hr.width * 100).toFixed(1) + '%');
      hero.style.setProperty('--my', ((e.clientY - hr.top) / hr.height * 100).toFixed(1) + '%');
    }
    var host = t.closest(HOSTS);
    if (host) {
      var r = host.getBoundingClientRect();
      host.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      host.style.setProperty('--my', (e.clientY - r.top) + 'px');
      host.classList.add('glow');
    }
    var b = t.closest('.btn-gold');
    if (b) {
      var br = b.getBoundingClientRect();
      b.style.setProperty('--bx', ((e.clientX - br.left) / br.width * 100).toFixed(1) + '%');
    }
  }
  if (fine) {
    document.addEventListener('pointermove', function (e) {
      lastEvt = e;
      if (!tick) { tick = true; requestAnimationFrame(onMove); }
    }, { passive: true });
  }

  /* Scroll progress: a thin brand-gradient line at the top of the window */
  var bar = document.createElement('div');
  bar.className = 'scroll-line';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var st = false;
  function prog() {
    st = false;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
  }
  window.addEventListener('scroll', function () { if (!st) { st = true; requestAnimationFrame(prog); } }, { passive: true });
  prog();
})();
