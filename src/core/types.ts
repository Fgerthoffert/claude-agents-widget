// The one multi-export module in src/core (see CLAUDE.md): shared shapes, no behaviour.

/** PRD state model. `ended` sessions linger briefly in the store, then expire. */
export type SessionState = 'working' | 'needs_input' | 'done_idle' | 'ended';

/** Which detection source produced a session — hooks are authoritative (ADR-0003). */
export type SessionSource = 'hook' | 'scanner';

/**
 * One link in a session's parent-process chain, captured verbatim by the hook script.
 * The focus engine (phase 4) reads `comm`/`args` to identify the owning terminal or IDE.
 * `comm` is the executable path truncated by `ps` (16 chars on macOS), so prefer `args`
 * when matching and treat `comm` as a hint.
 */
export interface Ancestor {
  readonly pid: number;
  readonly comm: string;
  readonly args: string;
}

/** A `~/.claude-agents-widget/sessions/<id>.json` file as written by the hook script. */
export interface SessionRecord {
  readonly sessionId: string;
  readonly cwd: string | null;
  readonly transcriptPath: string | null;
  readonly state: SessionState;
  readonly lastEvent: string | null;
  /** Notification matcher, e.g. `permission_prompt` or `idle_prompt`. */
  readonly notificationType: string | null;
  /** Human-readable notification text, when the Claude Code build supplies one. */
  readonly notificationMessage: string | null;
  readonly endReason: string | null;
  readonly agentId: string | null;
  readonly agentType: string | null;
  /** ISO-8601 UTC. */
  readonly updatedAt: string;
  readonly hookPid: number | null;
  /** PID of the owning `claude` CLI process — the liveness signal for this session. */
  readonly claudePid: number | null;
  readonly ancestors: readonly Ancestor[];
}

/** A row of `ps -axo pid=,ppid=,command=`. */
export interface ProcessEntry {
  readonly pid: number;
  readonly ppid: number;
  readonly command: string;
}

/** A running `claude` CLI process the scanner found, enriched by the imperative shell. */
export interface ScannedSession {
  readonly sessionId: string;
  readonly cwd: string | null;
  readonly transcriptPath: string | null;
  readonly claudePid: number;
  /** Transcript mtime in epoch ms; recent appends mean the agent is working. */
  readonly transcriptMtimeMs: number | null;
}

/** A transcript file found in a `~/.claude/projects/<dir>` directory. */
export interface TranscriptFile {
  /** The file's basename without `.jsonl`, which is the session id. */
  readonly sessionId: string;
  readonly path: string;
  readonly mtimeMs: number;
}

/** What the scanner gathered before the pure matcher turns it into sessions. */
export interface MatchScannedSessionsInput {
  readonly processes: readonly ProcessEntry[];
  /** Process cwds, from `lsof`; a pid may be missing if lsof could not inspect it. */
  readonly cwdByPid: ReadonlyMap<number, string>;
  /** Encoded project directory name -> the transcripts it contains. */
  readonly transcriptsByDir: ReadonlyMap<string, readonly TranscriptFile[]>;
}

/** Everything the reconciler needs. Pure in, pure out — no clocks, no IO. */
export interface ReconcileInput {
  readonly hookRecords: readonly SessionRecord[];
  readonly scanned: readonly ScannedSession[];
  /**
   * PIDs observed alive. An empty array means the scan ran and found no `claude` process —
   * evidence that sessions have ended. `null` means the scan itself failed, which is not
   * evidence of anything and must never expire a record.
   */
  readonly livePids: readonly number[] | null;
  /** Session id -> title, extracted from transcripts by the caller. */
  readonly titles: ReadonlyMap<string, string>;
  readonly nowMs: number;
}

/** What the session store exposes to the UI (phase 3) and focus engine (phase 4). */
export interface Session {
  readonly sessionId: string;
  readonly title: string | null;
  readonly cwd: string | null;
  readonly transcriptPath: string | null;
  readonly state: SessionState;
  readonly source: SessionSource;
  readonly notificationType: string | null;
  readonly notificationMessage: string | null;
  readonly updatedAt: string;
  readonly claudePid: number | null;
  readonly ancestors: readonly Ancestor[];
}

/** A `hooks.<Event>[].hooks[]` entry in `~/.claude/settings.json`. */
export interface HookHandler {
  readonly type: string;
  readonly command?: string;
  readonly [key: string]: unknown;
}

/** A `hooks.<Event>[]` entry: an optional matcher plus the handlers it triggers. */
export interface HookMatcherGroup {
  readonly matcher?: string;
  readonly hooks?: readonly HookHandler[];
  readonly [key: string]: unknown;
}

/** `~/.claude/settings.json`, of which we understand only `hooks`. */
export interface ClaudeSettings {
  readonly hooks?: Readonly<Record<string, readonly HookMatcherGroup[]>>;
  readonly [key: string]: unknown;
}
