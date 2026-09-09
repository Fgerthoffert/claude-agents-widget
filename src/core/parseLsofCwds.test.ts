import { describe, expect, it } from 'vitest';

import { parseLsofCwds } from './parseLsofCwds';

describe('parseLsofCwds', () => {
  it('reads one process block', () => {
    const output = 'p411\nfcwd\nn/Users/test/proj\n';
    expect([...parseLsofCwds(output)]).toEqual([[411, '/Users/test/proj']]);
  });

  it('reads several process blocks in one invocation', () => {
    const output = ['p411', 'fcwd', 'n/Users/test/a', 'p412', 'fcwd', 'n/Users/test/b'].join('\n');
    expect([...parseLsofCwds(output)]).toEqual([
      [411, '/Users/test/a'],
      [412, '/Users/test/b'],
    ]);
  });

  it('keeps paths containing spaces intact', () => {
    const output = 'p411\nfcwd\nn/Users/test/My Projects/app\n';
    expect(parseLsofCwds(output).get(411)).toBe('/Users/test/My Projects/app');
  });

  it('keeps the first cwd when a block somehow lists more than one', () => {
    const output = 'p411\nfcwd\nn/Users/test/first\nn/Users/test/second\n';
    expect(parseLsofCwds(output).get(411)).toBe('/Users/test/first');
  });

  it('omits processes lsof could not inspect', () => {
    const output = 'p411\nfcwd\np412\nfcwd\nn/Users/test/b\n';
    expect([...parseLsofCwds(output)]).toEqual([[412, '/Users/test/b']]);
  });

  it('ignores a name that arrives before any process block', () => {
    expect(parseLsofCwds('n/Users/test/orphan\n').size).toBe(0);
  });

  it('ignores unparseable pids and empty paths', () => {
    expect(parseLsofCwds('pnope\nfcwd\nn/Users/test/x\n').size).toBe(0);
    expect(parseLsofCwds('p0\nfcwd\nn/Users/test/x\n').size).toBe(0);
    expect(parseLsofCwds('p411\nfcwd\nn\n').size).toBe(0);
  });

  it('returns an empty map for empty output', () => {
    expect(parseLsofCwds('').size).toBe(0);
  });
});
