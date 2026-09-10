import { describe, expect, it } from 'vitest';

import { DEFAULT_PANEL_SETTINGS, parsePanelSettings } from './parsePanelSettings';

describe('parsePanelSettings', () => {
  it('defaults auto-height on, which is what a fresh install gets', () => {
    expect(DEFAULT_PANEL_SETTINGS.autoHeight).toBe(true);
    expect(parsePanelSettings(undefined)).toEqual({ autoHeight: true });
    expect(parsePanelSettings(null)).toEqual({ autoHeight: true });
    expect(parsePanelSettings({})).toEqual({ autoHeight: true });
  });

  it('honours an explicit choice either way', () => {
    expect(parsePanelSettings({ autoHeight: false })).toEqual({ autoHeight: false });
    expect(parsePanelSettings({ autoHeight: true })).toEqual({ autoHeight: true });
  });

  it('treats a hand-edited non-boolean as unset rather than as off', () => {
    expect(parsePanelSettings({ autoHeight: 'false' })).toEqual({ autoHeight: true });
    expect(parsePanelSettings({ autoHeight: 0 })).toEqual({ autoHeight: true });
  });

  it('ignores keys it does not know', () => {
    expect(parsePanelSettings({ autoHeight: false, somethingElse: 1 })).toEqual({
      autoHeight: false,
    });
  });

  it('rejects a non-object outright', () => {
    expect(parsePanelSettings('nope')).toEqual({ autoHeight: true });
    expect(parsePanelSettings([1, 2])).toEqual({ autoHeight: true });
  });
});
