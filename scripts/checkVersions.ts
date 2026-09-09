// Fails the build when the version is not written identically everywhere, and — with `--tag` —
// when a release tag does not name that version. Run via `npm run check-versions`.
//
// A mislabelled release is worse than a failed one, so this is a gate rather than a warning.
// The parsing and comparison live in the tested pure `checkVersionConsistency`; this file is the
// IO shell around it (see ADR-0006 for the same split in the hook installer).

import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { checkVersionConsistency } from '../src/core/checkVersionConsistency.ts';
import { isPrereleaseVersion } from '../src/core/isPrereleaseVersion.ts';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const out = (line: string): void => void process.stdout.write(`${line}\n`);

const flagValue = (name: string): string | null => {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value === undefined || value.startsWith('--') || value === '' ? null : value;
};

const read = (...parts: string[]): string => readFileSync(join(repoRoot, ...parts), 'utf8');

const tag = flagValue('--tag');
const result = checkVersionConsistency({
  packageJson: read('package.json'),
  tauriConf: read('src-tauri', 'tauri.conf.json'),
  cargoToml: read('src-tauri', 'Cargo.toml'),
  tag,
});

for (const [name, version] of result.found) out(`${name.padEnd(16)} ${version ?? '(none)'}`);

if (!result.ok || result.version === null) {
  process.stderr.write(
    `\nVersion check failed:\n${result.problems.map((p) => `  - ${p}`).join('\n')}\n`,
  );
  process.exit(1);
}

const prerelease = isPrereleaseVersion(result.version);
out(`\nOK — version ${result.version}${prerelease ? ' (pre-release)' : ''}`);

// Consumed by the release workflow, which needs the version and the pre-release flag.
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput !== undefined && githubOutput !== '') {
  appendFileSync(
    githubOutput,
    `version=${result.version}\nprerelease=${String(prerelease)}\ntag=v${result.version}\n`,
  );
}
