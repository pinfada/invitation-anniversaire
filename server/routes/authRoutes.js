// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

// Protection contre les attaques par force brute
const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // 5 tentatives maximum
  message: { success: false, message: 'Trop de tentatives de connexion, veuillez réessayer plus tard' }
});

// Route de connexion admin
router.post('/admin', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    // Vérifier le mot de passe (stocké en variable d'environnement)
    // Dans une implémentation en production, le mot de passe devrait être hashé dans la DB
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH n\'est pas défini dans les variables d\'environnement');
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur de configuration du serveur'
      });
    }
    
    // Comparaison du mot de passe
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash);
    
    if (!isValidPassword) {
      // Délai pour contrer les attaques timing
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      return res.status(401).json({ 
        success: false, 
        message: 'Mot de passe incorrect' 
      });
    }
    
    // Générer une clé API temporaire
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Dans un système en production, on stockerait cette clé en base de données
    // avec une date d'expiration et l'identifiant de l'utilisateur
    
    // Pour cette implémentation, on utilise process.env pour stocker temporairement la clé
    // (dans un vrai système, utiliser Redis ou une autre solution de stockage appropriée)
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route de vérification de token (améliorée)
router.post('/verify', async (req, res) => {
  try {
    // Accepter l'API key du body OU des headers pour plus de flexibilité
    const apiKey = req.body.apiKey || req.headers['x-api-key'];
    const adminKey = process.env.ADMIN_API_KEY
    console.log('AuthContext -> apiKey : ', apiKey)
    console.log('AuthContext -> adminKey : ', adminKey)
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      // Délai anti-timing attack
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      
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

module.exports = router;