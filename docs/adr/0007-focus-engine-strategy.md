# ADR-0007: Focus engine — per-app strategies, degradation chain, and escaping

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

Click-to-focus is the make-or-break feature: the closest competitor, claude-status, was rejected
partly because clicking a session did nothing in this user's environment (PRD, Evidence). The
PRD's quality bar is therefore not "focus works for the apps we chose" but **"a click is never a
no-op"**.

Phase 2 left us a nearest-first ancestor chain per session, and one real chain proved sessions run
in the **VS Code integrated terminal**. Surveying this machine while building phase 4 made that
much stronger: of the nine live `claude` processes, **nine out of nine** were owned by
`Visual Studio Code.app`, on ttys `001`–`022`. Terminal.app and iTerm2 were not running at all;
Ghostty was. VS Code is not one adapter among three — it is the path.

## Decision

### An ordered degradation chain, not a single recipe

`buildFocusPlan` returns a list of attempts, precise first, and `focusSessionWithRunner` walks it
until one succeeds. Every outcome is a typed `FocusResult`; there is no code path that silently
does nothing. For an editor the chain is:

1. the adapter's AppleScript — exact window;
2. `open -b <bundleId> <cwd>` — verified on this machine to raise the **existing** VS Code window
   holding that folder (renderer-process count unchanged, `Code` became frontmost) and to need no
   Accessibility consent. It is second, not first, because it opens a _new_ window when `cwd` is
   not itself a window root;
3. `open -b <bundleId>` — plain activation, which needs no consent of any kind.

Terminals skip step 2: asking Terminal.app or Ghostty to "open" a directory spawns a new window
rather than finding an existing one, which is worse than activating the app.

A success carries `degradedFrom`, the reason the _precise_ attempt failed. A fallback that worked
therefore still tells the UI and phase 5's first-run guide that Accessibility consent is missing.
When every step fails, the **first** failure is reported, because that is the diagnostic one.

### What actually works, per app (measured, not assumed)

| App                        | Technique                                                                                                                                                       | Evidence                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code**                | `System Events` → `windows of process "Code"` → title match → `perform action "AXRaise"`, after a `try`-wrapped `activate`. Requires **Accessibility** consent. | Ran the generated script live: exact workspace → `window`, exit 0, correct window raised; non-existent workspace → `none`, exit 0.                                                                                                                             |
| VS Code (no Accessibility) | `open -b com.microsoft.VSCode <cwd>`                                                                                                                            | Ran live: focused the existing window for an open folder, opened no new one.                                                                                                                                                                                   |
| **Ghostty**                | `working directory of terminal` match → `focus <surface>`                                                                                                       | Ran the generated script live: returned `tab`, exit 0, raised the surface.                                                                                                                                                                                     |
| **Terminal.app**           | `tty of tab` match → `set selected of tab`, `set frontmost of window`, `activate`                                                                               | `Terminal.sdef` confirms read-only `tty` on `tab`, writable `selected`, writable `frontmost` on `window`. Script compiles against the real dictionary (`osacompile`, exit 0). Not exercised live — the app was not running and launching it was out of bounds. |
| **iTerm2**                 | `tty of session` match → `select` session, tab, window → `activate`                                                                                             | `iTerm2.sdef` confirms read-only `tty` on `session` and a `select` command. Script compiles against the real dictionary. Not exercised live.                                                                                                                   |
| Warp                       | activation only                                                                                                                                                 | `Warp.app` ships no `.sdef`; there is nothing to script.                                                                                                                                                                                                       |
| Cursor, VS Code Insiders   | the VS Code adapter, parameterised                                                                                                                              | Trivial variants. Cursor's ToDesktop bundle id is taken from public sources and is **unverified**.                                                                                                                                                             |
| anything else              | `open -b` if a bundle id is derivable, else a typed failure                                                                                                     | —                                                                                                                                                                                                                                                              |

`identifyOwnerApp` correctly resolved all nine live sessions on this machine to `vscode`.

### VS Code title matching is two-pass

A VS Code title reads `file.ts — workspaceRoot`. Substring matching alone is wrong: a session in
`…/Jahia/cortex` matched and raised a `cortex-joe` window during testing. Pass one therefore
compares whole names — `title is candidate` or `title ends with " — " & candidate` — and pass two
relaxes to a substring so a customised `window.title` still lands in the right app. Candidates are
the `cwd` path segments, deepest first, capped at three, with dot-directories dropped so a
`…/repo/.claude/worktrees/agent-1` path still reaches `repo`.

### Escaping is a security boundary, not a formatting detail

