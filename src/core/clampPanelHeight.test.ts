import { describe, expect, it } from 'vitest';

import { clampPanelHeight } from './clampPanelHeight';

const request = (overrides: Partial<Parameters<typeof clampPanelHeight>[0]> = {}) => ({
  contentHeight: 300,
  minHeight: 120,
  availableHeight: 1000,
  ...overrides,
});

describe('clampPanelHeight', () => {
  it('gives the content exactly what it asks for when there is room', () => {
    expect(clampPanelHeight(request({ contentHeight: 300 }))).toBe(300);
  });

  it('rounds a fractional measurement up, so the last row is never clipped by half a pixel', () => {
    expect(clampPanelHeight(request({ contentHeight: 300.2 }))).toBe(301);
  });

  it('never goes below the window floor', () => {
    expect(clampPanelHeight(request({ contentHeight: 40, minHeight: 120 }))).toBe(120);
  });

  it('stops short of the work area, leaving the panel visibly floating', () => {
    // 900 of work area, so 876 once breathing room is taken off.
    expect(clampPanelHeight(request({ contentHeight: 5_000, availableHeight: 900 }))).toBe(876);
  });

  it('lets the floor win over the ceiling on an absurdly short screen', () => {
    // A ceiling below the floor would resize the window to something unusable.
    expect(
      clampPanelHeight(request({ contentHeight: 400, minHeight: 120, availableHeight: 60 })),
    ).toBe(120);
  });

  it('grows without limit when the screen size is unknown', () => {
    expect(clampPanelHeight(request({ contentHeight: 4_000, availableHeight: 0 }))).toBe(4_000);
  });

  it('falls back to the floor rather than passing nonsense to setSize', () => {
    expect(clampPanelHeight(request({ contentHeight: Number.NaN }))).toBe(120);
    expect(clampPanelHeight(request({ contentHeight: -10 }))).toBe(120);
    expect(clampPanelHeight(request({ contentHeight: 0 }))).toBe(120);
  });

  it('survives a missing floor too', () => {
    expect(clampPanelHeight(request({ contentHeight: Number.NaN, minHeight: 0 }))).toBe(1);
  });
});
