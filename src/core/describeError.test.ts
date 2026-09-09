import { describe, expect, it } from 'vitest';

import { describeError } from './describeError';

describe('describeError', () => {
  it('uses an Error message', () => {
    expect(describeError(new Error('fs.watch not allowed'))).toBe('fs.watch not allowed');
  });

  // Tauri rejects an unavailable `invoke` with a bare string, which is exactly the v0.2.0 case.
  it('passes a bare string through, because that is how Tauri rejects', () => {
    expect(describeError('Command plugin:fs|watch not found')).toBe(
      'Command plugin:fs|watch not found',
    );
  });

  it('falls back for an empty message rather than reporting nothing', () => {
    expect(describeError(new Error(''))).toBe('Error');
    expect(describeError('')).toBe('unknown error');
  });

  it('serialises a plain object instead of writing [object Object]', () => {
    expect(describeError({ code: 'EPERM' })).toBe('{"code":"EPERM"}');
  });

  it('names the type of a value that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(describeError(cyclic)).toBe('Object');
    expect(describeError(Object.create(null))).toBe('unknown error');
  });

  it('reports the absence of a value plainly', () => {
    expect(describeError(null)).toBe('null');
    expect(describeError(undefined)).toBe('undefined');
    expect(describeError(404)).toBe('404');
  });
});
