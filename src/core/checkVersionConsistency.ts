/** Where a version string was read from. */
export type VersionSourceName = 'package.json' | 'tauri.conf.json' | 'Cargo.toml' | 'tag';

/** Raw file contents, so parsing stays here rather than in the CLI shell. */
export interface VersionSources {
  readonly packageJson: string;
  readonly tauriConf: string;
  readonly cargoToml: string;
  /** A release tag such as `v0.1.0`. Omitted when checking the working tree alone. */
  readonly tag?: string | null;
}

export interface VersionConsistency {
  readonly ok: boolean;
  /** The agreed version, or `null` when the sources disagree or none could be read. */
  readonly version: string | null;
  readonly found: ReadonlyMap<VersionSourceName, string | null>;
  /** One line per problem, in a stable order, ready to print. */
  readonly problems: readonly string[];
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const jsonVersion = (raw: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = (parsed as { version?: unknown }).version;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
};

/**
 * The `version` of the `[package]` table only — a naive scan would find
 * `tauri-build = { version = "2" }` under `[build-dependencies]` first.
 */
const cargoPackageVersion = (raw: string): string | null => {
  const lines = raw.split('\n');
  let inPackage = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inPackage = trimmed === '[package]';
      continue;
    }
    if (!inPackage) continue;
    const match = /^version\s*=\s*"([^"]*)"/.exec(trimmed);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
};

/** `v0.1.0` and `0.1.0` are both accepted; anything else is reported rather than coerced. */
const tagVersion = (tag: string): string | null => {
  const stripped = tag.startsWith('v') ? tag.slice(1) : tag;
  return stripped === '' ? null : stripped;
};

/**
 * Checks that every place the version is written agrees, and — when a release tag is given —
 * that the tag names that same version.
 *
 * Three files carry the version (`package.json`, `src-tauri/tauri.conf.json`,
 * `src-tauri/Cargo.toml`) and a mislabelled release is worse than a failed one, so this is a
 * hard gate in CI rather than a warning. Every problem found is reported, not just the first,
 * so one run tells the user everything they have to fix.
 */
export const checkVersionConsistency = (sources: VersionSources): VersionConsistency => {
  const tag = sources.tag ?? null;
  const found = new Map<VersionSourceName, string | null>([
    ['package.json', jsonVersion(sources.packageJson)],
    ['tauri.conf.json', jsonVersion(sources.tauriConf)],
    ['Cargo.toml', cargoPackageVersion(sources.cargoToml)],
    ...(tag === null ? [] : ([['tag', tagVersion(tag)]] as [VersionSourceName, string | null][])),
  ]);

  const problems: string[] = [];
  for (const [name, version] of found) {
    if (version === null) problems.push(`${name}: no version found`);
    else if (!SEMVER.test(version)) problems.push(`${name}: "${version}" is not a semver version`);
  }

  const versions = [...found.values()].filter((value): value is string => value !== null);
  const distinct = [...new Set(versions)];
  if (distinct.length > 1) {
    const detail = [...found].map(([name, version]) => `${name}=${version ?? '?'}`).join(', ');
    problems.push(`versions disagree: ${detail}`);
  }

  const version = problems.length === 0 ? (distinct[0] ?? null) : null;
  return { ok: problems.length === 0 && version !== null, version, found, problems };
};
