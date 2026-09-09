# CLAUDE.md

macOS menu bar icon + always-on-top floating panel showing every local Claude Code session, with
one-click focusing of the terminal window that owns it. Tauri 2, TypeScript-first.

## Architecture

| Path            | Holds                                                                |
| --------------- | -------------------------------------------------------------------- |
| `src/core/`     | Pure TypeScript logic — no DOM, no Tauri imports. Where logic lives. |
| `src/ui/`       | React components (one per file), presentation only.                  |
| `src-tauri/`    | Thin Rust plumbing: tray, window, FS watch, shell exec via plugins.  |
| `docs/adr/`     | One Architecture Decision Record per significant decision.           |
| `.claude/PRPs/` | PRDs (`prds/`) and implementation plans (`plans/`).                  |

Logic goes in TypeScript unless it is impossible there (ADR-0002). Growing `src-tauri/` needs
justification in the PR description.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use    # Node 22 (see .nvmrc); Node 18 is the machine default
npm install
npm run dev                        # Vite only (no native shell)
npm run tauri dev                  # full app — opens a GUI window
npm run lint                       # eslint
npm run typecheck                  # tsc --noEmit
npm run test                       # vitest run --coverage (thresholds enforced)
npm run format                     # prettier --write .
npm run tauri build -- --no-bundle # compile check without packaging
```

## Conventions

- Functional TypeScript. Arrow functions only — no `function` keyword, no classes (lint-enforced).
- **One exported function per `.ts` file**, file named after the function (`formatAggregate.ts`).
  Types that function owns may live alongside it. Convention, not lint-enforced.
- PascalCase files for React components, camelCase for functions.
- Tests colocated: `<name>.test.ts`. ≥85% coverage on `src/core` (CI gate).
- No `console.log` — `console.warn`/`console.error` only. Rust-side logging arrives with
  `tauri-plugin-log` in Phase 2, when there is something to log.
- Comments explain _why_, only where the code is not self-evident.

## Process

- Every significant decision → a new ADR in `docs/adr/` (copy `0000-template.md`).
- Work is planned in `.claude/PRPs/plans/` against the PRD in `.claude/PRPs/prds/`.
- When a phase completes, flip its status in the PRD's Implementation Phases table.
- Branch per phase, PR into `main`, squash merge once both CI jobs are green.
