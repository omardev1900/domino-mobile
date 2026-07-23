# Changelog

### 2026-07-23

- Les bots et les joueurs expires jouent de nouveau automatiquement en
  multijoueur grace au coordinateur de tours Gen2.
- Le premier domino d'une partie multijoueur peut de nouveau etre joue.
- Les commandes multijoueur disposent maintenant d'un garde-fou anti-spam par
  joueur, partage entre les instances Firebase.
- Les commandes de jeu et de revanche multijoueur sont de nouveau joignables
  depuis le web local ; une requete sans session Firebase reste rejetee.
- Les parties multijoueur coordonnees ne dependent plus de l'hote pour avancer.
- Les transitions BOUDE, fin de round, fin de manche et fin de match sont gerees
  par Firebase avec des delais bornes et des protections contre les doublons.
- Les tours automatiques, deconnexions et reconnexions restent jouables meme si
  le createur de la salle quitte temporairement la partie.
- Les scores, recompenses, statistiques, revanches et fermetures de salle sont
  finalises atomiquement cote serveur.
- L'affichage de fin de manche utilise desormais le resultat et l'historique les
  plus recents lors d'une transition rapide.
