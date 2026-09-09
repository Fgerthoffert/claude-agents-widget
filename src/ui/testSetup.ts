import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest's `globals` are off in this repo, so Testing Library's automatic cleanup (which hooks
// the global `afterEach`) never runs. Register it here instead, once for every UI test file.
afterEach(() => {
  cleanup();
});
