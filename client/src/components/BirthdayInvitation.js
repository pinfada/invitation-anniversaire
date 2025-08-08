// client/src/components/BirthdayInvitation.js - Partie 1
import React, { useState, useEffect } from 'react';
import { Camera, Calendar, MapPin, Clock, Users, Gift, Home, Send, Lock, Info, Shield, Download, RefreshCw, Upload, Heart, Eye } from 'lucide-react';
import InteractiveMap from './InteractiveMap';

const BirthdayInvitation = ({ guestData, updateGuestData, isLoading }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [attending, setAttending] = useState('yes');
  const [guests, setGuests] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [currentSection, setCurrentSection] = useState('invitation');
  const [hasLocationAccess, setHasLocationAccess] = useState(false);
  const [locationDetails, setLocationDetails] = useState(null);
  const [needsAccommodation, setNeedsAccommodation] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rsvpErrors, setRsvpErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installationMessage, setInstallationMessage] = useState('');
  const [installButtonText, setInstallButtonText] = useState('Installer l\'application');
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Informations de l'événement - à personnaliser
  const eventInfo = {
    name: "Mitch",
    age: 41,
    date: "11 au 14 Août 2025",
    time: "18h00",
    location: hasLocationAccess ? (locationDetails?.location?.name + ", " + locationDetails?.location?.address) : "Lieu révélé après confirmation",
    rsvpDeadline: "1 Juin 2025"
  };

  // Effet pour afficher le message de bienvenue lorsque les données de l'invité sont chargées
  useEffect(() => {
    if (guestData && !isLoading) {
      setShowWelcome(true);
      // Masquer le message après 6 secondes
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [guestData, isLoading]);
  
  // Utiliser les données de l'invité pour pré-remplir le formulaire RSVP si disponibles
  useEffect(() => {
    if (guestData) {
      setName(guestData.name || '');
      setEmail(guestData.email || '');
      
      if (guestData.attending === true) {
        setAttending('yes');
        setHasLocationAccess(true);
        fetchLocationDetails(guestData.email);
      } else if (guestData.attending === false) {
        setAttending('no');
      }
      
      if (guestData.guests > 0) {
        setGuests(guestData.guests);
      }
      
      if (guestData.needsAccommodation) {
        setNeedsAccommodation(true);
      }
    }
  }, [guestData]);

  // Essayer de charger les détails de localisation à partir du stockage local lors du chargement
  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');
    const storedAccess = localStorage.getItem('locationAccess');
    
    if (storedEmail && storedAccess === 'true') {
      setEmail(storedEmail);
      setHasLocationAccess(true);
      fetchLocationDetails(storedEmail);
    }
  }, []);

  // Écoutez l'événement beforeinstallprompt pour savoir si l'application est installable
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Empêcher Chrome 67+ d'afficher automatiquement la boîte de dialogue d'installation
      e.preventDefault();
      // Stocker l'événement pour pouvoir le déclencher plus tard
      setDeferredPrompt(e);
      // Mettre à jour l'état pour indiquer que l'application est installable
      setIsInstallable(true);
      console.log('L\'application peut être installée', e);
    };

    // Écouter l'événement d'installation réussie
    const handleAppInstalled = () => {
      // Effacer le prompt différé car il ne peut plus être utilisé
      setDeferredPrompt(null);
      // Mettre à jour l'état pour indiquer que l'application n'est plus installable
      setIsInstallable(false);
      // Afficher un message de succès
      setInstallationMessage('Application installée avec succès !');
      setTimeout(() => setInstallationMessage(''), 3000);
      console.log('Application installée avec succès');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Vérifier si l'application est déjà installée (heuristique)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://');
    
    if (isStandalone) {
      setIsInstallable(false);
      console.log('Application déjà installée en mode standalone');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fonction pour installer l'application
  const installApp = async () => {
    if (!deferredPrompt) {
      // Si l'application est déjà installée ou l'installation n'est pas possible
      setInstallationMessage('Cette application est déjà installée ou votre navigateur ne prend pas en charge l\'installation d\'applications.');
      setTimeout(() => setInstallationMessage(''), 5000);
      return;
    }

    try {
      setIsInstalling(true);
      setInstallButtonText('Installation en cours...');
      
      // Afficher la boîte de dialogue d'installation
      deferredPrompt.prompt();
      
      // Attendre que l'utilisateur réponde à l'invite
      const choiceResult = await deferredPrompt.userChoice;
      
      // Une fois que l'utilisateur a fait son choix, effacer le prompt différé
      setDeferredPrompt(null);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('Utilisateur a accepté l\'installation');
        setInstallationMessage('Installation réussie !');
      } else {
        console.log('Utilisateur a refusé l\'installation');
        setInstallationMessage('Installation annulée');
        setIsInstallable(true); // Permettre à l'utilisateur de réessayer
      }
    } catch (error) {
      console.error('Erreur lors de l\'installation:', error);
      setInstallationMessage('Une erreur est survenue pendant l\'installation.');
    } finally {
      setIsInstalling(false);
      setInstallButtonText('Installer l\'application');
      setTimeout(() => setInstallationMessage(''), 3000);
    }
  };
  
  // Fonction pour récupérer les détails de localisation depuis l'API
  const fetchLocationDetails = async (userEmail) => {
    try {
      setLocationDetails(null); // Réinitialiser pendant le chargement
      
      // Validation de l'email
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        console.error("Email invalide");
        return;
      }
      
      // Construction du token CSRF pour la requête (dans une implémentation réelle)
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      // Dans une implémentation réelle, ce serait un appel API sécurisé
      // avec le code unique de l'invité comme moyen d'authentification
      const response = await fetch(`/api/event-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({
          email: userEmail,
          code: localStorage.getItem('guestCode') || ''
        })
      });
      
      // Vérification de la réponse (simulée ici)
      // Pour la démonstration, nous simulons une réponse
      const mockLocationDetails = {
        location: {
          name: "Villa Paradise",
          address: "18 Rue du Stade, 17000 La Rochelle",
          coordinates: { lat: 46.1603986, lng: -1.1770363 },
          accessCode: "1234",
          parkingInfo: "Parking gratuit"
        },
        accommodationInfo: {
          checkIn: "Lundi 11 août 2025 à partir de 15h",
          checkOut: "Jeudi 14 août 2025 avant 10h",
          amenities: [
            "Piscine chauffée",
            "5 chambres avec salle de bain",
            "Grande terrasse avec vue sur la mer",
            "Cuisine équipée",
            "Barbecue et plancha"
          ]
        },
        additionalInfo: "N'hésitez pas à apporter maillot de bain et serviette. Des activités sont prévues tout au long du weekend. Il fera chaud! prévoyez un ventilo!"
      };
      
      setLocationDetails(mockLocationDetails);
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error);
    }
  };

  // Validation du formulaire RSVP
  const validateRsvpForm = () => {
    const errors = {};
    
    if (!name.trim()) {
      errors.name = "Le nom est requis";
    }
    
    if (!email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Format d'email invalide";
    }
    
    setRsvpErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Gestion soumission du formulaire RSVP
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation du formulaire
    if (!validateRsvpForm()) {
      return;
    }
    
    setSubmitting(true);
    
    // Préparer les données pour l'API
    const rsvpData = {
      name,
      email,
      attending: attending === 'yes',
      guests: parseInt(guests),
      message,
      needsAccommodation,
      code: localStorage.getItem('guestCode') || '' // Code unique de l'invité
    };
    
    try {
      // Construction du token CSRF pour la requête (dans une implémentation réelle)
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      // Appel API réel
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rsvpData)
      });
      
      // Vérifier si l'appel a réussi
      if (!response.ok) {
        throw new Error('Erreur serveur lors de l\'envoi de la réponse');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de l\'envoi');
      }
      
      const updatedData = {
        attending: attending === 'yes',
        guests: guests,
        message: message,
        needsAccommodation: needsAccommodation
      };
      
      setSubmitted(true);
      
      // Mettre à jour les données de l'invité
      if (updateGuestData) {
        updateGuestData(updatedData);
      }
      
      // Si l'invité a confirmé sa présence, donner accès aux détails de localisation
      if (data.locationAccess) {
        setHasLocationAccess(true);
        localStorage.setItem('locationAccess', 'true');
        localStorage.setItem('userEmail', email);
        fetchLocationDetails(email);
      }
      
      // Si la personne participe, lui donner accès aux détails du lieu
      if (attending === 'yes') {
        setHasLocationAccess(true);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('locationAccess', 'true');
        fetchLocationDetails(email);
      }
      
      // Réinitialiser le formulaire après quelques secondes
      setTimeout(() => {
        setSubmitted(false);
        if (attending === 'yes') {
          setCurrentSection(hasLocationAccess ? 'infos' : 'invitation');
        }
      }, 3000);
    } catch (error) {
      console.error("Erreur lors de l'envoi du RSVP:", error);
      setRsvpErrors({
        submit: "Une erreur est survenue lors de l'envoi de votre réponse. Veuillez réessayer."
      });
    } finally {
      setSubmitting(false);
    }
  };
 
  // Composant pour le message de bienvenue personnalisé
  const WelcomeMessage = () => (
    <div className={`fixed top-0 left-0 right-0 z-50 p-4 transform transition-all duration-500 ${
      showWelcome ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-amber-600 p-4 text-white">
          <h2 className="text-xl font-bold text-center">Bienvenue {guestData?.name}!</h2>
        </div>
        <div className="p-4">
          <p className="text-amber-700">{guestData?.personalWelcomeMessage || "Nous sommes ravis de vous accueillir!"}</p>
        </div>
      </div>
    </div>
  );

  // Information de sécurité
  const SecurityInfo = () => (
    <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-start">
      <Shield className="text-green-600 mr-3 flex-shrink-0 mt-1" size={20} />
      <div>
        <h3 className="font-semibold text-green-800 mb-1">Connexion sécurisée</h3>
        <p className="text-sm text-green-700">
          Vos informations sont protégées et votre identité a été vérifiée via le code QR unique.
          Toutes les communications sont chiffrées.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-rose-100 text-amber-900">
      {/* Message de bienvenue personnalisé */}
      {guestData && <WelcomeMessage />}
      
      {/* Navigation */}
      <nav className="bg-amber-800 bg-opacity-90 text-amber-50 p-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto">
          {/* Titre et menu burger en mobile */}
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold truncate">
              Anniversaire de {eventInfo.name}
            </h1>
            
            {/* Menu hamburger sur mobile */}
            <button 
              className="md:hidden rounded-lg p-2 hover:bg-amber-700"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            {/* Navigation desktop */}
            <div className="hidden md:flex space-x-4">
              <button 
                onClick={() => setCurrentSection('invitation')}
                className={`px-3 py-1 rounded-lg transition ${currentSection === 'invitation' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
                Invitation
              </button>
              <button 
                onClick={() => setCurrentSection('infos')}
                className={`px-3 py-1 rounded-lg transition ${currentSection === 'infos' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
                Infos pratiques
              </button>
              <button 
                onClick={() => setCurrentSection('rsvp')}
                className={`px-3 py-1 rounded-lg transition ${currentSection === 'rsvp' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
                RSVP
              </button>
              <button 
                onClick={() => setCurrentSection('photos')}
                className={`px-3 py-1 rounded-lg transition ${currentSection === 'photos' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
                Photos
              </button>
            </div>
          </div>
          
          {/* Menu mobile déroulant */}
          <div className={`mt-3 grid grid-cols-2 gap-2 md:hidden ${menuOpen ? 'block' : 'hidden'}`}>
            <button 
              onClick={() => {
                setCurrentSection('invitation');
                setMenuOpen(false);
              }}
              className={`px-3 py-2 rounded-lg transition text-center ${currentSection === 'invitation' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
              Invitation
            </button>
            <button 
              onClick={() => {
                setCurrentSection('infos');
                setMenuOpen(false);
              }}
              className={`px-3 py-2 rounded-lg transition text-center ${currentSection === 'infos' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
              Infos pratiques
            </button>
            <button 
              onClick={() => {
                setCurrentSection('rsvp');
                setMenuOpen(false);
              }}
              className={`px-3 py-2 rounded-lg transition text-center ${currentSection === 'rsvp' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
              RSVP
            </button>
            <button 
              onClick={() => {
                setCurrentSection('photos');
                setMenuOpen(false);
              }}
              className={`px-3 py-2 rounded-lg transition text-center ${currentSection === 'photos' ? 'bg-amber-600' : 'hover:bg-amber-700'}`}>
              Photos
            </button>
          </div>
        </div>
      </nav>

      {/* Afficher un indicateur de chargement si nécessaire */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
          <div className="p-4 rounded-lg bg-amber-100 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-amber-600 animate-bounce"></div>
              <div className="w-4 h-4 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-4 h-4 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              <span className="text-amber-800 font-medium ml-2">Chargement...</span>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Indication que l'utilisateur est connecté avec son code unique */}
        {guestData && (
          <SecurityInfo />
        )}
        
        {/* Section Invitation */}
        {currentSection === 'invitation' && (
          <div className="max-w-3xl mx-auto bg-white bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-xl p-8 my-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-2 text-amber-800">{eventInfo.name} fête ses {eventInfo.age} ans!</h2>
              <p className="text-xl italic text-amber-700">Et vous êtes invité(e) à célébrer ce moment avec nous</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center p-4 bg-amber-50 rounded-xl shadow">
                <Calendar className="h-10 w-10 text-amber-600 mr-4" />
                <div>
                  <h3 className="font-semibold text-lg">Date</h3>
                  <p>{eventInfo.date}</p>
                </div>
              </div>
              
              <div className="flex items-center p-4 bg-amber-50 rounded-xl shadow">
                <Clock className="h-10 w-10 text-amber-600 mr-4" />
                <div>
                  <h3 className="font-semibold text-lg">Heure</h3>
                  <p>{eventInfo.time}</p>
                </div>
              </div>
              
              <div className="flex items-center p-4 bg-amber-50 rounded-xl shadow">
                <MapPin className="h-10 w-10 text-amber-600 mr-4" />
                <div>
                  <h3 className="font-semibold text-lg">Lieu</h3>
                  <p>{eventInfo.location}</p>
                </div>
              </div>
              
              <div className="flex items-center p-4 bg-amber-50 rounded-xl shadow">
                <Send className="h-10 w-10 text-amber-600 mr-4" />
                <div>
                  <h3 className="font-semibold text-lg">RSVP avant le</h3>
                  <p>{eventInfo.rsvpDeadline}</p>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <button 
                onClick={() => setCurrentSection('rsvp')}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105">
                Confirmer ma présence
              </button>
            </div>
          </div>
        )}

        {/* Section Infos Pratiques */}
        {currentSection === 'infos' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-xl p-8 my-8">
              <h2 className="text-3xl font-bold mb-6 text-amber-800 border-b pb-2">Informations pratiques</h2>
              
              {!hasLocationAccess ? (
                <div className="text-center py-6 md:py-8 px-4">
                  <Lock className="w-12 h-12 md:w-16 md:h-16 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-lg sm:text-xl font-medium mb-2 leading-tight">Informations réservées aux invités confirmés</h3>
                  <p className="mb-6 text-amber-700 text-sm sm:text-base px-2">Pour accéder aux détails complets, merci de confirmer votre présence.</p>
                  <button 
                    onClick={() => setCurrentSection('rsvp')}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition text-base md:text-lg">
                    Confirmer ma présence
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Détails de localisation avec carte interactive */}
                  <div>
                    <div className="flex items-center mb-4">
                      <MapPin className="h-6 w-6 text-amber-600 mr-2" />
                      <h3 className="text-xl font-semibold">Lieu et accès</h3>
                    </div>
                    
                    <div className="mb-6">
                      <p className="font-semibold mb-1 text-lg">{locationDetails?.location?.name}</p>
                      <p className="text-gray-700 mb-4">{locationDetails?.location?.address}</p>
                      
                      {/* Carte interactive */}
                      <InteractiveMap locationDetails={locationDetails} />
                    </div>
                  </div>
                  
                  {/* Hébergement */}
                  <div>
                    <div className="flex items-center mb-2">
                      <Home className="h-6 w-6 text-amber-600 mr-2" />
                      <h3 className="text-xl font-semibold">Hébergement</h3>
                    </div>
                    <p className="ml-8 mb-4">
                      J'ai réservé la villa pour 3 jours (du vendredi au dimanche). 
                      Elle peut accueillir jusqu'à 12 personnes pour dormir sur place.
                    </p>
                    <div className="ml-8 bg-amber-50 p-4 rounded-lg">
                      <p className="font-semibold mb-2">Informations importantes :</p>
                      <ul className="list-disc ml-5">
                        <li>Check-in : {locationDetails?.accommodationInfo?.checkIn}</li>
                        <li>Check-out : {locationDetails?.accommodationInfo?.checkOut}</li>
                      </ul>
                      
                      <p className="font-semibold mt-4 mb-2">Equipements de la villa :</p>
                      <ul className="list-disc ml-5">
                        {locationDetails?.accommodationInfo?.amenities.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* Cadeaux */}
                  <div>
                    <div className="flex items-center mb-2">
                      <Gift className="h-6 w-6 text-amber-600 mr-2" />
                      <h3 className="text-xl font-semibold">Cadeaux</h3>
                    </div>
                    <p className="ml-8">
                      Votre présence est déjà un merveilleux cadeau ! Si vous souhaitez toutefois 
                      m'offrir quelque chose, j'ai créé une liste de souhaits accessible 
                      <a href="#" className="text-amber-600 hover:text-amber-800 font-semibold"> ici</a>.
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center mb-2">
                      <Users className="h-6 w-6 text-amber-600 mr-2" />
                      <h3 className="text-xl font-semibold">Dress code</h3>
                    </div>
                    <p className="ml-8">
                      Tenue décontractée et confortable. La soirée se déroulera en intérieur 
                      et en extérieur selon la météo, prévoyez donc un vêtement passe partout pour la soirée.
                    </p>
                  </div>
                  
                  <div className="mt-8 p-4 bg-amber-100 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Info className="h-5 w-5 text-amber-600 mr-2" />
                      <h3 className="font-semibold text-lg">Informations supplémentaires</h3>
                    </div>
                    <p>{locationDetails?.additionalInfo}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section RSVP */}
        {currentSection === 'rsvp' && (
          <div className="max-w-2xl mx-auto bg-white bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-xl p-8 my-8">
            <h2 className="text-3xl font-bold mb-6 text-amber-800 text-center">Confirmez votre présence</h2>
            
            {submitted ? (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
                {attending === 'yes' ? 
                  "Merci d'avoir confirmé votre présence ! J'ai hâte de vous voir." : 
                  "Merci d'avoir répondu. Vous allez nous manquer !"
                }
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-amber-700 mb-1">Votre nom</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className={`w-full p-2 border rounded focus:ring focus:ring-amber-200 focus:border-amber-500 ${
                      rsvpErrors.name ? 'border-red-500 bg-red-50' : 'border-amber-300'
                    }`}
                    required
                    disabled={submitting}
                  />
                  {rsvpErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{rsvpErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-amber-700 mb-1">Votre email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className={`w-full p-2 border rounded focus:ring focus:ring-amber-200 focus:border-amber-500 ${
                      rsvpErrors.email ? 'border-red-500 bg-red-50' : 'border-amber-300'
                    }`}
                    required
                    disabled={submitting}
                  />
                  {rsvpErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{rsvpErrors.email}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-amber-700 mb-1">Votre réponse</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input 
                        type="radio" 
                        name="attending" 
                        value="yes" 
                        checked={attending === 'yes'} 
                        onChange={() => setAttending('yes')}
                        className="mr-2 text-amber-600"
                        disabled={submitting}
                      />
                      Je serai présent(e)
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="radio" 
                        name="attending" 
                        value="no" 
                        checked={attending === 'no'} 
                        onChange={() => setAttending('no')}
                        className="mr-2 text-amber-600"
                        disabled={submitting}
                      />
                      Je ne pourrai pas venir
                    </label>
                  </div>
                </div>
                
                {attending === 'yes' && (
                  <>
                    <div>
                      <label className="block text-amber-700 mb-1">Nombre d'accompagnants</label>
                      <select 
                        value={guests} 
                        onChange={(e) => setGuests(parseInt(e.target.value))}
                        className="w-full p-2 border border-amber-300 rounded focus:ring focus:ring-amber-200 focus:border-amber-500"
                        disabled={submitting}
                      >
                        {[0, 1, 2, 3, 4].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mt-4">
                      <label className="flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={needsAccommodation} 
                          onChange={(e) => setNeedsAccommodation(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                          disabled={submitting}
                        />
                        <span className="ml-2 text-amber-700">
                          Je souhaite rester l'intégralité du séjour (hébergement sur place)
                        </span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-amber-700 mb-1 mt-4">Message (facultatif)</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full p-2 border border-amber-300 rounded focus:ring focus:ring-amber-200 focus:border-amber-500 min-h-32"
                        placeholder="Allergies alimentaires, régime spécial, autres informations importantes..."
                        disabled={submitting}
                      ></textarea>
                    </div>
                  </>
                )}
                
                {rsvpErrors.submit && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded">
                    {rsvpErrors.submit}
                  </div>
                )}
                
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className={`w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition ${
                      submitting ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        En cours...
                      </span>
                    ) : (
                      attending === 'yes' ? "Confirmer ma présence" : "Envoyer ma réponse"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Section Photos */}
        {currentSection === 'photos' && <PhotosSection 
          guestData={guestData}
          installApp={installApp}
          isInstallable={isInstallable}
          isInstalling={isInstalling}
          installButtonText={installButtonText}
          installationMessage={installationMessage}
        />}
      </div>

      <footer className="bg-amber-800 text-amber-50 py-6 mt-8 md:mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm sm:text-base">Nous avons hâte de célébrer ce moment avec vous !</p>
          <p className="mt-2 text-amber-200 text-sm sm:text-base break-all">Pour toute question : michel.booh@gmail.com</p>
          
          <div className="mt-6 pt-4 border-t border-amber-700">
            <a 
              href="/scan" 
              className="inline-flex items-center px-4 py-2 bg-amber-700 text-amber-100 rounded-lg hover:bg-amber-600 transition text-sm sm:text-base"
            >
              <span className="mr-2">📷</span>
              Scanner un QR code
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Composant séparé pour la section photos
const PhotosSection = ({ guestData, installApp, isInstallable, isInstalling, installButtonText, installationMessage }) => {
  const [photos, setPhotos] = useState([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  
  // Charger les photos existantes
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch('/api/photos');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPhotos(data.photos || []);
          }
        }
      } catch (e) {
        console.error('Erreur lors du chargement des photos:', e);
      } finally {
        setIsLoadingPhotos(false);
      }
    };
    
    fetchPhotos();
    
    // Actualiser toutes les 30 secondes
    const interval = setInterval(fetchPhotos, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="max-w-4xl mx-auto bg-white bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 my-4 md:my-8">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 md:mb-6 text-amber-800 text-center">Partagez vos photos</h2>
      
      {/* Actions de partage */}
      <div className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Partage direct */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 sm:p-6 rounded-xl border border-amber-200">
            <div className="text-center">
              <Camera className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-amber-600 mb-3" />
              <h3 className="text-lg sm:text-xl font-semibold text-amber-800 mb-2">Partager une photo</h3>
              <p className="text-amber-700 mb-4 text-sm sm:text-base">Partagez vos moments en temps réel</p>
              <a 
                href="/photos" 
                className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <Upload size={16} className="mr-2" />
                Ajouter une photo
              </a>
            </div>
          </div>
          
          {/* Installation PWA */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl border border-blue-200">
            <div className="text-center">
              <Download className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-blue-600 mb-3" />
              <h3 className="text-lg sm:text-xl font-semibold text-blue-800 mb-2">Application mobile</h3>
              <p className="text-blue-700 mb-4 text-sm sm:text-base">Pour une meilleure expérience</p>
              
              {installationMessage && (
                <div className={`p-2 sm:p-3 mb-4 rounded text-xs sm:text-sm ${
                  installationMessage.includes('succès') || installationMessage.includes('réussie') 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                  {installationMessage}
                </div>
              )}
              
              <button 
                onClick={installApp}
                disabled={!isInstallable || isInstalling}
                className={`inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition text-sm sm:text-base w-full sm:w-auto justify-center ${
                  !isInstallable || isInstalling ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105'
                }`}
              >
                {isInstalling ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    {installButtonText}
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    {isInstallable ? 'Installer l\'app' : 'Application installée'}
                  </>
                )}
              </button>
              
              {!isInstallable && (
                <p className="text-xs text-blue-600 mt-2 italic">
                  {window.matchMedia('(display-mode: standalone)').matches ? 
                    "Déjà installée !" : 
                    "Installation non disponible"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Galerie de photos */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-amber-800 flex items-center">
            <Eye className="mr-2" size={24} />
            Galerie partagée ({photos.length})
          </h3>
          {photos.length > 0 && (
            <span className="text-amber-600 text-sm flex items-center">
              <Heart size={16} className="mr-1" />
              Merci pour ces beaux moments !
            </span>
          )}
        </div>
        
        {isLoadingPhotos ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <span className="ml-3 text-amber-700">Chargement des photos...</span>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <Camera className="h-16 w-16 mx-auto text-amber-400 mb-4" />
            <h4 className="text-xl font-medium text-amber-700 mb-2">Aucune photo partagée</h4>
            <p className="text-amber-600 mb-6">Soyez le premier à partager un moment de cette fête !</p>
            <a 
              href="/photos" 
              className="inline-flex items-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow transition"
            >
              <Camera size={18} className="mr-2" />
              Partager la première photo
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {photos.map((photo) => (
              <div key={photo._id} className="group relative aspect-square rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                <img 
                  src={photo.url} 
                  alt={`Partagée par ${photo.uploadedBy}`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <p className="font-medium text-sm truncate">{photo.uploadedBy}</p>
                    <p className="text-xs opacity-75">
                      {new Date(photo.createdAt).toLocaleDateString('fr-FR', {
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

export default BirthdayInvitation;