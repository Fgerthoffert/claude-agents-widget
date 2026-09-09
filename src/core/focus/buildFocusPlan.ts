import { buildFocusScript } from './buildFocusScript';
import type { FocusStep, FocusTarget } from './types';

/**
 * The ordered attempts for a target, precise first, coarsest last.
 *
 * The PRD's hard requirement is that a click is never a no-op, so this is a chain rather than a
 * single recipe:
 *
 * 1. the adapter's AppleScript — exact window or tab;
 * 2. for editors only, `open -b <id> <cwd>` — verified on this machine to raise the existing
 *    VS Code window holding that folder, with no Accessibility consent needed. It is second
 *    because it opens a *new* window when `cwd` is not itself a window root, which is why it
 *    carries `mayCreateWindow` and the orchestrator drops it once step 1 has reported
 *    `window-not-found`;
 * 3. `open -b <id>` — plain app activation, which needs no consent at all.
 *
 * An empty plan means even activation is impossible (no bundle id), which only happens for an
 * unrecognised host.
 */
export const buildFocusPlan = (target: FocusTarget): readonly FocusStep[] => {
  const { bundleId, opensPaths } = target.host;
  const script = buildFocusScript(target);

  return [
    ...(script === null
      ? []
      : [
          {
            command: 'osascript' as const,
            args: ['-e', script.source],
            method: script.method,
            degraded: false,
            mayCreateWindow: false,
            success: 'marker' as const,
          },
        ]),
    ...(bundleId !== null && opensPaths && target.cwd !== null
      ? [
          {
            command: 'open-bundle-path' as const,
            args: ['-b', bundleId, target.cwd],
            method: 'window' as const,
            degraded: true,
            mayCreateWindow: true,
            success: 'exit' as const,
          },
        ]
      : []),
    ...(bundleId === null
      ? []
      : [
          {
            command: 'open-bundle' as const,
            args: ['-b', bundleId],
            method: 'app' as const,
            degraded: true,
            mayCreateWindow: false,
            success: 'exit' as const,
          },
        ]),
  ];
};
