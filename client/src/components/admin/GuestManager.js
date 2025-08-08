// client/src/components/admin/GuestManager.js
import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash, QrCode, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const GuestManager = () => {
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState({ 
    name: '', 
    email: '', 
    message: '' 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [stats, setStats] = useState(null);
  
  const { authenticatedFetch, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Vérifier l'authentification avant de charger les données
  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
      return;
    }
    
    fetchGuestsAndStats();
  }, [isAdmin, navigate]);
  
  // Fonction pour récupérer la liste des invités et les statistiques

  const fetchGuestsAndStats = async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      // Récupérer la liste des invités via JWT
      const guestsResponse = await authenticatedFetch('/api/guests/list');
      
      if (!guestsResponse.ok) {
        const errorText = await guestsResponse.text();
        console.error('Erreur de réponse:', errorText);
        throw new Error(`Erreur lors de la récupération des invités (${guestsResponse.status})`);
      }
      
      const guestsData = await guestsResponse.json();
      const normalizedGuests = (guestsData.success ? guestsData.guests : []).map(g => ({
        ...g,
        // Normaliser le champ de message pour l'UI
        message: g.message ?? g.personalWelcomeMessage ?? ''
      }));
      setGuests(normalizedGuests);
      
      // Récupérer les statistiques via JWT
      const statsResponse = await authenticatedFetch('/api/guests/stats');
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.success ? statsData.stats : null);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: `Erreur: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
    
  // Validation des entrées
  const validateInput = () => {
    const newErrors = {};
    
    if (!newGuest.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }
    
    if (!newGuest.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newGuest.email)) {
      newErrors.email = 'Format d\'email invalide';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGuest(prev => ({ ...prev, [name]: value }));
    
    // Effacer l'erreur lors de la modification
    if (errors[name]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const addGuest = async () => {
    if (!validateInput()) {
      return;
    }
    
    try {
      setIsLoading(true);
      setMessage(null);
      
      // Préparer l'invité à ajouter avec message explicite
      const welcomeMessage = newGuest.message || 
        `Bienvenue ${newGuest.name} ! Nous sommes ravis de vous compter parmi nous.`;
      
      const guestToAdd = { 
        name: newGuest.name,
        email: newGuest.email,
        personalWelcomeMessage: welcomeMessage
      };
      
      // Version temporaire pour l'UI
      const tempGuest = { 
        ...guestToAdd, 
        id: `temp-${Date.now()}`,
        isTemp: true,
        // Utiliser la bonne clé
        message: welcomeMessage
      };
      
      // Ajouter temporairement à l'UI
      setGuests(prev => [...prev, tempGuest]);
      
      // Envoyer au serveur
      const response = await authenticatedFetch('/api/guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(guestToAdd)
      });
      
      if (!response.ok) {
        // Supprimer l'entrée temporaire en cas d'erreur
        setGuests(prev => prev.filter(g => g.id !== tempGuest.id));
        
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'ajout de l\'invité');
      }
      
      const responseData = await response.json();
      
      // Construction de l'objet invité avec la bonne clé
      const addedGuest = {
        ...responseData,
        id: responseData._id,
        // S'assurer que le message est conservé
        message: responseData.personalWelcomeMessage || responseData.message || welcomeMessage
      };
      
      // Remplacer l'entrée temporaire
      setGuests(prev => prev.map(g => g.id === tempGuest.id ? addedGuest : g));
      
      // Réinitialiser le formulaire
      setNewGuest({ name: '', email: '', message: '' }); // Clé 'message'
      
      setMessage({
        type: 'success',
        text: 'Invité ajouté avec succès'
      });
      
      // Mettre à jour les statistiques
      fetchGuestsAndStats();
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: `Erreur: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const removeGuest = async (id) => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      // Si c'est une entrée temporaire, on la supprime simplement
      if (guests.find(g => g.id === id)?.isTemp) {
        setGuests(prev => prev.filter(g => g.id !== id));
        setIsLoading(false);
        return;
      }
      
      // Confirmation de suppression
      if (!window.confirm(`Êtes-vous sûr de vouloir supprimer cet invité ?`)) {
        setIsLoading(false);
        return;
      }
      
      const response = await authenticatedFetch(`/api/guests/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la suppression de l\'invité');
      }
      
      // Supprimer de la liste locale
      setGuests(prev => prev.filter(g => g._id !== id && g.id !== id));
      setMessage({
        type: 'success',
        text: 'Invité supprimé avec succès'
      });
      
      // Mettre à jour les statistiques
      const statsResponse = await authenticatedFetch('/api/guests/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.success ? statsData.stats : null);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: `Erreur: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateQRCodes = async () => {
    if (guests.length === 0) {
      setMessage({
        type: 'error',
        text: 'Ajoutez au moins un invité'
      });
      return;
    }
    
    setIsLoading(true);
    setMessage({
      type: 'info',
      text: 'Génération des QR codes en cours...'
    });
    
    try {
      // Filtrer les invités temporaires
      const realGuests = guests.filter(g => !g.isTemp);
      
      // S'assurer que chaque invité a le bon format de champ 'message'
      const formattedGuests = realGuests.map(guest => ({
        name: guest.name,
        email: guest.email,
        personalWelcomeMessage: guest.message || guest.personalWelcomeMessage || `Bienvenue ${guest.name} ! Nous sommes ravis de vous compter parmi nous.`
      }));
      
      const response = await authenticatedFetch('/api/guests/generate-guest-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ guests: formattedGuests })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la génération des QR codes');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({
          type: 'success',
          text: `${data.guests.length} QR codes générés avec succès!`
        });
        
        // Mise à jour de la liste avec les QR codes générés
        const updatedGuests = [...guests];
        data.guests.forEach(updatedGuest => {
          const index = updatedGuests.findIndex(g => 
            g._id === updatedGuest._id || g.email === updatedGuest.email);
          if (index !== -1) {
            updatedGuests[index] = { 
              ...updatedGuests[index], 
              ...updatedGuest,
              // S'assurer que message est bien préservé
              message: updatedGuest.personalWelcomeMessage || updatedGuest.message || updatedGuests[index].message
            };
          }
        });
        
        setGuests(updatedGuests);
      } else {
        setMessage({
          type: 'error',
          text: 'Erreur: ' + data.message
        });
      }
    } catch (error) {
      console.error('Erreur lors de la génération des QR codes:', error);
      setMessage({
        type: 'error',
        text: `Erreur: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadAllQRCodes = async () => {
    try {
      setIsLoading(true);
      setMessage({
        type: 'info',
        text: 'Préparation du téléchargement...'
      });
      
      const response = await authenticatedFetch('/api/guests/download-qr-codes', {
        method: 'GET'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors du téléchargement des QR codes');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'qr-codes-invites.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setMessage({
        type: 'success',
        text: 'Téléchargement terminé'
      });
    } catch (error) {
      console.error('Erreur lors du téléchargement des QR codes:', error);
      setMessage({
        type: 'error',
        text: `Erreur: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Affichage du message avec icône contextuelle
  const MessageDisplay = ({ message }) => {
    if (!message) return null;
    
    const bgColor = 
      message.type === 'error' ? 'bg-red-100 text-red-700' :
      message.type === 'success' ? 'bg-green-100 text-green-700' :
      'bg-amber-100 text-amber-700';
    
    const Icon = 
      message.type === 'error' ? AlertTriangle :
      message.type === 'success' ? Check :
      RefreshCw;
    
    return (
      <div className={`p-3 mb-4 rounded flex items-center ${bgColor}`}>
        <Icon size={18} className="mr-2 flex-shrink-0" />
        <span>{message.text}</span>
        <button 
          onClick={() => setMessage(null)} 
          className="ml-auto text-gray-500 hover:text-gray-700"
        >
          <X size={16} />
        </button>
      </div>
    );
  };
  
  // Si l'utilisateur n'est pas authentifié, ne rien rendre (la redirection se fait dans useEffect)
  if (!isAdmin) {
    return null;
  }
  
  return (
    <>
    <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
      <div className="bg-white rounded-lg shadow-xl">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-800">Gestion des invités</h2>
            
            <button 
              onClick={logout}
              className="w-full sm:w-auto px-4 py-2 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-700 rounded-lg transition touch-manipulation text-sm sm:text-base"
            >
              Déconnexion
            </button>
          </div>
        </div>
      
        {/* Affichage des messages */}
        {message && (
          <div className="p-4 sm:p-6">
            <MessageDisplay message={message} />
          </div>
        )}
      
        {/* Statistiques */}
        {stats && (
          <div className="p-4 sm:p-6 bg-amber-50 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold mb-3 text-amber-700">Statistiques</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-amber-600 font-medium text-sm">Total invités</div>
                <div className="text-xl sm:text-2xl font-bold">{stats.totalGuests}</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-amber-600 font-medium text-sm">Confirmés</div>
                <div className="text-xl sm:text-2xl font-bold">{stats.attendingGuests}</div>
                <div className="text-xs text-gray-500">{stats.confirmationRate}% des réponses</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-amber-600 font-medium text-sm">Total participants</div>
                <div className="text-xl sm:text-2xl font-bold">{stats.totalAttendees}</div>
                <div className="text-xs text-gray-500">Invités + accompagnants</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-amber-600 font-medium text-sm">Hébergements</div>
                <div className="text-xl sm:text-2xl font-bold">{stats.accommodationNeeded}</div>
                <div className="text-xs text-gray-500">Besoins de logement</div>
              </div>
            </div>
          </div>
        )}
      
        {/* Formulaire d'ajout d'invité */}
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-amber-50">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-amber-700">Ajouter un invité</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div>
              <label className="block text-xs sm:text-sm text-amber-700 mb-1">Nom*</label>
              <input 
                type="text" 
                name="name" 
                value={newGuest.name} 
                onChange={handleInputChange} 
                className={`w-full p-2.5 sm:p-3 border rounded-lg text-sm sm:text-base touch-manipulation ${
                  errors.name ? 'border-red-500 bg-red-50' : 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                }`}
                placeholder="Nom de l'invité"
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm text-amber-700 mb-1">Email*</label>
              <input 
                type="email" 
                name="email" 
                value={newGuest.email} 
                onChange={handleInputChange} 
                className={`w-full p-2.5 sm:p-3 border rounded-lg text-sm sm:text-base touch-manipulation ${
                  errors.email ? 'border-red-500 bg-red-50' : 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                }`}
                placeholder="email@exemple.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm text-amber-700 mb-1">Message personnalisé</label>
              <input 
                type="text" 
                name="message" 
                value={newGuest.message} 
                onChange={handleInputChange} 
                className="w-full p-2.5 sm:p-3 border border-amber-300 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm sm:text-base touch-manipulation"
                placeholder="Message d'accueil personnalisé"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <button 
            onClick={addGuest}
            disabled={isLoading}
            className={`w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg transition touch-manipulation text-sm sm:text-base ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus size={16} className="mr-2" />
            Ajouter
          </button>
        </div>
      
        {/* Liste des invités */}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-amber-700">
              Liste des invités ({guests.length})
            </h3>
            
            <button 
              onClick={fetchGuestsAndStats}
              disabled={isLoading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-amber-600 hover:text-amber-800 active:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition touch-manipulation text-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Rafraîchir la liste"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span className="sm:hidden">Actualiser</span>
            </button>
          </div>
        
          {guests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-amber-600 italic text-sm sm:text-base">Aucun invité ajouté pour le moment</p>
            </div>
          ) : (
            <div className="block sm:hidden space-y-3">
              {/* Affichage mobile : cartes */}
              {guests.map(guest => (
                <div key={guest.id || guest._id} className={`bg-white border border-amber-200 rounded-lg p-4 ${guest.isTemp ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-amber-800 truncate">
                        {guest.name}
                        {guest.isTemp && <span className="ml-2 italic text-amber-500 text-xs">(en cours...)</span>}
                      </h4>
                      <p className="text-sm text-gray-600 truncate">{guest.email}</p>
                    </div>
                    <button 
                      onClick={() => removeGuest(guest.id || guest._id)}
                      disabled={isLoading}
                      className={`text-red-500 hover:text-red-700 active:text-red-800 p-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Supprimer"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-3">
                      {guest.attending === true && (
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          <Check size={10} className="mr-1" />
                          Confirmé
                        </span>
                      )}
                      {guest.attending === false && (
                        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          <X size={10} className="mr-1" />
                          Décliné
                        </span>
                      )}
                      {guest.attending === null && !guest.isTemp && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                          En attente
                        </span>
                      )}
                      
                      {guest.qrCodeUrl && (
                        <a href={guest.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800 p-1">
                          <QrCode size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  {guest.message && (
                    <p className="text-xs text-gray-500 mt-2 italic truncate" title={guest.message}>
                      "{guest.message}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Affichage desktop : tableau */}
          {guests.length > 0 && (
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-amber-100">
                    <th className="border border-amber-300 p-2 text-left text-xs sm:text-sm">Nom</th>
                    <th className="border border-amber-300 p-2 text-left text-xs sm:text-sm">Email</th>
                    <th className="border border-amber-300 p-2 text-left text-xs sm:text-sm">Message</th>
                    <th className="border border-amber-300 p-2 text-center text-xs sm:text-sm">Statut</th>
                    <th className="border border-amber-300 p-2 text-center text-xs sm:text-sm">QR Code</th>
                    <th className="border border-amber-300 p-2 text-center text-xs sm:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map(guest => (
                    <tr key={guest.id || guest._id} className={`hover:bg-amber-50 ${guest.isTemp ? 'opacity-60' : ''}`}>
                      <td className="border border-amber-300 p-2 text-xs sm:text-sm">
                        <div>
                          {guest.name}
                          {guest.isTemp && <div className="italic text-amber-500 text-xs">(en cours...)</div>}
                        </div>
                      </td>
                      <td className="border border-amber-300 p-2 text-xs sm:text-sm break-all">{guest.email}</td>
                      <td className="border border-amber-300 p-2 text-xs max-w-xs truncate" title={guest.message}>{guest.message}</td>
                      <td className="border border-amber-300 p-2 text-center">
                        {guest.attending === true && (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            <Check size={10} className="mr-1" />
                            OK
                          </span>
                        )}
                        {guest.attending === false && (
                          <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            <X size={10} className="mr-1" />
                            Non
                          </span>
                        )}
                        {guest.attending === null && !guest.isTemp && (
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            Attente
                          </span>
                        )}
                      </td>
                      <td className="border border-amber-300 p-2 text-center">
                        {guest.qrCodeUrl ? (
                          <a href={guest.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800 p-1 inline-block">
                            <QrCode size={16} />
                          </a>
                        ) : (
                          <span className="text-amber-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="border border-amber-300 p-2 text-center">
                        <button 
                          onClick={() => removeGuest(guest.id || guest._id)}
                          disabled={isLoading}
                          className={`text-red-500 hover:text-red-700 active:text-red-800 p-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Supprimer"
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      
          {/* Actions de groupe */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button 
                onClick={generateQRCodes}
                disabled={isLoading || guests.length === 0 || guests.some(g => g.isTemp)}
                className={`flex items-center justify-center px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg shadow-lg transition touch-manipulation text-sm sm:text-base ${
                  (isLoading || guests.length === 0 || guests.some(g => g.isTemp)) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <QrCode size={16} className="mr-2" />
                Générer les QR codes
              </button>
              
              <button 
                onClick={downloadAllQRCodes}
                disabled={isLoading || guests.length === 0 || !guests.some(g => g.qrCodeUrl)}
                className={`flex items-center justify-center px-6 py-3 bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white rounded-lg shadow-lg transition touch-manipulation text-sm sm:text-base ${
                  (isLoading || guests.length === 0 || !guests.some(g => g.qrCodeUrl)) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download size={16} className="mr-2" />
                <span className="hidden sm:inline">Télécharger tous les QR codes</span>
                <span className="sm:hidden">Télécharger QR codes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default GuestManager;