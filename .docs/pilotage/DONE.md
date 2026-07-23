# Taches terminees

### 2026-07-23

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
