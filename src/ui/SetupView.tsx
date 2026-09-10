import { SetupStep } from './SetupStep';
import type { SetupState } from '../core/evaluateSetupState';
import type { DetectionHealth } from '../core/types';
import type { SystemSettingsPane } from '../detection/openSystemSettings';

interface SetupViewProps {
  readonly setup: SetupState;
  /** Whether sweeps are producing data. Shown first when they are not. */
  readonly health: DetectionHealth;
  /** Build identity (`v0.8.0 (abc1234)`), or `null` before the native layer answers. */
  readonly buildIdentity: string | null;
  /** Absolute path of the app log, or `null` outside the native shell. */
  readonly logPath: string | null;
  readonly onOpenPane: (pane: SystemSettingsPane) => void;
  readonly onCopyDiagnostics: () => void;
  readonly onClose: () => void;
  /** Whether the window fits its own height to the number of agents (ADR-0015). */
  readonly autoHeight: boolean;
  readonly onAutoHeightChange: (on: boolean) => void;
}

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/**
 * Setup and diagnostics, in the same 320px panel.
 *
 * **One** step. There were three: install a hook script into `~/.claude/settings.json`, grant
 * macOS the right to raise windows, and restart any sessions that predated the install. Two of
 * them are gone because the widget no longer needs anything installed — it asks
 * `claude agents --json` what the sessions are doing (ADR-0018) — and the third was never a step
 * the user performed here.
 *
 * What is left is the one thing that cannot be automated: macOS will not let an app request
 * Accessibility for itself, so this can only link to the pane and be honest about not knowing.
 * The step is never `done` on faith — only a click that actually reached a window proves it.
 */
export const SetupView = ({
  setup,
  health,
  buildIdentity,
  logPath,
  onOpenPane,
  onCopyDiagnostics,
  onClose,
  autoHeight,
  onAutoHeightChange,
}: SetupViewProps) => {
  const { permissions, sessions } = setup;

  return (
    <section className="setup" aria-label="Setup and diagnostics">
      <div className="setup__scroll">
        {/* First: a broken pipeline explains every other symptom below it (ADR-0011). */}
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
          <SetupStep index={1} title="Let macOS raise windows" status={permissions.status}>
            {permissions.status === 'done' ? null : (
              <>
                <p className="setup__text">
                  <b>Accessibility</b> is what lets a click land on the exact window. Without it a
                  click still raises the app, just not the right window.
                </p>
                <div className="setup__actions">
                  <button
                    type="button"
                    className="setup__button setup__button--primary"
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

        <p className="setup__status">
          {sessions.total === 0
            ? 'No agents running right now.'
            : `${String(sessions.total)} ${plural(sessions.total, 'session', 'sessions')} reported by Claude Code${sessions.background === 0 ? '' : `, ${String(sessions.background)} in the background`}.`}
        </p>

        <section className="setup__prefs" aria-label="Preferences">
          <h2 className="setup__prefs-title">Panel</h2>
          <label className="setup__toggle">
            <input
              type="checkbox"
              className="setup__checkbox"
              checked={autoHeight}
              onChange={(event) => {
                onAutoHeightChange(event.target.checked);
              }}
            />
            <span className="setup__toggle-body">
              <span className="setup__toggle-label">Fit the height to the agents</span>
              <span className="setup__muted">
                {autoHeight
                  ? 'The window grows and shrinks with the list, up to the height of your screen. Turn this off to set the height yourself.'
                  : 'The window keeps the height you give it. Drag its bottom edge to resize.'}
              </span>
            </span>
          </label>
        </section>
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
