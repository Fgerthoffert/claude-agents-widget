interface EmptyStateProps {
  readonly hooksInstalled: boolean;
  /**
   * Why the sweep is not producing sessions, or `null` when it is. An empty panel means
   * different things in the two cases and must not claim the reassuring one (ADR-0011).
   */
  readonly failure: string | null;
  readonly busy: boolean;
  /** One sentence about the last install attempt, or `null` before any. */
  readonly outcome: string | null;
  readonly onInstall: () => void;
  readonly onOpenSetup: () => void;
}

/**
 * What the panel says when it has nothing to show — and the fastest route out of it.
 *
 * An empty panel is ambiguous three ways: nothing is running, detection was never set up, or
 * detection is broken. Each gets its own wording, because the action they call for is different
 * — wait, install, or report a bug.
 *
 * A broken sweep comes first: v0.2.0 answered it with "No agents running right now", which sent
 * users looking for a problem in Claude Code instead of in this app (ADR-0011).
 *
 * On a fresh install an empty panel is nearly always a missing install, so that state offers the
 * install as a button rather than naming a terminal command. A user who installed the `.dmg` has
 * no repository and no npm, and telling them to run one would be a dead end.
 */
export const EmptyState = ({
  hooksInstalled,
  failure,
  busy,
  outcome,
  onInstall,
  onOpenSetup,
}: EmptyStateProps) => (
  <div className="panel__empty" data-tauri-drag-region>
    <p className="panel__empty-title">
      {failure !== null
        ? 'Detection is not running'
        : hooksInstalled
          ? 'No agents running right now'
          : 'No Claude Code sessions detected'}
    </p>
    {failure !== null ? (
      <>
        <p className="panel__empty-error">{failure}</p>
        <p className="panel__empty-hint">
          This is a bug in the widget, not in your sessions. Open Setup &amp; diagnostics for the
          log file path, then copy the diagnostics into a bug report.
        </p>
      </>
    ) : (
      <p className="panel__empty-hint">
        {hooksInstalled
          ? 'Start an agent anywhere and it appears here within a couple of seconds.'
          : 'The Claude Code hooks are not installed yet, so nothing is reporting in. Installing them merges five entries into ~/.claude/settings.json, keeps your existing hooks and backs the file up first.'}
      </p>
    )}
    {failure === null && !hooksInstalled && (
      <button
        type="button"
        className="setup__button setup__button--primary"
        onClick={onInstall}
        disabled={busy}
      >
        {busy ? 'Installing…' : 'Install hook'}
      </button>
    )}
    {outcome !== null && <p className="panel__empty-hint">{outcome}</p>}
    <button type="button" className="panel__empty-link" onClick={onOpenSetup}>
      Setup &amp; diagnostics
    </button>
  </div>
);
