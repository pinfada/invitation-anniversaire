// server/index.js - Mise à jour pour intégrer les routes d'authentification

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de sécurité
app.use(helmet()); // Protection par en-têtes HTTP
app.use(express.json({ limit: '10kb' })); // Limite la taille des requêtes JSON
app.use(cors()); // Configuration CORS

// Limiter global pour toutes les requêtes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard' }
});
app.use('/api/', globalLimiter);

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connexion MongoDB établie'))
.catch(err => console.error('Erreur de connexion MongoDB:', err));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
const guestRoutes = require('./routes/guestRoutes');
const authRoutes = require('./routes/authRoutes'); 

app.use('/api/guests', guestRoutes);
app.use('/api/auth', authRoutes); // Ajouter les routes d'authentification

// Route pour toutes les autres requêtes - renvoyer vers le frontend React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de gestion des erreurs global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});