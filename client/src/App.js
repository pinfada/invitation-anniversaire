// client/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BirthdayInvitation from './components/BirthdayInvitation';
import PhotoShare from './components/PhotoShare';
import QRScanner from './components/QRScanner';
import GuestManager from './components/admin/GuestManager';
import QRCodePreview from './components/admin/QRCodePreview';

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
      // Dans une implémentation réelle, ce serait un appel API
      // const response = await fetch(`/api/guests/verify/${code}`);
      // const data = await response.json();
      
      // Pour la démo, simuler une réponse du serveur
      setTimeout(() => {
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
        
        if (mockData.success) {
          setGuestData(mockData.guest);
        }
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Erreur lors de la récupération des données invité:', error);
      setIsLoading(false);
    }
  };
  
  // Mise à jour des données de l'invité (par exemple après RSVP)
  const updateGuestData = (newData) => {
    setGuestData(prev => ({
      ...prev,
      ...newData
    }));
  };
  
  return (
    <Router>
      <Routes>
        {/* Page d'accueil - Invitation d'anniversaire */}
        <Route 
          path="/" 
          element={
            <BirthdayInvitation 
              guestData={guestData} 
              updateGuestData={updateGuestData}
              isLoading={isLoading}
            />
          } 
        />
        
        {/* Scanner QR code */}
        <Route path="/scan" element={<QRScanner />} />
        
        {/* Partage de photos */}
        <Route path="/photos" element={<PhotoShare guestData={guestData} />} />
        
        {/* Page d'administration pour gérer les invités et QR codes */}
        <Route path="/admin" element={<GuestManager />} />
        
        {/* Page Prévisualisation et gestion des QR codes des invités */}
        <Route path="/admin/qr-preview" element={<QRCodePreview />} />
        
        {/* Redirection de la page avec code QR vers la page d'accueil */}
        <Route
          path="/invitation"
          element={<Navigate to={`/?code=${guestCode || ''}`} replace />}
        />
        
        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;