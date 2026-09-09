import { describe, expect, it } from 'vitest';

import { describeDetectionFailure } from './describeDetectionFailure';

describe('describeDetectionFailure', () => {
  it('names the step and the reason, in that order', () => {
    expect(describeDetectionFailure('watcher', new Error('fs.watch not allowed'))).toBe(
      'Watching the hook state directory failed: fs.watch not allowed',
    );
  });

  it('covers every stage the pipeline can fail at', () => {
    const stages = ['startup', 'watcher', 'hooks', 'scanner', 'titles', 'sweep'] as const;

    for (const stage of stages) {
      const line = describeDetectionFailure(stage, 'boom');
      expect(line).toMatch(/failed: boom$/);
      // Never "undefined: …": an unlabelled stage would leave a bug report guessing.
      expect(line).not.toContain('undefined');
    }
  });
});
