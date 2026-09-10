import { describe, expect, it } from 'vitest';

import { describeSession } from './describeSession';
import { aSession } from './testing/aSession';
import type { Session } from './types';

const HOME = '/Users/test';

const session = (overrides: Partial<Session>): Session =>
  aSession({ sessionId: 'session-1', ...overrides });

describe('describeSession', () => {
  it('describes a working session as title plus shortened path', () => {
    expect(describeSession(session({}), HOME)).toEqual({
      title: 'Refactor the scanner',
      detail: '~/code/api',
      stateLabel: 'working',
      tooltip: 'Refactor the scanner\n/Users/test/code/api',
    });
  });

  it('leads with Claude Code’s own reason when a session is blocked', () => {
    const description = describeSession(
      session({ state: 'needs_input', waitingFor: 'permission prompt' }),
      HOME,
    );

    expect(description.detail).toBe('permission prompt · ~/code/api');
    expect(description.stateLabel).toBe('needs input');
  });

  it('passes an unfamiliar reason through rather than inventing wording', () => {
    // `waitingFor` is Claude Code's phrase, and a value this app has not seen is far more
    // likely to be a new kind of prompt than a mistake (ADR-0018).
    const description = describeSession(
      session({ state: 'needs_input', waitingFor: 'sandbox request' }),
      HOME,
    );

    expect(description.detail).toBe('sandbox request · ~/code/api');
  });

  it('shows no reason for a session that is not blocked', () => {
    // A finished session carrying a stale `waitingFor` must not read as a question.
    const description = describeSession(
      session({ state: 'done_idle', waitingFor: 'input needed' }),
      HOME,
    );

    expect(description.detail).toBe('~/code/api');
  });

  it('falls back to the project directory when there is no title', () => {
    expect(describeSession(session({ title: null }), HOME).title).toBe('api');
  });

  it('is never blank, even with no title and no cwd', () => {
    const description = describeSession(session({ title: null, cwd: null }), HOME);

    expect(description.title).toBe('session-');
    expect(description.detail).toBe('');
  });

  it('keeps the full path in the tooltip, where there is room for it', () => {
    const description = describeSession(session({ cwd: '/Users/test/very/deep/project' }), HOME);

    expect(description.detail).toContain('~');
    expect(description.tooltip).toContain('/Users/test/very/deep/project');
  });
});
