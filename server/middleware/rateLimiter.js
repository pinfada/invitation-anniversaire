// server/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Limiteur général d'API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard' }
});

// Limiteur spécifique pour les routes sensibles
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Limite à 10 tentatives
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives, veuillez réessayer plus tard' }
});

module.exports = {
  apiLimiter,
  authLimiter
};