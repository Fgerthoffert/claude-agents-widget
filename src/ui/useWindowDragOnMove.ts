import { useCallback, useRef } from 'react';

import { startWindowDrag } from './startWindowDrag';

/** Movement, in pixels, that separates a click on a row from a drag of the window. */
const THRESHOLD = 4;

interface WindowDragOnMove {
  /** Attach to the panel root; it watches presses anywhere inside it. */
  readonly onMouseDown: (event: React.MouseEvent) => void;
  /** True once per drag: lets a row swallow the click that ends it. */
  readonly consumeDrag: () => boolean;
}

/**
 * Makes the whole panel draggable without making rows unclickable.
 *
 * A press that moves more than a few pixels starts a native window drag; a press that does not
 * stays a click. This is what lets the panel be moved from anywhere — over a row, a heading, the
 * legend — which drag regions alone cannot do, since Tauri matches them on the element directly
 * under the cursor and rows must stay clickable (ADR-0008).
 *
 * Elements that opt out (the dismiss button) are skipped via `[data-no-drag]`.
 */
export const useWindowDragOnMove = (): WindowDragOnMove => {
  const dragged = useRef(false);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('[data-no-drag]') !== null) return;

    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (move: MouseEvent) => {
      if (Math.abs(move.clientX - startX) + Math.abs(move.clientY - startY) < THRESHOLD) return;

      cleanup();
      dragged.current = true;
      void startWindowDrag();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
  }, []);

  const consumeDrag = useCallback(() => {
    const wasDragged = dragged.current;
    dragged.current = false;

    return wasDragged;
  }, []);

  return { onMouseDown, consumeDrag };
};
