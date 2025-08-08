// client/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminStorage } from '../utils/secureStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();
  
  // Charger et vérifier la validité du token JWT au chargement
  useEffect(() => {
    const loadAndVerifyToken = async () => {
      const savedToken = await adminStorage.load();
      setAccessToken(savedToken);
      
      if (!savedToken) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Utiliser la route dédiée à la vérification JWT
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${savedToken}`
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Gestion des différents codes d'erreur
          if (response.status === 403 || response.status === 401) {
            // Token expiré ou invalide, essayer de le rafraîchir
            const refreshed = await attemptTokenRefresh();
            if (!refreshed) {
              adminStorage.remove();
              setAccessToken(null);
              setIsAdmin(false);
              setAuthError('Session expirée, veuillez vous reconnecter');
            }
          } else {
            setAuthError(`Erreur lors de la vérification: ${data.message || 'Erreur inconnue'}`);
            setIsAdmin(false);
          }
        } else if (data.success) {
          // Token JWT valide
          setIsAdmin(true);
          setAuthError(null);
        } else {
          // Réponse success: false
          adminStorage.remove();
          setAccessToken(null);
          setIsAdmin(false);
          setAuthError(data.message || 'Erreur de vérification des droits d\'administration');
        }
      } catch (error) {
        console.error('Erreur de connexion au serveur:', error);
        setAuthError('Erreur de connexion au serveur');
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAndVerifyToken();
  }, []);
  
  // Fonction pour rafraîchir le token
  const attemptTokenRefresh = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Important pour les cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.success && data.accessToken) {
        await adminStorage.save(data.accessToken);
        setAccessToken(data.accessToken);
        setIsAdmin(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      return false;
    }
  };

  // Fonction de connexion admin avec JWT
  const adminLogin = async (password) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        credentials: 'include', // Important pour recevoir le cookie refresh token
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Échec de l\'authentification');
      }
      
      // Stocker l'access token JWT de manière sécurisée
      await adminStorage.save(data.accessToken);
      setAccessToken(data.accessToken);
      setIsAdmin(true);
      return true;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      setAuthError(error.message || 'Échec de l\'authentification');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fonction de déconnexion
  const logout = async () => {
    try {
      // Appeler l'endpoint de déconnexion pour invalider le refresh token
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      adminStorage.remove();
      setAccessToken(null);
      setIsAdmin(false);
      navigate('/admin/login');
    }
  };
  
  // Fonction pour effectuer des appels API authentifiés avec JWT
  const authenticatedFetch = async (url, options = {}) => {
    if (!accessToken) {
      throw new Error('Non authentifié');
    }
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Gestion des erreurs d'authentification
      if (response.status === 401 || response.status === 403) {
        // Token expiré, essayer de le rafraîchir
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          // Réessayer la requête avec le nouveau token
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
          };
          
          return fetch(url, {
            ...options,
            headers: newHeaders
          });
        } else {
          logout();
          throw new Error('Session expirée ou invalide');
        }
      }

      // Pour les erreurs 503, informer spécifiquement
      if (response.status === 503) {
        throw new Error('Le serveur est temporairement indisponible. Vérifiez votre connexion réseau ou réessayez plus tard.');
      }
      
      return response;
    } catch (error) {
      // Récupérer les erreurs réseau
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.');
      }
      
      throw error;
    }
  };
  
  return (
    <AuthContext.Provider 
      value={{ 
        isAdmin, 
        isLoading, 
        authError, 
        adminLogin, 
        logout, 
        authenticatedFetch 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);