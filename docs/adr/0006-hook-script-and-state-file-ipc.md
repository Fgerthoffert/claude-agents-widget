# ADR-0006: Hook script design and state-file IPC

- **Status**: Superseded by [ADR-0018](0018-claude-code-is-the-source-of-truth.md) — there is no hook script; Claude Code is asked directly.
- **Date**: 2026-09-09

## Context

ADR-0003 settled that hooks are the primary detection source. Building them raised a set of
smaller decisions, plus several corrections where the real Claude Code behaviour on this machine
differs from what the PRD and the phase-2 plan assumed.

The hook runs inside the user's Claude Code session. It is spawned on every `SessionStart`,
`UserPromptSubmit`, `Stop`, `Notification` and `SessionEnd`, under whatever Node the user's shell
resolves — not this repo's Node 22 toolchain — and anything it prints on stdout is interpreted by
Claude Code. A slow, noisy or crashing hook degrades the tool the user is actually trying to use.

## Decision

**A single zero-dependency `.mjs` file, copied rather than bundled.** `hooks/claude-agents-widget-hook.mjs`
imports only `node:` builtins and is copied verbatim to `~/.claude-agents-widget/hook.mjs`. No
build step, no `node_modules`, nothing to break when the repo is moved or rebuilt. It carries
JSDoc type annotations so the repo's type-aware lint rules still cover it.

**Crash-proof and silent.** Everything is wrapped in try/catch, the process always exits 0, and
nothing is ever written to stdout. Errors append to `~/.claude-agents-widget/hook.log`.

**State-file IPC with atomic writes.** One JSON file per session at
`~/.claude-agents-widget/sessions/<session_id>.json`, written to a temp file and renamed, so a
reader never sees a half-written record. Writes merge into the existing file, because not every
event carries every field. No socket, no port, no daemon: the app can be closed and reopened and
simply reads the current directory.

**Merge, don't overwrite.** `Notification` payloads carry neither `cwd` nor `transcript_path`, so
each event overlays only the fields it actually has and inherits the rest.

**Two `ps` calls, parsed by position of the numeric columns.** The ancestor chain comes from one
`ps -axo pid=,ppid=,comm=` (walked in memory) plus one `ps -o pid=,args= -p <pids>`. The plan
proposed one `ps -o ppid=,comm=,args= -p <pid>` per ancestor, but that output cannot be parsed
reliably: macOS prints `comm` as the executable path truncated to 16 characters, which can itself
contain spaces (`/Users/x/My App/…`), so the `comm`/`args` boundary is ambiguous. Splitting only
the leading numeric columns and taking the remainder verbatim is unambiguous, and two calls beat
one-per-ancestor on cost anyway.

**Ancestors are captured, not interpreted.** `{pid, comm, args}` is stored raw for phase 4, along
with `claudePid` — the nearest ancestor that is the `claude` CLI. `claudePid` is the liveness
signal the scanner checks; the rest of the chain is the terminal/IDE identification material.

**The installer is TypeScript, run through Node's type stripping.** `scripts/installHooks.ts` runs
via `node --experimental-strip-types` so it can import the tested pure `mergeHookSettings` from
`src/core` instead of reimplementing the merge in JavaScript. The CLI keeps all IO — reading,
backing up, refusing malformed JSON, asking for consent — and the merge stays pure and unit-tested.

## Corrections to the PRD and plan, found in real data

**Transcripts have no `summary` records.** The PRD and ADR-0003 say session titles come from
`summary` records. Surveying every transcript under `~/.claude/projects` on this machine (105
files, 16 record types) found no such type. Titles actually live in two standalone record types:
`{"type":"custom-title","customTitle":…}` for a user rename and `{"type":"ai-title","aiTitle":…}`
for the generated one. Both are re-emitted repeatedly as the conversation evolves, so the **last**
occurrence wins. `extractSessionTitle` therefore prefers `custom-title`, then `ai-title`, then a
truncated first user prompt — and the fallback must skip `isMeta` records, which hold command
scaffolding like `<local-command-stdout>` rather than anything the user typed.

**Project-path encoding replaces every non-alphanumeric character, and hashes long paths.** The
plan assumed `/` and `.` become `-`. The shipped CLI (2.1.236) actually does
`cwd.replace(/[^a-zA-Z0-9]/g, '-')`, and if the result exceeds 200 characters it truncates to 200
and appends a base-36 hash of the original path. `encodeProjectDirName` reproduces this exactly,
including the hash. The encoding is **lossy** — `/a/b-c` and `/a-b/c` collide — so the app only
ever encodes a known cwd and never attempts to decode a directory name back into a path.

**`Notification` carries `notification_type`, not `message`.** The plan expected a human-readable
`message`. The current payload provides a matcher-style `notification_type` (`permission_prompt`,
`idle_prompt`, `agent_needs_input`, …). Both fields are recorded, whichever arrives, and both are
cleared on any non-`Notification` event so the UI cannot show a stale prompt.

**The scanner needs `lsof` to learn a process's cwd.** `ps` cannot report another process's
working directory, and the cwd is the only route from a `claude` PID to its transcript directory.
`lsof -a -d cwd -Fn -p <pids>` supplies it in one call without elevated privileges. This is an
addition to the plan; it is allowlisted with fixed arguments alongside `ps` in
`capabilities/default.json`.

## Alternatives Considered

- **A bundled hook CLI** (esbuild/rollup into `dist/`) — rejected: a build artifact to keep in
  sync, for a script that needs nothing beyond `node:` builtins.
- **Named pipe or local HTTP between hook and app** — rejected: requires the app to be running
  when the hook fires, and introduces ports, permissions and lifecycle problems. Files are
  durable, inspectable and debuggable by hand.
- **One state file for all sessions** — rejected: concurrent hooks from parallel sessions would
  contend on a single file. One file per session makes every write independent, and answers the
  PRD's open question about two sessions in the same directory (they have distinct session ids,
  therefore distinct files).
- **Deriving state in the app from transcript tailing only** — rejected by ADR-0003; retained
  here only as the scanner's 10-second mtime heuristic for sessions hooks never saw.

## Consequences

The hook is trivial to reason about and impossible to break the user's session with, at the cost
of duplicating the event→state table in two places (the `.mjs` and `src/core/mapHookEventToState.ts`);
both are tested, and the hook's copy is what actually runs. State files accumulate in
`~/.claude-agents-widget/sessions/` and are currently never deleted — the reconciler expires
`ended` sessions from the store after five minutes but leaves the files alone. A future phase
should prune them.

Because the reconciler is stateless by design, a **scanner-only** session disappears from the
store the moment its process exits rather than lingering as `done_idle`. Once any hook event has
fired for a session it is hook-owned and persists through its grace period. This is an accepted
trade for determinism: the reconciler's output depends only on its inputs, which makes it fully
unit-testable.

Two heuristics remain on the scanner path and are documented where they live: pairing several live
processes in one project directory to transcripts by mtime order, and inferring `working` from a
transcript appended within the last 10 seconds. Both are superseded by the first hook event for
that session.
