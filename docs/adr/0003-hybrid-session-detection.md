# ADR-0003: Hybrid session detection — hooks primary, process/transcript scan as fallback

- **Status**: Superseded by [ADR-0018](0018-claude-code-is-the-source-of-truth.md) — `claude agents --json` reports what both halves of this hybrid were reconstructing.
- **Date**: 2026-09-09

## Context

The widget must know about every local Claude Code session and its current state. Two mechanisms
exist, with complementary failure modes:

- **Claude Code hooks** (`SessionStart`, `UserPromptSubmit`, `Stop`, `Notification`, `SessionEnd`)
  are a stable public API and fire within milliseconds, carrying session ID, cwd and transcript
  path. But they require a one-time install into `~/.claude/settings.json`, and they say nothing
  about sessions that were already running before the install.
- **Process scanning** (`claude` processes) plus watching `~/.claude/projects/*/*.jsonl` transcript
  mtimes is zero-config and sees everything, but it is heuristic: it infers state from file activity
  rather than being told, and the JSONL format is undocumented and may change.

Neither alone meets the goals of ≤2s discovery latency, ≤1s state-change latency, and no session
ever going unnoticed.

## Decision

Run both, reconciled into a single session store by a pure-TypeScript state machine.

Hooks are the source of truth for state transitions. The scanner (~5s interval) handles discovery of
sessions the hook path missed and garbage-collects dead ones via PID viability checks. Session titles
come from the transcript's `summary` records, falling back to a truncated first user prompt.

## Alternatives Considered

- **Hooks only** — rejected: pre-existing sessions stay invisible, and a missed or misconfigured
  hook means a silently wrong UI with no way to self-correct.
- **Scanning only** — rejected: cannot distinguish "waiting for permission" from "thinking" reliably,
  and "needs input" is the state the user most needs to see. Also misses the ≤1s latency target.

## Consequences

This is the pattern claude-status already validated, so the risk is known rather than novel. Cost:
two code paths and a reconciliation layer to test, and an install step for hooks (idempotent, merging
rather than overwriting, with consent). Benefit: the scanner is a genuine safety net — if the
transcript format shifts under us, hooks keep working; if hooks are missing, the scanner still shows
the session. Treating the JSONL format as fallback-only keeps the undocumented dependency
non-critical.
