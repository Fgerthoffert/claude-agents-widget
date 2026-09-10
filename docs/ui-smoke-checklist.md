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
      full-screen video. It does not appear over the screen saver or the login window, and it can
      go _under_ a full-screen app's own menu-bar strip (that strip measures at layer 26, above the
      panel's 25) — both are intended (ADR-0010).
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

## Auto height (ADR-0015)

- [ ] With two agents the window is short and tightly fitted: no dead space under the last row,
      nothing clipped, the legend flush to the bottom.
- [ ] Start a third: the window grows by exactly one row's worth. End one: it shrinks back.
- [ ] With a dozen agents nothing scrolls — the window is as tall as the list, and no row is
      half-visible at the bottom of a section.
- [ ] Fill the panel past the height of the display: it stops growing a little short of the work
      area, stays fully on screen, and the sections scroll from there.
- [ ] It never covers the menu bar, and never grows off the bottom of the screen.
- [ ] Shrink the panel to two agents, then open **Setup / Diagnostics**: the window grows to fit
      the whole guide rather than scrolling it in 190px. Press Done: it shrinks back.
- [ ] With a precise click on record, the one step collapses to a heading and a chip — and the
      window **shrinks** to match. This is the case that catches a measurement which can only
      grow (ADR-0015).
- [ ] The exact-change preview never makes the window taller than the screen: it is capped at
      130px and scrolls inside itself.
- [ ] Resize the width by dragging a side edge: the width sticks, and is still there after a
      restart. Auto height only ever touches the height.
- [ ] Turn **Fit the height to the agents** off in Setup. Drag the bottom edge, quit, relaunch:
      the height you chose comes back.
- [ ] Turn it back on: the window fits itself again on the next change.
- [ ] On a Retina display the height is right, not half or double — the measurement is in CSS
      pixels and the window wants physical ones.

## Position persistence

- [ ] Park the panel somewhere non-default, quit from the tray, relaunch: it comes back in the
      same place at the same size.
- [ ] Confirm `~/Library/Application Support/com.fgerthoffert.claude-agents-widget/panel.json`
      contains the frame.
- [ ] **Monitor gone.** Park it on the external monitor, quit, unplug the monitor, relaunch. The
      panel appears fully on the built-in display — never off-screen, never half off the bottom.
- [ ] Park it deliberately hanging off the bottom edge (about a third visible), quit, relaunch:
      that position is preserved (still ≥60% visible is left alone).

## The three sections (ADR-0014)

- [ ] **Waiting for you** holds only sessions blocked on an answer. A session that merely finished
      its turn is under **Done**, never under Waiting.
- [ ] Leave a session untouched until Claude Code fires its idle notification: it lands in
      **Done**, not in Waiting. Being idle blocks nothing.
- [ ] With all three populated, the panel shows Running, then Waiting for you, then Done — and
      each scrolls independently without squeezing the others out.
- [ ] An empty section is absent entirely, heading and all.
- [ ] `/clear` a session: the old row disappears and the replacement appears under **Done**, not
      under Running. It must not claim to be working before you have typed anything.
- [ ] Same for `/resume` and starting a fresh `claude`: the new session arrives idle.
- [ ] `/compact` does **not** create a second row — compaction keeps the same session going.
- [ ] Run two sessions in one terminal in turn (`/clear` between them): there is never more than
      one row for that terminal, even if `SessionEnd` never fires for the first.

## The session source (ADR-0018)

- [ ] Run `claude agents --json` yourself. Every session it lists is a row in the panel, and
      every row is in that list — no extras, no omissions.
- [ ] Open Agent View (`claude agents`) and leave it running. The panel does **not** gain rows
      for the supervisor, its `bg-pty-host` helpers or `claude agents` itself. (The old `ps`
      scanner counted all of them: ten rows where there were four.)
- [ ] Dispatch a background session from Agent View. It appears in the panel, and its row says
      what it is doing.
- [ ] Row titles are Claude Code's own session names, matching what Agent View shows.
- [ ] Temporarily rename `claude` on your PATH and relaunch: the panel says detection is not
      running and names the command, rather than showing an empty list.
- [ ] Put it back: the next poll recovers on its own, with no restart.
- [ ] `~/.claude/settings.json` is untouched, and `~/.claude-agents-widget/` is never created.

## Legibility at scale

- [ ] Ten concurrent sessions: every row shows a **name**, not a path or an id. Scroll works, the
      header stays put.
- [ ] Step back from the desk. The `needs_input` row is identifiable without reading — accent
      pill, amber reason, tint.
- [ ] Exactly **one row** is loud (wash + pulsing glyph), not one state (ADR-0013). Block a second
      session: the first keeps its accent pill and amber reason but loses the wash and the pulse,
      and it does not move or change size while doing so.
- [ ] The loud row is the most recently blocked one.
- [ ] Click the loud row. It goes calm — accent pill only — and the loud treatment moves to the
      next blocked session you have not been to.
