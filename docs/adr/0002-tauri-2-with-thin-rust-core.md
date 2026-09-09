# ADR-0002: Tauri 2 with a deliberately thin Rust core

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

The app is always running, so its resting footprint matters more than for a tool the user launches
on demand. The owner maintains this codebase and prefers TypeScript; a second language is a tax on
every future change. But the required capabilities — a menu bar tray icon, an always-on-top window
visible across spaces, filesystem watching, and `osascript` execution — all need native access.

The form factor was decided alongside the stack: a menu bar icon **and** an always-on-top floating
panel, rather than menu-bar-only or a WidgetKit desktop widget. A WidgetKit widget sits _under_
windows and would require Swift, which defeats the point.

## Decision

Tauri 2, with the TypeScript layer owning the UI and all application logic, and Rust confined to
plumbing: tray registration, window configuration, FS watching and shell exec via official plugins.

**Logic goes in TypeScript unless it is impossible there.** Any growth of `src-tauri/` must be
justified in the pull request that introduces it.

## Alternatives Considered

- **Electron** — rejected: ~100–150 MB RAM against Tauri's ~10–20 MB. For an always-on widget that
  difference is the whole argument.
- **Swift / SwiftUI** — rejected: native and lean, but not TypeScript; the owner would be
  maintaining a language they do not want to maintain.
- **Menu-bar-only Tauri app** — rejected as a form factor: the stated need is "something constantly
  on", parked on a secondary screen, not something requiring a click to reveal.

## Consequences

Small binary and small resting footprint, with a TypeScript-first codebase. The cost is a two-language
repo, mitigated by keeping `src-tauri/src/lib.rs` near-boilerplate. The risk this ADR guards against
is drift: the Rust core quietly accumulating logic that belongs in `src/core/`. Reviewers enforce it.
