// scripts.js — Drag-scrubber behavior

(function () {
  function initScrubber(frame) {
    var staged = frame.querySelector('.scrubber-staged');
    var divider = frame.querySelector('.scrubber-divider');
    var handle = frame.querySelector('.scrubber-handle');
    var position = 50; // percent from left

    function setPosition(percent) {
      position = Math.min(100, Math.max(0, percent));
      staged.style.clipPath = 'inset(0 0 0 ' + position + '%)';
      divider.style.left = position + '%';
      handle.style.left = position + '%';
      frame.setAttribute('aria-valuenow', String(Math.round(position)));
    }

    function fromEvent(event) {
      var rect = frame.getBoundingClientRect();
      var x = event.clientX - rect.left;
      return (x / rect.width) * 100;
    }

    function onPointerDown(event) {
      // Ignore touches that originated on the fullscreen button or any nav button
      if (event.target.closest && (
          event.target.closest('.scrubber-fullscreen-btn') ||
          event.target.closest('.scrubber-prev-btn') ||
          event.target.closest('.scrubber-next-btn'))) return;
      if (event.button !== undefined && event.button !== 0) return;
      // Initiate a drag only if the touch is within ~50px of the current divider
      var rect = frame.getBoundingClientRect();
      var touchX = event.clientX - rect.left;
      var dividerX = (position / 100) * rect.width;
      if (Math.abs(touchX - dividerX) > 50) {
        // Dead-space click — open gallery if not fullscreen, close if fullscreen
        var btn = frame.querySelector('.scrubber-fullscreen-btn');
        if (btn) btn.click();
        return;
      }
      event.preventDefault();
      try { frame.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      frame.focus();
      setPosition(fromEvent(event));
    }

    function onPointerMove(event) {
      if (!frame.hasPointerCapture(event.pointerId)) return;
      setPosition(fromEvent(event));
    }

    function onPointerUp(event) {
      if (frame.hasPointerCapture(event.pointerId)) {
        frame.releasePointerCapture(event.pointerId);
      }
    }

    function onKey(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPosition(position - 5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPosition(position + 5);
      } else if (event.key === 'PageDown') {
        event.preventDefault();
        setPosition(position - 10);
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        setPosition(position + 10);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setPosition(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setPosition(100);
      }
    }

    frame.addEventListener('pointerdown', onPointerDown);
    frame.addEventListener('pointermove', onPointerMove);
    frame.addEventListener('pointerup', onPointerUp);
    frame.addEventListener('pointercancel', onPointerUp);
    frame.addEventListener('keydown', onKey);

    setPosition(50);

    // Wire prev/next buttons in scrubber fullscreen to hand off to lightbox-gallery
    var roomBlock = frame.closest('.room-block');
    var galleryEl = roomBlock ? roomBlock.querySelector('[data-gallery-name]') : null;
    var prevBtn = frame.querySelector('.scrubber-prev-btn');
    var nextBtn = frame.querySelector('.scrubber-next-btn');

    if (!galleryEl) {
      // Room has no thumbnail gallery (e.g., Game Room) — hide prev/next entirely
      frame.classList.add('no-gallery');
    } else {
      function exitAndOpenThumb(targetIndex) {
        var fsBtn = frame.querySelector('.scrubber-fullscreen-btn');
        if (fsBtn) fsBtn.click(); // exit scrubber fullscreen
        var thumbs = galleryEl.querySelectorAll('[data-index]');
        if (thumbs.length === 0) return;
        var idx = targetIndex < 0 ? thumbs.length + targetIndex : targetIndex;
        var thumb = thumbs[idx];
        if (thumb) setTimeout(function () { thumb.click(); }, 50);
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', function (e) { e.stopPropagation(); exitAndOpenThumb(-1); });
        prevBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        prevBtn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function (e) { e.stopPropagation(); exitAndOpenThumb(0); });
        nextBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        nextBtn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      }
    }
  }

  document.querySelectorAll('.scrubber-frame').forEach(initScrubber);
})();

// Scrubber fullscreen toggle (preserves slider functionality at any size)
// On enter: move frame to be a direct child of body (avoids iOS Safari's
// position:fixed-inside-deeply-nested-elements quirks). On exit: restore.
(function () {
  // Per-frame map of where to restore the frame on exit
  var origins = new WeakMap();

  function exit(frame) {
    frame.classList.remove('is-fullscreen');
    document.body.classList.remove('scrubber-fullscreen-active');
    var origin = origins.get(frame);
    if (origin && origin.parent) {
      if (origin.nextSibling && origin.nextSibling.parentNode === origin.parent) {
        origin.parent.insertBefore(frame, origin.nextSibling);
      } else {
        origin.parent.appendChild(frame);
      }
    }
    origins.delete(frame);
    var btn = frame.querySelector('.scrubber-fullscreen-btn');
    if (btn) btn.setAttribute('aria-label', 'View fullscreen');
  }
  function enter(frame) {
    origins.set(frame, { parent: frame.parentNode, nextSibling: frame.nextSibling });
    document.body.appendChild(frame);
    frame.classList.add('is-fullscreen');
    document.body.classList.add('scrubber-fullscreen-active');
    var btn = frame.querySelector('.scrubber-fullscreen-btn');
    if (btn) btn.setAttribute('aria-label', 'Exit fullscreen');
  }

  document.querySelectorAll('.scrubber-frame').forEach(function (frame) {
    var btn = frame.querySelector('.scrubber-fullscreen-btn');
    if (!btn) return;
    // Stop all event bubbling so touches/clicks don't trigger the scrubber drag
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    btn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (frame.classList.contains('is-fullscreen')) exit(frame);
      else enter(frame);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var current = document.querySelector('.scrubber-frame.is-fullscreen');
    if (current) exit(current);
  });
})();

// Lightbox: supports single images and galleries with prev/next + swipe
(function () {
  var lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  var lightboxImg = lightbox.querySelector('img');
  var lightboxCaption = lightbox.querySelector('.lightbox-caption');
  var closeBtn = lightbox.querySelector('.lightbox-close');
  var prevBtn = lightbox.querySelector('.lightbox-prev');
  var nextBtn = lightbox.querySelector('.lightbox-next');
  var lastFocused = null;
  var currentGallery = null;
  var currentIndex = 0;
  var currentScrubber = null; // scrubber-frame for the gallery, if it has one

  function urlFromBackground(el) {
    var bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage;
    var match = bg && bg.match(/url\((['"]?)(.*?)\1\)/);
    return match ? match[2] : null;
  }

  function showImage(src, alt, caption) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    if (lightboxCaption) lightboxCaption.textContent = caption || '';
  }

  function openOverlay() {
    lastFocused = document.activeElement;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    closeBtn.focus();
  }

  function openSingle(src, alt, caption) {
    if (!src) return;
    currentGallery = null;
    currentIndex = 0;
    currentScrubber = null;
    lightbox.classList.remove('gallery-mode');
    showImage(src, alt, caption);
    openOverlay();
  }

  function openGallery(items, startIndex, scrubber) {
    if (!items || !items.length) return;
    currentGallery = items;
    currentIndex = startIndex || 0;
    currentScrubber = scrubber || null;
    lightbox.classList.add('gallery-mode');
    var item = items[currentIndex];
    showImage(item.src, item.alt, item.caption);
    openOverlay();
  }

  function navigate(delta) {
    if (!currentGallery) return;
    var newIdx = currentIndex + delta;
    // If we'd run off either end AND this gallery has a scrubber, hand off to it
    if ((newIdx < 0 || newIdx >= currentGallery.length) && currentScrubber) {
      var scrubber = currentScrubber;
      close();
      var fsBtn = scrubber.querySelector('.scrubber-fullscreen-btn');
      if (fsBtn) setTimeout(function () { fsBtn.click(); }, 50);
      return;
    }
    currentIndex = (newIdx + currentGallery.length) % currentGallery.length;
    var item = currentGallery[currentIndex];
    showImage(item.src, item.alt, item.caption);
  }

  function close() {
    lightbox.classList.remove('open', 'gallery-mode');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImg.src = '';
    currentGallery = null;
    currentScrubber = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // Build gallery registries from data-gallery-name containers
  document.querySelectorAll('[data-gallery-name]').forEach(function (galleryEl) {
    var items = [];
    galleryEl.querySelectorAll('[data-index]').forEach(function (btn) {
      var idx = parseInt(btn.dataset.index, 10);
      var img = btn.querySelector('img');
      if (img) items[idx] = {
        src: img.currentSrc || img.src,
        alt: img.alt,
        caption: btn.dataset.caption || img.alt || ''
      };
    });
    // Detect a scrubber-frame in the same room block so we can hand off at edges
    var roomBlock = galleryEl.closest('.room-block');
    var scrubberFrame = roomBlock ? roomBlock.querySelector('.scrubber-frame') : null;
    galleryEl.querySelectorAll('[data-index]').forEach(function (btn) {
      var idx = parseInt(btn.dataset.index, 10);
      btn.addEventListener('click', function () { openGallery(items, idx, scrubberFrame); });
    });
  });

  // Background-image standalone photos (trail still uses this)
  document.querySelectorAll('.trail-image').forEach(function (el) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'View photo full screen');
    el.addEventListener('click', function () {
      openSingle(urlFromBackground(el), el.getAttribute('aria-label'));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSingle(urlFromBackground(el), el.getAttribute('aria-label'));
      }
    });
  });

  // <img> photos (floor plan)
  document.querySelectorAll('.floor-grid img').forEach(function (img) {
    img.setAttribute('tabindex', '0');
    img.addEventListener('click', function () { openSingle(img.currentSrc || img.src, img.alt); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSingle(img.currentSrc || img.src, img.alt);
      }
    });
  });

  // Close on dead-space click (anything except the photo itself, caption, or nav buttons)
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightboxImg) return;
    if (e.target.closest('.lightbox-caption')) return;
    close();
  });
  closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
  prevBtn.addEventListener('click', function (e) { e.stopPropagation(); navigate(-1); });
  nextBtn.addEventListener('click', function (e) { e.stopPropagation(); navigate(1); });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (currentGallery) {
      if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
    }
  });

  // Touch swipe support for galleries
  var touchStartX = null;
  lightbox.addEventListener('touchstart', function (e) {
    if (!currentGallery) return;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
    touchStartX = null;
  });
})();

