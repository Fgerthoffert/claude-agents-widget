import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { extractSessionTitle } from './extractSessionTitle';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');

describe('extractSessionTitle', () => {
  it('takes the last ai-title, since Claude Code re-emits it as the title evolves', () => {
    expect(extractSessionTitle(fixture('transcript-titled.jsonl'))).toBe(
      'Session list widget with state badges',
    );
  });

  it('prefers a user rename over the generated title', () => {
    expect(extractSessionTitle(fixture('transcript-renamed.jsonl'))).toBe(
      'Detection core (phase 2)',
    );
  });

  it('falls back to the first real user prompt, truncated to 60 characters', () => {
    const title = extractSessionTitle(fixture('transcript-untitled.jsonl'));
    expect(title).toBe('Please investigate why the always-on-top panel loses its po…');
    // The ellipsis is part of the budget, so a truncated title is never wider than 60.
    expect(title).toHaveLength(60);
  });

  it('skips isMeta scaffolding when picking the fallback prompt', () => {
    const jsonl = [
      '{"type":"user","isMeta":true,"message":{"role":"user","content":"<local-command-stdout>x</local-command-stdout>"}}',
      '{"type":"user","message":{"role":"user","content":"the real question"}}',
    ].join('\n');
    expect(extractSessionTitle(jsonl)).toBe('the real question');
  });

  it('skips sidechain prompts, which belong to subagents', () => {
    const jsonl = [
      '{"type":"user","isSidechain":true,"message":{"role":"user","content":"subagent task"}}',
      '{"type":"user","message":{"role":"user","content":"main thread question"}}',
    ].join('\n');
    expect(extractSessionTitle(jsonl)).toBe('main thread question');
  });

  it('ignores tool_result content, which is not a prompt', () => {
    const jsonl =
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"ok"}]}}';
    expect(extractSessionTitle(jsonl)).toBeNull();
  });

  it('collapses newlines and runs of whitespace in a fallback title', () => {
    const jsonl = '{"type":"user","message":{"role":"user","content":"first line\\n\\n  second"}}';
    expect(extractSessionTitle(jsonl)).toBe('first line second');
  });

  it('keeps a prompt of exactly 60 characters intact', () => {
    const prompt = 'x'.repeat(60);
    const jsonl = `{"type":"user","message":{"role":"user","content":"${prompt}"}}`;
    expect(extractSessionTitle(jsonl)).toBe(prompt);
  });

  it('survives a half-written final line', () => {
    const jsonl = '{"type":"ai-title","aiTitle":"Good title"}\n{"type":"user","mess';
    expect(extractSessionTitle(jsonl)).toBe('Good title');
  });

  it('ignores blank ai-titles rather than showing an empty row', () => {
    const jsonl = '{"type":"ai-title","aiTitle":"Real"}\n{"type":"ai-title","aiTitle":"   "}';
    expect(extractSessionTitle(jsonl)).toBe('Real');
  });

  it('returns null for an empty or title-less transcript', () => {
    expect(extractSessionTitle('')).toBeNull();
    expect(extractSessionTitle('{"type":"mode","mode":"default"}')).toBeNull();
    expect(extractSessionTitle('[1,2,3]\nnot json')).toBeNull();
  });
});
