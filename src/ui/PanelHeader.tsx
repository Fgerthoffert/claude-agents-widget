interface PanelHeaderProps {
  /** The same aggregate string the menu bar shows, e.g. `3▶ 2⏸ 1✔`. */
  readonly aggregate: string;
  readonly attention: boolean;
  readonly onHide: () => void;
}

/**
 * The panel's only chrome: 26px carrying the aggregate and a dismiss button.
 *
 * It exists mainly as a guaranteed drag handle. `data-tauri-drag-region` is matched against the
 * element under the cursor, so a header full of rows would leave nowhere to grab once the list
 * fills the panel (ADR-0008). The dismiss button is a child element and therefore not part of
 * the drag region.
 */
export const PanelHeader = ({ aggregate, attention, onHide }: PanelHeaderProps) => (
  <header className="panel__header" data-tauri-drag-region>
    <span
      className={`panel__aggregate${attention ? ' panel__aggregate--attention' : ''}`}
      data-tauri-drag-region
    >
      {aggregate}
    </span>
    <button type="button" className="panel__hide" aria-label="Hide panel" onClick={onHide}>
      ✕
    </button>
  </header>
);
