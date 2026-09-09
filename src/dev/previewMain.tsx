import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PanelPreview } from './PanelPreview';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root container missing from preview.html');
}

createRoot(container).render(
  <StrictMode>
    <PanelPreview />
  </StrictMode>,
);
