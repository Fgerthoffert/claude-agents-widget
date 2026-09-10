#!/usr/bin/env node
// Claude Code hook for claude-agents-widget.
//
// Installed to ~/.claude-agents-widget/hook.mjs and registered in ~/.claude/settings.json.
// Deliberately standalone: zero npm dependencies, single file, plain ESM, so it runs under
// whatever Node the user's shell resolves (>=18) rather than this repo's toolchain.
// JSDoc annotations exist so the repo's type-aware lint rules cover it — see
// docs/adr/0006-hook-script-and-state-file-ipc.md.
//
// Contract: read the hook payload from stdin, merge-write one JSON file per session, exit 0.
// It must never fail loudly and never write to stdout (Claude Code interprets hook stdout).

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import process from 'node:process';

const STATE_DIR_NAME = '.claude-agents-widget';

/**
 * Hook event -> session state. Events absent from this map leave the state untouched.
 * A Map, not an object literal: the event name arrives in a JSON payload, and a plain-object
 * lookup would resolve `toString` or `constructor` to an inherited value.
 *
 * `SessionStart` is `done_idle`, not `working`: a session that has just started — or just been
 * cleared, resumed or forked — is sitting at an empty prompt having been asked to do nothing.
 * Reporting it as `working` is what made a `/clear` look like it left work behind (ADR-0014).
 * Mirrored in src/core/mapHookEventToState.ts.
 * @type {Map<string, string>}
 */
const EVENT_STATE = new Map([
  ['SessionStart', 'done_idle'],
  ['UserPromptSubmit', 'working'],
  ['Stop', 'done_idle'],
  ['Notification', 'needs_input'],
  ['SessionEnd', 'ended'],
]);

/** `Notification` matchers that block nothing: Claude Code noting a session has gone quiet. */
const IDLE_NOTIFICATIONS = new Set(['idle_prompt']);

/**
 * `SessionStart` sources that replace the session that was in this terminal. `compact` is
 * absent on purpose: compaction keeps the same session going.
 */
const REPLACING_SOURCES = new Set(['startup', 'clear', 'resume', 'fork']);

const widgetHome = () => join(homedir(), STATE_DIR_NAME);

