import { useEffect, useState } from 'react';

/**
 * One clock for the whole panel, ticking every second.
 *
 * Every row's age derives from this single value rather than its own timer, so ten sessions
 * cost one interval. Rows are memoised on their formatted age string, which changes once a
 * minute past the first minute — the tick re-renders the panel but touches almost no DOM.
 */
export const useNowMs = (intervalMs = 1000): number => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return nowMs;
};
