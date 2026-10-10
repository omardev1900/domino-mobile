# Heartbeat multijoueur fonde sur l'heure serveur

Ticket : `PRESENCE-03`

## Ecriture

Chaque heartbeat ecrit `serverTimestamp()` dans
`rooms/{roomId}.heartbeats.{playerId}`. Une valeur numerique historique n'est
plus utilisee pour prendre une decision de presence, car elle a pu etre
produite par l'horloge locale d'un telephone.

En cas d'echec, le client journalise le code technique puis reessaie avec un
backoff borne de 1 s, 3 s et 8 s. Les phases terminales continuent de
suspendre les heartbeats afin de ne pas interferer avec les transactions de
jeu.

## Expiration

L'heure de reference est `Date.now() + .info/serverTimeOffset` de RTDB. Tant
que cet offset n'a pas ete recu, aucun client ne declare un adversaire absent.
Un heartbeat serveur expire apres 25 s. En l'absence du premier heartbeat
serveur, une grace de 45 s commence a la premiere observation de ce joueur.

La transaction finale revalide le Timestamp Firestore avec le meme cutoff ;
un heartbeat renouvelle entre l'observation et la transaction protege donc le
joueur.

## Validation

- Tests unitaires : decalage d'horloge local, absence de l'offset RTDB, grace
  initiale, expiration et retry avec backoff.
- Emulateur Firestore : `serverTimestamp()` autorise par les regles et lu sous
  forme de Timestamp, renouvellement observe entre deux clients.
- Validation Android : export Expo Android reussi.
