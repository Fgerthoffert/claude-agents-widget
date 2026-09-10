# ADR-0020: A doorbell, not a shorter interval

- **Status**: Accepted
- **Date**: 2026-09-10

## Context

> "I feel this is not quick/snappy enough. I used `/clear` but it took some time for something to
> happen."

Correct, and the arithmetic says why. ADR-0018 replaced everything with one question —
`claude agents --json` — polled every 3 seconds. So the worst-case latency for anything was the
interval plus the call: **3.3 seconds**.

The obvious fix is a shorter interval, and it is not affordable. Measured on the machine the
complaint came from:

|                                           |                                            |
| ----------------------------------------- | ------------------------------------------ |
| wall time per call                        | 320ms (325ms median over 36 calls)         |
| **CPU per call**                          | **~330ms** (0.26 user + 0.07 sys)          |
| via a login shell vs. the binary directly | 320ms vs 280ms — the shell is not the cost |

That CPU number is the whole problem. It is Claude Code's own startup, so it cannot be optimised
from here, and it means a 1-second interval costs **a third of a core, continuously, forever**,
for a widget that is idle most of the day. Even the 3-second interval was spending 11%.

So the question became: is there anything to _watch_, so that asking is triggered rather than
scheduled? Two candidates, both checked:

- **`~/.claude/daemon/roster.json`** — the supervisor's state. It tracks background workers only:
  it read `"workers": {}` with an hour-stale `updatedAt` while five interactive sessions were
  live. Useless for this.
- **`~/.claude/projects/**`** — the transcripts. A session appends to its transcript on every
  turn, and `/clear` creates a _new_ transcript file in the same project directory. Confirmed on
  the live machine: `cortex-vic` had a new session id written at 15:19 sitting beside its previous
  one from 15:09 — the signature of exactly the operation being complained about.

## Decision

Watch `~/.claude/projects` recursively and ask when it changes. A 5-second heartbeat remains as a
safety net.

**The watcher is a doorbell, not a data source.** It supplies timing and nothing else: no file is
opened, no line is parsed, nothing about a session is inferred from it. `claude agents --json`
remains the only thing that says what a session is doing.

That distinction carries weight, because reading these very files for _state_ is the mistake
ADR-0018 undid, and this looks superficially like walking it back. It is not the same thing, and
the property that keeps it honest is enforced in the capability file: the app is granted
`fs:allow-watch` and `fs:allow-unwatch` on that tree and **nothing else** — no read, no readdir,
no stat. It is not merely that the widget does not read the transcripts; it _cannot_. There is a
test asserting exactly that set of grants.

### The debounce, and the bug the obvious version has

Writes are coalesced: a burst becomes one sweep, fired 300ms after the last write. The end of a
burst is the moment worth being fast about — a turn that just finished, a session just cleared.

A _pure_ trailing debounce is wrong here, and interestingly wrong. With several agents running,
something is always appending to something, so the timer would keep resetting and the watcher
would **never fire at all** — leaving the panel slower than the fixed interval it replaced,
precisely for the user who has ten terminals open. `MAX_DEFER_MS` (1500ms) is the ceiling that
stops it, and there is a test that writes continuously for 2.4 seconds and asserts the sweep
happens more than once and fewer than six times.

### What it costs and what it buys

|                                             | before        | after     |
| ------------------------------------------- | ------------- | --------- |
| a session going quiet, nothing else writing | up to 3.3s    | **~0.6s** |
| same, while other agents are writing        | up to 3.3s    | **~1.8s** |
| worst case (watcher blind or unavailable)   | 3.3s          | 5.3s      |
| CPU, idle machine                           | 11% of a core | **6.6%**  |
| CPU, several agents writing continuously    | 11%           | up to 22% |

Better on the two cases that matter, cheaper when idle, and more expensive only while agents are
actively working — which is when the machine is busy anyway and the widget's share is marginal.
The worst case gets worse, and it is the case where the watcher cannot see the change at all: a
session's process being killed writes no transcript. That is what the heartbeat is for.

## Alternatives Considered

- **Just shorten the interval.** Rejected on the measurement above: 1s is 33% of a core forever.
- **Read `~/.claude/jobs/<id>/state.json`.** The documentation says the format is not stable and
  to use `--json`; it also covers background jobs only, so it would not have seen this at all.
- **Talk to the supervisor's socket** (`~/.claude/daemon/control.key` implies one). Undocumented,
  and the docs point at `--json` instead. A private IPC channel is a worse dependency than a
  process spawn.
- **Leading-edge rate limiting** — sweep on the first ring, then cool down. Equivalent latency,
  but it sweeps _during_ bursts rather than at their end, so it spends its budget on the moments
  when nothing is expected of the user.
- **Adapt the interval to what the last sweep found** — fast when everything is idle, slow when
  agents are working. Appealing, and it would help: `/clear` is typed into a session that has
  just gone quiet. Rejected for now as a second mechanism doing the first one's job; if the
  numbers above prove wrong in practice this is the next thing to try.

## Consequences

The cost of the widget now tracks activity instead of being flat, which is the right shape: quiet
machine, almost nothing; busy machine, a rounding error next to the agents themselves.

`tauri-plugin-fs` earns its place in the bundle again — it was still a dependency after ADR-0018
removed the last of its grants, and is now used for one call.

Committed to: transcripts being written when a session changes state. That is an observation about
Claude Code's behaviour, not a documented contract, and if it stopped being true the symptom would
be the panel going back to feeling like a 5-second heartbeat — slow, never wrong. The heartbeat is
what makes that failure boring.
