import React, { useState, useEffect } from 'react';
import { Camera, Calendar, MapPin, Clock, Users, Gift, Home, Send, Lock, Info } from 'lucide-react';

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
  
  // Fonction pour récupérer les détails de localisation depuis l'API
  const fetchLocationDetails = async (userEmail) => {
    try {
      // Dans une implémentation réelle, ce serait un appel API
      // const response = await fetch(`/api/event-details?email=${userEmail}`);
      // const data = await response.json();
      
      // Pour la démonstration, nous simulons une réponse
      const mockLocationDetails = {
        location: {
          name: "Villa Paradise",
          address: "123 Route du Soleil, Nice",
          coordinates: { lat: 43.7102, lng: 7.2620 },
          accessCode: "1234",
          parkingInfo: "Parking privé disponible sur place, code portail: 5678"
        },
        accommodationInfo: {
          checkIn: "Vendredi 15 Juin à partir de 14h",
          checkOut: "Dimanche 17 Juin avant 12h",
          amenities: [
            "Piscine chauffée",
            "5 chambres avec salle de bain",
            "Grande terrasse avec vue sur la mer",
            "Cuisine équipée",
            "Barbecue et plancha"
          ]
        },
        additionalInfo: "N'hésitez pas à apporter maillot de bain et serviette. Des activités sont prévues tout au long du weekend."
      };
      
      setLocationDetails(mockLocationDetails);
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Dans une implémentation réelle, nous enverrions ces données au backend
    console.log({ name, email, attending, guests, message, needsAccommodation });
    
    const updatedData = {
      attending: attending === 'yes',
      guests: guests,
      message: message,
      needsAccommodation: needsAccommodation
    };
    
    // Simuler une réponse du serveur
    setTimeout(() => {
      setSubmitted(true);
      
      // Mettre à jour les données de l'invité
      if (updateGuestData) {
        updateGuestData(updatedData);
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
    }, 1000);
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
                <div className="text-center py-8">
                  <Lock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-xl font-medium mb-2">Informations réservées aux invités confirmés</h3>
                  <p className="mb-6 text-amber-700">Pour accéder aux détails complets, merci de confirmer votre présence.</p>
                  <button 
                    onClick={() => setCurrentSection('rsvp')}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition">
                    Confirmer ma présence
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Détails de localisation - visible seulement après confirmation */}
                  <div>
                    <div className="flex items-center mb-2">
                      <MapPin className="h-6 w-6 text-amber-600 mr-2" />
                      <h3 className="text-xl font-semibold">Lieu</h3>
                    </div>
                    <div className="ml-8 mb-4">
                      <p className="font-semibold mb-1">{locationDetails?.location?.name}</p>
                      <p>{locationDetails?.location?.address}</p>
                      
                      <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                        <p className="font-medium text-amber-800">Code d'accès: {locationDetails?.location?.accessCode}</p>
                        <p className="mt-1">{locationDetails?.location?.parkingInfo}</p>
                      </div>
                    </div>
                    
                    <div className="ml-8 mt-4 aspect-video bg-amber-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <MapPin className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-amber-700">Carte interactive</p>
                        <p className="text-sm text-amber-600">(Une carte Google Maps sera intégrée ici)</p>
                      </div>
                    </div>
                  </div>
                  
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
                      et en extérieur selon la météo, prévoyez donc un vêtement chaud pour la soirée.
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
                    className="w-full p-2 border border-amber-300 rounded focus:ring focus:ring-amber-200 focus:border-amber-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-amber-700 mb-1">Votre email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full p-2 border border-amber-300 rounded focus:ring focus:ring-amber-200 focus:border-amber-500"
                    required
                  />
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
                      ></textarea>
                    </div>
                  </>
                )}
                
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition"
                  >
                    {attending === 'yes' ? "Confirmer ma présence" : "Envoyer ma réponse"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Section Photos */}
        {currentSection === 'photos' && (
          <div className="max-w-3xl mx-auto bg-white bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-xl p-8 my-8">
            <h2 className="text-3xl font-bold mb-6 text-amber-800 text-center">Partagez vos photos</h2>
            
            <div className="mb-8 text-center">
              <Camera className="h-16 w-16 mx-auto text-amber-600 mb-4" />
              <p className="text-lg mb-4">
                Installez notre application pour partager vos photos en temps réel pendant l'événement !
              </p>
              
              <button className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 mb-6">
                Installer l'application
              </button>
              
              <p className="text-sm text-amber-700">
                Disponible le jour de l'événement. Les photos apparaîtront ici en temps réel.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Placeholder pour les futures photos */}
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-square bg-amber-100 rounded-lg flex items-center justify-center">
                  <p className="text-amber-400 text-xl font-light">Photo #{i}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="bg-amber-800 text-amber-50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p>Nous avons hâte de célébrer ce moment avec vous !</p>
          <p className="mt-2 text-amber-200">Pour toute question : michel.booh@gmail.com</p>
          
          <div className="mt-6 pt-4 border-t border-amber-700">
            <a 
              href="/scan" 
              className="inline-flex items-center px-4 py-2 bg-amber-700 text-amber-100 rounded-lg hover:bg-amber-600 transition"
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

export default BirthdayInvitation;