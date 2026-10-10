# Backlog

- [ ] `PRESENCE-02` Remplacer la presence RTDB unique par joueur par une
  presence par connexion, afin qu'un ancien `onDisconnect` ne puisse plus
  invalider une session recente.
- [ ] `PRESENCE-03` Fonder le heartbeat et son expiration sur l'heure serveur,
  avec une grace d'initialisation et des echecs d'ecriture observables.
- [ ] `PRESENCE-04` Confier au serveur la decision finale de presence et
  interdire a un client de marquer un autre joueur deconnecte.
- [ ] `PRESENCE-05` Rendre la reconnexion idempotente, appliquer une hysteresis
  reseau realiste et remplacer la boucle d'interface bloquante par un etat
  confirme et non bloquant.
- [ ] `PRESENCE-06` Executer la recette multijoueur a trois clients, la campagne
  de non-regression et la validation Android locale finale.
- [ ] `SEC-APP-CHECK` Configurer les fournisseurs App Check web, Android et
  debug local, puis activer son enforcement sur les callables multijoueur.
- [ ] `WEB-FIREBASE-CI-01` Automatiser l'export Expo web et le deploiement
  Firebase Hosting avec GitHub Actions. Differe apres l'echec OAuth de
  `firebase init hosting:github`; le build et le deploiement manuels restent
  disponibles.
