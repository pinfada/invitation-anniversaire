// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Protection contre les attaques par force brute
const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // 5 tentatives maximum
  message: { success: false, message: 'Trop de tentatives de connexion, veuillez réessayer plus tard' }
});

// Stockage en mémoire des refresh tokens (en production: utiliser Redis ou DB)
const refreshTokens = new Map();

// Génération des secrets JWT
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

// Fonction pour générer les tokens JWT
const generateTokens = (adminId) => {
  const accessToken = jwt.sign(
    { adminId, role: 'admin' },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { adminId, role: 'admin', type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Fonction pour valider un access token
const validateAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    return null;
  }
};

// Fonction pour valider un refresh token
const validateRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET);
    return refreshTokens.has(token) ? payload : null;
  } catch (error) {
    return null;
  }
};

// Route de connexion admin avec JWT
router.post('/admin', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    // Vérifier le mot de passe (stocké en variable d'environnement)
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
    
    // Générer les tokens JWT
    const adminId = 'admin-' + crypto.randomBytes(8).toString('hex');
    const { accessToken, refreshToken } = generateTokens(adminId);
    
    // Stocker le refresh token
    refreshTokens.set(refreshToken, {
      adminId,
      createdAt: Date.now(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    
    // Nettoyer les anciens refresh tokens (plus de 7 jours)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [token, data] of refreshTokens.entries()) {
      if (data.createdAt < sevenDaysAgo) {
        refreshTokens.delete(token);
      }
    }
    
    // Journaliser la connexion
    console.log(`Connexion admin réussie: ${new Date().toISOString()} - Admin ID: ${adminId}`);
    
    // Configuration du cookie pour le refresh token (sécurisé)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    
    // Retourner l'access token
    res.json({
      success: true,
      message: 'Authentification réussie',
      accessToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    });
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route de vérification de token JWT
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'accès requis'
      });
    }
    
    const payload = validateAccessToken(token);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
    
    res.json({
      success: true,
      message: 'Token valide',
      user: { 
        adminId: payload.adminId,
        role: payload.role,
        exp: payload.exp
      }
    });
  } catch (error) {
    console.error('Erreur de vérification:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour rafraîchir l'access token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requis'
      });
    }
    
    const payload = validateRefreshToken(refreshToken);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token invalide ou expiré'
      });
    }
    
    // Supprimer l'ancien refresh token
    refreshTokens.delete(refreshToken);
    
    // Générer de nouveaux tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload.adminId);
    
    // Stocker le nouveau refresh token
    refreshTokens.set(newRefreshToken, {
      adminId: payload.adminId,
      createdAt: Date.now(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    
    // Configuration du nouveau cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.json({
      success: true,
      message: 'Token rafraìhi avec succès',
      accessToken,
      expiresIn: 900
    });
  } catch (error) {
    console.error('Erreur de rafraîchissement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route de déconnexion
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    // Supprimer le cookie
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Middleware d'authentification JWT (exporté pour utilisation dans d'autres routes)
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token d\'accès requis'
    });
  }
  
  const payload = validateAccessToken(token);
  if (!payload) {
    return res.status(403).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
  
  req.admin = payload;
  next();
};

module.exports = { router, authenticateJWT };

