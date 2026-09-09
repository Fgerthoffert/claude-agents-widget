/**
 * The most useful one-line rendering of anything a `catch` can hand you.
 *
 * Tauri rejects an `invoke` with a bare string, `notify` errors arrive as `Error`, and a plain
 * object would stringify to `[object Object]` — which is what made the v0.2.0 detection failure
 * unreadable even where it *was* logged. Every branch here has to produce something a bug
 * report can act on.
 */
export const describeError = (error: unknown): string => {
  if (typeof error === 'string') return error === '' ? 'unknown error' : error;
  if (error instanceof Error && error.message !== '') return error.message;
  if (typeof error !== 'object' || error === null) return String(error);

  try {
    const json = JSON.stringify(error);
    if (json !== '{}') return json;
  } catch {
    // Cyclic, or a `toJSON` that throws: fall through to the type name.
  }

  // Last resort: the constructor name says what kind of thing failed, where the default
  // stringification would only ever say `[object Object]`.
  const name: unknown = (error as { readonly constructor?: { readonly name?: unknown } })
    .constructor?.name;
  return typeof name === 'string' && name !== '' ? name : 'unknown error';
};
