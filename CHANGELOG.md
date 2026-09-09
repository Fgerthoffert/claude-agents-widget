# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html), and everything below `1.0.0` is a
pre-release where anything may still change.

Per-release notes are also generated from the commit history and published on each
[GitHub Release](https://github.com/Fgerthoffert/claude-agents-widget/releases).

## [Unreleased]

## [0.2.1] — 2026-09-09

### Fixed

- **The panel detected nothing.** `watch` is not a default feature of `tauri-plugin-fs`, so the
  plugin never registered its `watch` command and `watchImmediate()` rejected at runtime. That
  call was awaited outside the detection pipeline's error handling, so it took the hook reader,
  the process scanner and the polling interval down with it before the first sweep — while the
  panel said "No agents running right now" and the only error path was a `console.error` that
  goes nowhere in a release build.
- **Failures can no longer be silent.** Logs are written to the app log directory, the watcher is
  demoted to a latency optimisation (losing it costs seconds, not detection), the two detection
  sources degrade independently instead of discarding each other's rows, and the panel renders a
  named failure rather than claiming nothing is running. Cargo features and capability scopes are
  asserted by tests, at the level where both bugs of this shape have lived.

### Added

- **Builds identify themselves**: a tagged release shows its version, any other build shows the
  version plus its short commit hash, in the diagnostics view and the copied diagnostics dump.

## [0.2.0] — 2026-09-09

The panel earns its keep: it can be moved, it stays visible over full-screen apps, and it says at
a glance which agents need you.

### Added

- **Floats above full-screen apps.** The window is converted to a non-activating `NSPanel` at
  status level with `FullScreenAuxiliary`, so it stays visible over a full-screen editor, browser
  or video call — and clicking it neither switches Spaces nor steals focus (ADR-0010).
- **Two sections instead of one list**: _Running_ (the agent is working, nothing is expected of
  you) above _Waiting for you_ (blocked on a prompt, or finished and unreviewed). Each sizes to
  its content, scrolls independently, and is omitted when empty.
- **A legend**, pinned to the bottom, explaining every glyph the rows use.
- **Emoji state markers** — ✋ needs you, 🔄 working, ✅ done — replacing coloured dots, which
  carried no meaning to anyone who had not learned the convention and none at all to a
  colour-blind reader.
- **Durations that say what they measure**: ▶ how long the current agent turn has been running,
  ⏸ how long nothing has happened. Distinguished by shape, colour and weight, because the two
  mean opposite things.
- **A browser preview harness** (`npm run preview:ui`) that renders the real components against
  fixture sessions, for reviewing the UI without launching the native shell.

### Fixed

- **The panel could not be moved at all.** `core:window:default` does not include
  `start-dragging`, and nothing granted it, so every `data-tauri-drag-region` and every
  `startDragging()` call was silently inert while all tests passed. The capability is now granted
  and asserted by a test, and the panel can additionally be dragged by press-and-move from
  anywhere on its surface — including over rows, which must stay clickable and so can never be
  drag regions themselves.

### Changed

- **Translucent glass surface**: a transparent window over the macOS popover material, 18px
  corners, a specular hairline edge, rounded rows and etched dividers.
- **`ended` sessions are no longer shown.** The process is gone — the terminal was closed or the
  session cleared — so there is nothing to return to and nothing to decide.
- **The header carries no counts.** The menu bar already shows the aggregate, and in the panel the
  rows are the count; per-section counts now sit next to what they count.
- **The empty state installs the hook for you**, with a button rather than a terminal command, and
  says something different once the hooks are in place instead of nagging.

## [0.1.0] — 2026-09-09

First installable snapshot: a menu bar icon and an always-on-top panel that show every local Claude
Code session and jump to the window that owns it.

### Added

- **Session detection**, hybrid and reconciled into one list. A zero-dependency Claude Code hook
  script writes per-session JSON state files that the app watches (precise, ~1s), and a 5-second
  `ps`/`lsof`/transcript sweep discovers sessions the hooks never saw and notices dead ones. The
  hook never writes to stdout, always exits 0 and logs its own failures, so it cannot break the
  session it runs in.
- **Session names** taken from Claude Code's own `custom-title`/`ai-title` transcript records, with
  a truncated first prompt as the fallback — the identification the panel is built around.
- **Always-on-top floating panel**: 32px rows, split into "Running" and "Waiting for you", ✋/🔄/✅
  state glyphs, one loud state (`needs input`), separate glyphs for processing time and idle time,
  a legend, whole-surface dragging, and position and size persisted across restarts and clamped
  back onto an attached display.
- **Menu bar icon** with the aggregate label (`3▶ 2⏸ 1✔`), a dropdown of up to ten sessions,
  `Show/Hide Panel`, `Setup / Diagnostics`, `Launch at Login` and `Quit`.
- **Click-to-focus** with an ordered degradation chain, so a click is never a no-op: exact window
  for VS Code, VS Code Insiders and Cursor (via Accessibility), matching surface for Ghostty,
  matching tty tab for Terminal.app and iTerm2, and plain activation for everything else. Every
  value interpolated into an AppleScript is escaped, and `osascript` invocations are pinned to a
  marker prefix in the capability allowlist.
- **First-run setup view** in the panel, reachable at any time from the tray: one-click hook
  installation with explicit consent and a "show the change" dry run, deep links to the Automation
  and Accessibility panes with an explanation of what each is for, and a copyable, anonymous
  diagnostics dump.
- **Hook installer CLI** (`npm run install-hooks`) with `--dry-run` and `--yes`, which merges
  rather than overwrites, backs up `settings.json` first, and refuses a file it cannot parse.
- **CI/CD**: a shared quality gate (lint, typecheck, format, tests with a ≥85% `src/core` coverage
  threshold, version consistency) on every PR; an `aarch64` dev build artifact on every merge to
  `main`; and a tagged release workflow that generates notes from conventional commits and signs
  and notarizes only if Apple credentials are configured.

### Known limitations

- Release builds are **unsigned and not notarized**, so the first launch needs a right-click → Open
  or `xattr -dr com.apple.quarantine`. See
  [ADR-0009](docs/adr/0009-release-and-first-run-strategy.md).
- **Apple Silicon only** (`aarch64`). Intel and universal builds work from source but are not
  published.
- Two sessions in the **same** VS Code window cannot be told apart by the focus engine; VS Code
  exposes no way to select an integrated-terminal tab.
- Terminal.app and iTerm2 focus scripts are dictionary- and compile-verified but have not been
  exercised against live sessions; see [docs/focus-test-matrix.md](docs/focus-test-matrix.md).
- Per-session state files in `~/.claude-agents-widget/sessions/` are never pruned.
- Claude Desktop chat sessions, token/usage tracking, git branch per row and tmux panes are all out
  of scope for v1.

[Unreleased]: https://github.com/Fgerthoffert/claude-agents-widget/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Fgerthoffert/claude-agents-widget/releases/tag/v0.1.0
