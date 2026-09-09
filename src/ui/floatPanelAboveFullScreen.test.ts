import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// Read from the project root: this file runs under jsdom, where `import.meta.url` is an http URL.
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), 'utf8');

const CALLER = 'src/ui/floatPanelAboveFullScreen.ts';
const RUST = 'src-tauri/src/lib.rs';

/**
 * ADR-0010's most expensive mistake: `invoke('float_above_fullscreen')` never reached Rust in a
 * single run of the investigation, and failed completely silently. App-local commands are not in
 * `gen/schemas/acl-manifests.json`, so — unlike a plugin command — a missing one produces no ACL
 * error to notice, and jsdom tests happily mock `invoke` for a command nobody registered.
 *
 * So the assertion is on the wiring itself: the name the frontend invokes must be the name Rust
 * registers in `generate_handler!`. This is the only place that class of bug is visible.
 */
describe('floatPanelAboveFullScreen', () => {
  const invoked = /invoke\(\s*'([a-z0-9_]+)'/.exec(read(CALLER))?.[1];

  it('invokes exactly one named command', () => {
    expect(invoked).toBeTypeOf('string');
  });

  it('invokes a command that Rust registers in generate_handler!', () => {
    const handler = /generate_handler!\[([\s\S]*?)\]/.exec(read(RUST))?.[1];

    expect(handler).toBeTypeOf('string');
    expect(handler?.split(/[\s,]+/).filter(Boolean)).toContain(`floating_panel::${invoked ?? ''}`);
  });
});
