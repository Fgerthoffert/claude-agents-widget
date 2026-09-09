# ADR-0012: One row per terminal session — per-process de-duplication and desktop exclusion

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

Two reports from the first day of real use:

> "I also asked Claude Desktop a question, but it's now showing up in the tool. It also seems that
> there are more lines in the widget than there are agents, can you cross check."

A cross-check against the live machine (9 running `claude` CLI processes, 12 hook records on disk)
produced exactly 9 rows with no duplicates, so the reconciler was not miscounting at that moment.
But reading the code with that data in hand turned up three ways the row count can drift away from
the number of agents the user believes they have, and one way a session that is not an agent at all
can appear. ADR-0003 settled which _source_ wins; none of this is about precedence. It is about
what counts as a session in the first place.

**1. A `claude` process outlives the session it started with.** `/clear` and `/resume` mint a new
session id inside the same process. Each id gets its own `sessions/<id>.json`, and the abandoned
one keeps whatever state it was last in. `SessionEnd` usually fires for the session being replaced
— it did for every case in the live snapshot — but the widget was relying on that entirely, and the
reconciler only expires a record whose `claudePid` is _gone_. A record whose PID is still very much
alive, running a different session, has nothing to expire it. It sits in the panel for as long as
the terminal stays open, and if it was last seen as `needs_input` it also lights the menu bar.

**2. The scanner reaches a session id by guessing.** `ps` gives no session id, so
`matchScannedSessions` pairs the live PIDs in a project directory with the newest transcripts in
that directory — newest transcript to lowest PID, and so on down. This is a documented heuristic on
the zero-config path and it is fine as far as it goes, but its wrongness was previously invisible.
Both halves of the guess were observed wrong in the live snapshot: two processes in this repo were
assigned each other's transcripts, and `claude --resume create-tickets-and-update-security-fiches`
was assigned whichever transcript in its directory happened to have the freshest mtime. The
consequence that matters is not the swapped title — it is that when the hook then reports the
process's _real_ session id, the reconciler sees two different ids and de-duplicates on session id
only, so one terminal gets two rows.

**3. Claude Desktop is a Claude Code client too.** It ships its own copy of the CLI at
`~/Library/Application Support/Claude/claude-code/<version>/claude.app/Contents/MacOS/claude` —
basename `claude` — and it reads the same `~/.claude/settings.json`, so this widget's hook fires
for its sessions and writes records for them like any other. The existing guard in
`parseClaudeProcesses` ("case-sensitive on `claude`: `Claude` is the desktop app") does not cover
this: the bundled binary is lowercase `claude`, and the only thing distinguishing it is the path
around it. It happened to escape the scanner by accident — `Application Support` contains a space,
so splitting argv0 on whitespace never yields a basename of `claude` — which is not a guarantee
worth keeping.

## Decision

A session is a row only if it is the current session of a live `claude` CLI process started from a
terminal or editor. Three rules in `src/core`, all pure and all tested:

- **One record per PID wins.** `reconcileSessions` keeps the most recently updated non-`ended`
  record for each `claudePid` and marks the rest `ended`, which puts them on the existing
  five-minute TTL rather than deleting them outright. Ties break on session id so the outcome never
  depends on the order `readDir` returned the files in. Records with no `claudePid` are exempt: the
  hook could not identify a process, so there is nothing to compare.
- **A hook-owned PID is closed to the scanner.** A scanned session whose `claudePid` already
  belongs to a hook record contributes nothing, whatever session id the scanner guessed for it.
  The hook knows; the scanner was estimating.
- **Desktop-app sessions are dropped.** `isDesktopSession` tests a record's ancestor chain for
  `/Claude.app/Contents/` or `/Application Support/Claude/`, and `parseClaudeProcesses` rejects
  command lines containing either marker.

## Alternatives Considered

- **Fix the scanner's guess instead of overriding it** by requiring a transcript's mtime to fall
  after its candidate process started (`ps -o lstart`/`etime`) — rejected _for now_, not on the
  merits. It is the better fix for the residual case below, but it changes the allowlisted `ps`
  invocation in `capabilities/default.json` and adds a time-parsing surface, which is its own
  change. The PID rules land the user-visible half today.
- **Have the hook refuse to write for desktop sessions** — rejected as the only measure, kept in
  reserve. It stops the files being created, but it cannot help a user who already has such
  records on disk, and it puts a judgement call in the shell script that ADR-0002 wants in
  TypeScript. Filtering at read time covers both, and the hook stays a dumb recorder.
- **Show desktop sessions, dimmed or in their own section** — rejected. The widget's promise is to
  put you back in the window that owns a session; a desktop conversation has no terminal window to
  return to, and it is already on screen in an app the user switches to directly. A row for it is
  a row that cannot be acted on.
- **Prune abandoned records from disk** in the detection sweep — rejected. Deleting files the hook
  owns from a 5s loop invites a race with a hook mid-write, and `ended` plus a TTL already achieves
  the visible outcome. The files are small and idempotently overwritten.

## Consequences

The panel is now bounded above by the number of live `claude` CLI processes, which is the number
the user can check with `ps`. That is the property the cross-check was asking for, and it holds by
construction rather than by hoping `SessionEnd` fired.

What is still wrong, and is now the only known cause of a mislabelled row: a live process with **no
hook record at all** still shows whatever session the scanner guessed for it, so a fresh install —
or a session started before the hook was installed — can name the wrong session in the right
project. The count is right; the title may not be. The `ps` start-time fix above is the follow-up.

Committed to: the assumption that one `claude` CLI process hosts one session at a time. Sub-agents
do not break it — they report their parent's `session_id`, so they merge into the parent's record
rather than creating siblings. If a future Claude Code ran two concurrent sessions in one process,
this ADR is the thing that would need revisiting.

Also committed to: matching Claude Desktop by path. If the app moves its bundled CLI, desktop
sessions reappear until `DESKTOP_MARKERS` is updated. The failure mode is a visible extra row, not
a crash or a missing session, which is the right way round for a guess about someone else's layout.
