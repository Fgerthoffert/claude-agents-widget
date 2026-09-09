/**
 * What the panel says when it has nothing to show.
 *
 * An empty panel is ambiguous — no sessions running, or detection not working? — and the most
 * likely cause on a fresh install is that the hook was never installed, so the hint names the
 * command that fixes it instead of leaving the user to guess.
 */
export const EmptyState = () => (
  <div className="panel__empty" data-tauri-drag-region>
    <p className="panel__empty-title">No Claude Code sessions detected</p>
    <p className="panel__empty-hint">
      Start an agent and it appears here. If one is already running, install the hook with{' '}
      <code>npm run install-hooks</code>.
    </p>
  </div>
);
