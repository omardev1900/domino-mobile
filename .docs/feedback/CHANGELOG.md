# Changelog

### 2026-10-22

- Le cadeau du jour est désormais ajouté automatiquement au solde. Une popup
  courte confirme les 200 coins reçus et indique que le prochain cadeau sera
  disponible dans 24 heures.

- Si une partie se bloque en solo, l'application retente désormais la
  résolution du tour automatiquement. En cas d'échec persistant, un écran de
  secours propose de réessayer ou de revenir à l'accueil : la partie reste
  sauvegardée et peut être reprise plus tard.

### 2026-10-21

- La boutique commence désormais par Premium, puis Creators et Avatars. Les
  skins personnalisés se suppriment uniquement depuis le Skin Creator, où une
  corbeille libère immédiatement un des cinq emplacements.

- Les ateliers deviennent Skin Creator et Avatar Creator. Chaque skin cree est
  disponible individuellement dans le vestiaire et dans les reglages de partie,
  sans afficher la carte du Creator comme skin equipable.

- Une corbeille permet de supprimer du vestiaire les cosmetiques non systeme,
  apres confirmation et sans remboursement. Si l'objet etait equipe, le style
  ou l'avatar par defaut est restaure automatiquement.

- L'Atelier Premium adopte une interface paysage en deux parties : les réglages
  et la palette de couleurs tactile restent à gauche pendant que le rendu du
  plateau et des dominos reste visible en permanence à droite.

### 2026-10-20

- Deux skins Premium à palette par valeur rejoignent la boutique : Terre Ambrée
  (plateau #A6674C) et Jardin Nocturne (plateau #18391E). L'aperçu de skin
  utilise désormais des tuiles plus grandes.

- Les cosmétiques Premium sont désormais des achats uniques en coins : 1 000
  coins pour les avatars et skins multicolores, 500 coins pour les autres skins.

- L'accueil affiche l'expiration d'un Premium actif ; l'accès au code est
  remplacé par un raccourci vers la Boutique Premium. Les annonces de fin de
  round et de manche sont stabilisées sur Android.

### 2026-10-19

- Les offres Premium ne sont visibles et utilisables que pendant un accès
  Premium actif. À la fin de l’essai, l’application explique la désactivation
  et propose directement d’activer un code Premium. Le changement de skin en
  pleine partie est désormais réservé aux membres Premium.

- Les codes Premium ont une date limite d’activation et donnent accès à 7, 14
  ou 30 jours Premium. Les changements d’avatar se reflètent désormais sans
  attendre dans l’accueil, le menu et une partie en cours.

- La boutique Premium propose maintenant trois nouveaux styles de dominos
  (Madras, Or Royal et Nuit Caraïbe) et trois avatars exclusifs.

- Les fins de round, manche et match disposent d'annonces visuelles plus
  lisibles. Chiré, Cochon, egalite et partie bloquee ont chacune leur animation.

### 2026-10-12

- Une reserve minimale de 100 coins est maintenant conservee apres une mise.
  Quand le solde atteint 200 coins ou moins, l'application propose une video
  recompensee depuis la boutique pour gagner 100 coins.

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
