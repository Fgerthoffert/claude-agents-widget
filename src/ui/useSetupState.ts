import { useMemo } from 'react';

import { evaluateSetupState } from '../core/evaluateSetupState';
import type { LastFocusOutcome, SetupState } from '../core/evaluateSetupState';
import type { Session } from '../core/types';

/**
 * The setup view's state, which is now a pure projection of what the panel already knows.
 *
 * It used to probe the filesystem on every sweep, hold the pending hook diff, run the installer
 * and report its outcome. All of that existed to get a hook script into
 * `~/.claude/settings.json`; there is no hook script (ADR-0018), so what is left is one macOS
 * permission that cannot be probed at all — only inferred from whether a click landed — and a
 * count of sessions.
 *
 * Kept as a hook rather than inlined so the view keeps one shape to render and one place to
 * grow, and so `ready` has somewhere to live if anything here ever needs IO again.
 */
export const useSetupState = (
  sessions: readonly Session[],
  lastFocus: LastFocusOutcome | null,
): SetupState => useMemo(() => evaluateSetupState({ sessions, lastFocus }), [sessions, lastFocus]);
