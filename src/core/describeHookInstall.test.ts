import { describe, expect, it } from 'vitest';

import { describeHookInstall } from './describeHookInstall';
import type { HookInstallReport } from './describeHookInstall';

const report = (overrides: Partial<HookInstallReport> = {}): HookInstallReport => ({
  ok: true,
  added: [],
  alreadyPresent: [],
  backedUp: false,
  reason: null,
  detail: null,
  ...overrides,
});

describe('describeHookInstall', () => {
  it('counts what it registered and warns that running sessions need a restart', () => {
    const text = describeHookInstall(report({ added: ['SessionStart', 'Stop'], backedUp: true }));

    expect(text).toContain('2 event(s) registered');
    expect(text).toContain('backup of settings.json');
    expect(text).toContain('restart any running agents');
  });

  it('omits the backup sentence when no backup was needed', () => {
    expect(describeHookInstall(report({ added: ['Stop'] }))).not.toContain('backup');
  });

  it('says so when there was nothing to do', () => {
    expect(describeHookInstall(report())).toContain('Already installed');
  });

  it('repeats the refusal detail for an unreadable settings file', () => {
    const text = describeHookInstall(
      report({ ok: false, reason: 'settings-unreadable', detail: '/x/settings.json is not JSON' }),
    );

    expect(text).toContain('Nothing was changed');
    expect(text).toContain('/x/settings.json is not JSON');
  });

  it('calls a missing bundled script a bug rather than blaming the user', () => {
    const text = describeHookInstall(report({ ok: false, reason: 'hook-resource-missing' }));

    expect(text).toContain('report this as a bug');
  });

  it('explains that the browser preview cannot install anything', () => {
    expect(describeHookInstall(report({ ok: false, reason: 'not-available' }))).toContain(
      'browser preview',
    );
  });

  it('surfaces the raw error for any other failure', () => {
    const text = describeHookInstall(
      report({ ok: false, reason: 'write-failed', detail: 'EACCES' }),
    );

    expect(text).toContain('Install failed: EACCES');
  });
});
