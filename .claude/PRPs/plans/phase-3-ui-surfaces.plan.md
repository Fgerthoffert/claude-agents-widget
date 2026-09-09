# Plan: Phase 3 — UI Surfaces

## Summary

Build the two visible surfaces on top of the Phase 2 session store: a menu bar tray icon showing aggregate state with a session dropdown, and the always-on-top floating panel the user parks on any monitor. The panel is the product's centrepiece — it must be glanceable at 10+ sessions, uncluttered, draggable from anywhere on its surface, and it must make "needs input" impossible to miss.

## Metadata

- **Complexity**: Large (UI + tray + window behaviour + persistence)
- **Source PRD**: `.claude/PRPs/prds/claude-agents-widget.prd.md` (read MoSCoW + Phase 3 details)
- **PRD Phase**: 3 — UI surfaces (depends on Phase 2, parallel with Phase 4)
- Read first: `CLAUDE.md`, `docs/adr/0002` (thin Rust core), `docs/adr/0005` (React), `src/ui/Panel.tsx`, `src/ui/panel.css`, `src/ui/useSessions.ts`, `src/detection/createSessionStore.ts`, `src/core/types.ts`, `src/core/formatAggregate.ts`, `src/core/countSessionStates.ts`

## Phase 2 handoff — build on this, do not rebuild it

```ts
interface SessionStore {
  getSessions: () => readonly Session[];
  setSessions: (sessions: readonly Session[]) => void;
  subscribe: (listener: () => void) => () => void;
}
```

- `src/ui/useSessions.ts` **already exists** and wraps a module-level singleton store (`useSyncExternalStore`-shaped), starting the detection pipeline on first mount. **Use this hook. Do not create a second store.**
- `Session` (`src/core/types.ts`): `sessionId`, `title`, `cwd`, `transcriptPath`, `state`, `source: 'hook' | 'scanner'`, `notificationType`, `notificationMessage`, `updatedAt`, `claudePid`, `ancestors`.
- The list arrives **pre-sorted**: `needs_input` → `working` → `done_idle` → `ended`, then most-recent first, then by id (stable, never flickers). **Needs-input emphasis is styling only — do not re-sort.**
- `countSessionStates(sessions)` + existing `formatAggregate` produce the tray label; `ended` is excluded from counts.
- `updatedAt` is ISO-8601 UTC → derive "time in state".
- `title` may be `null` (no transcript yet) → fall back to the `cwd` basename.
- `notificationType` values seen in the wild: `permission_prompt`, `idle_prompt`, `agent_needs_input`.

## Design requirements (from the user, verbatim intent)

> "having this widget always on top, above all windows, and then I'd move it from monitor to monitor whenever needed and to make sure it's not too cluttered"

Non-negotiables:

1. **Above all windows**, visible on every space (`alwaysOnTop` + `visibleOnAllWorkspaces` are already set in `tauri.conf.json` — verify and keep).
2. **Draggable from anywhere** on the surface (`data-tauri-drag-region` on the root, per Phase 1) — but rows must still be clickable: put the drag region on the shell/background and header, not on interactive rows. Verify clicks and drags don't fight each other.
3. **Uncluttered at 10+ sessions**: one compact row per session, no chrome that doesn't earn its pixels. Target ~28–34px rows, readable at a glance from across a desk.
4. **Position persisted** across restarts and monitor changes (`@tauri-apps/plugin-store` or a small JSON file in the app config dir; restore on launch; clamp to a visible display if the saved monitor is gone).

## Row anatomy (per session)

```
[state dot] Session title (falls back to cwd basename)     4m
            ~/proj · main                                   ⋯
```

- **State dot/badge**: needs_input = amber/red and visually loudest (subtle pulse acceptable; no sound); working = blue/green; done_idle = neutral/dim; ended = faded or hidden.
- **Title** is primary, truncates with ellipsis (never wraps to three lines).
- **Secondary line**: shortened cwd (`~` for home). Git branch only if genuinely cheap and non-blocking — do NOT run git per session on a 5s loop; otherwise skip and note the deferral.
- **Time in current state** right-aligned, compact (`12s`, `4m`, `1h`), updating on a 1s tick without re-rendering the whole list unnecessarily.
- Row **click → focus the session**. Phase 4 provides `focusSession(session)`; it is being built in parallel, so define a thin seam (e.g. `src/ui/onSessionClick.ts`) that can be stubbed now and wired when Phase 4 lands.
- **Empty state**: "No Claude Code sessions detected" + hint that hooks may need installing (`npm run install-hooks`).

