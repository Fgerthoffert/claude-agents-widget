import { Command } from '@tauri-apps/plugin-shell';

import { focusSessionWithRunner } from '../core/focus/focusSessionWithRunner';
import type { FocusRunOutcome, FocusResult, FocusRunner } from '../core/focus/types';
import type { Session } from '../core/types';

/**
 * A window-focus AppleScript is normally instant; three seconds is long enough for a cold
 * `System Events` and short enough that a hung `osascript` still leaves time to fall back.
 */
const TIMEOUT_MS = 3_000;

/** `null` is reserved for a timeout — see `interpretFocusAttempt`. */
const TIMED_OUT: FocusRunOutcome = { code: null, stdout: '', stderr: 'osascript timed out' };

const withTimeout = async (work: Promise<FocusRunOutcome>): Promise<FocusRunOutcome> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<FocusRunOutcome>((resolve) => {
        timer = setTimeout(() => {
          resolve(TIMED_OUT);
        }, TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Command names must match the allowlist in `src-tauri/capabilities/default.json`. */
const runCommand: FocusRunner = (command, args) =>
  withTimeout(
    Command.create(command, [...args])
      .execute()
      .then(({ code, stdout, stderr }) => ({ code, stdout, stderr }))
      // A rejected spawn (a scope violation, a missing binary) is a failure, not a timeout.
      .catch((error: unknown) => ({ code: -1, stdout: '', stderr: String(error) })),
  );

/**
 * Raises the window that owns a session. The single entry point the UI calls on a row click.
 *
 * All of the judgement lives in `src/core/focus/`; this shell only supplies a Tauri-backed
 * runner and the timeout. The result is always typed, so the UI can report an app-level
 * degradation or a missing macOS permission instead of appearing to do nothing.
 */
export const focusSession = (session: Session): Promise<FocusResult> =>
  focusSessionWithRunner(session, runCommand);
