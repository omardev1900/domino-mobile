# Retours client

### 2026-10-22

> je veux modifier le comportement du cadeau du jour,
> au lieu d'afficher le popup avec un bouton Récupérer et une animation, je veux
> le remplacer par un popup informatif qui dit Vous avez reçu 200 coins cadeau
> du jour et en bas Prochain cadeau dans 24 heures

> En mode solo, quelques utilisateurs déclarent que des fois, quand une partie
> est bloquée et que le popup Partie bloquée apparait, le jeu reste figé et on
> ne peut plus avancer, et meme le fait de fermer le jeu et y retourner ne
> permet pas de retourner là ou ils étaient et la partie disparait. Mais des
> fois, le jeu ne bloque pas dans ce popup partie bloquée.

### 2026-10-21

> Réorganiser les onglets de la boutique avec Premium en premier, puis
> Creators, Avatars et le reste. La corbeille ne doit pas apparaître sur les
> skins créés par le Skin Creator ; leur suppression complète doit se faire
> depuis le Skin Creator pour récupérer une place disponible.

> Renommer Atelier des skins et Atelier des avatars en Skin Creator et Avatar
> Creator. Ajouter une corbeille dans chaque objet du vestiaire pour permettre
> au joueur de supprimer les objets qu'il ne veut plus. Valider aussi le
> comportement idéal : les créations personnalisées apparaissent séparément
> dans Réglages > Skins et la carte du Creator n'est pas équipable.

> Je veux améliorer le UI UX de l'atelier Premium : il n'est pas très intuitif
> et la prévisualisation prend tout l'écran et le user doit descendre et
> redescendre à chaque fois pour voir le rendu de son changement. En plus les
> couleurs sont limitées ; si possible mettre la palette de couleur réglable par
> le doigt.
>
> Attention, le jeu est en mode paysage et donc on doit diviser l'écran en deux
> blocs côte à côte : gauche pour les actions users et droite pour la
> prévisualisation. La palette directe est la meilleure.

### 2026-10-11

> `UI-ROUND-END-01` est valider meme si jaurai souhiater ameliorer encore
> l'animateur du vainqueur du round, par exemple en agrandissnt encore son
> avatar entre sa position intiale et l'arrivee au centre er ajouter des effets
> lumineux conne une eticelle avant mouvemeent puis lors du mouvement de son
> avatar et egalement lors de larrivee au centre

> Je n'entends plus le son dans le jeu, web et APK.

> oui ce sont 4 joueurs differents avec des comptes et email differents chcun est lancer dans un tab safri en navigation privee
>
> cependant, comme deja signaler les autres joueurs ne peuvent pas acceder a une table
>
> deplus deux des tab privee viennent d'afficher une errur de log
> **Uncaught Error** The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.
> Call stack : `AsyncStorage.js` → `expo-audio` → `AudioRecorderWeb#startRecordingAtTime`.

> Je remarque aussi que certains joueurs ne voient pas une table publique en cours ou en attente de joueurs, pourquoi ? et quand il la rejoins via son code cela marche
>
> egalement un petit bug avait ete signaler par un joueur dans les anciennes version, il a rejoint un table alors qu'lle est deja complete et a assiste en tant que spectateur et bien sur la partie qui continet generalement ses dominos et son avatar comme joueur nn'apparait pas et est vide [ce qui est plutot normal] : je me demande si je peux corriger cela ou peut etre meme porposer de pouvoir assister a des tables comme spectateur

> Quand un joueur abondonne une table, le message A Abondeonne apparait et c'est ok. Question : est ce qu'on peut verififer quel type ou niveau de bot prend sa place ?
>
> sinon, un petits bugs
> le joueur avait abondonner une table dans la version precedente, et dans cette version de l'apk, il ne peut ni creer ni joindre une autre table meme si il declarent et cliauer sur le bouton du popup d'abondon qui reapparait, et a cahque fois il clique sur abondonner et confirme la perte de ces 100 coins, il retourne a la ho;e puis qund il veut kouer le meme message repparait> solution que j'ai trouver ; accepter de retourner a la table puis de la abondonner depuis le plateau de jeu et cette fois cela a foicntionner (je ne sais pas si c'est du a la nouvelle upgrade de version )

> tests ok
> par contre un bug decouvert ; suer lemulateur de ce mac, j'ai couper le wifi puis je lai reactiver mais le joueur est rester longtemps deconnecter et n'a pas rejoint la table> j'ai du passer l'app en arriere plan puis la remettre en avnt plan pour quil retourne, et une fois retounrer il a pu jouer ;ais les do;inos sont devenus trop petit et les espacemenet entre le plateau d ejeu et le sbord du telephone s'est nettement agrandi
>
> un autre point que j'ai tester ; un joueur qui abondonne la partie volontairement reste afficher en tant que joueur disponible ; si un joueur a abondonne lui meme la partie via le bouton abondonner on doit le signaler lors de son depart puis mettre en dessous de son avatar le mot a abondonne

### 2026-10-10

> Certains joueurs declarent avoir un bug majeur en mode multijoueur : souvent
> le message "Reprise de connexion" apparait en permanence alors qu'ils sont
> bien connectes et ils ne peuvent pas jouer ; le bot joue a leur place.

### 2026-07-23

> En mode multi, on ne peut pas jouer : le joueur ne peut pas jouer son premier
> domino et meme apres la fin du temps le bot ne joue pas a sa place.

> Apres avoir confirme la sortie d'une salle, le joueur reconnecte recoit encore
> le message "Match en cours detecte". La console affiche aussi des erreurs
> "Missing or insufficient permissions" pour quitter et retrouver la salle.

> Le premier domino en multi envoie `side: null` et `submitGameAction` repond
> `400 INVALID_ARGUMENT` avec le message "Commande invalide".

> En multi, un bot qui devait jouer en premier ne joue pas, meme lorsque son
> temps est ecoule. Aucun log applicatif n'apparait dans la console.

> En quittant la partie, `signalPlayerOffline` echoue avec "Missing or
> insufficient permissions". Le mode solo fonctionne normalement.

> Apres migration du coordinateur terminal, le jeu multijoueur continue
> normalement apres la fin du round, sans blocage.

> Apres un deploiement Vercel annonce comme reussi, la page affiche
> `404 NOT_FOUND` au lieu de l'application web.

> Oui il faut supprimer les pubs en web.

> La popup recompensee reste uniquement apres les matchs solo sur mobile.
> L'interstitielle existante reste reservee a la fin des matchs multijoueur.
> En cas de `no-fill` AdMob, le bonus doit pouvoir etre recupere sans pub, mais
> une recompense ne doit jamais etre creditee deux fois pour le meme match.

### 2026-07-24

> Le projet Sentry a ete supprime. Retirer Sentry de l'application afin que
> l'envoi des source maps ne bloque plus la generation Android Release.

> Sur l'application Android, la salle d'attente multijoueur semble avoir un
> header fixe qui masque le bloc TABLE. Le bloc TABLE masque a son tour le haut
> des cartes joueurs et leurs avatars. Le bouton d'attente et l'icone de
> suppression ont une hauteur excessive. Le probleme n'apparait pas sur le web
> mobile, ou la page reste scrollable.
