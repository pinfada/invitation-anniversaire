import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Créer une racine React
const root = createRoot(document.getElementById('root'));

// Rendre l'application dans cette racine
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrer le Service Worker pour les fonctionnalités PWA
serviceWorkerRegistration.register();