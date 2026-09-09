import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const sessionFile = (sessionId: string) =>
  join(home, '.claude-agents-widget', 'sessions', `${sessionId}.json`);

interface WrittenRecord {
  readonly hookPid: number;
  readonly updatedAt: string;
  readonly ancestors: readonly { readonly pid: number; readonly comm: string }[];
}

const readRecord = (sessionId: string): WrittenRecord =>
  JSON.parse(readFileSync(sessionFile(sessionId), 'utf8')) as WrittenRecord;

const payloadFor = (extra: Record<string, unknown>) =>
  JSON.stringify({ session_id: 'sess-1', cwd: '/Users/test/proj', ...extra });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'caw-hook-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('claude-agents-widget-hook', () => {
  it('writes a working record on SessionStart and stays silent on stdout', () => {
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
      state: 'working',
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
