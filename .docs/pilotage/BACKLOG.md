# Backlog

- [ ] `BUG-MULTI-TIMER-01` Réduire le délai visible entre la fin du timer adverse et la résolution automatique du tour ; valider sur appareil et surveiller les logs du coordinateur.
- [ ] `BUG-MULTI-JOIN-01` Corriger la jointure refusée des tables coordonnées en attente ; publier les règles Firestore et valider sur appareil.

- [ ] `SEC-APP-CHECK` Configurer les fournisseurs App Check web, Android et
  debug local, puis activer son enforcement sur les callables multijoueur.
- [ ] `WEB-FIREBASE-CI-01` Automatiser l'export Expo web et le deploiement
  Firebase Hosting avec GitHub Actions. Differe apres l'echec OAuth de
  `firebase init hosting:github`; le build et le deploiement manuels restent
  disponibles.