`escapeAppleScriptString` is applied to every interpolated value — cwd, title fragments, tty, app
names. Session-derived text is untrusted: a directory named `" & (do shell script "id") & "` would
otherwise reach the interpreter. Backslash and quote are escaped, `\n`/`\r`/`\t` are given their
literal forms, every other control character and the Unicode line/paragraph separators are
dropped, and values are truncated to 512 characters. Adversarial payloads are unit-tested against
a checker that proves the literal cannot be closed.

Second line of defence: every generated script begins with `-- claude-agents-widget focus`, and
the `osascript` entry in `capabilities/default.json` requires that prefix. An argument that did
not come from `buildFocusScript` cannot be handed to `osascript`.

### Additions to the phase-4 plan

- **`tty` is resolved at click time, not captured by the hook.** The plan's risk table offered to
  add tty capture to the hook. Running `ps -o tty= -p <claudePid>` in the focus shell instead
  needs no change to the hook, the record format or `src/core/types.ts` — and it works for
  scanner-discovered sessions too, which no hook ever saw.
- **Scanner sessions are focusable.** The plan allowed them to degrade to "cannot focus". Instead,
  when `ancestors` is empty, `parseProcessAncestors` rebuilds the chain live from the same
  `ps -axo pid=,ppid=,command=` output the scanner already uses. A scanner session with a live
  process now focuses exactly like a hook session.
- **Ghostty and Warp adapters.** Not in the plan, but Ghostty was running on this machine and
  ships a real scripting dictionary (`focus`, `working directory`), so it is a precise adapter for
  the cost of one file. Warp is activation-only.
- **A second types-only module.** `src/core/focus/types.ts` exists alongside `src/core/types.ts`,
  which `CLAUDE.md` names as the single multi-export exception. The focus engine owns a large
  private vocabulary, and keeping it out of the shared file also avoids colliding with phase 3.
- **`focusSessionWithRunner` lives in `src/core` and returns a promise.** It performs no IO of its
  own: the runner is injected. `CLAUDE.md` puts judgement in `src/core`, and the fallback chain is
  judgement. `src/detection/focusSession.ts` is the thin shell that supplies a Tauri-backed runner
  and the three-second per-command timeout.
- **No Rust changes.** The shell plugin was already registered in phase 2; phase 4 adds four
  allowlisted commands to `capabilities/default.json` and nothing else. ADR-0002 holds.

## Alternatives Considered

- **`open -b <bundleId> <cwd>` as the primary VS Code route** — rejected as _primary_: it opens a
  duplicate window when the session's cwd is a subdirectory of the workspace root. Kept as the
  no-consent fallback, where a duplicate window still beats doing nothing.
- **Matching VS Code windows by the extension-host PID in the ancestor chain** — investigated and
  rejected: the extension host's own cwd is `/`. Only its language-server _children_ sit in the
  workspace folder, which is too indirect to rely on.
- **Reading `~/Library/Application Support/Code/User/globalStorage/storage.json`** for the list of
  open workspaces — rejected: `windowsState` is written at quit time, so it describes the previous
  session, not the current windows.
- **Capturing tty in the hook script** — rejected in favour of resolving it at click time; see
  above.
- **Swallowing permission errors inside the AppleScript** so a click always looks successful —
  rejected: phase 5 needs to distinguish "no consent" from "no matching window" to guide the user.
- **A permissive `osascript` argument validator** — the validator cannot meaningfully restrict an
  AppleScript body, so it pins the marker prefix instead and the real boundary stays the escaper.

## Consequences

Clicking a session lands the user in the right VS Code window once Accessibility consent is
granted, and in the right app even before that. The costs:

- **Tab-level precision inside VS Code is out of scope**, and on this machine that bites: all nine
  live sessions share a **single** VS Code window. Clicking any of them raises that window without
  selecting the specific integrated-terminal tab. VS Code exposes no scripting surface for it
  (`get name of every window` on the app itself fails with -1728), so closing this gap would need
  a VS Code extension. Two sessions in the same window are indistinguishable to the focus engine.
- **Two macOS consent surfaces.** Automation (Apple Events) to `System Events`, `Visual Studio
Code`, `Terminal`, `iTerm` and `Ghostty`, plus **Accessibility** for the VS Code window walk.
  Automation prompts per target app on first use; Accessibility must be granted manually in
  System Settings and cannot be prompted for meaningfully. Both were observed: a missing
  Accessibility grant produces `osascript is not allowed assistive access. (-1728)`, which is
  classified as `permission-denied` by message text — -1728 alone also means "can't get that
  object", so the number is not sufficient.
- **Terminal.app and iTerm2 are dictionary- and compile-verified but not run.** They stay on the
  manual matrix in `docs/focus-test-matrix.md` until exercised on real sessions.
- Adding a terminal remains additive: one adapter file, one entry in the `buildFocusScript` map,
  one row in `identifyOwnerApp`, and tests.
