# ADR-0010: Floating the panel above other apps' full-screen Spaces

- **Status**: Accepted — route 2 implemented and measured (see the addendum at the end)
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

One more trap, found the hard way: during this investigation the frontend's
`invoke('float_above_fullscreen')` **never reached Rust in any run**, and failed completely
silently — the flags only ever got set by the `setup` call, and nothing in the logs said otherwise.
Whatever route 2 exposes to TypeScript needs a wiring test that fails loudly if the command is not
reachable, in the spirit of the permission assertions the repo already keeps for the drag region:
assert the command is registered in `generate_handler!`, not just that the TypeScript compiles.
App-local commands are not in `gen/schemas/acl-manifests.json`, so unlike a plugin command a
missing one produces no ACL error to notice.

## Addendum — 2026-09-09: route 2, implemented and measured

Route 2 shipped. What follows is what was built and what was measured on the real binary; the
investigation above is left untouched, because it is the record of why route 1 was rejected.

### What was built

- **`tauri-nspanel`, the `v2.1` line**, pinned by revision
  (`c9ec213`, version 2.1.0) rather than by branch — it is not published to crates.io.
  `v2.1` is a rewrite of the `v2` branch the investigation looked at: `objc2` instead of the
  deprecated `cocoa`/`objc` crates, a `tauri_panel!` macro that declares the `NSPanel` subclass
  and its selector overrides, and — decisively — an `examples/fullscreen` that is this exact use
  case. It is macOS-only, so it sits under `[target.'cfg(target_os = "macos")'.dependencies]`.
- **`src-tauri/src/floating_panel.rs`**, one `#[cfg(target_os = "macos")] mod`, ~95 lines. It
  declares the panel class with `can_become_key_window: true` (the override whose loss made a
  bare `object_setClass` render nothing) and `is_floating_panel: true`, converts the window once
  in `setup`, and exposes `float_panel_above_full_screen` as the only new `invoke` command.
- **Style mask and collection behaviour are read-modify-write**, via `StyleMask::from_raw` /
  `CollectionBehavior::from_raw`. The crate's own example overwrites both; that would have
  dropped `Resizable` (the panel is user-resizable, and the window is undecorated so the mask is
  the only thing keeping edge-resize alive) and `tao`'s `CanJoinAllSpaces`.
- **`src/ui/floatPanelAboveFullScreen.ts`** decides _when_, as ADR-0002 requires: called by
  `showPanel` and `togglePanelVisibility` **after** their `setAlwaysOnTop(true)`. Startup is
  covered by the Rust `setup` conversion, and a move needs nothing — the investigation already
  measured level and mask surviving `setSize`/`setPosition` untouched.
- **`src/ui/floatPanelAboveFullScreen.test.ts`** is the wiring test the notes above asked for: it
  extracts the command name from the `invoke(...)` call and asserts Rust registers that exact
  name in `generate_handler!`. Renaming either side fails the suite (checked by mutating
  `lib.rs`), which is the only place a silently unreachable app-local command is visible.

### What was measured

On the built `.app` (`npm run tauri build`, launched directly — never `tauri dev`), macOS
Darwin 25.3, three displays, with an isolated `HOME` so the persisted frame and `~/.claude` could
not interfere. Space membership came from `CGWindowListCopyWindowInfo(.optionOnScreenOnly)` and
the current Space's _type_ from `CGSCopyManagedDisplaySpaces` (`type=4` is full screen), because
`isVisible()`/`isOnActiveSpace()` cannot be trusted here. Note the Dock's `Fullscreen Backdrop`
window the investigation used as its tell **does not exist on this macOS version**; the Space type,
and the Dock's own window going `onscreen=false`, replace it.

**1. It works, and the window class really is the discriminator.** A/B on the same machine
minutes apart, same display, with another app full-screen on it:

```
control   (conversion skipped) layer=5  onscreen=0   ← reproduces finding 3 above
treatment (NSPanel)            layer=25 onscreen=1
```

Screenshots confirm it twice with the window server, not by inference: the panel drawn over a
full-screen TextEdit document (light popover material over white), and over a full-screen dark
editor (the same material picking up the dark backdrop). The tint changing with what is behind it
is also the proof that `transparent` + `windowEffects` survived the class change — an opaque
window cannot do that — as are the 18px rounded corners and the drop shadow.

