# Claude Agents Widget

A small always-on-top macOS panel that answers one question at a glance: **which of my agents is
working, and which one is waiting for me?**

Agents get started from wherever you happen to be — a plain terminal, a VS Code or Cursor
integrated terminal, Claude Desktop — and then you carry on with everything else: Slack, Chrome,
a video call, actual code. The agents keep going in windows you can no longer see. Notifications do
fire when one stops, but with five or ten agents they all look alike: you get a ping without
knowing which agent sent it or where that window is. There is no single place that tells you who is
running and who is blocked, and no quick way back to the right window.

That is what this is: a menu bar icon that marks itself (`●`) the moment any agent is waiting on
you, and a compact panel you can park on any monitor, above every other window. The panel is split
into **Running** (the agent is busy, nothing is expected of you), **Waiting for you** (it asked
something and cannot go on until you answer) and **Done** (it stopped, and is not blocked).

Clicking a row raises the terminal or editor window that agent lives in, and says so if it could
not — it will never open a new window instead (ADR-0016). If macOS refused the click, the notice
offers the one-click fix. However many agents are blocked, exactly one row is ever loud — the most recent one you have
not been to yet — so the panel always has one answer to "what next" instead of a wall of
highlights.

<!-- Screenshot: add one here once the v0.1.0 build has been run on a real desktop. -->

## Requirements

