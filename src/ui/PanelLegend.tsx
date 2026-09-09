import { sessionEmoji } from '../core/sessionEmoji';

const states = [
  { emoji: sessionEmoji('needs_input'), label: 'needs you' },
  { emoji: sessionEmoji('working'), label: 'working' },
  { emoji: sessionEmoji('done_idle'), label: 'done' },
  { emoji: sessionEmoji('ended'), label: 'ended' },
] as const;

/**
 * The key to the row glyphs, pinned to the bottom of the panel.
 *
 * Emoji are only self-explanatory once: the legend is what makes them learnable, and it is also
 * the only place the two duration icons can be told apart, since a row shows one or the other
 * but never both. It carries `data-tauri-drag-region` so the footer drags like the header.
 */
export const PanelLegend = () => (
  <footer className="panel__legend" data-tauri-drag-region>
    <span className="panel__legend-line" data-tauri-drag-region>
      {states.map(({ emoji, label }) => (
        <span key={label} className="panel__legend-item">
          <span aria-hidden="true">{emoji}</span> {label}
        </span>
      ))}
    </span>
    <span className="panel__legend-line" data-tauri-drag-region>
      <span className="panel__legend-item">
        <span aria-hidden="true">⏱</span> working for
      </span>
      <span className="panel__legend-item">
        <span aria-hidden="true">⏳</span> inactive for
      </span>
    </span>
  </footer>
);
