import { describe, expect, it } from 'vitest';

import { parseTtyDevice } from './parseTtyDevice';

describe('parseTtyDevice', () => {
  it('expands the short name ps prints into the device path the terminals report', () => {
    expect(parseTtyDevice('ttys003\n')).toBe('/dev/ttys003');
  });

  it('leaves an already-absolute device alone', () => {
    expect(parseTtyDevice(' /dev/ttys012 ')).toBe('/dev/ttys012');
  });

  it('reads ?? — no controlling terminal — as no tty', () => {
    expect(parseTtyDevice('??\n')).toBeNull();
  });

  it('reads the empty output of a dead pid as no tty', () => {
    expect(parseTtyDevice('')).toBeNull();
    expect(parseTtyDevice('\n')).toBeNull();
  });

  it('rejects anything that is not a plain device name', () => {
    expect(parseTtyDevice('ttys003 ttys004')).toBeNull();
    expect(parseTtyDevice('ttys003"; id')).toBeNull();
  });
});
