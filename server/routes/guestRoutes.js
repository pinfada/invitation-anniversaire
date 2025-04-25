// Dans server/routes/guestRoutes.js
const express = require('express');
const router = express.Router();
const Guest = require('../models/guest');

router.get('/guests', async (req, res) => {
  try {
    const guests = await Guest.find();
    res.json(guests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Autres routes pour créer, mettre à jour, supprimer des invités...

module.exports = router;