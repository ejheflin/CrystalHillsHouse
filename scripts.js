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
