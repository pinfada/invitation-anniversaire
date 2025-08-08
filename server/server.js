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
const fs = require('fs');  // ✅ Import synchrone standard
const fsPromises = require('fs').promises;  // ✅ Import pour les opérations async
const archiver = require('archiver');
const { createReadStream } = require('fs');

// Middlewares de sécurité
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configuration Helmet pour la sécurité des headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      // Interdire l'inline; les scripts sont maintenant externes
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false // Nécessaire pour Firebase
}));

// Configuration CORS sécurisée avec whitelist de domaines
const allowedOrigins = [
  'http://localhost:3000', // Développement local
  'https://invitation-anniversaire.onrender.com', // Production
  process.env.FRONTEND_URL, // URL frontend depuis les variables d'environnement
].filter(Boolean); // Filtrer les valeurs undefined

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (applications mobiles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origine est dans la whitelist
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin non autorisée: ${origin}`);
      callback(new Error('Non autorisé par la politique CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Nécessaire pour les cookies JWT
  optionsSuccessStatus: 200 // Support des anciens navigateurs
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite de 100 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Middleware de sanitisation
const { sanitizeMiddleware } = require('./middleware/sanitization');
app.use(sanitizeMiddleware());

// Middleware de base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')());

// Logs pour le débogage
console.log('Démarrage du serveur...');
console.log('Variables d\'environnement chargées:', process.env.ADMIN_PASSWORD_HASH ? 'Oui (ADMIN_PASSWORD_HASH)' : 'Non (ADMIN_PASSWORD_HASH manquant)');

// Vérification des variables d'environnement critiques
const requiredEnvVars = ['MONGODB_URI', 'ADMIN_PASSWORD_HASH'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('🚨 Variables d\'environnement manquantes:', missingEnvVars.join(', '));
  console.error('⚠️  Vérifiez votre fichier .env ou vos variables d\'environnement');
  
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Arrêt du serveur en production');
    process.exit(1);
  } else {
    console.warn('⚠️  Mode développement : continuez avec des valeurs par défaut');
  }
}

// Configuration de la connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/birthday-invitation', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connecté'))
.catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Configuration de Firebase (pour le stockage des photos)
let storage = null;

if (process.env.FIREBASE_API_KEY && process.env.FIREBASE_STORAGE_BUCKET) {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  const firebaseApp = initializeApp(firebaseConfig);
  storage = getStorage(firebaseApp);
  console.log('✅ Firebase configuré avec succès');
} else {
  console.warn('⚠️  Firebase non configuré - fonctionnalités de photos désactivées');
}

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

// ============ ROUTES D'AUTHENTIFICATION (JWT) ============
const { router: authRouter, authenticateJWT } = require('./routes/authRoutes');
app.use('/api/auth', authRouter);

// ============ ROUTES DES INVITÉS ============
const guestRouter = require('./routes/guestRoutes');
app.use('/api/guests', guestRouter);

// ============ ENDPOINT HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'invitation-anniversaire',
    version: '1.0.0'
  });
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
      await fsPromises.mkdir(publicQrDir, { recursive: true });
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
        
        // Générer un identifiant unique cryptographiquement sécurisé pour le QR code
        const uniqueId = crypto.randomBytes(16).toString('hex');
        
        // URL à encoder dans le QR code avec le code unique
        const invitationUrl = `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/?code=${uniqueId}`;
        
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
        
        // Vérifier l'unicité du code avant sauvegarde
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
          const existingGuest = await RSVP.findOne({ uniqueCode: uniqueId });
          if (!existingGuest) {
            isUnique = true;
          } else {
            uniqueId = crypto.randomBytes(16).toString('hex');
            attempts++;
          }
        }
        
        if (!isUnique) {
          throw new Error('Impossible de générer un code unique');
        }

        // Mettre à jour l'invité avec l'URL du QR code et le code unique
        dbGuest.qrCodeUrl = qrCodeUrl;
        dbGuest.uniqueCode = uniqueId;
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
// Route pour vérifier un code QR et récupérer les données de l'invité
app.get('/api/guests/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code QR manquant' 
      });
    }
    
    // Chercher l'invité avec ce code unique
    const guest = await RSVP.findOne({ uniqueCode: code });
    
    if (!guest) {
      return res.status(404).json({ 
        success: false, 
        message: 'Code QR invalide ou expiré' 
      });
    }
    
    // Retourner les données de l'invité
    res.status(200).json({
      success: true,
      guest: {
        name: guest.name,
        email: guest.email,
        attending: guest.attending,
        guests: guest.guests,
        message: guest.message,
        needsAccommodation: guest.needsAccommodation,
        hasCheckedIn: guest.hasCheckedIn,
        personalWelcomeMessage: guest.message || `Bienvenue ${guest.name} ! Nous sommes ravis de vous compter parmi nous.`
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du code QR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la vérification' 
    });
  }
});

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
        address: "18 Rue du Stade, 17000 La Rochelle, France",
        coordinates: { lat: 46.1603986, lng: -1.1770363 },
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
    if (!storage) {
      return res.status(503).json({ 
        success: false, 
        message: 'Service de photos non disponible - Firebase non configuré' 
      });
    }

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
app.get('/api/guests/download-qr-codes', authenticateJWT, async (req, res) => {
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
          await fsPromises.access(qrPath);
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

// ✅ Fonction corrigée pour trouver le chemin client/build
const findClientBuildPath = () => {
  // Options possibles de chemin en fonction de la structure de déploiement
  const possiblePaths = [
    path.join(__dirname, 'client/build'),               // Chemin standard
    path.join(__dirname, '../client/build'),            // Un niveau au-dessus
    path.resolve('/opt/render/project/src/client/build'),// Chemin Render spécifique
    path.resolve('./client/build')                      // Chemin relatif au process
  ];
  
  console.log('🔍 Recherche du dossier client/build...');
  console.log('Répertoire de travail actuel:', process.cwd());
  console.log('__dirname:', __dirname);
  
  // Vérifier chaque chemin et retourner le premier valide
  for (const testPath of possiblePaths) {
    try {
      console.log(`   Vérification: ${testPath}`);
      if (fs.existsSync(testPath)) {
        console.log(`✅ Chemin client/build valide trouvé: ${testPath}`);
        
        // Vérifier le contenu du dossier
        try {
          const contents = fs.readdirSync(testPath);
          console.log(`   Contenu (${contents.length} éléments):`, contents.slice(0, 5).join(', ') + (contents.length > 5 ? '...' : ''));
          
          // Vérifier si index.html existe
          const indexPath = path.join(testPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            console.log(`✅ index.html trouvé: ${indexPath}`);
            return testPath;
          } else {
            console.log(`❌ index.html manquant dans: ${testPath}`);
          }
        } catch (readError) {
          console.log(`❌ Erreur de lecture du dossier ${testPath}:`, readError.message);
        }
      } else {
        console.log(`❌ Chemin inexistant: ${testPath}`);
      }
    } catch (err) {
      console.log(`❌ Erreur lors de la vérification du chemin ${testPath}:`, err.message);
    }
  }
  
  console.error('🚨 ATTENTION: Aucun chemin client/build valide trouvé!');
  return null;
};

// ✅ Servir les fichiers statiques en production avec gestion robuste
if (process.env.NODE_ENV === 'production') {
  console.log('🏭 Mode production activé - Configuration des fichiers statiques...');
  
  // Déterminer le bon chemin pour les fichiers statiques
  const clientBuildPath = findClientBuildPath();
  
  if (clientBuildPath) {
    // Servir les fichiers statiques
    console.log(`📁 Servant les fichiers statiques depuis: ${clientBuildPath}`);
    app.use(express.static(clientBuildPath));
    
    // Servir les QR codes depuis public/qr-codes
    const qrCodesPath = path.join(__dirname, 'public/qr-codes');
    if (fs.existsSync(qrCodesPath)) {
      app.use('/qr-codes', express.static(qrCodesPath));
      console.log(`📄 QR codes servis depuis: ${qrCodesPath}`);
    }
    
    // Route catch-all pour React Router (doit être en dernier)
    app.get('*', (req, res, next) => {
      // Ne pas intercepter les routes API
      if (req.path.startsWith('/api/')) {
        return next();
      }
      
      // Chemin vers index.html
      const indexPath = path.join(clientBuildPath, 'index.html');
      
      // Vérifier si le fichier existe avant de le servir
      try {
        if (fs.existsSync(indexPath)) {
          console.log(`📄 Servant index.html pour: ${req.path}`);
          return res.sendFile(indexPath);
        } else {
          console.error(`❌ ERREUR: index.html non trouvé à: ${indexPath}`);
          return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Erreur 404</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
              <h1>Erreur 404</h1>
              <p>Fichier index.html introuvable à: ${indexPath}</p>
            </body>
            </html>
          `);
        }
      } catch (err) {
        console.error(`❌ Erreur lors de l'accès à index.html:`, err);
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Erreur 500</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <h1>Erreur 500</h1>
            <p>Erreur serveur lors de l'accès au fichier index.html</p>
            <p>Détail: ${err.message}</p>
          </body>
          </html>
        `);
      }
    });
  } else {
    // Fallback si aucun chemin valide n'est trouvé
    console.error('🚨 ERREUR CRITIQUE: Impossible de trouver le dossier client/build!');
    
    // Middleware pour informer l'utilisateur
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api/')) {
        return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Service temporairement indisponible</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: linear-gradient(135deg, #fef3c7, #fde68a);
                color: #92400e;
                margin: 0;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                padding: 40px; 
                border-radius: 15px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              }
              h1 { color: #d97706; margin-bottom: 20px; }
              .loading { 
                display: inline-block; 
                width: 20px; 
                height: 20px; 
                border: 3px solid #f3f3f3; 
                border-top: 3px solid #d97706; 
                border-radius: 50%; 
                animation: spin 1s linear infinite; 
                margin: 20px 0;
              }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .btn {
                background: #d97706; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                cursor: pointer; 
                font-size: 16px;
                margin: 20px 10px;
                text-decoration: none;
                display: inline-block;
              }
              .btn:hover { background: #b45309; }
              .debug {
                background: #f3f4f6;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: left;
                font-family: monospace;
                font-size: 12px;
                color: #374151;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🎉 Application en cours de déploiement</h1>
              <div class="loading"></div>
              <p><strong>L'application React est en cours de compilation...</strong></p>
              <p>Ceci peut prendre quelques minutes lors du premier déploiement.</p>
              
              <div class="debug">
                <strong>Informations de diagnostic :</strong><br>
                • Répertoire de travail: ${process.cwd()}<br>
                • __dirname: ${__dirname}<br>
                • NODE_ENV: ${process.env.NODE_ENV}<br>
                • Timestamp: ${new Date().toISOString()}
              </div>
              
              <button onclick="window.location.reload()" class="btn">
                🔄 Rafraîchir la page
              </button>
              
              <a href="/api/health" class="btn" style="background: #059669;">
                ✅ Vérifier l'API
              </a>
              
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                Si le problème persiste après 10 minutes, contactez l'administrateur.
              </p>
            </div>
          </body>
          </html>
        `);
      }
      next();
    });
  }
} else {
  // ✅ En mode développement
  console.log('🛠️ Mode développement - API seulement');
  app.get('/', (req, res) => {
    res.json({
      message: 'API Server is running! 🚀',
      mode: 'development',
      endpoints: {
        health: '/api/health',
        admin: '/api/auth/admin',
        guests: '/api/guests'
      },
      frontend: 'Should be running on port 3000'
    });
  });
}

