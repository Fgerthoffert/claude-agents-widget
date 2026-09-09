# Plan: Phase 1 — Scaffold & Harness

## Summary

Create the Tauri 2 + TypeScript project skeleton (tray icon + one always-on-top window), the code-quality harness (strict TS, ESLint functional style, Prettier, Vitest with coverage gate), the agent harness (CLAUDE.md, ADRs), and the GitHub Actions PR workflow. Output: a repo any agent can work in confidently, with a hello-world tray app that builds and a green PR pipeline.

## User Story

As the repo owner (and future agents working here), I want a fully scaffolded, convention-enforcing repository, so that every subsequent phase can be implemented consistently and verified by CI.

## Problem → Solution

Empty repo (LICENSE + PRD only) → Buildable Tauri 2 app skeleton with enforced conventions, tests, docs, and CI.

## Metadata

- **Complexity**: Medium (many files, but all boilerplate-adjacent; no business logic)
- **Source PRD**: `.claude/PRPs/prds/claude-agents-widget.prd.md`
- **PRD Phase**: 1 — Scaffold & harness
- **Estimated Files**: ~30

---

## UX Design

N/A — infrastructure phase. The only visible result: a menu bar icon with a menu (Show/Hide Panel, Quit) and a small always-on-top window saying "Claude Agents Widget — no sessions yet". No dock icon.

---

## Environment Facts (verified 2026-09-09)

| Fact                              | Value                                                                        | Consequence                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Local Node                        | v18.20.5 — TOO OLD                                                           | Use nvm (installed at `~/.nvm`): `source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22`. Add `.nvmrc` = `22`, `engines.node: ">=22"` |
| Local Rust                        | 1.88.0 (Homebrew)                                                            | OK for Tauri 2                                                                                                                       |
| Latest @tauri-apps/cli / api      | 2.11.4 / 2.11.1                                                              | Use `^2.11`                                                                                                                          |
| Latest vitest / eslint / prettier | 5.x / 10.x (flat config) / 3.x                                               | Use latest                                                                                                                           |
| Latest typescript on npm          | 7.0.2                                                                        | **Pin `~5.9`** — typescript-eslint/tooling compat with TS7 unverified; revisit later (note in ADR-0004)                              |
| git remote                        | `git@github.com:Fgerthoffert/claude-agents-widget.git`, gh CLI authenticated | PRs via `gh pr create` / `gh pr merge`                                                                                               |
| License                           | Apache-2.0                                                                   | Set in package.json + Cargo.toml                                                                                                     |
| Host macOS                        | 26.3 (Darwin 25.3.0)                                                         | CI runner: `macos-latest`                                                                                                            |

## External Documentation

| Topic                     | Source                                                                                | Key Takeaway                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Tauri 2 tray              | https://v2.tauri.app/learn/system-tray/                                               | `TrayIconBuilder` in Rust `setup` hook; cargo feature `tray-icon`; `icon_as_template(true)` for menu-bar dark/light           |
| macOS menubar app gotchas | https://dev.to/hiyoyok/building-a-menubar-app-with-tauri-v2-what-nobody-tells-you-9a2 | `LSUIElement: true` under `bundle.macOS.infoPlist` hides Dock icon; ActivationPolicy::Accessory                               |
| Window config             | https://v2.tauri.app/reference/config/                                                | `alwaysOnTop`, `visibleOnAllWorkspaces`, `decorations: false`, `skipTaskbar`                                                  |
| Drag region               | https://v2.tauri.app/learn/window-customization/                                      | `data-tauri-drag-region` attribute on root div = whole-surface drag (PRD requirement)                                         |
| CI builds                 | https://github.com/tauri-apps/tauri-action                                            | Use plain `npm run tauri build` on macos-latest + `Swatinem/rust-cache` for PR check; tauri-action reserved for release phase |

KEY_INSIGHT: The floating panel is free-floating (user drags it anywhere), NOT anchored to the tray — `tauri-plugin-positioner` is unnecessary.
APPLIES_TO: window config, dependency list.
GOTCHA: `visibleOnAllWorkspaces` + `alwaysOnTop` both required for "always visible on every screen/space".

---

## Patterns to ESTABLISH (greenfield — nothing to mirror; these become the reference for all later phases)

### FILE_LAYOUT

```
src/                      # TypeScript (all logic that can possibly live here)
  core/                   # pure functions, one exported arrow function per file
    formatAggregate.ts    # (counts) => "3▶ 2⏸ 1✔"  — seed example
    formatAggregate.test.ts
  ui/                     # React components, one component per file
    Panel.tsx
  main.tsx                # entry, mounts <Panel/>
src-tauri/
  src/lib.rs              # setup: tray + window; keep THIN (ADR-0002)
  src/main.rs             # default generated
  tauri.conf.json
  capabilities/default.json
  icons/                  # generated by `tauri icon`
docs/adr/                 # NNNN-kebab-title.md, template in 0000-template.md
.claude/PRPs/             # prds/ and plans/ (already exists)
.github/workflows/pr.yml
```

