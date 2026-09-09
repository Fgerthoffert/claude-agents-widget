# Plan: Phase 4 — Focus Engine

## Summary

Turn a clicked session into a focused window. Identify the owning app from the captured ancestor process chain, then run a per-app focus adapter (AppleScript via `osascript`) that raises the exact window/tab. This is the make-or-break feature: the closest competitor (claude-status) failed at precisely this in the user's environment, so reliability and graceful degradation matter more than breadth.

## Metadata

- **Complexity**: Large (OS integration, brittle surface area, needs careful fallbacks)
- **Source PRD**: `.claude/PRPs/prds/claude-agents-widget.prd.md`
- **PRD Phase**: 4 — Focus engine (depends on Phase 2, parallel with Phase 3)
- Read first: `CLAUDE.md`, `docs/adr/0002` (thin Rust core), `docs/adr/0006` (hook + state file IPC), `src/core/types.ts`, `src/detection/` (store + scanner shell), any existing `src/core/` function for style

## Phase 2 handoff — what you already have

`Session` (`src/core/types.ts`) carries `ancestors: readonly {pid, comm, args}[]` plus a pre-resolved `claudePid`. Verified live on this machine, a real chain (nearest-first, terminating at PID 1):

```
/bin/zsh → claude → /bin/zsh → Code Helper (node.mojom.NodeService)
        → /Applications/Visual Studio Code.app/Contents/MacOS/Code → /sbin/launchd
```

Critical caveats established in Phase 2:

- Match on **`args`**, not `comm` (`comm` may be truncated in some `ps` formats).
- Match **case-sensitively**: `Claude` / `Claude Helper` are the _desktop app_, not a CLI session.
- `ancestors` is **empty for `source: 'scanner'` sessions** — the scanner cannot see a parent chain. Those must degrade to app-level or a clear "cannot focus" state, never a silent no-op.

**Environment insight**: that real chain proves the user runs sessions inside the **VS Code integrated terminal** — the hardest case to focus, and the likely reason claude-status failed for them. Treat VS Code as the priority adapter, not an afterthought.

## Architecture

```
Session.ancestors ──> identifyOwnerApp() ──> {app: 'vscode'|'iterm2'|'terminal'|'unknown', bundleId, windowHint}
                                                     │
                              focusAdapters[app] ──> osascript ──> raised window
                                                     │ failure
                                              app-level fallback (open -b <bundleId>)
```

- **Pure core** (`src/core/focus/`, one exported arrow function per file, exhaustively unit-tested against synthetic ancestor arrays):
  - `identifyOwnerApp(ancestors)` → discriminated union result. Walk from nearest to furthest ancestor; first recognized app wins (the _nearest_ GUI app owns the session).
  - `buildFocusScript(target)` → the AppleScript string for a target (pure string builder = fully testable without running osascript).
  - `escapeAppleScriptString(value)` → quoting/escaping helper; MUST be applied to every interpolated value (cwd, titles, session ids). Treat this as a security boundary: never interpolate raw session-derived text into a script.
- **Imperative shell** (`src/detection/focusSession.ts` or similar): resolve target → build script → run via `@tauri-apps/plugin-shell` → on non-zero exit or timeout, run the app-level fallback → return a typed result (`{ok: true, method: 'window'|'tab'|'app'}` | `{ok: false, reason}`) so Phase 3's UI can show what happened.
- Tauri capability: allow `osascript` (and `open`) with argument constraints as tight as the plugin's scope syntax permits. Keep Rust changes to plugin registration only (ADR-0002).

## Adapters required (v1)

