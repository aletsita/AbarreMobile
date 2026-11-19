import React from 'react';
import { createRoot } from 'react-dom/client';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import '@fontsource-variable/inter';
import './theme/variables.css';
import './theme/global.css';

import App from './App';
import { SYNC_URL_ERROR } from './lib/sync';
import { initTheme } from './lib/theme';

initTheme();

const root = createRoot(document.getElementById('root')!);

if (SYNC_URL_ERROR) {
  // Sin servidor de sincronización la app no puede hablar con la caja: se avisa en lugar de fallar en silencio
  console.error(SYNC_URL_ERROR);
  root.render(
    <main role="alert" style={{ padding: '48px 24px', maxWidth: 520, margin: '0 auto', fontFamily: 'Inter Variable, system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: '1.3rem' }}>La app no está configurada</h1>
      <p>{SYNC_URL_ERROR}</p>
    </main>,
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
