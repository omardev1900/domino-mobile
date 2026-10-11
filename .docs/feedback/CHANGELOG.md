# Changelog

### 2026-10-11

- Le vainqueur d'un round est maintenant accompagne d'effets lumineux legers
  pendant son animation vers le centre du plateau.

- En fin de round, le dernier domino reste visible un instant avant l'annonce.
  Le vainqueur est ensuite mis en avant dans une animation vers le centre, sans
  masquer le plateau ni precipiter la lecture des resultats.

- Les musiques et effets sonores fonctionnent de nouveau sur le web et Android,
  y compris sans provoquer d'erreur au chargement en navigation privee.
- La recompense de fin de partie solo est desormais attribuee une seule fois et
  uniquement apres le traitement mobile approprie ; elle n'apparait pas sur le
  web.

- Quitter une partie multijoueur depuis la proposition de reprise fonctionne
  maintenant comme depuis la table : la partie est abandonnee correctement et
  il est possible d'en creer ou rejoindre une autre immediatement.
- Les tables publiques en attente sont affichees de facon plus fiable et une
  table pleine ne peut plus etre rejointe pendant une course entre joueurs.
- Le plateau conserve ses bonnes proportions apres le retour de la connexion
  reseau sur Android.
- En multijoueur, la deconnexion et le retour en ligne sont maintenant decides
  par Firebase cote serveur. Aucun autre joueur ne peut declarer un participant
  deconnecte depuis son telephone.
- Une coupure reseau n'affiche plus un ecran bloquant : la table reste visible
  et l'application reprend automatiquement des que la connexion est stable.

### 2026-10-10

- Les joueurs ne sont plus declares deconnectes a cause d'une horloge de
  telephone incorrecte ; la presence multijoueur s'appuie desormais sur les
  horodatages serveur Firebase.
- Les reconnexions multijoueur ne peuvent plus etre invalidees par la fermeture
  tardive d'une ancienne connexion ; un joueur reste en ligne tant qu'une de
  ses connexions est active.

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
