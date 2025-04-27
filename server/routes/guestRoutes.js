// server/routes/guestRoutes.js
const express = require('express');
const router = express.Router();
const GuestModel = require('../../models/Guest'); // Correction de l'import
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');

// Configuration des limites de requêtes pour prévenir les abus
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limite à 50 requêtes par fenêtre
  message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard' }
});

// Limites pour les vérifications de QR code
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limite à 20 requêtes par fenêtre
  message: { success: false, message: 'Trop de tentatives de vérification, veuillez réessayer plus tard' }
});

// Middleware d'authentification admin
const verifyAdminAccess = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
  }
  
  next();
};

// Utilitaires de validation
const validators = {
  isValidEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && re.test(email);
  },
  
  sanitizeInput: (input, maxLength = 100) => {
    if (typeof input !== 'string') return '';
    // Suppression des caractères potentiellement dangereux
    return input
      .replace(/[<>]/g, '') // Bloque les tags HTML basiques
      .trim()
      .substring(0, maxLength);
  },
  
  generateUniqueCode: (length = 6) => {
    return crypto.randomBytes(length).toString('hex');
  },
  
  isValidCode: (code) => {
    return typeof code === 'string' && /^[0-9a-f]{12,32}$/i.test(code);
  }
};

// Génération de la liste des invités avec codes uniques - SÉCURISÉ & OPTIMISÉ
router.post('/generate-guest-list', verifyAdminAccess, apiLimiter, async (req, res) => {
  try {
    const { guests } = req.body;
    
    // Validation de la liste d'invités
    if (!guests || !Array.isArray(guests)) {
      return res.status(400).json({ success: false, message: 'Liste d\'invités invalide' });
    }
    
    // Limite du nombre d'invités par requête
    if (guests.length > 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum 50 invités par requête autorisés' 
      });
    }
    
    const createdGuests = [];
    const failedGuests = [];
    const qrCodesDir = path.join(__dirname, '../private/qr-codes'); // Déplacé hors du dossier public
    
    // Création du dossier QR codes avec gestion d'erreur améliorée
    try {
      await fs.mkdir(qrCodesDir, { recursive: true });
    } catch (err) {
      console.error('Erreur lors de la création du dossier QR codes:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la préparation du stockage des QR codes' 
      });
    }
    
    // Création du dossier public pour les QR codes (versions accessibles)
    const publicQrDir = path.join(__dirname, '../public/qr-codes');
    try {
      await fs.mkdir(publicQrDir, { recursive: true });
    } catch (err) {
      console.error('Erreur lors de la création du dossier public QR codes:', err);
    }
    
    // Traitement de chaque invité
    for (const guestData of guests) {
      try {
        // Validation et sanitization des données d'entrée
        const name = validators.sanitizeInput(guestData.name);
        const email = validators.sanitizeInput(guestData.email, 150);
        
        if (!name || !validators.isValidEmail(email)) {
          failedGuests.push({
            name: guestData.name,
            email: guestData.email,
            reason: 'Données invalides'
          });
          continue;
        }
        
        // Vérification de l'existence préalable
        const existingGuest = await GuestModel.findOne({ email });
        if (existingGuest) {
          failedGuests.push({
            name,
            email,
            reason: 'Email déjà enregistré'
          });
          continue;
        }
        
        // Génération d'un code unique avec vérification de collision
        let uniqueCode;
        let isCodeUnique = false;
        let attempts = 0;
        
        while (!isCodeUnique && attempts < 5) {
          uniqueCode = validators.generateUniqueCode(8); // Augmentation à 8 bytes (16 caractères)
          const codeExists = await GuestModel.findOne({ uniqueCode });
          if (!codeExists) {
            isCodeUnique = true;
          }
          attempts++;
        }
        
        if (!isCodeUnique) {
          failedGuests.push({
            name,
            email,
            reason: 'Impossible de générer un code unique'
          });
          continue;
        }
        
        // Message personnalisé sanitizé
        const personalMessage = guestData.personalWelcomeMessage ? 
          validators.sanitizeInput(guestData.personalWelcomeMessage, 500) : 
          `Bienvenue ${name} ! Nous sommes ravis de vous compter parmi nous.`;
        
        // Création de l'invité dans la base de données avec gestion d'erreur
        const guest = new GuestModel({
          name,
          email,
          uniqueCode,
          personalWelcomeMessage: personalMessage
        });
        
        await guest.save();
        
        // Génération de l'URL pour le QR code avec protocole paramétrable
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const qrUrl = `${baseUrl}/invitation?code=${uniqueCode}`;
        
        // Génération du QR code avec design amélioré
        const qrOptions = {
          type: 'png',
          color: {
            dark: '#E4A11B', // Couleur ambrée thématique
            light: '#FFFFFF'
          },
          width: 500, // Augmenté pour meilleure qualité
          margin: 1,
          errorCorrectionLevel: 'M', // Niveau de correction d'erreur medium
        };
        
        // Stockage dans un dossier privé (inaccessible directement)
        const privateQrPath = path.join(qrCodesDir, `${uniqueCode}.png`);
        await QRCode.toFile(privateQrPath, qrUrl, qrOptions);
        
        // Copie dans le dossier public pour accès web, avec un nom hashé et non-prédictible 
        const publicId = crypto.createHash('sha256').update(uniqueCode).digest('hex').substring(0, 12);
        const publicQrPath = path.join(publicQrDir, `${publicId}.png`);
        await fs.copyFile(privateQrPath, publicQrPath);
        
        // Enregistrement du chemin public pour l'accès API
        createdGuests.push({
          ...guest.toJSON(),
          qrCodeUrl: `/qr-codes/${publicId}.png`
        });
      } catch (guestError) {
        console.error(`Erreur lors du traitement de l'invité ${guestData.email}:`, guestError);
        failedGuests.push({
          name: guestData.name,
          email: guestData.email,
          reason: 'Erreur technique'
        });
      }
    }
    
    // Journalisation des résultats
    console.log(`Génération terminée: ${createdGuests.length} créés, ${failedGuests.length} échoués`);
    
    // Réponse avec résultats complets
    res.status(201).json({ 
      success: true, 
      message: `${createdGuests.length} invités créés avec succès`, 
      guests: createdGuests,
      failed: failedGuests.length > 0 ? failedGuests : undefined
    });
  } catch (error) {
    console.error('Erreur lors de la génération des invités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors du traitement' });
  }
});