## Tray (menu bar)

- Label = `formatAggregate(countSessionStates(sessions))`, updated live. Keep it short; macOS truncates long menu bar text.
- Dropdown: aggregate line, then up to ~10 sessions (state glyph + title), click focuses that session; separator; `Show/Hide Panel`; `Quit`.
- Tray updates driven from the same store, not a second polling loop. Rust stays thin — pass strings/actions from TS via commands/events (ADR-0002).

## Additional Phase 3 scope

- **Launch at login**: `tauri-plugin-autostart` + a toggle (panel footer or tray menu). Default OFF; user opts in.
- **Ended sessions**: hidden entirely or dimmed at the bottom (they already sort last). Pick one, justify in the ADR.
- Optional if cheap: compact/expanded panel toggle (PRD "Could"). Skip rather than rush it.

## Testing strategy (coverage gate ≥85% on `src/core`; UI currently excluded from that gate — still test it)

- Add `jsdom` env + `@testing-library/react` (+ `user-event`) to Vitest for `src/ui/**`, configured so the `src/core` gate is unaffected. Extend coverage to `src/ui` if the numbers allow; otherwise state the intent in the PR.
- Pure display helpers (one function per file): `formatDuration(ms)`, `shortenPath(cwd, home)`, `sessionDisplayTitle(session)` — exhaustive unit tests (0s, 59s, 60s, 90m, 25h; home prefix, non-home path, root; null title, empty title, unicode).
- Component tests with a fake store: renders N rows in given order; needs_input row carries its emphasis class; row click invokes the handler with the right session; empty state renders; time-in-state updates with fake timers.
- Do **not** test real window/tray behaviour in CI — manual smoke instead.
- Add `docs/ui-smoke-checklist.md` (or extend `docs/focus-test-matrix.md` if Phase 4 created it): panel above a full-screen video call, drag between monitors, position survives restart, 10-session legibility, tray label correctness, autostart toggle.

## Tasks

1. Sync main, branch `feat/phase-3-ui-surfaces`.
2. Pure display helpers + tests.
3. Panel: shell, header (drag region + controls), session rows, empty state, styling (dark/light via `prefers-color-scheme`, compact density).
4. Window behaviour: verify always-on-top/all-workspaces, whole-surface drag vs row clicks, position persistence with off-screen clamping.
5. Tray: live aggregate label + session dropdown + Show/Hide + Quit, driven from the store.
6. Autostart plugin + toggle.
7. Click seam to `focusSession` (stub if Phase 4 hasn't merged; wire it for real if the function already exists on main).
8. Validate: lint, typecheck, test, `npm run tauri build -- --no-bundle`.
9. ADR-0008 (UI/window decisions: drag strategy, position persistence, ended-session handling, tray label format).
10. PR `feat: phase 3 — UI surfaces`; flip PRD phase 3 → complete in-PR once green; squash-merge.

## Coordination with Phase 4 (running in parallel)

- **File ownership**: Phase 3 owns `src/ui/**`, panel CSS, tray code, autostart, position persistence. Phase 4 owns `src/core/focus/**` and the focus shell. Shared files that may conflict: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/*.json`, `src-tauri/src/lib.rs`, the PRD phase table.
- Whoever merges **second** must rebase on main, resolve those conflicts (keep both sets of additions), re-run validation, and confirm CI green before merging. Never force-push over the other phase's work.

## Risks

| Risk                                                   | Mitigation                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Drag region swallows row clicks (or vice versa)        | Drag on background/header only; explicit smoke test for both gestures                 |
| Always-on-top loses to full-screen apps (macOS spaces) | Verify against a real full-screen video window; document actual behaviour in ADR-0008 |
| Saved position off-screen after monitor change         | Clamp to nearest available display on restore; test with a synthetic monitor list     |
| 1s ticker causes re-render churn at 10+ rows           | Tick a single clock value; memoize rows; verify idle CPU stays ~0%                    |
| Tray label too long for the menu bar                   | Cap the string; counts-only format                                                    |
