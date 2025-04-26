/* eslint-disable no-restricted-globals */
/* global clients */

// service-worker.js
const CACHE_NAME = 'birthday-invitation-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache ouvert');
      return cache.addAll(urlsToCache);
    })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return null; // Pour éviter les promesses undefined
        })
      );
    })
  );
});

// Stratégie de cache: Network First avec fallback sur le cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Vérifier si la réponse est valide
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Cloner la réponse pour pouvoir la mettre en cache et la retourner
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Gestion des notifications push (pour les alertes de nouvelles photos)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Erreur lors du traitement de la notification push:', error);
  }
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Vérifier si une URL est disponible
  const url = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/';
    
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(windowClients => {
      // Vérifier si une fenêtre/onglet est déjà ouvert et le focus
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Ouvrir une nouvelle fenêtre si nécessaire
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});