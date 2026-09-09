/** What the build knew about git when it was compiled, injected by `vite.config.ts`. */
export interface BuildInfo {
  /** Short SHA of `HEAD`, or `null` when git was unavailable (a release tarball build). */
  readonly commit: string | null;
  /** True when `HEAD` is exactly a tag — i.e. this is a released build. */
  readonly tagged: boolean;
  /** True when the working tree had uncommitted changes. */
  readonly dirty: boolean;
}

/**
 * The one string that identifies a build in the UI and in a bug report.
 *
 * A tagged build is fully described by its version, so it shows `v0.2.1` and nothing else. Any
 * other build could be any commit on `main`, which makes the version alone useless for
 * reproducing a report — so it carries the short SHA, and `-dirty` when the tree was not clean.
 */
export const formatBuildIdentity = (version: string, build: BuildInfo): string => {
  const label = `v${version}`;
  if (build.tagged && !build.dirty) return label;
  if (build.commit === null) return build.dirty ? `${label} (dirty)` : label;

  return `${label} (${build.commit}${build.dirty ? '-dirty' : ''})`;
};