### NAMING_CONVENTION

- Files: camelCase for functions (`formatAggregate.ts`), PascalCase for components (`Panel.tsx`).
- One exported arrow function per `.ts` file; the file is named after the function. Tests colocated as `<name>.test.ts`.
- No classes, no `function` keyword — `export const formatAggregate = (…) => …`.

### CODE_STYLE (enforced by eslint.config.js)

- `@typescript-eslint` strict-type-checked + stylistic-type-checked.
- `func-style: ["error", "expression"]`, `prefer-arrow-callback: error`, no classes via `no-restricted-syntax` (`ClassDeclaration`, `ClassExpression`).
- `eslint-config-prettier` last. One-function-per-file is convention (documented in CLAUDE.md), not lint-enforced.

### TEST_STRUCTURE (Vitest)

```ts
// src/core/formatAggregate.test.ts
import { describe, expect, it } from 'vitest';
import { formatAggregate } from './formatAggregate';

describe('formatAggregate', () => {
  it('formats mixed counts', () => {
    expect(formatAggregate({ working: 3, needsInput: 2, doneIdle: 1 })).toBe('3▶ 2⏸ 1✔');
  });
  // + zero-bucket omission, empty => 'idle'
});
```

Coverage: v8 provider, thresholds 85% (lines/functions/statements/branches) scoped to `src/core/**` (UI excluded until Phase 3 adds component tests).

### ERROR_HANDLING / LOGGING

Phase 1 has almost no runtime logic. Establish: no `console.log` in committed code (lint: `no-console: ["error", { allow: ["warn", "error"] }]`); Rust side uses `log` + `tauri-plugin-log` — added in Phase 2 when there is something to log. Note this in CLAUDE.md.

---

## Files to Change

| File                                                                                                                                                                 | Action        | Justification                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold via `npm create tauri-app@latest -- --template react-ts --manager npm` (run in a temp dir, then move contents into repo root, keeping LICENSE/.claude/.git) | CREATE        | Canonical starting point; React chosen per ADR-0005                                                                                                                                                                       |
| `package.json`                                                                                                                                                       | UPDATE        | name `claude-agents-widget`, license Apache-2.0, engines, scripts: `dev`, `build`, `tauri`, `lint`, `format`, `typecheck` (`tsc --noEmit`), `test` (`vitest run --coverage`), `test:watch`                                |
| `tsconfig.json`                                                                                                                                                      | UPDATE        | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`                                                                                                                                      |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore`                                                                                                            | CREATE        | Per CODE_STYLE above                                                                                                                                                                                                      |
| `vitest.config.ts`                                                                                                                                                   | CREATE        | node env (no jsdom yet), coverage config per TEST_STRUCTURE                                                                                                                                                               |
| `src/core/formatAggregate.ts` + test                                                                                                                                 | CREATE        | Seed function proving one-function-per-file + test + coverage pipeline end-to-end                                                                                                                                         |
| `src/ui/Panel.tsx`, `src/main.tsx`, `index.html`                                                                                                                     | CREATE/UPDATE | Minimal panel: drag region (`data-tauri-drag-region` on root), placeholder text, dark-mode aware via `prefers-color-scheme`                                                                                               |
| `src-tauri/tauri.conf.json`                                                                                                                                          | UPDATE        | window: `width: 320, height: 400, alwaysOnTop: true, visibleOnAllWorkspaces: true, decorations: false, skipTaskbar: true`; `bundle.macOS.infoPlist.LSUIElement: true`; identifier `com.fgerthoffert.claude-agents-widget` |
| `src-tauri/src/lib.rs`                                                                                                                                               | UPDATE        | `setup`: `TrayIconBuilder` with menu (Show/Hide Panel → toggle window visibility, Quit), `icon_as_template(true)`, `ActivationPolicy::Accessory`; window close → hide, not exit                                           |
| `src-tauri/Cargo.toml`                                                                                                                                               | UPDATE        | tauri features `["tray-icon", "image-png"]`; license Apache-2.0                                                                                                                                                           |
| `.github/workflows/pr.yml`                                                                                                                                           | CREATE        | See CI spec below                                                                                                                                                                                                         |
| `CLAUDE.md`                                                                                                                                                          | CREATE        | See spec below                                                                                                                                                                                                            |
| `docs/adr/0000-template.md`, `0001`–`0005`                                                                                                                           | CREATE        | Seeded from PRD Decisions Log: 0001 build-our-own, 0002 tauri-2-thin-rust-core, 0003 hybrid-detection, 0004 functional-ts-style (+TS 5.9 pin note), 0005 react-frontend                                                   |
| `README.md`                                                                                                                                                          | CREATE        | What/why, dev setup (nvm, rust), commands, link to PRD/ADRs                                                                                                                                                               |
| `.nvmrc`, `.gitignore`                                                                                                                                               | CREATE        | Node 22; ignore node_modules, dist, src-tauri/target, coverage                                                                                                                                                            |

