/* eslint-disable no-restricted-globals */
/* global clients */
// client/public/service-worker.js

const CACHE_NAME = 'birthday-invitation-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/admin-offline.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Assets additionnels pour fonctionnalités spécifiques
const THEME_ASSETS = [
  // Images de thème et icônes
  '/static/images/background.jpg',
  '/static/images/celebration.svg'
];

// URLs d'API à mettre en cache (stratégie stale-while-revalidate)
const API_ROUTES = [
  '/api/guests/verify/',
  '/api/photos'
];

// Installation: mise en cache des ressources statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Mise en cache des ressources statiques');
        return cache.addAll([...STATIC_ASSETS, ...THEME_ASSETS]);
      })
      .catch(error => {
        console.error('Service Worker: Erreur lors du cache initial:', error);
      })
  );
  
  // Force l'activation immédiate sans attendre la fermeture des pages
  self.skipWaiting();
});

// Activation: nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Suppression de l\'ancien cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  
  // Prend le contrôle immédiatement sur toutes les pages
  return self.clients.claim();
});

// Interception des requêtes avec stratégies de cache adaptées
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ne pas intercepter les requêtes vers Google Analytics ou d'autres services externes
  if (!url.origin.includes(self.location.origin) && 
      !url.hostname.endsWith('cloudinary.com') &&
      !url.hostname.endsWith('firebaseio.com') &&
      !url.hostname.endsWith('googleapis.com')) {
    return;
  }

  // Ne pas intercepter les routes admin
  if (url.pathname.includes('/admin') || 
      url.pathname.includes('/api/auth') || 
      url.pathname.includes('/api/guests')) {
    // Laisser le navigateur gérer ces requêtes normalement
    return;
  }
  
  // Stratégie pour les ressources statiques: Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }
  
  // Stratégie pour les images de QR codes: Cache First
  if (url.pathname.startsWith('/qr-codes/')) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }
  
  // Stratégie pour les photos: Cache First puis réseau
  if (url.pathname.startsWith('/photos/')) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }
  
  // Stratégie pour les API avec données importantes: Network First avec fallback cache
  if (isApiRoute(url.pathname)) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }
  
  // Stratégie par défaut: Network First pour le reste
  event.respondWith(networkFirstStrategy(event.request));
});

// Helpers pour déterminer le type de ressource
function isStaticAsset(pathname) {
  return STATIC_ASSETS.includes(pathname) || 
         THEME_ASSETS.includes(pathname) ||
         pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf)$/i);
}

function isApiRoute(pathname) {
  return API_ROUTES.some(route => pathname.includes(route));
}

// Stratégie Cache First: Essayer le cache d'abord, puis le réseau si nécessaire
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Retourner la version en cache immédiatement
    return cachedResponse;
  }
  
  // Si pas en cache, aller chercher sur le réseau
  try {
    const networkResponse = await fetch(request);
    
    // Ne mettre en cache que les réponses valides
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Si le réseau échoue et que c'est une image, retourner une image de fallback
    if (request.destination === 'image') {
      return caches.match('/static/images/offline-image.png');
    }
    
    // Pour les autres types, retourner une erreur générique
    throw error;
  }
}

