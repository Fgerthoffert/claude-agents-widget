# Plan: Phase 5 — Packaging & Release

## Summary

Make the widget installable and updatable: a dev build artifact on every merge to main, a tagged release workflow producing a `.dmg` attached to a GitHub Release, a first-run experience that guides the user through hook installation and the macOS permissions the focus engine needs, and the documentation to go with it. Ends with the user's **first installable snapshot**.

## Metadata

- **Complexity**: Medium (CI/CD + first-run UX; little new logic)
- **Source PRD**: `.claude/PRPs/prds/claude-agents-widget.prd.md`
- **PRD Phase**: 5 — Packaging & release (depends on 3 and 4)
- Read first: `CLAUDE.md`, `.github/workflows/pr.yml`, `docs/adr/0006` (hook installer), `docs/adr/0007` (focus + permissions), `docs/adr/0008` (UI/window), `docs/ui-smoke-checklist.md`, `docs/focus-test-matrix.md`, `scripts/install-hooks*`, `src/core/mergeHookSettings*`

## Signing decision — resolve without blocking

The PRD's open question (Apple Developer account availability) is **unanswered and the user is not available**. Do not block on it. Implement so both paths work:

- Default: **unsigned / ad-hoc** builds. The release workflow must produce a working `.dmg` with no secrets configured.
- If (and only if) the repo secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` are present, sign and notarize. Guard with `if:` conditions on secret presence so the workflow never fails when they're absent.
- Document the unsigned-install path prominently in the README (Gatekeeper blocks a double-click: right-click → Open, or `xattr -dr com.apple.quarantine /Applications/<app>.app`), and note what changes once a Developer ID is added.
- Record this in ADR-0009 and update the PRD open question with the resolution taken.

## Workflows to build

### `.github/workflows/main.yml` — dev build on merge to main

- Trigger: `push` to `main` (plus `workflow_dispatch`).
- Reuse the existing PR quality job (lint/typecheck/test) — extract into a reusable workflow or duplicate minimally; keep it DRY if cheap, don't over-engineer.
- Build the macOS app (`tauri build`, universal or `aarch64` — pick and justify; Apple Silicon only is acceptable for v1 if noted) and upload the `.dmg`/`.app` as a workflow **artifact** with a retention period, named with the short SHA.
- Must not create releases or tags.

### `.github/workflows/release.yml` — tagged release

- Trigger: `push` on tags `v*` (plus `workflow_dispatch` with a version input).
- Use `tauri-apps/tauri-action` (pinned to a SHA or major tag) to build and attach artifacts to a GitHub Release.
- Version source of truth: `package.json` version, mirrored into `src-tauri/tauri.conf.json` and `Cargo.toml`. Add a check that the tag matches the version, failing loudly on mismatch.
- Changelog: generate release notes from commits since the previous tag (`gh` API or a maintained action pinned by SHA). Conventional-commit prefixes are already in use (`feat:`, `docs:`), so grouping by prefix is feasible. Keep it simple and deterministic.
- Mark pre-1.0 releases appropriately; `v0.1.0` is the intended first tag.

### Permissions and hardening

- Every workflow gets an explicit top-level `permissions:` block (least privilege — `contents: write` only where a release is created).
- Pin third-party actions by commit SHA where practical; at minimum by full version tag.
- Concurrency groups to cancel superseded runs.

## First-run experience (the part that makes it usable)

The app is useless until hooks are installed and macOS permissions are granted. Build a small, honest onboarding surface — not a wizard:

1. **Setup state detection** (pure functions, tested): are our hooks present in `~/.claude/settings.json`? does the hook state directory exist? has any session ever been seen? has an `osascript` focus attempt returned `permission-denied` (Phase 4's typed reason)?
2. **In-panel setup view**, shown when hooks are absent or no sessions have ever been detected — three checkable steps:
   - _Install hooks_ — a button that runs the Phase 2 installer through a Tauri command **with explicit consent**, showing exactly which file will be modified and that a backup is written. Idempotent; must never clobber the user's existing hooks (they have real ones: a `session-title.py` on `SessionStart`/`UserPromptSubmit`). Offer a "show me the change first" dry-run view.
   - _Grant Automation permission_ — explain that clicking a session runs AppleScript to raise its window; deep-link to `x-apple.systempreferences:com.apple.preference.security?Privacy_Automation` (and Accessibility if Phase 4 needs it). Do not attempt to grant it programmatically; it's impossible and shouldn't be faked.
   - _Restart existing Claude sessions_ — hooks only apply to sessions started afterwards; existing ones appear via the scanner but without ancestor data (app-level focus only). Say this plainly.
3. A permanently reachable "Setup / Diagnostics" entry in the tray menu re-opens that view, plus a copyable diagnostics dump (versions, hook presence, session counts, last focus error) for bug reports.

Keep it inside the existing 320px panel; no second window unless it's genuinely cleaner.

## Documentation

- **README**: what it is (panel described concretely), macOS/architecture requirement, install from Releases including the Gatekeeper workaround, first-run steps, how detection works (hooks + scanner) and the privacy point (everything stays local, nothing is sent anywhere), supported terminals for click-to-focus and the fallback behaviour elsewhere, uninstall instructions (remove hooks, delete `~/.claude-agents-widget/`, trash the app), development setup, links to PRD/ADRs.
- **CONTRIBUTING.md**: branch/PR flow, conventions from CLAUDE.md, how to run validation, the ADR habit.
- **CHANGELOG.md**: seeded for `v0.1.0` summarizing phases 1–5.
- Update `CLAUDE.md` with the new release commands and workflow map.

## Release the snapshot

- After merge, tag `v0.1.0` and push it, let the release workflow run, verify the `.dmg` downloads and mounts, and report the release URL. If the workflow fails, fix and re-tag (`v0.1.1`) rather than leaving a broken release.
- **Do not install or launch the app on the user's machine** — mounting/verifying the artifact is fine, but launching an always-on-top window and modifying `~/.claude/settings.json` is the user's decision. Hand them the link and the smoke checklists.

## Testing

- Pure setup-state and version-consistency functions: unit-tested (hooks present/absent/partial, malformed settings, version match/mismatch).
- Setup view: component tests with a fake setup state (each step's rendered state, consent button calls the installer command once, dry-run view renders the diff).
- Workflows: validate with `actionlint` if available; otherwise a careful read plus a real `workflow_dispatch` run of the main-build workflow to prove it works before tagging.
- `src/core` coverage gate ≥85% must stay green.

## Tasks

1. Sync main (Phase 4 must be merged first), branch `feat/phase-5-packaging-and-release`.
2. Version consistency check + scripts.
3. `main.yml` dev build workflow; verify via `workflow_dispatch`.
4. `release.yml` with conditional signing/notarization + changelog generation.
5. Setup-state core functions + tests.
6. In-panel setup/diagnostics view + tray entry + consent-gated installer command; tests.
7. README, CONTRIBUTING, CHANGELOG, CLAUDE.md updates; ADR-0009 (release strategy, signing posture, first-run consent model).
8. Validate: lint, typecheck, test, format:check, `tauri build --no-bundle`.
9. PR `feat: phase 5 — packaging & release`; flip PRD phase 5 → complete once green; squash-merge.
10. Tag `v0.1.0`, push, verify the release artifact, report the URL. Update the PRD's signing open question with the resolution.

## Risks

| Risk                                                          | Mitigation                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unsigned build blocked by Gatekeeper, user thinks it's broken | Prominent, exact workaround in README + release notes; ADR-0009 records the trade-off             |
| `tauri-action` version drift breaks releases                  | Pin by SHA/major tag; verify with a real run before tagging                                       |
| Consent-gated installer damages the user's real hooks         | Reuse the tested `mergeHookSettings`; backup first; dry-run view; never write on a malformed file |
| Universal vs arm64 build confusion                            | Pick one, state it in README and release notes                                                    |
| Tag/version mismatch produces a mislabeled release            | Automated check that fails the workflow                                                           |
