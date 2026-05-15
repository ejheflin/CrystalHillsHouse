# Open House Teaser Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky, dismissible open-house announcement strip above the topnav with adaptive labels (Future → Near → Tomorrow → Today → Live → Past), session-scoped dismissal, and a config-driven event list.

**Architecture:** Pure-vanilla JS strip rendered into the DOM by `scripts.js` (deferred) at page load. A single `OPEN_HOUSES` config array drives which event is shown. A pure state-derivation function (`getOpenHouseState`) is the only thing under test — everything else is straightforward DOM wiring. Styling reuses existing `:root` design tokens; no new tokens introduced. CSS-only mobile layout switch at 640px.

**Tech Stack:** Vanilla JavaScript (ES5-compatible IIFE style matching existing `scripts.js`), vanilla CSS using existing custom properties, no build step, no test framework. Verification is done via a standalone browser-loadable test page (`docs/superpowers/tools/open-house-state-tests.html`) for the pure state function and a manual QA matrix for visual/behavioral checks.

**Spec:** `docs/superpowers/specs/2026-05-15-open-house-teaser-design.md`

**Tested Browsers (manual):** Chrome (Win), Safari (iOS), Firefox latest. Site already supports these.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `scripts.js` | Modify (append new IIFE near end) | `OPEN_HOUSES` config; `getOpenHouseState()` pure function; strip render/mount/dismiss logic; refresh interval; Escape-key handler |
| `style.css` | Modify (append new section near end) | `.oh-strip` and child element styles, including `@media (max-width: 640px)` two-row layout |
| `index.html` | No change | Strip is JS-injected; nothing required here |
| `docs/superpowers/tools/open-house-state-tests.html` | Create | Browser-loadable test runner that exercises `getOpenHouseState` across all 6 states using mocked "now" values |

Why these boundaries:
- The pure state function is the only piece with branching logic worth isolating. Keeping it pure (no DOM, no globals) makes it trivially testable.
- The rest of the JS (DOM building, sessionStorage, event listeners) is mechanical and verified by manual QA.
- Putting the test runner inside `docs/superpowers/tools/` keeps the project root clean and matches the existing convention of using `docs/superpowers/` for plan/spec material.

---

## Task 1: Pure state-derivation function + test page

**Goal:** Build and verify the pure function that takes `(events, now)` and returns the strip's render state, with all 6 state transitions correct including local-calendar-day comparisons across month/year boundaries.

**Files:**
- Create: `docs/superpowers/tools/open-house-state-tests.html`
- Modify: `scripts.js` (append new IIFE; expose `window.__ohGetState` for tests in dev)

