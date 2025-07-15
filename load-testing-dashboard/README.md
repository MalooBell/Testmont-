# Load Testing Dashboard - Frontend React

Interface React moderne pour piloter et monitorer vos tests de charge avec Locust, Prometheus et Grafana.

## 🚀 Fonctionnalités

### Panneau de Configuration
- **Formulaire intuitif** pour configurer les tests
- **Validation en temps réel** des paramètres
- **Démarrage/Arrêt** des tests en un clic
- **Statut en temps réel** avec métriques live

### Monitoring Intégré
- **Dashboards Grafana** intégrés dans l'interface
- **Métriques Prometheus** en temps réel
- **Interface Locust** accessible directement
- **WebSocket** pour les mises à jour live

### Historique et Analyse
- **Liste des tests** précédents avec détails
- **Comparaison** des performances
- **Export** vers Grafana avec filtrage temporel
- **Métriques clés** : temps de réponse, RPS, taux d'erreur

## 🛠️ Installation

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour la production
npm run build
```

## 🎨 Technologies Utilisées

- **React 18** - Framework frontend
- **Vite** - Build tool et dev server
- **Tailwind CSS** - Framework CSS utilitaire
- **Heroicons** - Icônes SVG
- **Axios** - Client HTTP
- **WebSocket** - Communication temps réel
- **date-fns** - Manipulation des dates

## 📱 Interface Utilisateur

### Onglet "Nouveau Test"
- Formulaire de configuration avec validation
- Métriques en temps réel pendant l'exécution
- Contrôles de démarrage/arrêt

### Onglet "Monitoring"
- iFrames intégrées pour Grafana, Locust, Prometheus
- Navigation entre les outils
- Liens d'ouverture dans de nouveaux onglets

### Onglet "Historique"
- Tableau des tests précédents
- Détails des performances
- Liens vers Grafana avec filtrage temporel

## 🔧 Configuration

### Variables d'environnement
Le frontend se connecte par défaut à :
- **Backend API** : `http://localhost:3001`
- **WebSocket** : `ws://localhost:8080`
- **Grafana** : `http://localhost:3000`
- **Locust** : `http://localhost:8089`
- **Prometheus** : `http://localhost:9090`

### Personnalisation
- **Couleurs** : Modifiez `tailwind.config.js`
- **API endpoints** : Modifiez `src/services/api.js`
- **Composants** : Structure modulaire dans `src/components/`

## 🚦 Utilisation

1. **Démarrer le backend** (voir README principal)
2. **Lancer l'interface** : `npm run dev`
3. **Configurer un test** dans l'onglet "Nouveau Test"
4. **Surveiller** via l'onglet "Monitoring"
5. **Analyser** l'historique dans l'onglet dédié

## 🎯 Fonctionnalités Avancées

### WebSocket en Temps Réel
- Connexion automatique au backend
- Reconnexion automatique en cas de perte
- Notifications de statut de connexion

### Validation de Formulaire
- Validation côté client avec feedback visuel
- Messages d'erreur contextuels
- Prévention des soumissions invalides

### Interface Responsive
- Design adaptatif mobile/desktop
- Navigation tactile optimisée
- Tableaux scrollables sur mobile

## 🔍 Structure du Code

```
src/
├── components/          # Composants React
│   ├── Common/         # Composants réutilisables
│   ├── Layout/         # Layout et navigation
│   ├── TestForm/       # Formulaire de test
│   ├── TestMetrics/    # Métriques temps réel
│   ├── TestHistory/    # Historique des tests
│   └── Monitoring/     # Interfaces de monitoring
├── hooks/              # Hooks personnalisés
├── services/           # Services API et WebSocket
├── utils/              # Utilitaires
└── App.jsx            # Composant principal
```

## 🐛 Dépannage

### L'interface ne se charge pas
- Vérifiez que le port 4200 est libre
- Vérifiez la connexion au backend (port 3001)

### Pas de métriques temps réel
- Vérifiez la connexion WebSocket (port 8080)
- Vérifiez que le backend est démarré

### Erreurs de CORS
- Le backend inclut la configuration CORS
- Vérifiez les URLs dans `src/services/api.js`

## 📈 Performance

- **Bundle optimisé** avec Vite
- **Lazy loading** des composants
- **Memoization** des composants coûteux
- **WebSocket** pour éviter le polling

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Créer une Pull Request