- [ ] Answer nothing, go back to that session in its terminal and let it prompt you again: it is
      loud a second time. (Acknowledgement is per event, not per session.)
- [ ] Quit and relaunch the widget with a session still blocked: it is loud again. Acknowledgement
      is deliberately not persisted.
- [ ] `working` and `done_idle` rows carry no accent pill at all.
- [ ] A session with a very long title truncates with an ellipsis on one line; hovering shows the
      full title, notification message and path.
- [ ] A session with no title yet shows the project directory name instead.
- [ ] `needs_input` rows read `needs permission` / `agent needs input` before the path, matching
      what the terminal is actually asking. `waiting for you` is gone: an idle session is no
      longer `needs_input` at all (ADR-0014).
- [ ] Ages count up once a second and are single-unit (`12s` → `59s` → `1m` → `4m`).
- [ ] Every row shows an age, and it counts up rather than resetting each poll.
- [ ] Close a session's terminal: its row disappears on the next poll.
- [ ] Toggle macOS Appearance between Light and Dark: both are legible; nothing is grey-on-grey.
- [ ] Park the panel over something bright and busy — a photo, a colourful web page. Titles, paths
      and the setup step numbers all stay readable through the glass.
- [ ] Grow the list past the window height. Rows do not shift sideways as the scrollbar appears:
      macOS's overlay scrollbar floats over them rather than taking width (ADR-0013).

## Clicking a row

- [ ] A click that lands on the exact window shows **no** message. Silence is the success case.
- [ ] While a click is being acted on, that row shows a spinner where its age was, and pressing it
      again does nothing until the first attempt finishes.
- [ ] Revoke Accessibility for the widget, then click a VS Code session: the app comes forward, and
      a one-line notice says the exact window could not be reached and names the grant. It clears
      itself after a few seconds, or on its `✕`.
- [ ] Close a session's terminal window without ending the session, then click its row: the notice
      says the window is gone, and **no new editor window is opened**.
- [ ] Revoke Accessibility, then click a VS Code session whose folder is **not** the root of any
      open window (a nested repo, or a subdirectory): the app comes forward and **no new window
      appears**. This is the ADR-0016 regression — the widget must never create a window, whatever
      the precise attempt did.
- [ ] Every click leaves a line in `~/Library/Logs/com.fgerthoffert.claude-agents-widget/`:
      `info` when it landed on the window, `warn` with the reason when it did not.
- [ ] After an app update, the first click reports the refused grant **and** offers
      **Open Accessibility** in the notice; pressing it opens the right pane.
- [ ] With Accessibility granted, click a VS Code session in a window that is not frontmost: the
      correct window comes forward in one movement, with no flash of a different window first.
- [ ] Click a session in a repo whose name is a prefix of a sibling's (`cortex` next to
      `cortex-joe`): the right window comes forward, not the sibling.

## Tray

- [ ] The menu bar shows `●` within a second or two of a session becoming **blocked**, and clears
      again within a second or two of it being answered.
- [ ] A session that merely **finishes** does not raise the mark (ADR-0014). Only a real question
      does — otherwise the mark is usually noise and stops being read.
- [ ] It carries no number, whether one session is blocked or ten.
- [ ] With nothing blocked — nothing running, everything mid-turn, or everything simply done — it
      is icon only.
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

## Setup and diagnostics

- [ ] The panel opens on the **session list**, never on Setup: there is nothing to install, so
      there is no first run to interrupt (ADR-0018).
- [ ] Tray → `Setup / Diagnostics` opens it and reveals the panel if it was hidden.
- [ ] There is exactly **one** numbered step, and it is the macOS permission.
- [ ] **Open Accessibility** and **Open Automation** each open the right System Settings pane.
- [ ] With Accessibility **not** granted, click a row: it raises the app, and the step flips to
      `blocked` naming `permission-denied`, and only then explains the app-bundle trap. Grant it,
      click again: the step flips to `done` and collapses to its heading.
- [ ] `Done` returns to the session list and stays there.
- [ ] **Copy diagnostics** puts a readable block on the clipboard with the app version, the log
      path and the session counts — and **no session titles or project paths**.

## Installed-app checks (a real `.dmg`)

- [ ] The `.dmg` mounts, the app copies to `/Applications`.
- [ ] A plain double-click is refused by Gatekeeper; right-click → **Open** → **Open** works, and so
      does `xattr -dr com.apple.quarantine`.
- [ ] The installed app finds `claude` on its own: launched from Finder it lists sessions, which
      proves the login-shell lookup works where a bare `PATH` would not (ADR-0018).
- [ ] After replacing the app with a newer build, the Accessibility grant has to be given again —
      expected, and warned about in step 2.

## Footprint (PRD targets)

- [ ] Activity Monitor with ten sessions listed and the panel visible: ≤50 MB RSS.
- [ ] Idle CPU with the one-second ticker running: ~0% (the row-level memoisation is what makes
      this true; a regression here shows up as a percent or two).
