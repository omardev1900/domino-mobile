# Taches terminees

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
