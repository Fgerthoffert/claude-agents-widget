# ADR-0013: One loud row, a setup screen that says less, and a click that reports back

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

Three complaints from the same sitting, after v0.2.1 had been running on a real desk with nine
agents in it:

> "The setup screen seems too crowded to me, maybe there's a way to make it simpler? I also find
> the 'Waiting for you' list too complex/crowded, they are all highlighted which does not make too
> much sense to me. It's good when there's only one, but I find it too much when there's multiple.
> Finally, I want to make it as smooth and user friendly as possible to switch between apps when
> clicking on the agent line."

Each is a place where a design that was right for one session was wrong for nine.

**Emphasis did not survive multiplication.** ADR-0008 argued that "exactly one state raises its
voice", and gave `needs_input` an accent bar, a background wash, a pulsing glyph and a heavier
title. That is correct reasoning applied to the wrong unit: one _state_ is loud, but every row in
that state is loud, so with four blocked sessions the panel had four focal points and therefore
none. The user's own diagnosis — good with one, too much with several — is precise.

**The setup screen explained itself at length.** Three numbered steps in a 320px column, each with
one or two paragraphs, a muted footnote and its buttons, over an intro paragraph that restated the
whole thing. It was all true and none of it was wrong, which is exactly how a screen with two
buttons on it ends up being mostly prose. The third step ("Restart running agents") was not a step
at all: there is nothing the user does in this app to satisfy it.

**A click reported nothing.** The PRD's rule is that a click is never a no-op, and the focus engine
honours it — `focusSession` always returns a typed `FocusResult`, and has since ADR-0007. But the
only consumer was the setup checklist. On the panel a click that could not find its window looked
identical to one that worked, and a click that took two seconds looked like a click that had been
ignored. Reading the engine with that in mind turned up two further faults: the fallback that opens
a folder in an editor (`open -b <bundle> <cwd>`) ran even after the adapter had reported
`window-not-found`, where it can only make a _new_ window rather than raise the one being asked
for; and because that fallback reports `method: 'window'` while needing no Accessibility grant, a
success from it made the permission step read `done` — so a user whose clicks were permanently
imprecise was told the opposite.

## Decision

### Marked is not loud

Two strengths, and the loud one is a single row.

- **Marked** (`row--blocked`, every `needs_input` row): an accent pill on the leading edge and the
  reason in amber. Enough to separate "stopped and stuck" from "stopped and finished" while
  scanning, and no more.
- **Loud** (`row--loud`, one row at most): the wash, the heavier title and the pulse — the only
  animation in the panel.

`loudSessionId` picks it, in `src/core`, from the session list and a map of acknowledgements. Two
rules, both from the user:

1. **The most recent.** Store order already puts `needs_input` first and most-recently-changed
   first, so the loud row is simply the first one still unacknowledged.
2. **Interacting calms it.** Clicking a row — or picking it from the tray dropdown — records the
   `updatedAt` it had at that moment. The row goes quiet: the user has been there and does not
   need it shouted at again. When the agent does something new `updatedAt` moves on, the
   acknowledgement no longer matches, and the row is loud again. Acknowledgement is keyed to the
   _event_, not the session, because "the user was aware of the thing" means that thing and not
   whatever happened next.

Acknowledgements live in memory (`useAcknowledged`) and are deliberately not persisted: relaunching
the widget is a fresh glance at the desk, and a click from last week must not silence a session
today.

### The setup screen says less

Two steps, not three. No intro. Three rules did the cutting:

- **A finished step collapses to its heading and chip.** It is a receipt, not an instruction, and
  the space belongs to whatever is still outstanding. `SetupStep` renders no body when the caller
  passes nothing, deciding "nothing" with `Children.toArray` — a body built from conditionals
  arrives as an array of `null`s, which is truthy, so testing `children` directly would keep
  rendering the box it is meant to drop.
- **Reassurance moves behind _Show the change_.** That existing hooks are kept and a backup is
  written first matters to a suspicious user, and a suspicious user is already pressing that
  button. It is the wrong thing to put between someone and the two controls the step is about.
- **The third step becomes one line of status.** `9 sessions found by the process scanner, none
reporting through the hooks — restart them for precise states.` A fact, under the list, with no
  number and no chip.

The consent model of ADR-0009 is untouched: the install still names the file it will change and
offers the exact diff before the button that writes it.

### A click says what it did

- **`PanelNotice`** renders one line above the legend, from `describeFocusOutcome` — `null` when the
  exact window came forward, and a sentence for anything else, including a degraded success
  ("Raised the app, not the window — grant Accessibility in Setup for an exact match"). It is
  neutral grey, not amber: amber means "a session needs you", and a report on a click is not that.
  It auto-dismisses after eight seconds and takes no space when there is nothing to say.
