# Backlog

- [ ] `LEAGUE-SYNC-01` Synchroniser et fiabiliser la progression mensuelle de ligue ; [carte Trello](https://trello.com/c/rqcOZ9Kj/131-league-sync-01-synchroniser-et-fiabiliser-la-progression-mensuelle-de-ligue).

- [ ] `BUG-LEAGUE-HISTORY-01` Investiguer le profil d'un joueur dont les cochons et statistiques historiques ne sont plus visibles alors que le profil n'affiche que le mois courant ; comparer `stats.matchHistory`, `users_monthly_stats`, l'archive de Ligue et la version cliente 2.3.0 avant toute restauration.

- [ ] `BUG-REPLAY-REPLACE-01` Reproduire le remplacement d'un replay sauvegardé : qualifier l'erreur 410 puis l'erreur `unauthenticated`/401 sur la version hébergée, vérifier l'authentification, la région `europe-west1`, les exports `buyAndSaveReplay` et le déploiement réellement servi, puis valider le parcours transactionnel.

- [ ] `ANDROID-R8-01` Activer R8 pour les builds Android de production, vérifier l’obfuscation, l’optimisation et la réduction DEX, puis valider les parcours natifs (authentification, publicités, notifications, achats et replays). Échéance interne : **2028-01-31**. ⚠️ Cette échéance est postérieure à l’exigence Google Play annoncée pour février 2027.

- [ ] `BUG-MULTI-TIMER-01` Réduire le délai visible entre la fin du timer adverse et la résolution automatique du tour ; valider sur appareil et surveiller les logs du coordinateur.
- [ ] `BUG-MULTI-BOT-230-01` Diagnostiquer les lenteurs et les remplacements par bot signalés sur la version 2.3.0 ; corréler présence, expiration de lease, timer client et décisions du coordinateur avant de modifier le délai serveur.
- [ ] `BUG-MULTI-JOIN-01` Corriger la jointure refusée des tables coordonnées en attente ; publier les règles Firestore et valider sur appareil.

- [ ] `SEC-APP-CHECK` Configurer les fournisseurs App Check web, Android et
  debug local, puis activer son enforcement sur les callables multijoueur.
- [ ] `WEB-FIREBASE-CI-01` Automatiser l'export Expo web et le deploiement
  Firebase Hosting avec GitHub Actions. Differe apres l'echec OAuth de
  `firebase init hosting:github`; le build et le deploiement manuels restent
  disponibles.
