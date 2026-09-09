import { describe, expect, it } from 'vitest';

import { clampWindowPosition } from './clampWindowPosition';
import type { ScreenRect } from './clampWindowPosition';

/** A 1440p built-in display at the origin. */
const BUILT_IN: ScreenRect = { x: 0, y: 0, width: 2560, height: 1440 };
/** A 4K monitor to the right of it. */
const EXTERNAL: ScreenRect = { x: 2560, y: 0, width: 3840, height: 2160 };

const frame = (x: number, y: number): ScreenRect => ({ x, y, width: 320, height: 400 });

describe('clampWindowPosition', () => {
  it('leaves a fully visible position alone', () => {
    expect(
      clampWindowPosition({ frame: frame(100, 100), monitors: [BUILT_IN, EXTERNAL] }),
    ).toBeNull();
    expect(
      clampWindowPosition({ frame: frame(3000, 900), monitors: [BUILT_IN, EXTERNAL] }),
    ).toBeNull();
  });

  it('leaves a position alone while most of the panel is still on screen', () => {
    // 40px of a 400px-tall panel hangs off the bottom: 90% visible.
    expect(clampWindowPosition({ frame: frame(100, 1080), monitors: [BUILT_IN] })).toBeNull();
  });

  it('pulls the panel back when most of it is off screen', () => {
    expect(clampWindowPosition({ frame: frame(100, 1300), monitors: [BUILT_IN] })).toEqual({
      x: 100,
      y: 1040,
    });
  });

  it('moves the panel onto the primary display when its monitor is gone', () => {
    // Saved on the external 4K monitor, restored with only the built-in attached.
    expect(clampWindowPosition({ frame: frame(4000, 1800), monitors: [BUILT_IN] })).toEqual({
      x: 2240,
      y: 1040,
    });
  });

  it('keeps a panel saved on a still-attached secondary monitor there', () => {
    expect(
      clampWindowPosition({ frame: frame(6200, 2000), monitors: [BUILT_IN, EXTERNAL] }),
    ).toEqual({ x: 6080, y: 1760 });
  });

  it('clamps a negative position back to the monitor origin', () => {
    expect(clampWindowPosition({ frame: frame(-400, -400), monitors: [BUILT_IN] })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('lands a panel larger than the monitor on that monitor origin', () => {
    expect(
      clampWindowPosition({
        frame: { x: -5000, y: -5000, width: 4000, height: 3000 },
        monitors: [BUILT_IN],
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it('declines to decide when no monitors are reported', () => {
    expect(clampWindowPosition({ frame: frame(100, 100), monitors: [] })).toBeNull();
  });

  it('clamps a degenerate zero-area frame rather than dividing by zero', () => {
    expect(
      clampWindowPosition({
        frame: { x: 9999, y: 9999, width: 0, height: 0 },
        monitors: [BUILT_IN],
      }),
    ).toEqual({ x: 2560, y: 1440 });
  });

  it('picks the monitor the panel overlaps most', () => {
    const left: ScreenRect = { x: 0, y: 0, width: 1000, height: 1000 };
    const right: ScreenRect = { x: 1000, y: 0, width: 1000, height: 1000 };
    // Straddling the seam with 300 of 320 px on the right monitor, mostly below both.
    expect(
      clampWindowPosition({
        frame: { x: 980, y: 900, width: 320, height: 400 },
        monitors: [left, right],
      }),
    ).toEqual({ x: 1000, y: 600 });
  });
});
