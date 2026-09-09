# ADR-0001: Build our own widget rather than adopting claude-status

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

At least five macOS tools already target the "which of my Claude Code agents needs me?" problem:
[claude-status](https://github.com/gmr/claude-status), c9watch, CC Menu Bar, so-agentbar and
ClaudeBar. claude-status is the closest match — menu bar, widget, click-to-focus — so adopting or
forking it was the cheapest path on paper.

Hands-on evaluation of claude-status (2026-09-09) found two blocking gaps in the owner's actual
environment: clicking a session did not redirect to the corresponding window, and session names were
not displayed. Those are precisely the two features that make or break the tool. It is also
single-maintainer (last release Jul 2026), written in Swift, and has no always-on-top panel.

## Decision

Build a new application. Borrow design ideas freely from claude-status (BSD-3 licensed) —
particularly its ancestor-process-tree approach to window focusing.

## Alternatives Considered

- **Adopt claude-status as-is** — rejected: no always-on-top panel (the core need), and the two
  features we care most about are broken here.
- **Fork claude-status** — rejected: Swift, against the owner's TypeScript maintainability
  preference; a fork inherits the maintenance burden without the stack we want.
- **Use c9watch** — rejected: read-only monitor, no always-on-top panel, no click-to-focus.

## Consequences

We own the whole stack, including the hard part (window focusing) that the incumbent got wrong. We
carry full maintenance cost, but we can set the quality bar for focusing ourselves: a click must
never be a no-op, degrading to app-level focus at worst.
