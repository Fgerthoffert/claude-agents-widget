# Claude Agents Widget

## Problem Statement

A power user running 5–10+ parallel Claude Code agents (plain terminals, VS Code terminals, Claude Desktop) has no single view of which agents are running, which are done, and which are blocked waiting for input. Sessions get forgotten, blocked agents sit idle for long stretches, and finding the right window among Slack, Chrome, and videoconference windows across multiple screens costs time and focus on every switch.

## Evidence

- User statement: "I often have more than 5 agents, sometimes more than 10, and it's difficult to navigate between them, understand where is which agent, I might end up simply forgetting one."
- Existing Claude desktop notifications ping on completion but give no overall view and don't identify _which_ window/session fired.
- Market signal: at least 5 independent macOS tools (claude-status, c9watch, CC Menu Bar, so-agentbar, ClaudeBar) built for this exact pain in 2026 — the problem is real and widespread among multi-agent users.
- Hands-on evaluation of claude-status (user, 2026-09-09): "quite good, but clicking on the agent does not redirect to the corresponding window, and I feel it should display the name of the claude session." Confirms that reliable click-to-focus and name-based session identification are the make-or-break features, and that the closest competitor fails at both in the user's environment.

## Proposed Solution

A lightweight, always-on macOS app (Tauri 2, TypeScript-first) with two synchronized surfaces: a **menu bar icon** showing aggregate state (e.g., `3▶ 2⏸ 1✔`) with a dropdown session list, and an **always-on-top floating panel** the user can park on any screen showing every local Claude Code session live (project, custom name, state, time-in-state). Clicking a session focuses the exact terminal window/tab (or VS Code window) it runs in. Detection is hybrid: Claude Code **hooks** (installed once into `~/.claude/settings.json`) push precise state transitions; **process scanning + transcript watching** provides zero-config discovery and a fallback when hook events are missed.

