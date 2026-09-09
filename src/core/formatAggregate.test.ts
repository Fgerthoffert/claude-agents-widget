import { describe, expect, it } from 'vitest';

import { formatAggregate } from './formatAggregate';

describe('formatAggregate', () => {
  it('formats mixed counts in working/needs-input/done order', () => {
    expect(formatAggregate({ working: 3, needsInput: 2, doneIdle: 1 })).toBe('3▶ 2⏸ 1✔');
  });

  it('omits zero buckets', () => {
    expect(formatAggregate({ working: 0, needsInput: 2, doneIdle: 0 })).toBe('2⏸');
    expect(formatAggregate({ working: 5, needsInput: 0, doneIdle: 4 })).toBe('5▶ 4✔');
  });

  it('reads "idle" when every bucket is empty', () => {
    expect(formatAggregate({ working: 0, needsInput: 0, doneIdle: 0 })).toBe('idle');
  });
});