| App | Detection (in `args`) | Focus strategy |
|---|---|---|
| VS Code | `Visual Studio Code.app` / `Code Helper` | **Priority.** Identify the _window_ by workspace folder = session `cwd`. VS Code has no AppleScript window API: activate the app, then use `System Events` to pick the window whose title contains the workspace/folder basename; fall back to `open -b com.microsoft.VSCode <cwd>` (verify it focuses the existing window rather than duplicating). Cursor / VS Code Insiders variants are a bonus if trivial. |
| iTerm2 | `iTerm.app` | Scriptable and precise: iterate windows/tabs/sessions; select the session whose `tty` matches, else whose title/current working directory matches. Prefer **tty matching** — capture the claude process's tty (`ps -o tty=`) if not already available. |
| Terminal.app | `Terminal.app` | `tell application "Terminal"` → find the tab whose `tty` matches; `set selected tab of window w to t` + `activate`. |
| Anything else | — | `open -b <bundleId>` app-level fallback if a bundle id is derivable from the ancestor path; else `{ok: false, reason: 'unsupported-host'}`. |

Design the adapter map so adding Warp/Ghostty/Kitty/tmux later is purely additive (one new file + one map entry + tests).

## Testing strategy (≥85% coverage gate on `src/core`)

- `identifyOwnerApp`: table-driven tests over synthetic chains — VS Code (the real chain above, rewritten to `/Users/test/...`), iTerm2, Terminal.app, a bare zsh under launchd (unknown), an empty array (scanner session), and a chain containing `Claude Helper` (must NOT be treated as a terminal host).
- `buildFocusScript`: string assertions per adapter, including a cwd containing quotes/backslashes/spaces to prove escaping.
- `escapeAppleScriptString`: adversarial inputs (`"`, `\`, newline, `"; do shell script "…"`) — assert no script-injection escape.
- Shell layer: unit-test with an injected runner (dependency injection, no real osascript in CI) covering success, non-zero exit, timeout, and fallback paths. **No test may run real osascript** — CI is Linux and locally it is a side-effecting GUI action.
- Add `docs/focus-test-matrix.md`: the manual verification checklist (per app: window, tab, multiple windows, session in a background space, second monitor) with result columns for the user to fill during smoke testing.

## Edge cases

- Session's process has exited (stale ancestors) → attempt anyway, report failure clearly.
- Two sessions in the same VS Code window (two integrated terminals, same cwd) → focus the window; tab-level precision inside VS Code is out of scope, note it in the ADR.
- App running but zero windows → activate app.
- macOS Automation permission not yet granted → osascript fails distinctively; surface typed `reason: 'permission-denied'` for Phase 5's first-run guide. Do NOT swallow it.
- Very long `cwd`/titles → escaping + truncation must not break the script.

## Tasks

1. Sync main, branch `feat/phase-4-focus-engine`.
2. `src/core/focus/` pure functions + exhaustive tests (identify, build, escape).
3. Adapters for VS Code, iTerm2, Terminal.app + fallback; adapter map.
4. Imperative shell with injected runner, typed results, timeout (~3s) and fallback chain.
5. Tauri: shell-plugin scope for `osascript`/`open`; register plugin if needed; keep Rust thin.
6. Export a single entry point the UI will call — e.g. `focusSession(session)` — and document its result type in the PR body for Phase 3 to consume.
7. `docs/focus-test-matrix.md` + ADR-0007 (focus strategy, per-app techniques, VS Code tab-level limitation, escaping as a security boundary).
8. Validate: lint, typecheck, test, `npm run tauri build -- --no-bundle`.
9. PR `feat: phase 4 — focus engine`; flip PRD phase 4 → complete in-PR once green; squash-merge.

## Risks

| Risk | Mitigation |
|---|---|
| VS Code window focusing unreliable (the user's main case) | Try `System Events` title matching AND `open -b` with cwd; document which worked in the ADR; always fall back to app activation so a click is never a no-op |
| AppleScript injection via session-derived strings | `escapeAppleScriptString` applied everywhere, adversarial tests, pure builders keep it reviewable |
| Automation permission blocks everything on first run | Typed `permission-denied` result + note for Phase 5 first-run guide |
| tty not captured in Phase 2 records | If tty is needed for iTerm2/Terminal precision, add it to the hook/scanner here (small additive change) and note it in ADR-0007 |
