# 🎉 Invitation Anniversaire

Application web complète pour la gestion d'invitations à un anniversaire, avec interface d'administration, gestion des invités, PWA et mode offline.

---

## 🚀 Fonctionnalités principales

- **Gestion des invités** : Ajout, modification, vérification de présence
- **Interface d'administration sécurisée** (clé API)
- **Progressive Web App (PWA)** : installation sur mobile, mode offline
- **Pages offline dédiées** (invités & admin)
- **Notifications et QR codes**
- **Déploiement cloud-ready** (Render.com, Heroku...)

---

## 📦 Structure du projet

```
/
├── client/           # Frontend React
│   ├── public/       # Fichiers statiques (index.html, manifest, service worker, images)
│   └── src/          # Code source React
├── server/           # Backend Node.js/Express
│   └── server.js     # Point d'entrée serveur
├── package.json      # Dépendances backend
└── README.md
```

---

## ⚙️ Installation & Lancement local

1. **Cloner le dépôt**
   ```bash
   git clone <repo-url>
   cd invitation-anniversaire
   ```

2. **Installer les dépendances backend**
   ```bash
   npm install
   ```

3. **Installer les dépendances frontend**
   ```bash
   cd client
   npm install
   ```

4. **Lancer le développement**
   - **Backend** :  
     ```bash
     npm run dev
     ```
   - **Frontend** (dans `client/`) :  
     ```bash
     npm start
     ```

5. **Accéder à l'application**
   - Frontend : [http://localhost:3000](http://localhost:3000)
   - Backend/API : [http://localhost:5000](http://localhost:5000)

---

## 🏗️ Build & Déploiement (Render.com)

1. **Build du frontend**
   ```bash
   cd client
   npm run build
   ```

2. **Déployer sur Render**
   - **Build Command** :  
     `cd client && npm install && npm run build`
   - **Start Command** :  
     `node server/server.js`
   - **Variables d'environnement à définir** :
     - `MONGODB_URI`
     - `ADMIN_API_KEY`
     - Autres selon votre configuration

---

## 🛡️ Sécurité & Bonnes pratiques

- Clé d'administration stockée côté serveur et transmise via localStorage côté client
- Service worker gérant le mode offline pour toutes les routes critiques
- Vérification des entrées et gestion des erreurs serveur

---

## 📄 Fichiers importants

- `client/public/service-worker.js` : gestion du cache et du mode offline
- `client/public/manifest.json` : configuration PWA
- `server/server.js` : routage backend et gestion du build React

---

## 🧪 Tests

- Tests unitaires et d'intégration à ajouter selon vos besoins
- Vérifiez le comportement offline (invités & admin)
- Vérifiez la présence de toutes les images référencées dans le manifest

---

## 📢 Contribuer

Les contributions sont les bienvenues !  
Merci de proposer vos améliorations via pull request ou issue.

---

## 📜 Licence

MIT
