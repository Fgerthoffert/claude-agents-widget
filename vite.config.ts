import react from '@vitejs/plugin-react';
import process from 'node:process';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

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
