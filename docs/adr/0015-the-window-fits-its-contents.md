# ADR-0015: The window fits its contents, and the user can turn that off

- **Status**: Accepted
- **Date**: 2026-09-10

## Context

The panel has been 320×400 since Phase 1, and 400px is the wrong height almost always:

> "Can you adjust the height of the window based on the number of agents there are? You can let
> the user customize the size, but by default it should auto adjust."

With two agents most of the window is empty — a translucent rectangle parked over the user's work,
holding nothing. With twelve it scrolls, and the independent per-section scrolling that ADR-0008
built for that case means rows are half-visible at the bottom of two sections at once. Both
failures are the same one: the window's height is a constant while its content is not.

The height is also already the user's to set — the window is `resizable`, and `panel.json` has
persisted position and size since ADR-0008. So this cannot simply become automatic; it has to
become automatic _by default_, with the old behaviour still reachable.

## Decision

### The height is measured, not calculated

`measurePanelContentHeight` reads the natural height back out of the live DOM. Three cases,
applied recursively from the panel root:

- a **scroll container** (`.group__list`, `.setup__scroll`) reports `scrollHeight`, which is its
  content whatever height its box has been squeezed to;
- a **stretched or clipped** box (`flex: 1`, `overflow: hidden`) is rebuilt from its children,
  because `flex: 1` makes it as tall as the window and `overflow: hidden` lets it be shorter than
  its content — neither tells us anything;
- anything else is already at its natural height.

The alternative was a pure function over the section counts, with the row height, every heading,
every separator and the legend as constants. It was rejected on drift: those numbers live in
`panel.css`, this app has redesigned that file twice in two days, and the failure mode of a stale
constant is a permanently mis-sized window that nothing tests. Reading the layout back is correct
by construction, and stays correct for the session list, the setup view and the empty state alike
without any of them being special-cased.

What is left over is genuinely a judgement, and that is pure and tested: `clampPanelHeight` decides
what to ask for given the measurement, the window's floor and the monitor's work area.

### Bounds

- **The screen is an absolute ceiling**, less 24px so the panel reads as floating rather than
  wedged. A window taller than the work area cannot be dragged back into view: it has no title bar
  above the menu bar to grab. Past the ceiling the panel stops growing and the sections scroll,
  which is what they were built to do.
- **The floor is the window's `minHeight`** (120px). Below that the header and legend start eating
  the rows they frame.
- **Width is never touched.** The user picks it, it is persisted, and nothing here has an opinion.

### The setting

`autoHeight`, default **on**, persisted in `panel.json` beside the frame and parsed by
`parsePanelSettings` — which falls back to the default for every unreadable field, because a
corrupt settings file must not silently mean "off".

It lives in the setup/diagnostics view under a **Panel** heading: the panel's only screen with room
for a sentence of explanation. The sentence says what turning it off _gets_ you ("Turn this off to
set the height yourself") rather than only what the checkbox does, and swaps for how to resize once
it is off.

With it on, the height is managed and a manual drag of the bottom edge is undone at the next
change. That is the honest reading of "auto-adjust", and the way to keep a height is the checkbox
that says so.

### Two hooks, one file, one gate

`useAutoPanelHeight` re-measures when a signature string changes — the three section counts,
whether a notice is up, whether setup is open. A `ResizeObserver` was tried first and does not work
here: every box that decides this panel's height is either stretched by flex or clipped by
overflow, so none of them changes size when the content inside it does.

`usePersistedPanelFrame` and `usePanelSettings` now share one handle on `panel.json`
(`panelStore.ts`), and both wait for the settings to load before touching the window. Two things
follow from that:

- With auto-height on, the saved **height** is not restored — one is about to be computed, and
  restoring first would show the previous session's height for a frame. Position and width are
  restored either way.
- The height is still _saved_, so turning the setting off leaves the panel where auto-height last
  put it rather than jumping to a size from days ago.

Measurement is in CSS pixels and `setSize` wants physical ones, so the scale factor is applied
before the clamp. On a Retina display, forgetting that is the difference between the right height
and half of it.

## Alternatives Considered

- **A formula over the session counts.** Rejected above: it re-declares constants that already
  exist in the stylesheet.
- **`ResizeObserver` on the content.** Rejected: nothing observable changes size, for the reason
  above. It would have looked correct and fired never.
- **Turning the setting off automatically when the user drags the bottom edge.** Tempting, and the
  discoverable option. Rejected because distinguishing a user's resize from our own `setSize`
  means comparing against the height we just asked for, and the two coincide often enough
  (resize, then a session changes, then the heights match) that the setting would flip itself on
  and off for reasons the user cannot see. A checkbox that says what it does beats a heuristic
  about what they meant.
- **Snapping to whole rows.** Rejected: the sections have headings and the legend has two lines,
  so "a whole number of rows" is not a height the window can hold anyway.
- **Auto-sizing the width too.** Rejected: the title is the row's whole value and it truncates, so
  the useful width is "as much as the user will give it", which is a preference and not a
  measurement.
- **Leaving the height alone while the setup view is open.** Rejected: a panel shrunk to two agents
  would open the first-run guide into 190px of scrolling. Setup is in the signature, so opening it
  grows the window to fit it and closing it shrinks back.

## Consequences

The panel now costs exactly the screen space its contents need, which is the point of a widget
parked beside real work. Twelve agents fit without scrolling on any normal display; two take
190px.

The browser harness demonstrates it: the frame runs the same `measurePanelContentHeight` against
the same layout, with an **Auto height** toggle. That is the only way to see this behaviour, or
check the measurement, without launching the native shell — and it is how the numbers above were
verified.

What we have committed to: the height signature must name everything that changes the panel's
height. Add a section, or a second line to the legend, and it has to be listed there or the window
will lag one change behind. The measurement itself needs no maintenance, which is the whole reason
it is a measurement.

The `minHeight` floor is duplicated in `useAutoPanelHeight` because there is no API to read it
back from `tauri.conf.json`. A wrong value there means a slightly-too-short panel, never a broken
one.
