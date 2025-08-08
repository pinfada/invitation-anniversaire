// client/src/components/InteractiveMap.js - Version Leaflet
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MapPin, ExternalLink, Navigation, Phone, Compass } from 'lucide-react';

const InteractiveMap = ({ locationDetails }) => {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);

  // Configuration de la carte (mémorisée pour stabiliser les dépendances)
  const eventLocation = useMemo(() => (
    locationDetails?.location?.coordinates || { lat: 46.1603986, lng: -1.1770363 }
  ), [locationDetails]);
  const locationName = useMemo(() => (
    locationDetails?.location?.name || "Villa pour les vacances"
  ), [locationDetails]);
  const locationAddress = useMemo(() => (
    locationDetails?.location?.address || "18 Rue du Stade, 17000 La Rochelle, France, La Rochelle"
  ), [locationDetails]);
  const accessCode = useMemo(() => (
    locationDetails?.location?.accessCode || "1234"
  ), [locationDetails]);

  // Charger Leaflet CSS et JS
  useEffect(() => {
    loadLeafletResources();
  }, []);

  // L'initialisation de la carte est gérée plus bas, après la déclaration de initializeMap

  const loadLeafletResources = async () => {
    try {
      // Charger le CSS Leaflet
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      // Charger le JS Leaflet
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      setIsMapLoaded(true);
    } catch (error) {
      console.error('Erreur lors du chargement de Leaflet:', error);
      setMapError('Erreur lors du chargement de la carte');
    }
  };

  const initializeMap = useCallback(() => {
    if (!window.L || !mapRef.current || leafletMapRef.current) return;

    try {
      // Créer la carte
      const map = window.L.map(mapRef.current).setView([eventLocation.lat, eventLocation.lng], 15);

      // Ajouter les tuiles OpenStreetMap
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Créer une icône personnalisée pour l'événement
      const eventIcon = window.L.divIcon({
        html: `
          <div style="
            background: #f59e0b;
            border: 3px solid #d97706;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          ">
            <div style="
              background: white;
              border-radius: 50%;
              width: 12px;
              height: 12px;
            "></div>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      // Ajouter le marqueur de l'événement
      const eventMarker = window.L.marker([eventLocation.lat, eventLocation.lng], { 
        icon: eventIcon 
      }).addTo(map);

      // Popup pour le lieu de l'événement
      const popupContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; color: #d97706; font-weight: bold; font-size: 16px;">
            ${locationName}
          </h3>
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">
            ${locationAddress}
          </p>
           <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">
            Code d'accès: <strong style="color: #d97706;">${accessCode}</strong>
          </p>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button onclick="openDirections('${locationAddress}')" style="
              background: #f59e0b; 
              color: white; 
              border: none; 
              padding: 6px 10px; 
              border-radius: 6px; 
              font-size: 12px; 
              cursor: pointer;
              font-weight: 500;
            ">
              📍 Itinéraire
            </button>
            <button onclick="shareLocation('${locationAddress}')" style="
              background: #6b7280; 
              color: white; 
              border: none; 
              padding: 6px 10px; 
              border-radius: 6px; 
              font-size: 12px; 
              cursor: pointer;
              font-weight: 500;
            ">
              📤 Partager
            </button>
          </div>
        </div>
      `;

      eventMarker.bindPopup(popupContent).openPopup();

      // Fonctions globales pour les boutons du popup
      window.openDirections = (address) => {
        const encodedAddress = encodeURIComponent(address);
        // Essayer d'abord l'app Maps native, sinon Google Maps web
        const mapsUrl = /iPad|iPhone|iPod/.test(navigator.userAgent) 
          ? `maps://maps.google.com/maps?daddr=${encodedAddress}&amp;ll=`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        
        window.open(mapsUrl, '_blank');
      };

      window.shareLocation = (address) => {
        if (navigator.share) {
          navigator.share({
            title: 'Lieu de l\'événement',
            text: `Adresse: ${address}`,
            url: `https://www.openstreetmap.org/?mlat=${eventLocation.lat}&mlon=${eventLocation.lng}&zoom=15`
          });
        } else {
          // Fallback: copier dans le presse-papiers
          navigator.clipboard.writeText(address).then(() => {
            alert('Adresse copiée dans le presse-papiers !');
          }).catch(() => {
            // Fallback pour les navigateurs plus anciens
            prompt('Copiez cette adresse:', address);
          });
        }
      };

      // Géolocalisation de l'utilisateur
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = [position.coords.latitude, position.coords.longitude];
            setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

            // Icône pour la position utilisateur
            const userIcon = window.L.divIcon({
              html: `
                <div style="
                  background: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  width: 20px;
                  height: 20px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                  <div style="
                    background: white;
                    border-radius: 50%;
                    width: 8px;
                    height: 8px;
                    margin: 3px;
                  "></div>
                </div>
              `,
              className: 'user-location-icon',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            // Ajouter le marqueur utilisateur
            const userMarker = window.L.marker(userPos, { icon: userIcon }).addTo(map);
            userMarker.bindPopup('📍 Votre position');

            // Calculer et afficher la distance
            const dist = calculateDistance(
              position.coords.latitude, 
              position.coords.longitude, 
              eventLocation.lat, 
              eventLocation.lng
            );
            setDistance(dist);

            // Ajuster la vue pour inclure les deux points
            const group = new window.L.featureGroup([eventMarker, userMarker]);
            map.fitBounds(group.getBounds().pad(0.1));

            // Ajouter une ligne entre les deux points
            window.L.polyline([
              [position.coords.latitude, position.coords.longitude],
              [eventLocation.lat, eventLocation.lng]
            ], {
              color: '#f59e0b',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(map);

          },
          (error) => {
            console.log("Géolocalisation non disponible:", error.message);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 300000 
          }
        );
      }

      // Ajouter un contrôle d'échelle
      window.L.control.scale().addTo(map);

      leafletMapRef.current = map;

    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la carte:', error);
      setMapError('Erreur lors de l\'initialisation de la carte');
    }
  }, [eventLocation, locationName, locationAddress, accessCode]);

  // Initialiser la carte quand les ressources sont chargées
  useEffect(() => {
    if (window.L && mapRef.current && !leafletMapRef.current) {
      initializeMap();
    }
  }, [isMapLoaded, initializeMap]);

  // Calculer la distance entre deux points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
  };

  // Fonction pour centrer sur l'utilisateur
  const centerOnUser = () => {
    if (userLocation && leafletMapRef.current) {
      leafletMapRef.current.setView([userLocation.lat, userLocation.lng], 16);
    }
  };

  // Fonction pour centrer sur l'événement
  const centerOnEvent = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([eventLocation.lat, eventLocation.lng], 16);
    }
  };

  if (mapError) {
    return (
      <div className="aspect-video bg-red-50 rounded-lg border border-red-200 flex items-center justify-center">
        <div className="text-center p-4">
          <div className="text-red-500 mb-2 text-2xl">⚠️</div>
          <p className="text-red-700 text-sm mb-3">{mapError}</p>
          <button 
            onClick={() => {
              setMapError(null);
              setIsMapLoaded(false);
              loadLeafletResources();
            }} 
            className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Carte */}
      <div className="relative">
        <div 
          ref={mapRef} 
          className="aspect-video rounded-lg shadow-lg overflow-hidden"
          style={{ minHeight: '300px', zIndex: 1 }}
        />
        
        {!isMapLoaded && (
          <div className="absolute inset-0 bg-amber-100 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
              <p className="text-amber-700 text-sm">Chargement de la carte...</p>
            </div>
          </div>
        )}

        {/* Contrôles de la carte */}
        {isMapLoaded && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1.5 sm:gap-2 z-20">
            {userLocation && (
              <button
                onClick={centerOnUser}
                className="bg-white p-1.5 sm:p-2 rounded-lg shadow-md hover:bg-gray-50 transition active:bg-gray-100"
                title="Centrer sur ma position"
              >
                <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              </button>
            )}
            <button
              onClick={centerOnEvent}
              className="bg-white p-1.5 sm:p-2 rounded-lg shadow-md hover:bg-gray-50 transition active:bg-gray-100"
              title="Centrer sur l'événement"
            >
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
            </button>
          </div>
        )}
      </div>

      {/* Informations et actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Informations de distance */}
        {userLocation && distance && (
          <div className="bg-amber-50 p-3 md:p-4 rounded-lg border border-amber-200">
            <div className="flex items-center mb-2">
              <Compass className="h-4 w-4 md:h-5 md:w-5 text-amber-600 mr-2 flex-shrink-0" />
              <h4 className="font-semibold text-amber-800 text-sm md:text-base">Distance</h4>
            </div>
            <p className="text-amber-700 text-sm md:text-base">Environ {distance} de votre position</p>
            <p className="text-amber-600 text-xs md:text-sm mt-1">Distance à vol d'oiseau</p>
          </div>
        )}

        {/* Actions rapides */}
        <div className="bg-amber-50 p-3 md:p-4 rounded-lg border border-amber-200">
          <div className="flex items-center mb-2 md:mb-3">
            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-amber-600 mr-2 flex-shrink-0" />
            <h4 className="font-semibold text-amber-800 text-sm md:text-base">Actions rapides</h4>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => window.openDirections(locationAddress)}
              className="flex items-center w-full px-3 py-2.5 md:py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:bg-amber-800 transition text-sm touch-manipulation"
            >
              <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Ouvrir l'itinéraire</span>
            </button>
            
            <button
              onClick={() => window.shareLocation(locationAddress)}
              className="flex items-center w-full px-3 py-2.5 md:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:bg-gray-800 transition text-sm touch-manipulation"
            >
              <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Partager l'adresse</span>
            </button>
          </div>
        </div>
      </div>

      {/* Instructions d'accès */}
      <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2 text-sm md:text-base">Instructions d'accès</h4>
        <div className="text-xs md:text-sm text-blue-700 space-y-1 leading-relaxed">
          <p>• {locationDetails?.location?.parkingInfo || "Parking privé disponible sur place"}</p>
          <p>• Code d'accès: <strong className="text-blue-800">{locationDetails?.location?.accessCode || "1234"}</strong></p>
          <p className="break-words">• En cas de problème: <a href="mailto:michel.booh@gmail.com" className="underline hover:text-blue-800 break-all">michel.booh@gmail.com</a></p>
        </div>
      </div>

      {/* Informations sur la carte */}
      <div className="text-xs text-gray-500 text-center px-2 leading-relaxed">
        🗺️ Carte fournie par OpenStreetMap - Données © contributeurs OpenStreetMap
      </div>
    </div>
  );
};

export default InteractiveMap;