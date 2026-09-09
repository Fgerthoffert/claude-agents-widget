import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const hookPath = fileURLToPath(new URL('./claude-agents-widget-hook.mjs', import.meta.url));

let home = '';

/** Runs the real hook script with HOME pointed at a throwaway dir — never the user's HOME. */
const runHook = (payload: string): { status: number; stdout: string } => {
  const stdout = execFileSync(process.execPath, [hookPath], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return { status: 0, stdout };
};

/**
 * Runs the hook the way Claude Code does: as a **child** of a process the hook will recognise as
 * the `claude` CLI, so `findClaudePid` resolves and the per-terminal rules under test are
 * actually reachable. `collectAncestors(process.ppid)` deliberately starts at the parent, and
 * `findClaudePid` matches on the basename of `comm`/argv0 — so a symlink named `claude` pointing
 * at this Node binary is a faithful stand-in.
 *
 * All payloads run under **one** stand-in, because that is the whole point: `/clear` mints a new
 * session id inside the process that was already running the old one, and a per-call process
 * would give each event a different `claudePid` and prove nothing. Returns that shared pid.
 */
const runHooksInOneClaude = (...payloads: readonly string[]): number => {
  const child = `
    const { execFileSync } = require('node:child_process');
    for (const payload of JSON.parse(process.env.CAW_PAYLOADS)) {
      execFileSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(hookPath)}], {
        input: payload,
        encoding: 'utf8',
      });
    }
    process.stdout.write(String(process.pid));
  `;

  return Number(
    execFileSync(join(home, 'bin', 'claude'), ['-e', child], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        CAW_PAYLOADS: JSON.stringify(payloads),
      },
    }).trim(),
  );
};

const sessionFile = (sessionId: string) =>
  join(home, '.claude-agents-widget', 'sessions', `${sessionId}.json`);

interface WrittenRecord {
  readonly hookPid: number;
  readonly updatedAt: string;
  readonly claudePid: number | null;
  readonly ancestors: readonly { readonly pid: number; readonly comm: string }[];
}

const readRecord = (sessionId: string): WrittenRecord =>
  JSON.parse(readFileSync(sessionFile(sessionId), 'utf8')) as WrittenRecord;

const payloadFor = (extra: Record<string, unknown>) =>
  JSON.stringify({ session_id: 'sess-1', cwd: '/Users/test/proj', ...extra });

