# ADR-0009: Release strategy, signing posture, and the first-run consent model

- **Status**: Accepted for the release strategy. The first-run/hook-installation half is superseded by [ADR-0018](0018-claude-code-is-the-source-of-truth.md) — there is nothing to install and nothing to consent to.
- **Date**: 2026-09-09

## Context

Phase 5 turns four phases of working code into something a person can install. Three decisions had
to be made without the user available to arbitrate:

1. The PRD's open question — _is an Apple Developer account available for signing and
   notarization?_ — is unanswered, and the repository has no Apple secrets configured.
2. Release builds have to target something. The machine this was developed on is Apple Silicon; a
   universal binary is possible but doubles the binary and was never verified locally.
3. The app is useless until the Claude Code hooks are installed into `~/.claude/settings.json` and
   macOS has granted two separate consents. The user already has real hooks of their own in that
   file (a `session-title.py` on `SessionStart`/`UserPromptSubmit`), so the installer touching it is
   the highest-consequence thing this app does. And a user who installed the `.dmg` has no
   repository, no `npm` and no reason to open a terminal, so "run `npm run install-hooks`" — what
   the empty state said until now — is a dead end for exactly the person who needs it.

## Decision

### Unsigned by default, signed automatically the moment credentials exist

`release.yml` decides in one step whether all six Apple secrets (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
`APPLE_TEAM_ID`) are present, and runs one of **two** `tauri-action` steps accordingly. Two steps
rather than one with conditional `env:`, because `tauri-bundler` reads those variables with
`var_os`: an empty string is "set" as far as it is concerned, and it would try to import an empty
certificate into a keychain and fail the build. An unset variable is the only safe "off".

So the default path produces a working, unsigned `.dmg` and no secret is required to cut a release.
Adding a Developer ID later needs no code change — only six repository secrets.

The cost is Gatekeeper: a double-click on an unsigned, un-notarized app is refused with "the
developer cannot be verified". That is documented in three places the user will actually be
standing when they hit it — the README's install section, the generated release notes, and the
dev-build workflow summary — with both workarounds (right-click → Open, or
`xattr -dr com.apple.quarantine`).

### `aarch64` only for v1

Release and dev builds pass `--target aarch64-apple-darwin`. This is what was built and run
locally; a universal build would ship a second architecture that has never been executed. Nothing
in the code is Apple-Silicon specific, so an Intel or universal build from source is a one-flag
change, and it is documented as such. Revisit when someone actually has an Intel Mac to run it on.

### One quality gate, called three times

The lint/typecheck/format/test/version-check job lives in `quality.yml` as a `workflow_call`
workflow, and `pr.yml`, `main.yml` and `release.yml` all call it. A release therefore cannot be cut
from something a PR would have rejected, and the gate has one definition to keep current. Every
workflow gets an explicit least-privilege `permissions:` block (`contents: read` everywhere except
the one release job that publishes), a concurrency group, and every action pinned by commit SHA.

### The version lives in three files, and CI refuses to let them drift

`package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` all carry the version.
`checkVersionConsistency` (pure, tested) compares them, and with `--tag` also compares the release
tag, reporting _every_ disagreement rather than the first. It runs on every PR as well as at tag
time: drift found on a PR is a one-line fix, drift found at tag time is a retag. A mislabelled
release is worse than a failed one.

### Release notes are generated deterministically from commit subjects

`buildReleaseNotes` buckets the commits since the previous tag by conventional-commit prefix into a
fixed section order, lifts `!`-marked commits into a "Breaking changes" section, and keeps
unrecognised subjects verbatim under "Other" so nothing is silently dropped. No third-party
changelog action, no LLM, no reordering: a release body is read months later, and it has to be
trustworthy rather than tidy. Sub-1.0 versions are published as pre-releases.

### First run is a checklist in the panel, and the install is a button

The panel opens on a three-step setup view when our hook entries are absent, and the tray carries a
permanent `Setup / Diagnostics` item that reopens it. The steps are ordered by what blocks what:
hooks, then the macOS grants, then restarting sessions that predate the hooks.