- **The row shows the click is in flight** — a spinner in the age column, `aria-busy`, and a
  guard that ignores a second press while the first is running rather than queueing a second
  AppleScript behind it.
- **`mayCreateWindow`** marks the folder-opening fallback, and `focusSessionWithRunner` skips such
  a step once any earlier attempt has returned `window-not-found`. The question has been answered:
  there is no such window, so the step could only make one. The user clicked to be taken to a
  running agent; handing them a fresh empty editor is worse than saying so.
- **`LastFocusOutcome.degraded`** carries whether a fallback got there, and the permission step
  requires an _undegraded_ `window`/`tab` success before it will read `done`.
- **The VS Code adapter raises before it activates**, through `System Events` rather than
  `tell application "Visual Studio Code" to activate`. Activating first meant two visible
  transitions — whatever window the editor last had comes forward, then the right one replaces it
  — which is the flicker a click is supposed to remove. Going through the process the script
  already holds also means the happy path needs Accessibility and nothing else, so there is no
  second Automation prompt for the editor. The terminal adapters already worked this way; this
  brings the editors into line.

### The panel's surface, and where its palette lives

The stylesheet is now driven from one token block — three radii, one spacing step, two easing
curves — so the panel is on a rhythm rather than accumulating pixel values: rounded accent pills
instead of full-height borders, a press state on every control, a decelerating curve on hover, the
count as a pill next to what it counts, tinted status chips, and `prefers-reduced-motion` and
`prefers-contrast: more` both answered.

Two things changed because the browser harness showed them. macOS's own overlay scrollbar replaced
the styled `::-webkit-scrollbar`, which opts into a _classic_ scrollbar and would take 7px of row
width — shifting every title sideways — the moment an eleventh session arrived. And the palette now
lives in `panel.css` alone, declared four times over: light on `:root` and `[data-theme='light']`,
dark under `prefers-color-scheme` and on `[data-theme='dark']`.

## Alternatives Considered

- **Loud only when there is exactly one blocked session** — the user's words, taken literally, and
  the first thing tried. Rejected because a row would restyle when a _sibling_ arrived: the panel
  is meant to be glanceable, and emphasis that moves for reasons outside the row it is on is worse
  than emphasis that is merely strong. "The most recent unacknowledged one" depends only on the
  row's own rank and its own history.
- **No loud row at all**, section heading only. Rejected: the one-blocked case is the case the
  product exists for, and it should still be impossible to miss from across a desk.
- **Persisting acknowledgements** to `panel.json` alongside the window frame. Rejected, above.
- **Acknowledging only on a _successful_ focus.** Rejected: the user expressed awareness by
  clicking. Whether macOS then cooperated is a separate question, and the notice answers it.
- **Removing the folder-opening fallback outright.** Rejected: when `cwd` really is a window root
  it lands on the exact window with no Accessibility grant at all, which is worth keeping for
  anyone who has not granted one. Gating it on `window-not-found` keeps the good case and drops
  the harmful one.
- **A wizard showing one step at a time.** Rejected as a way to uncrowd the setup screen: it hides
  what is left to do, and with two steps there is nothing to paginate.
- **Toast notifications for click results**, over the panel. Rejected: the panel is 320px of
  always-on-top screen the user has already given us, and an overlay inside it would cover the
  rows it is talking about.

## Consequences

The panel now has exactly one focal point regardless of how many agents are blocked, and it moves
as the user works through them. That is the property that was missing, and it is decided by a pure
function with a test per rule rather than by CSS reacting to a count.

The setup screen fits its window without scrolling in the common case, and the two steps read as
two jobs rather than as an essay.

What we have committed to: acknowledgement is per-run state, so the loud row comes back after a
relaunch, which is intended but will look like forgetfulness to anyone who expects otherwise. And
the permission step is now _harder_ to satisfy — it wants an undegraded precise click — so users
who relied on the folder-opening fallback will see `unknown` where they previously saw `done`. That
is the honest reading, and it points them at the grant that actually fixes their clicks.

`docs/ui-smoke-checklist.md` grows the cases CI cannot reach: that a second blocked session does
not restyle the first, that a click reports itself, and that the notice does not appear when the
click simply worked. The browser harness (`npm run preview:ui`) gained a `Setup` scene, a
`Glass (as shipped)` toggle and `#scene+glass+tall` hash routing, so any state can be linked to,
reloaded into or screenshotted from a command line — which is how this pass was reviewed, and how
the translucent-digit and scrollbar-shift faults were found.
