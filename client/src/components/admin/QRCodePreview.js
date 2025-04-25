import React, { useState } from 'react';
import { Printer, Download, Share2, Edit } from 'lucide-react';

const QRCodePreview = () => {
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // Exemple de données d'invités avec QR codes
  const guestList = [
    {
      id: '1',
      name: 'Marie Dupont',
      email: 'marie@example.com',
      uniqueCode: 'abc123',
      personalWelcomeMessage: 'Bonjour Marie ! Nous sommes ravis de te voir à notre fête. N\'oublie pas d\'apporter ton maillot de bain pour la piscine !',
      qrCodeUrl: '/api/placeholder/200/200' // Placeholder pour la démo
    },
    {
      id: '2',
      name: 'Jean Martin',
      email: 'jean@example.com',
      uniqueCode: 'def456',
      personalWelcomeMessage: 'Salut Jean ! Heureux que tu puisses venir. On va bien s\'amuser !',
      qrCodeUrl: '/api/placeholder/200/200' // Placeholder pour la démo
    },
    {
      id: '3',
      name: 'Sophie Leclerc',
      email: 'sophie@example.com',
      uniqueCode: 'ghi789',
      personalWelcomeMessage: 'Chère Sophie, nous sommes impatients de te revoir à l\'occasion de cet anniversaire !',
      qrCodeUrl: '/api/placeholder/200/200' // Placeholder pour la démo
    }
  ];
  
  const handleGuestSelect = (guest) => {
    setSelectedGuest(guest);
    setCustomMessage(guest.personalWelcomeMessage);
    setEditMode(false);
  };
  
  const saveCustomMessage = () => {
    // Dans une implémentation réelle, envoyer cette mise à jour au backend
    console.log(`Mise à jour du message pour ${selectedGuest.name}: ${customMessage}`);
    
    // Simuler la mise à jour
    setSelectedGuest({
      ...selectedGuest,
      personalWelcomeMessage: customMessage
    });
    
    setEditMode(false);
  };
  
  const generatePrintableVersion = () => {
    // Dans une implémentation réelle, cela générerait une version imprimable
    // Pour la démo, on ouvre simplement une nouvelle fenêtre
    if (!selectedGuest) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${selectedGuest.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 40px; }
            .card { border: 1px solid #ccc; padding: 20px; max-width: 400px; margin: 0 auto; text-align: center; }
            .title { color: #B45309; font-size: 24px; margin-bottom: 20px; }
            .qr-code { margin: 20px 0; }
            .instructions { color: #666; font-size: 14px; margin-top: 20px; }
            .welcome-message { border-top: 1px dashed #ccc; margin-top: 20px; padding-top: 20px; font-style: italic; color: #B45309; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">Invitation - Anniversaire de Thomas</div>
            <div><strong>${selectedGuest.name}</strong></div>
            <div class="qr-code">
              <img src="${selectedGuest.qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px;">
            </div>
            <div class="instructions">
              Scannez ce QR code avec votre smartphone pour accéder à l'invitation et confirmer votre présence.
            </div>
            <div class="welcome-message">
              "${selectedGuest.personalWelcomeMessage}"
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  const downloadQRCode = () => {
    // Dans une implémentation réelle, cela téléchargerait l'image du QR code
    // Pour la démo, on affiche simplement un message
    alert(`Téléchargement du QR code pour ${selectedGuest.name}`);
  };
  
  const shareQRCode = () => {
    // Dans une implémentation réelle, cela utiliserait l'API Web Share si disponible
    // Pour la démo, on affiche simplement un message
    const shareUrl = `https://votre-site.onrender.com/invitation?code=${selectedGuest.uniqueCode}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Invitation pour ${selectedGuest.name}`,
        text: 'Voici votre invitation personnalisée pour mon anniversaire!',
        url: shareUrl
      });
    } else {
      // Fallback pour les navigateurs qui ne supportent pas l'API Web Share
      alert(`Lien à partager: ${shareUrl}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="bg-amber-800 text-white p-4 rounded-lg mb-6">
          <h1 className="text-2xl font-bold text-center">QR Codes personnalisés</h1>
          <p className="text-center text-amber-200 mt-1">Prévisualisez et gérez les QR codes de vos invités</p>
        </header>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Liste des invités */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4 h-full">
              <h2 className="text-xl font-bold text-amber-800 mb-4">Invités</h2>
              
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {guestList.map(guest => (
                  <div 
                    key={guest.id} 
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedGuest?.id === guest.id 
                        ? 'bg-amber-100 border-l-4 border-amber-500' 
                        : 'bg-amber-50 hover:bg-amber-100'
                    }`}
                    onClick={() => handleGuestSelect(guest)}
                  >
                    <h3 className="font-semibold text-amber-800">{guest.name}</h3>
                    <p className="text-sm text-amber-600">{guest.email}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Prévisualisation */}
          <div className="lg:col-span-2">
            {selectedGuest ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-amber-800">{selectedGuest.name}</h2>
                    <p className="text-amber-600">{selectedGuest.email}</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button 
                      onClick={generatePrintableVersion}
                      className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg flex items-center"
                      title="Imprimer"
                    >
                      <Printer size={18} />
                    </button>
                    
                    <button 
                      onClick={downloadQRCode}
                      className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg flex items-center"
                      title="Télécharger"
                    >
                      <Download size={18} />
                    </button>
                    
                    <button 
                      onClick={shareQRCode}
                      className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg flex items-center"
                      title="Partager"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:space-x-6">
                  <div className="flex-shrink-0 mb-4 md:mb-0">
                    <div className="bg-amber-50 p-4 rounded-lg flex items-center justify-center">
                      <img 
                        src={selectedGuest.qrCodeUrl} 
                        alt={`QR Code pour ${selectedGuest.name}`}
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                    
                    <div className="mt-3 text-center text-sm text-amber-600">
                      Code unique: {selectedGuest.uniqueCode}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-amber-800">Message d'accueil personnalisé</h3>
                        
                        <button 
                          onClick={() => setEditMode(!editMode)}
                          className="p-1 text-amber-600 hover:text-amber-800"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      
                      {editMode ? (
                        <>
                          <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            className="w-full p-3 border border-amber-300 rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 min-h-32"
                          ></textarea>
                          
                          <div className="flex justify-end mt-2 space-x-2">
                            <button 
                              onClick={() => setEditMode(false)}
                              className="px-3 py-1 text-amber-600 hover:text-amber-800"
                            >
                              Annuler
                            </button>
                            <button 
                              onClick={saveCustomMessage}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded"
                            >
                              Enregistrer
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 bg-amber-50 rounded-lg italic">
                          "{selectedGuest.personalWelcomeMessage}"
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 bg-amber-100 rounded-lg">
                      <h3 className="font-semibold text-amber-800 mb-2">Comment utiliser</h3>
                      <ul className="space-y-2 text-amber-700">
                        <li className="flex items-start">
                          <span className="mr-2">1.</span>
                          <span>Imprimez ou partagez ce QR code avec {selectedGuest.name}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">2.</span>
                          <span>À l'arrivée, l'invité scanne le QR code avec l'app</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">3.</span>
                          <span>Un message d'accueil personnalisé s'affiche</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 flex items-center justify-center h-full">
                <div className="text-center text-amber-600">
                  <p className="mb-4">Sélectionnez un invité pour prévisualiser son QR code</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodePreview;