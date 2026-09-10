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
- Claude Code, for there to be anything to watch.

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

The panel opens on a three-step **Setup** view, which the tray's `Setup / Diagnostics` reopens at
any time.

1. **Install the Claude Code hooks** — one button. It copies the hook script to
   `~/.claude-agents-widget/hook.mjs` and merges five entries (`SessionStart`, `UserPromptSubmit`,
   `Stop`, `Notification`, `SessionEnd`) into `~/.claude/settings.json`. It **merges, never
   overwrites**: your own hooks are left exactly as they are, a backup is written to
   `settings.json.claude-agents-widget.bak` before the first change, and a `settings.json` that
   cannot be parsed is refused rather than repaired. "Show the change" prints the exact JSON first
   if you would rather read it than trust it.
2. **Let macOS raise windows** — clicking a session runs a short AppleScript.
   - **Automation** (Apple Events) is prompted for by macOS the first time you click a row. Allow
     it, per app.
   - **Accessibility** is separate, cannot be prompted for, and is what lets the widget walk VS
     Code / Cursor windows to find the right one. Grant it by hand: the Setup view deep-links to
     _System Settings → Privacy & Security → Accessibility_, where you tick **Claude Agents
     Widget**.
   - Both grants are attached to **that exact `.app` bundle**. Replacing the app — installing a new
     release, or rebuilding it locally — invalidates them, and you have to grant them again. macOS
     gives no warning when this happens; a click that used to land on the window will quietly start
     landing on the app instead.
   - Without Accessibility nothing breaks: a click still raises the owning application, just not
     the specific window.
3. **Restart running agents** — hooks only apply to sessions started afterwards. Sessions that were
   already running still appear (the scanner finds them), but they cannot report `needs input`.

The tray menu also holds `Show/Hide Panel`, `Launch at Login` (off by default) and `Quit`, and the
Setup view has a **Copy diagnostics** button that puts versions, hook status and the last focus
result on the clipboard for a bug report.

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

Two independent sources, reconciled into one list
([ADR-0003](docs/adr/0003-hybrid-session-detection.md)):

- **Hooks** (precise, ~1s): Claude Code runs `~/.claude-agents-widget/hook.mjs` on each session
  event; it writes one small JSON file per session under `~/.claude-agents-widget/sessions/`, which
  the app watches. This is the only path that can tell you an agent is _waiting for input_.
  The hook is zero-dependency, never writes to stdout, always exits 0, and logs its own problems to
  `~/.claude-agents-widget/hook.log` — it cannot break the session it runs in
  ([ADR-0006](docs/adr/0006-hook-script-and-state-file-ipc.md)).
- **Scanner** (zero-config, ~5s): a periodic `ps`/`lsof` sweep for `claude` processes plus the
  mtime of `~/.claude/projects/*/*.jsonl` transcripts. It finds sessions that started before the
  hooks were installed and notices when one dies.

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

```sh
# 1. Remove the hook entries from ~/.claude/settings.json.
#    Restore the backup the installer made:
mv ~/.claude/settings.json.claude-agents-widget.bak ~/.claude/settings.json
#    …or edit the file and delete the five entries whose command mentions claude-agents-widget.

# 2. Remove the widget's own data (hook script, per-session state, hook log).
rm -rf ~/.claude-agents-widget

# 3. Trash the app.
rm -rf '/Applications/Claude Agents Widget.app'
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
| `npm run install-hooks -- --dry-run`    | Preview the settings.json change                           |
| `npm run release-notes -- --tag v0.1.0` | Print the release notes for a tag                          |

Requires Rust stable and Xcode Command Line Tools (`xcode-select --install`). For an Intel or
universal build, pass `--target x86_64-apple-darwin` or `--target universal-apple-darwin`.

```
src/core/      pure TypeScript logic — one exported function per file
src/detection/ imperative shell: fs watcher, process scanner, session store, installer
src/ui/        React components
src/dev/       browser preview harness (not shipped)
hooks/         the Claude Code hook script (zero dependencies, shipped as an app resource)
scripts/       developer CLIs (hook installer, version check, release notes)
src-tauri/     thin Rust plumbing (tray, window, fs/shell plugins)
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
the mechanisms used here were shown to work at all: hook-driven session state, ancestor-process
analysis to identify the owning app, per-app AppleScript for window focusing. Read its source if
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
