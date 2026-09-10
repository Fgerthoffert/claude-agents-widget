# ADR-0014: "Waiting for you" means blocked, and a fresh session is idle

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

Two faults, found on a real desk within an hour of v0.3.0 going out, with the same root: the panel
treated "the agent stopped" as one thing when it is two.

**A cleared session claimed to be working.** `/clear` on Claude Code 2.1.236 emits `SessionEnd`
(`reason: "clear"`) for the outgoing session about 80ms before `SessionStart` (`source: "clear"`)
for its replacement. The outgoing row was therefore already leaving correctly. What lingered was
the _new_ one: `SessionStart` mapped to `working`, so a session sitting at an empty prompt, having
been asked to do precisely nothing, appeared under **Running** claiming to be busy until the user
typed something. The widget exists to answer "who is working and who is stuck"; a row that says
"working" about an idle prompt is a wrong answer to its only question.

**"Waiting for you" was claiming more than it meant.** ADR-0008 put `needs_input` and `done_idle`
in one section on the grounds that both mean the agent stopped and it is the user's move. That is
true, and it is not what the words say. The user's correction:

> the "waiting for you" should only be for situations in which the agent is actually asking a
> question and is waiting for an answer before being able to proceed

The two are not interchangeable in the way that matters. A blocked agent is _costing_ something —
it will sit there until answered. A finished one is not; it can be looked at whenever. Merging them
meant the section that was supposed to mean "act now" filled up with work that needed nothing, and
the menu bar mark inherited the same fault: a finished agent made the tray shout, and a mark that
is usually noise stops being read.

`idle_prompt` is the same confusion one level down. It is Claude Code observing that nothing has
been typed for a while — the _absence_ of a question — and it was being mapped to `needs_input`
alongside genuine permission prompts.

## Decision

### `SessionStart` is `done_idle`

In the hook script and in its `src/core/mapHookEventToState` mirror. A session that has just
started — or just been cleared, resumed or forked — is idle by definition. `working` begins at
`UserPromptSubmit`, which is the event that means the user actually asked for something. The
merge default for an unrecognised event changes from `working` to `done_idle` for the same reason:
if we do not know, the safe claim is that nothing is under way.

### A replacing `SessionStart` retires its predecessors

The hook writes `state: 'ended'`, `endReason: 'superseded'` over any _other_ record sharing its
`claudePid`, for `source` in `startup | clear | resume | fork` — never `compact`, which keeps the
same session going. One CLI process runs one session at a time (ADR-0012), so a new session id on
a known PID is proof the others are finished.

This deliberately duplicates what `reconcileSessions` already infers. The reconciler's version is
a _reading_ of the files; this one is a fact written at the moment it becomes true, by the process
that knows. v0.3.0 relied on `SessionEnd` firing, which one build happens to do — behaviour, not
contract. It runs after the triggering event's own record is safely on disk, and skips any file it
cannot read or write: failing to tidy up must never cost the user the event that just happened.

### Three sections, and the mark narrows to match

`groupSessions` returns `running` / `waiting` / `done`:

| Section         | Contains      | Means                                           |
| --------------- | ------------- | ----------------------------------------------- |
| Running         | `working`     | busy; nothing expected of you                   |
| Waiting for you | `needs_input` | asked a question, cannot proceed until answered |
| Done            | `done_idle`   | stopped, and not blocked                        |

`formatTrayLabel` raises `●` for `needs_input` alone. `idle_prompt` is classified `done_idle` at
the source rather than special-cased in the UI, so every consumer agrees without knowing why. The
legend follows: **needs an answer** rather than **needs you**, because needing you was exactly the
claim that covered both.

Three sections do not crowd the panel, because an empty one renders nothing at all — heading
included. The common case is two.

## Alternatives Considered

- **Keep two sections and re-word the heading** ("Your move"). Rejected: it is accurate but it
  still asks the user to distinguish blocked from finished by reading each row's glyph. The
  distinction is worth a heading, because acting on it is the whole job.
- **Sort within one section instead of splitting.** Rejected: the store already sorts
  `needs_input` first, and it was not enough — a sorted list still has no line in it saying where
  "must" stops and "may" begins.
- **Leave `SessionStart` as `working` and special-case `source: "clear"`.** Rejected: it treats
  the symptom. A fresh `claude` at an empty prompt is idle for exactly the same reason a cleared
  one is, and the narrower fix would have left plain startup wrong.
- **Trust `SessionEnd` and drop the retirement sweep.** Rejected: it is one build's ~80ms
  ordering. When it does not fire — a crash, a kill, a future change — the user gets two rows for
  one terminal, which is the fault ADR-0012 was written about.
- **Treat an unrecognised future `Notification` matcher as idle.** Rejected, and the allow-list is
  built the other way round: `IDLE_NOTIFICATIONS` names the idle case, so anything new is assumed
  to be a real prompt. A missed blocking prompt is the one failure this widget exists to prevent;
  a spurious one is merely annoying.
- **Keep the tray mark on `done_idle` too.** Rejected on the user's own framing of the mark: it
  answers "is any of this mine to deal with?", and finished work is not. A mark that is lit most
  of the day conveys nothing.

## Consequences

The panel now distinguishes the two stopped states everywhere it matters — section, legend, tray —
from one classification made at the source. A `/clear` leaves one row, under Done, immediately.

`needs_input` becomes a rarer state, which is the point: the amber accent, the one loud row
(ADR-0013) and the menu bar mark all get scarcer and therefore louder. Anyone who read the tray
mark as "something has finished" will see it fire less often; the dropdown summary still spells out
all three counts in words.

Records written by an _older_ installed hook can still pair `needs_input` with `idle_prompt`.
`describeSession` no longer has wording for that combination and falls through to the generic
`idle prompt` text until the session restarts and the new hook classifies it correctly. Users who
never re-run the installer keep the old behaviour, which is the same upgrade seam ADR-0006 already
carries.

Committed to: `SessionStart` meaning "idle", which is only true while `UserPromptSubmit` is
registered. If that hook were ever dropped from the installed set, a session would stay `done_idle`
through its whole turn — so the two belong together, and `mergeHookSettings` installs all five
events as one set.
