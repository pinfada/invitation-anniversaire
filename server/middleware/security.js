// server/middleware/security.js
const helmet = require('helmet');
const csrf = require('csurf');

// Configuration Helmet avec options optimisées
const configureHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://firebasestorage.googleapis.com"],
        connectSrc: ["'self'", "data:", "https://api.cloudinary.com", "https://firebasestorage.googleapis.com"],
        workerSrc: ["'self'", "blob:"],
      }
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
  });
};

// Configuration CSRF
const csrfProtection = csrf({ 
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  } 
});

// Middleware pour ajouter le token CSRF aux réponses
const addCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

module.exports = {
  configureHelmet,
  csrfProtection,
  addCsrfToken
};