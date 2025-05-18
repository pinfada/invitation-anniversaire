// client/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('adminKey') || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();
  
  // Vérifier la validité de la clé API au chargement
  useEffect(() => {
    const verifyAdminKey = async () => {
      if (!adminKey) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Utiliser la route dédiée à la vérification d'authentification
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ apiKey: adminKey })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Gestion des différents codes d'erreur
          if (response.status === 403) {
            localStorage.removeItem('adminKey');
            setAdminKey(null);
            setIsAdmin(false);
            setAuthError('Clé d\'administration invalide ou expirée');
          } else {
            setAuthError(`Erreur lors de la vérification: ${data.message || 'Erreur inconnue'}`);
            setIsAdmin(false);
          }
        } else if (data.success) {
          // Clé API valide
          setIsAdmin(true);
          setAuthError(null);
        } else {
          // Réponse success: false
          localStorage.removeItem('adminKey');
          setAdminKey(null);
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
    
    verifyAdminKey();
  }, [adminKey]);
  
  // Fonction de connexion admin
  const adminLogin = async (password) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Échec de l\'authentification');
      }
      
      // Stocker la clé API retournée
      localStorage.setItem('adminKey', data.apiKey);
      setAdminKey(data.apiKey);
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
  const logout = () => {
    localStorage.removeItem('adminKey');
    setAdminKey(null);
    setIsAdmin(false);
    navigate('/admin/login');
  };
  
  // Fonction pour effectuer des appels API authentifiés
  const authenticatedFetch = async (url, options = {}) => {
    if (!adminKey) {
      throw new Error('Non authentifié');
    }
    
    const headers = {
      ...options.headers,
      'x-api-key': adminKey
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Gestion des erreurs d'authentification
      if (response.status === 403) {
        logout();
        throw new Error('Session expirée ou invalide');
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