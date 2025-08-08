// PhotoShare.js - Composant pour la PWA de partage de photos
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';

const PhotoShare = ({ guestData }) => {
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploaderName, setUploaderName] = useState('');
  const [showNameInput, setShowNameInput] = useState(true);
  const fileInputRef = useRef(null);
  const { authenticatedFetch } = useAuth();
  
  // Charger le nom de l'invité depuis les données
  useEffect(() => {
    if (guestData?.name) {
      setUploaderName(guestData.name);
      setShowNameInput(false);
    }
  }, [guestData]);
  
  // Charger les photos existantes depuis le backend
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch('/api/photos');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Adapter au format local (timestamp objet Date)
            const normalized = (data.photos || []).map(p => ({
              id: p._id,
              src: p.url,
              timestamp: new Date(p.createdAt),
              user: p.uploadedBy || 'Invité'
            }));
            setPhotos(normalized);
          }
        }
      } catch (e) {
        console.error('Erreur lors du chargement des photos:', e);
      }
    };
    fetchPhotos();

    // Vérifier si le service worker est supporté
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker enregistré avec succès:', registration.scope);
        })
        .catch((error) => {
          console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
        });
    }
  }, []);
  
  const handlePhotoCapture = () => {
    fileInputRef.current.click();
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setCompressionProgress(10);
      
      // Options de compression
      const options = {
        maxSizeMB: 1,             // Max 1MB
        maxWidthOrHeight: 1200,   // Redimensionnement préservant ratio
        useWebWorker: true,       // Utiliser un thread séparé
        onProgress: (p) => setCompressionProgress(10 + Math.round(p * 80))
      };
      
      // Compression de l'image avant preview
      const compressedFile = await imageCompression(file, options);
      setCompressionProgress(95);
      
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewPhoto({
          id: `temp-${Date.now()}`,
          src: reader.result,
          timestamp: new Date(),
          user: uploaderName || 'Invité',
          originalSize: file.size,
          compressedSize: compressedFile.size
        });
        setCompressionProgress(0);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error("Erreur lors de la compression:", err);
      setCompressionProgress(0);
      // Fallback sur l'approche d'origine en cas d'erreur
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewPhoto({
          id: `temp-${Date.now()}`,
          src: reader.result,
          timestamp: new Date(),
          user: uploaderName || 'Invité'
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleUpload = async () => {
    if (!previewPhoto) return;
    
    setIsUploading(true);
    try {
      // Convertir dataURL -> Blob
      const response = await fetch(previewPhoto.src);
      const blob = await response.blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      // Préparer FormData
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('name', uploaderName || previewPhoto.user || 'Invité');

      // Envoi au backend public (pas besoin JWT)
      const uploadRes = await fetch('/api/photos', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors de l\'upload');
      }

      const data = await uploadRes.json();
      const saved = {
        id: data.photo._id,
        src: data.photo.url,
        timestamp: new Date(data.photo.createdAt),
        user: data.photo.uploadedBy || 'Invité'
      };
      setPhotos([saved, ...photos]);
      setPreviewPhoto(null);
    } catch (e) {
      console.error('Upload échoué:', e);
      alert(e.message || 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };
  
  const cancelUpload = () => {
    setPreviewPhoto(null);
  };
  
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 p-3 sm:p-4">
      <header className="bg-amber-800 text-white p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-center">Partagez vos photos</h1>
      </header>
      
      {/* Input pour le nom si pas d'invité connecté */}
      {showNameInput && (
        <div className="bg-white p-4 rounded-lg shadow-lg mb-4 sm:mb-6">
          <label className="block text-amber-700 mb-2 font-semibold text-sm sm:text-base">Votre nom</label>
          <input 
            type="text" 
            value={uploaderName} 
            onChange={(e) => setUploaderName(e.target.value)}
            placeholder="Entrez votre nom"
            className="w-full p-3 border border-amber-300 rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 text-base touch-manipulation"
          />
          <button 
            onClick={() => setShowNameInput(false)}
            className="mt-3 w-full sm:w-auto px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:bg-amber-800 transition touch-manipulation"
          >
            Continuer
          </button>
        </div>
      )}
      
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        capture="environment"
      />

      {compressionProgress > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg w-full max-w-sm">
            <p className="text-center mb-3 text-sm sm:text-base">Optimisation de l'image...</p>
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-amber-600 rounded-full transition-all duration-300" 
                style={{width: `${compressionProgress}%`}}
              />
            </div>
            <p className="text-center mt-2 text-xs text-gray-600">{compressionProgress}%</p>
          </div>
        </div>
      )}
      
      {!showNameInput && previewPhoto ? (
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-lg mb-4 sm:mb-6">
          <div className="relative">
            <img 
              src={previewPhoto.src} 
              alt="Aperçu" 
              className="w-full h-auto rounded-lg max-h-80 sm:max-h-96 object-contain"
            />
            <button 
              onClick={cancelUpload}
              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white p-2 rounded-full touch-manipulation shadow-lg"
            >
              <X size={18} />
            </button>
          </div>
          
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className={`w-full mt-4 py-3.5 rounded-lg flex items-center justify-center ${
              isUploading ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
            } text-white font-semibold touch-manipulation transition`}
          >
            <span className="flex items-center">
              {isUploading ? 'Envoi en cours...' : 'Partager la photo'}
              {!isUploading && <Upload className="ml-2" size={18} />}
            </span>
          </button>
        </div>
      ) : !showNameInput ? (
        <button 
          onClick={handlePhotoCapture}
          className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white p-4 sm:p-6 rounded-lg shadow-lg flex flex-col items-center justify-center mb-4 sm:mb-6 touch-manipulation transition"
        >
          <Camera size={40} className="sm:size-48 mb-2" />
          <span className="text-lg sm:text-xl font-semibold">Prendre une photo</span>
          <span className="text-sm opacity-90 mt-1 text-center">Partagé par {uploaderName}</span>
        </button>
      ) : null}
      
      <div className="bg-white bg-opacity-80 p-3 sm:p-4 rounded-lg">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-amber-800">Photos partagées</h2>
        
        {photos.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-amber-600">
            <p className="text-sm sm:text-base">Aucune photo partagée pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden shadow-lg aspect-square group">
                <img 
                  src={photo.src} 
                  alt={`Partagée par ${photo.user}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <p className="font-medium text-sm truncate">{photo.user}</p>
                    <p className="text-xs opacity-75">
                      {photo.timestamp.toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoShare;