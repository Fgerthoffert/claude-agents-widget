# CLAUDE.md

macOS menu bar icon + always-on-top floating panel showing every local Claude Code session, with
one-click focusing of the terminal window that owns it. Tauri 2, TypeScript-first.

## Architecture

| Path             | Holds                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| `src/core/`      | Pure TypeScript logic — no DOM, no Tauri, no `node:` imports. Logic lives here. |
| `src/detection/` | Imperative shell: Tauri fs/shell calls, the 5s scan loop, the session store.    |
| `src/ui/`        | React components (one per file), presentation only.                             |
| `hooks/`         | The Claude Code hook script, copied verbatim to `~/.claude-agents-widget/`.     |
| `scripts/`       | Developer/user CLIs (the hook installer).                                       |
| `src-tauri/`     | Thin Rust plumbing: tray, window, FS watch, shell exec via plugins.             |
| `docs/adr/`      | One Architecture Decision Record per significant decision.                      |
| `.claude/PRPs/`  | PRDs (`prds/`) and implementation plans (`plans/`).                             |

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
npm run install-hooks -- --dry-run # show what would be added to ~/.claude/settings.json
npm run install-hooks              # install the hook (asks for confirmation; --yes to skip)
```

`install-hooks` writes to the **real** `~/.claude/settings.json`. Never run it to test a change —
it merges idempotently and backs the file up first, but tests cover it against tmp dirs
(`scripts/installHooks.test.ts`). Use `--dry-run` when in doubt.

## Conventions

- Functional TypeScript. Arrow functions only — no `function` keyword, no classes (lint-enforced).
- **One exported function per `.ts` file**, file named after the function (`formatAggregate.ts`).
  Types that function owns may live alongside it. Convention, not lint-enforced.
  The one exception is `src/core/types.ts`: shared shapes only, no behaviour.
- PascalCase files for React components, camelCase for functions.
- Tests colocated: `<name>.test.ts`. ≥85% coverage on `src/core` (CI gate). `src/detection` is
  the imperative shell and is not coverage-gated — keep judgement out of it and in `src/core`.
- Test fixtures live in `src/core/__fixtures__/` as plain `.txt`/`.jsonl` files. They must be
  **fully synthetic** (`/Users/test/…`): never commit real transcript text or real paths.
- No `console.log` — `console.warn`/`console.error` only.
- Comments explain _why_, only where the code is not self-evident.

## Process

- Every significant decision → a new ADR in `docs/adr/` (copy `0000-template.md`).
- Work is planned in `.claude/PRPs/plans/` against the PRD in `.claude/PRPs/prds/`.
- When a phase completes, flip its status in the PRD's Implementation Phases table.
- Branch per phase, PR into `main`, squash merge once both CI jobs are green.
