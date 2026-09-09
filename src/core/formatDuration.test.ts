import { describe, expect, it } from 'vitest';

import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('reads 0s below one second', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(1)).toBe('0s');
    expect(formatDuration(999)).toBe('0s');
  });

  it('counts seconds up to the minute boundary', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(12_000)).toBe('12s');
    expect(formatDuration(59_999)).toBe('59s');
  });

  it('switches to minutes at exactly one minute', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(90_000)).toBe('1m');
    expect(formatDuration(4 * 60_000)).toBe('4m');
    expect(formatDuration(59 * 60_000 + 59_000)).toBe('59m');
  });

  it('switches to hours at exactly one hour and truncates down', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h');
    expect(formatDuration(90 * 60_000)).toBe('1h');
    expect(formatDuration(25 * 60 * 60_000)).toBe('1d');
    expect(formatDuration(23 * 60 * 60_000)).toBe('23h');
  });

  it('switches to days at exactly one day', () => {
    expect(formatDuration(24 * 60 * 60_000)).toBe('1d');
    expect(formatDuration(3 * 24 * 60 * 60_000 + 60_000)).toBe('3d');
  });

  it('never reads negative: clock skew degrades to 0s', () => {
    expect(formatDuration(-1)).toBe('0s');
    expect(formatDuration(-90_000)).toBe('0s');
  });

  it('degrades to 0s for non-finite input', () => {
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});
