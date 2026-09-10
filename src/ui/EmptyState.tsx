interface EmptyStateProps {
  /**
   * Why the sweep is not producing sessions, or `null` when it is. An empty panel means
   * different things in the two cases and must not claim the reassuring one (ADR-0011).
   */
  readonly failure: string | null;
  readonly onOpenSetup: () => void;
}

/**
 * What the panel says when it has nothing to show.
 *
 * An empty panel used to be ambiguous three ways — nothing running, never set up, or broken —
 * and the middle case was the common one, so this offered an install button. There is nothing
 * to install now (ADR-0018), which leaves two cases and a much simpler screen.
 *
 * A broken sweep comes first: v0.2.0 answered it with "No agents running right now", which sent
 * users looking for a problem in Claude Code instead of in this app (ADR-0011). It is also the
 * one place a user is asked to read an error, so it is selectable text.
 */
export const EmptyState = ({ failure, onOpenSetup }: EmptyStateProps) => (
  <div className="panel__empty" data-tauri-drag-region>
    {failure === null ? (
      <>
        <p className="panel__empty-title">No agents running right now</p>
        <p className="panel__empty-hint">
          Start one with <code>claude</code> in any terminal and it appears here within a couple of
          seconds.
        </p>
      </>
    ) : (
      <>
        <p className="panel__empty-title">Detection is not running</p>
        <p className="panel__empty-error">{failure}</p>
        <button type="button" className="panel__empty-link" onClick={onOpenSetup}>
          Open diagnostics
        </button>
      </>
    )}
  </div>
);
