import { describe, expect, it } from 'vitest';

import { interpretFocusAttempt } from './interpretFocusAttempt';
import type { FocusRunOutcome, FocusStep } from './types';

const SCRIPT_STEP: FocusStep = {
  command: 'osascript',
  args: ['-e', '-- claude-agents-widget focus'],
  method: 'window',
  degraded: false,
  success: 'marker',
};

const APP_STEP: FocusStep = {
  command: 'open-bundle',
  args: ['-b', 'com.microsoft.VSCode'],
  method: 'app',
  degraded: true,
  success: 'exit',
};

const interpret = (step: FocusStep, outcome: Partial<FocusRunOutcome>) =>
  interpretFocusAttempt({
    host: 'vscode',
    step,
    outcome: { code: 0, stdout: '', stderr: '', ...outcome },
  });

describe('interpretFocusAttempt', () => {
  it('trusts the marker the script echoed over the method the step claimed', () => {
    expect(interpret(SCRIPT_STEP, { stdout: 'window\n' })).toEqual({
      ok: true,
      host: 'vscode',
      method: 'window',
      degradedFrom: null,
      detail: null,
    });
    expect(interpret({ ...SCRIPT_STEP, method: 'window' }, { stdout: 'tab' })).toMatchObject({
      ok: true,
      method: 'tab',
    });
  });

  it('reads "none" as a ran-but-matched-nothing, not a failure of the script', () => {
    expect(interpret(SCRIPT_STEP, { stdout: 'none\n' })).toEqual({
      ok: false,
      host: 'vscode',
      reason: 'window-not-found',
      detail: null,
    });
  });

  it('treats unexpected stdout as no match rather than guessing', () => {
    expect(interpret(SCRIPT_STEP, { stdout: 'missing value' })).toMatchObject({
      reason: 'window-not-found',
    });
  });

  it('accepts a bare zero exit for a step that has no marker to echo', () => {
    expect(interpret(APP_STEP, { stdout: '' })).toMatchObject({ ok: true, method: 'app' });
  });

  it('reports a missing Accessibility grant distinctly, for the first-run guide', () => {
    // The exact stderr osascript produced on the owner's machine before consent was granted.
    const stderr =
      'execution error: System Events got an error: osascript is not allowed assistive access. (-1728)';
    expect(interpret(SCRIPT_STEP, { code: 1, stderr })).toMatchObject({
      ok: false,
      reason: 'permission-denied',
    });
  });

  it('reports a missing Automation grant as the same permission problem', () => {
    expect(
      interpret(SCRIPT_STEP, {
        code: 1,
        stderr:
          'execution error: Not authorized to send Apple events to Visual Studio Code. (-1743)',
      }),
    ).toMatchObject({ reason: 'permission-denied' });
  });

  it('does not read every -1728 as a permission problem', () => {
    // -1728 is also the generic "can't get that object" error.
    expect(
      interpret(SCRIPT_STEP, {
        code: 1,
        stderr: 'execution error: Visual Studio Code got an error: Can’t get window 1. (-1728)',
      }),
    ).toMatchObject({ reason: 'script-failed' });
  });

  it('reports a timeout, which the runner signals as a null exit code', () => {
    expect(interpret(SCRIPT_STEP, { code: null, stderr: 'osascript timed out' })).toMatchObject({
      ok: false,
      reason: 'timeout',
    });
  });

  it('carries a trimmed, bounded stderr as detail for the UI', () => {
    const result = interpret(SCRIPT_STEP, { code: 1, stderr: `  ${'x'.repeat(900)}  ` });
    expect(result.ok).toBe(false);
    expect(result.detail).toHaveLength(400);
  });

  it('reports no detail when the command said nothing', () => {
    expect(interpret(SCRIPT_STEP, { code: 2, stderr: '   ' }).detail).toBeNull();
  });
});
