// Prints GitHub Release notes for a tag to stdout. Run via `npm run release-notes -- --tag v0.1.0`.
//
// The grouping lives in the tested pure `buildReleaseNotes`; this file only asks git for the
// commit subjects since the previous tag and decides where the repository URL comes from.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildReleaseNotes } from '../src/core/buildReleaseNotes.ts';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const flagValue = (name: string): string | null => {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value === undefined || value.startsWith('--') || value === '' ? null : value;
};

/**
 * git is allowed to fail: no previous tag and a shallow clone are both normal, and `describe`
 * says so on stderr, which is silenced so a CI log does not read like an error.
 */
const git = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const packageVersion = ((): string => {
  const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== 'string') throw new Error('package.json has no version');
  return version;
})();

const tag = flagValue('--tag') ?? `v${packageVersion}`;
const version = tag.startsWith('v') ? tag.slice(1) : tag;

// `<tag>^` so the tag itself is not its own predecessor; falls back to the whole history.
const previousTag = git('describe', '--tags', '--abbrev=0', `${tag}^`);
const range = previousTag === null ? tag : `${previousTag}..${tag}`;
const log = git('log', '--no-merges', '--format=%s', range) ?? '';

const repoUrl = ((): string | null => {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
  if (GITHUB_SERVER_URL !== undefined && GITHUB_REPOSITORY !== undefined) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
  }
  const remote = git('remote', 'get-url', 'origin');
  if (remote === null) return null;
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote);
  return match?.[1] === undefined ? null : `https://github.com/${match[1]}`;
})();

process.stdout.write(
  buildReleaseNotes({
    version,
    subjects: log.split('\n'),
    previousTag,
    repoUrl,
    dmgName: `Claude Agents Widget_${version}_aarch64.dmg`,
    signed: process.argv.slice(2).includes('--signed'),
  }),
);
