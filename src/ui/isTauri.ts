/**
 * Whether the native layer is reachable.
 *
 * The same bundle runs in three places: the packaged app, `npm run dev` (Vite alone, no native
 * shell) and jsdom under Vitest. Every Tauri call throws in the last two, so the window and
 * tray hooks check this first and no-op rather than filling the console with failures.
 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
