# Presence RTDB par connexion

Ticket : `PRESENCE-02`

## Format ecrit par les clients recents

Chaque connexion RTDB publie son propre noeud :

```
/presence/{roomId}/{playerId}/connections/{connectionId}
  status: "online"
  t: <horodatage client>
```

`connectionId` est regenere apres chaque evenement `.info/connected`. Le
`onDisconnect` associe execute `remove()` uniquement sur ce noeud. Une
deconnexion tardive ne peut donc plus modifier une connexion publiee apres
elle.

Un joueur est en ligne des qu'au moins une connexion est `online`. La
suppression de la derniere connexion demarre la grace RTDB existante avant une
eventuelle transition vers `DISCONNECTED`.

## Compatibilite de migration

Les lecteurs reconnaissent simultanement l'ancien format :

```
/presence/{roomId}/{playerId}
  status: "online" | "offline"
  t: <horodatage client>
```

Pendant la migration, une connexion recente `online` est prioritaire : une
ancienne entree `offline` ne peut pas faire basculer le joueur. Un joueur qui
n'a encore jamais publie de presence dans la session n'est pas declare absent
sur la seule base d'un noeud manquant ; le heartbeat Firestore reste le filet
de securite.

Le format historique pourra etre retire apres adoption de la version contenant
`PRESENCE-02`, controlee dans `PRESENCE-06` avec trois clients reels.

## Simulation automatisee

`useConnectionStatus.test.tsx` simule une ancienne connexion, une reconnexion
et la fermeture de l'ancienne : chacune arme et supprime uniquement son propre
chemin. `presenceConnections.test.ts` verifie ensuite que la connexion recente
maintient le joueur en ligne et que la fermeture de la derniere connexion le
rend eligible a la grace RTDB.
