import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Panel } from './ui/Panel';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root container missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
