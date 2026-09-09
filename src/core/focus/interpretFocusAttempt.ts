import type {
  FocusFailureReason,
  FocusHostKind,
  FocusMethod,
  FocusResult,
  FocusRunOutcome,
  FocusStep,
} from './types';

export interface FocusAttempt {
  readonly host: FocusHostKind;
  readonly step: FocusStep;
  readonly outcome: FocusRunOutcome;
}

/**
 * macOS consent failures, matched on text rather than only on the OSA error number: -1728 is
 * also the generic "can't get that object" error, so the wording is what makes it unambiguous.
 */
const PERMISSION_PATTERNS: readonly RegExp[] = [
  /not allowed assistive access/i,
  /not authorized to send apple events/i,
  /-1743/,
  /-25211/,
];

const isMarker = (value: string): value is FocusMethod =>
  value === 'window' || value === 'tab' || value === 'app';

const classifyStderr = (stderr: string): FocusFailureReason =>
  PERMISSION_PATTERNS.some((pattern) => pattern.test(stderr))
    ? 'permission-denied'
    : 'script-failed';

/**
 * Turns one shell outcome into a typed result.
 *
 * Kept separate from the orchestration because this is where every macOS failure mode is
 * classified, and it must be provable without running `osascript`: no test in this repo may
 * (CI is Linux, and locally it is a side-effecting GUI action).
 */
export const interpretFocusAttempt = ({ host, step, outcome }: FocusAttempt): FocusResult => {
  const detail = outcome.stderr.trim() === '' ? null : outcome.stderr.trim().slice(0, 400);

  // The runner reports a timeout (or a command it never managed to start) as a null exit code.
  if (outcome.code === null) return { ok: false, host, reason: 'timeout', detail };
  if (outcome.code !== 0)
    return { ok: false, host, reason: classifyStderr(outcome.stderr), detail };
  if (step.success === 'exit') {
    return { ok: true, host, method: step.method, degradedFrom: null, detail: null };
  }

  const marker = outcome.stdout.trim();
  if (isMarker(marker)) return { ok: true, host, method: marker, degradedFrom: null, detail: null };
  return { ok: false, host, reason: 'window-not-found', detail };
};
