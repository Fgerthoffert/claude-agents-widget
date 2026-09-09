import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// Read from the project root: this file runs under jsdom, where `import.meta.url` is an http URL.
const capabilities = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src-tauri/capabilities/default.json'), 'utf8'),
) as { readonly permissions: readonly unknown[] };

/**
 * The panel shipped once with inert drag regions: `core:window:default` does not include
 * `start-dragging`, and nothing else granted it, so `data-tauri-drag-region` and
 * `startDragging()` both did nothing while every jsdom test still passed. This asserts the
 * capability itself, which is the only place that bug was visible.
 */
describe('window capabilities', () => {
  it('grants the permission that window dragging needs', () => {
    expect(capabilities.permissions).toContain('core:window:allow-start-dragging');
  });
});
