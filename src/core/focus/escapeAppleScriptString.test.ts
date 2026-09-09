import { describe, expect, it } from 'vitest';

import { escapeAppleScriptString } from './escapeAppleScriptString';

/** Whether the escaped value can still close its own literal and reach the interpreter. */
const literalStaysClosed = (value: string): boolean => {
  const escaped = escapeAppleScriptString(value);
  let index = 0;
  while (index < escaped.length) {
    if (escaped[index] === '\\') {
      index += 2;
      continue;
    }
    if (escaped[index] === '"') return false;
    index += 1;
  }
  return true;
};

describe('escapeAppleScriptString', () => {
  it('leaves ordinary paths untouched', () => {
    expect(escapeAppleScriptString('/Users/test/my proj-a.b')).toBe('/Users/test/my proj-a.b');
  });

  it('escapes backslashes before quotes so the pair cannot cancel out', () => {
    expect(escapeAppleScriptString('a\\"b')).toBe('a\\\\\\"b');
  });

  it('escapes the whitespace that has no literal form', () => {
    expect(escapeAppleScriptString('a\nb\rc\td')).toBe('a\\nb\\rc\\td');
  });

  it('drops the control characters that have no literal form', () => {
    expect(escapeAppleScriptString('a\u0000b\u0007c\u001bd\u007fe\u009ff')).toBe('abcdef');
  });

  it('drops the Unicode line and paragraph separators', () => {
    expect(escapeAppleScriptString('a\u2028b\u2029c')).toBe('abc');
  });

  it('truncates absurdly long values', () => {
    expect(escapeAppleScriptString('x'.repeat(5_000))).toHaveLength(512);
  });

  it.each([
    '" & (do shell script "touch /tmp/pwned") & "',
    '"; do shell script "id"; --',
    'x\\" & (system attribute "HOME") & \\"',
    '"\ndo shell script "id"\n"',
    '\\\\" & (do shell script "id") & "',
  ])('cannot break out of a literal: %j', (payload) => {
    expect(literalStaysClosed(payload)).toBe(true);
    expect(escapeAppleScriptString(payload)).not.toContain('\n');
  });

  it('handles an empty value', () => {
    expect(escapeAppleScriptString('')).toBe('');
  });
});