/** @param {string} message */
const logError = (message) => {
  try {
    mkdirSync(widgetHome(), { recursive: true });
    appendFileSync(join(widgetHome(), 'hook.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging is best-effort; a failure here must not surface to Claude Code.
  }
};

/**
 * @param {unknown} value
 * @returns {string | null}
 */
const asString = (value) => (typeof value === 'string' && value !== '' ? value : null);

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
const asObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;

/**
 * @param {string} text
 * @returns {unknown}
 */
const parseJson = (text) => {
  try {
    /** @type {unknown} */
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
};

const readStdin = () => {
  try {
    // fd 0 is a pipe Claude Code has already closed on its end, so a blocking read terminates.
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
};

/**
 * @param {readonly string[]} args
 * @returns {string}
 */
const ps = (args) => {
  try {
    return execFileSync('ps', [...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return '';
  }
};

/**
 * `ps -axo pid=,ppid=,comm=` rows carry two numeric columns then the executable path, which may
 * itself contain spaces. Splitting only the two leading numbers keeps the remainder intact.
 * @param {string} output
 * @returns {Map<number, { ppid: number; comm: string }>}
 */
const parseCommTable = (output) => {
  /** @type {Map<number, { ppid: number; comm: string }>} */
  const table = new Map();
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (match?.[1] && match[2]) {
      table.set(Number(match[1]), { ppid: Number(match[2]), comm: (match[3] ?? '').trim() });
    }
  }
  return table;
};

/**
 * `ps -o pid=,args= -p <csv>` rows carry one numeric column then the full command line.
 * @param {string} output
 * @returns {Map<number, string>}
 */
const parseArgsTable = (output) => {
  /** @type {Map<number, string>} */
  const table = new Map();
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (match?.[1]) table.set(Number(match[1]), (match[2] ?? '').trim());
  }
  return table;
};

/**
 * Walks pid -> parent -> ... up to PID 1. This chain is the raw material the focus engine
 * (phase 4) uses to identify the terminal or IDE window that owns the session, so capture it
 * faithfully rather than pre-interpreting it here.
 * @param {number} startPid
 * @returns {{ pid: number; comm: string; args: string }[]}
 */
const collectAncestors = (startPid) => {
  const commTable = parseCommTable(ps(['-axo', 'pid=,ppid=,comm=']));
  /** @type {{ pid: number; comm: string; args: string }[]} */
  const chain = [];
  /** @type {Set<number>} */
  const seen = new Set();
  let pid = startPid;
  while (pid > 0 && !seen.has(pid) && chain.length < 32) {
    seen.add(pid);
    const entry = commTable.get(pid);
    if (!entry) break;
    chain.push({ pid, comm: entry.comm, args: '' });
    if (pid === 1) break;
    pid = entry.ppid;
  }
  if (chain.length === 0) return chain;

  const pids = chain.map((ancestor) => String(ancestor.pid)).join(',');
  const argsTable = parseArgsTable(ps(['-o', 'pid=,args=', '-p', pids]));
  return chain.map((ancestor) => ({ ...ancestor, args: argsTable.get(ancestor.pid) ?? '' }));
};

/**
 * The nearest ancestor that is the `claude` CLI itself — the PID whose liveness means the
 * session is alive. Case-sensitive on purpose: `Claude` is the desktop app, not the CLI.
 * @param {readonly { pid: number; comm: string; args: string }[]} ancestors
 * @returns {number | null}
 */
const findClaudePid = (ancestors) => {
  const match = ancestors.find(
    (a) => basename(a.comm) === 'claude' || basename(a.args.split(' ')[0] ?? '') === 'claude',
  );
  return match ? match.pid : null;
};

/**
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
const readExisting = (file) => {
  try {
    return asObject(parseJson(readFileSync(file, 'utf8'))) ?? {};
  } catch {
    // Absent or half-written file: start from scratch rather than refusing the event.
    return {};
  }
};

/**
 * Temp file + rename so a reader never observes a partially written record.
 * @param {string} file
 * @param {Record<string, unknown>} record
 */
const writeAtomic = (file, record) => {
  const temp = `${file}.${String(process.pid)}.tmp`;
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(temp, file);
};

/**
 * The session state files, or `null` when the directory cannot be read at all.
 * @param {string} dir
 * @returns {string[] | null}
 */
const listSessionFiles = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return null;
  }
};

/**
 * Retires every other session recorded against this same `claude` process.
 *
 * One CLI process runs one session at a time (ADR-0012), so a `SessionStart` naming a new
 * session id is proof that any other record sharing its `claudePid` is finished. `/clear` on
 * Claude Code 2.1.236 does emit `SessionEnd` (`reason: "clear"`) for the outgoing session about
 * 80ms first, which retires it on its own — but that is one build's behaviour, not a contract,
 * and the widget relied on it entirely before. Writing `ended` here means the panel drops the
 * row on the strength of the *new* session's arrival, whether or not the old one said goodbye.
 *
 * Best-effort by construction: a file that will not read or write is skipped, because failing to
 * tidy up a stale record must never cost the user the event that just happened.
 * @param {string} sessionsDir
 * @param {string} currentSessionId
 * @param {number} claudePid
 */
const retireOtherSessions = (sessionsDir, currentSessionId, claudePid) => {
  const names = listSessionFiles(sessionsDir);
  if (names === null) return;

  for (const name of names) {
    if (!name.endsWith('.json') || name === `${currentSessionId}.json`) continue;
    const file = join(sessionsDir, name);
    try {
      const existing = readExisting(file);
      if (existing.claudePid !== claudePid || existing.state === 'ended') continue;
      writeAtomic(file, {
        ...existing,
        state: 'ended',
        endReason: 'superseded',
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Another hook may be mid-write on that session; its own events will settle it.
    }
  }
};

const main = () => {
  const raw = readStdin();
  if (raw.trim() === '') {
    logError('empty stdin payload');
    return;
  }

  const parsed = parseJson(raw);
  if (parsed === undefined) {
    logError(`unparseable stdin payload (${String(raw.length)} bytes)`);
    return;
  }

  const payload = asObject(parsed);
  if (!payload) {
    logError('stdin payload was not a JSON object');
    return;
  }

  const sessionId = asString(payload.session_id);
  // A session id becomes a filename, so reject anything that could escape the sessions dir.
  if (sessionId === null || sessionId.includes('/') || sessionId.startsWith('.')) {
    logError('payload had no usable session_id');
    return;
  }

  const event = asString(payload.hook_event_name);
  const sessionsDir = join(widgetHome(), 'sessions');
  mkdirSync(sessionsDir, { recursive: true });

  const file = join(sessionsDir, `${sessionId}.json`);
  const existing = readExisting(file);
  const priorAncestors = existing.ancestors;

  // Not every event carries cwd or transcript_path (Notification carries neither), hence the
  // merge: fields absent from this payload keep the value an earlier event established.
  const ancestors =
    event === 'SessionStart' || !Array.isArray(priorAncestors) || priorAncestors.length === 0
      ? collectAncestors(process.ppid)
      : /** @type {{ pid: number; comm: string; args: string }[]} */ (priorAncestors);

  const isNotification = event === 'Notification';
  const notificationType = isNotification ? asString(payload.notification_type) : null;
  // An idle notification is not a question: nothing is blocked on an answer, so it reads as
  // finished work rather than as "waiting for you" (ADR-0014).
  const eventState =
    isNotification && notificationType !== null && IDLE_NOTIFICATIONS.has(notificationType)
      ? 'done_idle'
      : event === null
        ? null
        : EVENT_STATE.get(event);

  const record = {
    ...existing,
    sessionId,
    cwd: asString(payload.cwd) ?? asString(existing.cwd),
    transcriptPath: asString(payload.transcript_path) ?? asString(existing.transcriptPath),
    state: eventState ?? asString(existing.state) ?? 'done_idle',
    lastEvent: event ?? asString(existing.lastEvent),
    // Notification carries `notification_type` (permission_prompt, idle_prompt, …); older
    // Claude Code builds sent a human-readable `message`. Keep whichever arrives, and clear
    // both on any other event so the UI never shows a stale prompt.
    notificationType,
    notificationMessage: isNotification ? asString(payload.message) : null,
    endReason: event === 'SessionEnd' ? asString(payload.reason) : null,
    agentId: asString(payload.agent_id),
    agentType: asString(payload.agent_type),
    updatedAt: new Date().toISOString(),
    hookPid: process.pid,
    ancestors,
    claudePid: findClaudePid(ancestors),
  };

  writeAtomic(file, record);

  // After this session's own record is safely on disk, not before: tidying up is worth nothing
  // if it costs the event that triggered it.
  const source = asString(payload.source);
  if (
    event === 'SessionStart' &&
    record.claudePid !== null &&
    (source === null || REPLACING_SOURCES.has(source))
  ) {
    retireOtherSessions(sessionsDir, sessionId, record.claudePid);
  }
};

try {
  main();
} catch (error) {
  logError(`unhandled: ${error instanceof Error ? error.message : String(error)}`);
}
// Always succeed: a non-zero exit or stderr noise would surface in the user's session.
process.exit(0);