/** Writes a state file directly, for shapes the hook cannot be made to produce on demand. */
const seedRecord = (sessionId: string, extra: Record<string, unknown>) => {
  mkdirSync(join(home, '.claude-agents-widget', 'sessions'), { recursive: true });
  writeFileSync(
    sessionFile(sessionId),
    JSON.stringify({ sessionId, updatedAt: new Date().toISOString(), ...extra }),
  );
};

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'caw-hook-'));
  mkdirSync(join(home, 'bin'), { recursive: true });
  symlinkSync(process.execPath, join(home, 'bin', 'claude'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('claude-agents-widget-hook', () => {
  it('writes an idle record on SessionStart and stays silent on stdout', () => {
    const { stdout } = runHook(
      payloadFor({
        hook_event_name: 'SessionStart',
        transcript_path: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
      }),
    );

    expect(stdout).toBe('');
    const record = readRecord('sess-1');
    expect(record).toMatchObject({
      sessionId: 'sess-1',
      cwd: '/Users/test/proj',
      transcriptPath: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
      // Not `working`: a session that just started has been asked to do nothing (ADR-0014).
      state: 'done_idle',
      lastEvent: 'SessionStart',
      notificationType: null,
      notificationMessage: null,
    });
    expect(typeof record.hookPid).toBe('number');
    expect(Date.parse(record.updatedAt)).not.toBeNaN();
  });

  it('captures an ancestor chain terminating at PID 1', () => {
    runHook(payloadFor({ hook_event_name: 'SessionStart' }));

    // comm/args formatting differs between macOS and the Linux CI runner, so assert on shape.
    const { ancestors } = readRecord('sess-1');
    expect(ancestors.length).toBeGreaterThan(0);
    expect(typeof ancestors[0]?.pid).toBe('number');
    expect(typeof ancestors[0]?.comm).toBe('string');
    expect(ancestors.at(-1)?.pid).toBe(1);
  });

  it('maps each registered event to its session state', () => {
    const cases = [
      ['UserPromptSubmit', 'working'],
      ['Stop', 'done_idle'],
      ['Notification', 'needs_input'],
      ['SessionEnd', 'ended'],
    ] as const;

    for (const [event, state] of cases) {
      runHook(payloadFor({ hook_event_name: event }));
      expect(readRecord('sess-1')).toMatchObject({ state, lastEvent: event });
    }
  });

  it('treats an idle notification as finished work rather than as a question', () => {
    runHook(payloadFor({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }));

    // Claude Code noting that nothing has been typed for a while blocks nothing (ADR-0014).
    expect(readRecord('sess-1')).toMatchObject({
      state: 'done_idle',
      notificationType: 'idle_prompt',
    });
  });

  it('keeps notification_type while the session needs input and clears it afterwards', () => {
    runHook(
      payloadFor({ hook_event_name: 'Notification', notification_type: 'permission_prompt' }),
    );
    expect(readRecord('sess-1')).toMatchObject({
      state: 'needs_input',
      notificationType: 'permission_prompt',
    });

    runHook(payloadFor({ hook_event_name: 'UserPromptSubmit' }));
    expect(readRecord('sess-1')).toMatchObject({ state: 'working', notificationType: null });
  });

  it('merges: a Notification without cwd keeps the cwd SessionStart established', () => {
    runHook(
      payloadFor({
        hook_event_name: 'SessionStart',
        transcript_path: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
      }),
    );
    runHook(JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Notification' }));

    expect(readRecord('sess-1')).toMatchObject({
      cwd: '/Users/test/proj',
      transcriptPath: '/Users/test/.claude/projects/-Users-test-proj/sess-1.jsonl',
      state: 'needs_input',
    });
  });

  it('records the SessionEnd reason', () => {
    runHook(payloadFor({ hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' }));
    expect(readRecord('sess-1')).toMatchObject({ state: 'ended', endReason: 'prompt_input_exit' });
  });

  it('keeps two sessions sharing a cwd in separate files', () => {
    runHook(JSON.stringify({ session_id: 'a', cwd: '/Users/test/proj', hook_event_name: 'Stop' }));
    runHook(
      JSON.stringify({ session_id: 'b', cwd: '/Users/test/proj', hook_event_name: 'Notification' }),
    );

    expect(readRecord('a')).toMatchObject({ sessionId: 'a', state: 'done_idle' });
    expect(readRecord('b')).toMatchObject({ sessionId: 'b', state: 'needs_input' });
  });

  describe('retiring the session a /clear replaced', () => {
    const start = (sessionId: string, source: string) =>
      JSON.stringify({ session_id: sessionId, hook_event_name: 'SessionStart', source });
    const event = (sessionId: string, hookEventName: string) =>
      JSON.stringify({ session_id: sessionId, hook_event_name: hookEventName });

    it('identifies the owning claude process at all', () => {
      const claudePid = runHooksInOneClaude(payloadFor({ hook_event_name: 'SessionStart' }));

      // Everything below depends on this: without a claudePid there is no terminal identity.
      expect(readRecord('sess-1').claudePid).toBe(claudePid);
    });

    it('retires a session left mid-turn, which is the row that used to linger', () => {
      // The observed `/clear` sequence, minus the SessionEnd this must not depend on.
      runHooksInOneClaude(event('old', 'UserPromptSubmit'), start('new', 'clear'));

      expect(readRecord('old')).toMatchObject({ state: 'ended', endReason: 'superseded' });
      expect(readRecord('new')).toMatchObject({ state: 'done_idle' });
    });

    it('retires a finished session too', () => {
      runHooksInOneClaude(event('old', 'Stop'), start('new', 'clear'));

      expect(readRecord('old')).toMatchObject({ state: 'ended', endReason: 'superseded' });
    });

    it('retires on resume, fork and a plain startup that reuses a pid', () => {
      for (const source of ['resume', 'fork', 'startup']) {
        runHooksInOneClaude(event(`old-${source}`, 'UserPromptSubmit'), start(`new-${source}`, source));

        expect(readRecord(`old-${source}`)).toMatchObject({ state: 'ended' });
      }
    });

    it('retires nothing on compact: the session is still going', () => {
      runHooksInOneClaude(
        event('other', 'UserPromptSubmit'),
        start('compacting', 'compact'),
      );

      expect(readRecord('other')).toMatchObject({ state: 'working' });
    });

    it('leaves other terminals, and records it cannot place, alone', () => {
      // Seeded rather than driven through the hook, so the two exempt shapes are exact: another
      // live process, and a record whose claude process the hook could not identify. A null
      // claudePid must never match anything — ADR-0012 exempts those rather than guessing.
      seedRecord('other-terminal', { state: 'working', claudePid: 999_999 });
      seedRecord('unplaceable', { state: 'working', claudePid: null });

      runHooksInOneClaude(start('mine', 'clear'));

      expect(readRecord('other-terminal')).toMatchObject({ state: 'working' });
      expect(readRecord('unplaceable')).toMatchObject({ state: 'working' });
    });

    it('does not retire the session that is starting', () => {
      runHooksInOneClaude(start('only', 'startup'));

      expect(readRecord('only')).toMatchObject({ state: 'done_idle', lastEvent: 'SessionStart' });
    });
  });

  it('recovers from a half-written state file instead of refusing the event', () => {
    runHook(payloadFor({ hook_event_name: 'SessionStart' }));
    writeFileSync(sessionFile('sess-1'), '{"sessionId": "sess-1", "st');

    runHook(payloadFor({ hook_event_name: 'Stop' }));
    expect(readRecord('sess-1')).toMatchObject({ sessionId: 'sess-1', state: 'done_idle' });
  });

  it('exits 0 and logs when stdin is empty, garbage, or missing a session id', () => {
    for (const input of ['', '   ', 'not json at all', '[]', '{"hook_event_name":"Stop"}']) {
      expect(runHook(input).stdout).toBe('');
    }

    const log = readFileSync(join(home, '.claude-agents-widget', 'hook.log'), 'utf8');
    expect(log).toContain('empty stdin payload');
    expect(log).toContain('unparseable stdin payload');
    expect(log).toContain('stdin payload was not a JSON object');
    expect(log).toContain('payload had no usable session_id');
  });

  it('refuses a session_id that would escape the sessions directory', () => {
    runHook(JSON.stringify({ session_id: '../escape', hook_event_name: 'SessionStart' }));

    const log = readFileSync(join(home, '.claude-agents-widget', 'hook.log'), 'utf8');
    expect(log).toContain('payload had no usable session_id');
  });

  it('leaves no temp files behind', () => {
    runHook(payloadFor({ hook_event_name: 'SessionStart' }));
    runHook(payloadFor({ hook_event_name: 'Stop' }));

    const dir = join(home, '.claude-agents-widget', 'sessions');
    const entries = execFileSync('ls', [dir], { encoding: 'utf8' }).trim().split('\n');
    expect(entries).toEqual(['sess-1.json']);
  });
});
