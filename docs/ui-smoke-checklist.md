# UI smoke checklist

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
- [ ] **Above a full-screen app.** Put a throwaway app (a new TextEdit document) into native full
      screen on the _same_ display the panel is on. The panel stays drawn over it (ADR-0010).
      Confirm it with `CGWindowListCopyWindowInfo(.optionOnScreenOnly)` — the panel must be in that
      list, at layer 25 — and with a screenshot. Not with `isVisible()` or `isOnActiveSpace()`:
      both return `true` for a window the window server is not compositing.
- [ ] **Clicking it over a full-screen app costs nothing.** Click the panel's legend strip while it
      floats over that full-screen Space: the Space must not change and the frontmost app must stay
      the full-screen one. One click, not two, must reach the panel (`acceptFirstMouse`).
- [ ] **Above a full-screen video call.** Same check with a Meet/Zoom call: the panel sits over
      full-screen video, and over the menu bar a full-screen app reveals on hover. It does not
      appear over the screen saver or the login window — that is intended (ADR-0010).
- [ ] **Every space.** Switch spaces with ctrl+←/→; the panel follows.
- [ ] **No Dock icon**, no app switcher entry (`ActivationPolicy::Accessory`).

## Drag vs click — the one that is easy to get wrong

- [ ] Press and drag the **header**: the panel moves.
- [ ] Press and drag the panel's **background** (the padding around the list, or the empty state):
      the panel moves.
- [ ] **Single-click a row**: it does _not_ move the panel; it raises that session's window (see
      `docs/focus-test-matrix.md` for what "raises" means per app).
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
- [ ] An ended session (close its terminal) disappears from the panel rather than lingering —
      ADR-0008's revision overturned the original "dim it at the bottom" decision.
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

## First run and setup (Phase 5)

Needs a machine where the hooks are **not** installed. Do not test this by removing your real
hooks: use a throwaway account, or move `~/.claude/settings.json` aside and put it back afterwards.

- [ ] With no widget entries in `~/.claude/settings.json`, the panel opens on the **Setup** view,
      not on the session list — and it does not flash the session list first.
- [ ] Step 1 names `~/.claude/settings.json`, says existing hooks are kept and a backup is written,
      and lists the five events it will add.
- [ ] **Show the change** prints the JSON that would be written; hiding it again works.
- [ ] **Install hooks** → the button reads `Installing…`, then a sentence appears saying how many
      events were registered and that running sessions need a restart.
- [ ] `~/.claude-agents-widget/hook.mjs` exists and is byte-identical to `hooks/claude-agents-widget-hook.mjs`.
- [ ] `~/.claude/settings.json.claude-agents-widget.bak` exists and is the **pre-install** file.
- [ ] Any hooks you already had are still there, unmodified.
- [ ] Pressing **Install hooks** again reports "already installed" and changes nothing.
- [ ] With a deliberately corrupted `settings.json` (`echo '{' > …`), step 1 reads `blocked`, offers
      no install button, and the file is left exactly as it was.
- [ ] Start a fresh Claude Code session: step 3 flips to `done` and the row appears in the panel.
- [ ] The **empty state** (no sessions, no hooks) shows an `Install hook` button — not a terminal
      command. Once the hooks are in and nothing is running, it reads "No agents running right now".
- [ ] Tray → `Setup / Diagnostics` reopens the view and reveals the panel if it was hidden.
- [ ] `Done` returns to the session list and stays there.
- [ ] **Open Automation** and **Open Accessibility** each open the right System Settings pane.
- [ ] With Accessibility **not** granted, click a row: it raises the app, and step 2 flips to
      `blocked` naming `permission-denied`. Grant it, click again: step 2 flips to `done`.
- [ ] **Copy diagnostics** puts a readable block on the clipboard containing the app version and
      the hook status — and **no session titles or project paths**.

## Installed-app checks (a real `.dmg`)

- [ ] The `.dmg` mounts, the app copies to `/Applications`.
- [ ] A plain double-click is refused by Gatekeeper; right-click → **Open** → **Open** works, and so
      does `xattr -dr com.apple.quarantine`.
- [ ] The installed app's Setup view can install the hooks — this is the path that proves
      `bundle.resources` shipped the hook script (a failure here reports `hook-resource-missing`).
- [ ] After replacing the app with a newer build, the Accessibility grant has to be given again —
      expected, and warned about in step 2.

## Footprint (PRD targets)

- [ ] Activity Monitor with ten sessions listed and the panel visible: ≤50 MB RSS.
- [ ] Idle CPU with the one-second ticker running: ~0% (the row-level memoisation is what makes
      this true; a regression here shows up as a percent or two).
