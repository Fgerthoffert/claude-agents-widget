# 11. Detection failures must be visible, and builds must identify themselves

Date: 2026-09-09

## Status

Accepted

## Context

v0.2.0 shipped a widget that reported "No agents running right now" while nine Claude Code
sessions were live. Every layer the user could inspect was healthy: the hook was registered for
all five events, the hook script had never written an error to `~/.claude-agents-widget/hook.log`,
a dozen valid state files sat in the sessions directory with fresh timestamps, and running the
pure pipeline (`parseClaudeProcesses` → `reconcileSessions`) under plain Node against those exact
files returned seven sessions.

The cause was a Cargo feature. `watch` is **not** a default feature of `tauri-plugin-fs`, so the
plugin never registered its `watch` command and `watchImmediate()` rejected at runtime with a
command-not-found error. That rejection was awaited _outside_ `startDetection`'s try block, so it
took down the hook reader, the scanner and the 5-second interval together, before the first sweep
ran. Nothing said so: the only failure path was `console.error`, and a release build has no
devtools.

Three separate design faults turned one missing feature flag into a silent product failure:

1. **Nothing was logged where a user could read it.** `console.error` in a packaged Tauri app goes
   nowhere.
2. **The empty list was indistinguishable from a broken pipeline.** "No agents running right now"
   is a reassuring sentence, and it was displayed for a pipeline that had never started.
3. **`Promise.all` coupled independent sources.** Hook records and the process scanner are
   deliberately independent (ADR-0003); combining them with `all` meant either one failing threw
   away the other's rows.

Neither the Cargo feature nor a capability scope is visible to a unit test of the TypeScript that
depends on it, which is why the whole suite stayed green. This is the second bug of that exact
shape: a missing `core:window:allow-start-dragging` capability once made every drag region inert
(ADR-0008), and `src/ui/windowCapabilities.test.ts` exists because of it.

Separately, a bug report against this app could not say which build it came from.

## Decision

**Failures degrade, and say so.**

- `tauri-plugin-fs` is declared with the `watch` feature, and `tauri-plugin-log` writes to the app
  log directory so every failure survives without devtools.
- The watcher is treated as what it is — an optimisation that lowers state-change latency from
  ~5s to ~1s. Losing it costs latency, never detection: it is created inside a try, and on failure
  the interval alone drives the pipeline.
- Sweeps use `Promise.allSettled`. One source failing yields partial data flagged as degraded
  rather than an empty list; only both failing is a failure.
- Missing transcript titles are decoration and degrade to the project directory.
- The store carries a `DetectionHealth` snapshot alongside the sessions, because the two are only
  meaningful together: an empty list with a healthy pipeline means "nothing is running", and the
  same list with a failing one means "this widget is broken". The panel must never render the
  first sentence for the second state.
- Session-count changes are logged as a timeline, so "the panel went empty" can be placed in time.

**Native grants are asserted in tests.** `src/detection/detectionCapabilities.test.ts` checks the
Cargo features and capability scopes the detection pipeline depends on, at the level where the bug
actually lived, following the precedent of `windowCapabilities.test.ts`.

**Builds identify themselves.** The git short SHA and whether the checkout is on a release tag are
baked in at build time as `__APP_BUILD__`. A tagged build shows `v0.2.1`; anything else shows
`v0.2.1 (abc1234)`. `GITHUB_REF_TYPE` is trusted alongside `git describe`, so a release build whose
checkout cannot see its own tag is still recognised as tagged. Missing git is never a build
failure — a release tarball has no repository and must still compile. The string appears in the
setup/diagnostics view and in the copied diagnostics dump, not as new panel chrome.

## Consequences

A pipeline that cannot start now announces itself in the panel, in the log file and in the
diagnostics dump, and a bug report identifies its build. Partial detection is possible where it
was previously all-or-nothing, which means the panel can now show rows it knows to be incomplete —
acceptable, because the alternative shipped as silence.

The wider lesson, now twice learned: for a Tauri app, a green test suite says nothing about whether
the native side granted what the frontend calls. Every new plugin command or capability scope needs
an assertion in `detectionCapabilities.test.ts` or `windowCapabilities.test.ts`.

What remains unproven by tests: the log file is written to the real app log directory, and only a
packaged build exercises that path.
