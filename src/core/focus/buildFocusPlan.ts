import { buildFocusScript } from './buildFocusScript';
import type { FocusStep, FocusTarget } from './types';

/**
 * The ordered attempts for a target: the precise one, then plain activation.
 *
 * The PRD's hard requirement is that a click is never a no-op, so this is a chain rather than a
 * single recipe:
 *
 * 1. the adapter's AppleScript — exact window or tab, via Accessibility;
 * 2. `open -b <id>` — plain app activation, which needs no consent at all.
 *
 * There used to be a step between them: `open -b <id> <cwd>`, which for an editor lands on the
 * window already holding that folder — and *opens a new one* when the folder is not itself a
 * window root. It is gone (ADR-0016). It cannot tell those two outcomes apart, so it was only
 * ever safe when something else had already established that the window exists; and if we can
 * establish that, we can raise the window directly and do not need it. Reached as a blind
 * fallback it hands the user a brand-new empty editor instead of the agent they clicked on,
 * which is a worse answer than "I could only raise the app".
 *
 * An empty plan means even activation is impossible (no bundle id), which only happens for an
 * unrecognised host.
 */
export const buildFocusPlan = (target: FocusTarget): readonly FocusStep[] => {
  const { bundleId } = target.host;
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
            success: 'marker' as const,
          },
        ]),
    ...(bundleId === null
      ? []
      : [
          {
            command: 'open-bundle' as const,
            args: ['-b', bundleId],
            method: 'app' as const,
            degraded: true,
            success: 'exit' as const,
          },
        ]),
  ];
};