// Vérifier un code invité - OPTIMISÉ ET SÉCURISÉ
router.get('/verify/:code', verifyLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Validation du code
    if (!code || !validators.isValidCode(code)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code d\'invitation invalide' 
      });
    }
    
    // Recherche de l'invité avec ce code
    const guest = await GuestModel.findOne({ uniqueCode: code });
    
    if (!guest) {
      // Délai anti-brute force (300-500ms) 
      const delay = 300 + Math.floor(Math.random() * 200);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return res.status(404).json({ 
        success: false, 
        message: 'Invitation non trouvée ou expirée' 
      });
    }
    
    // Journalisation d'accès pour audit
    console.log(`Vérification d'invitation: ${guest.name} (${guest.email}) - Code: ${code.substring(0, 4)}...`);
    
    // Construction de la réponse avec données limitées (pas d'exposition du code complet)
    res.status(200).json({ 
      success: true, 
      guest: {
        name: guest.name,
        email: guest.email,
        attending: guest.attending,
        personalWelcomeMessage: guest.personalWelcomeMessage,
        hasCheckedIn: guest.hasCheckedIn,
        // Pas d'exposition du uniqueCode complet dans la réponse
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du code:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Confirmer la présence (RSVP)
router.post('/rsvp', apiLimiter, async (req, res) => {
  try {
    const { email, code, attending, guests, needsAccommodation, message } = req.body;
    
    // Validation des données
    if (!email || !code || attending === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Données incomplètes. Email, code et statut de présence requis.' 
      });
    }
    
    if (!validators.isValidEmail(email) || !validators.isValidCode(code)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format de données invalide' 
      });
    }
    
    // Recherche de l'invité
    const guest = await GuestModel.findOne({ 
      email: email,
      uniqueCode: code 
    });
    
    if (!guest) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invitation non trouvée. Veuillez vérifier vos informations.' 
      });
    }
    
    // Mise à jour des informations de RSVP
    guest.attending = attending;
    
    if (attending === true) {
      // Nombre d'invités supplémentaires (uniquement si présent)
      const guestsCount = parseInt(guests);
      guest.guests = !isNaN(guestsCount) && guestsCount >= 0 && guestsCount <= 10 ? 
                    guestsCount : 0;
      
      // Besoin d'hébergement
      guest.needsAccommodation = needsAccommodation === true;
      
      // Message (sanitisé)
      if (message) {
        guest.message = validators.sanitizeInput(message, 1000);
      }
    }
    
    await guest.save();
    
    // Si présent, générer des informations de localisation
    let locationInfo = null;
    if (attending === true) {
      locationInfo = {
        accessGranted: true,
        // Autres informations spécifiques au lieu peuvent être ajoutées ici
      };
    }
    
    // Journalisation
    console.log(`RSVP: ${guest.name} (${guest.email}) - Statut: ${attending ? 'Présent' : 'Absent'}`);
    
    res.status(200).json({ 
      success: true, 
      message: attending ? 
        'Merci d\'avoir confirmé votre présence! Nous avons hâte de vous voir.' : 
        'Merci pour votre réponse. Vous allez nous manquer!',
      guest: {
        name: guest.name,
        attending: guest.attending,
        guests: guest.guests,
        needsAccommodation: guest.needsAccommodation
      },
      locationInfo
    });
  } catch (error) {
    console.error('Erreur lors du traitement du RSVP:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Enregistrer l'arrivée d'un invité (check-in) - OPTIMISÉ ET SÉCURISÉ
router.post('/check-in/:code', verifyLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Validation du code
    if (!code || !validators.isValidCode(code)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code d\'invitation invalide' 
      });
    }
    
    // Recherche de l'invité
    const guest = await GuestModel.findOne({ uniqueCode: code });
    
    if (!guest) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invitation non trouvée. Veuillez vérifier le code QR.' 
      });
    }
    
    // Vérification que l'invité a confirmé sa présence
    if (guest.attending !== true) {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'enregistrer l\'arrivée: présence non confirmée préalablement'
      });
    }
    
    // Vérification si déjà enregistré
    if (guest.hasCheckedIn) {
      return res.status(200).json({
        success: true,
        message: `${guest.name} est déjà enregistré(e) (arrivée à ${guest.checkInTime.toLocaleTimeString()})`,
        isAlreadyCheckedIn: true,
        guest: {
          name: guest.name,
          checkInTime: guest.checkInTime
        }
      });
    }
    
    // Enregistrement de l'arrivée
    guest.hasCheckedIn = true;
    guest.checkInTime = new Date();
    await guest.save();
    
    // Journalisation
    console.log(`Check-in: ${guest.name} (${guest.email}) à ${guest.checkInTime.toLocaleString()}`);
    
    // Réponse avec message personnalisé
    res.status(200).json({
      success: true,
      message: `Bienvenue ${guest.name}!`,
      guest: {
        name: guest.name,
        personalWelcomeMessage: guest.personalWelcomeMessage,
        checkInTime: guest.checkInTime,
        guests: guest.guests,
        needsAccommodation: guest.needsAccommodation
      }
    });
  } catch (error) {
    console.error('Erreur lors du check-in:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer les statistiques des invités (admin uniquement)
router.get('/stats', verifyAdminAccess, async (req, res) => {
  try {
    // Nombre total d'invités
    const totalGuests = await GuestModel.countDocuments();
    
    // Nombre d'invités ayant répondu
    const respondedGuests = await GuestModel.countDocuments({ attending: { $ne: null } });
    
    // Nombre d'invités confirmés présents
    const attendingGuests = await GuestModel.countDocuments({ attending: true });
    
    // Nombre d'invités ayant décliné
    const declinedGuests = await GuestModel.countDocuments({ attending: false });
    
    // Nombre d'invités ayant fait le check-in
    const checkedInGuests = await GuestModel.countDocuments({ hasCheckedIn: true });
    
    // Nombre total de personnes (invités + accompagnants)
    const guestsWithExtras = await GuestModel.find({ attending: true });
    const totalAttendees = guestsWithExtras.reduce((sum, guest) => sum + (guest.guests || 0) + 1, 0);
    
    // Nombre de personnes ayant besoin d'hébergement
    const accommodationNeeded = await GuestModel.countDocuments({ 
      attending: true, 
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
        checkedInGuests,
        totalAttendees,
        accommodationNeeded,
        responseRate: totalGuests > 0 ? Math.round((respondedGuests / totalGuests) * 100) : 0,
        confirmationRate: respondedGuests > 0 ? Math.round((attendingGuests / respondedGuests) * 100) : 0,
        checkInRate: attendingGuests > 0 ? Math.round((checkedInGuests / attendingGuests) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer la liste des invités (admin uniquement)
router.get('/list', verifyAdminAccess, async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filtres
    const filters = {};
    if (req.query.attending === 'true') filters.attending = true;
    if (req.query.attending === 'false') filters.attending = false;
    if (req.query.hasCheckedIn === 'true') filters.hasCheckedIn = true;
    if (req.query.needsAccommodation === 'true') filters.needsAccommodation = true;
    
    // Recherche
    if (req.query.search) {
      const searchRegex = new RegExp(validators.sanitizeInput(req.query.search), 'i');
      filters.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }
    
    // Récupération des invités avec pagination
    const guests = await GuestModel.find(filters)
      .select('-__v') // Exclure champ technique
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
    
    // Compter le total pour la pagination
    const total = await GuestModel.countDocuments(filters);
    
    // Réponse avec données et pagination
    res.status(200).json({
      success: true,
      guests: guests.map(guest => {
        const guestObj = guest.toJSON();
        // Pour sécurité, masquer une partie du code unique dans la liste
        if (guestObj.uniqueCode) {
          guestObj.uniqueCode = `${guestObj.uniqueCode.substring(0, 4)}...${guestObj.uniqueCode.substring(guestObj.uniqueCode.length - 4)}`;
        }
        return guestObj;
      }),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des invités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;