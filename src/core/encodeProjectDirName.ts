const MAX_LENGTH = 200;

/** Java-style 32-bit string hash: `h = h * 31 + charCode`, matching Claude Code's own. */
const hashPath = (path: string): string => {
  let hash = 0;
  for (let index = 0; index < path.length; index += 1) {
    hash = ((hash << 5) - hash + path.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Encodes a working directory into its `~/.claude/projects/<dir>` name.
 *
 * Verified against the shipped Claude Code CLI (2.1.236) and the real transcript directories
 * on this machine: every non-alphanumeric character becomes `-`, and an encoded name longer
 * than 200 characters is truncated and given a hash suffix.
 *
 * Deliberately one-way. The encoding is lossy — `/a/b-c` and `/a-b/c` collide — so the app
 * always encodes a known cwd and never tries to decode a directory name back into a path.
 */
export const encodeProjectDirName = (cwd: string): string => {
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-');
  return encoded.length <= MAX_LENGTH
    ? encoded
    : `${encoded.slice(0, MAX_LENGTH)}-${hashPath(cwd)}`;
};
