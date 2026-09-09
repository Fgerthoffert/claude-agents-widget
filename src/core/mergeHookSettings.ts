import type { ClaudeSettings, HookMatcherGroup } from './types';

/** The events the widget needs to track the PRD state model. */
const WIDGET_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'Stop',
  'Notification',
  'SessionEnd',
] as const;

export interface MergeHookSettingsResult {
  /** Settings to write, or null when nothing needs changing. */
  readonly settings: ClaudeSettings | null;
  /** Events this merge would add the widget hook to. */
  readonly added: readonly string[];
  /** Events that already had it. */
  readonly unchanged: readonly string[];
}

const isOurs = (group: HookMatcherGroup, hookPath: string): boolean =>
  (group.hooks ?? []).some(
    (handler) => typeof handler.command === 'string' && handler.command.includes(hookPath),
  );

/**
 * Idempotently adds the widget's hook to a parsed `~/.claude/settings.json`.
 *
 * Never rewrites, reorders or removes anything else: existing groups are carried through
 * untouched and ours is appended only to events that do not already reference `hookPath`.
 * Identity is the hook path, so re-running after an upgrade is a no-op. Returns
 * `settings: null` when every event is already wired up, which lets the caller skip the write
 * (and the backup) entirely.
 *
 * The caller owns parsing: malformed JSON must be refused before reaching this function, so
 * that a user's settings can never be clobbered by a failed parse.
 */
export const mergeHookSettings = (
  settings: ClaudeSettings,
  hookPath: string,
): MergeHookSettingsResult => {
  const existingHooks = settings.hooks ?? {};
  const added: string[] = [];
  const unchanged: string[] = [];

  const ourGroup: HookMatcherGroup = {
    hooks: [{ type: 'command', command: `node ${hookPath}` }],
  };

  const merged = Object.fromEntries(
    WIDGET_EVENTS.map((event) => {
      const groups = existingHooks[event] ?? [];
      if (groups.some((group) => isOurs(group, hookPath))) {
        unchanged.push(event);
        return [event, groups];
      }
      added.push(event);
      return [event, [...groups, ourGroup]];
    }),
  );

  if (added.length === 0) return { settings: null, added, unchanged };

  return {
    settings: { ...settings, hooks: { ...existingHooks, ...merged } },
    added,
    unchanged,
  };
};
