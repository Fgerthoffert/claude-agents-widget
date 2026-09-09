import { useCallback, useEffect, useMemo, useState } from 'react';

import { describeHookInstall } from '../core/describeHookInstall';
import { evaluateSetupState } from '../core/evaluateSetupState';
import { mergeHookSettings } from '../core/mergeHookSettings';
import { installHooksInApp } from '../detection/installHooksInApp';
import { probeSetup } from '../detection/probeSetup';
import { isTauri } from './isTauri';
import type { LastFocusOutcome, SetupState } from '../core/evaluateSetupState';
import type { SetupFilesProbe } from '../detection/probeSetup';
import type { Session } from '../core/types';

/** Outside the native shell there is no home directory to inspect, so nothing is claimed. */
const UNKNOWN: SetupFilesProbe = {
  settings: null,
  settingsUnreadable: false,
  hookScriptInstalled: false,
  hookPath: '~/.claude-agents-widget/hook.mjs',
  settingsPath: '~/.claude/settings.json',
};

export interface SetupController {
  readonly setup: SetupState;
  /** False until the filesystem has actually been read, so nothing acts on the placeholder. */
  readonly ready: boolean;
  readonly hookPath: string;
  readonly settingsPath: string;
  /** The exact `hooks` block an install would write, or `null` when nothing would change. */
  readonly preview: string | null;
  readonly busy: boolean;
  /** One sentence about the last install attempt, or `null` before any. */
  readonly outcome: string | null;
  readonly install: () => void;
}

/**
 * The setup checklist, live.
 *
 * Re-probes the filesystem whenever the session list changes, which is every sweep — cheap
 * (two `exists` calls and one small read) and it means the checklist ticks itself off as soon
 * as the first hook-owned session appears, with no refresh button to hunt for.
 *
 * `install` is the only thing here that writes anything, and it is a plain function the view
 * calls from a button press. Consent is the caller's job: the view shows what will change
 * before offering it (ADR-0009).
 */
export const useSetupState = (
  sessions: readonly Session[],
  lastFocus: LastFocusOutcome | null,
): SetupController => {
  const [files, setFiles] = useState<SetupFilesProbe>(UNKNOWN);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const reprobe = useCallback(() => {
    if (!isTauri()) return;
    probeSetup()
      .then((probed) => {
        setFiles(probed);
        setReady(true);
      })
      .catch((error: unknown) => {
        console.warn('could not probe the setup state', error);
      });
  }, []);

  useEffect(reprobe, [reprobe, sessions]);

  const install = useCallback(() => {
    if (busy) return;
    if (!isTauri()) {
      setOutcome(
        describeHookInstall({
          ok: false,
          added: [],
          alreadyPresent: [],
          backedUp: false,
          reason: 'not-available',
          detail: null,
        }),
      );
      return;
    }

    setBusy(true);
    installHooksInApp()
      .then((report) => {
        setOutcome(describeHookInstall(report));
      })
      .catch((error: unknown) => {
        console.error('hook install failed', error);
        setOutcome(
          describeHookInstall({
            ok: false,
            added: [],
            alreadyPresent: [],
            backedUp: false,
            reason: 'write-failed',
            detail: String(error),
          }),
        );
      })
      .finally(() => {
        setBusy(false);
        reprobe();
      });
  }, [busy, reprobe]);

  const setup = useMemo(
    () => evaluateSetupState({ ...files, sessions, lastFocus }),
    [files, sessions, lastFocus],
  );

  const preview = useMemo(() => {
    const merge = mergeHookSettings(files.settings ?? {}, files.hookPath);
    return merge.settings === null
      ? null
      : JSON.stringify({ hooks: merge.settings.hooks }, null, 2);
  }, [files]);

  return {
    setup,
    ready,
    hookPath: files.hookPath,
    settingsPath: files.settingsPath,
    preview,
    busy,
    outcome,
    install,
  };
};
