interface PanelHeaderProps {
  readonly onHide: () => void;
}

/**
 * The panel's only chrome: 24px of drag handle and a dismiss button.
 *
 * It carries no counts. The menu bar already shows the aggregate, and inside the panel the rows
 * are the count — a number above them was noise (ADR-0008). What remains is the grip: with a
 * full list there is no background left to grab, and `data-tauri-drag-region` is matched against
 * the element under the cursor, so the panel needs a guaranteed place to be dragged from. The
 * dismiss button is a child element and therefore not part of the drag region.
 */
export const PanelHeader = ({ onHide }: PanelHeaderProps) => (
  <header className="panel__header" data-tauri-drag-region>
    <span className="panel__grip" aria-hidden="true" data-tauri-drag-region />
    <button
      type="button"
      className="panel__hide"
      aria-label="Hide panel"
      data-no-drag
      onClick={onHide}
    >
      ✕
    </button>
  </header>
);
