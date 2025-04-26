import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw, UserCheck, Home } from 'lucide-react';
import jsQR from 'jsqr';

const QRScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [guestData, setGuestData] = useState(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  
  // Référence au canvas et à la vidéo pour le scanner QR
  const videoRef = React.useRef();
  const canvasRef = React.useRef();
  
  // Gestion de l'effet de transition pour le message d'accueil
  useEffect(() => {
    if (guestData) {
      setWelcomeVisible(true);
      // Masquer le message après 5 secondes
      const timer = setTimeout(() => {
        setWelcomeVisible(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [guestData]);
  
  // Nettoyer le stream de la caméra lors du démontage du composant
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);
  
  // Fonction pour démarrer la caméra et le scanner
  const startScanner = async () => {
    setScanning(true);
    setError('');
    setGuestData(null);
    setCheckedIn(false);
    
    try {
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        
        // Commencer l'analyse des QR codes
        requestAnimationFrame(scanQRCode);
      }
    } catch (err) {
      console.error('Erreur lors de l\'accès à la caméra:', err);
      setError('Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès ou utiliser un autre appareil.');
      setScanning(false);
    }
  };
  
  // Arrêter le scanner
  const stopScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setScanning(false);
  };
  
  // Fonction pour scanner et analyser les QR codes
  const scanQRCode = async () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;
    
    // Importer jsQR uniquement lorsque nécessaire
    // Note: Dans une implémentation réelle, il faudrait installer jsQR via npm
    // et l'importer en haut du fichier
    if (typeof jsQR === 'undefined') {
      // Simulation d'une importation dynamique
      console.log('Dans une implémentation réelle, jsQR serait utilisé ici');
      // Simuler la détection d'un QR code après 3 secondes
      setTimeout(() => {
        const mockCode = "https://votre-site.onrender.com/invitation?code=abc123";
        handleQRCode(mockCode);
      }, 3000);
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // S'assurer que la vidéo est prête
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      
      // Dessiner l'image vidéo sur le canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Obtenir les données d'image du canvas
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Analyser l'image pour trouver un QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        // Un QR code a été trouvé
        handleQRCode(code.data);
        return;
      }
    }
    
    // Continuer à scanner
    requestAnimationFrame(scanQRCode);
  };
  
  // Traiter un QR code détecté
  const handleQRCode = async (codeData) => {
    // Arrêter le scanner
    stopScanner();
    
    try {
      // Extraire le code unique de l'URL
      let code = codeData;
      if (codeData.includes('?code=')) {
        code = codeData.split('?code=')[1];
      }
      
      // Vérifier le code auprès du serveur
      // Dans une implémentation réelle, ce serait un appel API
      // const response = await fetch(`/api/guests/verify/${code}`);
      // const data = await response.json();
      
      // Pour la démo, simuler une réponse positive
      const mockData = {
        success: true,
        guest: {
          name: "Marie Dupont",
          email: "marie@example.com",
          personalWelcomeMessage: "Bonjour Marie ! Nous sommes ravis de te voir à notre fête. N'oublie pas d'apporter ton maillot de bain pour la piscine !",
          hasCheckedIn: false
        }
      };
      
      if (mockData.success) {
        setGuestData(mockData.guest);
        
        // Enregistrer l'arrivée de l'invité si ce n'est pas déjà fait
        if (!mockData.guest.hasCheckedIn) {
          // Dans une implémentation réelle, ce serait un appel API
          // const checkInResponse = await fetch(`/api/guests/check-in/${code}`, { method: 'POST' });
          // const checkInData = await checkInResponse.json();
          setCheckedIn(true);
        }
      } else {
        setError('Code QR invalide ou expiré.');
      }
    } catch (err) {
      console.error('Erreur lors de la vérification du QR code:', err);
      setError('Erreur lors de la vérification du code. Veuillez réessayer.');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 p-4 flex flex-col">
      <header className="bg-amber-800 text-white p-4 rounded-lg mb-6">
        <h1 className="text-xl font-bold text-center">Anniversaire de Mitch</h1>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center relative">
        {error && (
          <div className="w-full max-w-md bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p>{error}</p>
          </div>
        )}
        
        {guestData ? (
          <div className={`w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-500 transform ${
            welcomeVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <div className="bg-amber-600 p-6 text-white">
              <UserCheck className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-2">Bienvenue !</h2>
              <p className="text-center text-white text-opacity-90">
                {checkedIn ? "Vous venez d'arriver, super !" : "Ravi de vous revoir !"}
              </p>
            </div>
            
            <div className="p-6">
              <h3 className="text-xl font-bold text-amber-800 mb-4">{guestData.name}</h3>
              <p className="text-amber-700 mb-6">{guestData.personalWelcomeMessage}</p>
              
              <div className="flex justify-between">
                <button 
                  onClick={startScanner}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg flex items-center"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Scanner un autre code
                </button>
                
                <button 
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg flex items-center"
                >
                  <Home size={18} className="mr-2" />
                  Accueil
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {scanning ? (
              <div className="relative w-full max-w-md aspect-video bg-black rounded-lg overflow-hidden">
                <video 
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                ></video>
                
                <canvas 
                  ref={canvasRef}
                  className="hidden"
                ></canvas>
                
                <div className="absolute inset-0 border-2 border-white border-opacity-50 rounded-lg"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-amber-500 border-dashed rounded-lg"></div>
                </div>
                
                <button 
                  onClick={stopScanner}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white bg-opacity-80 text-amber-800 rounded-full"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Camera className="w-24 h-24 mx-auto text-amber-600 mb-6" />
                <h2 className="text-2xl font-bold mb-4 text-amber-800">Scanner votre code QR</h2>
                <p className="text-amber-700 mb-8 max-w-md mx-auto">
                  Utilisez l'appareil photo pour scanner le QR code qui vous a été fourni dans votre invitation.
                </p>
                
                <button 
                  onClick={startScanner}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105"
                >
                  Ouvrir le scanner
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default QRScanner;