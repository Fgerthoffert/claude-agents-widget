export interface SessionCounts {
  readonly working: number;
  readonly needsInput: number;
  readonly doneIdle: number;
}

const badges: readonly (readonly [keyof SessionCounts, string])[] = [
  ['working', '▶'],
  ['needsInput', '⏸'],
  ['doneIdle', '✔'],
];

/** Menu bar label, e.g. `3▶ 2⏸ 1✔`. Zero buckets are omitted; nothing active reads `idle`. */
export const formatAggregate = (counts: SessionCounts): string => {
  const parts = badges
    .filter(([bucket]) => counts[bucket] > 0)
    .map(([bucket, glyph]) => `${String(counts[bucket])}${glyph}`);

  return parts.length > 0 ? parts.join(' ') : 'idle';
};
