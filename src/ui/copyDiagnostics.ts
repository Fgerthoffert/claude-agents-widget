import { formatDiagnostics } from '../core/formatDiagnostics';
import { isTauri } from './isTauri';
import type { SetupState } from '../core/evaluateSetupState';

interface CopyDiagnosticsInput {
  readonly setup: SetupState;
  readonly hookPath: string;
  readonly settingsPath: string;
}

/**
 * Puts the diagnostics block on the clipboard and says whether it got there.
 *
 * The app version is read from the native layer when there is one and reported as `unknown`
 * otherwise, rather than failing the copy: a dump missing one line is still worth pasting into
 * a bug report.
 */
export const copyDiagnostics = async (input: CopyDiagnosticsInput): Promise<boolean> => {
  const appVersion = await (async (): Promise<string> => {
    if (!isTauri()) return 'unknown (browser preview)';
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      return await getVersion();
    } catch {
      return 'unknown';
    }
  })();

  const text = formatDiagnostics({
    appVersion,
    platform: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    hookPath: input.hookPath,
    settingsPath: input.settingsPath,
    setup: input.setup,
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
