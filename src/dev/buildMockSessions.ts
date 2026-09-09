import type { Session } from '../core/types';

/** Preview scenarios, chosen to cover the judgement calls the panel design has to survive. */
export type MockScenario = 'typical' | 'busy' | 'quiet' | 'blocked' | 'empty';

interface Seed {
  readonly title: string | null;
  readonly cwd: string;
  readonly state: Session['state'];
  /** Seconds spent in the current state. */
  readonly ageSeconds: number;
  readonly notificationType?: string;
  readonly notificationMessage?: string;
  readonly source?: Session['source'];
}

const vscode = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const iterm = '/Applications/iTerm.app/Contents/MacOS/iTerm2';

const host = (app: string, path: string): Session['ancestors'] => [
  { pid: 4321, comm: '/bin/zsh', args: '-zsh' },
  { pid: 4300, comm: 'claude', args: `claude ${path}` },
  { pid: 4100, comm: app, args: app },
];

const seeds: Readonly<Record<Exclude<MockScenario, 'empty'>, readonly Seed[]>> = {
  typical: [
    {
      title: 'Fix flaky checkout test',
      cwd: '/Users/you/GitHub/storefront',
      state: 'needs_input',
      ageSeconds: 42,
      notificationType: 'permission_prompt',
      notificationMessage: 'Claude needs permission to run `npm run migrate`',
    },
    {
      title: 'Migrate billing to Stripe v3',
      cwd: '/Users/you/GitHub/payments',
      state: 'working',
      ageSeconds: 315,
    },
    {
      title: 'Refactor auth middleware',
      cwd: '/Users/you/GitHub/api-gateway',
      state: 'working',
      ageSeconds: 78,
    },
    {
      title: null,
      cwd: '/Users/you/GitHub/infra-scripts',
      state: 'working',
      ageSeconds: 9,
      source: 'scanner',
    },
    {
      title: 'Write ADR for event bus',
      cwd: '/Users/you/Documents/notes',
      state: 'done_idle',
      ageSeconds: 640,
    },
  ],
  busy: [
    {
      title: 'Investigate prod 500s on /orders',
      cwd: '/Users/you/GitHub/storefront',
      state: 'needs_input',
      ageSeconds: 128,
      notificationType: 'permission_prompt',
      notificationMessage: 'Claude needs permission to read production logs',
    },
    {
      title: 'Rename UserService to AccountService across the monorepo',
      cwd: '/Users/you/GitHub/platform-monorepo/packages/accounts',
      state: 'needs_input',
      ageSeconds: 17,
      notificationType: 'idle_prompt',
    },
    {
      title: 'Add OpenTelemetry spans',
      cwd: '/Users/you/GitHub/api-gateway',
      state: 'needs_input',
      ageSeconds: 903,
      notificationType: 'agent_needs_input',
    },
    {
      title: 'Port CI to reusable workflows',
      cwd: '/Users/you/GitHub/ci-templates',
      state: 'working',
      ageSeconds: 61,
    },
    {
      title: 'Migrate billing to Stripe v3',
      cwd: '/Users/you/GitHub/payments',
      state: 'working',
      ageSeconds: 224,
    },
    {
      title: 'Draft Q3 architecture review',
      cwd: '/Users/you/Documents/reviews',
      state: 'working',
      ageSeconds: 1450,
    },
    {
      title: 'Reproduce the Safari upload bug',
      cwd: '/Users/you/GitHub/web-uploader',
      state: 'working',
      ageSeconds: 33,
    },
    {
      title: null,
      cwd: '/Users/you/GitHub/infra-scripts',
      state: 'working',
      ageSeconds: 5,
      source: 'scanner',
    },
    {
      title: 'Tune Postgres indexes',
      cwd: '/Users/you/GitHub/analytics',
      state: 'done_idle',
      ageSeconds: 210,
    },
    {
      title: 'Update onboarding docs',
      cwd: '/Users/you/GitHub/handbook',
      state: 'done_idle',
      ageSeconds: 1880,
    },
    {
      title: 'Spike: replace Redis with SQLite',
      cwd: '/Users/you/GitHub/experiments/cache-spike',
      state: 'done_idle',
      ageSeconds: 4300,
    },
  ],
  quiet: [
    {
      title: 'Migrate billing to Stripe v3',
      cwd: '/Users/you/GitHub/payments',
      state: 'working',
      ageSeconds: 88,
    },
    {
      title: 'Write ADR for event bus',
      cwd: '/Users/you/Documents/notes',
      state: 'done_idle',
      ageSeconds: 512,
    },
  ],
  blocked: [
    {
      title: 'Fix flaky checkout test',
      cwd: '/Users/you/GitHub/storefront',
      state: 'needs_input',
      ageSeconds: 214,
      notificationType: 'permission_prompt',
      notificationMessage: 'Claude needs permission to run `git push --force-with-lease`',
    },
  ],
};

/**
 * Fake sessions for the UI preview, shaped exactly like the store's output and already in the
 * store's order, so the preview shows the row sequence the real panel would.
 */
export const buildMockSessions = (scenario: MockScenario, nowMs: number): readonly Session[] => {
  if (scenario === 'empty') return [];

  return seeds[scenario].map((seed, index) => ({
    sessionId: `preview-${scenario}-${String(index)}`,
    title: seed.title,
    cwd: seed.cwd,
    transcriptPath: `/Users/you/.claude/projects/encoded/preview-${String(index)}.jsonl`,
    state: seed.state,
    source: seed.source ?? 'hook',
    notificationType: seed.notificationType ?? null,
    notificationMessage: seed.notificationMessage ?? null,
    updatedAt: new Date(nowMs - seed.ageSeconds * 1000).toISOString(),
    claudePid: 4300 + index,
    ancestors: host(index % 3 === 0 ? vscode : iterm, seed.cwd),
  }));
};
