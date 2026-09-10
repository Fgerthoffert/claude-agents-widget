# ADR-0016: The widget never opens a window

- **Status**: Accepted
- **Date**: 2026-09-10

## Context

A report against v0.5.0, and the first bug found in the focus engine by using it:

> "I've seen for a few times that, in some occasions, clicking on the entry in the widget was
> opening a new vscode window, instead of focusing back to the window currently running. This is
> currently happening for a claude session named `upgrade-hhtpclient5…`, every time I click on it
> it opens a new VS Code window."

The session is real and was diagnosed from the machine it happens on. Its hook record is complete:
host VS Code, `claudePid` alive, `cwd` = `~/GitHub/Jahia/cortex-agents/cortex-nick/cortex` — a
repository nested inside another checkout. Running the exact AppleScript the engine builds for it,
read-only, returns `none`: the only VS Code window open is titled `claude-agents-widget`, so none
of the three title candidates (`cortex`, `cortex-nick`, `cortex-agents`) can match.

`none` means `window-not-found`, and ADR-0013 already skips the folder-opening step on
`window-not-found` — so on paper this cannot happen. The bundle on disk is 0.5.0, installed at
09:18, and the running process started at 10:08, so the fix was live. Which leaves exactly one
family of explanations: the AppleScript step did not _return_ `none` on the widget's own attempt,
it **failed** — and the overwhelmingly likely reason is a missing Accessibility grant, because
the grant is attached to the app bundle and the user had replaced the bundle an hour earlier.
The same script run from a shell that _does_ hold the grant returns `none` cleanly.

So the gate was written the wrong way round. ADR-0013 skipped the window-creating step on the one
failure that _proves the window is absent_, and let it run on every failure that proves nothing:
a refused grant, a broken script, a timeout. Those are precisely the cases where nothing is known
— and where a step that might open a window will, because the fallback runs on every click.

Two other things this exposed. `open -b <bundle> <cwd>` never could tell "raised the window
holding that folder" from "made a new window for that folder" — ADR-0013 recorded that as a
known trade and kept the step for its good case. And the app log, which ADR-0011 introduced
precisely so that failures would be visible in a packaged build, records detection and nothing
else: there was no trace of any click, so this had to be diagnosed by reading code.

## Decision

### The folder-opening step is deleted

`open -b <bundle> <cwd>` is gone from `buildFocusPlan`, along with `FocusHost.opensPaths`,
`FocusStep.mayCreateWindow`, the `windowIsGone` bookkeeping in `focusSessionWithRunner`, and the
`open-bundle-path` entry in `src-tauri/capabilities/default.json` — so the app no longer holds
permission to run `open` with a path at all.

The chain is now two steps: the adapter's AppleScript for an exact window or tab, then
`open -b <bundle>` for plain activation.

The argument for keeping it was that when `cwd` really is a window root it lands on the exact
window with no Accessibility grant. But that case is unreachable in any justified form: the step
is only safe once something has established that the window exists, and anything that can
establish that can raise the window directly. As a blind fallback it hands the user a brand-new
empty editor instead of the agent they clicked on — a worse answer than "I could only raise the
app", and a destructive one, because now they have a window to close.

**A widget that takes you to a window must never make one.** That is the rule, and it is worth
more than the precision it costs.

### Every click is logged

`logDetection` becomes `logToApp` — it was always about the log rather than about detection — and
`onSessionClick`, the single funnel for panel and tray clicks alike, writes one line per click:
`info` for a clean success, `warn` for a degraded one or a failure, with the host, the method or
reason, and the underlying error text. The session id is a UUID prefix; no titles are logged.

ADR-0011's rule was "a failure the user cannot see is a failure that gets reported as something
else". It was applied to detection and not to focus, and this bug is what that costs.

### The notice carries the way out

When macOS refused the click, the panel's notice now offers **Open Accessibility** inline. The
grant is voided by every app update, so this is a message the user will see after every release;
"grant Accessibility in Setup" was three navigations away from the row they had just pressed.

## Alternatives Considered

- **Widen the gate instead of removing the step** — skip the folder-open on any failure, not just
  `window-not-found`. This is the one-line fix and it is wrong in the same way as the original:
  it leaves a step in the plan that can only ever run when we know nothing, so its only remaining
  purpose is to act on ignorance.
- **Only open the folder when `cwd` looks like a workspace root** (a `.git` directory, say).
  Rejected on this very session: `cortex-nick/cortex` is a git repository _and_ is not an open
  window. The test does not answer the question being asked.
- **Read VS Code's own window state** from
  `~/Library/Application Support/Code/User/globalStorage/storage.json` to find out which folders
  are open. Rejected: it makes the widget depend on the private on-disk format of another
  application, for a fallback that only matters to users who have not granted a permission the
  setup screen asks them for on the first run.
- **Prompt for Accessibility instead of degrading.** macOS does not allow it — the grant cannot
  be requested by the app that needs it, only granted in System Settings, which is why the
  checklist has never claimed the step is done without proof (ADR-0009).
- **Keep the step behind the setting.** Rejected: a preference whose honest description is "when
  I cannot find your window, open a new one" is not a preference anybody wants.

## Consequences

Clicking a row can now do exactly two things: raise the exact window, or bring the app forward.
It can no longer create anything. Users without the Accessibility grant lose the occasional exact
hit they used to get by luck, and gain a notice that says what happened and a button that fixes
it permanently.

The app's shell allowlist shrank by one command, which is the kind of consequence worth having.

The next report against the focus engine will come with a log. That is the part of this that
should have been true before the first one.

What this does not fix: with a single VS Code window holding many integrated-terminal tabs — the
shape this user actually runs — every session in that window resolves to the same window, and
tab-level precision inside VS Code remains out of scope (ADR-0007) because VS Code exposes no
scripting interface for it. Clicking any of those rows raises the right window and leaves the
user to pick the tab.
