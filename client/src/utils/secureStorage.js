// utils/secureStorage.js - Stockage sécurisé avec chiffrement AES-256

// Implémentation native sans crypto-js pour éviter les dépendances
const CryptoJS = {
  SHA256: (message) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    });
  },
  
  AES: {
    encrypt: async (message, key) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const keyData = encoder.encode(key);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData.slice(0, 32), // Prendre seulement 32 bytes pour AES-256
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );
      
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...result));
    },
    
    decrypt: async (encryptedData, key) => {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      
      const data = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );
      
      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData.slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    }
  }
};

// Clé de chiffrement générée à partir de l'empreinte du navigateur
const getEncryptionKey = async () => {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 4
  ].join('|');
  
  // Générer une clé déterministe basée sur l'empreinte
  return await CryptoJS.SHA256(fingerprint + 'invitation-app-salt-2024');
};

// Chiffrer les données avant stockage
const encrypt = async (data) => {
  try {
    const key = await getEncryptionKey();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = await CryptoJS.AES.encrypt(dataString, key);
    
    // Ajouter un timestamp pour expiration
    const payload = {
      data: encrypted,
      timestamp: Date.now(),
      checksum: (await CryptoJS.SHA256(dataString)).substring(0, 16)
    };
    
    return btoa(JSON.stringify(payload));
  } catch (error) {
    console.error('Erreur de chiffrement:', error);
    return null;
  }
};

// Déchiffrer les données du stockage
const decrypt = async (encryptedData, maxAge = 24 * 60 * 60 * 1000) => { // 24h par défaut
  try {
    if (!encryptedData) return null;
    
    const payload = JSON.parse(atob(encryptedData));
    
    // Vérifier l'expiration
    if (Date.now() - payload.timestamp > maxAge) {
      console.warn('Données expirées, suppression du stockage');
      return null;
    }
    
    const key = await getEncryptionKey();
    const decryptedString = await CryptoJS.AES.decrypt(payload.data, key);
    
    if (!decryptedString) {
      console.warn('Impossible de déchiffrer les données');
      return null;
    }
    
    // Vérifier l'intégrité avec checksum
    const calculatedChecksum = (await CryptoJS.SHA256(decryptedString)).substring(0, 16);
    if (calculatedChecksum !== payload.checksum) {
      console.warn('Intégrité des données compromise');
      return null;
    }
    
    try {
      return JSON.parse(decryptedString);
    } catch {
      return decryptedString;
    }
  } catch (error) {
    console.error('Erreur de déchiffrement:', error);
    return null;
  }
};

// API sécurisée pour localStorage
const secureStorage = {
  // Stocker des données de façon sécurisée
  setItem: async (key, data, maxAge) => {
    const encrypted = await encrypt(data);
    if (encrypted) {
      try {
        localStorage.setItem(`secure_${key}`, encrypted);
        return true;
      } catch (error) {
        console.error('Erreur de stockage:', error);
        return false;
      }
    }
    return false;
  },
  
  // Récupérer des données sécurisées
  getItem: async (key, maxAge) => {
    try {
      const encryptedData = localStorage.getItem(`secure_${key}`);
      const decrypted = await decrypt(encryptedData, maxAge);
      
      // Si les données sont expirées ou corrompues, les supprimer
      if (decrypted === null && encryptedData) {
        localStorage.removeItem(`secure_${key}`);
      }
      
      return decrypted;
    } catch (error) {
      console.error('Erreur de récupération:', error);
      return null;
    }
  },
  
  // Supprimer des données sécurisées
  removeItem: (key) => {
    try {
      localStorage.removeItem(`secure_${key}`);
      return true;
    } catch (error) {
      console.error('Erreur de suppression:', error);
      return false;
    }
  },
  
  // Nettoyer toutes les données sécurisées
  clear: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('secure_')) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Erreur de nettoyage:', error);
      return false;
    }
  },
  
  // Vérifier si une clé existe et est valide
  hasValidItem: async (key, maxAge) => {
    const data = await secureStorage.getItem(key, maxAge);
    return data !== null;
  }
};

// Utilitaires pour les données spécifiques à l'application
export const guestStorage = {
  save: async (guestData) => {
    return await secureStorage.setItem('guestData', guestData, 7 * 24 * 60 * 60 * 1000); // 7 jours
  },
  
  load: async () => {
    return await secureStorage.getItem('guestData', 7 * 24 * 60 * 60 * 1000);
  },
  
  remove: () => {
    return secureStorage.removeItem('guestData');
  }
};

export const adminStorage = {
  save: async (adminKey) => {
    return await secureStorage.setItem('adminKey', adminKey, 1 * 60 * 60 * 1000); // 1 heure
  },
  
  load: async () => {
    return await secureStorage.getItem('adminKey', 1 * 60 * 60 * 1000);
  },
  
  remove: () => {
    return secureStorage.removeItem('adminKey');
  }
};

export default secureStorage;