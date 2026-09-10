import { describe, expect, it } from 'vitest';

import { buildTrayModel } from './buildTrayModel';
import { aSession } from './testing/aSession';
import type { Session, SessionState } from './types';

const session = (sessionId: string, state: SessionState, title: string | null): Session =>
  aSession({ sessionId, title, state });

describe('buildTrayModel', () => {
  it('marks the menu bar, without a count, when something is waiting', () => {
    const model = buildTrayModel([
      session('a', 'needs_input', 'Fix the tray'),
      session('b', 'working', 'Refactor'),
      session('c', 'working', 'Docs'),
    ]);
    expect(model.label).toBe('●');
  });

  it('leaves the menu bar unmarked while every session is working', () => {
    const model = buildTrayModel([
      session('a', 'working', 'Refactor'),
      session('b', 'working', 'Docs'),
    ]);
    expect(model.label).toBe('');
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
    expect(model.label).toBe('');
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

  it('excludes ended sessions from the dropdown, matching the summary', () => {
    const model = buildTrayModel([
      session('a', 'working', 'Refactor'),
      session('b', 'ended', 'Finished'),
    ]);
    expect(model.label).toBe('');
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

  it('keeps the menu bar label to one character however many sessions there are', () => {
    const sessions = Array.from({ length: 1000 }, (_, index) =>
      session(`s${String(index)}`, 'needs_input', 'blocked'),
    );
    expect(buildTrayModel(sessions).label).toBe('●');
  });

  it('leaves the menu bar unmarked when everything is merely finished', () => {
    // A finished agent must not make the menu bar shout (ADR-0014).
    const sessions = Array.from({ length: 20 }, (_, index) =>
      session(`s${String(index)}`, 'done_idle', 'finished'),
    );

    expect(buildTrayModel(sessions).label).toBe('');
    // …but it is still listed and still counted in the dropdown, where there is room for words.
    expect(buildTrayModel(sessions).summary).toContain('20 done');
    expect(buildTrayModel(sessions).items).toHaveLength(10);
  });
});