**The install is in-app and one click.** `installHooksInApp` copies the hook script out of the app
bundle (shipped via `bundle.resources`, resolved with `resolveResource` — the packaged app cannot
read the repository's `hooks/` directory) and merges the five event entries using the same tested
pure `mergeHookSettings` the CLI uses. Order is the safety property: the settings file is read and
validated **before** anything is written, so a file that will not parse aborts the install with no
side effects at all; the backup is written before the settings and only once, so it keeps the
pristine pre-widget file.

Consent is informed rather than merely obtained. The step names the file it will change, says the
existing hooks are kept and that a backup is written, lists exactly which events will be added — and
offers "Show the change", which prints the JSON that would be written. Only then is there a button.
The same button, with the same guarantees stated more briefly, is on the empty state, because "no
sessions detected" on a fresh install almost always means "the hooks were never installed"; once
they are in, the empty state says something different rather than nagging forever.

**Permissions are never claimed on faith.** macOS does not let an app read whether it holds an
Accessibility grant, so `evaluateSetupState` reports that step as `unknown` until a real click
proves something: a click that reached `window` or `tab` precision means the grant is there, and a
click that reported Phase 4's typed `permission-denied` means it is not — including a click that
_succeeded_ by degrading to app-level focus, which is exactly the case that would otherwise look
fine while being broken. The view deep-links to both System Settings panes and explains that a grant
is bound to that specific `.app` bundle, so replacing the app silently invalidates it.

### Diagnostics are anonymous by construction

The `Copy diagnostics` dump carries versions, paths to the widget's own files, hook status, session
counts and the last focus result. It carries no session titles and no project directories: it is the
one artefact of this app designed to leave the machine, so it must not contain anything the user
would not want to publish.

## Alternatives Considered

- **Blocking phase 5 on the signing question** — rejected: the user was unavailable and the whole
  point of the phase is a build they can install. Both paths are implemented instead, so answering
  the question later costs six secrets and no code.
- **Ad-hoc signing (`codesign -s -`)** — rejected: it does not satisfy Gatekeeper for a downloaded
  app, so it adds a step and changes nothing the user sees.
- **A universal build** — rejected for v1; see above.
- **Duplicating the quality job in each workflow** instead of `workflow_call` — rejected: three
  copies of a gate is three chances for one to fall behind.
- **A maintained changelog action** (`release-drafter`, `git-cliff`) — rejected: another third-party
  action to pin and trust for output we can generate in forty lines of tested pure code.
- **Running the existing `scripts/installHooks.ts` from the app** via a shell command — rejected:
  it needs Node on the user's `PATH` and a copy of the repository, neither of which a `.dmg`
  install has. The merge logic is shared as a pure function instead, which is the part worth
  sharing.
- **A separate setup window** — rejected: a second always-on-top window to manage, for a view the
  user sees once. It fits in the 320px panel.
- **A gear button in the panel header** — rejected: the header is 24px of guaranteed drag handle
  plus a dismiss button, and the tray is one click away and already the home of the app-level
  items.
- **Faking a green tick on the permission step** once the user has visited System Settings —
  rejected outright. A checklist that lies about the one thing it cannot observe is worse than one
  that admits it.

## Consequences

A fresh Mac can go from a GitHub Release to a working panel without a terminal, at the cost of one
Gatekeeper detour that is documented everywhere it bites. What we have taken on:

- **Two write paths into `~/.claude/settings.json`** — the CLI and the in-app installer. They share
  the pure merge and the same ordering guarantees, but the IO is written twice and both must keep
  the "validate before writing" property. The CLI is integration-tested against tmp directories;
  the in-app path is covered at the component level and by the shared merge tests, not against a
  real home directory.
- **The Accessibility grant breaks on every upgrade**, silently, because it is bound to the app
  bundle. The setup view warns about it and the permission step will flip back to `blocked` on the
  first refused click, but nothing can prevent it.
- **Unsigned releases will be reported as broken** by anyone who does not read the notes. Accepted
  for a personal tool; it is the first thing to fix if this ever has users.
- **`bundle.resources` is now load-bearing.** If the hook script stops being copied into the app,
  the in-app install fails with `hook-resource-missing` — which is reported as a bug rather than as
  a user error, because that is what it would be.
- Release notes quality now depends on commit subjects, which makes conventional commits a real
  convention rather than a habit.
