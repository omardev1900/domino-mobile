# Taches terminees

### 2026-10-19

- [x] `UI-MULTI-END-FLOW-01` Carte Trello « Bug affichage fin de round »
  livree : annonces animees pour Chiré, Cochon, egalite, partie bloquee,
  round, manche et match, avec un ecran local de previsualisation.

### 2026-10-12

- [x] `ECON-MIN-COINS-01` Carte Trello « Min de coins » livree : reserve de
  100 coins appliquee aux mises, proposition Android a 200 coins ou moins vers
  la video recompensee de la boutique, et bouton boutique renomme « Voir ».

### 2026-10-11

- [x] `UI-ROUND-WINNER-VFX-01` Animation de victoire de round enrichie avec
  etincelle de depart, halo pendant le trajet, avatar agrandi et eclat a
  l'arrivee. Recette visuelle validee sans impact sur le moteur de jeu.

- [x] `UI-ROUND-END-01` Fin de round et de match rendue lisible : dernier
  domino conserve une seconde avant l'annonce, vainqueur de round anime depuis
  sa position vers le centre, resultats prolonges et publicite differee. APK
  Android 2.0.13 recettee et validee.

- [x] `AUDIO-REGRESSION-01` Lecture BGM et SFX restauree sur web et Android
  apres le report d'initialisation Safari, sans reintroduire l'erreur
  `expo-audio` en navigation privee. Recette validee.
- [x] `WEB-MULTI-JOIN-01` Jointure web multijoueur validee avec les erreurs
  Firebase rendues exploitables ; la recette utilisateur est validee.
- [x] `ADS-REWARD-01` Recompense de fin de match solo securisee : aucune
  publicite ni recompense sur le web, bypass mobile borne au `no-fill` AdMob,
  credit Firestore idempotent par match et recette Android validee.

- [x] `PRESENCE-05` Reconnexion client stabilisee : les signaux concurrents
  sont dedoublonnes, les changements reseau brefs sont absorbes par hysteresis
  et le voile reseau bloquant est remplace par une banniere non bloquante.
  Tests de hooks, build APK release et recette Android telephone + emulateur
  valides.

### 2026-10-11

- [x] `PRESENCE-04` Autorite serveur de presence livree : les Functions
  decident atomiquement les transitions `HUMAN`/`DISCONNECTED`, les regles
  Firestore des salles coordonnees refusent les mutations client du jeu et les
  regles RTDB limitent chaque presence a son proprietaire. Deploiement Firebase
  effectue, Google Sign-In release valide et recette Android reelle validee sur
  telephone + emulateur + bot, avec coupure puis retour reseau.

### 2026-10-10

- [x] `PRESENCE-03` Heartbeats Firestore ecrits en `serverTimestamp()` et
  expires sur l'heure serveur RTDB, avec grace initiale, revalidation
  transactionnelle et retry borne journalise. Validation unitaire, emulateur
  Firestore et export Android reussis.
- [x] `PRESENCE-02` Presence RTDB rendue independante par connexion : chaque
  `onDisconnect` ne supprime que son propre noeud et une connexion restante
  garde le joueur en ligne. Lecture compatible avec le format historique,
  course ancienne/nouvelle connexion et reconnexion couvertes par tests.
- [x] `ANDROID-LOCAL-DEV-01` Environnement Android local retabli : client de
  developpement Expo ajoute, `runtimeVersion` explicite, wrapper Gradle
  executable, signature debug independante de la cle de production et
  publicites Google neutralisees dans les builds de developpement.
- [x] `TOOLING-FIREBASE-01` Firebase CLI installee sous Node.js 22 et
  configuration locale rendue compatible avec Metro : Firestore Emulator
  utilise le port 8082 et le test d'integration lit l'adresse fournie par la
  CLI. Une `.nvmrc` fixe Node.js 22 pour le depot.
- [x] `PRESENCE-01` Transitions de presence multijoueur instrumentees avec des
  traces correlees et pseudonymisees, horloge serveur estimee, AppState,
  heartbeat, RTDB et decisions du coordinateur. La course d'un ancien
  `onDisconnect` ecrasant une session recente est reproduite et documentee.

### 2026-07-24

- [x] `RELEASE-2.0.2` Version applicative alignee sur `2.0.2` et
  `versionCode` Android incremente de 16 a 17 pour Google Play.
- [x] `BUILD-ANDROID-01` Integration Sentry obsolete retiree du runtime,
  d'Expo, de Metro et de Gradle. Generation locale `bundleRelease` validee
  avec un AAB signe (`c11b521`).

### 2026-07-23

- [x] `MULTI-COORD-03` Abandon et nettoyage de salle rendus atomiques afin
  d'eviter les salles fantomes et les erreurs `signalPlayerOffline` apres une
  sortie (`30e3aef`).
- [x] `WEB-VERCEL-01` Cloture sans deploiement Vercel : la cible retenue est
  desormais Firebase Hosting, avec export Expo dans `mobile/dist`. Le CI/CD
  GitHub est reporte dans `WEB-FIREBASE-CI-01`.
- [x] Controle plein ecran web maintenu a cote du bouton des options pendant
  une partie (`c0bc0b7`).
- [x] Resultat de round rendu plus lisible avant la transition automatique,
  avec consultation des dominos adverses (`b0e156e`).
- [x] `MULTI-COORD-06` Fins de round, manche et match retablies avec
  `coordinateTerminalGamePhasesV2`, reprise idempotente des salles figees et
  validation multijoueur reelle sans nouveau blocage.
- [x] `MULTI-COORD-05` Tours automatiques multijoueur retablis avec
  `coordinateActiveGameTurnsV2`, trigger Firestore Gen2 actif en production et
  valide par une partie reelle commencant par un bot.
- [x] `MULTI-COORD-04` Premier domino multijoueur debloque : la commande omet
  desormais `side` quand aucun cote n'est defini, au lieu de transmettre `null`
  au schema serveur.
- [x] `MULTI-COORD-02` Quota Firestore partage par UID ajoute aux deux callables
  publiques : `submitGameAction` limite a 6/s et 90/min, `requestRematch` a
  2/s et 10/min.
- [x] `MULTI-COORD-01` Invocation HTTP retablie uniquement pour
  `submitGameAction` et `requestRematch` : binding IAM
  `roles/cloudfunctions.invoker -> allUsers`, CORS local valide et rejet 401
  sans Firebase Auth.
- [x] Coordinateur Firebase autoritaire multijoueur livre en cinq etapes :
  transitions terminales, tours automatiques, validation des actions humaines,
  finalisation atomique et retrait de l'autorite en jeu de l'hote.
- [x] Campagne generale executee : 449 tests mobile, 29 tests Functions,
  emulation Firebase, regles Firestore, lint et export web.
- [x] Snapshot `MANCHE_END` corrige dans un commit independant (`be08bbe`).
# Taches terminees

### 2026-10-11

- [x] `PRESENCE-06` Recette multijoueur terminee sur trois clients (telephone
  Android et deux emulateurs), avec connexion, coupure puis reprise reseau et
  validation de la sortie de table.
- [x] `PRESENCE-07` Reprise automatique de la presence multijoueur apres un
  retour reseau confirme et stabilisation du recalcul du plateau Android.
- [x] `MULTI-SURRENDER-01` Abandon atomique depuis la table et la popup de
  reprise, avec statut visible « A abandonné ».
- [x] `MULTI-LOBBY-02` Annuaire public fiable et jointure atomique bloquant les
  tables deja completes avant la distribution.
