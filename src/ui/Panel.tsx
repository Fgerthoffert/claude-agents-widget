import './panel.css';

// `data-tauri-drag-region` on the root makes the whole surface draggable (no title bar).
export const Panel = () => (
  <main className="panel" data-tauri-drag-region>
    <h1 className="panel__title">Claude Agents Widget</h1>
    <p className="panel__empty">no sessions yet</p>
  </main>
);
