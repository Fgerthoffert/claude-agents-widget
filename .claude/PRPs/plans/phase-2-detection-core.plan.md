# Plan: Phase 2 — Detection Core

## Summary

Build the session-detection pipeline: a dependency-free hook script + consent-based installer, per-session JSON state files, a file watcher, a `claude` process scanner with transcript fallback, title extraction, and a pure-TS state machine reconciling everything into one session store exposed to the frontend. After this phase the app knows, live, every local Claude Code session and its state — the UI (Phase 3) and focus engine (Phase 4) consume this store.

## Metadata

- **Complexity**: Large (new subsystem, OS integration, but well-specified)
- **Source PRD**: `.claude/PRPs/prds/claude-agents-widget.prd.md` (read it, esp. Technical Approach + state model)
- **PRD Phase**: 2 — Detection core
- Also read: `CLAUDE.md`, `docs/adr/0002`, `docs/adr/0003`, `src/core/formatAggregate.ts` (style reference)

## Architecture (decisions already made — ADR-0003)

### Data flow
```
Claude Code hooks ──stdin JSON──> hook.mjs ──writes──> ~/.claude-agents-widget/sessions/<session_id>.json
                                                            │ (fs watch)
`ps` scanner (5s) + ~/.claude/projects/*.jsonl ──────> TS reconciler/state machine ──> session store ──> UI events
```

