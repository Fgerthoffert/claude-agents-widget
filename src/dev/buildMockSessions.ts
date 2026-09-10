import { settleSession } from '../core/settleSession';
import type { Session } from '../core/types';

/** Preview scenarios, chosen to cover the judgement calls the panel design has to survive. */
export type MockScenario = 'typical' | 'busy' | 'quiet' | 'blocked' | 'empty';

interface Seed {
  /** `null` is the cleared / never-used case: Claude Code has generated no name (ADR-0019). */
  readonly title: string | null;
  readonly cwd: string;
  /** What Claude Code reported. `dormant` is never seeded — it is derived, like in the app. */
  readonly state: Session['state'];
  /** Seconds spent in the current state. */
  readonly ageSeconds: number;
  /** Claude Code's own phrase for why a blocked session is blocked. */
  readonly waitingFor?: string;
  readonly kind?: Session['kind'];
}

const seeds: Readonly<Record<Exclude<MockScenario, 'empty'>, readonly Seed[]>> = {
  typical: [
    {
      title: 'Fix flaky checkout test',
      cwd: '/Users/you/GitHub/storefront',
      state: 'needs_input',
      ageSeconds: 42,
      waitingFor: 'permission prompt',
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
    },
    {
      title: 'Write ADR for event bus',
      cwd: '/Users/you/Documents/notes',
      state: 'done_idle',
      ageSeconds: 640,
    },
    {
      title: null,
      cwd: '/Users/you/GitHub/scratch-pad',
      state: 'done_idle',
      ageSeconds: 40,
    },
    {
      title: 'Bump the Rust toolchain',
      cwd: '/Users/you/GitHub/toolchain',
      state: 'done_idle',
      ageSeconds: 4 * 60 * 60,
    },
  ],
  busy: [
    {
      title: 'Investigate prod 500s on /orders',
      cwd: '/Users/you/GitHub/storefront',
      state: 'needs_input',
      ageSeconds: 128,
      waitingFor: 'permission prompt',
    },
    {
      title: 'Rename UserService to AccountService across the monorepo',
      cwd: '/Users/you/GitHub/platform-monorepo/packages/accounts',
      state: 'needs_input',
      ageSeconds: 17,
      waitingFor: 'agent needs input',
    },
    {
      title: 'Add OpenTelemetry spans',
      cwd: '/Users/you/GitHub/api-gateway',
      state: 'needs_input',
      ageSeconds: 903,
      waitingFor: 'agent needs input',
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
      waitingFor: 'permission prompt',
    },
  ],
};

/**
 * Fake sessions for the UI preview, shaped exactly like the store's output and already in the
 * store's order, so the preview shows the row sequence the real panel would.
 */
export const buildMockSessions = (scenario: MockScenario, nowMs: number): readonly Session[] => {
  if (scenario === 'empty') return [];

  return seeds[scenario].map((seed, index) => {
    const stateSince = nowMs - seed.ageSeconds * 1000;

    return {
      sessionId: `preview-${scenario}-${String(index)}`,
      title: seed.title,
      cwd: seed.cwd,
      // Through the real rule, not hard-coded: a seed says what Claude Code reported, and
      // whether that settles into `dormant` is `settleSession`'s call, exactly as in the app
      // (ADR-0019). Setting the state directly is how the harness came to show a four-hour-old
      // session under "Done".
      state: settleSession({
        state: seed.state,
        title: seed.title,
        heldMs: nowMs - stateSince,
      }),
      kind: seed.kind ?? 'interactive',
      waitingFor: seed.waitingFor ?? null,
      claudePid: 4300 + index,
      startedAtMs: nowMs - (seed.ageSeconds + 600) * 1000,
      stateSince,
    };
  });
};
