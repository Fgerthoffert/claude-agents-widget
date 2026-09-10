import { describeError } from './describeError';

/** The IO steps a detection sweep is made of, each able to fail on its own. */
export type DetectionStage = 'startup' | 'agents' | 'sweep';

/** Named after what the user loses when the step fails, not after the function that failed. */
const WHAT_BROKE: Record<DetectionStage, string> = {
  startup: 'Starting detection failed',
  agents: 'Asking Claude Code for its sessions failed',
  sweep: 'The detection sweep failed',
};

/**
 * One line naming the failing step and the underlying reason.
 *
 * The same string goes to the log file, the panel and the diagnostics dump, so there is exactly
 * one wording to recognise in a bug report (ADR-0011).
 */
export const describeDetectionFailure = (stage: DetectionStage, error: unknown): string =>
  `${WHAT_BROKE[stage]}: ${describeError(error)}`;
