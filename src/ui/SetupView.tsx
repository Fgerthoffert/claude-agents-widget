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

const list = (events: readonly string[]): string => events.join(', ');

/**
 * The first-run guide and the permanent diagnostics view, in the same 320px panel.
 *
 * Three steps, in the order they block each other: without the hooks nothing is detected,
 * without the macOS grants a click cannot raise a window, and sessions that were already
 * running when the hooks were installed never fired one. Each step says what it will do
 * *before* offering the button that does it, which is the whole consent model — the install
 * writes to `~/.claude/settings.json`, so the user has to be able to see that first and read
 * the exact change if they want to (ADR-0009).
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
        <p className="setup__intro">
          Two one-time steps: let Claude Code tell the widget what your agents are doing, and let
          macOS raise their windows when you click a row.
        </p>

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
            ) : hooks.status === 'done' ? (
              <p className="setup__text">
                All five events call <code>{hookPath}</code>.
              </p>
            ) : (
              <>
                <p className="setup__text">
                  Adds {hooks.missingEvents.length} entr
                  {hooks.missingEvents.length === 1 ? 'y' : 'ies'} to <code>{settingsPath}</code>{' '}
                  and copies the hook script to <code>{hookPath}</code>. Your existing hooks are
                  kept exactly as they are, and a backup of the settings file is written first.
                </p>
                {hooks.registeredEvents.length > 0 && (
                  <p className="setup__muted">Already registered: {list(hooks.registeredEvents)}</p>
                )}
                <p className="setup__muted">Will add: {list(hooks.missingEvents)}</p>
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
                  <pre className="setup__preview">{preview ?? 'Nothing would change.'}</pre>
                )}
              </>
            )}
            {outcome !== null && <p className="setup__outcome">{outcome}</p>}
          </SetupStep>

          <SetupStep index={2} title="Let macOS raise windows" status={permissions.status}>
            <p className="setup__text">
              Clicking a session runs a short AppleScript. macOS asks for <b>Automation</b> the
              first time and remembers it. <b>Accessibility</b> is separate and cannot be prompted
              for — it is what lets the widget walk VS Code and Cursor windows to find the right
              one, and without it a click still raises the app, just not the exact window.
            </p>
            <div className="setup__actions">
              <button
                type="button"
                className="setup__button"
                onClick={() => {
                  onOpenPane('automation');
                }}
              >
                Open Automation
              </button>
              <button
                type="button"
                className="setup__button"
                onClick={() => {
                  onOpenPane('accessibility');
                }}
              >
                Open Accessibility
              </button>
            </div>
            <p className="setup__muted">
              The grant is attached to this exact app bundle, so replacing the app — a new release,
              a rebuild — means granting it again.
            </p>
            {permissions.status === 'blocked' && (
              <p className="setup__outcome">
                macOS refused the last click ({permissions.lastFocus?.detail ?? 'permission-denied'}
                ). Tick <b>Claude Agents Widget</b> under Accessibility, then click a row again.
              </p>
            )}
            {permissions.status === 'done' && (
              <p className="setup__muted">The last click landed on the exact window.</p>
            )}
          </SetupStep>

          <SetupStep index={3} title="Restart running agents" status={sessions.status}>
            {sessions.status === 'done' ? (
              <p className="setup__text">
                {sessions.hookOwned} of {sessions.total} session
                {sessions.total === 1 ? '' : 's'} are reporting through the hooks.
              </p>
            ) : sessions.status === 'todo' ? (
              <p className="setup__text">
                {sessions.total} session{sessions.total === 1 ? '' : 's'} found by the process
                scanner, none reporting through the hooks. Hooks only apply to sessions started
                afterwards — restart them and they will report precisely, including{' '}
                <i>needs input</i>.
              </p>
            ) : (
              <p className="setup__text">
                No agents running right now. Start one and it appears in the panel within a couple
                of seconds.
              </p>
            )}
          </SetupStep>
        </ol>
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
