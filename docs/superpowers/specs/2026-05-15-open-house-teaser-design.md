# Open House Teaser Strip — Design

**Date:** 2026-05-15
**Status:** Approved, ready for implementation plan
**Target site:** crystalhillshouse.com (single-page marketing site for 1406 Crystal Hills Dr)

## Goal

Surface the upcoming open house (Saturday, May 16, 1–4 PM) at the top of every visit with a tasteful, dismissible announcement that feels native to the site's editorial tone — cream/ink/brass palette, Cormorant Garamond display, Inter UI. The date currently lives only inside section `#showing`, which requires scrolling to discover.

The strip must:
- Be unmissable above the fold without feeling like an e-commerce flash sale.
- Adapt its phrasing as the event approaches and during the event itself.
- Be dismissible for the current session.
- Cleanly disappear once the event ends, with zero residual chrome.
- Scale to future open houses by appending one entry to a config array.

## Architecture

A single sticky strip mounted above the existing `.topnav`, rendered by `scripts.js` at page load.

### Data

A `const OPEN_HOUSES` array near the top of `scripts.js`:

```js
const OPEN_HOUSES = [
  { start: '2026-05-16T13:00:00-05:00', end: '2026-05-16T16:00:00-05:00' },
  // future events: append in chronological order
];
```

ISO 8601 strings with explicit `-05:00` (CDT) offsets so the adaptive label reflects Houston local time regardless of the visitor's timezone.

### Render flow

On `DOMContentLoaded`:

1. Find the next event in `OPEN_HOUSES` where `new Date(event.end) > Date.now()`. If none, exit — no DOM is inserted.
2. Read `sessionStorage.getItem('openHouseDismissed')`. If `'1'`, exit.
3. Build the strip element (see Markup below) and insert it as the first child of `<body>`, immediately before `<header class="topnav">`.
4. Start a `setInterval` running every 30 seconds that re-derives the adaptive label and the rendered state (future → near → tomorrow → today → live → past). When state transitions to `past`, remove the strip from the DOM and clear the interval.

`scripts.js` is already loaded with `defer`, so it runs after HTML parsing. The strip may be inserted after the browser's first paint, which can cause a small one-time layout shift of the topnav and hero. This is acceptable given the strip's modest height (~44px desktop, ~64px mobile) and that it happens before any user interaction. No special handling is added to suppress it.

### Markup (rendered, simplified)

```html
<div class="oh-strip" role="region" aria-label="Open house announcement">
  <div class="oh-strip-inner">
    <span class="oh-strip-eyebrow">OPEN HOUSE</span>
    <span class="oh-strip-phrase" aria-live="polite">Tomorrow · 1–4 PM</span>
    <a class="oh-strip-link" href="#showing">Plan a visit <span aria-hidden="true">→</span></a>
    <button class="oh-strip-dismiss" type="button" aria-label="Dismiss open house announcement">×</button>
  </div>
</div>
```

## Content & adaptive states

One line of content. Eyebrow tag + phrase on the left; action link + dismiss on the right.

States are evaluated in this order; the first match wins:

| Order | State | Trigger | Eyebrow | Phrase | Link text | Link target |
|---|---|---|---|---|---|---|
| 1 | Past | `now ≥ end` | — | — | — | — (strip removed) |
| 2 | Live | `start ≤ now < end` | OPEN NOW | "Until 4 PM today" | Get directions → | Google Maps URL for 1406 Crystal Hills Drive, Houston, TX 77077 |
| 3 | Today, before start | `start` is on the same Houston-local calendar day as `now`, and `now < start` | OPEN HOUSE | "Today · 1–4 PM" | Plan a visit → | `#showing` |
| 4 | Tomorrow | `start` is on the Houston-local calendar day immediately following `now`'s local day | OPEN HOUSE | "Tomorrow · 1–4 PM" | Plan a visit → | `#showing` |
| 5 | Near | start is 2–6 Houston-local calendar days after `now`'s local day | OPEN HOUSE | "This Saturday · 1–4 PM" | Plan a visit → | `#showing` |
| 6 | Future | start is 7+ Houston-local calendar days after `now`'s local day | OPEN HOUSE | "Saturday, May 16 · 1–4 PM" (locale-formatted full date) | Plan a visit → | `#showing` |

All "calendar day" comparisons are done by deriving the Houston-local (`America/Chicago`) year/month/day for both `start` and `now`, then subtracting day counts — not by raw millisecond deltas. This ensures "Tomorrow" flips at local midnight and works correctly across month and year boundaries.

The time formatting (`1–4 PM`) uses an en dash to match the existing prose in `#showing` ("1–4 PM").

## Visual styling

### Desktop (≥640px viewport)

