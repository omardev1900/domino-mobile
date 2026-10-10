# Diagnostic de presence multijoueur

Ticket : `PRESENCE-01`

## Objectif

Rendre la boucle `HUMAN <-> DISCONNECTED` observable sans changer les delais,
les ecritures ou l'autorite existante. Les traces passent exclusivement par
`LogService` et ne contiennent ni UID Firebase ni identifiant de salle en clair.

## Format des traces

Le tag `PresenceDiagnostics` emet des objets structures de version 1 avec :

- les jetons correles `room_*`, `player_*` et l'identifiant ephemere
  `connection_*` ;
- `clientAtMs`, `estimatedServerAtMs` et `serverTimeOffsetMs` ;
- la source de decision : RTDB, heartbeat Firestore, reconnexion, abandon ou
  coordinateur ;
- l'etat AppState, la phase, l'age du heartbeat, la grace et la transition de
  statut lorsqu'ils sont disponibles ;
- uniquement le code technique des erreurs, jamais leur message libre.

Les evenements couvrent la connexion RTDB, l'armement de `onDisconnect`, les
heartbeats reussis ou en echec, les graces RTDB, les transitions de statut et
les actions observees du coordinateur.

## Scenario automatise de la course historique

Le test `presenceDiagnostics.test.ts` rejoue trois acteurs :

1. une ancienne session publie `online` et arme un payload `offline` ;
2. une nouvelle session du meme joueur publie ensuite `online` sur le meme
   chemin `/presence/{roomId}/{uid}` ;
3. Firebase execute tardivement le `onDisconnect` de l'ancienne session ;
4. un troisieme client observe `offline`, demarre la grace puis peut demander
   la transition Firestore vers `DISCONNECTED`.

Le test prouve que le chemin unique par UID termine a tort sur `offline` alors
que la nouvelle session est encore active. `PRESENCE-02` doit supprimer cette
course en isolant chaque connexion dans son propre sous-chemin.

Commande cible :

```bash
cd mobile
npx jest src/hooks/game/__tests__/presenceDiagnostics.test.ts --runInBand
```

## Recette manuelle de collecte

1. Lancer une partie privee avec trois clients ou emulateurs.
2. Filtrer les logs sur `PresenceDiagnostics` et conserver les jetons correles.
3. Sur un joueur non actif, enchainer Wi-Fi coupe, retour 4G et
   arriere-plan/premier plan avant la fin de la grace.
4. Refaire la manipulation sur le joueur actif.
5. Fermer une ancienne instance juste apres avoir reconnecte le meme compte
   dans une nouvelle instance.
6. Relever l'evenement `status_transition_applied` qui precede la prise en
   charge par le bot et verifier sa `source`.

## Baseline attendue avant correction

- Une ecriture tardive `offline` issue d'un ancien `onDisconnect` est
  indistinguable d'une vraie perte de la session courante.
- Le fallback heartbeat compare des timestamps produits par les telephones.
- Plusieurs clients peuvent demander la transition `DISCONNECTED`.
- Les traces de ce ticket identifient laquelle de ces sources a effectivement
  declenche le remplacement ; elles ne corrigent encore aucune de ces causes.
