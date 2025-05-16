// client/src/App.js (mise à jour)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BirthdayInvitation from './components/BirthdayInvitation';
import PhotoShare from './components/PhotoShare';
import QRScanner from './components/QRScanner';
import GuestManager from './components/admin/GuestManager';
import QRCodePreview from './components/admin/QRCodePreview';
import AdminLogin from './pages/AdminLogin';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  const [guestCode, setGuestCode] = useState(null);
  const [guestData, setGuestData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Vérifier si un code QR est présent dans l'URL
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    
    if (code) {
      setGuestCode(code);
      localStorage.setItem('guestCode', code);
      
      // Vérifier et charger les données de l'invité
      fetchGuestData(code);
    } else {
      // Vérifier si un code est enregistré en localStorage
      const savedCode = localStorage.getItem('guestCode');
      if (savedCode) {
        setGuestCode(savedCode);
        fetchGuestData(savedCode);
      } else {
        setIsLoading(false);
      }
    }
  }, []);
  
  // Récupération des données de l'invité à partir du code
  const fetchGuestData = async (code) => {
    setIsLoading(true);
    try {
      // Appel réel à l'API
      const response = await fetch(`/api/guests/verify/${code}`);
      
      // Vérifier si la réponse est ok (statut 200-299)
      if (!response.ok) {
        // Si le serveur répond avec une erreur (404, 500, etc.)
        console.error('Erreur serveur:', response.status);
        setGuestData(null);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setGuestData(data.guest);
        // Stocker les informations dans localStorage pour les sessions futures
        localStorage.setItem('guestData', JSON.stringify(data.guest));
      } else {
        // Si l'API répond avec success: false
        console.warn('Code invalide ou expiré:', data.message);
        setGuestData(null);
        // Supprimer les données locales potentiellement obsolètes
        localStorage.removeItem('guestData');
        // Rediriger vers la page d'erreur
        window.location.href = '/invalid-code';
        return; // Arrêter l'exécution de la fonction
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données invité:', error);
      
      // Pour le développement, simuler une réponse du serveur
      console.log("Mode développement : utilisation de données fictives");
      
      const mockData = {
        success: true,
        guest: {
          name: "Marie Dupont",
          email: "marie@example.com",
          personalWelcomeMessage: "Bonjour Marie ! Nous sommes ravis de te voir à notre fête. N'oublie pas d'apporter ton maillot de bain pour la piscine !",
          hasCheckedIn: false,
          attending: null
        }
      };
      
      setGuestData(mockData.guest);
      localStorage.setItem('guestData', JSON.stringify(mockData.guest));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mise à jour des données de l'invité (par exemple après RSVP)
  const updateGuestData = (newData) => {
    setGuestData(prev => {
      const updated = { ...prev, ...newData };
      // Mettre à jour également dans localStorage
      localStorage.setItem('guestData', JSON.stringify(updated));
      return updated;
    });
  };
  
  return (
    
    <Router>
      <AuthProvider>
        <Routes>
          {/* Page d'accueil - Invitation d'anniversaire */}
          <Route 
            path="/" 
            element={
              isLoading ? (
                <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center">
                  <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
                    <p className="text-amber-800">Chargement des informations...</p>
                  </div>
                </div>
              ) : (
                <BirthdayInvitation 
                  guestData={guestData} 
                  updateGuestData={updateGuestData}
                  isLoading={isLoading}
                />
              )
            } 
          />
          
          {/* Scanner QR code */}
          <Route path="/scan" element={<QRScanner />} />
          
          {/* Partage de photos */}
          <Route path="/photos" element={<PhotoShare guestData={guestData} />} />
          
          {/* Routes Admin avec protection */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <Navigate to="/admin/guests" replace />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/guests"
            element={
              <ProtectedAdminRoute>
                <GuestManager />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/qrcodes"
            element={
              <ProtectedAdminRoute>
                <QRCodePreview />
              </ProtectedAdminRoute>
            }
          />
          
          {/* Page d'erreur pour les codes invalides */}
          <Route 
            path="/invalid-code" 
            element={
              <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md">
                  <div className="text-red-500 text-5xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold text-amber-800 mb-4">Code QR invalide</h2>
                  <p className="text-amber-700 mb-6">
                    Le code QR que vous avez scanné n'est pas valide ou a expiré. 
                    Veuillez vérifier que vous utilisez bien le code qui vous a été fourni.
                  </p>
                  <a 
                    href="/"
                    className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition"
                  >
                    Retour à l'accueil
                  </a>
                </div>
              </div>
            } 
          />
          
          {/* Redirection de la page avec code QR vers la page d'accueil */}
          <Route
            path="/invitation"
            element={<Navigate to={`/?code=${guestCode || ''}`} replace />}
          />
          
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
    
  );
}

export default App;