/**
 * Whether a version should be published as a GitHub pre-release.
 *
 * Anything below `1.0.0` is a pre-release: the widget is a personal tool finding its shape, and
 * a `0.x` tag marked "latest" would promise a stability it does not have. A semver pre-release
 * suffix (`1.0.0-rc.1`) counts too. An unparseable version is treated as a pre-release, because
 * the cautious answer is the safe one.
 */
export const isPrereleaseVersion = (version: string): boolean => {
  if (version.includes('-')) return true;
  const major = /^(\d+)\./.exec(version)?.[1];
  return major === undefined || major === '0';
};
