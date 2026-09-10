# ADR-0017: The app owns the classification, and refreshes its own hook

- **Status**: Superseded by [ADR-0018](0018-claude-code-is-the-source-of-truth.md) — there is no hook script left to go stale.
- **Date**: 2026-09-10

## Context

The user restated what the panel is for, and it is worth quoting because it is the clearest
statement of the product's purpose anyone has written down:

> "From a user standpoint (the user of the widget), the point is mostly to know, if the agent is
> autonomous and running, if the agent is stuck and wait for the user to select an option or
> something to continue, or if the user is 'done' and waiting the the user to read the result and
> eventually provide the next prompt."

Three states, and ADR-0014 had already built exactly that. So the complaint should not have been
possible — and on the machine it was reported from, this is what the store actually held:

```
working      UserPromptSubmit   type=None          msg=None
needs_input  Notification       type=idle_prompt   msg=Claude is waiting for your input
needs_input  Notification       type=idle_prompt   msg=Claude is waiting for your input
```

Two sessions in **Waiting for you**, both on `idle_prompt` — Claude Code noting that nothing has
been typed for a while, which blocks nothing and is precisely the case ADR-0014 reclassified as
`done_idle`. The fix had shipped in v0.4.0. It was not running.

`~/.claude-agents-widget/hook.mjs` on that machine had no `IDLE_NOTIFICATIONS` in it at all. The
hook script is written by the installer, and **installing a new version of the app does not
rewrite it**. Once the entries are in `~/.claude/settings.json`, `hooks.status` reads `done`, the
_Install hooks_ button disappears, and the script on disk stays at whatever version first put it
there. Every behaviour fix ever shipped inside that script was therefore invisible to anyone who
did not think to reinstall — including the `/clear` sweep from the same ADR.

The second half of the diagnosis is worse. `mapHookEventToState` exists, is tested, and its own
docblock says it is there "so the app can re-derive state from `lastEvent` without re-reading the
hook". **Nothing called it.** The defence against exactly this failure had been written and left
unwired, and `reconcileSessions` read `record.state` — the stale hook's opinion — instead.

## Decision

### The event is the hook's to report; what it means is the app's to decide

`reconcileSessions` now derives state from `mapHookEventToState(record.lastEvent,
record.notificationType)`, falling back to the recorded `state` only when `lastEvent` is not one
of the five events we register — so a future hook reporting something new is not blanked by an app
that has never heard of it.

This makes every classification fix retroactive. On the machine above it moves both sessions out
of Waiting for you and into Done, and clears the menu bar mark, with no reinstall and no restart
of the agents. It also fixes the other half of ADR-0014 for the same users: a `SessionStart`
written as `working` by an old hook is now read as `done_idle`, so a cleared session stops
claiming to be busy.

The division is the point. A hook script in the user's home directory is the one part of this
system we cannot version, cannot upgrade in place without asking, and cannot even be sure is the
one we shipped. So it should carry as little judgement as possible: it reports _what happened_.
What that means for the panel is a decision the app makes, in `src/core`, where it ships with the
version that renders it.

### The app refreshes its own hook script on launch

`refreshHookScript` compares `~/.claude-agents-widget/hook.mjs` against the copy bundled in the
app and rewrites it when they differ, once, at startup. That covers what re-derivation cannot: the
`retireOtherSessions` sweep, the ancestor capture, anything the hook does rather than reports.

This runs unprompted, and that is a deliberate reading of ADR-0009's consent model rather than an
exception to it. The consent in ADR-0009 is about `~/.claude/settings.json` — _the user's_ file,
shared with Claude Code and everything else they have installed, which is why the installer shows
the exact diff and writes a backup. `~/.claude-agents-widget/hook.mjs` is the widget's own file,
in the widget's own directory, which exists only because the user asked for it. Replacing it with
the version this app is built to read is maintenance, not a new decision.

An **absent** script is left absent. That is the not-installed case and it still needs the consent
flow; silently creating it would be the exception this is not.

## Alternatives Considered

- **Special-case `idle_prompt` in `groupSessions` or `describeSession`.** Rejected: it treats one
  symptom of a stale hook, and the next classification change would need the same patch in the
  same places. Re-deriving fixes the class.
- **Version the hook script and warn when it is old**, leaving the update to the user. Rejected as
  the primary mechanism: it is another thing to notice and act on, and the reason this bug existed
  is that the setup screen had already stopped asking. A user should not have to know their hook
  is stale. (The setup screen still reports the install honestly; it simply no longer has a stale
  script to report.)
- **Have the hook report only raw events and hold no state at all** — no `state` field in the
  record. Rejected for now: the field is what lets diagnostics and the `ended` TTL work without
  re-deriving, and it costs nothing to keep now that nothing trusts it blindly. It is the obvious
  next simplification if a third classification bug turns up.
- **Refresh the script from the installer only, on every app start, via the full consent flow.**
  Rejected: it would show a consent dialog on every update for a file the user cannot meaningfully
  review and has already agreed to.

## Consequences

The two states the user cares about distinguishing — _stuck_ and _done_ — are now decided by code
that ships with the app that draws them. Waiting for you means a question, and it means that on
every installation, not only on ones where somebody reinstalled the hook at the right moment.

A stale hook script is no longer a silent, indefinite condition. It is corrected on the next
launch and logged.

What we have committed to: `mapHookEventToState` must stay a faithful mirror of the hook's own
`EVENT_STATE` map for the events we register, and its comment says so. The two can now disagree
only in the app's favour, which is the right direction — but they should not disagree at all, and
the hook's table is the one that must follow.

The general lesson is not about hooks. A defence that is written, tested and never called is worth
nothing at all; `mapHookEventToState` had a docblock describing this exact failure while the
failure was happening in production.
