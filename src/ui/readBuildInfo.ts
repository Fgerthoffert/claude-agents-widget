import type { BuildInfo } from '../core/formatBuildIdentity';

/** No git at build time, so nothing may be claimed about the commit. */
const UNKNOWN: BuildInfo = { commit: null, tagged: false, dirty: false };

/**
 * The git identity Vite baked in, or a blank one.
 *
 * `typeof` rather than a direct read: Vitest and the browser preview never define the constant,
 * and a missing build stamp must not throw in the view that reports it.
 */
export const readBuildInfo = (): BuildInfo =>
  typeof __APP_BUILD__ === 'undefined' ? UNKNOWN : __APP_BUILD__;
