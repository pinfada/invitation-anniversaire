// Outil d'administration pour générer les QR codes
// client/src/components/admin/GuestManager.js
import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash, QrCode } from 'lucide-react';

const GuestManager = () => {
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState({ 
    name: '', 
    email: '', 
    personalWelcomeMessage: '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Charger la liste des invités existants
  useEffect(() => {
    const fetchGuests = async () => {
        try {
          const response = await fetch('/api/guests');
          const data = await response.json();
          setGuests(data);
        } catch (error) {
          console.error('Erreur:', error);
        }
    };
    
    fetchGuests();
  }, []);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGuest(prev => ({ ...prev, [name]: value }));
  };
  
  const addGuest = () => {
    if (!newGuest.name || !newGuest.email) {
      setMessage('Veuillez remplir le nom et l\'email');
      return;
    }
    
    setGuests(prev => [...prev, { 
      ...newGuest, 
      id: Date.now(), // ID temporaire pour l'UI
      personalWelcomeMessage: newGuest.personalWelcomeMessage || `Bienvenue ${newGuest.name} ! Nous sommes ravis de vous compter parmi nous.`
    }]);
    
    setNewGuest({ name: '', email: '', personalWelcomeMessage: '' });
  };
  
  const removeGuest = (id) => {
    setGuests(prev => prev.filter(guest => guest.id !== id));
  };
  
  const generateQRCodes = async () => {
    if (guests.length === 0) {
      setMessage('Ajoutez au moins un invité');
      return;
    }
    
    setIsLoading(true);
    setMessage('Génération des QR codes en cours...');
    
    try {
      const response = await fetch('/api/guests/generate-guest-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ guests })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(`${data.guests.length} QR codes générés avec succès!`);
        setGuests(data.guests);
      } else {
        setMessage('Erreur: ' + data.message);
      }
    } catch (error) {
      console.error('Erreur lors de la génération des QR codes:', error);
      setMessage('Erreur lors de la génération des QR codes');
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadAllQRCodes = async () => {
    try {
      const response = await fetch('/api/guests/download-qr-codes', {
        method: 'GET'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'qr-codes-invites.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setMessage('Erreur lors du téléchargement des QR codes');
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement des QR codes:', error);
      setMessage('Erreur lors du téléchargement des QR codes');
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-amber-800">Gestion des invités</h2>
      
      {message && (
        <div className={`p-3 mb-4 rounded ${message.includes('Erreur') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      
      <div className="mb-8 p-4 border border-amber-200 rounded-lg bg-amber-50">
        <h3 className="text-lg font-semibold mb-3 text-amber-700">Ajouter un invité</h3>
        
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-amber-700 mb-1">Nom</label>
            <input 
              type="text" 
              name="name" 
              value={newGuest.name} 
              onChange={handleInputChange} 
              className="w-full p-2 border border-amber-300 rounded"
              placeholder="Nom de l'invité"
            />
          </div>
          
          <div>
            <label className="block text-sm text-amber-700 mb-1">Email</label>
            <input 
              type="email" 
              name="email" 
              value={newGuest.email} 
              onChange={handleInputChange} 
              className="w-full p-2 border border-amber-300 rounded"
              placeholder="email@exemple.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-amber-700 mb-1">Message personnalisé</label>
            <input 
              type="text" 
              name="personalWelcomeMessage" 
              value={newGuest.personalWelcomeMessage} 
              onChange={handleInputChange} 
              className="w-full p-2 border border-amber-300 rounded"
              placeholder="Message d'accueil personnalisé"
            />
          </div>
        </div>
        
        <button 
          onClick={addGuest}
          className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded"
        >
          <Plus size={18} className="mr-1" />
          Ajouter
        </button>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-amber-700">Liste des invités ({guests.length})</h3>
        
        {guests.length === 0 ? (
          <p className="text-amber-600 italic">Aucun invité ajouté pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-amber-100">
                  <th className="border border-amber-300 p-2 text-left">Nom</th>
                  <th className="border border-amber-300 p-2 text-left">Email</th>
                  <th className="border border-amber-300 p-2 text-left">Message personnalisé</th>
                  <th className="border border-amber-300 p-2 text-left">QR Code</th>
                  <th className="border border-amber-300 p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {guests.map(guest => (
                  <tr key={guest.id || guest._id} className="hover:bg-amber-50">
                    <td className="border border-amber-300 p-2">{guest.name}</td>
                    <td className="border border-amber-300 p-2">{guest.email}</td>
                    <td className="border border-amber-300 p-2">{guest.personalWelcomeMessage}</td>
                    <td className="border border-amber-300 p-2 text-center">
                      {guest.qrCodeUrl ? (
                        <a href={guest.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800">
                          <QrCode size={18} />
                        </a>
                      ) : (
                        <span className="text-amber-400">Non généré</span>
                      )}
                    </td>
                    <td className="border border-amber-300 p-2 text-center">
                      <button 
                        onClick={() => removeGuest(guest.id || guest._id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 mt-6">
        <button 
          onClick={generateQRCodes}
          disabled={isLoading || guests.length === 0}
          className={`flex items-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow ${
            (isLoading || guests.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <QrCode size={18} className="mr-2" />
          Générer les QR codes
        </button>
        
        <button 
          onClick={downloadAllQRCodes}
          disabled={isLoading || guests.length === 0}
          className={`flex items-center px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-lg shadow ${
            (isLoading || guests.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Download size={18} className="mr-2" />
          Télécharger tous les QR codes
        </button>
      </div>
    </div>
  );
};

export default GuestManager;