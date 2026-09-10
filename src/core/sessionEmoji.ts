import type { SessionState } from './types';

const emoji: Readonly<Record<SessionState, string>> = {
  needs_input: '✋',
  working: '🔄',
  done_idle: '✅',
  // Asleep, not finished: a cleared session, or one done long enough to stop mattering
  // (ADR-0019). `ended` shares the glyph because it is never rendered.
  dormant: '💤',
  ended: '💤',
};

/**
 * The glyph that stands for a session's state, in the panel and in the tray dropdown.
 *
 * Emoji rather than coloured dots: the state has to be readable at a glance from across a desk,
 * and a shape carries meaning where a colour only carries a convention the user has to learn
 * (and one that colour-blind users cannot read at all). The panel's legend spells them out.
 */
export const sessionEmoji = (state: SessionState): string => emoji[state];