// Stratégie Network First: Essayer le réseau d'abord, puis le cache si nécessaire
async function networkFirstStrategy(request) {
  try {
    // Essayer d'abord le réseau
    const networkResponse = await fetch(request);
    
    // Si succès, mettre en cache pour future utilisation
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Si réseau échoue, essayer le cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si c'est une page HTML, retourner la page offline
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    // Si c'est une requête API, retourner une réponse d'erreur formatée
    if (isApiRoute(new URL(request.url).pathname)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Vous êtes actuellement hors ligne. Cette fonctionnalité nécessite une connexion Internet.' 
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Pour tout autre type de requête, propager l'erreur
    throw error;
  }
}

// ============================================================
// IMPLÉMENTATION INDEXEDDB POUR PHOTOS ET RSVP
// ============================================================

// Configuration de la base de données locale pour photos
async function openPhotoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('birthday-photos-db', 1);
    
    request.onerror = event => {
      console.error('Erreur d\'ouverture de la base IndexedDB pour photos:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      // Créer un object store pour les photos en attente de synchronisation
      if (!db.objectStoreNames.contains('pendingPhotos')) {
        const store = db.createObjectStore('pendingPhotos', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

// Récupérer les photos en attente de synchronisation
async function getPendingPhotos(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingPhotos'], 'readonly');
    const store = transaction.objectStore('pendingPhotos');
    const statusIndex = store.index('status');
    
    // Récupérer toutes les photos avec statut "pending"
    const request = statusIndex.getAll('pending');
    
    request.onerror = event => {
      console.error('Erreur de récupération des photos en attente:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result || []);
    };
  });
}

// Marquer une photo comme synchronisée
async function markPhotoAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingPhotos'], 'readwrite');
    const store = transaction.objectStore('pendingPhotos');
    
    // Récupérer d'abord la photo
    const getRequest = store.get(id);
    
    getRequest.onerror = event => {
      console.error('Erreur de récupération de la photo pour mise à jour:', event.target.error);
      reject(event.target.error);
    };
    
    getRequest.onsuccess = event => {
      const photo = event.target.result;
      if (photo) {
        // Mettre à jour le statut
        photo.status = 'synced';
        photo.syncedAt = new Date().toISOString();
        
        // Sauvegarder les modifications
        const updateRequest = store.put(photo);
        
        updateRequest.onerror = event => {
          console.error('Erreur de mise à jour du statut de la photo:', event.target.error);
          reject(event.target.error);
        };
        
        updateRequest.onsuccess = event => {
          resolve();
        };
      } else {
        const error = new Error(`Photo avec ID ${id} non trouvée`);
        console.error(error);
        reject(error);
      }
    };
  });
}

// Configuration de la base de données locale pour RSVP
async function openRSVPDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('birthday-rsvp-db', 1);
    
    request.onerror = event => {
      console.error('Erreur d\'ouverture de la base IndexedDB pour RSVP:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      // Créer un object store pour les RSVP en attente
      if (!db.objectStoreNames.contains('pendingRSVPs')) {
        const store = db.createObjectStore('pendingRSVPs', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

// Récupérer les RSVP en attente
async function getPendingRSVPs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingRSVPs'], 'readonly');
    const store = transaction.objectStore('pendingRSVPs');
    const statusIndex = store.index('status');
    
    // Récupérer tous les RSVP avec statut "pending"
    const request = statusIndex.getAll('pending');
    
    request.onerror = event => {
      console.error('Erreur de récupération des RSVP en attente:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result || []);
    };
  });
}

// Marquer un RSVP comme synchronisé
async function markRSVPAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingRSVPs'], 'readwrite');
    const store = transaction.objectStore('pendingRSVPs');
    
    // Récupérer d'abord le RSVP
    const getRequest = store.get(id);
    
    getRequest.onerror = event => {
      console.error('Erreur de récupération du RSVP pour mise à jour:', event.target.error);
      reject(event.target.error);
    };
    
    getRequest.onsuccess = event => {
      const rsvp = event.target.result;
      if (rsvp) {
        // Mettre à jour le statut
        rsvp.status = 'synced';
        rsvp.syncedAt = new Date().toISOString();
        
        // Sauvegarder les modifications
        const updateRequest = store.put(rsvp);
        
        updateRequest.onerror = event => {
          console.error('Erreur de mise à jour du statut du RSVP:', event.target.error);
          reject(event.target.error);
        };
        
        updateRequest.onsuccess = event => {
          resolve();
        };
      } else {
        const error = new Error(`RSVP avec ID ${id} non trouvé`);
        console.error(error);
        reject(error);
      }
    };
  });
}

// Gestion des synchronisations en arrière-plan
self.addEventListener('sync', event => {
  if (event.tag === 'sync-photos') {
    event.waitUntil(syncPhotos());
  } else if (event.tag === 'sync-rsvp') {
    event.waitUntil(syncRSVP());
  }
});