// Hamburger nav toggle (mobile)
(function () {
  var navToggle = document.querySelector('.nav-toggle');
  var primaryNav = document.querySelector('#primary-nav');
  if (!navToggle || !primaryNav) return;

  navToggle.addEventListener('click', function () {
    var open = primaryNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  // Close menu when an anchor is clicked
  primaryNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      primaryNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// Open house teaser strip — state derivation (pure)
(function () {
  // Config: append future open houses here, chronologically.
  var OPEN_HOUSES = [
    { start: '2026-05-16T13:00:00-05:00', end: '2026-05-16T16:00:00-05:00' }
  ];

  var GMAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('1406 Crystal Hills Drive, Houston, TX 77077');

  // Extract { y, m, d } for a Date in America/Chicago (Houston local time).
  // Uses Intl.DateTimeFormat so the result is correct regardless of the
  // visitor's own timezone.
  function houstonYMD(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    var y = 0, m = 0, d = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'year')  { y = parseInt(p.value, 10); }
      if (p.type === 'month') { m = parseInt(p.value, 10); }
      if (p.type === 'day')   { d = parseInt(p.value, 10); }
    }
    return { y: y, m: m, d: d };
  }

  // Whole-day delta between two YMD objects: returns (a - b) in whole days.
  // Builds UTC timestamps from the YMD parts to avoid any DST distortion.
  function dayDelta(a, b) {
    var ua = Date.UTC(a.y, a.m - 1, a.d);
    var ub = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((ua - ub) / 86400000);
  }

  // Format "Saturday, May 16" in Houston local time.
  function formatFullDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(date);
  }

  // Format "This Saturday" — weekday name from Houston local time, prefixed with "This ".
  function formatNearWeekday(date) {
    var weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', weekday: 'long'
    }).format(date);
    return 'This ' + weekday;
  }

  // Return the first event in the array whose end > now, or null if none.
  // Assumes events are in chronological order (per config convention).
  function pickEvent(events, now) {
    if (!events || events.length === 0) return null;
    var nowMs = now.getTime();
    for (var i = 0; i < events.length; i++) {
      if (new Date(events[i].end).getTime() > nowMs) return events[i];
    }
    return null;
  }

  // Pure state-derivation function.
  // Returns one of: null | {state, eyebrow, phrase, linkText, linkHref}
  function getOpenHouseState(events, now) {
    var ev = pickEvent(events, now);
    if (!ev) return null;

    var start = new Date(ev.start);
    var end   = new Date(ev.end);
    var nowMs = now.getTime();

    // Live: now is inside the open-house window
    if (nowMs >= start.getTime() && nowMs < end.getTime()) {
      return {
        state:    'live',
        eyebrow:  'OPEN NOW',
        phrase:   'Until 4 PM today',
        linkText: 'Get directions',
        linkHref: GMAPS_URL
      };
    }

    // All pre-event states are determined by the Houston-local calendar-day gap
    var delta = dayDelta(houstonYMD(start), houstonYMD(now));

    if (delta === 0) {
      return {
        state:    'today',
        eyebrow:  'OPEN HOUSE',
        phrase:   'Today \xb7 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    if (delta === 1) {
      return {
        state:    'tomorrow',
        eyebrow:  'OPEN HOUSE',
        phrase:   'Tomorrow \xb7 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    if (delta >= 2 && delta <= 6) {
      return {
        state:    'near',
        eyebrow:  'OPEN HOUSE',
        phrase:   formatNearWeekday(start) + ' \xb7 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    // delta >= 7
    return {
      state:    'future',
      eyebrow:  'OPEN HOUSE',
      phrase:   formatFullDate(start) + ' \xb7 1–4 PM',
      linkText: 'Plan a visit',
      linkHref: '#showing'
    };
  }

  // Expose the pure state function for the browser test page.
  window.__ohGetState = getOpenHouseState;

  // --- Render / dismiss ---

  var DISMISS_KEY = 'openHouseDismissed';
  var REFRESH_MS = 30 * 1000;

  var stripEl = null;
  var refreshTimer = null;
  var lastState = null;
  var stripResizeObserver = null;

  function updateStripHeight() {
    if (!stripEl) return;
    document.documentElement.style.setProperty('--oh-strip-height', stripEl.offsetHeight + 'px');
  }

  function buildStrip(stateObj) {
    var wrap = document.createElement('div');
    wrap.className = 'oh-strip';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Open house announcement');

    var inner = document.createElement('div');
    inner.className = 'oh-strip-inner';

    var eyebrow = document.createElement('span');
    eyebrow.className = 'oh-strip-eyebrow';
    eyebrow.textContent = stateObj.eyebrow;

    var phrase = document.createElement('span');
    phrase.className = 'oh-strip-phrase';
    phrase.setAttribute('aria-live', 'polite');
    phrase.textContent = stateObj.phrase;

    var link = document.createElement('a');
    link.className = 'oh-strip-link';
    link.href = stateObj.linkHref;
    var linkLabel = document.createElement('span');
    linkLabel.className = 'oh-strip-link-label';
    linkLabel.textContent = stateObj.linkText + ' ';
    link.appendChild(linkLabel);
    var arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.appendChild(arrow);

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'oh-strip-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss open house announcement');
    dismiss.textContent = '\xd7';
    dismiss.addEventListener('click', onDismiss);

    inner.appendChild(eyebrow);
    inner.appendChild(phrase);
    inner.appendChild(link);
    inner.appendChild(dismiss);
    wrap.appendChild(inner);
    return wrap;
  }

  function applyStateUpdate(newState) {
    if (!stripEl || !newState) return;
    stripEl.querySelector('.oh-strip-eyebrow').textContent = newState.eyebrow;
    stripEl.querySelector('.oh-strip-phrase').textContent = newState.phrase;
    var link = stripEl.querySelector('.oh-strip-link');
    link.querySelector('.oh-strip-link-label').textContent = newState.linkText + ' ';
    link.href = newState.linkHref;
  }

  function onDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* private mode */ }
    removeStrip();
  }

  function removeStrip() {
    document.documentElement.style.removeProperty('--oh-strip-height');
    if (stripResizeObserver) {
      stripResizeObserver.disconnect();
      stripResizeObserver = null;
    }
    window.removeEventListener('resize', updateStripHeight);
    if (stripEl && stripEl.parentNode) stripEl.parentNode.removeChild(stripEl);
    stripEl = null;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  function stateChanged(a, b) {
    if (!a || !b) return a !== b;
    return a.state !== b.state
      || a.phrase !== b.phrase
      || a.eyebrow !== b.eyebrow
      || a.linkText !== b.linkText
      || a.linkHref !== b.linkHref;
  }

  function refresh() {
    var next = getOpenHouseState(OPEN_HOUSES, new Date());
    if (!next) { removeStrip(); return; }
    if (stateChanged(lastState, next)) {
      applyStateUpdate(next);
      lastState = next;
    }
  }

  function init() {
    // Require .topnav so the test page (no nav) doesn't render a stray strip during pure-function tests.
    if (!document.body || !document.querySelector('header.topnav')) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch (e) { /* private mode — fall through and render */ }

    var state = getOpenHouseState(OPEN_HOUSES, new Date());
    if (!state) return;

    lastState = state;
    stripEl = buildStrip(state);
    // Insert before the topnav (not at body.firstChild) so the skip-link
    // stays as the first focusable element in tab order.
    var topnav = document.querySelector('header.topnav');
    document.body.insertBefore(stripEl, topnav);

    updateStripHeight();
    if (typeof ResizeObserver !== 'undefined') {
      stripResizeObserver = new ResizeObserver(updateStripHeight);
      stripResizeObserver.observe(stripEl);
    }
    window.addEventListener('resize', updateStripHeight);

    refreshTimer = setInterval(refresh, REFRESH_MS);
  }

  // Escape-key dismiss, but only when the scrubber and lightbox are NOT open.
  // Capture phase so we observe the scrubber/lightbox open state BEFORE their
  // handlers (registered in bubble phase) synchronously close them on Escape.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!stripEl) return;
    if (document.querySelector('.scrubber-frame.is-fullscreen')) return;
    var lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('open')) return;
    onDismiss();
  }, true);

  // Run now (script is deferred, so DOM is parsed) or wait if not.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
