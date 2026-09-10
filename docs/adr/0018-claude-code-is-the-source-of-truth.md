# ADR-0018: Claude Code is the source of truth

- **Status**: Accepted
- **Date**: 2026-09-10
- **Supersedes**: ADR-0003 (hybrid session detection), ADR-0006 (hook script and state-file IPC),
  and the hook-installation half of ADR-0009. Retires the problems ADR-0012, ADR-0014 and
  ADR-0017 were solving.

## Context

The user found [the Agent View documentation](https://code.claude.com/docs/en/agent-view) and
asked the obvious question:

> "the spec of what it does is good, why didn't you piggy back onto it? I still need a widget, but
> the data I need seems to be in that view. Should you revise your implementation?"

`claude agents --json` — documented for scripting, explicitly not needing a TTY — reports every
interactive and background session with its `cwd`, its `pid`, its `sessionId`, its `name`, and its
`status` (`busy` / `waiting` / `idle`) plus `waitingFor` (`permission prompt`, `input needed`, …).
Verified on the machine in question: 0.27s per call, and the four sessions it returned were
exactly the four that existed.

Every part of this widget's detection layer was an attempt to work that out from the outside:

| What we built                                                                                                                                        | What it was reconstructing |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| a hook script installed into the user's `~/.claude/settings.json`, with a consent flow, a backup, an idempotent merge and an installer in two places | `status`                   |
| `parseClaudeProcesses` over `ps`                                                                                                                     | the session list           |
| `parseLsofCwds` over `lsof`                                                                                                                          | `cwd`                      |
| `matchScannedSessions`, pairing live PIDs with the newest transcript in a project directory                                                          | `sessionId`                |
| `extractSessionTitle`, a JSONL parser over Claude Code's transcripts                                                                                 | `name`                     |
| `mapHookEventToState` plus a reconciler folding five hook events into four states                                                                    | `status`, `waitingFor`     |

And it was measurably wrong. Because the user had started using Agent View, `ps` now showed a
supervisor and its spare PTY hosts, all of them argv0 `claude`:

```
10119  claude daemon run --origin transient …    ← counted as a session
10217  claude bg-pty-host …                      ← counted as a session
10247  claude bg-spare …                         ← counted as a session
 9952  claude agents                             ← counted as a session
13982  claude --dangerously-skip-permissions     ← a real session
```

Ten rows where there were four. Opening Agent View made the widget invent six agents.

That is not an isolated bug, it is the genre. Every fix shipped in the previous eight releases was
one: a mis-titled row from the transcript heuristic (ADR-0012), `/clear` leaving a ghost
(ADR-0014), a hook script the app could not update (ADR-0017), Claude Desktop's sessions appearing
(ADR-0012), two rows for one terminal (ADR-0012). All of them are artifacts of deriving state
rather than reading it.

## Decision

`claude agents --json` is the only source. The pipeline is: run it, validate it
(`parseAgentSessions`), stamp how long each state has held (`carryStateSince`), publish.

**Deleted:** the hook script and its test, both installers (`scripts/installHooks.ts` and
`installHooksInApp`), `mergeHookSettings`, `describeHookInstall`, `parseSessionRecord`,
`reconcileSessions`, `mapHookEventToState`, `isDesktopSession`, `parseClaudeProcesses`,
`parseLsofCwds`, `matchScannedSessions`, `encodeProjectDirName`, `extractSessionTitle`,
`readHookRecords`, `readSessionTitles`, `scanClaudeSessions`, `probeSetup`, `refreshHookScript`
and the filesystem watcher — about 1,900 lines of source and tests. The setup screen went from
three steps to one. **The widget now reads no files and writes none.** Its entire native surface
is five allowlisted commands, and the `fs` capability is gone.

Three things are kept, and they are the product:

- **The panel** — always on top, parked on any monitor, one loud row, fitting its own height.
  Agent View is a full-terminal TUI; this is a widget beside your work.
- **Click-to-focus.** The documentation is explicit: _"Cannot programmatically switch focus to
  session's terminal window."_ Agent View can only attach. Raising the window an agent already
  lives in is the one thing this app does that nothing else does, and `pid` is what it needs.
- **`stateSince`.** The only derived value left. `startedAt` says how old a session is, and the
  row has to answer how long it has been _stuck_ — different questions, and the second is the one
  worth walking over for. So the widget times state changes itself, from Claude Code's state
  rather than instead of it.

### Two details that decide whether it works at all

**A login shell.** `claude` lives wherever the user's package manager put it — `/opt/homebrew/bin`
here — and a GUI app launched from Finder inherits `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, which
contains none of the likely locations. The capability entry is
`/bin/zsh -lc "claude agents --json"`, with the arguments fixed in the allowlist so nothing is
interpolated into a shell. Costs about 20ms more than calling the binary directly.

**An empty list is a real answer.** No agents running and "the CLI could not be run" must never
look the same, or we are back to v0.2.0's silent failure (ADR-0011). Every failure path returns a
sentence the panel shows instead: a missing CLI, a version without `--json`, a timeout, a non-zero
exit, or output that will not parse. And a failed poll leaves the last good list on screen —
a CLI that failed once says nothing about whether those agents are still running.

## Alternatives Considered

- **Keep the hook path as a fallback** for older Claude Code. Rejected by the user, and rightly:
  it keeps every module this change exists to delete, leaves two pipelines to test, and fixes
  bugs on only one of them. The minimum version is now stated instead.
- **Read `~/.claude/jobs/<id>/state.json` directly**, avoiding a process spawn per poll. Rejected:
  the documentation says in as many words that the file format is not stable and to use
  `--json`. Parsing another program's private files is the mistake this ADR is undoing.
- **Poll faster than 3s**, or watch `~/.claude/daemon/roster.json` for changes. The interval is
  now 3s and each poll costs one short-lived process; a file watcher would react faster but the
  roster does not change when a session merely goes from busy to idle, which is the transition
  that matters most.
- **Ask for `--json` output in a stable machine format we specify.** Not ours to decide, and the
  documented shape is already close enough that validating it costs 40 lines.

## Consequences

The widget no longer has an opinion about what a Claude Code session is. That was the source of
every detection bug it has had, and it is gone rather than fixed.

**Costs, stated plainly.** It now needs Claude Code with `claude agents --json` (2.1.236 has it);
older installs get a named failure instead of a session list, which is the honest outcome but is a
hard dependency where there was none. Each poll spawns a short-lived process rather than reading
files, and polling keeps Claude Code's supervisor resident — acceptable for a user who runs Agent
View anyway, and worth watching if the footprint shows up on battery. And the widget now depends
on another program's output shape: documented, but not frozen. `parseAgentSessions` validates
every field and a shape it cannot read is reported as a failure rather than an empty panel, which
is the most that can be done about it.

**What got better beyond the bug.** Titles are Claude Code's own session names rather than a guess
from the newest transcript. `waitingFor` distinguishes a permission prompt from a question, which
the hook's notification matchers never did. Background sessions dispatched from Agent View appear
for free, having never been supported. Every row has a real state-transition age, where the
scanner path used to show none. And there is nothing to install, so the first run has no consent
dialog, no backup, no merge into the user's settings and no way to be half-done.

The lesson is the one the user pointed at: before reverse-engineering a system's state, check
whether it will simply tell you. This project spent eight releases and six ADRs learning that the
hard way, and the fix for all of them is one command.
