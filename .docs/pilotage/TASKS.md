# Taches actives

- [ ] `UI-ROUND-END-01` En cours - Fin de match : conserver le dernier domino
  visible, déplacer l'annonce du vainqueur hors du plateau, allonger la
  consultation des resultats et ne plus laisser la publicite les recouvrir.
- [ ] `WEB-MULTI-JOIN-01` En cours - Safari en navigation privee : reporter
  l'initialisation audio apres un geste utilisateur afin que l'erreur
  `expo-audio` ne casse pas le lobby, puis refaire la recette de jointure a
  quatre comptes et rendre toute erreur Firebase restante exploitable.
- [ ] `MULTI-SPECTATE-01` En cours - Etudier puis implementer un mode spectateur
  explicite pour les tables publiques : flux en lecture seule, aucun siege de
  joueur, et projection serveur ne divulguant jamais les mains des participants.
- [ ] `ADS-REWARD-01` En cours - Securiser la recompense publicitaire de fin de
  match solo : aucune publicite ni recompense associee sur le web, bypass
  explicite limite au `no-fill` AdMob sur mobile, credit Firestore idempotent
  par match et validation finale sur un APK Android reel.
- [ ] `UI-MULTI-LOBBY-01` Pret pour validation visuelle Android - Layout
  scrollable respectant les safe areas, sections sans superposition, statut
  d'attente passif et suppression integree au bloc TABLE.
