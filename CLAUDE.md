# CLAUDE.md

A desktop window onto Claude Code's Agent View: a macOS menu bar icon and an always-on-top panel
over `claude agents --json`, plus the one thing Agent View cannot do — raise the window a session
is running in. Tauri 2, TypeScript-first.

**This app owns no session logic.** Sessions, names and states are Claude Code's own answer
(ADR-0018); the only thing derived here is how long each state has held. A change that starts to
re-infer something the CLI reports is going the wrong way — check `claude agents --json` first.

## Architecture

| Path             | Holds                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| `src/core/`      | Pure TypeScript logic — no DOM, no Tauri, no `node:` imports. Logic lives here. |
| `src/detection/` | Imperative shell: the `claude agents --json` poll, the session store, logging.  |
| `src/ui/`        | React components (one per file), presentation only.                             |
| `scripts/`       | Developer CLIs (version check, release notes).                                  |
| `src-tauri/`     | Thin Rust plumbing: tray, window, plugins — plus the NSPanel conversion (0010). |
| `src/dev/`       | Browser preview harness for the panel. Never shipped.                           |
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
npm run format:check               # prettier --check (a CI gate)
npm run tauri build -- --no-bundle # compile check without packaging
npm run tauri build                # full .app + .dmg (aarch64 by default)
npm run check-versions             # package.json / tauri.conf.json / Cargo.toml must agree
npm run release-notes -- --tag v0.1.0  # print the notes a release would carry
npm run preview:ui                 # browser harness for the panel; #scene+glass+tall in the hash
```

There is nothing to install. The widget writes no files and reads none — its whole native surface
is five allowlisted commands, asserted in `src/detection/detectionCapabilities.test.ts`. To see
what it sees, run `claude agents --json` yourself.

**Requires Claude Code with `claude agents --json`** (2.1.236 has it). An older CLI produces a
named detection failure in the panel rather than an empty list (ADR-0011).

## Workflows

| File                            | Trigger                  | Does                                                              |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `.github/workflows/quality.yml` | `workflow_call`          | The gate: lint, typecheck, format, test + coverage, version check |
| `.github/workflows/pr.yml`      | PR to `main`             | Calls the gate + `tauri build --no-bundle` on macOS               |
| `.github/workflows/main.yml`    | push to `main`, dispatch | Calls the gate, then uploads an aarch64 `.dmg`/`.app` artifact    |
| `.github/workflows/release.yml` | `v*` tag, dispatch       | Calls the gate, checks tag vs version, publishes a GitHub Release |

Releasing: bump the version in all three files, merge, then `git tag vX.Y.Z && git push origin
vX.Y.Z`. Builds are unsigned unless the six Apple secrets exist (ADR-0009). Every action is pinned
by commit SHA and every workflow has an explicit least-privilege `permissions:` block.

## Conventions

- Functional TypeScript. Arrow functions only — no `function` keyword, no classes (lint-enforced).
- **One exported function per `.ts` file**, file named after the function (`formatTrayLabel.ts`).
  Types that function owns may live alongside it. Convention, not lint-enforced.
  The exceptions are `src/core/types.ts` and `src/core/focus/types.ts`: shared shapes, no
  behaviour.
- PascalCase files for React components, camelCase for functions.
- Tests colocated: `<name>.test.ts`. ≥85% coverage on `src/core` (CI gate). `src/detection` is
  the imperative shell and is not coverage-gated — keep judgement out of it and in `src/core`.
- `src/core/testing/aSession.ts` is the shared `Session` factory for tests — use it rather than
  writing another fixture. Anything synthetic must stay synthetic (`/Users/test/…`): never commit
  a real path or a real session name.
- No `console.log` — `console.warn`/`console.error` only.
- Comments explain _why_, only where the code is not self-evident.

## Process

- Every significant decision → a new ADR in `docs/adr/` (copy `0000-template.md`).
- Work is planned in `.claude/PRPs/plans/` against the PRD in `.claude/PRPs/prds/`.
- When a phase completes, flip its status in the PRD's Implementation Phases table.
- Branch per phase, PR into `main`, squash merge once both CI jobs are green.
