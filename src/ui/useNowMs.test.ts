import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNowMs } from './useNowMs';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNowMs', () => {
  it('starts at the current time', () => {
    const { result } = renderHook(() => useNowMs());

    expect(result.current).toBe(NOW);
  });

  it('advances once per second', () => {
    const { result } = renderHook(() => useNowMs());

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(NOW + 1000);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(NOW + 3000);
  });

  it('does not tick before the interval elapses', () => {
    const { result } = renderHook(() => useNowMs());

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(NOW);
  });

  it('stops ticking once unmounted', () => {
    const { result, unmount } = renderHook(() => useNowMs());
    unmount();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(NOW);
  });

  it('honours a custom interval', () => {
    const { result } = renderHook(() => useNowMs(5000));

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current).toBe(NOW);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(NOW + 5000);
  });
});