// ✅ Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur non gérée:', err.stack);
  
  // Ne pas exposer les détails d'erreur en production
  const errorDetails = process.env.NODE_ENV === 'development' ? {
    message: err.message,
    stack: err.stack
  } : {
    message: 'Une erreur interne est survenue'
  };
  
  res.status(500).json({ 
    success: false, 
    message: 'Erreur interne du serveur',
    error: errorDetails
  });
});

// ✅ Gestion des routes non trouvées
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Route API non trouvée: ${req.method} ${req.originalUrl}`,
      availableRoutes: [
        'GET /api/health',
        'POST /api/auth/admin',
        'GET /api/guests',
        'POST /api/guests',
        'POST /api/rsvp'
      ]
    });
  }
  
  // Pour les routes non-API en production, cela devrait être géré par le catch-all React
  res.status(404).send('Route non trouvée');
});

// ✅ Démarrage du serveur avec logs détaillés
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀════════════════════════════════════════🚀');
  console.log(`🎉 Serveur démarré avec succès sur le port ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Répertoire de travail: ${process.cwd()}`);
  console.log(`📂 Répertoire serveur: ${__dirname}`);
  console.log(`⏰ Démarrage: ${new Date().toISOString()}`);
  console.log('🚀════════════════════════════════════════🚀');
  
  // Routes disponibles
  console.log('📡 Routes API disponibles:');
  console.log(`   🔐 Admin: http://localhost:${PORT}/api/auth/admin`);
  console.log(`   ❤️  Health: http://localhost:${PORT}/api/health`);
  console.log(`   👥 Invités: http://localhost:${PORT}/api/guests`);
  console.log(`   📝 RSVP: http://localhost:${PORT}/api/rsvp`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`   🌐 Frontend: http://localhost:${PORT}/`);
  } else {
    console.log(`   🛠️  Frontend dev: http://localhost:3000/`);
  }
  console.log('────────────────────────────────────────────');
});