// Fonction pour synchroniser les photos en attente
async function syncPhotos() {
  try {
    // Récupérer les photos en attente depuis IndexedDB
    const db = await openPhotoDatabase();
    const pendingPhotos = await getPendingPhotos(db);
    
    if (pendingPhotos.length === 0) {
      console.log("Aucune photo en attente de synchronisation");
      return;
    }
    
    console.log(`Tentative de synchronisation de ${pendingPhotos.length} photos`);
    
    // Envoyer chaque photo au serveur
    for (const photo of pendingPhotos) {
      try {
        // Limiter le nombre de tentatives pour éviter des boucles infinies
        if (photo.attemptCount && photo.attemptCount > 5) {
          console.warn(`Abandon de la synchronisation pour la photo ${photo.id} après 5 tentatives`);
          continue;
        }
        
        // Mise à jour du compteur de tentatives
        await updatePhotoAttemptCount(db, photo.id);
        
        const formData = new FormData();
        formData.append('photo', photo.blob, photo.filename || 'photo.jpg');
        formData.append('metadata', JSON.stringify(photo.metadata || {}));
        
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          console.log(`Photo ${photo.id} synchronisée avec succès`);
          // Si succès, marquer comme envoyée dans IndexedDB
          await markPhotoAsSynced(db, photo.id);
        } else {
          const errorData = await response.json();
          console.error(`Erreur lors de la synchronisation de la photo ${photo.id}:`, errorData);
        }
      } catch (err) {
        console.error(`Erreur lors de la synchronisation de la photo ${photo.id}:`, err);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des photos:', error);
  }
}

// Fonction pour synchroniser les RSVP en attente
async function syncRSVP() {
  try {
    // Récupérer les RSVP en attente depuis IndexedDB
    const db = await openRSVPDatabase();
    const pendingRSVPs = await getPendingRSVPs(db);
    
    if (pendingRSVPs.length === 0) {
      console.log("Aucun RSVP en attente de synchronisation");
      return;
    }
    
    console.log(`Tentative de synchronisation de ${pendingRSVPs.length} RSVP`);
    
    // Envoyer chaque RSVP au serveur
    for (const rsvp of pendingRSVPs) {
      try {
        // Limiter le nombre de tentatives
        if (rsvp.attemptCount && rsvp.attemptCount > 5) {
          console.warn(`Abandon de la synchronisation pour le RSVP ${rsvp.id} après 5 tentatives`);
          continue;
        }
        
        // Mise à jour du compteur de tentatives
        await updateRSVPAttemptCount(db, rsvp.id);
        
        const response = await fetch('/api/guests/rsvp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rsvp.data)
        });
        
        if (response.ok) {
          console.log(`RSVP ${rsvp.id} synchronisé avec succès`);
          // Si succès, marquer comme envoyé dans IndexedDB
          await markRSVPAsSynced(db, rsvp.id);
        } else {
          const errorData = await response.json();
          console.error(`Erreur lors de la synchronisation du RSVP ${rsvp.id}:`, errorData);
        }
      } catch (err) {
        console.error(`Erreur lors de la synchronisation du RSVP ${rsvp.id}:`, err);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des RSVPs:', error);
  }
}

// Fonction pour mettre à jour le compteur de tentatives d'une photo
async function updatePhotoAttemptCount(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingPhotos'], 'readwrite');
    const store = transaction.objectStore('pendingPhotos');
    
    // Récupérer d'abord la photo
    const getRequest = store.get(id);
    
    getRequest.onerror = event => reject(event.target.error);
    
    getRequest.onsuccess = event => {
      const photo = event.target.result;
      if (photo) {
        // Incrémenter le compteur de tentatives
        photo.attemptCount = (photo.attemptCount || 0) + 1;
        photo.lastAttempt = new Date().toISOString();
        
        // Sauvegarder les modifications
        const updateRequest = store.put(photo);
        
        updateRequest.onerror = event => reject(event.target.error);
        updateRequest.onsuccess = event => resolve();
      } else {
        reject(new Error(`Photo avec ID ${id} non trouvée`));
      }
    };
  });
}

// Fonction pour mettre à jour le compteur de tentatives d'un RSVP
async function updateRSVPAttemptCount(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingRSVPs'], 'readwrite');
    const store = transaction.objectStore('pendingRSVPs');
    
    // Récupérer d'abord le RSVP
    const getRequest = store.get(id);
    
    getRequest.onerror = event => reject(event.target.error);
    
    getRequest.onsuccess = event => {
      const rsvp = event.target.result;
      if (rsvp) {
        // Incrémenter le compteur de tentatives
        rsvp.attemptCount = (rsvp.attemptCount || 0) + 1;
        rsvp.lastAttempt = new Date().toISOString();
        
        // Sauvegarder les modifications
        const updateRequest = store.put(rsvp);
        
        updateRequest.onerror = event => reject(event.target.error);
        updateRequest.onsuccess = event => resolve();
      } else {
        reject(new Error(`RSVP avec ID ${id} non trouvé`));
      }
    };
  });
}

// Gestion des notifications push
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.message,
    icon: '/logo192.png',
    badge: '/badge.png',
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Anniversaire', options)
  );
});

// Gestion du clic sur une notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Vérifier si une fenêtre est déjà ouverte et y naviguer
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});