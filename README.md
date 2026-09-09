# Claude Agents Widget

A lightweight macOS app that keeps every local Claude Code session in view: a **menu bar icon**
showing aggregate state (`3▶ 2⏸ 1✔`) and an **always-on-top floating panel** you can park on any
screen. Clicking a session focuses the exact terminal window it runs in.

Built for the case where you have 5–10+ agents running in parallel and can no longer tell which one
is working, which is done, and which has been silently waiting for input.

> **Status: Phase 3 — UI surfaces.** Sessions are detected live (hooks + process scanning), the
> floating panel and the menu bar dropdown are real, and the panel remembers where you parked it.
> Click-to-focus lands in Phase 4 — until then a click on a row is a no-op.
> See the [PRD](.claude/PRPs/prds/claude-agents-widget.prd.md) for the roadmap.

## Requirements

- macOS (Apple Silicon or Intel) — macOS only by design; see the PRD.
- Node 22 (`.nvmrc`) — the repo will not build on Node 18.
- Rust stable, and Xcode Command Line Tools (`xcode-select --install`).

## Getting started

```bash
source ~/.nvm/nvm.sh && nvm use   # picks up .nvmrc
npm install
npm run install-hooks             # register the session hooks (see below)
npm run tauri dev                 # launches the app (menu bar icon, no Dock icon)
```

### The panel

One 32px row per session: a state dot, the **session name** (falling back to the project
directory), the shortened path, and how long it has been in its current state. `needs input` is the
only row that raises its voice — amber accent, tint and a slow pulse — so it is the one thing you
notice from across a desk.

The panel sits above all windows on every space and is dragged by its header or any of its
background; rows stay clickable. Its position and size are remembered across restarts, and clamped
back onto an attached display if the monitor you left it on is gone. The `✕` and the tray's
`Show/Hide Panel` both hide it. `Launch at Login` lives in the tray menu and starts off.

Design rationale is in [ADR-0008](docs/adr/0008-panel-and-tray-design.md); what to check by hand
after a change is in [docs/ui-smoke-checklist.md](docs/ui-smoke-checklist.md).

### Session detection

Detection is hybrid ([ADR-0003](docs/adr/0003-hybrid-session-detection.md)): Claude Code hooks
push precise state changes, and a 5-second process scan finds anything the hooks missed.

`npm run install-hooks` merges five hook entries (`SessionStart`, `UserPromptSubmit`, `Stop`,
`Notification`, `SessionEnd`) into `~/.claude/settings.json` and copies the hook script to
`~/.claude-agents-widget/hook.mjs`. It:

- asks for confirmation first — pass `--yes` to skip, `--dry-run` to preview and write nothing;
- **merges, never overwrites**: your existing hooks are left exactly as they are;
- is idempotent, so re-running it after an upgrade only refreshes the script;
- backs up `settings.json` to `settings.json.claude-agents-widget.bak` before its first change;
- refuses to touch a `settings.json` it cannot parse.

Each session then gets a state file at `~/.claude-agents-widget/sessions/<session_id>.json`,
which the app watches. Hook problems are logged to `~/.claude-agents-widget/hook.log`.
The scanner alone will find sessions started before installation, so the hooks are optional —
but without them "needs input" cannot be detected reliably.

Restart any running Claude Code sessions after installing, so they pick up the new hooks.

## Commands

| Command                              | Does                                  |
| ------------------------------------ | ------------------------------------- |
| `npm run tauri dev`                  | Run the full app                      |
| `npm run dev`                        | Vite dev server only, no native shell |
| `npm run lint`                       | ESLint                                |
| `npm run typecheck`                  | `tsc --noEmit`                        |
| `npm run test`                       | Vitest with coverage thresholds       |
| `npm run format`                     | Prettier                              |
| `npm run tauri build -- --no-bundle` | Compile check without packaging       |
| `npm run install-hooks`              | Register the Claude Code hooks        |

## Layout

```
src/core/      pure TypeScript logic — one exported function per file
src/detection/ imperative shell: fs watcher, process scanner, session store
src/ui/        React components
hooks/         the Claude Code hook script (zero dependencies)
scripts/       the hook installer
src-tauri/     thin Rust plumbing (tray, window, fs/shell plugins)
docs/adr/      architecture decision records
.claude/PRPs/  product requirements and implementation plans
```

Application logic lives in TypeScript; Rust is kept to plumbing
([ADR-0002](docs/adr/0002-tauri-2-with-thin-rust-core.md)). Conventions for contributors and agents
are in [CLAUDE.md](CLAUDE.md).

## License

[Apache-2.0](LICENSE)
