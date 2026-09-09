# Click-to-focus manual test matrix

The focus engine touches window management, macOS consent and five host apps — none of which can
be exercised in CI (`osascript` is a side-effecting GUI action, and the runners are Linux). Unit
tests cover every decision with an injected runner; this matrix covers reality.

Run it before each release, and after any macOS or host-app upgrade. Target: **≥95% of rows land
the user in the right window** (PRD success metric).

## Before you start

1. Grant the permissions in [Permissions](#permissions) below — most failures are consent, not code.
2. Note which rows are already known-limited (marked _n/a_): they are documented in ADR-0007, not bugs.
3. For each row, record what the panel reported (`window` / `tab` / `app` / a failure reason)
   next to what actually happened on screen. A mismatch between the two is the interesting bug.

## Permissions

| Permission                 | Where                                                | Needed for                                           | Symptom when missing                                                                                                   |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Automation → System Events | System Settings ▸ Privacy & Security ▸ Automation    | every AppleScript adapter                            | `Not authorized to send Apple events` (-1743)                                                                          |
| Automation → the host app  | same                                                 | `activate`, and the Terminal/iTerm2/Ghostty adapters | same                                                                                                                   |
| **Accessibility**          | System Settings ▸ Privacy & Security ▸ Accessibility | VS Code / Cursor window raising only                 | `osascript is not allowed assistive access` (-1728); the panel reports `permission-denied` and still activates the app |

Accessibility cannot be prompted for usefully — it has to be granted by hand. Both failures are
reported as `permission-denied`, and a click still degrades to app activation, so the app is
never inert while consent is pending.

## Matrix

Result column: write the reported method/reason **and** whether the correct window was focused.

### VS Code (priority — every live session on the developer's machine runs here)

| #   | Scenario                                                                                       | Expected                                                                                                                   | Result |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| V1  | Session started in the integrated terminal, cwd = workspace root, one window open              | `window`, that window raised                                                                                               |        |
| V2  | Two windows open, session in the second, both workspaces distinct                              | `window`, the owning window raised                                                                                         |        |
| V3  | Session cwd is a **subdirectory** of the workspace root                                        | `window`, the owning window raised (pass-one title match should still find the root name)                                  |        |
| V4  | Session cwd is a **git worktree** under `.claude/worktrees/…`                                  | `window`; dot-directories are skipped so the repository name is still a candidate                                          |        |
| V5  | Two workspaces whose names share a prefix (`cortex`, `cortex-joe`), session in the shorter one | `window`, the **exact** workspace raised — not the prefix sibling                                                          |        |
| V6  | Two sessions in the **same** window (two integrated terminals)                                 | both report `window` and raise that window; the specific terminal tab is _n/a_ (ADR-0007)                                  |        |
| V7  | Owning window is on another macOS Space                                                        | `window`, macOS switches Space                                                                                             |        |
| V8  | Owning window is on a second monitor                                                           | `window`, focus moves to that monitor                                                                                      |        |
| V9  | Owning window is minimised                                                                     | `window` or `app`; VS Code comes forward                                                                                   |        |
| V10 | VS Code running with **zero** windows                                                          | `app` (activation)                                                                                                         |        |
| V11 | **Accessibility consent revoked**, cwd = workspace root                                        | `window` with `degradedFrom: permission-denied` via `open -b <id> <cwd>`; correct window raised, **no new window created** |        |
| V12 | Accessibility revoked, cwd is a subdirectory                                                   | `window` with `degradedFrom`; a **new** window for the subdirectory is the accepted behaviour here (ADR-0007)              |        |
| V13 | Automation consent for VS Code revoked, Accessibility granted                                  | `window` — the `activate` is `try`-wrapped, so the raise still happens                                                     |        |
| V14 | VS Code **not running**                                                                        | `app`: VS Code launches                                                                                                    |        |
| V15 | Session's `claude` process has exited (stale record)                                           | `window` or `app`; never a hang, never silence                                                                             |        |
| V16 | Workspace folder name contains a space, a quote and a backslash                                | `window`; no AppleScript error                                                                                             |        |
| V17 | Cursor, same as V1                                                                             | `window` (bundle id unverified — see ADR-0007)                                                                             |        |
| V18 | VS Code Insiders, same as V1                                                                   | `window`                                                                                                                   |        |

### Ghostty

| #   | Scenario                                                              | Expected                                                                                     | Result |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| G1  | Session in a Ghostty tab, cwd matches the surface's working directory | `tab`, that surface focused                                                                  |        |
| G2  | Two tabs in one window, session in the second                         | `tab`, correct tab                                                                           |        |
| G3  | Two windows                                                           | `tab`, correct window raised                                                                 |        |
| G4  | Split panes, session in one split                                     | `tab`, correct split focused                                                                 |        |
| G5  | The session's shell has `cd`-ed away from its start directory         | likely `none` → degrades to `app`; record what happened (cwd is Ghostty's only matching key) |        |
| G6  | Ghostty not running                                                   | `app`                                                                                        |        |

### Terminal.app (dictionary-verified, never run live — verify carefully)

| #   | Scenario                              | Expected                        | Result |
| --- | ------------------------------------- | ------------------------------- | ------ |
| T1  | Session in a tab of one window        | `tab`, correct tab selected     |        |
| T2  | Several tabs, session in a middle one | `tab`, correct tab              |        |
| T3  | Several windows                       | `tab`, correct window frontmost |        |
| T4  | Session in a background Space         | `tab`, Space switches           |        |
| T5  | Session on a second monitor           | `tab`                           |        |
| T6  | Session's process exited (tty gone)   | `app`                           |        |
| T7  | Terminal.app not running              | `app`                           |        |

### iTerm2 (dictionary-verified, never run live — verify carefully)

| #   | Scenario                      | Expected                    | Result |
| --- | ----------------------------- | --------------------------- | ------ |
| I1  | Session in a tab              | `tab`, correct tab          |        |
| I2  | Session in a **split pane**   | `tab`, correct pane focused |        |
| I3  | Several windows               | `tab`, correct window       |        |
| I4  | Session in a background Space | `tab`                       |        |
| I5  | Session on a second monitor   | `tab`                       |        |
| I6  | iTerm2 not running            | `app`                       |        |

### Fallbacks and degradation

| #   | Scenario                                                                               | Expected                                                                   | Result |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| F1  | Session in Warp                                                                        | `app` — Warp ships no scripting dictionary                                 |        |
| F2  | Session in an unrecognised terminal (Kitty, Alacritty, WezTerm…)                       | `unsupported-host` failure surfaced in the UI, no crash                    |        |
| F3  | Scanner-discovered session (started before the hook was installed) with a live process | same result as an equivalent hook session — the chain is rebuilt from `ps` |        |
| F4  | Session inside `tmux`                                                                  | out of scope for v1; record what happens                                   |        |
| F5  | Session over SSH in a local terminal                                                   | expect the local host to be focused                                        |        |
| F6  | Every consent revoked                                                                  | `app` for every row; never a silent no-op                                  |        |
