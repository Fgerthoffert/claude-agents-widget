# ADR-0005: React 19 + Vite for the frontend

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

The PRD fixes Tauri 2 and a TypeScript-first codebase (ADR-0002) but leaves the frontend framework
open. The UI surface is small and will stay small: a compact panel of session rows and a tray
dropdown. Bundle size is irrelevant — the assets are loaded from disk by a local webview, never over
a network — so the usual argument for a minimal framework does not apply here.

What does matter is that much of this code will be written and modified by agents, and that the
panel's rendering must stay predictable while session state updates every few seconds.

## Decision

React 19 with Vite, via `create-tauri-app --template react-ts`.

## Alternatives Considered

- **Vanilla TypeScript** — rejected: maximum control, but every list diff and state subscription
  becomes hand-rolled. That is exactly the code we would rather not own or test.
- **Svelte 5** — rejected: smaller output and pleasant runes-based reactivity, but a narrower
  ecosystem and newer idioms that agents handle less reliably than React's.

## Consequences

Broadest ecosystem and the framework agents know best, which is the maintainability argument that
carried the decision. Components are plain arrow functions, so React fits the functional style of
ADR-0004 without special pleading. We accept a heavier runtime than strictly necessary in exchange —
a cost the local-webview context makes close to free.
