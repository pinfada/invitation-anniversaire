// client/src/pages/AdminLogin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, AlertTriangle } from 'lucide-react';

const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { adminLogin, isAdmin, authError, isLoading } = useAuth();
  const navigate = useNavigate();
  
  // Rediriger vers le panneau admin si déjà authentifié
  useEffect(() => {
    if (isAdmin && !isLoading) {
      navigate('/admin');
    }
  }, [isAdmin, isLoading, navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const success = await adminLogin(password);
      if (success) {
        navigate('/admin');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="bg-amber-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-amber-800">Administration</h1>
          <p className="text-amber-600 mt-2">Veuillez vous connecter pour accéder au panneau d'administration</p>
        </div>
        
        {authError && (
          <div className="flex items-start mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <AlertTriangle size={20} className="mr-2 mt-0.5 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="password" className="block text-amber-700 mb-2">
              Mot de passe administrateur
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-amber-300 rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500"
              placeholder="Entrez le mot de passe"
              required
              autoComplete="current-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <a href="/" className="text-amber-600 hover:text-amber-800 text-sm">
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;