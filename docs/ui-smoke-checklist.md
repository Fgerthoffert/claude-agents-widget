# UI smoke checklist (Phase 3)

Everything here needs a real window, a real menu bar and, in places, a second monitor — so none
of it runs in CI. Work through it after `npm run tauri dev` (or a `--no-bundle` release build) and
note anything that differs; ADR-0008 records what the behaviour is _supposed_ to be.

Setup: at least three Claude Code sessions, one of them parked on a permission prompt.

```bash
source ~/.nvm/nvm.sh && nvm use
npm run tauri dev
```

## Window behaviour

- [ ] **Above all windows.** Bring Chrome, Slack and a terminal to the front in turn. The panel
      stays visible over each.
- [ ] **Above a full-screen video call.** Start a Meet/Zoom call, make it full screen, then check
      the panel. macOS treats full-screen apps as their own space — record what actually happens
      (visible / hidden / visible only on the desktop space), because ADR-0008 promises the
      observed behaviour, not the hoped-for one.
- [ ] **Every space.** Switch spaces with ctrl+←/→; the panel follows.
- [ ] **No Dock icon**, no app switcher entry (`ActivationPolicy::Accessory`).

## Drag vs click — the one that is easy to get wrong

- [ ] Press and drag the **header**: the panel moves.
- [ ] Press and drag the panel's **background** (the padding around the list, or the empty state):
      the panel moves.
- [ ] **Single-click a row**: it does _not_ move the panel. Until Phase 4 lands it logs
      `focus engine not installed yet` in the webview console — that is the expected stub.
- [ ] Press on a row and drag: the panel does _not_ move (rows are outside the drag region).
- [ ] **Double-click the header**: nothing happens (no maximize).
- [ ] Drag the panel from the built-in display to a second monitor and back. Movement is smooth,
      no flicker, no snapping back.
- [ ] Resize from a corner; rows reflow, titles truncate, no horizontal scrollbar appears.

## Position persistence

- [ ] Park the panel somewhere non-default, quit from the tray, relaunch: it comes back in the
      same place at the same size.
- [ ] Confirm `~/Library/Application Support/com.fgerthoffert.claude-agents-widget/panel.json`
      contains the frame.
- [ ] **Monitor gone.** Park it on the external monitor, quit, unplug the monitor, relaunch. The
      panel appears fully on the built-in display — never off-screen, never half off the bottom.
- [ ] Park it deliberately hanging off the bottom edge (about a third visible), quit, relaunch:
      that position is preserved (still ≥60% visible is left alone).

## Legibility at scale

- [ ] Ten concurrent sessions: every row shows a **name**, not a path or an id. Scroll works, the
      header stays put.
- [ ] Step back from the desk. The `needs_input` row is identifiable without reading — accent bar,
      amber dot, tint.
- [ ] Exactly one state is loud. `working` and `done_idle` rows are quiet.
- [ ] A session with a very long title truncates with an ellipsis on one line; hovering shows the
      full title, notification message and path.
- [ ] A session with no title yet shows the project directory name instead.
- [ ] `needs_input` rows read `needs permission` / `waiting for you` before the path, matching what
      the terminal is actually asking.
- [ ] Ages count up once a second and are single-unit (`12s` → `59s` → `1m` → `4m`).
- [ ] A scanner-discovered session (start a session, then `npm run install-hooks` was never run,
      or kill the hook dir) shows no age rather than a fake one.
- [ ] An ended session dims at the bottom of the list and disappears about five minutes later.
- [ ] Toggle macOS Appearance between Light and Dark: both are legible; nothing is grey-on-grey.

## Tray

- [ ] The menu bar shows the aggregate (`3▶ 2⏸ 1✔`) and it changes within a second or two of a
      session changing state.
- [ ] With nothing running it reads `idle`.
- [ ] The dropdown opens with the summary in words, then the sessions, glyph first.
- [ ] Clicking a session in the dropdown does the same thing as clicking its row.
- [ ] With more than ten active sessions the dropdown lists ten and then `…and N more in the panel`.
- [ ] `Show/Hide Panel` hides it; running it again brings it back **on top**, not behind.
- [ ] The panel's `✕` hides it and the tray brings it back.
- [ ] `Quit` actually quits (check Activity Monitor).

## Launch at login

- [ ] `Launch at Login` starts unchecked.
- [ ] Check it → `~/Library/LaunchAgents/` gains a plist for the app.
- [ ] Log out and back in: the app starts, the panel appears where it was left.
- [ ] Uncheck it → the plist is removed.

## Footprint (PRD targets)

- [ ] Activity Monitor with ten sessions listed and the panel visible: ≤50 MB RSS.
- [ ] Idle CPU with the one-second ticker running: ~0% (the row-level memoisation is what makes
      this true; a regression here shows up as a percent or two).
