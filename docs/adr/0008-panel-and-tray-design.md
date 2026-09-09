# ADR-0008: Panel layout, window behaviour and tray ownership

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

Phase 3 builds the product's centrepiece. The user's own framing:

> "I like very much the idea of having this widget always on top, above all windows, and then I'd
> move it from monitor to monitor whenever needed and to make sure it's not too cluttered."

They run 5–10+ parallel sessions and forget about them, and they rejected the closest competing
tool partly because it did not show the **session name**. So the panel has three jobs, in order:
name every session, make `needs_input` impossible to miss, and stay small enough to park beside a
video call. Everything below follows from that ordering. A handful of decisions inside it were not
obvious and are recorded here.

## Decision

### Row anatomy: 32px, name-first

```
│▌● Refactor the session scanner            4m │
│   needs permission · ~/code/api              │
```

- A `<button>` per row inside an `<li>`: keyboard focus, Enter/Space and screen-reader semantics
  for free, and — see below — the thing that keeps clicks out of the drag region.
- **Title** (12.5px/550) is the primary line and takes all the width it can, truncating with an
  ellipsis. Falls back to the cwd basename, then to a short session id, so a row is never blank
  (`sessionDisplayTitle`).
- **Secondary line** (10.5px, muted) is the shortened cwd, prefixed for `needs_input` rows with
  _why_ they are blocked (`needs permission`, `waiting for you`, …) derived from the hook's
  `notification_type`. The free-text `notification_message` is kept for the hover tooltip: it is
  unbounded and would push the path off a 320px row.
- **Git branch is deferred.** The plan allowed it "only if genuinely cheap"; it is not — it means
  a `git` invocation per session on a 5s loop, against the PRD's ~0% idle CPU target. Noted as a
  Phase 5+ option if it can be watched rather than polled.
- **Age** is right-aligned, single-unit and truncated down (`12s`, `4m`, `1h`), from one clock for
  the whole panel. It is deliberately **blank for scanner-only sessions**: the reconciler stamps
  those with the time of the sweep that saw them, so an age there would reset every five seconds
  and always read a few seconds — worse than nothing. Hook-owned sessions show a real one.
- Density: 32px rows in a 320×400 window, so ten sessions fit without scrolling under a 26px
  header. No avatars, no per-row buttons, no separators.

### Colour: exactly one loud state

`needs_input` is the only row that raises its voice — amber dot with a slow pulse, an amber left
accent bar, a tinted background, a heavier title. `working` is a blue dot, `done_idle` a neutral
grey one, and everything else is plain text. This is the whole point of the panel: if two states
shouted, neither would. The pulse is suppressed under `prefers-reduced-motion`.

Order is **not** touched in the UI. The store already sorts `needs_input` → `working` →
`done_idle` → `ended`, then most recent first; emphasis is styling only, so a row never moves
under the user's cursor mid-click.

### Ended sessions are dimmed at the bottom, not hidden

The reconciler keeps an `ended` session for five minutes. The panel renders it at 45% opacity
with a hollow dot. Hiding it outright was the alternative and would be marginally less cluttered,
but a row that vanishes while the user is looking at it recreates the exact failure the PRD is
about ("I might end up simply forgetting one"), and the terminal window usually still exists, so
the row is still worth clicking to go and read the output. The five-minute TTL bounds the clutter.

The tray dropdown does the opposite and **omits** `ended` sessions, because `countSessionStates`
leaves them out of the aggregate label: a dropdown listing a session the label does not count
would read as a bug.

### Drag vs click: the drag region is the background, not the surface

Tauri matches `data-tauri-drag-region` against the element **under the cursor**, not against its
ancestors. That single fact settles the requirement:

- `data-tauri-drag-region` goes on the panel shell, the header, the header's aggregate text, the
  list element and the empty state — every pixel that is not a control.
- Rows and the hide button are child elements without the attribute, so a press on them can never
  start a window drag.
- The 26px header therefore exists mainly as a **guaranteed** handle: with ten rows filling the
  list there is no background left to grab, and an undecorated window has no title bar. It earns
  its pixels by also carrying the aggregate (the same string the menu bar shows) and the dismiss
  button.
- `maximizable: false` and `minimizable: false` in `tauri.conf.json` disable Tauri's
  double-click-to-maximize on a drag region and stop a stray gesture from minimising a widget
  that has no Dock icon to restore it from.

