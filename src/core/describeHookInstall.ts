/** The outcome of one hook install attempt, as `src/detection/installHooksInApp.ts` reports it. */
export interface HookInstallReport {
  readonly ok: boolean;
  /** Events this run added. Empty with `ok: true` means it was already installed. */
  readonly added: readonly string[];
  readonly alreadyPresent: readonly string[];
  readonly backedUp: boolean;
  readonly reason:
    'settings-unreadable' | 'hook-resource-missing' | 'write-failed' | 'not-available' | null;
  readonly detail: string | null;
}

/**
 * One sentence the setup view can show after an install attempt.
 *
 * The three outcomes a user actually needs told apart are "it worked", "it was already done"
 * and "it failed, and here is why" — a spinner that silently stops teaches nothing. A success
 * always ends by saying the hooks only apply to sessions started afterwards, because that is
 * the one thing that otherwise looks like a broken install.
 */
export const describeHookInstall = (report: HookInstallReport): string => {
  if (!report.ok) {
    switch (report.reason) {
      case 'settings-unreadable':
        return `Nothing was changed: ${report.detail ?? 'settings.json could not be read.'}`;
      case 'hook-resource-missing':
        return 'The hook script is missing from the app bundle — please report this as a bug.';
      case 'not-available':
        return 'Hook installation needs the packaged app; it does nothing in the browser preview.';
      default:
        return `Install failed: ${report.detail ?? 'unknown error'}.`;
    }
  }

  if (report.added.length === 0) {
    return 'Already installed — every event was registered, and the hook script was refreshed.';
  }

  const backup = report.backedUp ? ' A backup of settings.json was written first.' : '';
  return (
    `Installed: ${String(report.added.length)} event(s) registered.${backup} ` +
    'Hooks only apply to sessions started from now on, so restart any running agents.'
  );
};
