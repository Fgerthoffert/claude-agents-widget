import { describe, expect, it } from 'vitest';

import { formatTrayLabel } from './formatTrayLabel';

describe('formatTrayLabel', () => {
  it('marks the menu bar when a session needs input', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 1, doneIdle: 0, dormant: 0 })).toBe('●');
  });

  it('stays quiet for a finished agent: the menu bar must not shout about work that is done', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 0, doneIdle: 1, dormant: 0 })).toBe('');
    expect(formatTrayLabel({ working: 1, needsInput: 0, doneIdle: 9, dormant: 0 })).toBe('');
  });

  it('carries no count, however many sessions are blocked', () => {
    expect(formatTrayLabel({ working: 2, needsInput: 4, doneIdle: 7, dormant: 0 })).toBe('●');
  });

  it('stays empty while every session is working', () => {
    expect(formatTrayLabel({ working: 3, needsInput: 0, doneIdle: 0, dormant: 0 })).toBe('');
  });

  it('stays empty for settled sessions, which are the definition of nothing to do', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 0, doneIdle: 0, dormant: 5 })).toBe('');
  });

  it('stays empty when there are no sessions at all', () => {
    expect(formatTrayLabel({ working: 0, needsInput: 0, doneIdle: 0, dormant: 0 })).toBe('');
  });
});