A component test asserts which elements carry the attribute, because this is invisible in
rendering and easy to break.

### Position persistence: physical pixels in the app config dir, clamped on restore

`tauri-plugin-store` writes `panel.json` (position and size, physical pixels, debounced 500ms
behind the window's `onMoved`/`onResized`). A file in the app config dir over `localStorage`,
matching ADR-0006's preference for state that is durable and inspectable by hand.

Restore is **clamped** by `clampWindowPosition`, a pure function tested against synthetic monitor
lists. Because the user's stated habit is to move the panel from screen to screen, a saved
position routinely names a display that is no longer attached — and an always-on-top window with
no decorations that lands off-screen cannot be recovered with the mouse. The rule: if less than
60% of the frame overlaps some monitor, move it onto the monitor it overlaps most (primary if
none), fitting it inside. Monitor **work areas** are used rather than full bounds, so a restored
panel clears the menu bar and the Dock.

### The tray is created in Rust and driven from TypeScript

`TrayIconBuilder::with_id("main")` keeps tray creation — and a minimal Show/Hide + Quit menu —
in Rust, so quitting still works if the webview never loads. Everything dynamic is TypeScript
(`src/ui/useTray.ts`): `TrayIcon.getById('main')`, then `setTitle`, `setTooltip` and a menu
rebuilt from `buildTrayModel(sessions)`.

This follows ADR-0002 ("logic goes in TypeScript unless it is impossible there"): the dropdown is
a projection of the same store the panel renders, so building it in TS means one model, one code
path and no second polling loop. Building it in Rust would have meant a dynamic menu, a session-id
round trip and an event back to TS to act on a click — more Rust, for less.

Menu shape: aggregate summary in words (`2 need input · 3 working`), separator, up to 10 sessions
as `glyph  title`, an inert `…and N more in the panel` line when there are more, separator,
`Show/Hide Panel`, `Launch at Login` (a check item), separator, `Quit`. Session actions look the
clicked id up in a ref rather than a captured snapshot, because the list moves while a menu is
open. The label is `formatAggregate` capped at 20 characters — macOS truncates long menu bar text
and the label shares the bar with everything else.

Each rebuild creates a native menu, so the previous one is released **after** the swap, never
before: closing the menu currently on the tray would blank it, and never closing one leaks a
handle every few seconds.

### Launch at login lives in the tray, not the panel

`tauri-plugin-autostart` (LaunchAgent), default **off**, toggled from the tray's check item. It is
a once-a-year setting; a permanent row of panel chrome for it would cost more than it is worth.

## Alternatives Considered

- **`tauri-plugin-window-state`** for geometry — rejected: it restores what it saved, and the
  clamping is the part that actually matters here. A tested pure function plus twenty lines of
  plumbing is smaller than the plugin and does the thing we need.
- **`localStorage`** for geometry — rejected: works, but lives inside the webview data directory
  where nobody can find or fix it.
- **A per-row timer** for the age — rejected: ten intervals for one clock. One tick, memoised
  rows, and re-render work proportional to the number of _labels that changed_.
- **Compact/counts-only panel mode** (PRD "Could") — deliberately not built. The plan says skip
  rather than rush it, and at 32px a row the full list already fits in 400px.
- **Sorting or filtering in the UI** — rejected: the store's order is already the attention order
  and is stable by construction.

## Consequences

The panel is one screen of code with all judgement pushed into pure, tested functions
(`describeSession`, `formatDuration`, `formatTimeInState`, `sessionDisplayTitle`, `shortenPath`,
`buildTrayModel`, `clampWindowPosition`, `parseWindowFrame`), and a thin imperative layer of hooks
around Tauri. Rust grew by three plugin registrations and a tray id.

What we have committed to: rows must stay outside the drag region, which constrains any future
"drag anywhere" refinement; and the tray is only as live as the webview, which is why the Rust
fallback menu stays.

Two things cannot be verified in CI and are covered by `docs/ui-smoke-checklist.md` instead:
whether always-on-top actually survives a macOS full-screen space, and whether the restored
position lands correctly across a real monitor change.

Clicking a row calls `src/ui/onSessionClick.ts`, which was a seam with a stub body until Phase 4
landed. It now flattens the focus engine's typed `FocusResult` into `{ok, detail}` — see
ADR-0007.
