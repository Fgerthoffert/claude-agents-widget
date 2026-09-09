# Contributing

This is a small, opinionated personal tool. Issues and pull requests are welcome; so is forking it
and going your own way.

## Before you start

Read [CLAUDE.md](CLAUDE.md) — it is the short version of the conventions and the architecture map,
written for both humans and coding agents. Then skim the
[PRD](.claude/PRPs/prds/claude-agents-widget.prd.md) for what this is and is not trying to be, and
the [ADRs](docs/adr/) for decisions already made and why. A change that reopens a settled decision
is fine, but say so in the PR and update the ADR rather than quietly contradicting it.

## Setup

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 22 (.nvmrc). Node 18 will not build this.
npm install
npm run tauri dev                 # the app
npm run preview:ui                # the panel in a browser, with fake sessions
```

Rust stable and Xcode Command Line Tools are required for anything that touches `src-tauri/`.

`npm run install-hooks` writes to your **real** `~/.claude/settings.json`. Never run it to test a
change — it merges idempotently and backs the file up first, but the tests cover it against tmp
directories (`scripts/installHooks.test.ts`). Use `--dry-run` when in doubt.

## Conventions

- **Functional TypeScript.** Arrow functions only; no `function` keyword, no classes
  (lint-enforced). See [ADR-0004](docs/adr/0004-functional-typescript-style.md).
- **One exported function per `.ts` file**, named after the function. Types that function owns may
  live alongside it. `src/core/types.ts` and `src/core/focus/types.ts` are the two multi-export
  exceptions: shared shapes, no behaviour.
- **Logic goes in `src/core`** — pure, no DOM, no Tauri, no `node:` imports — and is unit-tested
  there. `src/detection` and `src/ui` are the imperative shell: keep judgement out of them.
- **Logic goes in TypeScript, not Rust**, unless it is impossible there
  ([ADR-0002](docs/adr/0002-tauri-2-with-thin-rust-core.md)). Growing `src-tauri/` needs a
  justification in the PR description.
- Tests are colocated as `<name>.test.ts`. Fixtures live in `src/core/__fixtures__/` and must be
  **fully synthetic** (`/Users/test/…`): never commit real transcript text or real paths.
- No `console.log` — `console.warn`/`console.error` only.
- Comments explain _why_, only where the code is not self-evident.
- Commit messages are conventional (`feat:`, `fix:`, `docs:`, `ci:`, `refactor:`, `test:`,
  `chore:`). The release notes are generated from them, so the subject line ends up in front of a
  reader months later — write it for them.

## Validation

Run all of these before opening a PR; CI runs the same set:

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test                       # ≥85% coverage on src/core is a hard gate
npm run check-versions
npm run tauri build -- --no-bundle
```

Two things cannot be checked in CI and are covered by checklists instead: whether the panel really
floats above a full-screen space and survives a monitor change
([docs/ui-smoke-checklist.md](docs/ui-smoke-checklist.md)), and whether click-to-focus lands in the
right window per app ([docs/focus-test-matrix.md](docs/focus-test-matrix.md)). If you touch the
panel or the focus engine, work through the relevant one and say so in the PR.

## Pull requests

- Branch off `main`; one branch per piece of work. Never commit to `main`.
- Open a PR and let both CI jobs go green (`Quality` and `macOS compile check`).
- Squash-merge, and delete the branch.
- Write a new ADR in `docs/adr/` for any significant decision — copy `0000-template.md` and take
  the next number. "Significant" means someone would otherwise ask "why is it done this way?".
- Larger work is planned in `.claude/PRPs/plans/` against the PRD, and the PRD's phase table is
  flipped to `complete` in the final commit of the phase.

## Releases

The version lives in three files and CI fails if they disagree: `package.json`,
`src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. To cut a release:

1. Bump all three to the new version, update `CHANGELOG.md`, merge that to `main`.
2. Tag it and push the tag:
   ```sh
   git tag v0.2.0 && git push origin v0.2.0
   ```
3. `.github/workflows/release.yml` checks the tag against the version, builds the `aarch64` `.dmg`,
   generates the notes from the commits since the previous tag, and publishes the GitHub Release.
   Anything below `1.0.0` is marked as a pre-release.

Builds are unsigned unless the Apple secrets are configured; see
[ADR-0009](docs/adr/0009-release-and-first-run-strategy.md). Every merge to `main` also uploads a
dev `.dmg` as a workflow artifact named after the commit, kept for 30 days.
