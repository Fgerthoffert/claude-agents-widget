interface EmptyStateProps {
  readonly hooksInstalled: boolean;
  readonly busy: boolean;
  /** One sentence about the last install attempt, or `null` before any. */
  readonly outcome: string | null;
  readonly onInstall: () => void;
  readonly onOpenSetup: () => void;
}

/**
 * What the panel says when it has nothing to show — and the fastest route out of it.
 *
 * An empty panel is ambiguous: no agents running, or detection never set up? On a fresh install
 * it is nearly always the latter, so the empty state offers the install as a button rather than
 * naming a terminal command. A user who installed the `.dmg` has no repository and no npm, and
 * telling them to run one would be a dead end.
 *
 * Once the hooks are in, the message changes instead of nagging: an empty panel then genuinely
 * means "nothing is running", which is a fine thing for it to say.
 */
export const EmptyState = ({
  hooksInstalled,
  busy,
  outcome,
  onInstall,
  onOpenSetup,
}: EmptyStateProps) => (
  <div className="panel__empty" data-tauri-drag-region>
    <p className="panel__empty-title">
      {hooksInstalled ? 'No agents running right now' : 'No Claude Code sessions detected'}
    </p>
    <p className="panel__empty-hint">
      {hooksInstalled
        ? 'Start an agent anywhere and it appears here within a couple of seconds.'
        : 'The Claude Code hooks are not installed yet, so nothing is reporting in. Installing them merges five entries into ~/.claude/settings.json, keeps your existing hooks and backs the file up first.'}
    </p>
    {!hooksInstalled && (
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
