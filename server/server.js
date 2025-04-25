// server.js - Point d'entrée du serveur Express
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

// Configuration de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de la connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/birthday-invitation', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connecté'))
.catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Configuration de Firebase (pour le stockage des photos)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Configuration de Multer pour le téléchargement des fichiers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite à 10MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Format de fichier non supporté. Utilisez JPG, PNG ou GIF.'));
  }
});

// Définition des modèles MongoDB
const rsvpSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  attending: { type: String, required: true },
  guests: { type: Number, default: 0 },
  message: { type: String },
  needsAccommodation: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  uploadedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const RSVP = mongoose.model('RSVP', rsvpSchema);
const Photo = mongoose.model('Photo', photoSchema);

// Routes pour le RSVP
app.post('/api/rsvp', async (req, res) => {
  try {
    const { name, email, attending, guests, message, needsAccommodation } = req.body;
    
    // Vérifier si l'utilisateur a déjà répondu
    const existingRSVP = await RSVP.findOne({ email });
    
    if (existingRSVP) {
      // Mettre à jour la réponse existante
      existingRSVP.name = name;
      existingRSVP.attending = attending;
      existingRSVP.guests = guests;
      existingRSVP.message = message;
      existingRSVP.needsAccommodation = needsAccommodation;
      await existingRSVP.save();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Votre réponse a été mise à jour',
        locationAccess: attending === 'yes'
      });
    }
    
    // Créer une nouvelle réponse
    const newRSVP = new RSVP({
      name,
      email,
      attending,
      guests,
      message,
      needsAccommodation
    });
    
    await newRSVP.save();
    
    // Envoyer un email de confirmation (à implémenter selon besoin)
    // sendConfirmationEmail(email, name, attending);
    
    res.status(201).json({ 
      success: true, 
      message: 'Merci pour votre réponse',
      locationAccess: attending === 'yes'
    });
  } catch (error) {
    console.error('Erreur lors du traitement du RSVP:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du traitement de votre réponse' });
  }
});

// Route pour récupérer les détails du lieu (uniquement pour ceux qui ont accepté)
app.get('/api/event-details', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requis' });
    }
    
    const rsvp = await RSVP.findOne({ email });
    
    if (!rsvp) {
      return res.status(404).json({ success: false, message: 'Aucune réponse trouvée pour cet email' });
    }
    
    if (rsvp.attending !== 'yes') {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    
    // Détails de l'événement pour les invités qui ont accepté
    const eventDetails = {
      location: {
        name: "Villa Paradise",
        address: "123 Route du Soleil, Nice",
        coordinates: { lat: 43.7102, lng: 7.2620 }, // Coordonnées fictives
        accessCode: "1234", // Code d'accès à la résidence
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
    
    res.status(200).json({ success: true, eventDetails });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'événement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Routes pour les photos
app.post('/api/photos', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo téléchargée' });
    }
    
    const { name } = req.body;
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const filename = `photos/${timestamp}_${req.file.originalname}`;
    
    // Référence au fichier dans Firebase Storage
    const storageRef = ref(storage, filename);
    
    // Télécharger le fichier
    await uploadBytes(storageRef, req.file.buffer, {
      contentType: req.file.mimetype
    });
    
    // Obtenir l'URL de téléchargement
    const photoUrl = await getDownloadURL(storageRef);
    
    // Créer une entrée dans la base de données
    const newPhoto = new Photo({
      url: photoUrl,
      uploadedBy: name || 'Invité anonyme'
    });
    
    await newPhoto.save();
    
    res.status(201).json({ success: true, photo: newPhoto });
  } catch (error) {
    console.error('Erreur lors du téléchargement de la photo:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du téléchargement de la photo' });
  }
});

// Récupérer toutes les photos
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, photos });
  } catch (error) {
    console.error('Erreur lors de la récupération des photos:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Servir les fichiers statiques en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});