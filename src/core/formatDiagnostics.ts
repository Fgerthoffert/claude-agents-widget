import type { SetupState } from './evaluateSetupState';
import type { DetectionHealth } from './types';

export interface DiagnosticsInput {
  /** The build identity string, e.g. `v0.2.1 (abc1234)` — see `formatBuildIdentity`. */
  readonly appVersion: string;
  /** `navigator.userAgent`, or whatever the shell can cheaply say about the platform. */
  readonly platform: string;
  readonly hookPath: string;
  readonly settingsPath: string;
  /** Where the app log lives, so a bug report can be asked for it. */
  readonly logPath: string;
  readonly setup: SetupState;
  /** Whether the detection pipeline is working — the first thing to check (ADR-0011). */
  readonly health: DetectionHealth;
  /** ISO-8601, passed in so this function stays pure and testable. */
  readonly generatedAt: string;
}

const list = (values: readonly string[]): string => (values.length === 0 ? '—' : values.join(', '));

/**
 * A block the user can paste into a bug report.
 *
 * Plain text rather than JSON because the reader is a human first, and deliberately narrow:
 * paths, counts and statuses only. No session titles, no project directories, no transcript
 * contents — a diagnostics dump is the one thing in this app that is meant to leave the
 * machine, so it must not carry anything the user would not want to publish.
 */
export const formatDiagnostics = (input: DiagnosticsInput): string => {
  const { setup } = input;
  const focus = setup.permissions.lastFocus;

  return [
    'claude-agents-widget diagnostics',
    `generated       ${input.generatedAt}`,
    `app version     ${input.appVersion}`,
    `platform        ${input.platform}`,
    '',
    // First, because a failing pipeline explains every other symptom below it.
    `detection       ${input.health.failure === null ? 'ok' : 'FAILING'}`,
    ...(input.health.failure === null ? [] : [`  failure       ${input.health.failure}`]),
    ...(input.health.degraded.length === 0
      ? []
      : input.health.degraded.map((reason) => `  degraded      ${reason}`)),
    '',
    `settings file   ${input.settingsPath}`,
    `hook script     ${input.hookPath}`,
    `log file        ${input.logPath}`,
    `hook status     ${setup.hooks.status}`,
    `  script        ${setup.hooks.scriptInstalled ? 'installed' : 'missing'}`,
    `  registered    ${list(setup.hooks.registeredEvents)}`,
    `  missing       ${list(setup.hooks.missingEvents)}`,
    '',
    `sessions        ${String(setup.sessions.total)} (${String(setup.sessions.hookOwned)} via hooks, ${String(setup.sessions.scannerOnly)} via scanner)`,
    `permissions     ${setup.permissions.status}`,
    `last focus      ${
      focus === null
        ? 'no click yet'
        : `${focus.ok ? 'ok' : 'failed'} · ${focus.detail}${focus.permissionDenied ? ' · macOS refused it' : ''}`
    }`,
    '',
  ].join('\n');
};