- **Background:** `var(--ink)` (#1A2332).
- **Text color:** `var(--cream)` (#F5F1EA).
- **Layout:** flex row, `var(--container)` max-width, `var(--content-side-pad)` horizontal padding to align with topnav. Eyebrow + phrase pinned left, link + × pinned right, single gap of `var(--space-3)` between phrase and link.
- **Height:** ~44px (vertical padding ~12px).
- **Eyebrow:** reuses `.eyebrow` typography — Inter 600, 11px, `letter-spacing: var(--tracking-eyebrow)`, uppercase — but recolored to `var(--brass)` against ink.
- **Phrase:** Cormorant Garamond italic, ~18px, cream. Echoes existing section headers like `<h2><em>Plan a showing.</em></h2>`.
- **Link:** Inter 500, 13px, cream, brass 1px underline with 4px offset. Hover: underline thickens to 2px. Arrow glyph aria-hidden.
- **Dismiss button:** 18px ×, cream at 0.6 opacity, 32×32 hit area, transparent background, no border. Hover: opacity 1.0.
- **Bottom separator:** 1px hairline in `var(--brass)`, echoing the existing `.rule` motif. The strip's only piece of chrome beyond color.
- **Sticky:** `position: sticky; top: 0; z-index: 50;`. Sits above `.topnav`, which is also sticky and stays just below.

### Mobile (<640px viewport)

```
┌──────────────────────────────────────┐
│ OPEN HOUSE                         × │
│ Tomorrow · 1–4 PM    Plan a visit →  │
└──────────────────────────────────────┘
```

- Two rows. Row 1: eyebrow on left, × on right. Row 2: phrase on left, link on right.
- Height grows to ~64px to fit both rows with comfortable spacing.
- × stays top-right so the touch target is far from the link, avoiding fat-finger conflicts.
- Below ~380px, link wraps under the phrase rather than truncating.
- All colors and typography otherwise identical to desktop.

## Behavior

### Dismissal

- Click on × sets `sessionStorage.setItem('openHouseDismissed', '1')` and removes the strip from the DOM (no animation; instant).
- Pressing `Escape` anywhere on the page has the same effect, but only while the strip is mounted.
- The flag is session-scoped (cleared when the tab closes), per the decision to favor a "polite but persistent" cadence over permanent muting.
- The flag is intentionally not event-keyed: dismissing this event also suppresses the strip for the rest of the session even if a later event would otherwise match. This is acceptable because sessions are short-lived.

### Adaptive refresh

- A 30-second interval re-derives the phrase and state. This is enough granularity for "Today" → "Live" → "Past" transitions to feel current without being a wall-clock spectacle.
- No live ticking countdown (per design choice: adaptive labels, not seconds).

### Live state link swap

- During the open house window (Live state), the right-side link changes from "Plan a visit → #showing" to "Get directions → Google Maps." This is the only state where the link target differs.
- Rationale: a visitor arriving during the open house is more likely already mobile and in transit; "directions" serves them better than scrolling to a contact form.

## Accessibility

- Strip is a labeled landmark (`role="region"`, `aria-label="Open house announcement"`).
- Phrase wrapped in `aria-live="polite"` so screen readers announce it once on load, and again when state transitions update the text.
- Dismiss button has an explicit `aria-label`. Arrow glyphs are `aria-hidden="true"`.
- Tab order: link → dismiss. Visible focus styling reuses the site's existing brass focus ring.
- `Escape` keyboard shortcut to dismiss.
- `prefers-reduced-motion: reduce` disables the entry slide-down. Dismiss is instant regardless.

## Edge cases

- **No upcoming events:** strip never renders. No DOM, no flash, no console output.
- **Multiple future events in config:** only the earliest non-past event is shown.
- **Clock skew:** the adaptive label trusts the visitor's clock. A misconfigured clock could show "Tomorrow" when it's actually "Today," but the canonical date/time is also printed inside `#showing`, which the strip links to.
- **Timezone:** config uses explicit `-05:00` offsets. `new Date(iso)` parses correctly across browsers. Comparisons against `Date.now()` are timezone-agnostic.
- **No-JS visitors:** strip never renders. The open-house info already lives in `#showing` for them.
- **Reflow on mount:** strip is inserted before the topnav so the topnav and hero shift down once on initial render. Because `scripts.js` is deferred, this shift may be visible as a small one-time CLS event. Accepted, not engineered around.
- **Removal on `past` transition:** when the interval observes `now ≥ end`, it removes the strip element and clears itself. No leftover sticky chrome above the topnav.

## Files touched

- `index.html` — no markup changes; strip is JS-injected. (Optional: add a tiny placeholder `<div id="oh-strip-mount"></div>` if we want a stable insertion anchor instead of relying on `topnav` position. Decided against for now — keeps HTML unchanged.)
- `scripts.js` — add `OPEN_HOUSES` config, the render/refresh/dismiss logic, and a small DOM helper for building the strip.
- `style.css` — add `.oh-strip`, `.oh-strip-inner`, `.oh-strip-eyebrow`, `.oh-strip-phrase`, `.oh-strip-link`, `.oh-strip-dismiss` rules plus a `@media (max-width: 640px)` block for the two-row mobile layout. Use existing custom properties (`--ink`, `--cream`, `--brass`, spacing scale, type tokens) — no new tokens introduced.

## Adding future open houses

Append one entry to `OPEN_HOUSES` in `scripts.js`:

```js
{ start: '2026-08-15T13:00:00-05:00', end: '2026-08-15T16:00:00-05:00' },
```

No other code or copy changes required. The strip will pick the next non-past event automatically.

## Out of scope

- Email or SMS reminders.
- Calendar (.ics) download.
- Multiple simultaneous open houses (config supports the list, but only one is shown at a time).
- A "Sold / Pending" fallback message after all events have passed (intentionally deferred — easy to add later if needed).
- A live ticking second-by-second countdown.