- **macOS on Apple Silicon.** Release builds are `aarch64` only. Intel Macs can build from source
  (see [Development](#development)) — nothing in the code is Apple-Silicon specific.
- **Claude Code with `claude agents --json`** (2.1.236 or newer). That command is where every
  session, name and state comes from (ADR-0018); with an older CLI the panel says so rather than
  looking empty.

## Install

1. Download `Claude.Agents.Widget_<version>_aarch64.dmg` from
   [Releases](https://github.com/Fgerthoffert/claude-agents-widget/releases).
2. Open the `.dmg` and drag **Claude Agents Widget** to `/Applications`.
3. **Release builds are not signed or notarized** (there is no Apple Developer account behind this
   project yet — see [ADR-0009](docs/adr/0009-release-and-first-run-strategy.md)). macOS therefore
   refuses a plain double-click with _"cannot be opened because the developer cannot be verified"_.
   Either:
   - right-click the app → **Open** → **Open** (once), or
   - clear the quarantine flag:
     ```sh
     xattr -dr com.apple.quarantine '/Applications/Claude Agents Widget.app'
     ```

   This is Gatekeeper doing its job, not a broken build. If an Apple Developer ID is added later,
   the release workflow signs and notarizes automatically and this step disappears.

The app has no Dock icon: it lives in the menu bar.

## First run

**Nothing to install.** Sessions come from `claude agents --json`, so the widget works the moment
you launch it (ADR-0018). The tray's `Setup / Diagnostics` has one step:

**Let macOS raise windows.** Clicking a session runs a short AppleScript.

- **Automation** (Apple Events) is prompted for by macOS the first time you click a row. Allow it.
- **Accessibility** is separate, cannot be prompted for, and is what lets the widget find the
  exact window. Grant it by hand: the Setup view deep-links to _System Settings → Privacy &
  Security → Accessibility_, where you tick **Claude Agents Widget**. Without it a click still
  raises the app, just not the right window — and the panel says so, with a button that takes you
  to the pane.

The grant is attached to the exact app bundle, so **every update means granting it again.**

## The panel

One 32px row per session: a state emoji, the **session name** (Claude Code's own generated or
user-set title, falling back to the project directory), the shortened path, and how long it has
been in its current state. A legend at the bottom explains the glyphs.

- 🔄 working · ✋ needs an answer · ✅ done
- `▶` counts how long the current turn has been processing; `⏸` counts how long nothing has
  happened. Same number, opposite meanings, so they are drawn differently.
- Every blocked row is marked with an amber accent; **one** raises its voice — the most recent
  one you have not been to — with a tint and a slow pulse (suppressed under
  `prefers-reduced-motion`). Going to a session calms it until that agent does something new.

By default the window **fits its own height** to what it is showing — 190px for two agents, tall
enough for a dozen without scrolling, never taller than your screen. Turn it off under **Panel**
in Setup to set the height yourself. The width is always yours.

The panel floats above all windows on every space, is dragged by its background or header, and
remembers its position and size across restarts — clamped back onto an attached display if the
monitor you left it on is gone. The `✕` and the tray's `Show/Hide Panel` are the same gesture.

Design rationale is in [ADR-0008](docs/adr/0008-panel-and-tray-design.md); what to check by hand
after a UI change is [docs/ui-smoke-checklist.md](docs/ui-smoke-checklist.md).

## How detection works

One source: **`claude agents --json`**, Claude Code's own answer about its own sessions
([ADR-0018](docs/adr/0018-claude-code-is-the-source-of-truth.md)). Polled every 3 seconds, it
reports every interactive and background session with its working directory, its process id, its
session name and its status — `busy`, `waiting` (with the reason: `permission prompt`,
`input needed`, …) or `idle`. That is the whole of the state model.

It is run through a login shell (`/bin/zsh -lc`), because `claude` lives wherever your package
manager put it and a GUI app launched from Finder inherits none of those directories on its
`PATH`. The arguments are fixed in the app's capability allowlist, so nothing is interpolated
into a shell.

The widget derives exactly one thing: how long each session has been in its current state.
`startedAt` says how _old_ a session is, and a row needs to answer how long it has been _stuck_.

Earlier versions worked all of this out from the outside — a hook script installed into your
`~/.claude/settings.json`, a `ps`/`lsof` sweep, and the mtime of your transcripts — and nearly
every bug this project has had was an artifact of that. ADR-0018 has the details, including what
it cost.

### Click-to-focus

| App                               | What a click does                                                    |
| --------------------------------- | -------------------------------------------------------------------- |
| VS Code, VS Code Insiders, Cursor | Raises the exact window holding that workspace (needs Accessibility) |
| Ghostty                           | Focuses the surface whose working directory matches                  |
| Terminal.app, iTerm2              | Selects the tab whose tty matches, and raises it                     |
| Warp                              | Activates the app (Warp ships no scripting dictionary)               |
| anything else                     | Activates the app if a bundle id can be derived                      |

A click is never a no-op: the focus engine walks an ordered chain — exact window, then the editor's
own "open this folder" behaviour, then plain activation — and reports what it managed
([ADR-0007](docs/adr/0007-focus-engine-strategy.md)). Two sessions in the **same** VS Code window
are indistinguishable to it; VS Code exposes no way to select an integrated-terminal tab.
The manual matrix is [docs/focus-test-matrix.md](docs/focus-test-matrix.md).

## Privacy

Everything stays on your machine. There is no network code in this app: no telemetry, no analytics,
no update check, no account. It reads local files (`~/.claude/settings.json`,
`~/.claude-agents-widget/sessions/`, transcript files for session titles), runs `ps`, `lsof`,
`osascript` and `open`, and that is the whole list — the exact commands and file paths it is allowed
to touch are pinned in [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json).
The **Copy diagnostics** dump is deliberately anonymous: statuses, counts and paths to the widget's
own files, never session titles or project directories.

## Uninstall

The widget never writes to `~/.claude/` and stores nothing outside its own app-support
directory, so there is nothing of yours to restore:

```sh
rm -rf '/Applications/Claude Agents Widget.app'
rm -rf ~/Library/Application\ Support/com.fgerthoffert.claude-agents-widget
rm -rf ~/Library/Logs/com.fgerthoffert.claude-agents-widget
```

Also revoke the Automation and Accessibility grants in _System Settings → Privacy & Security_, and
turn off `Launch at Login` before quitting if you had enabled it.

## Development

```bash
source ~/.nvm/nvm.sh && nvm use    # Node 22 (.nvmrc); Node 18 will not build this
npm install
npm run tauri dev                  # full app — menu bar icon, no Dock icon
npm run preview:ui                 # the panel in a browser, with fake sessions
```

| Command                                 | Does                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `npm run lint`                          | ESLint                                                     |
| `npm run typecheck`                     | `tsc --noEmit`                                             |
| `npm run test`                          | Vitest with the `src/core` coverage gate                   |
| `npm run format:check`                  | Prettier                                                   |
| `npm run check-versions`                | package.json / tauri.conf.json / Cargo.toml agree          |
| `npm run tauri build -- --no-bundle`    | Compile check without packaging                            |
| `npm run tauri build`                   | Full `.app` + `.dmg` in `src-tauri/target/release/bundle/` |
| `npm run release-notes -- --tag v0.1.0` | Print the release notes for a tag                          |

Requires Rust stable and Xcode Command Line Tools (`xcode-select --install`). For an Intel or
universal build, pass `--target x86_64-apple-darwin` or `--target universal-apple-darwin`.

```
src/core/      pure TypeScript logic — one exported function per file
src/detection/ imperative shell: the `claude agents --json` poll, session store, logging
src/ui/        React components
src/dev/       browser preview harness (not shipped)
scripts/       developer CLIs (version check, release notes)
src-tauri/     thin Rust plumbing (tray, window, shell plugin)
docs/adr/      architecture decision records
.claude/PRPs/  product requirements and implementation plans
```

Conventions for contributors and coding agents are in [CLAUDE.md](CLAUDE.md); how to contribute is
in [CONTRIBUTING.md](CONTRIBUTING.md). CI runs the quality gate on every PR, uploads a dev build on
every merge to `main`, and publishes a release on every `v*` tag.

## Prior art

This project owes a lot to **[claude-status](https://github.com/gmr/claude-status)** by
[gmr](https://github.com/gmr) — a native Swift menu bar monitor and desktop widget for Claude Code
sessions (BSD-3-Clause). It got there first, it solves the same problem, and it is where several of
the mechanisms used here were shown to work at all: ancestor-process analysis to identify the
owning app, and per-app AppleScript for window focusing. Read its source if
this problem interests you.

This exists as a separate thing because of three specific wants: an **always-on-top panel** that can
be parked on any monitor (rather than a dropdown or a desktop widget that sits under windows), a
**TypeScript** codebase the author can maintain, and the **session name on every row**. The
build-versus-adopt reasoning is recorded in
[ADR-0001](docs/adr/0001-build-our-own-widget.md). Other tools in the same space, all worth a look:
c9watch, CC Menu Bar, so-agentbar, and
[ClaudeBar](https://github.com/tddworks/ClaudeBar) for usage quotas.

## Documentation

- [PRD](.claude/PRPs/prds/claude-agents-widget.prd.md) — problem, scope and roadmap
- [ADRs](docs/adr/) — every significant decision and why
- [CHANGELOG.md](CHANGELOG.md)

## License

[Apache-2.0](LICENSE)
