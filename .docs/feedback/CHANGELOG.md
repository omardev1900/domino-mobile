# Changelog

### 2026-07-23

- La sortie d'une salle multijoueur nettoie desormais atomiquement la presence
  du joueur et son rattachement a la salle.
- Le bouton plein ecran reste visible sur le web a cote des options pendant
  toute la partie.
- L'ecran de fin de round laisse davantage de temps pour lire le resultat et
  consulter les dominos adverses avant de continuer automatiquement.
- Les fins de round multijoueur passent automatiquement au round suivant en
  moins de trois secondes, y compris apres une interruption du coordinateur.
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
