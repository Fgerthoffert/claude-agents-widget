export interface ReleaseNotesInput {
  readonly version: string;
  /** Commit subjects since `previousTag`, newest first, exactly as `git log --format=%s` gives. */
  readonly subjects: readonly string[];
  /** The tag this release follows, or `null` for the first one. */
  readonly previousTag: string | null;
  /** `https://github.com/<owner>/<repo>`, used for the compare link. Omit to leave it out. */
  readonly repoUrl?: string | null;
  /** The asset a reader is expected to download, e.g. `Claude Agents Widget_0.1.0_aarch64.dmg`. */
  readonly dmgName?: string | null;
  /** Whether the build is unsigned, which decides if the Gatekeeper note is included. */
  readonly signed?: boolean;
}

/** Conventional-commit prefixes, in the order their sections appear. */
const SECTIONS = [
  { heading: 'Features', types: ['feat'] },
  { heading: 'Fixes', types: ['fix'] },
  { heading: 'Documentation', types: ['docs'] },
  { heading: 'Performance', types: ['perf'] },
  {
    heading: 'Maintenance',
    types: ['refactor', 'test', 'build', 'ci', 'chore', 'style', 'revert'],
  },
] as const;

interface ParsedCommit {
  readonly type: string | null;
  readonly breaking: boolean;
  /** The subject with its prefix stripped, for a bullet under a section that names the type. */
  readonly summary: string;
  /** The subject as committed, for the "Other" section where no heading explains the prefix. */
  readonly subject: string;
}

/** `type(scope)!: summary`, where everything but `summary` is optional. */
const CONVENTIONAL = /^([a-z]+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

const parseCommit = (raw: string): ParsedCommit => {
  const subject = raw.trim();
  const match = CONVENTIONAL.exec(subject);
  if (match === null) return { type: null, breaking: false, summary: subject, subject };

  const [, type, scope, bang, summary] = match;
  return {
    type: type ?? null,
    breaking: bang === '!',
    summary:
      scope === undefined || scope === '' ? (summary ?? '') : `**${scope}**: ${summary ?? ''}`,
    subject,
  };
};

const bullets = (
  commits: readonly ParsedCommit[],
  field: 'summary' | 'subject' = 'summary',
): readonly string[] => commits.map((commit) => `- ${commit[field]}`);

/**
 * Renders GitHub Release notes from the commit subjects since the previous tag.
 *
 * Deterministic and dependency-free on purpose: a release body is something a human reads
 * months later, and a generator that reorders or reworks text makes the history harder to
 * trust. Commits are bucketed by their conventional-commit prefix in a fixed section order,
 * anything unprefixed lands under "Other", and `!`-marked commits are lifted to the top so a
 * breaking change cannot hide inside a long list.
 *
 * The install section is part of the notes rather than the README's job alone, because an
 * unsigned `.dmg` looks broken on first double-click and the release page is where the user is
 * standing when that happens.
 */
export const buildReleaseNotes = (input: ReleaseNotesInput): string => {
  const commits = input.subjects
    .map((subject) => subject.trim())
    .filter((subject) => subject !== '')
    .map(parseCommit);

  const breaking = commits.filter((commit) => commit.breaking);
  const claimed = new Set<string>(SECTIONS.flatMap((section) => section.types));

  const lines: string[] = [`## Claude Agents Widget ${input.version}`, ''];

  lines.push(
    'macOS on Apple Silicon (`aarch64`). Intel Macs are not built for this release —',
    'see the README for how to build one locally.',
    '',
  );

  lines.push('### Install', '');
  lines.push(
    `1. Download ${input.dmgName === undefined || input.dmgName === null ? 'the `.dmg`' : `\`${input.dmgName}\``} below, open it and drag the app to \`/Applications\`.`,
  );
  if (input.signed === true) {
    lines.push('2. Open it from Launchpad. The build is signed and notarized by Apple.');
  } else {
    lines.push(
      '2. **This build is unsigned**, so a double-click is blocked by Gatekeeper with',
      '   "cannot be opened because the developer cannot be verified". Either right-click the',
      '   app → **Open** → **Open**, or clear the quarantine flag:',
      '',
      '   ```sh',
      "   xattr -dr com.apple.quarantine '/Applications/Claude Agents Widget.app'",
      '   ```',
    );
  }
  lines.push(
    '3. Open the panel and work through **Setup** — it installs the Claude Code hooks (with',
    '   your confirmation) and links to the macOS permissions click-to-focus needs.',
    '',
  );

  if (breaking.length > 0) {
    lines.push('### Breaking changes', '', ...bullets(breaking), '');
  }

  for (const section of SECTIONS) {
    const matching = commits.filter(
      (commit) =>
        !commit.breaking &&
        commit.type !== null &&
        (section.types as readonly string[]).includes(commit.type),
    );
    if (matching.length > 0) lines.push(`### ${section.heading}`, '', ...bullets(matching), '');
  }

  const other = commits.filter(
    (commit) => !commit.breaking && (commit.type === null || !claimed.has(commit.type)),
  );
  if (other.length > 0) lines.push('### Other', '', ...bullets(other, 'subject'), '');

  if (commits.length === 0) lines.push('_No commits found since the previous tag._', '');

  if (input.repoUrl !== undefined && input.repoUrl !== null && input.repoUrl !== '') {
    const tag = `v${input.version}`;
    lines.push(
      input.previousTag === null
        ? `**Full history**: ${input.repoUrl}/commits/${tag}`
        : `**Full changelog**: ${input.repoUrl}/compare/${input.previousTag}...${tag}`,
      '',
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
};
