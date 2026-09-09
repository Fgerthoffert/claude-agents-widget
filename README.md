# Claude Agents Widget

A lightweight macOS app that keeps every local Claude Code session in view: a **menu bar icon**
showing aggregate state (`3▶ 2⏸ 1✔`) and an **always-on-top floating panel** you can park on any
screen. Clicking a session focuses the exact terminal window it runs in.

Built for the case where you have 5–10+ agents running in parallel and can no longer tell which one
is working, which is done, and which has been silently waiting for input.

> **Status: Phase 2 — detection core.** Sessions are now detected live (hooks + process
> scanning) and the panel shows them; the real panel/tray UI and click-to-focus land in
> Phases 3–4. See the [PRD](.claude/PRPs/prds/claude-agents-widget.prd.md) for the roadmap.

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
