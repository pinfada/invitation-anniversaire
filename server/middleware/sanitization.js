// server/middleware/sanitization.js
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Configuration DOMPurify pour Node.js
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configuration sécurisée pour la sanitisation
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
  SANITIZE_DOM: true,
  FORCE_BODY: false,
  IN_PLACE: false
};

/**
 * Sanitise une chaîne en supprimant tous les éléments HTML/JS dangereux
 * @param {string} input - Chaîne à sanitiser
 * @param {object} options - Options de sanitisation personnalisées
 * @returns {string} - Chaîne sanitisée
 */
const sanitizeString = (input, options = {}) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Combiner les options par défaut avec les options personnalisées
  const sanitizeOptions = { ...SANITIZE_OPTIONS, ...options };
  
  // Sanitiser avec DOMPurify
  const sanitized = purify.sanitize(input, sanitizeOptions);
  
  // Nettoyage supplémentaire des caractères de contrôle
  return sanitized
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Supprimer les caractères de contrôle
    .trim();
};

/**
 * Sanitise récursivement un objet
 * @param {any} obj - Objet à sanitiser
 * @param {object} options - Options de sanitisation
 * @returns {any} - Objet sanitisé
 */
const sanitizeObject = (obj, options = {}) => {
  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitiser aussi les clés
      const sanitizedKey = sanitizeString(key, options);
      sanitized[sanitizedKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Middleware Express pour sanitiser automatiquement les données entrantes
 * @param {object} options - Options de sanitisation
 * @returns {function} - Middleware Express
 */
const sanitizeMiddleware = (options = {}) => {
  return (req, res, next) => {
    try {
      // Sanitiser le body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options);
      }
      
      // Sanitiser les paramètres de requête
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options);
      }
      
      // Sanitiser les paramètres d'URL
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, options);
      }
      
      next();
    } catch (error) {
      console.error('Erreur lors de la sanitisation:', error);
      res.status(400).json({
        success: false,
        message: 'Données d\'entrée invalides'
      });
    }
  };
};

/**
 * Validation stricte pour les emails
 * @param {string} email 
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validation stricte pour les noms
 * @param {string} name 
 * @returns {boolean}
 */
const isValidName = (name) => {
  if (typeof name !== 'string') return false;
  
  // Accepter seulement lettres, espaces, apostrophes et traits d'union
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{1,100}$/;
  return nameRegex.test(name.trim());
};

/**
 * Validation pour les codes uniques (hexadécimal)
 * @param {string} code 
 * @returns {boolean}
 */
const isValidCode = (code) => {
  if (typeof code !== 'string') return false;
  
  const codeRegex = /^[a-f0-9]{12,32}$/i;
  return codeRegex.test(code);
};

/**
 * Validation pour les messages (longueur limitée, pas de HTML)
 * @param {string} message 
 * @param {number} maxLength 
 * @returns {boolean}
 */
const isValidMessage = (message, maxLength = 1000) => {
  if (typeof message !== 'string') return false;
  
  const sanitized = sanitizeString(message);
  return sanitized.length <= maxLength && sanitized === message;
};

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeMiddleware,
  isValidEmail,
  isValidName,
  isValidCode,
  isValidMessage,
  purify
};