# MULTI-SPECTATE-01 — Mode spectateur public

## Constat

Un document `rooms/{roomId}` contient l'etat de jeu complet, notamment les
mains (`gameState.players[].hand`) et le talon mort. Il ne doit jamais etre lu
par un spectateur. Un filtre ou un masquage realise par le client ne constitue
pas une protection.

## Decision d'architecture

Les Functions construisent deux projections publiques, mises a jour a chaque
ecriture pertinente d'une salle publique :

- `publicRooms/{roomId}` : annuaire des tables `WAITING` et `PLAYING` ;
- `roomSpectatorViews/{roomId}` : etat lecture seule d'une table `PLAYING`.

Ces documents ne contiennent ni main, ni talon mort, ni `passcode`, ni
`playerIds`, ni heartbeat, ni chat prive, ni donnee d'economie. Les joueurs y
sont representes par leur siege (0, 1 ou 2), nom, avatar, statut, score et
nombre de dominos restants. L'historique utilise lui aussi le siege plutot que
l'UID.

Les documents bruts `rooms` deviennent lisibles uniquement par leurs
participants (ou un administrateur). L'annuaire et les projections sont
lisibles par tout utilisateur authentifie, mais jamais ecrits par un client.

## Flux utilisateur

1. L'onglet **Publiques** affiche les tables en attente avec **Rejoindre** et
   les tables en cours avec **Observer**.
2. **Observer** ouvre `/spectate/[id]`, sans definir de salle active et sans
   occuper de siege.
3. L'ecran spectateur souscrit seulement a `roomSpectatorViews/{roomId}`. Il
   affiche le plateau, les joueurs, les scores et le tour courant, mais aucune
   commande de jeu, de chat ou d'abandon.
4. Une salle devenue privee ou terminee est retiree de l'annuaire et sa vue
   spectateur est supprimee.

## Sequencement d'implementation

1. Types purs de la projection et tests de serialisation sans fuite de mains.
2. Function de projection idempotente et tests Emulator.
3. Regles Firestore et migration de l'annuaire public vers `publicRooms`.
4. Route/ecran spectateur en lecture seule et actions **Observer** dans le
   lobby.
5. Recette avec trois joueurs puis un quatrieme compte spectateur : verifier
   la mise a jour en direct et l'absence de `hand` dans tout snapshot lu par
   ce compte.
