import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseClaudeProcesses } from './parseClaudeProcesses';

const psOutput = readFileSync(
  fileURLToPath(new URL('./__fixtures__/ps-output.txt', import.meta.url)),
  'utf8',
);

describe('parseClaudeProcesses', () => {
  it('finds every flavour of claude CLI invocation in real ps output', () => {
    expect(parseClaudeProcesses(psOutput).map((entry) => entry.pid)).toEqual([411, 412, 700, 810]);
  });

  it('carries pid, ppid and the full command line through', () => {
    const [first] = parseClaudeProcesses(psOutput);
    expect(first).toEqual({ pid: 411, ppid: 310, command: 'claude' });
  });

  it('excludes the Claude desktop app and its helpers', () => {
    // Case matters: `Claude` is the Electron app, `claude` is the CLI.
    const output = [
      '  521     1 /Applications/Claude.app/Contents/MacOS/Claude',
      '  522   521 /Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper --type=renderer',
    ].join('\n');
    expect(parseClaudeProcesses(output)).toEqual([]);
  });

  it('excludes other tools whose names merely start with claude', () => {
    const output = [
      '  610     1 /Applications/Claude Status.app/Contents/Resources/scripts/session-status --daemon',
      '  950   310 claude-monitor --watch',
      '  951   310 /usr/local/bin/claude-status',
    ].join('\n');
    expect(parseClaudeProcesses(output)).toEqual([]);
  });

  it('recognises npm-style invocations run through node', () => {
    const output = '  700   310 node /Users/test/lib/node_modules/@anthropic-ai/claude-code/cli.js';
    expect(parseClaudeProcesses(output).map((entry) => entry.pid)).toEqual([700]);
  });

  it('does not treat an unrelated node process as a session', () => {
    const output = '  701   310 node /Users/test/proj/server.js --port 3000';
    expect(parseClaudeProcesses(output)).toEqual([]);
  });

  it('tolerates a header row, blank lines and empty input', () => {
    expect(parseClaudeProcesses('  PID  PPID COMMAND\n\n')).toEqual([]);
    expect(parseClaudeProcesses('')).toEqual([]);
  });
});