**Acceptance Criteria:**
- [ ] `getOpenHouseState(events, now)` is a pure function: same inputs always produce same outputs, no side effects.
- [ ] Returns `null` when `events` is empty or every event's `end` is `≤ now`.
- [ ] Returns `{ state: 'live', eyebrow: 'OPEN NOW', phrase: 'Until 4 PM today', linkText: 'Get directions', linkHref: '<google maps url>' }` when `start ≤ now < end`.
- [ ] Returns `state: 'today'` with phrase `'Today · 1–4 PM'` when `start` is on the same Houston-local calendar day as `now` and `now < start`.
- [ ] Returns `state: 'tomorrow'` with phrase `'Tomorrow · 1–4 PM'` when `start` is on the local calendar day immediately following `now`'s local day.
- [ ] Returns `state: 'near'` with phrase like `'This Saturday · 1–4 PM'` when start is 2–6 local days after `now`.
- [ ] Returns `state: 'future'` with phrase like `'Saturday, May 16 · 1–4 PM'` (full locale-formatted date + en-dash time range) when start is 7+ local days after now.
- [ ] Calendar-day comparison works correctly across month boundaries (e.g., now=2026-05-31 18:00 CDT, start=2026-06-01 13:00 CDT → `tomorrow`) and year boundaries (e.g., now=2026-12-31 18:00 CST, start=2027-01-01 13:00 CST → `tomorrow`).
- [ ] Calendar-day comparison reflects Houston local time regardless of visitor timezone (e.g., a visitor in Tokyo at 2026-05-16 14:00 JST sees `today` because in Houston it's 2026-05-16 00:00 CDT).
- [ ] When multiple future events are in the config, only the earliest non-past event is used.
- [ ] All test assertions in `open-house-state-tests.html` pass when the file is opened in a browser.

**Verify:** Open `docs/superpowers/tools/open-house-state-tests.html` in any browser. The page should show a green "All N tests passed" summary at the top. Any failure is rendered inline with the expected vs. actual values.

**Steps:**

- [ ] **Step 1: Create the test runner page (the failing test)**

Create `docs/superpowers/tools/open-house-state-tests.html` with the following content. This page intentionally fails initially because `__ohGetState` does not exist yet.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Open House State Tests</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    h1 { margin: 0 0 16px; }
    .summary { padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-weight: 600; }
    .summary.pass { background: #dff6dd; color: #094409; }
    .summary.fail { background: #fde7e9; color: #5a0a14; }
    .case { padding: 10px 12px; border-left: 3px solid #ddd; margin: 6px 0; font-family: ui-monospace, Menlo, monospace; font-size: 13px; white-space: pre-wrap; }
    .case.pass { border-left-color: #2e7d32; }
    .case.fail { border-left-color: #c62828; background: #fff5f5; }
    .case .label { font-weight: 600; }
    .case .detail { color: #555; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Open House State Tests</h1>
  <p>Loads <code>../../../scripts.js</code> and exercises <code>window.__ohGetState</code> across all 6 states. The strip itself does not render here because the body has no <code>.topnav</code>.</p>
  <div id="summary" class="summary">Running…</div>
  <div id="results"></div>

  <script src="../../../scripts.js" defer></script>
  <script defer>
    window.addEventListener('load', function () {
      var results = document.getElementById('results');
      var summary = document.getElementById('summary');
      var passed = 0, failed = 0;

      function iso(s) { return new Date(s); }

      function run(label, events, now, expect) {
        var actual = window.__ohGetState ? window.__ohGetState(events, now) : null;
        var div = document.createElement('div');
        div.className = 'case';
        var ok = true;
        var detail = '';
        if (expect === null) {
          if (actual !== null) { ok = false; detail = 'Expected null, got ' + JSON.stringify(actual); }
        } else if (actual === null) {
          ok = false; detail = 'Expected ' + JSON.stringify(expect) + ', got null';
        } else {
          Object.keys(expect).forEach(function (k) {
            if (actual[k] !== expect[k]) {
              ok = false;
              detail += k + ': expected ' + JSON.stringify(expect[k]) + ', got ' + JSON.stringify(actual[k]) + '\n';
            }
          });
        }
        div.classList.add(ok ? 'pass' : 'fail');
        div.innerHTML = '<span class="label">' + (ok ? '✓ ' : '✗ ') + label + '</span>' + (detail ? '<div class="detail">' + detail + '</div>' : '');
        results.appendChild(div);
        if (ok) passed++; else failed++;
      }

      var EVENT = { start: '2026-05-16T13:00:00-05:00', end: '2026-05-16T16:00:00-05:00' };
      var GMAPS = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('1406 Crystal Hills Drive, Houston, TX 77077');

      // Past: now is after end
      run('past → null', [EVENT], iso('2026-05-16T16:30:00-05:00'), null);

      // No events
      run('empty config → null', [], iso('2026-05-15T12:00:00-05:00'), null);

      // Live: now is between start and end
      run('live state', [EVENT], iso('2026-05-16T14:30:00-05:00'), {
        state: 'live', eyebrow: 'OPEN NOW', phrase: 'Until 4 PM today', linkText: 'Get directions', linkHref: GMAPS
      });

      // Today, before start: same local day, now < start
      run('today (same day, before start)', [EVENT], iso('2026-05-16T09:00:00-05:00'), {
        state: 'today', eyebrow: 'OPEN HOUSE', phrase: 'Today · 1–4 PM', linkText: 'Plan a visit', linkHref: '#showing'
      });

      // Tomorrow: start is the next local day
      run('tomorrow (24h before)', [EVENT], iso('2026-05-15T13:00:00-05:00'), {
        state: 'tomorrow', eyebrow: 'OPEN HOUSE', phrase: 'Tomorrow · 1–4 PM', linkText: 'Plan a visit', linkHref: '#showing'
      });

      // Tomorrow: just past midnight prior
      run('tomorrow (late night before)', [EVENT], iso('2026-05-15T23:30:00-05:00'), {
        state: 'tomorrow', eyebrow: 'OPEN HOUSE', phrase: 'Tomorrow · 1–4 PM'
      });

      // Near: 2–6 days out
      run('near (Wed → following Sat)', [EVENT], iso('2026-05-13T12:00:00-05:00'), {
        state: 'near', eyebrow: 'OPEN HOUSE', phrase: 'This Saturday · 1–4 PM', linkText: 'Plan a visit', linkHref: '#showing'
      });

      // Future: 7+ days out
      run('future (10 days out)', [EVENT], iso('2026-05-06T12:00:00-05:00'), {
        state: 'future', eyebrow: 'OPEN HOUSE', phrase: 'Saturday, May 16 · 1–4 PM', linkText: 'Plan a visit', linkHref: '#showing'
      });

      // Month boundary: now=May 31, start=June 1 → tomorrow
      run('tomorrow across month boundary', [
        { start: '2026-06-01T13:00:00-05:00', end: '2026-06-01T16:00:00-05:00' }
      ], iso('2026-05-31T18:00:00-05:00'), {
        state: 'tomorrow', phrase: 'Tomorrow · 1–4 PM'
      });

      // Year boundary: now=Dec 31, start=Jan 1 → tomorrow
      run('tomorrow across year boundary', [
        { start: '2027-01-01T13:00:00-06:00', end: '2027-01-01T16:00:00-06:00' }
      ], iso('2026-12-31T18:00:00-06:00'), {
        state: 'tomorrow', phrase: 'Tomorrow · 1–4 PM'
      });

      // Visitor timezone independence: visitor in Tokyo on 2026-05-16 14:00 JST = 2026-05-16 00:00 CDT
      run('tokyo visitor sees today, not tomorrow', [EVENT], iso('2026-05-16T14:00:00+09:00'), {
        state: 'today', phrase: 'Today · 1–4 PM'
      });

      // Multiple events: only the earliest non-past is used
      run('picks earliest non-past', [
        { start: '2026-05-09T13:00:00-05:00', end: '2026-05-09T16:00:00-05:00' }, // past
        EVENT, // future
        { start: '2026-08-15T13:00:00-05:00', end: '2026-08-15T16:00:00-05:00' }  // further future
      ], iso('2026-05-15T13:00:00-05:00'), {
        state: 'tomorrow', phrase: 'Tomorrow · 1–4 PM'
      });

      if (failed === 0) {
        summary.className = 'summary pass';
        summary.textContent = '✓ All ' + passed + ' tests passed';
      } else {
        summary.className = 'summary fail';
        summary.textContent = '✗ ' + failed + ' failed, ' + passed + ' passed';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Open the test page in a browser to verify the failing state**

Open `docs/superpowers/tools/open-house-state-tests.html` in Chrome. Every test case should show `✗` because `window.__ohGetState` is undefined.

Expected output: `✗ 13 failed, 0 passed` (or similar — exact count matches the run() calls).

- [ ] **Step 3: Implement `getOpenHouseState` in `scripts.js`**

Append the following IIFE to the end of `scripts.js`. This block adds only the pure function and exposes it on `window` for the test page. DOM rendering comes in Task 3.

```js
// Open house teaser strip — state derivation (pure)
(function () {
  // Config: append future open houses here, chronologically.
  var OPEN_HOUSES = [
    { start: '2026-05-16T13:00:00-05:00', end: '2026-05-16T16:00:00-05:00' }
  ];

  var GMAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('1406 Crystal Hills Drive, Houston, TX 77077');

  // Extract { y, m, d } for a Date in America/Chicago.
  function houstonYMD(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    var get = function (type) {
      var p = parts.find(function (x) { return x.type === type; });
      return p ? parseInt(p.value, 10) : 0;
    };
    return { y: get('year'), m: get('month'), d: get('day') };
  }

  // Whole-day delta between two YMD objects (a - b), correct across month/year.
  // Computed by creating UTC dates from the YMD parts so timezone math is removed.
  function dayDelta(a, b) {
    var ua = Date.UTC(a.y, a.m - 1, a.d);
    var ub = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((ua - ub) / 86400000);
  }

  // Format the "Saturday, May 16" portion in Houston-local time.
  function formatFullDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(date);
  }

  // Format "This Saturday" — the weekday name, prefixed with "This ".
  function formatNearWeekday(date) {
    var weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', weekday: 'long'
    }).format(date);
    return 'This ' + weekday;
  }

  function pickEvent(events, now) {
    if (!events || events.length === 0) return null;
    var nowMs = now.getTime();
    for (var i = 0; i < events.length; i++) {
      if (new Date(events[i].end).getTime() > nowMs) return events[i];
    }
    return null;
  }

  function getOpenHouseState(events, now) {
    var ev = pickEvent(events, now);
    if (!ev) return null;

    var start = new Date(ev.start);
    var end = new Date(ev.end);
    var nowMs = now.getTime();

    // Live: between start and end
    if (nowMs >= start.getTime() && nowMs < end.getTime()) {
      return {
        state: 'live',
        eyebrow: 'OPEN NOW',
        phrase: 'Until 4 PM today',
        linkText: 'Get directions',
        linkHref: GMAPS_URL
      };
    }

    // All other states require start > now
    var delta = dayDelta(houstonYMD(start), houstonYMD(now));

    if (delta === 0) {
      return {
        state: 'today',
        eyebrow: 'OPEN HOUSE',
        phrase: 'Today · 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    if (delta === 1) {
      return {
        state: 'tomorrow',
        eyebrow: 'OPEN HOUSE',
        phrase: 'Tomorrow · 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    if (delta >= 2 && delta <= 6) {
      return {
        state: 'near',
        eyebrow: 'OPEN HOUSE',
        phrase: formatNearWeekday(start) + ' · 1–4 PM',
        linkText: 'Plan a visit',
        linkHref: '#showing'
      };
    }
    // delta >= 7
    return {
      state: 'future',
      eyebrow: 'OPEN HOUSE',
      phrase: formatFullDate(start) + ' · 1–4 PM',
      linkText: 'Plan a visit',
      linkHref: '#showing'
    };
  }

  // Expose for the test page and for use by the render IIFE in Task 3.
  window.__ohGetState = getOpenHouseState;
  window.__ohConfig = OPEN_HOUSES;
})();
```

- [ ] **Step 4: Reload the test page and verify all assertions pass**

Open `docs/superpowers/tools/open-house-state-tests.html` again. Expected: `✓ All 13 tests passed` (or however many `run()` calls are present).

If any test fails, the page shows the expected vs. actual for the failing field. Fix the logic, reload, re-verify.

- [ ] **Step 5: Commit**

```bash
git add scripts.js docs/superpowers/tools/open-house-state-tests.html
git commit -m "Add open-house state-derivation function with browser test page"
```

---

## Task 2: CSS for the strip

**Goal:** Add the visual styling for the strip — ink background, cream text, brass accents, responsive two-row mobile layout — using only existing design tokens.

**Files:**
- Modify: `style.css` (append new section near end, before the final `@media` mobile blocks if any)

**Acceptance Criteria:**
- [ ] `.oh-strip` is full-bleed, sticky at `top: 0`, `z-index: 50` so it sits above (in document order) the `.topnav` which uses `z-index: 100`. Visually the strip appears above the topnav because it precedes it in the DOM and both are sticky.
- [ ] Background is `var(--ink)`; text color is `var(--cream)`.
- [ ] Container padding matches the existing `.container` rhythm (max-width `var(--container)`, horizontal padding `var(--content-side-pad)`).
- [ ] Eyebrow span uses Inter 600, 11px, `var(--tracking-eyebrow)`, uppercase, `var(--brass)`.
- [ ] Phrase span uses Cormorant Garamond italic, ~18px, `var(--cream)`.
- [ ] Link uses Inter 500, 13px, `var(--cream)` with a 1px brass underline (4px offset). Hover thickens underline to 2px.
- [ ] Dismiss button is a 32×32 hit area with the × glyph centered, cream at 0.6 opacity, 1.0 on hover/focus. No border, transparent background.
- [ ] A 1px brass hairline sits at the bottom of the strip.
- [ ] Focus ring on link and dismiss uses 2px brass outline with 3px offset, matching `.cta:focus-visible`.
- [ ] At `max-width: 640px`, layout switches to two rows: eyebrow + × on row 1, phrase + link on row 2. Total height ~64px.
- [ ] No new CSS custom properties introduced.

**Verify:** Manually inspect a temporary plain `<div class="oh-strip">…</div>` element in `index.html` to confirm rendering. Remove the temporary markup after verifying — it will be JS-injected in Task 3.

**Steps:**

- [ ] **Step 1: Append the strip styles to `style.css`**

Add the following block to the end of `style.css` (or just before the file's last `@media` block if grouped styles are kept together):

```css
/* Open house teaser strip */
.oh-strip {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--ink);
  color: var(--cream);
  border-bottom: 1px solid var(--brass);
}
.oh-strip-inner {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0.625rem var(--content-side-pad);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.oh-strip-eyebrow {
  font-family: var(--font-ui);
  font-size: var(--fs-eyebrow);
  letter-spacing: var(--tracking-eyebrow);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--brass);
  flex: 0 0 auto;
}
.oh-strip-phrase {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.125rem;
  font-weight: 400;
  color: var(--cream);
  flex: 1 1 auto;
}
.oh-strip-link {
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--cream);
  text-decoration: none;
  border-bottom: 1px solid var(--brass);
  padding-bottom: 2px;
  transition: border-width 0.15s ease;
  flex: 0 0 auto;
}
.oh-strip-link:hover { border-bottom-width: 2px; padding-bottom: 1px; }
.oh-strip-link:focus-visible { outline: 2px solid var(--brass); outline-offset: 3px; }
.oh-strip-dismiss {
  background: transparent;
  border: 0;
  color: var(--cream);
  opacity: 0.6;
  font-size: 18px;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 0 0 auto;
}
.oh-strip-dismiss:hover,
.oh-strip-dismiss:focus { opacity: 1; }
.oh-strip-dismiss:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }

@media (max-width: 640px) {
  .oh-strip-inner {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "eyebrow dismiss"
      "phrase  link";
    row-gap: 0.25rem;
    column-gap: var(--space-2);
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  .oh-strip-eyebrow { grid-area: eyebrow; }
  .oh-strip-dismiss { grid-area: dismiss; justify-self: end; }
  .oh-strip-phrase  { grid-area: phrase; font-size: 1rem; }
  .oh-strip-link    { grid-area: link; justify-self: end; }
}
```

- [ ] **Step 2: Insert a temporary placeholder in `index.html` to verify rendering**

Add a placeholder before `<header class="topnav">` (line ~81) just for visual verification:

```html
<div class="oh-strip" role="region" aria-label="Open house announcement">
  <div class="oh-strip-inner">
    <span class="oh-strip-eyebrow">OPEN HOUSE</span>
    <span class="oh-strip-phrase">Tomorrow · 1–4 PM</span>
    <a class="oh-strip-link" href="#showing">Plan a visit <span aria-hidden="true">→</span></a>
    <button class="oh-strip-dismiss" type="button" aria-label="Dismiss open house announcement">×</button>
  </div>
</div>
```

- [ ] **Step 3: Open `index.html` in a browser and visually verify the strip**

Resize the window between desktop (≥640px) and mobile (<640px) to confirm:
- Strip is sticky and stays at the top as the page scrolls.
- Strip stacks above the topnav (both visible while scrolling).
- Desktop: single row, eyebrow + phrase left-aligned, link + × right-aligned.
- Mobile: two rows as illustrated above.
- Focus ring appears on link and × when tabbed to.
- Brass hairline visible at the bottom of the strip.

- [ ] **Step 4: Remove the temporary placeholder from `index.html`**

Delete the temporary `<div class="oh-strip">…</div>` block from `index.html`. The real markup will be JS-injected in Task 3.

- [ ] **Step 5: Commit**

```bash
git add style.css
git commit -m "Add CSS for open-house teaser strip (desktop + mobile)"
```

---

## Task 3: Render, refresh, and dismiss logic

**Goal:** Wire `getOpenHouseState` into the live page: build the strip DOM on load, attach handlers, refresh on a 30-second interval, and remove cleanly when the event ends or the user dismisses.

**Files:**
- Modify: `scripts.js` (extend the IIFE added in Task 1 with render/mount/dismiss code)

**Acceptance Criteria:**
- [ ] On page load, if `pickEvent(OPEN_HOUSES, now)` returns null, no DOM is inserted.
- [ ] On page load, if `sessionStorage.getItem('openHouseDismissed') === '1'`, no DOM is inserted.
- [ ] Otherwise, a `<div class="oh-strip" role="region" aria-label="Open house announcement">` is inserted as the first child of `<body>`, before `<header class="topnav">`.
- [ ] Strip markup matches the structure in the spec, including `aria-live="polite"` on the phrase span and `aria-label="Dismiss open house announcement"` on the button.
- [ ] Clicking × or pressing `Escape` while the strip is mounted: sets `sessionStorage.setItem('openHouseDismissed', '1')`, removes the strip from the DOM, and clears the refresh interval.
- [ ] A `setInterval` running every 30 seconds re-computes the state. If state values change, the eyebrow text, phrase text, link text, and link href are updated in-place. If the new state is `null` (event ended), the strip is removed and the interval cleared.
- [ ] The Escape-key handler does NOT interfere with the existing Escape handler that closes the scrubber fullscreen or lightbox. Escape only dismisses the strip when neither the scrubber nor the lightbox is in an open state.
- [ ] Strip is not inserted if `document.body` is somehow missing or if the script runs before the DOM is parsed (defensive — `defer` should prevent this, but the IIFE guards against it).

**Verify:** Manual QA matrix in Task 4. For this task specifically: load `index.html`, see the strip render with "Tomorrow · 1–4 PM" (given today is 2026-05-15), click ×, see it disappear, reload the page, see it stay dismissed.

**Steps:**

- [ ] **Step 1: Extend the open-house IIFE in `scripts.js` with render logic**

Replace the closing `})()` of the IIFE added in Task 1 with the following additional code, keeping the existing state-derivation function unchanged. The full updated IIFE should look like this (showing the additions only; the state-derivation code from Task 1 stays at the top):

```js
  // (state-derivation code from Task 1 above, unchanged)

  // --- Render / dismiss ---

  var DISMISS_KEY = 'openHouseDismissed';
  var REFRESH_MS = 30 * 1000;

  var stripEl = null;
  var refreshTimer = null;
  var lastState = null;

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
    link.textContent = stateObj.linkText + ' ';
    var arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.appendChild(arrow);

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'oh-strip-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss open house announcement');
    dismiss.textContent = '×';
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
    link.firstChild.nodeValue = newState.linkText + ' ';
    link.href = newState.linkHref;
  }

  function onDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* private mode */ }
    removeStrip();
  }

  function removeStrip() {
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
    if (!document.body) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch (e) { /* private mode — fall through and render */ }

    var state = getOpenHouseState(OPEN_HOUSES, new Date());
    if (!state) return;

    lastState = state;
    stripEl = buildStrip(state);
    // Insert as the first body child so it precedes .topnav in document order.
    document.body.insertBefore(stripEl, document.body.firstChild);

    refreshTimer = setInterval(refresh, REFRESH_MS);
  }

  // Escape-key dismiss, but only when the scrubber and lightbox are NOT open.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!stripEl) return;
    if (document.querySelector('.scrubber-frame.is-fullscreen')) return;
    var lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('open')) return;
    onDismiss();
  });

  // Run now (script is deferred, so DOM is parsed) or wait if not.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
```

Important: the existing scrubber-fullscreen IIFE has its own `keydown` listener for Escape. Both can coexist — the document-level listeners fire in registration order, but neither calls `stopPropagation` and both check their own gate conditions, so the strip's handler is a no-op when the scrubber or lightbox is open (per the explicit guards above).

- [ ] **Step 2: Load `index.html` in a browser and verify the strip renders**

Today's date (2026-05-15) means the strip should show eyebrow "OPEN HOUSE" and phrase "Tomorrow · 1–4 PM" with a "Plan a visit →" link pointing to `#showing`.

Verify:
- Strip appears at the very top, above the topnav.
- Both the strip and topnav remain visible while scrolling.
- Clicking "Plan a visit →" scrolls smoothly to the `#showing` section.
- Clicking × removes the strip immediately with no animation.
- Reloading the page after dismissing: strip stays hidden (sessionStorage flag set).
- Opening the page in a fresh tab/window: strip reappears.

- [ ] **Step 3: Verify Escape-key dismiss does not collide with existing handlers**

- Open a scrubber comparison in fullscreen (click the fullscreen icon on any before/after slider). Press Escape. The scrubber should exit fullscreen, and the strip should remain.
- Open the lightbox (click any photo). Press Escape. The lightbox should close, and the strip should remain.
- With neither the scrubber nor the lightbox open, press Escape. The strip should dismiss.

- [ ] **Step 4: Verify the test page still passes**

Open `docs/superpowers/tools/open-house-state-tests.html`. All assertions should still pass (the new render code does not alter `getOpenHouseState`).

- [ ] **Step 5: Commit**

```bash
git add scripts.js
git commit -m "Render, refresh, and dismiss open-house teaser strip"
```

---

## Task 4: Manual QA matrix

**Goal:** Walk through every adaptive state and behavioral edge case in a real browser to confirm the feature works end-to-end. This task produces no code changes; it's a checklist.

**Files:** None.

**Acceptance Criteria:** Every row below has been verified by the implementer in at least one browser (Chrome desktop minimum; Safari iOS strongly recommended).

**Verify:** Walk through the table below. To simulate different "now" values without waiting, temporarily edit the `OPEN_HOUSES` array in `scripts.js` (or use the test page's mocked dates as reference for what each state should look like).

| # | Scenario | How to test | Expected |
|---|---|---|---|
| 1 | Today is 2026-05-15, strip shows "Tomorrow" | Load `index.html` as-is | Eyebrow "OPEN HOUSE", phrase "Tomorrow · 1–4 PM", link "Plan a visit → #showing" |
| 2 | Future (>6 days out) | Set OPEN_HOUSES to a date 14 days in the future and reload | Phrase: full date e.g. "Saturday, June 13 · 1–4 PM" |
| 3 | Near (2–6 days out) | Set OPEN_HOUSES to a date 3 days out and reload | Phrase: "This [Weekday] · 1–4 PM" |
| 4 | Today, before start | Set OPEN_HOUSES `start` to a few hours after `now` and reload | Phrase: "Today · 1–4 PM" |
| 5 | Live | Set OPEN_HOUSES so now is between start and end and reload | Eyebrow "OPEN NOW", phrase "Until 4 PM today", link "Get directions →" pointing to Google Maps URL for 1406 Crystal Hills Drive |
| 6 | Past (event ended) | Set OPEN_HOUSES end to a past time and reload | Strip does not render at all (no DOM, no flash) |
| 7 | Dismiss persists in session | Click ×, reload | Strip stays hidden |
| 8 | Dismiss does not persist across sessions | Click ×, close tab, open fresh tab to the page | Strip reappears |
| 9 | Dismiss via Escape | Press Escape with no scrubber/lightbox open | Strip dismisses |
| 10 | Escape with scrubber open | Open scrubber fullscreen, press Escape | Scrubber exits fullscreen; strip stays |
| 11 | Escape with lightbox open | Click a photo, press Escape | Lightbox closes; strip stays |
| 12 | Mobile two-row layout | Resize to <640px or use device emulation | Strip shows two rows: eyebrow + × on row 1, phrase + link on row 2 |
| 13 | Focus ring on link | Tab to "Plan a visit" link | Brass 2px outline with 3px offset visible |
| 14 | Focus ring on dismiss | Tab to × | Brass 2px outline visible |
| 15 | Screen reader announcement | Enable VoiceOver/NVDA, reload page | "Open house announcement, region. Open house. Tomorrow, 1 to 4 PM. Plan a visit, link. Dismiss open house announcement, button." (or equivalent) |
| 16 | prefers-reduced-motion | OS-level enable reduced motion, reload | Strip appears with no animation (currently no entry animation anyway — confirm) |
| 17 | Private/incognito mode | Open page in incognito | Strip renders normally; dismiss works in-session (sessionStorage allowed in incognito but cleared on tab close) |
| 18 | Sticky behavior | Scroll down a few sections | Strip stays at top, topnav directly below it, both visible |

If any row fails: fix the underlying issue (CSS, JS, or markup), commit, and re-verify the affected rows.

- [ ] **Step 1: Walk the matrix**

Work through each row in order. Take notes inline as you go.

- [ ] **Step 2: Restore `OPEN_HOUSES` to the real production value**

After simulating other states by editing the config, set it back to:

```js
var OPEN_HOUSES = [
  { start: '2026-05-16T13:00:00-05:00', end: '2026-05-16T16:00:00-05:00' }
];
```

- [ ] **Step 3: Commit (no-op or final adjustments)**

If the matrix surfaced no issues, no commit is needed. If you fixed something, commit with a descriptive message like:

```bash
git add <files>
git commit -m "Fix <thing> found in open-house teaser QA"
```

---

## Self-Review Notes

Performed inline:
- **Spec coverage:** All 6 states (Past, Live, Today, Tomorrow, Near, Future), config-driven event list, sessionStorage dismissal, Escape-key dismissal, 30s refresh interval, ARIA region with polite live region for the phrase, focus rings, Houston-local calendar-day math across month/year boundaries, link swap to Google Maps in the Live state, mobile two-row layout, no new design tokens, deferred-script CLS noted. All covered.
- **Placeholder scan:** No "TBD"/"TODO" placeholders. Every code step contains the actual code.
- **Type consistency:** Function `getOpenHouseState`, exposed as `window.__ohGetState`, used by the same name in both the test page (Task 1) and the render IIFE (Task 3). Config name `OPEN_HOUSES` consistent. Storage key `'openHouseDismissed'` consistent between Spec, Task 3 step 1, and Task 4 row 7.
- **One detail noted but not changed:** Tasks 1 and 3 modify the same IIFE in `scripts.js`. Task 1 establishes the function and exposes it on `window`; Task 3 extends the same IIFE (still one block in the file, not two separate IIFEs). The plan explicitly calls this out at the start of Task 3 step 1.
