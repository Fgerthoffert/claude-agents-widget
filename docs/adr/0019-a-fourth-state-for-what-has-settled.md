# ADR-0019: A fourth state, for what has settled

- **Status**: Accepted
- **Date**: 2026-09-10

## Context

ADR-0014 split the panel into three sections on the principle that the user distinguishes three
things: an agent working, an agent blocked, an agent finished. That was right, and one of the three
was still doing two jobs:

> "I want to differentiate betwen sessions that were recently done and I can look at, from
> sessions that were cleared (and nothing else happened) or session that have been done for some
> time and already looked at. […] Maybe you could have a fourth status for sessions that were
> cleared or that have been completed for longer. (i.e. more than 30mn)"

**Done** held both "this finished a minute ago, go and read it" and "this finished before lunch"
— and, worse, "somebody typed `/clear` in that terminal and walked away". They looked identical,
so the section that exists to say _there is something here for you_ filled up with things there is
nothing to do about. With ten terminals open, most of Done is furniture.

## Decision

A fourth state, `dormant`, and a fourth section, **Idle**. `settleSession` decides, and only a
`done_idle` session can settle — `working` is working, and a blocked session stays blocked however
long it has waited, because an agent stuck on a question for two hours is the _last_ thing to dim.

Two ways in:

- **No name.** Claude Code names a session from its first prompt, and names it eagerly: one of
  the live sessions on the machine this was written on is called
  `i-don-t-see-a-coding-task-to-summarize-could`. So a session with no name is one where nothing
  has been asked — freshly opened, or cleared with `/clear`, which mints a new session in the same
  terminal. Either way there is nothing in it to read, which is exactly the signal the user
  described.
- **Thirty minutes** in the same finished state. Long enough that something finished and meant to
  be come back to is still in Done; short enough that this morning's work is not.

Settled rows are **dimmed to 55%, not hidden**, and stay clickable — going back to a cleared
terminal is a perfectly reasonable thing to want. Hover restores them to full strength, so
pointing at one is enough to read it. They sort below Done, and the tray mark ignores them
entirely, as it already ignored everything that is not a real question.

### The feedback loop this had to avoid

`dormant` is derived from `done_idle`, and the derivation depends on how long the state has been
held — which is measured by comparing each poll's state against the stored one. Store `dormant`,
compare it against the next poll's `done_idle`, and it looks like a state _change_: the clock
re-stamps, the session drops back under thirty minutes, un-settles, and flips between two sections
every three seconds.

`carryStateSince` therefore normalises the stored state back to what Claude Code reported before
comparing (`asReported`). It is one line, it is the only thing standing between this feature and a
strobing panel, and there is a test that polls five times and asserts the row neither moves nor
has its clock reset.

## Alternatives Considered

- **Hide settled sessions.** Rejected: the row is still the way back to that terminal, and a panel
  that silently drops sessions is the failure ADR-0011 is about. Dimming says "nothing here"
  without deciding on the user's behalf.
- **Settle on acknowledgement instead of on time** — the user does mention "already looked at",
  and clicking a row is already recorded (`useAcknowledged`, ADR-0013). Rejected as the _primary_
  rule: it would move a row into another section the instant it was clicked, which is a jump under
  the cursor for a click the user just made. The two could be combined later; the time rule alone
  answers the ask.
- **Detect a clear from the pid instead of the name.** `/clear` keeps the terminal's pid and mints
  a new session id, so a new id on a known pid is a replacement. This is verifiable without
  trusting the name — but it only works if the widget was watching at the moment of the clear, and
  it reaches the same conclusion as "no name" in every case that matters. Kept in reserve if the
  name signal ever proves unreliable.
- **Make thirty minutes configurable.** Rejected for now: one constant, in one place, with a name.
  A preference that nobody asked for is a preference nobody will find.

## Consequences

The panel now answers "where is my attention required" in the order it asks it: blocked, working,
just finished, and everything that has settled. The section that used to fill with noise stays
short.

**The known wart:** `stateSince` is measured by this process, so a relaunch stamps every session as
having just changed. A session that has been finished for four hours therefore sits in Done for
thirty minutes after the widget restarts — unless it is nameless, which settles on sight. The
widget launches at login and is meant to stay up, so this is rare; the fix, if it stops being
rare, is to persist `stateSince` in `panel.json` alongside the window frame, and the reason not to
have done that yet is that a persisted timestamp can be wrong in the other direction (a session
that went busy and back while the widget was closed).

The `dormant`/`ended` pair now share the 💤 glyph. `ended` is never rendered
(`visibleSessions`), so nothing can see both at once — but a future change that starts rendering
`ended` needs a different one.
