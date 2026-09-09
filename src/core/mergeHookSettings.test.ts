import { describe, expect, it } from 'vitest';

import { mergeHookSettings } from './mergeHookSettings';
import type { ClaudeSettings } from './types';

const HOOK_PATH = '/Users/test/.claude-agents-widget/hook.mjs';
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'Notification', 'SessionEnd'];

const merge = (settings: ClaudeSettings) => mergeHookSettings(settings, HOOK_PATH);

const ourEntry = { hooks: [{ type: 'command', command: `node ${HOOK_PATH}` }] };

// Shaped after a real settings.json: other people's hooks, an empty event array, and
// unrelated top-level keys that must survive untouched.
const populated: ClaudeSettings = {
  theme: 'dark',
  model: 'opus',
  hooks: {
    PreToolUse: [],
    SessionStart: [
      { hooks: [{ type: 'command', command: 'python3', args: ['/Users/test/.claude/other.py'] }] },
    ],
    UserPromptSubmit: [
      {
        hooks: [
          { type: 'command', command: 'python3', args: ['/Users/test/.claude/other.py'], timeout: 25 },
        ],
      },
    ],
  },
};

describe('mergeHookSettings', () => {
  it('adds all five events to empty settings', () => {
    const result = merge({});

    expect(result.added).toEqual(EVENTS);
    expect(result.unchanged).toEqual([]);
    expect(Object.keys(result.settings?.hooks ?? {})).toEqual(EVENTS);
    expect(result.settings?.hooks?.['Stop']).toEqual([ourEntry]);
  });

  it('registers the command as `node <hookPath>`, since the payload arrives on stdin', () => {
    const [group] = merge({}).settings?.hooks?.['SessionStart'] ?? [];
    expect(group?.hooks).toEqual([{ type: 'command', command: `node ${HOOK_PATH}` }]);
    expect(group?.matcher).toBeUndefined();
  });

  it('appends alongside existing hooks instead of replacing them', () => {
    const result = merge(populated);
    const sessionStart = result.settings?.hooks?.['SessionStart'] ?? [];

    expect(sessionStart).toHaveLength(2);
    expect(sessionStart[0]).toEqual(populated.hooks?.['SessionStart']?.[0]);
    expect(sessionStart[1]).toEqual(ourEntry);
  });

  it('leaves other events and top-level keys alone', () => {
    const result = merge(populated);

    expect(result.settings?.hooks?.['PreToolUse']).toEqual([]);
    expect(result.settings?.['theme']).toBe('dark');
    expect(result.settings?.['model']).toBe('opus');
  });

  it('is a no-op when every event already references our hook', () => {
    const installed = merge({}).settings;
    const second = merge(installed ?? {});

    expect(second.settings).toBeNull();
    expect(second.added).toEqual([]);
    expect(second.unchanged).toEqual(EVENTS);
  });

  it('fills in only the events that are missing', () => {
    const partial: ClaudeSettings = {
      hooks: { Stop: [ourEntry], Notification: [ourEntry] },
    };
    const result = merge(partial);

    expect(result.unchanged).toEqual(['Stop', 'Notification']);
    expect(result.added).toEqual(['SessionStart', 'UserPromptSubmit', 'SessionEnd']);
    expect(result.settings?.hooks?.['Stop']).toEqual([ourEntry]);
  });

  it('recognises our hook by path, so an upgraded command string is still ours', () => {
    const older: ClaudeSettings = {
      hooks: Object.fromEntries(
        EVENTS.map((event) => [
          event,
          [{ hooks: [{ type: 'command', command: `/usr/bin/node ${HOOK_PATH} --verbose` }] }],
        ]),
      ),
    };

    expect(merge(older).settings).toBeNull();
  });

  it('does not mistake a similarly named hook for ours', () => {
    const other: ClaudeSettings = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'node /Users/test/other-widget/hook.mjs' }] }],
      },
    };

    expect(merge(other).added).toContain('Stop');
    expect(merge(other).settings?.hooks?.['Stop']).toHaveLength(2);
  });

  it('tolerates groups with no hooks array', () => {
    const odd: ClaudeSettings = { hooks: { Stop: [{ matcher: 'startup' }] } };
    const result = merge(odd);

    expect(result.added).toContain('Stop');
    expect(result.settings?.hooks?.['Stop']).toEqual([{ matcher: 'startup' }, ourEntry]);
  });

  it('does not mutate the settings it was given', () => {
    const snapshot = structuredClone(populated);
    merge(populated);
    expect(populated).toEqual(snapshot);
  });
});
