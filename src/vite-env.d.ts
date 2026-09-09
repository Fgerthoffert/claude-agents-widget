/// <reference types="vite/client" />

/**
 * Git identity of this build, injected by `vite.config.ts` at build time. Undefined under
 * Vitest, which does not apply the app's `define` block — `readBuildInfo` handles that.
 */
declare const __APP_BUILD__:
  | {
      readonly commit: string | null;
      readonly tagged: boolean;
      readonly dirty: boolean;
    }
  | undefined;
