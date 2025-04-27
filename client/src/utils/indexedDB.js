// client/src/utils/indexedDB.js

// API pour la gestion des photos en mode hors ligne
export const PhotosOfflineAPI = {
    // Ajouter une photo à la file d'attente pour téléchargement
    async queuePhotoForUpload(photoBlob, metadata = {}) {
      try {
        const db = await this.openDatabase();
        const transaction = db.transaction(['pendingPhotos'], 'readwrite');
        const store = transaction.objectStore('pendingPhotos');
        
        // Créer un nouvel objet photo
        const filename = metadata.filename || `photo_${Date.now()}.jpg`;
        const photoObject = {
          id: `photo_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          blob: photoBlob,
          filename,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            offlineCreated: true
          },
          status: 'pending',
          timestamp: new Date().toISOString(),
          attemptCount: 0
        };
        
        // Stocker dans IndexedDB
        return new Promise((resolve, reject) => {
          const request = store.add(photoObject);
          
          request.onsuccess = () => {
            console.log('Photo mise en file d\'attente pour téléchargement:', photoObject.id);
            
            // Tenter de synchroniser immédiatement si en ligne
            this.triggerSync();
            
            resolve(photoObject.id);
          };
          
          request.onerror = (event) => {
            console.error('Erreur lors de la mise en file d\'attente de la photo:', event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error('Erreur lors de l\'accès à IndexedDB:', error);
        throw error;
      }
    },
    
    // Récupérer toutes les photos en attente
    async getPendingPhotos() {
      try {
        const db = await this.openDatabase();
        const transaction = db.transaction(['pendingPhotos'], 'readonly');
        const store = transaction.objectStore('pendingPhotos');
        const statusIndex = store.index('status');
        
        return new Promise((resolve, reject) => {
          const request = statusIndex.getAll('pending');
          
          request.onsuccess = (event) => {
            resolve(event.target.result || []);
          };
          
          request.onerror = (event) => {
            console.error('Erreur lors de la récupération des photos en attente:', event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error('Erreur lors de l\'accès à IndexedDB:', error);
        return [];
      }
    },
    
    // Déclencher la synchronisation via le Service Worker
    async triggerSync() {
      if ('serviceWorker' in navigator && 'SyncManager' in window && navigator.onLine) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-photos');
          console.log('Synchronisation des photos programmée');
          return true;
        } catch (error) {
          console.error('Erreur lors de la programmation de la synchronisation:', error);
          return false;
        }
      }
      return false;
    },
    
    // Ouvrir la base de données IndexedDB
    openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('birthday-photos-db', 1);
        
        request.onerror = (event) => {
          console.error('Erreur lors de l\'ouverture de la base de données IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Créer un object store pour les photos en attente
          if (!db.objectStoreNames.contains('pendingPhotos')) {
            const store = db.createObjectStore('pendingPhotos', { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    }
  };
  
  // API pour la gestion des RSVP en mode hors ligne
  export const RSVPOfflineAPI = {
    // Ajouter un RSVP à la file d'attente
    async queueRSVPForSync(rsvpData) {
      try {
        const db = await this.openDatabase();
        const transaction = db.transaction(['pendingRSVPs'], 'readwrite');
        const store = transaction.objectStore('pendingRSVPs');
        
        // Créer un nouvel objet RSVP
        const rsvpObject = {
          id: `rsvp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          data: rsvpData,
          status: 'pending',
          timestamp: new Date().toISOString(),
          attemptCount: 0
        };
        
        // Stocker dans IndexedDB
        return new Promise((resolve, reject) => {
          const request = store.add(rsvpObject);
          
          request.onsuccess = () => {
            console.log('RSVP mis en file d\'attente pour synchronisation:', rsvpObject.id);
            
            // Tenter de synchroniser immédiatement si en ligne
            this.triggerSync();
            
            resolve(rsvpObject.id);
          };
          
          request.onerror = (event) => {
            console.error('Erreur lors de la mise en file d\'attente du RSVP:', event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error('Erreur lors de l\'accès à IndexedDB:', error);
        throw error;
      }
    },
    
    // Récupérer tous les RSVP en attente
    async getPendingRSVPs() {
      try {
        const db = await this.openDatabase();
        const transaction = db.transaction(['pendingRSVPs'], 'readonly');
        const store = transaction.objectStore('pendingRSVPs');
        const statusIndex = store.index('status');
        
        return new Promise((resolve, reject) => {
          const request = statusIndex.getAll('pending');
          
          request.onsuccess = (event) => {
            resolve(event.target.result || []);
          };
          
          request.onerror = (event) => {
            console.error('Erreur lors de la récupération des RSVP en attente:', event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error('Erreur lors de l\'accès à IndexedDB:', error);
        return [];
      }
    },
    
    // Déclencher la synchronisation via le Service Worker
    async triggerSync() {
      if ('serviceWorker' in navigator && 'SyncManager' in window && navigator.onLine) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-rsvp');
          console.log('Synchronisation des RSVP programmée');
          return true;
        } catch (error) {
          console.error('Erreur lors de la programmation de la synchronisation:', error);
          return false;
        }
      }
      return false;
    },
    
    // Ouvrir la base de données IndexedDB
    openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('birthday-rsvp-db', 1);
        
        request.onerror = (event) => {
          console.error('Erreur lors de l\'ouverture de la base de données IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Créer un object store pour les RSVP en attente
          if (!db.objectStoreNames.contains('pendingRSVPs')) {
            const store = db.createObjectStore('pendingRSVPs', { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    }
  };
  
// API générale pour vérifier la connectivité et le support offline
export const OfflineSupport = {
    // Vérifier si l'application est en mode hors ligne
    isOffline() {
      return !navigator.onLine;
    },
    
    // Vérifier si les fonctionnalités de synchronisation sont disponibles
    isSyncSupported() {
      return 'serviceWorker' in navigator && 'SyncManager' in window;
    },
    
    // Surveiller les changements de connectivité
    setupConnectivityListeners(onlineCallback, offlineCallback) {
      window.addEventListener('online', () => {
        console.log('Application en ligne - tentative de synchronisation des données');
        if (onlineCallback && typeof onlineCallback === 'function') {
          onlineCallback();
        }
        
        // Déclencher les synchronisations automatiquement
        PhotosOfflineAPI.triggerSync();
        RSVPOfflineAPI.triggerSync();
      });
      
      window.addEventListener('offline', () => {
        console.log('Application hors ligne - passage en mode local');
        if (offlineCallback && typeof offlineCallback === 'function') {
          offlineCallback();
        }
      });
      
      // Retourner l'état initial
      return navigator.onLine;
    },
    
    // Vérifier le statut du service worker
    async checkServiceWorkerStatus() {
      if (!('serviceWorker' in navigator)) {
        return { registered: false, reason: 'not-supported' };
      }
      
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          registered: !!registration,
          active: registration && registration.active ? true : false,
          waiting: registration && registration.waiting ? true : false,
          installing: registration && registration.installing ? true : false
        };
      } catch (error) {
        console.error('Erreur lors de la vérification du service worker:', error);
        return { registered: false, reason: 'error', error };
      }
    }
};