**2. The webview paints.** This was route 1's blocker and it does not happen: every capture shows
fully rendered content — setup view, empty state, legend, emoji.

**3. Clicking costs nothing — but only after two more changes.** As first built, a click on the
panel over a full-screen Space did not switch Spaces (all three displays kept their Space uuid
and type) but _did_ make the widget the frontmost app, and needed **two** clicks to reach the
webview at all. Both come from the same place: `can_become_key_window: true` means a click takes
key, taking key activates an accessory app, and until the panel is key every click is an
"first mouse" click that AppKit swallows. The fix is the pair:

- `panel.set_becomes_key_only_if_needed(true)` — a click no longer takes key, so the app is not
  activated;
- `"acceptFirstMouse": true` in `tauri.conf.json` — the click still reaches the webview.

Measured after that, over a full-screen Space:

```
BEFORE: frontmost=Slack   spaces: [FULLSCREEN a, FULLSCREEN b, USER c]
click inside the panel
AFTER : frontmost=Slack   spaces: [FULLSCREEN a, FULLSCREEN b, USER c]
```

and a _single_ click on the panel's dismiss button hid it, with the frontmost app unchanged. This
is strictly better than the pre-conversion window, which took two clicks and stole focus on the
first.

**4. Everything the conversion could plausibly break was re-checked on the final binary.**

| Behaviour                                                       | Result                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `data-tauri-drag-region` drag (header grip)                     | moves the window by the exact delta, first press, no focus change                      |
| press-and-move drag (`useWindowDragOnMove` → `startWindowDrag`) | moves it too, short by the 4px `THRESHOLD`, from an element with no drag region        |
| drag across displays                                            | works; lands where the delta says                                                      |
| hide from the panel header                                      | `onscreen=0`; `isVisible()` correctly reports false afterwards                         |
| reveal from the tray's "Show/Hide Panel"                        | back `onscreen=1` at **layer 25** — which is also the proof the `invoke` executed      |
| tray icon, title and the TypeScript dropdown                    | unchanged: `idle` label, "No active sessions", Show/Hide, Setup, Launch at Login, Quit |
| position/size persistence                                       | restored the pinned frame on launch; wrote the dragged frame back to `panel.json`      |
| off-screen clamp                                                | a saved frame outside every monitor was moved onto one instead of vanishing            |
| setup view / first-run                                          | opened from "Setup & diagnostics", buttons live, hooks installed into the temp HOME    |

**5. The `invoke` path is proven, not assumed.** `setAlwaysOnTop(true)` cannot produce level 25 —
on the unconverted control it produced 5. Every TypeScript reveal path ends with the window at 25,
so `float_panel_above_full_screen` demonstrably ran. This is the failure the notes above warned
about, closed by measurement as well as by the wiring test.

### Not verified, and why

The **Rust fallback tray menu** could not be exercised: `useTray` replaces it within ~0.4s of
launch and the launch race could not be won reliably. Its `toggle_panel` calls the same
`is_visible()` / `hide()` / `show()` / `set_focus()` Tauri APIs that the TypeScript toggle drove
successfully on the converted panel, and it is unchanged by this work — but the fallback _menu_
itself was not seen on screen.

Separately, and pre-existing: a frame saved in physical pixels cannot address a display whose
scale factor differs from the window's current one, because `setPosition` converts with the
window's scale. On a 2× + 1× mix the panel cannot be restored onto the 1× display. Out of scope
here; worth an issue.

### Limitations that stand

Unchanged from the Consequences above, and now confirmed rather than predicted:

- Level 25 is the menu bar's level. The panel covers the menu bar region a full-screen app reveals
  on hover, and it sits over full-screen video. It does **not** appear over screen-saver or
  secure-input windows (the login window, some recorders' overlays) — nor should it.
- Anything that rewrites the window level puts the panel back below full-screen apps until the
  next re-assertion. `setAlwaysOnTop` is the only such call in our own code, and both callers
  re-assert immediately after it.
- The panel is now an `NSPanel`, so `NSPanel` semantics apply: Escape can close it (hence
  `set_released_when_closed(false)`, so a stray close is survivable), and a floating panel would
  hide on app deactivation (hence `set_hides_on_deactivate(false)`, since this app is never
  active).