Chosen over adopting [claude-status](https://github.com/gmr/claude-status) because that project is single-maintainer, Swift, and lacks the always-on-top panel — the core need here.

## Key Hypothesis

We believe an always-visible session overview with one-click window focusing will eliminate forgotten and silently-blocked agents for users running 5+ parallel Claude Code sessions.
We'll know we're right when the user can locate and return to any of 10 concurrent sessions in under 5 seconds, and no session sits in "needs input" unnoticed for more than a couple of minutes during active work hours.

## What We're NOT Building

- **Token/usage/cost tracking** — explicitly not interesting to the user right now (maybe later).
- **Claude Desktop chat-session monitoring (v1)** — no public hook/transcript mechanism exists; deferred to a v2 research spike.
- **Session management** (starting, stopping, or sending input to agents) — this is a monitor + navigator, not a controller.
- **Cross-platform support** — macOS only; Tauri keeps the door open but no Linux/Windows work in v1.
- **Cloud session monitoring** (claude.ai/code remote sessions) — nothing runs locally to observe.

## Success Metrics

| Metric                           | Target                                                           | How Measured                           |
| -------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Session discovery latency        | New session visible in widget ≤ 2s after start                   | Integration test + manual verification |
| State-change latency (hook path) | ≤ 1s from hook event to UI update                                | Integration test                       |
| Click-to-focus success rate      | ≥ 95% across supported terminals (Terminal.app, iTerm2, VS Code) | Manual test matrix per release         |
| Resource footprint               | ≤ 50 MB RSS, ~0% idle CPU                                        | Activity Monitor check per release     |
| Test coverage                    | ≥ 85% lines on TS core logic                                     | Coverage gate in CI                    |
| Lived experience                 | User stops forgetting sessions                                   | Self-report after 2 weeks of daily use |

## Open Questions

- [ ] Is an Apple Developer account available for code signing + notarization of release builds? (Unsigned builds require right-click-open / `xattr` workaround.)
- [ ] Which terminal app(s) does the user actually use day-to-day? v1 targets Terminal.app, iTerm2, and VS Code integrated terminal; others (Warp, Ghostty, Kitty, tmux panes) prioritized by real usage. Extra weight now: claude-status's click-to-focus failed in that environment — knowing the exact terminal(s) tells us which adapter to harden first (and possibly why claude-status failed).
- [ ] Do Claude Code sessions launched from the Claude Desktop app (local execution) fire hooks and write transcripts identically to CLI sessions? (Expected yes — needs a 30-minute spike.)
- [ ] Hook installation UX: auto-merge into `~/.claude/settings.json` with explicit user consent, or print instructions for manual install?
- [ ] How to disambiguate two sessions in the same project directory (path-encoding collision) — session ID from hook payload should resolve this; verify.

---

## Users & Context

**Primary User**

- **Who**: A hands-on engineering leader / developer (initially: the repo owner) running many Claude Code agents in parallel across plain terminals, VS Code terminals, and Claude Desktop, on a multi-monitor macOS setup crowded with Slack, Chrome, and videoconference windows.
- **Current behavior**: Manually cycles through windows/screens to check on agents; relies on per-event desktop notifications that don't say which window to go to; sometimes forgets an agent entirely.
- **Trigger**: An agent finishes or blocks on a permission/input prompt while the user is focused elsewhere.
- **Success state**: Glances at the always-on panel (or menu bar), sees exactly which agents need attention, clicks one, and lands in the right window instantly.

**Job to Be Done**
When several of my Claude Code agents are working in parallel while I do other things, I want a constantly visible overview of each agent's state and a one-click jump back to any of them, so I can unblock and review agents promptly without hunting through windows or forgetting any.

**Non-Users**

- Single-session users — native notifications are sufficient.
- Users wanting usage/cost dashboards — other tools (ClaudeBar, ccusage) cover that.
- Linux/Windows users (v1).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority   | Capability                                                                                                                                          | Rationale                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Must       | Live list of all local Claude Code sessions with state: **working / needs input / done-idle / ended**                                               | The overall view is the core problem                                                                                                                                          |
| Must       | Always-on-top floating panel: above all windows, freely draggable between monitors, deliberately compact and uncluttered, toggleable from menu bar  | "Something constantly on"; user's stated usage is to move it monitor-to-monitor as needed, so drag ergonomics and a minimal visual footprint matter as much as the data shown |
| Must       | Menu bar icon with aggregate state + dropdown session list                                                                                          | Zero-screen-cost glanceability                                                                                                                                                |
| Must       | Click-to-focus: raise the exact terminal window/tab or VS Code window (Terminal.app, iTerm2, VS Code in v1)                                         | Navigation back to the agent is half the pain                                                                                                                                 |
| Must       | Hybrid detection: hooks (precise, event-driven) + process scan/transcript watch (discovery, fallback)                                               | Reliability; sessions started before app launch still appear                                                                                                                  |
| Must       | Session identification: Claude Code session title (auto-generated summary or user-renamed), project dir, git branch if cheap, time in current state | "Where is which agent" — identification at a glance; user flagged its absence as a gap in claude-status                                                                       |
| Should     | One-command hook installer with consent + idempotent settings.json merge                                                                            | Setup friction kills adoption, even for one user                                                                                                                              |
| Should     | Visual/sort emphasis on "needs input" sessions (e.g., pinned to top, colored)                                                                       | These are the ones being forgotten                                                                                                                                            |
| Should     | Launch at login                                                                                                                                     | Always-on implies always-running                                                                                                                                              |
| Could      | Compact/collapsed panel mode (e.g., show only sessions needing attention, or counts-only strip that expands on hover)                               | Further reduces clutter when many sessions are quietly working                                                                                                                |
| Could      | Custom session naming (à la `/name-session`)                                                                                                        | Nice identification aid                                                                                                                                                       |
| Could      | Optional native notification on state change with session name                                                                                      | Complements, not replaces, the overview                                                                                                                                       |
| Won't (v1) | Claude Desktop chat monitoring, token/cost tracking, session control, tmux pane focusing, Windows/Linux                                             | Scope control; see "NOT building"                                                                                                                                             |

### MVP Scope

Menu bar icon + floating always-on-top panel listing every local Claude Code session with the four states, updating within seconds via hooks with process-scan fallback, and click-to-focus working for Terminal.app, iTerm2, and VS Code. Test suite green in CI on every PR. That is enough to test the hypothesis in daily use.

### User Flow

1. App starts at login → menu bar icon appears; user toggles the floating panel and parks it on a secondary screen.
2. User spins up agents anywhere, as they do today — sessions appear in the panel automatically.
3. An agent hits a permission prompt → its row flips to **needs input** (surfaced to top, colored) within ~1s.
4. User glances at panel, clicks the row → the owning terminal window/tab is raised and focused on the correct screen.
5. User answers the prompt; row flips back to **working**. When the agent finishes, the row shows **done-idle** with time since.

---

## Technical Approach

**Feasibility**: HIGH — every mechanism is proven in shipped open-source tools (claude-status, c9watch); this project recombines them with a different UI emphasis and stack.

**Architecture Notes**

- **Tauri 2**: TypeScript frontend (panel + tray menu) and TS-first application logic; Rust core kept to thin plumbing (tray, always-on-top window, FS watch, shell exec via official plugins). Chosen over Electron for footprint (~10–20 MB vs 100+ MB, meaningful for an always-on widget) and over Swift for the user's TS maintainability preference.
- **Detection pipeline** (two independent sources reconciled into one session store):
  - _Hooks_: `SessionStart`, `UserPromptSubmit`, `Stop`, `Notification`, `SessionEnd` entries in `~/.claude/settings.json` invoke a tiny bundled CLI that writes a JSON state file per session to `~/.claude-agents-widget/sessions/`; the app watches that directory. Hook payloads provide session ID, cwd, transcript path, and the hook CLI captures its parent PID chain for later focusing.
  - _Scanner_: periodic (~5s) scan for `claude` processes + mtime/tail of `~/.claude/projects/*/*.jsonl` to discover sessions missing from the hook path (e.g., started before hook install) and to garbage-collect dead ones (PID viability check).
- **State model**: `working` (SessionStart/UserPromptSubmit, or transcript actively appending) → `needs_input` (Notification: permission request or idle prompt) → `done_idle` (Stop fired, no new prompt) → `ended` (SessionEnd or PID gone).
- **Click-to-focus**: at event time, walk the hook CLI's ancestor process tree to identify the owning app (Terminal.app, iTerm2, VS Code, …) and window/tab identifiers; on click, run the per-app AppleScript/`osascript` recipe (iTerm2 and Terminal.app have scriptable tab/window selection; VS Code focused via `open -b` + window matching). Per-app adapters behind a single functional interface so new terminals are additive. This is the feature claude-status failed at in the user's environment — treat it as the quality bar: integration-test each adapter against the user's real setup before calling Phase 4 done, and always degrade gracefully to app-level focus rather than doing nothing on click.
- **Session titles**: hooks don't carry the session title; read it from the transcript JSONL (`summary` records written by Claude Code, updated as the conversation evolves) with fallback to the truncated first user prompt. Honor user renames.
- **Code style**: functional TypeScript, arrow functions, one exported function per file, strict mode; unit tests colocated per function (Vitest); Rust kept near-boilerplate to minimize the second-language surface.
- **Repo harness**: `CLAUDE.md` (conventions, architecture map, commands), `docs/adr/` for every significant decision (ADR-0001 onward seeded from this PRD's decision log), `.claude/PRPs/` for PRD/plans — agents working in this repo get full context.
- **CI/CD (GitHub Actions)**: PR workflow (lint, typecheck, unit + integration tests, coverage gate); merge-to-main workflow (dev build artifact: unsigned .app/.dmg uploaded per commit); release workflow (tag → build, sign/notarize if credentials available, GitHub Release with changelog).

**Technical Risks**

| Risk                                                                                  | Likelihood | Mitigation                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Window/tab focusing brittle across terminal apps & macOS updates                      | M          | Per-app adapter isolation; manual test matrix; fall back to focusing the app + best-match window when tab-level fails |
| Hook events missed or settings.json hook install conflicts with user's existing hooks | M          | Scanner fallback reconciles state; idempotent installer that merges rather than overwrites, with dry-run              |
| macOS permissions (Automation/Accessibility prompts) confuse first run                | M          | Guided first-run checklist in the panel; docs                                                                         |
| Transcript JSONL format is undocumented/unstable                                      | L          | Treat as fallback only; state primarily from hooks (a stable public API)                                              |
| Tauri Rust core grows beyond "thin"                                                   | L          | ADR-enforced rule: logic lives in TS unless impossible; Rust changes require justification in PR                      |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| #   | Phase               | Description                                                                                                         | Status   | Parallel | Depends | PRP Plan                                              |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ------- | ----------------------------------------------------- |
| 1   | Scaffold & harness  | Tauri 2 + TS project, lint/format/typecheck, Vitest, CLAUDE.md, ADR seed, PR test workflow                          | complete | -        | -       | [plan](../plans/phase-1-scaffold-and-harness.plan.md) |
| 2   | Detection core      | Hook CLI + installer, session state files, FS watcher, process scanner, reconciled session store with state machine | pending  | -        | 1       | -                                                     |
| 3   | UI surfaces         | Menu bar tray + dropdown, always-on-top floating panel, needs-input emphasis, launch at login                       | pending  | with 4   | 2       | -                                                     |
| 4   | Focus engine        | Process-tree app identification, per-app focus adapters (Terminal.app, iTerm2, VS Code)                             | pending  | with 3   | 2       | -                                                     |
| 5   | Packaging & release | Dev-build-on-main workflow, release workflow (sign/notarize if possible), first-run permission guide, docs          | pending  | -        | 3, 4    | -                                                     |

### Phase Details

**Phase 1: Scaffold & harness**

- **Goal**: A repo any agent can work in confidently.
- **Scope**: Tauri 2 app skeleton (tray + one window), TS strict config, ESLint/Prettier enforcing functional style, Vitest with coverage gate, `CLAUDE.md`, `docs/adr/` with initial ADRs (stack, detection strategy, code style), GitHub Actions PR workflow (lint + typecheck + test).
- **Success signal**: `npm test` and the PR workflow pass on a hello-world tray app; conventions documented.

**Phase 2: Detection core**

- **Goal**: Accurate live model of every local Claude Code session.
- **Scope**: Hook CLI (session events → per-session JSON files, ancestor PID capture), consent-based idempotent hook installer, directory watcher, `claude` process scanner + transcript mtime fallback, session-title extraction from transcript `summary` records (fallback: truncated first prompt), pure-TS state machine reconciling both sources, unit + integration tests with fixture transcripts and fake hook events.
- **Success signal**: Starting/stopping real sessions in a terminal shows correct state transitions in a debug log within target latencies.

**Phase 3: UI surfaces**

- **Goal**: The constantly-visible overview.
- **Scope**: Tray icon with aggregate counts, dropdown list, floating always-on-top panel (above all windows including full-screen-adjacent spaces where macOS allows; whole surface draggable — no fiddly title bar; position persisted across restarts; compact row design with tight information density and minimal chrome), needs-input sort/emphasis, launch-at-login toggle.
- **Success signal**: 10 concurrent sessions legible at a glance; panel drags smoothly between monitors and survives restarts in place; small enough to sit next to a videoconference window without feeling like clutter.

**Phase 4: Focus engine**

- **Goal**: One click lands the user in the right window.
- **Scope**: Ancestor-process → app identification, adapter interface, AppleScript recipes for Terminal.app, iTerm2, VS Code; graceful degradation to app-level focus; manual test matrix doc.
- **Success signal**: ≥95% focus success across the three targets in the matrix, verified in the user's actual daily environment (where claude-status's focusing failed) — a click must never be a no-op; worst case is app-level focus.

**Phase 5: Packaging & release**

- **Goal**: Installable, updatable builds with zero manual steps.
- **Scope**: Dev .dmg artifact on every main merge, tagged release workflow with changelog, signing/notarization (or documented unsigned-install path), first-run permissions walkthrough, README.
- **Success signal**: Fresh Mac can install from a GitHub Release and reach a working panel in under 5 minutes.

### Parallelism Notes

Phases 3 (UI) and 4 (focus engine) both consume the session store from Phase 2 but touch disjoint code (frontend vs adapters) — they can be developed by parallel agents. Phase 5 needs both to package a complete app.

---

## Decisions Log

| Decision             | Choice                                                                        | Alternatives                                                       | Rationale                                                                                                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build vs adopt       | Build our own                                                                 | Adopt or fork claude-status; c9watch                               | claude-status is single-maintainer (last release Jul 2026), Swift, and lacks the always-on-top panel — the core need. Hands-on test (2026-09-09) also found its click-to-focus broken in the user's environment and no session names displayed. BSD-3 lets us borrow its design ideas. User confirmed 2026-09-09. |
| Tech stack           | Tauri 2 (TS UI + thin Rust core)                                              | Electron (all TS, ~100–150 MB RAM); Swift/SwiftUI (native, not TS) | Small always-on footprint with a TypeScript-first codebase; Rust confined to plumbing. User confirmed 2026-09-09.                                                                                                                                                                                                 |
| Form factor          | Menu bar icon + always-on-top floating panel                                  | Menu-bar only; WidgetKit desktop widget                            | Panel delivers "constantly on, any screen"; widget sits under windows and needs Swift. User confirmed 2026-09-09.                                                                                                                                                                                                 |
| Claude Desktop chats | Deferred to v2 spike                                                          | Best-effort heuristics in v1                                       | No public hooks/transcripts; every existing tool skips it; heuristics would be fragile. User confirmed 2026-09-09.                                                                                                                                                                                                |
| Detection strategy   | Hybrid: hooks primary, process/transcript scan fallback                       | Hooks-only; scan-only                                              | Hooks are precise and near-real-time but need install and can miss pre-existing sessions; scanner is zero-config but heuristic. Hybrid is the proven pattern (claude-status).                                                                                                                                     |
| Code style           | Functional TS, arrow functions, one exported function per file, ≥85% coverage | OO/class style; multi-export modules                               | User requirement; enforced via ESLint config and CI gate.                                                                                                                                                                                                                                                         |
| Session control      | Out of scope                                                                  | Start/stop/send-input to agents                                    | Monitor + navigator only; control adds risk and scope without addressing the stated pain.                                                                                                                                                                                                                         |
| Token/usage tracking | Out of scope (v1)                                                             | Include usage dashboards                                           | User explicitly deprioritized.                                                                                                                                                                                                                                                                                    |

---

## Research Summary

**Market Context**
Five-plus macOS tools target this pain: [claude-status](https://github.com/gmr/claude-status) (closest match: menu bar + widget + click-to-focus, Swift, macOS 26.2+, single maintainer), [c9watch](https://dev.to/minchenlee/i-built-a-macos-menu-bar-app-to-monitor-all-my-claude-code-sessions-heres-how-it-works-1kb7) (Tauri 2, zero-config process scanning + JSONL parsing), [CC Menu Bar](https://jonwalls.dev/blog/cc-menubar/) and [so-agentbar](https://sotthang.github.io/so-agentbar/) (read-only monitors), [ClaudeBar](https://github.com/tddworks/ClaudeBar) (usage quotas). None offer an always-on-top multi-screen panel; none cover Claude Desktop chats.

**Technical Context**
Greenfield repo (LICENSE only). Proven mechanisms: Claude Code hooks (`SessionStart`/`UserPromptSubmit`/`Stop`/`Notification`/`SessionEnd`) for event-driven state; `~/.claude/projects/*/*.jsonl` transcripts + `claude` process scanning for discovery; ancestor-process-tree analysis + per-app AppleScript for window/tab focusing (claude-status supports 20+ apps this way, validating feasibility). User's machine: macOS 26.3 (Darwin 25.3.0).

---

_Generated: 2026-09-09_
_Status: DRAFT - needs validation_
