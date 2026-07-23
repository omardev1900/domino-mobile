# Taches terminees

### 2026-07-23

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
