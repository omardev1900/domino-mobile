# Taches actives

- [ ] `PRESENCE-07` Pret pour validation Android - Reprendre automatiquement la presence
  multijoueur au retour reseau confirme, sans passage obligatoire en
  arriere-plan, et stabiliser le recalcul du plateau apres reprise Android.
- [ ] `MULTI-SURRENDER-01` En cours - Rendre visible l'abandon volontaire dans
  la table et rendre son chemin atomique aussi depuis la popup de reprise :
  statut `SURRENDERED`, nettoyage serveur de la salle active et libelle « A
  abandonné » sous l'avatar pour tous les joueurs.
- [ ] `ADS-REWARD-01` En cours - Securiser la recompense publicitaire de fin de
  match solo : aucune publicite ni recompense associee sur le web, bypass
  explicite limite au `no-fill` AdMob sur mobile, credit Firestore idempotent
  par match et validation finale sur un APK Android reel.
- [ ] `UI-MULTI-LOBBY-01` Pret pour validation visuelle Android - Layout
  scrollable respectant les safe areas, sections sans superposition, statut
  d'attente passif et suppression integree au bloc TABLE.
