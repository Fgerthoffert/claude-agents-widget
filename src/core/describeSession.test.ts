import { describe, expect, it } from 'vitest';

import { describeSession } from './describeSession';
import type { Session } from './types';

const HOME = '/Users/test';

const session = (overrides: Partial<Session>): Session => ({
  sessionId: 'session-1',
  title: 'Refactor the scanner',
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state: 'working',
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1234,
  ancestors: [],
  ...overrides,
});

describe('describeSession', () => {
  it('describes a working session as title plus shortened path', () => {
    expect(describeSession(session({}), HOME)).toEqual({
      title: 'Refactor the scanner',
      detail: '~/code/api',
      stateLabel: 'working',
      tooltip: 'Refactor the scanner\n/Users/test/code/api',
    });
  });

  it('prefixes the detail with why a needs-input session is blocked', () => {
    const described = describeSession(
      session({ state: 'needs_input', notificationType: 'permission_prompt' }),
      HOME,
    );
    expect(described.detail).toBe('needs permission · ~/code/api');
    expect(described.stateLabel).toBe('needs input');
  });

  it('maps every known blocking notification matcher', () => {
    const reasonFor = (notificationType: string): string =>
      describeSession(session({ state: 'needs_input', notificationType, cwd: null }), HOME).detail;

    expect(reasonFor('permission_prompt')).toBe('needs permission');
    expect(reasonFor('agent_needs_input')).toBe('agent needs input');
  });

  it('gives an idle session no blocking reason', () => {
    // `idle_prompt` is classified `done_idle` at the source now (ADR-0014), so it never reaches
    // the reason line at all — and if a stale hook script still pairs it with `needs_input`,
    // the generic wording is what shows.
    const idle = describeSession(
      session({ state: 'done_idle', notificationType: 'idle_prompt', cwd: null }),
      HOME,
    );

    expect(idle.detail).toBe('');
    expect(idle.stateLabel).toBe('done');
  });

  it('humanises an unknown notification matcher rather than dropping it', () => {
    const described = describeSession(
      session({ state: 'needs_input', notificationType: 'some_future_matcher', cwd: null }),
      HOME,
    );
    expect(described.detail).toBe('some future matcher');
  });

  it('still says something when a needs-input session carries no matcher', () => {
    const described = describeSession(
      session({ state: 'needs_input', notificationType: null, cwd: null }),
      HOME,
    );
    expect(described.detail).toBe('waiting for you');
    expect(
      describeSession(session({ state: 'needs_input', notificationType: '', cwd: null }), HOME)
        .detail,
    ).toBe('waiting for you');
  });

  it('never shows a blocked reason on a state that is not blocked', () => {
    const described = describeSession(
      session({ state: 'working', notificationType: 'permission_prompt' }),
      HOME,
    );
    expect(described.detail).toBe('~/code/api');
  });

  it('labels the remaining states', () => {
    expect(describeSession(session({ state: 'done_idle' }), HOME).stateLabel).toBe('done');
    expect(describeSession(session({ state: 'ended' }), HOME).stateLabel).toBe('ended');
  });

  it('renders an empty detail when there is nothing to say', () => {
    expect(describeSession(session({ cwd: null }), HOME).detail).toBe('');
  });

  it('keeps the free-text notification message for the tooltip only', () => {
    const described = describeSession(
      session({
        state: 'needs_input',
        notificationType: 'permission_prompt',
        notificationMessage: 'Claude needs your permission to use Bash',
      }),
      HOME,
    );
    expect(described.detail).toBe('needs permission · ~/code/api');
    expect(described.tooltip).toBe(
      'Refactor the scanner\nClaude needs your permission to use Bash\n/Users/test/code/api',
    );
  });

  it('falls back to the cwd basename as the title', () => {
    expect(describeSession(session({ title: null }), HOME).title).toBe('api');
  });
});
