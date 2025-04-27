// server/middleware/validation.js

/**
 * Collection de fonctions de validation pour les entrées utilisateur
 */

// Valide un email
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    
    // Expression régulière pour validation basique d'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
  
// Sanitize le texte en entrée
const sanitizeText = (input, maxLength = 100) => {
    if (!input || typeof input !== 'string') return '';

    // Suppression des caractères potentiellement dangereux et troncature
    return input
        .replace(/[<>]/g, '') // Retire les chevrons qui pourraient former des balises HTML
        .trim()
        .substring(0, maxLength);
};

// Valide un nom (non vide, longueur appropriée)
const isValidName = (name) => {
    if (!name || typeof name !== 'string') return false;
    return name.trim().length >= 2 && name.trim().length <= 100;
};

// Valide un nombre d'invités additionnels
const isValidGuestCount = (count) => {
    const parsedCount = parseInt(count, 10);
    return !isNaN(parsedCount) && parsedCount >= 0 && parsedCount <= 10;
};

// Valide un code d'invitation
const isValidInvitationCode = (code) => {
    if (!code || typeof code !== 'string') return false;

    // Vérification du format hexadécimal (comme généré par crypto)
    return /^[0-9a-f]{12,32}$/i.test(code);
};

// Middleware pour valider les paramètres des requêtes
const validateRequestParams = (paramRules) => {
    return (req, res, next) => {
        const errors = [];
        
        // Vérifie chaque règle de validation
        for (const [param, rule] of Object.entries(paramRules)) {
            const { location = 'body', validator, message } = rule;
            const value = req[location][param];
            
            if (!validator(value)) {
                errors.push({ param, message });
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        
        next();
    };
};

// Règles prédéfinies pour la validation d'invités
const guestValidationRules = {
    email: {
        validator: isValidEmail,
        message: 'Email invalide'
    },
    name: {
        validator: isValidName,
        message: 'Nom invalide (entre 2 et 100 caractères)'
    },
    guests: {
        validator: isValidGuestCount,
        message: 'Nombre d\'invités invalide (entre 0 et 10)'
    }
};

// Règles pour la validation d'un code d'invitation
const codeValidationRules = {
    code: {
        location: 'params',
        validator: isValidInvitationCode,
        message: 'Code d\'invitation invalide'
    }
};
  
module.exports = {
    isValidEmail,
    isValidName,
    isValidGuestCount,
    isValidInvitationCode,
    sanitizeText,
    validateRequestParams,
    guestValidationRules,
    codeValidationRules
};