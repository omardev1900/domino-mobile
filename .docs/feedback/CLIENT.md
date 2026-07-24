# Retours client

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
