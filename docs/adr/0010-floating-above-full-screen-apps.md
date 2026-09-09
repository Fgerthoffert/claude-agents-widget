# ADR-0010: Floating the panel above other apps' full-screen Spaces

- **Status**: Proposed — investigation complete, implementation deferred
- **Date**: 2026-09-09

## Context

The user works in native macOS full screen most of the day:

> "I use a fullscreen very often on my apps, is there a way to make it sit above fullscreen apps
> as well?"

Today `tauri.conf.json` sets `alwaysOnTop: true` and `visibleOnAllWorkspaces: true`. Neither is
enough, and ADR-0008 already flagged this as unverified ("whether always-on-top actually survives
a macOS full-screen space"). This ADR closes that question.

What the two options actually map to in AppKit:

| Tauri option             | AppKit                                           |
| ------------------------ | ------------------------------------------------ |
| `alwaysOnTop`            | `setLevel(NSFloatingWindowLevel)` — level 3      |
| `visibleOnAllWorkspaces` | `collectionBehavior \|= CanJoinAllSpaces` (1<<0) |

`tao` does nothing else to the window's Space handling — its whole involvement is one
`setCollectionBehavior` call for `CanJoinAllSpaces` and one `setLevel` call for `alwaysOnTop`
(`tao-0.35.3/src/platform_impl/macos/window.rs`). A full-screen app owns its Space; a window that
merely "joins all Spaces" is still not composited into it.

The textbook fix is `NSWindowCollectionBehaviorFullScreenAuxiliary` (1<<8) alongside
`CanJoinAllSpaces`, with a level at or above `NSStatusWindowLevel` (25). This is unreachable from
TypeScript and from Tauri's window API, so it is one of the cases ADR-0002 reserves for Rust.

Two routes were on the table:

1. **Minimal objc interop** on the existing `NSWindow` via `window.ns_window()`. `objc2 0.6.4` and
   `objc2-app-kit 0.3.2` are already in the tree via `tauri`/`wry`, and both `collectionBehavior`
   and `setLevel` are safe methods there — only turning the raw handle into a `&NSWindow` needs
   `unsafe`.
2. **`tauri-nspanel`**, which converts the window into a non-activating `NSPanel` — what menu-bar
   utilities use to float over full screen without activating the app or switching Spaces.

Route 1 was built and measured first.

## What was measured

Environment: macOS (Darwin 25.3), three displays, `tauri 2.11.5` / `tao 0.35.3`. A full-screen
Space was confirmed by the presence of the Dock's `Fullscreen Backdrop` window in
`CGWindowListCopyWindowInfo(.optionOnScreenOnly)`, and cross-checked against
`AXFullScreen` on the target window. Window level and Space membership were read back from both
`CGWindowList` (`kCGWindowLayer`, `kCGWindowIsOnscreen`) and, in-process, from AppKit itself.

**1. The flags are applied correctly and stay applied.** Reading the current mask and OR-ing into
it (never overwriting, so `tao`'s `CanJoinAllSpaces` survives) gives, from a temporary probe in
`setup`:

```
before=0x1  after=0x101  level=25
PROBE n behavior=0x101 level=25 visible=true      (stable across two minutes)
```

`0x101` is exactly `CanJoinAllSpaces | FullScreenAuxiliary`. Nothing in Tauri, `tao` or the
frontend resets it afterwards.

**2. Those flags are the right flags — on a plain `NSWindow`.** An isolated A/B harness (two
accessory-policy windows differing only in level and collection behaviour) was screenshotted over
another app's full-screen Space. Both were visible over it: `A` at level 3 with `CanJoinAllSpaces`
only, and `B` at level 25 with `0x101`. So the combination is correct and, on this macOS version,
even generous.

**3. But the same flags on the app's own window do not work.** In a deterministic single-display
run — the full-screen app and the panel both on the built-in display, the panel's position pinned
by an isolated `HOME` so no saved geometry could move it — the panel is at level 25 with
`behavior=0x101` and is simply **not composited into the full-screen Space**:

```
CAW_MODE=none   → backdrop=1  panel_onscreen=0
```

So route 1's flags are necessary but not sufficient: the difference is the `tao` window itself,
not the flag values.

**4. Only a real non-activating `NSPanel` gets in.** Separating the two halves of the `NSPanel`
conversion shows neither is enough alone:

```
CAW_MODE=class  (isa → NSPanel only)                     → panel_onscreen=0
CAW_MODE=style  (styleMask |= NonactivatingPanel only)   → panel_onscreen=0
CAW_MODE=both                                            → panel_onscreen=1, layer=25
```

With `both`, a screenshot confirms the panel drawn over a full-screen TextEdit document.

**5. The click/Space-switch question — the good news.** With the panel showing over another app's
full-screen Space, a synthetic click inside the panel (on the legend strip, never a session row)
left the frontmost application unchanged and the full-screen Space intact:

```
BEFORE: frontmost=<other app>   AFTER: frontmost=<other app>   panel still on screen: 1
```

The panel neither steals focus nor switches Spaces on a click, and it does not activate the app
when it appears. This is the non-activating panel behaving exactly as wanted, and it is the
property that makes the feature worth having: clicking a row still deliberately raises another
app's window (and that Space change is correct), but merely touching the panel costs nothing.

**6. The blocker.** Doing the conversion the cheap way — `object_setClass` to plain `NSPanel` plus
the `NonactivatingPanel` style bit — leaves the panel **blank white: the webview stops painting**.
The cause is visible in `tao`: its window is not an `NSWindow` but a `TaoWindow` subclass that
adds a `focusable` ivar and overrides three selectors — `canBecomeKeyWindow`,
`canBecomeMainWindow` (both reading that ivar) and `sendEvent:` (which is what makes
`movable_by_window_background` work under a WKWebView). Re-pointing the isa at plain `NSPanel`
discards all three. A borderless `NSPanel` returns `false` from `canBecomeKeyWindow`, the window
never becomes key, and the WKWebView never draws.

## Decision

**Route 2, via `tauri-nspanel` (or an equivalent `NSPanel` subclass that re-implements `TaoWindow`'s
three overrides) — not route 1.** Route 1 is measurably a no-op for this window, so it is not
shipped: a correct-looking flag change that does nothing is worse than no change, because the next
person reads it as already solved.

No functional change is merged with this ADR. What is merged is the finding, so the implementation
starts from evidence rather than from the textbook answer that does not hold here.

The flags route 2 must still set, on the converted panel, are unchanged from the measurements
above:

- `collectionBehavior |= CanJoinAllSpaces (1<<0) | FullScreenAuxiliary (1<<8)`, read-modify-write
  so `tao`'s own bits survive.
- `level = NSStatusWindowLevel (25)`.
- `styleMask |= NonactivatingPanel (1<<7)`, which only has meaning on an `NSPanel`.

## Alternatives Considered

- **Route 1 — flags on the existing `NSWindow`.** Rejected on measurement, not on principle: the
  flags apply, persist, and are provably the right ones on a plain `NSWindow`, but the panel still
  never enters another app's full-screen Space. Kept documented because it is the obvious first
  thing anyone will try again.
- **`object_setClass` to plain `NSPanel` in-repo, no new dependency.** Rejected: it does reach the
  full-screen Space and is properly non-activating, but it breaks rendering by discarding
  `TaoWindow`'s overrides. Re-implementing those overrides is precisely what `tauri-nspanel`
  already is; hand-rolling a second copy of it is not a smaller change, only a less tested one.
- **Raising the level higher than 25** (e.g. `NSScreenSaverWindowLevel`, or the private
  "screen saver" level some overlays use). Not pursued: level was shown not to be the
  discriminator here — level 3 and level 25 behaved identically on both window kinds — and
  sitting above the screen saver / notification layer is antisocial for a widget.
- **Re-asserting on hide/show and after a move.** Kept as a design requirement for route 2, but it
  is not what was wrong: the probe shows the mask and level surviving untouched for minutes,
  across the webview loading and the frontend's `setSize`/`setPosition`. Note that
  `setAlwaysOnTop(true)` does rewrite the level down to 3, so `togglePanelVisibility` must call
  the re-assertion _after_ it, not before.

## Consequences

The panel does **not** yet float above full-screen apps; the user's original question stays open
until route 2 lands. What this ADR buys is that route 2 is now the known answer with the failure
modes mapped, and nobody has to rediscover that the standard flag recipe is inert on a `tao`
window.

Committed to, when route 2 is implemented:

- A new Rust dependency and a window that is an `NSPanel` rather than an `NSWindow`. Everything
  that touches the window by handle — `setPosition`/`outerPosition` in `usePersistedPanelFrame`,
  `show`/`hide` in `togglePanelVisibility` and in the Rust tray fallback, and
  `core:window:allow-start-dragging` for the drag region — has to be re-verified against the
  panel, because `tauri-nspanel` supplies its own show/hide path.
- The re-assertion still belongs in TypeScript (ADR-0002): Rust answers "how", the frontend
  decides "when" — on mount, after every reveal, and after a move between displays.

Two limitations worth telling the user about regardless of route:

- A window at level 25 sits at the menu bar's level. It will cover the menu bar region of a
  full-screen app that reveals it on hover, and it will sit over full-screen video. It will
  **not** appear over anything drawing at the screen-saver or secure-input level (the login
  window, some screen recorders' overlays) — nor should it.
- Anything that rewrites the window level out from under us puts the panel back below full-screen
  apps until the next re-assertion. `setAlwaysOnTop` is the one in our own code.

## Notes on verifying this by hand

`docs/ui-smoke-checklist.md` cannot cover this in CI. The reproducible recipe, for whoever picks
route 2 up:

1. Put a throwaway app (TextEdit with a new document) into native full screen on the _same_
   display the panel is on — with several displays and Spaces-per-display, a panel on another
   display proves nothing.
2. Confirm the Space is genuinely full screen by looking for the Dock's `Fullscreen Backdrop`
   window in `CGWindowListCopyWindowInfo(.optionOnScreenOnly)`, not by eye: a zoomed window looks
   nearly identical in a screenshot.
3. Assert the panel's own window appears in that same on-screen list, then screenshot to confirm
   it is actually drawn — `isVisible()` and `isOnActiveSpace()` both return `true` for a window
   the window server is not compositing, so AppKit's own answer is not trustworthy here.
4. Pin the panel's position with an isolated `HOME`, so the persisted frame in `panel.json` cannot
   move it mid-test.
