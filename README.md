# Claude Agents Widget

A lightweight macOS app that keeps every local Claude Code session in view: a **menu bar icon**
showing aggregate state (`3▶ 2⏸ 1✔`) and an **always-on-top floating panel** you can park on any
screen. Clicking a session focuses the exact terminal window it runs in.

Built for the case where you have 5–10+ agents running in parallel and can no longer tell which one
is working, which is done, and which has been silently waiting for input.

> **Status: Phase 1 — scaffold.** The tray icon and floating panel exist; session detection,
> the live session list, and click-to-focus land in Phases 2–4. See the
> [PRD](.claude/PRPs/prds/claude-agents-widget.prd.md) for the roadmap.

## Requirements

- macOS (Apple Silicon or Intel) — macOS only by design; see the PRD.
- Node 22 (`.nvmrc`) — the repo will not build on Node 18.
- Rust stable, and Xcode Command Line Tools (`xcode-select --install`).

## Getting started

```bash
source ~/.nvm/nvm.sh && nvm use   # picks up .nvmrc
npm install
npm run tauri dev                 # launches the app (menu bar icon, no Dock icon)
```

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

## Layout

```
src/core/     pure TypeScript logic — one exported function per file
src/ui/       React components
src-tauri/    thin Rust plumbing (tray, window)
docs/adr/     architecture decision records
.claude/PRPs/ product requirements and implementation plans
```

Application logic lives in TypeScript; Rust is kept to plumbing
([ADR-0002](docs/adr/0002-tauri-2-with-thin-rust-core.md)). Conventions for contributors and agents
are in [CLAUDE.md](CLAUDE.md).

## License

[Apache-2.0](LICENSE)