### ADR-0005 rationale (new decision made in this plan)

Frontend: **React 19 + Vite**. Alternatives: vanilla TS (more control, more hand-rolled state), Svelte 5 (smaller, newer idioms). React chosen: broadest ecosystem/agent familiarity → maintainability; components are plain arrow functions fitting the functional style; bundle size irrelevant in a local webview.

### CI spec (`.github/workflows/pr.yml`)

- Trigger: `pull_request` → `main`.
- Job `quality` (ubuntu-latest, fast): setup-node 22 w/ npm cache → `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test` (coverage gate enforced by vitest thresholds).
- Job `build-macos` (macos-latest): setup-node 22, dtolnay/rust-toolchain@stable, Swatinem/rust-cache (workspaces: src-tauri), `npm ci`, `npm run tauri build -- --no-bundle` (compile check without dmg packaging).
- Both jobs required for merge.

### CLAUDE.md spec (keep < 60 lines)

Project one-liner; architecture map (src/core = pure TS logic, src/ui = React, src-tauri = thin Rust plumbing — logic goes in TS unless impossible, per ADR-0002); commands (nvm use, npm run dev/lint/typecheck/test, tauri dev/build); conventions (functional TS, arrow functions, ONE exported function per file, colocated tests, ≥85% coverage on src/core, no console.log, no classes); process (every significant decision → new ADR in docs/adr/; PRD/plans live in .claude/PRPs/; update PRD phase status when a phase completes).

## NOT Building (this phase)

- Session detection, hooks, scanner (Phase 2)
- Real panel UI, tray aggregate counts (Phase 3)
- Focus engine (Phase 4)
- Release/signing workflows, dev-build-on-main workflow (Phase 5)
- App icon design (default Tauri icon acceptable for now)

---

## Step-by-Step Tasks

1. **Node toolchain**: `source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22`. VALIDATE: `node -v` = v22.x.
2. **Branch**: `git checkout -b feat/phase-1-scaffold`.
3. **Scaffold**: run create-tauri-app (react-ts, npm) in scratchpad, move into repo root preserving LICENSE, .claude/, .git. VALIDATE: `npm install` clean.
4. **Configs**: apply package.json/tsconfig/eslint/prettier/vitest per specs; pin `typescript@~5.9`. GOTCHA: eslint 10 = flat config only; typescript-eslint needs `projectService: true`. VALIDATE: `npm run lint`, `npm run typecheck` pass on scaffold.
5. **Seed core function + test**: `formatAggregate` per TEST_STRUCTURE (working→▶, needsInput→⏸, doneIdle→✔; omit zero buckets; empty → "idle"). VALIDATE: `npm run test` green, coverage 100% of src/core.
6. **Tauri window + tray**: tauri.conf.json + lib.rs per specs. GOTCHA: hide-on-close needs `WindowEvent::CloseRequested { api.prevent_close() }` + hide; tray menu "Show/Hide" toggles visibility. VALIDATE: `npm run tauri build -- --no-bundle` compiles; `npm run tauri dev` smoke if the environment allows (no dock icon, tray menu works, window floats above all windows, whole-surface drag).
7. **CI workflow** per spec. VALIDATE: after push, `gh pr checks` green.
8. **Docs**: CLAUDE.md, README.md, ADRs 0000–0005. VALIDATE: ADR contents match PRD Decisions Log.
9. **PR**: push, `gh pr create` (title `feat: phase 1 — scaffold & harness`, body summarizes plan + validation evidence), wait for checks, `gh pr merge --squash`. Update PRD phase 1 → complete after merge.

## Validation Commands

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run lint && npm run typecheck && npm run test   # EXPECT: all pass, coverage ≥85% (src/core)
npm run tauri build -- --no-bundle                  # EXPECT: compiles
gh pr checks --watch                                # EXPECT: quality + build-macos green
```

Manual: tray icon visible; Show/Hide toggles panel; panel always-on-top across spaces/monitors; whole-surface drag; Quit exits; no dock icon.

## Risks

| Risk                                         | L   | Impact            | Mitigation                                                                          |
| -------------------------------------------- | --- | ----------------- | ----------------------------------------------------------------------------------- |
| create-tauri-app template drift vs this plan | M   | rework configs    | Treat template as starting point; plan's config specs win                           |
| TS 5.9 pin vs deps expecting TS7             | L   | install friction  | If peer conflicts, try TS7 + verify lint/test still run; record outcome in ADR-0004 |
| macOS CI runner slow Rust builds             | M   | slow PRs          | Swatinem/rust-cache; `--no-bundle`                                                  |
| xcodebuild not detected locally              | L   | tauri build fails | `xcode-select --install` if build errors mention missing CLT                        |

## Notes

Working style: autonomous; PRs opened and merged by the agent once CI is green (user authorized 2026-09-09). Squash merges. Any new significant decision → ADR.
