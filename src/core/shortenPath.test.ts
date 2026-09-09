import { describe, expect, it } from 'vitest';

import { shortenPath } from './shortenPath';

const HOME = '/Users/test';

describe('shortenPath', () => {
  it('replaces the home prefix with a tilde', () => {
    expect(shortenPath('/Users/test/code/api', HOME)).toBe('~/code/api');
  });

  it('renders the home directory itself as a bare tilde', () => {
    expect(shortenPath('/Users/test', HOME)).toBe('~');
  });

  it('tolerates a trailing slash on home', () => {
    expect(shortenPath('/Users/test/code', '/Users/test/')).toBe('~/code');
    expect(shortenPath('/Users/test', '/Users/test/')).toBe('~');
  });

  it('leaves non-home paths alone', () => {
    expect(shortenPath('/etc/hosts', HOME)).toBe('/etc/hosts');
    expect(shortenPath('/', HOME)).toBe('/');
  });

  it('does not abbreviate a sibling directory that merely shares the prefix', () => {
    expect(shortenPath('/Users/testers/code', HOME)).toBe('/Users/testers/code');
  });

  it('renders nothing when the cwd is unknown', () => {
    expect(shortenPath(null, HOME)).toBe('');
    expect(shortenPath('', HOME)).toBe('');
  });

  it('passes the path through when home is unknown', () => {
    expect(shortenPath('/Users/test/code', '')).toBe('/Users/test/code');
  });

  it('preserves unicode path segments', () => {
    expect(shortenPath('/Users/test/projets/été', HOME)).toBe('~/projets/été');
  });
});
