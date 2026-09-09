import { describe, expect, it } from 'vitest';

import { buildTrayModel } from './buildTrayModel';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState, title: string | null): Session => ({
  sessionId,
  title,
  cwd: '/Users/test/code/api',
  transcriptPath: null,
  state,
  source: 'hook',
  notificationType: null,
  notificationMessage: null,
  updatedAt: '2026-09-09T12:00:00.000Z',
  claudePid: 1234,
  ancestors: [],
});

describe('buildTrayModel', () => {
  it('labels the menu bar with the glyph aggregate', () => {
    const model = buildTrayModel([
      session('a', 'needs_input', 'Fix the tray'),
      session('b', 'working', 'Refactor'),
      session('c', 'working', 'Docs'),
    ]);
    expect(model.label).toBe('2▶ 1⏸');
  });

  it('spells the summary out in words', () => {
    const model = buildTrayModel([
      session('a', 'needs_input', 'Fix the tray'),
      session('b', 'working', 'Refactor'),
      session('c', 'done_idle', 'Docs'),
    ]);
    expect(model.summary).toBe('1 need input · 1 working · 1 done');
  });

  it('reads as empty when nothing is running', () => {
    const model = buildTrayModel([]);
    expect(model.label).toBe('idle');
    expect(model.summary).toBe('No active sessions');
    expect(model.items).toEqual([]);
    expect(model.overflow).toBe(0);
  });

  it('prefixes each item with its state glyph and keeps store order', () => {
    const model = buildTrayModel([
      session('a', 'needs_input', 'Fix the tray'),
      session('b', 'working', 'Refactor'),
    ]);
    expect(model.items).toEqual([
      { sessionId: 'a', text: '⏸  Fix the tray' },
      { sessionId: 'b', text: '▶  Refactor' },
    ]);
  });

  it('falls back to the cwd basename for an untitled session', () => {
    const model = buildTrayModel([session('a', 'working', null)]);
    expect(model.items[0]?.text).toBe('▶  api');
  });

  it('excludes ended sessions from the dropdown, matching the aggregate', () => {
    const model = buildTrayModel([
      session('a', 'working', 'Refactor'),
      session('b', 'ended', 'Finished'),
    ]);
    expect(model.label).toBe('1▶');
    expect(model.summary).toBe('1 working');
    expect(model.items.map((item) => item.sessionId)).toEqual(['a']);
  });

  it('lists at most ten sessions and reports the rest as overflow', () => {
    const sessions = Array.from({ length: 13 }, (_, index) =>
      session(`s${String(index)}`, 'working', `Session ${String(index)}`),
    );
    const model = buildTrayModel(sessions);
    expect(model.items).toHaveLength(10);
    expect(model.items.at(-1)?.sessionId).toBe('s9');
    expect(model.overflow).toBe(3);
  });

  it('truncates a long session title so the menu stays narrow', () => {
    const model = buildTrayModel([session('a', 'working', 'x'.repeat(80))]);
    expect(model.items[0]?.text).toHaveLength(44);
    expect(model.items[0]?.text.endsWith('…')).toBe(true);
  });

  it('caps the menu bar label length', () => {
    const sessions = Array.from({ length: 1000 }, (_, index) =>
      session(`s${String(index)}`, 'working', 'busy'),
    );
    expect(buildTrayModel(sessions).label.length).toBeLessThanOrEqual(20);
  });
});
