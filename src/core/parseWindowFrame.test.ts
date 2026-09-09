import { describe, expect, it } from 'vitest';

import { parseWindowFrame } from './parseWindowFrame';

describe('parseWindowFrame', () => {
  it('accepts a complete frame', () => {
    expect(parseWindowFrame({ x: 12, y: 34, width: 320, height: 400 })).toEqual({
      x: 12,
      y: 34,
      width: 320,
      height: 400,
    });
  });

  it('accepts negative coordinates: a monitor left of the primary has them', () => {
    expect(parseWindowFrame({ x: -1200, y: -300, width: 320, height: 400 })).toEqual({
      x: -1200,
      y: -300,
      width: 320,
      height: 400,
    });
  });

  it('ignores unknown extra keys', () => {
    expect(parseWindowFrame({ x: 0, y: 0, width: 1, height: 1, monitor: 'external' })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it('rejects a missing record', () => {
    expect(parseWindowFrame(null)).toBeNull();
    expect(parseWindowFrame(undefined)).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(parseWindowFrame('320x400')).toBeNull();
    expect(parseWindowFrame(42)).toBeNull();
  });

  it('rejects a partial record', () => {
    expect(parseWindowFrame({ x: 1, y: 2 })).toBeNull();
    expect(parseWindowFrame({ width: 320, height: 400 })).toBeNull();
  });

  it('rejects non-numeric and non-finite fields', () => {
    expect(parseWindowFrame({ x: '1', y: 2, width: 320, height: 400 })).toBeNull();
    expect(parseWindowFrame({ x: Number.NaN, y: 2, width: 320, height: 400 })).toBeNull();
    expect(
      parseWindowFrame({ x: 1, y: Number.POSITIVE_INFINITY, width: 320, height: 400 }),
    ).toBeNull();
  });

  it('rejects a zero or negative size', () => {
    expect(parseWindowFrame({ x: 1, y: 2, width: 0, height: 400 })).toBeNull();
    expect(parseWindowFrame({ x: 1, y: 2, width: 320, height: -400 })).toBeNull();
  });
});
