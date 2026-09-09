import { describe, expect, it } from 'vitest';

import { describeFocusOutcome } from './describeFocusOutcome';
import type { LastFocusOutcome } from './evaluateSetupState';

const outcome = (overrides: Partial<LastFocusOutcome> = {}): LastFocusOutcome => ({
  ok: true,
  method: 'window',
  permissionDenied: false,
  degraded: false,
  detail: 'window',
  ...overrides,
});

describe('describeFocusOutcome', () => {
  it('says nothing when the exact window came forward', () => {
    expect(describeFocusOutcome(outcome())).toBeNull();
    expect(describeFocusOutcome(outcome({ method: 'tab', detail: 'tab' }))).toBeNull();
  });

  it('names the missing grant when a click only half-worked because of it', () => {
    const message = describeFocusOutcome(
      outcome({ method: 'app', degraded: true, permissionDenied: true, detail: 'app' }),
    );

    expect(message).toContain('Accessibility');
  });

  it('still speaks up for a degraded success with no permission problem', () => {
    const message = describeFocusOutcome(outcome({ method: 'app', degraded: true, detail: 'app' }));

    expect(message).toBe('Raised the app; the exact window could not be found.');
  });

  it('translates each failure reason into something actionable', () => {
    const failed = (detail: string) =>
      describeFocusOutcome(outcome({ ok: false, method: null, detail }));

    expect(failed('permission-denied')).toContain('Accessibility');
    expect(failed('window-not-found')).toContain('gone');
    expect(failed('no-host')).toContain('No terminal window');
    expect(failed('unsupported-host')).toContain('not one the widget can raise');
    expect(failed('timeout')).toContain('timed out');
  });

  it('falls back to a plain sentence for a reason it has no wording for', () => {
    expect(
      describeFocusOutcome(outcome({ ok: false, method: null, detail: 'something-new' })),
    ).toBe('Could not raise that window.');
  });
});
