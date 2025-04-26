const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

console.log('Tentative de connexion à:', uri);

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connexion à MongoDB réussie !');
  mongoose.connection.close();
})
.catch(err => {
  console.error('Erreur de connexion à MongoDB:', err);
});