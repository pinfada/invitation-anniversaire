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
        const response = await fetch('/api/guests/stats', {
          headers: {
            'x-api-key': adminKey
          }
        });
        
        if (response.status === 403) {
          // Clé API invalide, supprimer de localStorage
          localStorage.removeItem('adminKey');
          setAdminKey(null);
          setIsAdmin(false);
          setAuthError('Clé d\'administration invalide ou expirée');
        } else if (response.ok) {
          // Clé API valide
          setIsAdmin(true);
        } else {
          // Autre erreur
          setAuthError('Erreur lors de la vérification des droits d\'administration');
          setIsAdmin(false);
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
      
      // Cette route doit être implémentée côté serveur
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
    console.log('AuthContext -> headers : ', headers)
    console.log('AuthContext -> url : ', url)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      console.log('AuthContext -> response ',response)
      
      // Gestion des erreurs d'authentification
      if (response.status === 403) {
        logout();
        throw new Error('Session expirée ou invalide');
      }
      
      return response;
    } catch (error) {
      console.error('Erreur API:', error);
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