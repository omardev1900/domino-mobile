# Changelog

### 2026-07-23

- Les parties multijoueur coordonnees ne dependent plus de l'hote pour avancer.
- Les transitions BOUDE, fin de round, fin de manche et fin de match sont gerees
  par Firebase avec des delais bornes et des protections contre les doublons.
- Les tours automatiques, deconnexions et reconnexions restent jouables meme si
  le createur de la salle quitte temporairement la partie.
- Les scores, recompenses, statistiques, revanches et fermetures de salle sont
  finalises atomiquement cote serveur.
- L'affichage de fin de manche utilise desormais le resultat et l'historique les
  plus recents lors d'une transition rapide.
