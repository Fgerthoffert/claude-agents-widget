import { formatBuildIdentity } from '../core/formatBuildIdentity';
import { formatDiagnostics } from '../core/formatDiagnostics';
import { appLogPath } from '../detection/appLogPath';
import { isTauri } from './isTauri';
import { readBuildInfo } from './readBuildInfo';
import type { SetupState } from '../core/evaluateSetupState';
import type { DetectionHealth } from '../core/types';

interface CopyDiagnosticsInput {
  readonly setup: SetupState;
  readonly hookPath: string;
  readonly settingsPath: string;
  readonly health: DetectionHealth;
}

/**
 * Puts the diagnostics block on the clipboard and says whether it got there.
 *
 * The build identity and the log path are read from the native layer when there is one and
 * reported as `unknown` otherwise, rather than failing the copy: a dump missing one line is
 * still worth pasting into a bug report. Both matter more than anything else here — the identity
 * says which commit to reproduce against, and the log path says where the real error text is.
 */
export const copyDiagnostics = async (input: CopyDiagnosticsInput): Promise<boolean> => {
  const appVersion = await (async (): Promise<string> => {
    if (!isTauri()) return 'unknown (browser preview)';
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      return formatBuildIdentity(await getVersion(), readBuildInfo());
    } catch {
      return 'unknown';
    }
  })();

  const text = formatDiagnostics({
    appVersion,
    platform: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    hookPath: input.hookPath,
    settingsPath: input.settingsPath,
    logPath: (await appLogPath()) ?? 'unknown',
    setup: input.setup,
    health: input.health,
    generatedAt: new Date().toISOString(),
  });

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('could not copy the diagnostics to the clipboard', error);
    return false;
  }
};
