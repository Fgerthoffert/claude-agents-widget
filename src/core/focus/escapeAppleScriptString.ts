/** Longest interpolated value we emit; AppleScript literals stay comfortably under any limit. */
const MAX_LENGTH = 512;

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['\\', '\\\\'],
  ['"', '\\"'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

/** C0 and C1 control ranges, plus the Unicode line/paragraph separators. */
const isUnprintable = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  return code === 0x2028 || code === 0x2029;
};

/**
 * Escapes a value for interpolation between the quotes of an AppleScript string literal.
 *
 * This is the focus engine's security boundary (ADR-0007): every value that reaches a script —
 * cwd, window-title fragments, tty paths — is session-derived and therefore untrusted. Closing
 * the literal early is the only way to reach the interpreter, so `"` and `\` are escaped and
 * every other control character is dropped rather than passed through. Callers must never
 * interpolate raw text.
 */
export const escapeAppleScriptString = (value: string): string =>
  value
    .slice(0, MAX_LENGTH)
    .replace(/[\s\S]/gu, (char) => ESCAPES.get(char) ?? (isUnprintable(char) ? '' : char));
