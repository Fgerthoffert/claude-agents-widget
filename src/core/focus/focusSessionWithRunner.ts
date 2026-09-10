import type { Ancestor, Session } from '../types';

import { buildFocusPlan } from './buildFocusPlan';
import { identifyOwnerApp } from './identifyOwnerApp';
import { interpretFocusAttempt } from './interpretFocusAttempt';
import { parseProcessAncestors } from './parseProcessAncestors';
import { parseTtyDevice } from './parseTtyDevice';
import type { FocusFailure, FocusHost, FocusResult, FocusRunner } from './types';

/** Hook sessions carry their chain; scanner sessions have none and must be walked live. */
const resolveAncestors = async (
  session: Session,
  run: FocusRunner,
): Promise<readonly Ancestor[]> => {
  if (session.ancestors.length > 0) return session.ancestors;
  if (session.claudePid === null) return [];

  const outcome = await run('ps', ['-axo', 'pid=,ppid=,command=']);
  if (outcome.code !== 0) return [];
  return parseProcessAncestors(outcome.stdout, session.claudePid);
};

const resolveTty = async (
  session: Session,
  host: FocusHost,
  run: FocusRunner,
): Promise<string | null> => {
  if (!host.needsTty || session.claudePid === null) return null;

  const outcome = await run('ps-tty', ['-o', 'tty=', '-p', String(session.claudePid)]);
  if (outcome.code !== 0) return null;
  return parseTtyDevice(outcome.stdout);
};

/**
 * Focuses the window that owns a session, degrading step by step, and always returning a typed
 * result — the PRD's "a click is never a no-op" requirement expressed as a type.
 *
 * All IO is the injected `run`, which owns the per-command timeout and reports one as a `null`
 * exit code. That keeps every decision here unit-testable with a fake runner: no test in this
 * repo runs a real `osascript` (CI is Linux, and locally it moves the user's windows).
 *
 * `degradedFrom` on a success carries the reason the *precise* attempt failed, so a fallback
 * that worked still tells Phase 5 that Accessibility consent is missing.
 */
export const focusSessionWithRunner = async (
  session: Session,
  run: FocusRunner,
): Promise<FocusResult> => {
  const ancestors = await resolveAncestors(session, run);
  const host = identifyOwnerApp(ancestors);
  const ttyDevice = await resolveTty(session, host, run);
  const plan = buildFocusPlan({ host, cwd: session.cwd, ttyDevice });

  if (plan.length === 0) {
    return {
      ok: false,
      host: host.kind,
      reason: ancestors.length === 0 ? 'no-host' : 'unsupported-host',
      detail: null,
    };
  }

  let firstFailure: FocusFailure | null = null;

  for (const step of plan) {
    const outcome = await run(step.command, step.args);
    const result = interpretFocusAttempt({ host: host.kind, step, outcome });
    if (result.ok) {
      return { ...result, degradedFrom: step.degraded ? (firstFailure?.reason ?? null) : null };
    }
    firstFailure ??= result;
  }

  // The first failure is the diagnostic one: it says why the *precise* attempt could not run,
  // which is what the UI and the first-run guide need. `plan` is non-empty, so one exists.
  return firstFailure ?? { ok: false, host: host.kind, reason: 'script-failed', detail: null };
};
