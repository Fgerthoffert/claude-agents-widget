import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

const git = (...args: readonly string[]): string | null => {
  try {
    return execFileSync('git', [...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // No git, no repository, or no matching tag. Never a build failure: a release tarball has
    // none of the three and must still compile (ADR-0011).
    return null;
  }
};

/**
 * Git identity of this build, baked in as `__APP_BUILD__`.
 *
 * `GITHUB_REF_TYPE` is trusted alongside `git describe` so a tag build is recognised even if the
 * checkout cannot see its own tag — the release workflow must never publish a `.dmg` that calls
 * itself an untagged build.
 */
const buildInfo = () => ({
  commit: git('rev-parse', '--short', 'HEAD'),
  tagged:
    process.env.GITHUB_REF_TYPE === 'tag' ||
    git('describe', '--exact-match', '--tags', 'HEAD') !== null,
  dirty: (git('status', '--porcelain') ?? '') !== '',
});

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  define: { __APP_BUILD__: JSON.stringify(buildInfo()) },

  // Vite options tailored for Tauri development, applied by `tauri dev` / `tauri build`.
  // 1. Don't obscure Rust errors.
  clearScreen: false,
  // 2. Tauri expects a fixed port and must fail if it is taken.
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    // Spread rather than `hmr: undefined` — exactOptionalPropertyTypes rejects the latter.
    ...(host ? { hmr: { protocol: 'ws', host, port: 1421 } } : {}),
    // 3. src-tauri is Cargo's business, not Vite's.
    watch: { ignored: ['**/src-tauri/**'] },
  },
}));
