/**
 * The version out of `claude --version`, or `null` when the output is not one.
 *
 * The command prints `2.1.236 (Claude Code)` — the version first, then the product in
 * parentheses. Only the leading dotted number is taken, so a suffix Anthropic adds later
 * (`2.2.0-beta.1 (Claude Code)`, a different product name) still yields something to show. A
 * line that does not start with a version yields `null` rather than a guess, because the footer
 * would rather say nothing than say something wrong about somebody else's software.
 */
export const parseClaudeVersion = (output: string): string | null =>
  /^\s*v?(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)/.exec(output)?.[1] ?? null;
