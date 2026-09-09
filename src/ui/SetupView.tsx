import { useState } from 'react';

import { SetupStep } from './SetupStep';
import type { SetupState } from '../core/evaluateSetupState';
import type { DetectionHealth } from '../core/types';
import type { SystemSettingsPane } from '../detection/openSystemSettings';

interface SetupViewProps {
  readonly setup: SetupState;
  /** Whether sweeps are producing data. Shown before the checklist when they are not. */
  readonly health: DetectionHealth;
  /** Build identity (`v0.2.1 (abc1234)`), or `null` before the native layer answers. */
  readonly buildIdentity: string | null;
  /** Absolute path of the app log, or `null` outside the native shell. */
  readonly logPath: string | null;
  readonly hookPath: string;
  readonly settingsPath: string;
  /** The `hooks` block an install would write; `null` when nothing would change. */
  readonly preview: string | null;
  readonly busy: boolean;
  readonly outcome: string | null;
  readonly onInstall: () => void;
  readonly onOpenPane: (pane: SystemSettingsPane) => void;
  readonly onCopyDiagnostics: () => void;
  readonly onClose: () => void;
}

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/**
 * The first-run guide and the permanent diagnostics view, in the same 320px panel.
 *
 * **Two** steps, in the order they block each other: without the hooks nothing is detected, and
 * without the macOS grant a click cannot raise a window. Each says what it will do *before*
 * offering the button that does it, which is the whole consent model — the install writes to
 * `~/.claude/settings.json` (ADR-0009).
 *
 * It used to say considerably more, and at 320px wide that made a wall of prose out of a job with
 * two buttons in it (ADR-0013). What is left follows three rules. A step that is **done**
 * collapses to its heading and chip: it is a receipt, not an instruction, and the space belongs
 * to whatever is still outstanding. Reassurance — existing hooks kept, a backup written first —
 * sits behind *Show the change*, which is where a suspicious user is already looking. And the old
 * third step was never a step at all, because the user does nothing in the app to satisfy it; it
 * is now one line of status under the list.
 *
 * Nothing here claims a permission is granted unless a real click proved it: macOS does not
 * expose the Accessibility grant to the app that needs it, and a green tick on faith would be
 * worse than an honest "unknown".
 */
export const SetupView = ({
  setup,
  health,
  buildIdentity,
  logPath,
  hookPath,
  settingsPath,
  preview,
  busy,
  outcome,
  onInstall,
  onOpenPane,
  onCopyDiagnostics,
  onClose,
}: SetupViewProps) => {
  const [showChange, setShowChange] = useState(false);
  const { hooks, permissions, sessions } = setup;

  return (
    <section className="setup" aria-label="Setup and diagnostics">
      <div className="setup__scroll">
        {/* Above the checklist: a broken pipeline invalidates every tick below it (ADR-0011). */}
        {health.failure !== null && (
          <p className="setup__outcome" role="alert">
            <b>Detection is not running.</b> {health.failure}
            {logPath !== null && (
              <>
                {' '}
                The full error is in <code>{logPath}</code>.
              </>
            )}
          </p>
        )}
        {health.failure === null &&
          health.degraded.map((reason) => (
            <p className="setup__outcome" key={reason}>
              <b>Detection is degraded.</b> {reason}
            </p>
          ))}

        <ol className="setup__steps">
          <SetupStep index={1} title="Install the Claude Code hooks" status={hooks.status}>
            {hooks.status === 'blocked' ? (
              <p className="setup__text">
                <code>{settingsPath}</code> is not valid JSON, so nothing will be written to it. Fix
                or move the file, then come back.
              </p>
            ) : hooks.status === 'done' ? null : (
              <>
                <p className="setup__text">
                  Adds {hooks.missingEvents.length}{' '}
                  {plural(hooks.missingEvents.length, 'entry', 'entries')} to{' '}
                  <code>{settingsPath}</code> and copies the hook script to <code>{hookPath}</code>.
                </p>
                <div className="setup__actions">
                  <button
                    type="button"
                    className="setup__button setup__button--primary"
                    onClick={onInstall}
                    disabled={busy}
                  >
                    {busy ? 'Installing…' : 'Install hooks'}
                  </button>
                  <button
                    type="button"
                    className="setup__button"
                    aria-expanded={showChange}
                    onClick={() => {
                      setShowChange((shown) => !shown);
                    }}
                  >
                    {showChange ? 'Hide the change' : 'Show the change'}
                  </button>
                </div>
                {showChange && (
                  <>
                    <p className="setup__muted">
                      Your existing hooks are kept exactly as they are, and a backup of{' '}
                      <code>{settingsPath}</code> is written first. Adding:{' '}
                      {hooks.missingEvents.join(', ')}.
                    </p>
                    <pre className="setup__preview">{preview ?? 'Nothing would change.'}</pre>
                  </>
                )}
              </>
            )}
            {outcome !== null && <p className="setup__outcome">{outcome}</p>}
          </SetupStep>

          <SetupStep index={2} title="Let macOS raise windows" status={permissions.status}>
            {permissions.status === 'done' ? null : (
              <>
                <p className="setup__text">
                  <b>Accessibility</b> is what lets a click land on the exact window. Without it a
                  click still raises the app, just not the right window.
                </p>
                <div className="setup__actions">
                  <button
                    type="button"
                    className="setup__button"
                    onClick={() => {
                      onOpenPane('accessibility');
                    }}
                  >
                    Open Accessibility
                  </button>
                  <button
                    type="button"
                    className="setup__button"
                    onClick={() => {
                      onOpenPane('automation');
                    }}
                  >
                    Open Automation
                  </button>
                </div>
                {permissions.status === 'blocked' && (
                  <p className="setup__outcome">
                    macOS refused the last click (
                    {permissions.lastFocus?.detail ?? 'permission-denied'}). Tick{' '}
                    <b>Claude Agents Widget</b> under Accessibility, then click a row again. The
                    grant is attached to this exact app bundle, so replacing the app — a new
                    release, a rebuild — means granting it again.
                  </p>
                )}
              </>
            )}
          </SetupStep>
        </ol>

        {/* Not a step: nothing the user does in this app satisfies it (ADR-0013). */}
        <p className="setup__status">
          {sessions.status === 'done'
            ? `${String(sessions.hookOwned)} of ${String(sessions.total)} ${plural(sessions.total, 'session', 'sessions')} reporting through the hooks.`
            : sessions.status === 'todo'
              ? `${String(sessions.total)} ${plural(sessions.total, 'session', 'sessions')} found by the process scanner, none reporting through the hooks — restart them for precise states.`
              : 'No agents running right now.'}
        </p>
      </div>

      <footer className="setup__footer">
        <p className="setup__build" title={logPath ?? undefined}>
          {buildIdentity ?? 'version unknown'}
        </p>
        <button type="button" className="setup__button" onClick={onCopyDiagnostics}>
          Copy diagnostics
        </button>
        <button type="button" className="setup__button setup__button--primary" onClick={onClose}>
          Done
        </button>
      </footer>
    </section>
  );
};
