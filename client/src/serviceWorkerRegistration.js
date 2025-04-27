// client/src/serviceWorkerRegistration.js

// Fonction pour enregistrer le service worker
export function register() {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        const swUrl = '/service-worker.js';
  
        registerValidSW(swUrl);
        
        // Ajouter des gestionnaires pour suivre l'état du réseau
        handleNetworkStatusChanges();
      });
    }
}

  
function registerValidSW(swUrl) {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker enregistré avec succès');
        
        // Configurer les mises à jour automatiques
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) {
            return;
          }
          
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // À ce stade, une nouvelle version du service worker a été installée
                console.log('Nouvelle version du Service Worker disponible');
                
                // Montrer une notification pour informer l'utilisateur
                showUpdateNotification();
              } else {
                // Premier Service Worker installé, application prête pour le offline
                console.log('Application prête pour une utilisation hors ligne');
              }
            }
          };
        };
        
        // Activer les événements de synchronisation en arrière-plan
        setupBackgroundSync(registration);
      })
      .catch((error) => {
        console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
      });
}
  
// Désinscrire le service worker
export function unregister() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister();
        })
        .catch((error) => {
          console.error('Erreur lors de la désinscription du Service Worker:', error);
        });
    }
}
  
// Monitoring du statut réseau
function handleNetworkStatusChanges() {
    // Mettre à jour l'interface utilisateur lorsque le statut du réseau change
    window.addEventListener('online', () => {
      document.body.classList.remove('offline');
      document.body.classList.add('online');
      
      // Tenter de synchroniser les données en attente
      syncPendingData();
    });
    
    window.addEventListener('offline', () => {
      document.body.classList.remove('online');
      document.body.classList.add('offline');
      
      // Afficher une notification à l'utilisateur
      showOfflineNotification();
    });
    
    // Appliquer la classe initiale
    if (navigator.onLine) {
      document.body.classList.add('online');
    } else {
      document.body.classList.add('offline');
    }
}
  
// Synchronisation des données en attente lorsque la connexion est rétablie
function syncPendingData() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then(registration => {
          // Tenter de synchroniser les photos
          registration.sync.register('sync-photos')
            .catch(err => console.error('Erreur lors de l\'enregistrement de la synchronisation des photos:', err));
          
          // Tenter de synchroniser les RSVP
          registration.sync.register('sync-rsvp')
            .catch(err => console.error('Erreur lors de l\'enregistrement de la synchronisation des RSVP:', err));
        });
    }
}
  
// Configurer la synchronisation en arrière-plan
function setupBackgroundSync(registration) {
    if ('SyncManager' in window) {
      // Déjà configuré dans le service worker
    } else {
      console.log('La synchronisation en arrière-plan n\'est pas supportée par ce navigateur');
    }
}
  
// Afficher une notification lors de la mise à jour du service worker
function showUpdateNotification() {
    const event = new CustomEvent('swUpdate', { detail: { updateAvailable: true } });
    window.dispatchEvent(event);
}
  
// Afficher une notification lorsque l'utilisateur passe hors ligne
function showOfflineNotification() {
    // Vous pouvez implémenter une notification UI ici si nécessaire
    console.log('Vous êtes maintenant hors ligne. Certaines fonctionnalités peuvent être limitées.');
}