### Hook script (`hooks/claude-agents-widget-hook.mjs` in repo, installed to `~/.claude-agents-widget/hook.mjs`)
- Plain Node ≥18, ZERO npm dependencies (runs under the user's default Node 18). ESM, arrow functions.
- Reads the hook payload JSON from stdin: `session_id`, `transcript_path`, `cwd`, `hook_event_name` (+ `message` on Notification).
- Captures the ancestor process chain: start at `process.ppid`, walk up via `ps -o ppid=,comm=,args= -p <pid>` until PID 1; store `[{pid, comm, args}]`. This is the raw material Phase 4 uses to find the owning terminal/IDE window — capture it faithfully at SessionStart (and refresh on later events if cheap).
- Merge-writes `~/.claude-agents-widget/sessions/<session_id>.json` (create dir on demand, write temp file + rename for atomicity).
- MUST be crash-proof and fast: wrap everything in try/catch, always exit 0, total budget < 200ms typical. Never write to stdout (hooks can interpret stdout); errors → append to `~/.claude-agents-widget/hook.log`.
- Registered hook events → state mapping (PRD state model):
  `SessionStart`→working, `UserPromptSubmit`→working, `Stop`→done_idle, `Notification`→needs_input (payload message kept), `SessionEnd`→ended.

### Session state file schema (`SessionRecord`) — synthetic example
```json
{
  "sessionId": "abc-123", "cwd": "/Users/test/proj", "transcriptPath": "/Users/test/.claude/projects/-Users-test-proj/abc-123.jsonl",
  "state": "working",
  "lastEvent": "SessionStart", "notificationMessage": null,
  "updatedAt": "2026-09-09T12:00:00.000Z",
  "hookPid": 123, "ancestors": [{ "pid": 1, "comm": "launchd", "args": "/sbin/launchd" }]
}
```
`state` ∈ working | needs_input | done_idle | ended; `updatedAt` ISO-8601 UTC. Define as a TS type in `src/core/types.ts` (a types-only file is the one allowed multi-export exception; document it in CLAUDE.md if not already).

### Installer (pure merge fn + `scripts/install-hooks.mjs` CLI, npm script `install-hooks`)
- Idempotent merge into `~/.claude/settings.json`: parse JSON, add our command entries under each event ONLY if absent (identify ours by the hook.mjs path); never touch other hooks; backup `settings.json` to `settings.json.claude-agents-widget.bak` before first modification; `--dry-run` prints the diff; malformed JSON ⇒ refuse with message, never clobber.
- Copies `hook.mjs` to `~/.claude-agents-widget/hook.mjs`.
- Command format: `node ~/.claude-agents-widget/hook.mjs` (hooks pass the event via stdin payload; no argv needed).

### App-side detection (TypeScript: pure functions in `src/core/`, thin imperative shell in `src/detection/`)
- Watch `~/.claude-agents-widget/sessions/` — use `@tauri-apps/plugin-fs` watch (add plugin + capability). On change, read file, feed reconciler.
- Scanner every 5s: run `ps -axo pid,ppid,command` via `@tauri-apps/plugin-shell` (capability restricted to `ps` with fixed args). Pure function `parseClaudeProcesses(psOutput)` finds `claude` CLI processes. Cross-checks: session records whose hookPid/ancestors are all dead ⇒ ended; running claude PIDs with no session record ⇒ synthesize a record (state from transcript mtime: appended within 10s ⇒ working, else done_idle) by matching cwd to `~/.claude/projects/<encoded-path>/` (encoding: `/` and `.` → `-`; VERIFY against the real dirs on this machine — ~/.claude/projects has live data to inspect, read structure/keys only).
- Title extraction `extractSessionTitle(jsonlLines)`: inspect the real transcript format in ~/.claude/projects (summary-type records and/or first user message); prefer summary, fallback: truncated first user prompt (60 chars). Re-extract on transcript change (titles evolve).
- Reconciler `reconcileSessions(hookRecords, scannedProcesses, now)`: pure, deterministic, unit-tested. Precedence: fresh hook state wins; scanner only adds unknown sessions, confirms liveness, and expires records (`ended` dropped from store after 5 min; `done_idle` kept).
- Store: minimal functional subscriber store in `src/detection/sessionStore.ts` (no state library). Surface for now: Panel placeholder shows live session count ("N session(s) detected") to prove the pipeline end-to-end; Phase 3 builds the real UI on the same store.

## Testing strategy (coverage gate ≥85% applies)

- Pure functions (parsers, reconciler, state mapping, title extraction, settings merge): exhaustive Vitest unit tests with fixtures in `src/core/__fixtures__/` — synthetic ps output and synthetic transcript JSONL. Copy the *structure* of real files but REDACT all content: never commit real transcript text or real project paths; use /Users/test/… placeholders.
- Hook script: integration test spawning `node hooks/claude-agents-widget-hook.mjs` with fake stdin payload and HOME pointed at a tmp dir; assert resulting state-file content. Must run in CI's ubuntu job — `ps -o ppid=,comm=,args= -p` works on Linux too, but comm formatting differs: assert loosely on ancestors.
- Installer: unit tests on the pure merge function with fixture settings.json variants (missing, empty, other hooks present, ours already present ⇒ no-op, malformed ⇒ refusal).

## Edge cases checklist
- settings.json missing / malformed / already contains our hooks (idempotency)
- session file partially written (JSON parse fail ⇒ skip, retry on next event)
- two sessions in the same cwd (distinct session_id files — verify no collision)
- claude process dies without SessionEnd (scanner liveness sweep)
- transcript dir absent (fresh machine, no sessions yet)
- hook.mjs invoked with empty/garbage stdin (exit 0, log to hook.log)

## Tasks
1. Branch `feat/phase-2-detection-core` from fresh main.
2. `hooks/claude-agents-widget-hook.mjs` + integration tests.
3. `src/core/types.ts` + state-mapping/reconciler/parsers/title-extraction pure functions + unit tests (one function per file).
4. Installer (pure merge fn + `scripts/install-hooks.mjs`, npm script `install-hooks`, `--dry-run` support).
5. Tauri wiring: add plugins fs/shell to Cargo.toml + capabilities + package.json; `src/detection/` shell (watcher + 5s scanner loop + store); Panel placeholder shows live session count.
6. Validate: lint, typecheck, test (≥85% on src/core), `npm run tauri build -- --no-bundle`.
7. Docs: ADR-0006 (hook script design: zero-dep Node, state-file IPC, atomic writes, always-exit-0), update CLAUDE.md (install-hooks command, types.ts exception), README quick-start.
8. PR `feat: phase 2 — detection core`; flip PRD phase 2 → complete in-PR once checks are green; squash-merge (autonomy authorized by user 2026-09-09).

## Risks
| Risk | Mitigation |
|---|---|
| Hook payload field names drift from docs | Verify against https://docs.anthropic.com/en/docs/claude-code/hooks and real transcript/hook data on this machine (structure only, redact content) |
| Editing the user's real `~/.claude/settings.json` during dev/tests | Tests NEVER touch real HOME (tmp dirs only). Do NOT run the real installer in this phase — real installation happens at manual-smoke time |
| fs-watch plugin quirks | Fallback: 2s mtime poll of the sessions dir behind the same store interface |
