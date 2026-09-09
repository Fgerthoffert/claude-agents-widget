const MAX_PROMPT_TITLE = 60;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseLine = (line: string): Record<string, unknown> | null => {
  if (line.trim() === '') return null;
  try {
    return asRecord(JSON.parse(line));
  } catch {
    // A transcript's final line is often half-written; skip it rather than lose the file.
    return null;
  }
};

/** Pulls the prompt text out of a `user` record, whose content is a string or a block list. */
const userPromptText = (record: Record<string, unknown>): string | null => {
  // isMeta records are command scaffolding (`<local-command-stdout>`, …), not real prompts.
  if (record['isMeta'] === true || record['isSidechain'] === true) return null;
  const message = asRecord(record['message']);
  if (!message) return null;

  const { content } = message;
  if (typeof content === 'string') return asString(content);
  if (!Array.isArray(content)) return null;

  const textBlock = content
    .map((block) => asRecord(block))
    .find((block) => block?.['type'] === 'text');
  return textBlock ? asString(textBlock['text']) : null;
};

const truncate = (text: string): string => {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= MAX_PROMPT_TITLE
    ? collapsed
    : `${collapsed.slice(0, MAX_PROMPT_TITLE - 1).trimEnd()}…`;
};

/**
 * Derives a session's display title from its transcript JSONL.
 *
 * Verified against real transcripts on this machine: Claude Code does not write `summary`
 * records (as the PRD assumed). It writes standalone `custom-title` (user rename) and
 * `ai-title` (auto-generated) records, re-emitted throughout the file as the title evolves —
 * so the last occurrence of each wins. See ADR-0006.
 *
 * Precedence: user rename, then auto title, then the first real user prompt truncated to 60
 * characters. Returns null when the transcript carries none of the three.
 */
export const extractSessionTitle = (jsonl: string): string | null => {
  let customTitle: string | null = null;
  let aiTitle: string | null = null;
  let firstPrompt: string | null = null;

  for (const line of jsonl.split('\n')) {
    const record = parseLine(line);
    if (!record) continue;

    const type = record['type'];
    if (type === 'custom-title') customTitle = asString(record['customTitle']) ?? customTitle;
    else if (type === 'ai-title') aiTitle = asString(record['aiTitle']) ?? aiTitle;
    else if (type === 'user' && firstPrompt === null) firstPrompt = userPromptText(record);
  }

  const fallback = firstPrompt === null ? null : truncate(firstPrompt);
  return customTitle ?? aiTitle ?? fallback;
};
