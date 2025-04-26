// server/routes/guestRoutes.js
const express = require('express');
const router = express.Router();
import GuestModel from '../../models/Guest';
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

// Générer la liste des invités avec codes uniques
router.post('/generate-guest-list', async (req, res) => {
  try {
    const { guests } = req.body;
    
    if (!guests || !Array.isArray(guests)) {
      return res.status(400).json({ success: false, message: 'Liste d\'invités invalide' });
    }
    
    const createdGuests = [];
    const qrCodesDir = path.join(__dirname, '../public/qr-codes');
    
    // Créer le dossier pour les QR codes s'il n'existe pas
    try {
      await fs.mkdir(qrCodesDir, { recursive: true });
    } catch (err) {
      console.error('Erreur lors de la création du dossier QR codes:', err);
    }
    
    for (const guestData of guests) {
      // Générer un code unique pour chaque invité
      const uniqueCode = crypto.randomBytes(6).toString('hex');
      
      // Créer l'invité dans la base de données
      const guest = new GuestModel({
        name: guestData.name,
        email: guestData.email,
        uniqueCode,
        personalWelcomeMessage: guestData.personalWelcomeMessage || `Bienvenue ${guestData.name} ! Nous sommes ravis de vous compter parmi nous.`
      });
      
      await guest.save();
      
      // Générer l'URL pour le QR code
      const qrUrl = `${req.protocol}://${req.get('host')}/invitation?code=${uniqueCode}`;
      
      // Générer le QR code
      const qrCodeFilePath = path.join(qrCodesDir, `${uniqueCode}.png`);
      await QRCode.toFile(qrCodeFilePath, qrUrl, {
        color: {
          dark: '#E4A11B', // Couleur ambrée pour correspondre au thème
          light: '#FFFFFF'
        },
        width: 300,
        margin: 1
      });
      
      createdGuests.push({
        ...guest.toJSON(),
        qrCodeUrl: `/qr-codes/${uniqueCode}.png`
      });
    }
    
    res.status(201).json({ 
      success: true, 
      message: `${createdGuests.length} invités créés avec succès`, 
      guests: createdGuests 
    });
  } catch (error) {
    console.error('Erreur lors de la génération des invités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Vérifier un code invité
router.get('/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code manquant' });
    }
    
    const guest = await GuestModel.findOne({ uniqueCode: code });
    
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Invité non trouvé' });
    }
    
    res.status(200).json({ 
      success: true, 
      guest: {
        name: guest.name,
        email: guest.email,
        attending: guest.attending,
        personalWelcomeMessage: guest.personalWelcomeMessage,
        hasCheckedIn: guest.hasCheckedIn
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du code:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Enregistrer l'arrivée d'un invité (check-in)
router.post('/check-in/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code manquant' });
    }
    
    const guest = await GuestModel.findOne({ uniqueCode: code });
    
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Invité non trouvé' });
    }
    
    // Mettre à jour l'état de check-in
    guest.hasCheckedIn = true;
    guest.checkInTime = new Date();
    await guest.save();
    
    res.status(200).json({ 
      success: true, 
      message: `Bienvenue ${guest.name}!`, 
      guest: {
        name: guest.name,
        personalWelcomeMessage: guest.personalWelcomeMessage,
        checkInTime: guest.checkInTime
      }
    });
  } catch (error) {
    console.error('Erreur lors du check-in:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;