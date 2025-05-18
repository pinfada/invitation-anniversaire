// server.js - Point d'entrée du serveur Express avec authentification admin
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
require('dotenv').config();

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;
const QRCode = require('qrcode');
const fs = require('fs').promises;
const archiver = require('archiver');
const { createReadStream } = require('fs');


// Middleware de base
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logs pour le débogage
console.log('Démarrage du serveur...');
console.log('Variables d\'environnement chargées:', process.env.ADMIN_PASSWORD_HASH ? 'Oui (ADMIN_PASSWORD_HASH)' : 'Non (ADMIN_PASSWORD_HASH manquant)');

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
  qrCodeUrl: { type: String },
  uniqueCode: { type: String },
  hasCheckedIn: { type: Boolean, default: false },
  checkInTime: { type: Date },
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

// Middleware d'authentification admin pour les routes protégées
const verifyAdminAccess = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
  }
  
  next();
};

// ============ ROUTES D'AUTHENTIFICATION ============
// Route de connexion admin
app.post('/api/auth/admin', async (req, res) => {
  try {
    console.log('Route /api/auth/admin appelée');
    console.log('Corps de la requête:', req.body);
    
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe est requis'
      });
    }
    
    // Vérifier le mot de passe (stocké en variable d'environnement)
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    
    if (!adminPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH non défini dans les variables d\'environnement');
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur de configuration du serveur' 
      });
    }
    
    // IMPORTANT: Sortez cette partie du bloc try imbriqué
    console.log('ADMIN_PASSWORD_HASH:', adminPasswordHash ? '**Défini**' : 'Non défini');
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
    console.log('Résultat de la comparaison:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Mot de passe incorrect' 
      });
    }
    
    // Générer une clé API temporaire
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Pour cette implémentation, on utilise process.env pour stocker temporairement la clé
    process.env.ADMIN_API_KEY = apiKey;
    
    // Journaliser la connexion
    console.log(`Connexion admin réussie: ${new Date().toISOString()}`);
    
    // Retourner la clé API avec durée de validité
    res.json({
      success: true,
      message: 'Authentification réussie',
      apiKey,
      expiresIn: 3600 // 1 heure
    });
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// Route de vérification de token
app.post('/api/auth/verify', async (req, res) => {
  try {
    const apiKey = req.body.apiKey || req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
    
    res.json({
      success: true,
      message: 'Token valide',
      user: { role: 'admin' }
    });
  } catch (error) {
    console.error('Erreur de vérification:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============ ROUTES ADMINISTRATION ============
// Route pour récupérer tous les invités (protégée)
app.get('/api/guests', verifyAdminAccess, async (req, res) => {
  try {
    const guests = await RSVP.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, guests });
  } catch (error) {
    console.error('Erreur lors de la récupération des invités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour ajouter un invité (protégée)
app.post('/api/guests', verifyAdminAccess, async (req, res) => {
  try {
    const { name, email, personalWelcomeMessage } = req.body;
    
    // Valider les données
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nom et email requis'
      });
    }
    
    // Vérifier si l'email existe déjà
    const existingRSVP = await RSVP.findOne({ email });
    if (existingRSVP) {
      return res.status(400).json({
        success: false,
        message: 'Un invité avec cet email existe déjà'
      });
    }
    
    // Créer le nouvel invité
    const newRSVP = new RSVP({
      name,
      email,
      attending: 'pending', // Status initial
      message: personalWelcomeMessage
    });
    
    await newRSVP.save();
    
    res.status(201).json({
      success: true,
      message: 'Invité ajouté avec succès',
      _id: newRSVP._id,
      name: newRSVP.name,
      email: newRSVP.email
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout d\'un invité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour supprimer un invité (protégée)
app.delete('/api/guests/:id', verifyAdminAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRSVP = await RSVP.findByIdAndDelete(id);
    
    if (!deletedRSVP) {
      return res.status(404).json({
        success: false,
        message: 'Invité non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Invité supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression d\'un invité:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour les statistiques des invités (protégée)
app.get('/api/guests/stats', verifyAdminAccess, async (req, res) => {
  try {
    // Nombre total d'invités
    const totalGuests = await RSVP.countDocuments();
    
    // Nombre d'invités ayant répondu
    const respondedGuests = await RSVP.countDocuments({ attending: { $ne: null } });
    
    // Nombre d'invités confirmés présents
    const attendingGuests = await RSVP.countDocuments({ attending: 'yes' });
    
    // Nombre d'invités ayant décliné
    const declinedGuests = await RSVP.countDocuments({ attending: 'no' });
    
    // Nombre total de personnes (invités + accompagnants)
    const guestsWithExtras = await RSVP.find({ attending: 'yes' });
    const totalAttendees = guestsWithExtras.reduce((sum, guest) => sum + (guest.guests || 0) + 1, 0);
    
    // Nombre de personnes ayant besoin d'hébergement
    const accommodationNeeded = await RSVP.countDocuments({ 
      attending: 'yes', 
      needsAccommodation: true 
    });
    
    // Réponse avec statistiques
    res.status(200).json({
      success: true,
      stats: {
        totalGuests,
        respondedGuests,
        attendingGuests,
        declinedGuests,
        totalAttendees,
        accommodationNeeded,
        responseRate: totalGuests > 0 ? Math.round((respondedGuests / totalGuests) * 100) : 0,
        confirmationRate: respondedGuests > 0 ? Math.round((attendingGuests / respondedGuests) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour récupérer la liste des invités (protégée)
app.get('/api/guests/list', verifyAdminAccess, async (req, res) => {
  try {
    const guests = await RSVP.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      guests: guests.map(guest => ({
        _id: guest._id,
        name: guest.name,
        email: guest.email,
        attending: guest.attending,
        guests: guest.guests,
        needsAccommodation: guest.needsAccommodation,
        message: guest.message,
        createdAt: guest.createdAt
      }))
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des invités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============ ROUTES GÉNÉRATION QR CODES ============
app.post('/api/guests/generate-guest-list', verifyAdminAccess, async (req, res) => {
  try {
    console.log('Route /api/guests/generate-guest-list appelée');
    const { guests } = req.body;
    
    // Validation de la liste d'invités
    if (!guests || !Array.isArray(guests)) {
      return res.status(400).json({ success: false, message: 'Liste d\'invités invalide' });
    }
    
    console.log(`Traitement de ${guests.length} invités...`);
    
    // Création des dossiers pour les QR codes si nécessaire
    const publicQrDir = path.join(__dirname, 'public/qr-codes');
    
    try {
      await fs.mkdir(publicQrDir, { recursive: true });
      console.log('Dossier QR codes créé ou existant:', publicQrDir);
    } catch (err) {
      console.error('Erreur lors de la création du dossier QR codes:', err);
    }
    
    // Traitement des invités et génération des QR codes
    const processedGuests = [];
    const errors = [];
    
    for (const guest of guests) {
      try {
        // Chercher l'invité dans la base de données
        let dbGuest = await RSVP.findOne({ email: guest.email });
        
        if (!dbGuest) {
          // Si l'invité n'existe pas, le créer
          dbGuest = new RSVP({
            name: guest.name,
            email: guest.email,
            attending: 'pending',
            message: guest.message || `Bienvenue ${guest.name} ! Nous sommes ravis de vous compter parmi nous.`
          });
          await dbGuest.save();
          console.log(`Nouvel invité créé: ${guest.name} (${guest.email})`);
        }
        
        // Générer un identifiant unique pour le QR code
        const uniqueId = crypto.createHash('md5').update(guest.email + Date.now()).digest('hex').substring(0, 12);
        
        // URL à encoder dans le QR code
        const invitationUrl = `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/invitation?email=${encodeURIComponent(guest.email)}`;
        
        // Chemin du fichier QR code
        const qrFilename = `${uniqueId}.png`;
        const qrPath = path.join(publicQrDir, qrFilename);
        
        // Générer le QR code
        await QRCode.toFile(qrPath, invitationUrl, {
          color: {
            dark: '#E4A11B',  // Ambre
            light: '#FFFFFF'  // Blanc
          },
          width: 500,
          margin: 1,
          errorCorrectionLevel: 'M'
        });
        
        // URL publique du QR code
        const qrCodeUrl = `/qr-codes/${qrFilename}`;
        
        // Mettre à jour l'invité avec l'URL du QR code
        dbGuest.qrCodeUrl = qrCodeUrl;
        await dbGuest.save();
        
        // Ajouter à la liste des invités traités
        processedGuests.push({
          _id: dbGuest._id,
          name: dbGuest.name,
          email: dbGuest.email,
          attending: dbGuest.attending,
          message: dbGuest.message,
          qrCodeUrl: dbGuest.qrCodeUrl
        });
        
        console.log(`QR code généré pour: ${guest.name} (${guest.email})`);
      } catch (error) {
        console.error(`Erreur pour l'invité ${guest.email}:`, error);
        errors.push({
          email: guest.email,
          name: guest.name,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `${processedGuests.length} QR codes générés avec succès`,
      guests: processedGuests,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Erreur générale lors de la génération des QR codes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
  }
});

// ============ ROUTES INVITÉS ============
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

// Route pour télécharger tous les QR codes
app.get('/api/guests/download-qr-codes', verifyAdminAccess, async (req, res) => {
  try {
    console.log('Route /api/guests/download-qr-codes appelée');
    
    // Récupérer tous les invités avec des QR codes
    const guests = await RSVP.find({ qrCodeUrl: { $exists: true, $ne: null } });
    
    if (guests.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Aucun QR code trouvé. Veuillez d\'abord générer les QR codes.'
      });
    }
    
    console.log(`Préparation de ${guests.length} QR codes pour téléchargement...`);
    
    // Définir les en-têtes pour le téléchargement
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=qr-codes-invites.zip');
    
    // Créer un stream d'archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Niveau de compression maximal
    });
    
    // Gérer les erreurs d'archivage
    archive.on('error', (err) => {
      console.error('Erreur d\'archivage:', err);
      res.status(500).end();
    });
    
    // Connecter l'archive au response
    archive.pipe(res);
    
    // Ajouter chaque QR code à l'archive
    const baseDir = path.join(__dirname, 'public');
    
    for (const guest of guests) {
      if (!guest.qrCodeUrl) continue;
      
      try {
        // Chemin absolu du QR code
        const qrPath = path.join(baseDir, guest.qrCodeUrl.replace(/^\//, ''));
        
        // Vérifier si le fichier existe
        try {
          await fs.access(qrPath);
        } catch (err) {
          console.warn(`QR code introuvable pour ${guest.name} (${guest.email}): ${qrPath}`);
          continue;
        }
        
        // Nom de fichier normalisé pour l'archive
        const sanitizedName = guest.name
          .replace(/[^\w\s-]/g, '') // Supprimer les caractères spéciaux
          .replace(/\s+/g, '_');    // Remplacer les espaces par des underscores
        
        const filename = `${sanitizedName}_${guest.email.split('@')[0]}.png`;
        
        // Ajouter le fichier à l'archive
        archive.file(qrPath, { name: filename });
        console.log(`QR code ajouté à l'archive: ${filename}`);
      } catch (fileError) {
        console.error(`Erreur lors de l'ajout du QR code pour ${guest.name}:`, fileError);
        // Continuer avec les autres QR codes
      }
    }
    
    // Finaliser l'archive
    await archive.finalize();
    console.log('Archive ZIP finalisée et envoyée');
  } catch (error) {
    console.error('Erreur lors du téléchargement des QR codes:', error);
    // Si la réponse n'a pas encore commencé, envoyer une erreur JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la création de l\'archive: ' + error.message 
      });
    } else {
      // Sinon, terminer simplement la réponse
      res.end();
    }
  }
});

// Servir les fichiers statiques en production
if (process.env.NODE_ENV === 'production') {
  // Servir les fichiers statiques
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Route pour la page d'accueil
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
  
  // Middleware pour toutes les autres routes non-API
  app.use((req, res, next) => {
    // Ne pas intercepter les routes API
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Renvoyer le fichier index.html pour toutes les autres routes
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Routes d'authentification disponibles sur http://localhost:${PORT}/api/auth/admin`);
});