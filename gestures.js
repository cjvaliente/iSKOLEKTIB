/* =====================================================================
   iSKOLEKTIB - gestures.js
   Add AFTER script.js:  <script src="gestures.js"></script>
   Does not edit script.js. It only reads and toggles the same classes
   script.js already uses (.open / .show / .hidden).

   - Phone nav drawer: swipe from the left edge, or drag it open/closed.
     It follows the finger 1:1. On release it keeps the finger's velocity
     and settles with a spring, so it never jumps when let go halfway.
   - Phone modals become bottom sheets: drag the handle down to dismiss,
     with rubber-banding and a velocity-aware spring on release.
   - Buttons that close things (X, backdrop, menu) animate too.
   - Honors prefers-reduced-motion (jumps straight to the end state).

   Springs (mass 1):
     drawer         stiffness 420, damping 41  (critically damped, no wobble)
     sheet dismiss  stiffness 300, damping 35  (critically damped)
     sheet snap-back stiffness 420, damping 32 (a hint of bounce)
   ===================================================================== */
(function () {
  'use strict';

  var mqMobile = window.matchMedia('(max-width: 900px)');
  var mqPhone = window.matchMedia('(max-width: 600px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, root) { return (root || document).querySelector(sel); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ---------- A small spring solver (fixed time step, velocity carries over) ---------- */
  function spring(o) {
    var x = o.from, v = o.velocity || 0;
    var DT = 1 / 120, acc = 0, last = null, raf = 0, dead = false;
    function finish() { x = o.to; o.onUpdate(x); if (o.onDone) o.onDone(); }
    function frame(t) {
      if (dead) return;
      if (last === null) last = t;
      acc += Math.min((t - last) / 1000, 0.064);
      last = t;
      while (acc >= DT) {
        v += (-o.stiffness * (x - o.to) - o.damping * v) * DT;
        x += v * DT;
        acc -= DT;
        if (o.min !== undefined && x < o.min) { x = o.min; if (v < 0) v = 0; }
        if (o.max !== undefined && x > o.max) { x = o.max; if (v > 0) v = 0; }
      }
      var done = o.until ? o.until(x) : (Math.abs(x - o.to) < 0.5 && Math.abs(v) < 10);
      if (done) { finish(); return; }
      o.onUpdate(x);
      raf = requestAnimationFrame(frame);
    }
    o.onUpdate(x);
    raf = requestAnimationFrame(frame);
    return { cancel: function () { dead = true; cancelAnimationFrame(raf); } };
  }

  /* ---------- Velocity from the last ~100ms of pointer movement ---------- */
  function Tracker() { this.pts = []; }
  Tracker.prototype.add = function (p, t) {
    this.pts.push({ p: p, t: t });
    while (this.pts.length > 2 && t - this.pts[0].t > 100) this.pts.shift();
  };
  Tracker.prototype.velocity = function () {   // px per second
    var a = this.pts[0], b = this.pts[this.pts.length - 1];
    if (!a || a === b) return 0;
    var dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.p - a.p) / dt : 0;
  };

  /* iOS-style resistance when pulled past a limit */
  function rubber(dist, dim) { return (1 - 1 / ((dist * 0.55) / dim + 1)) * dim; }

  var suppressUntil = 0;   // swallow the click that follows a drag
  var bypass = false;      // lets our own re-dispatched clicks through

  /* =====================================================================
     DRAWER
     ===================================================================== */
  var sidebar = $('#sidebar');
  var backdrop = $('#backdrop');
  var drawerAnim = null, drawerX = 0, drawerTarget = false;

  var edge = document.createElement('div');
  edge.className = 'edge-swipe';
  document.body.appendChild(edge);

  function drawerW() { return sidebar.offsetWidth; }
  function isOpen() { return sidebar.classList.contains('open'); }

  function setDrawerX(x) {
    drawerX = x;
    sidebar.style.transform = 'translate3d(' + x + 'px,0,0)';
    backdrop.style.opacity = String(clamp(1 + x / drawerW(), 0, 1));
  }
  function beginDrawer(x) {
    sidebar.style.transition = 'none';
    backdrop.style.animation = 'none';
    setDrawerX(x);                       // position first, then reveal
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  }
  function settleDrawer(open) {
    sidebar.style.transition = 'none';
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    sidebar.style.transform = '';        // CSS state now equals where we stopped
    backdrop.style.opacity = '';
    requestAnimationFrame(function () { sidebar.style.transition = ''; });
  }
  function stopDrawer() { if (drawerAnim) { drawerAnim.cancel(); drawerAnim = null; } }

  function animateDrawer(open, x0, v0) {
    stopDrawer();
    drawerTarget = open;
    if (reduce.matches) { settleDrawer(open); return; }
    var w = drawerW();
    beginDrawer(x0);
    drawerAnim = spring({
      from: x0, to: open ? 0 : -w, velocity: v0,
      stiffness: 420, damping: 41, min: -w, max: 0,
      onUpdate: setDrawerX,
      onDone: function () { drawerAnim = null; settleDrawer(open); }
    });
  }

  var dDrag = null;

  document.addEventListener('pointerdown', function (e) {
    if (!mqMobile.matches || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ($('.modal:not(.hidden)')) return;
    var t = e.target;
    var onEdge = t === edge;
    var onDrawer = (isOpen() || drawerAnim) && (sidebar.contains(t) || t === backdrop);
    if (!onEdge && !onDrawer) return;

    var w = drawerW();
    var stopped = !!drawerAnim;
    var x0 = drawerAnim ? drawerX : (isOpen() ? 0 : -w);
    stopDrawer();                         // touching it stops it, like iOS
    dDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x0, active: false, stopped: stopped, tr: new Tracker(), target: t };
  });

  document.addEventListener('pointermove', function (e) {
    var d = dDrag;
    if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { endDrawerDrag(false); return; }   // vertical scroll wins
      if (Math.abs(dx) < 6) return;
      d.active = true;
      beginDrawer(d.x0);
      try { d.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var x = clamp(d.x0 + dx, -drawerW(), 0);
    setDrawerX(x);
    d.tr.add(x, e.timeStamp);
  });

  function endDrawerDrag(release) {
    var d = dDrag;
    dDrag = null;
    if (!d) return;
    if (d.active && release) {
      suppressUntil = performance.now() + 350;
      var v = d.tr.velocity();
      var projected = drawerX + v * 0.18;                 // where momentum would carry it
      animateDrawer(projected > -drawerW() * 0.5, drawerX, v);
    } else if (d.active) {
      animateDrawer(drawerX > -drawerW() * 0.5, drawerX, 0);
    } else if (d.stopped) {
      animateDrawer(drawerTarget, d.x0, 0);               // a tap during motion: carry on
    }
  }
  document.addEventListener('pointerup', function (e) { if (dDrag && e.pointerId === dDrag.id) endDrawerDrag(true); });
  document.addEventListener('pointercancel', function (e) { if (dDrag && e.pointerId === dDrag.id) endDrawerDrag(false); });

  /* =====================================================================
     BOTTOM SHEETS (phones)
     ===================================================================== */
  var sheetAnim = null, sheetY = 0, sDrag = null;

  function addGrabHandles() {
    document.querySelectorAll('.modal-box').forEach(function (box) {
      if ($('.sheet-grab', box)) return;
      var g = document.createElement('div');
      g.className = 'sheet-grab';
      g.setAttribute('aria-hidden', 'true');
      box.insertBefore(g, box.firstChild);
    });
  }
  addGrabHandles();

  function setSheet(box, modal, y, H) {
    sheetY = y;
    box.style.transform = 'translate3d(0,' + y + 'px,0)';
    modal.style.backgroundColor = 'rgba(29,23,38,' + (0.5 * (1 - clamp(y / H, 0, 1))).toFixed(3) + ')';
  }
  function prepSheet(box) { box.style.animation = 'none'; }
  function resetSheet(box, modal) {
    box.style.transform = '';
    box.style.animation = '';
    modal.style.backgroundColor = '';
  }

  function dismissSheet(modal, box, trigger, y0, v0) {
    var H = box.offsetHeight;
    prepSheet(box);
    sheetAnim = spring({
      from: y0, to: H + 40, velocity: v0,
      stiffness: 300, damping: 35,
      until: function (y) { return y >= H; },
      onUpdate: function (y) { setSheet(box, modal, y, H); },
      onDone: function () {
        sheetAnim = null;
        bypass = true; trigger.click(); bypass = false;     // script.js closes it as usual
        resetSheet(box, modal);
      }
    });
  }
  function snapSheetBack(modal, box, y0, v0) {
    var H = box.offsetHeight;
    prepSheet(box);
    sheetAnim = spring({
      from: y0, to: 0, velocity: v0,
      stiffness: 420, damping: 32,
      onUpdate: function (y) { setSheet(box, modal, y, H); },
      onDone: function () { sheetAnim = null; resetSheet(box, modal); }
    });
  }

  document.addEventListener('pointerdown', function (e) {
    if (!mqPhone.matches || !e.isPrimary) return;
    var grab = e.target.closest && e.target.closest('.sheet-grab');
    if (!grab) return;
    var modal = grab.closest('.modal'), box = grab.closest('.modal-box');
    if (!modal || !box) return;
    var y0 = 0;
    if (sheetAnim) { sheetAnim.cancel(); sheetAnim = null; y0 = sheetY; }
    sDrag = { id: e.pointerId, sy: e.clientY, y0: y0, modal: modal, box: box, grab: grab, active: false, tr: new Tracker() };
  });

  document.addEventListener('pointermove', function (e) {
    var d = sDrag;
    if (!d || e.pointerId !== d.id) return;
    var dy = e.clientY - d.sy;
    if (!d.active) {
      if (Math.abs(dy) < 4) return;
      d.active = true;
      prepSheet(d.box);
      try { d.grab.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var raw = d.y0 + dy, H = d.box.offsetHeight;
    var y = raw >= 0 ? raw : -rubber(-raw, 120);        // resist when pulled up
    setSheet(d.box, d.modal, y, H);
    d.tr.add(y, e.timeStamp);
  });

  function endSheetDrag(release) {
    var d = sDrag;
    sDrag = null;
    if (!d) return;
    if (!d.active) return;
    suppressUntil = performance.now() + 350;
    var H = d.box.offsetHeight;
    var v = release ? d.tr.velocity() : 0;
    var projected = sheetY + v * 0.18;
    var close = projected > H * 0.4 || v > 900;
    if (close && !reduce.matches) {
      dismissSheet(d.modal, d.box, $('.modal-close', d.box) || d.modal, sheetY, v);
    } else if (close) {
      resetSheet(d.box, d.modal);
      bypass = true; ($('.modal-close', d.box) || d.modal).click(); bypass = false;
    } else {
      snapSheetBack(d.modal, d.box, sheetY, v);
    }
  }
  document.addEventListener('pointerup', function (e) { if (sDrag && e.pointerId === sDrag.id) endSheetDrag(true); });
  document.addEventListener('pointercancel', function (e) { if (sDrag && e.pointerId === sDrag.id) endSheetDrag(false); });

  /* =====================================================================
     CLICKS: menu button / backdrop / close buttons get the same motion
     (capture phase, so script.js only sees the click when we let it)
     ===================================================================== */
  document.addEventListener('click', function (e) {
    if (bypass) return;
    var t = e.target;
    if (!t || !t.closest) return;

    // Drawer toggle (menu button and backdrop)
    if (mqMobile.matches && t.closest('[data-action="toggle-menu"]')) {
      e.preventDefault(); e.stopPropagation();
      if (performance.now() < suppressUntil) return;
      if (drawerAnim) animateDrawer(!drawerTarget, drawerX, 0);
      else if (isOpen()) animateDrawer(false, 0, 0);
      else animateDrawer(true, -drawerW(), 0);
      return;
    }

    // Sheet close (X button, "Close" buttons, tapping outside) on phones
    if (mqPhone.matches && !reduce.matches) {
      var closer = t.closest('.modal-close, [data-action="close-modal"], [data-action="close-preview"]');
      var backdropTap = t.classList && t.classList.contains('modal') ? t : null;
      var trigger = closer || backdropTap;
      if (!trigger) return;
      var modal = trigger.closest('.modal');
      var box = modal && $('.modal-box', modal);
      if (!modal || !box || modal.classList.contains('hidden')) return;
      e.preventDefault(); e.stopPropagation();
      if (performance.now() < suppressUntil || sheetAnim) return;
      dismissSheet(modal, box, trigger, 0, 0);
    }
  }, true);
})();
