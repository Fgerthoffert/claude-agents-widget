import { describe, expect, it } from 'vitest';

import { sessionEmoji } from './sessionEmoji';
import type { SessionState } from './types';

describe('sessionEmoji', () => {
  it('gives every state its own glyph', () => {
    const states: readonly SessionState[] = ['needs_input', 'working', 'done_idle', 'ended'];
    const glyphs = states.map(sessionEmoji);

    expect(glyphs).toEqual(['✋', '🔄', '✅', '💤']);
    expect(new Set(glyphs).size).toBe(states.length);
  });
});
