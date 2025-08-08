// Client/src
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

// Retirer le loader initial dès que React est monté (fallback à l'événement load d'index.html)
const removeInitialLoader = () => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('fade-out');
  setTimeout(() => {
    if (loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
  }, 300);
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // DOM prêt, on peut retirer le loader
  removeInitialLoader();
} else {
  window.addEventListener('DOMContentLoaded', removeInitialLoader);
}

// Enregistrer le Service Worker pour les fonctionnalités PWA
serviceWorkerRegistration.register();