import { sessionEmoji } from '../core/sessionEmoji';

/**
 * One entry per section, in the order the sections appear.
 *
 * Worded to distinguish the two *stopped* states, which is the only thing the headings above the
 * rows leave ambiguous: ✋ is an agent that asked something and cannot go on until it is answered,
 * ✅ is one that simply has nothing to do. "needs an answer" rather than the old "needs you",
 * because needing you was exactly the claim that covered both (ADR-0014). Kept to three short
 * labels: the legend is a key, and a key that needs reading twice is chrome.
 */
const states = [
  { emoji: sessionEmoji('working'), label: 'working' },
  { emoji: sessionEmoji('needs_input'), label: 'needs an answer' },
  { emoji: sessionEmoji('done_idle'), label: 'done' },
] as const;

/**
 * The key to the row glyphs, pinned to the bottom of the panel.
 *
 * Emoji are only self-explanatory once: the legend is what makes them learnable, and it is the
 * only place the two duration icons appear together, since a row shows one or the other but
 * never both. `ended` is absent because those sessions are never rendered (`visibleSessions`).
 * It carries `data-tauri-drag-region` so the footer drags like the header.
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
      <span className="panel__legend-item panel__legend-item--active">
        <span aria-hidden="true">▶</span> processing time
      </span>
      <span className="panel__legend-item">
        <span aria-hidden="true">⏸</span> inactive time
      </span>
    </span>
  </footer>
);
