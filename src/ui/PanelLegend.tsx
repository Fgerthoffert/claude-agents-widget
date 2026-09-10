interface PanelLegendProps {
  /** The widget's own build identity — `v0.9.0`, or `v0.9.0 (abc1234)` off a tag. */
  readonly appVersion: string | null;
  /** The Claude Code the widget is reading, or `null` when it could not be read. */
  readonly claudeVersion: string | null;
}

/**
 * The panel's footer: what the two duration icons mean, and what is running this.
 *
 * The state glyphs used to be explained here too — ✋ needs an answer, 🔄 working, ✅ done. That
 * line is gone: the section headings above the rows already say which is which, so it was
 * spending two of the panel's scarcest pixels on a key to something already labelled.
 *
 * The duration icons stay, because they are the one thing the layout cannot explain. A row shows
 * ▶ or ⏸ but never both, so this is the only place they appear together — and they mean opposite
 * things about the same number (ADR-0008).
 *
 * The versions replace it. The widget is a view over `claude agents --json` (ADR-0018), so what
 * it can show depends on the CLI as much as on itself, and "which widget, which Claude" is the
 * first question about any odd behaviour. Having both on screen means a bug report can quote them
 * without hunting through a diagnostics dump. Either is omitted rather than guessed at.
 *
 * `data-tauri-drag-region` throughout, so the footer drags like the header.
 */
export const PanelLegend = ({ appVersion, claudeVersion }: PanelLegendProps) => (
  <footer className="panel__legend" data-tauri-drag-region>
    <span className="panel__legend-line" data-tauri-drag-region>
      <span className="panel__legend-item panel__legend-item--active">
        <span aria-hidden="true">▶</span> processing time
      </span>
      <span className="panel__legend-item">
        <span aria-hidden="true">⏸</span> inactive time
      </span>
    </span>
    <span className="panel__legend-line panel__legend-line--versions" data-tauri-drag-region>
      <span className="panel__legend-item">{appVersion ?? 'widget version unknown'}</span>
      {claudeVersion !== null && (
        <span className="panel__legend-item">Claude Code {claudeVersion}</span>
      )}
    </span>
  </footer>
);
