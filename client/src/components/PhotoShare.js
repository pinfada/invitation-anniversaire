// PhotoShare.js - Composant pour la PWA de partage de photos
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const PhotoShare = () => {
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // Simuler le chargement des photos existantes depuis un backend
  useEffect(() => {
    // Dans une implémentation réelle, nous ferions un appel API ici
    const mockPhotos = [];
    setPhotos(mockPhotos);
    
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
          user: 'Moi',
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
          user: 'Moi'
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleUpload = async () => {
    if (!previewPhoto) return;
    
    setIsUploading(true);
    
    // Simuler un délai de téléchargement
    setTimeout(() => {
      // Dans une implémentation réelle, nous enverrions l'image au backend ici
      setPhotos([previewPhoto, ...photos]);
      setPreviewPhoto(null);
      setIsUploading(false);
    }, 1500);
  };
  
  const cancelUpload = () => {
    setPreviewPhoto(null);
  };
  
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 p-4">
      <header className="bg-amber-800 text-white p-4 rounded-lg mb-6">
        <h1 className="text-xl font-bold text-center">Partagez vos photos</h1>
      </header>
      
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        capture="environment"
      />

      {compressionProgress > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-lg w-64">
            <p className="text-center mb-2">Optimisation de l'image...</p>
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-amber-600 rounded-full transition-all duration-300" 
                style={{width: `${compressionProgress}%`}}
              />
            </div>
          </div>
        </div>
      )}
      
      {previewPhoto ? (
        <div className="bg-white p-4 rounded-lg shadow-lg mb-6">
          <div className="relative">
            <img 
              src={previewPhoto.src} 
              alt="Aperçu" 
              className="w-full h-auto rounded-lg"
            />
            <button 
              onClick={cancelUpload}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className={`w-full mt-4 py-3 rounded-lg flex items-center justify-center ${
              isUploading ? 'bg-amber-400' : 'bg-amber-600'
            } text-white font-semibold`}
          >
            {isUploading ? 'Envoi en cours...' : 'Partager la photo'}
            <Upload className="ml-2" size={18} />
          </button>
        </div>
      ) : (
        <button 
          onClick={handlePhotoCapture}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-lg shadow-lg flex flex-col items-center justify-center mb-6"
        >
          <Camera size={48} className="mb-2" />
          <span className="text-lg font-semibold">Prendre une photo</span>
        </button>
      )}
      
      <div className="bg-white bg-opacity-80 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4 text-amber-800">Photos partagées</h2>
        
        {photos.length === 0 ? (
          <div className="text-center py-8 text-amber-600">
            <p>Aucune photo partagée pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden shadow">
                <img 
                  src={photo.src} 
                  alt="Photo partagée" 
                  className="w-full h-auto"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-sm">
                  <p>{photo.user}</p>
                  <p className="text-xs opacity-75">
                    {photo.timestamp.toLocaleString()}
                  </p>
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