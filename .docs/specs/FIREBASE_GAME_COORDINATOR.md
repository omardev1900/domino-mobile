# Coordinateur Firebase du jeu multijoueur

Statut : plan valide par le client, implementation progressive obligatoire.

## 1. Objectif

Retirer progressivement aux telephones l'autorite necessaire au deroulement d'une
partie multijoueur. A terme, Firebase conserve et fait evoluer l'etat officiel ;
les applications envoient des commandes et affichent le resultat confirme.

Le travail est decoupe en cinq etapes fonctionnelles. Une etape n'est commencee
qu'apres validation complete de la precedente.

## 2. Regles non negociables

1. Une seule etape est en cours a la fois.
2. Chaque etape possede un objectif limite et des criteres d'acceptation ecrits.
3. Toute logique de jeu reste pure dans `LogicEngine.ts` ou `ScoringEngine.ts`.
4. Toute ecriture partagee critique est atomique et idempotente.
5. Le calcul d'une transition part toujours de l'etat relu dans Firestore.
6. Un snapshot client ne doit jamais remplacer aveuglement un etat serveur.
7. `stateVersion`, `turnId`, `phase`, `mancheNumber` et `roundNumber` protegent
   les commandes contre les retards et les doublons.
8. Les animations locales ne detiennent aucune autorite reseau.
9. Les anciens fallbacks ne sont retires qu'apres validation de leur remplacement.
10. Aucun service EAS n'est utilise. Les builds Android restent locaux.
11. Aucun secret ou compte de service n'est ajoute au depot.
12. Une erreur de test bloque le passage a l'etape suivante.

## 3. Protocole obligatoire pour chaque etape

1. Relire cette specification et auditer l'etat courant du code.
2. Ecrire ou mettre a jour les tests qui prouvent le mini-objectif.
3. Implementer uniquement le perimetre de l'etape.
4. Executer les tests unitaires cibles.
5. Executer les tests d'integration multijoueur concernes.
6. Executer TypeScript, ESLint et `git diff --check` sur les fichiers touches.
7. Verifier qu'aucune modification sans rapport n'est incluse.
8. Documenter les limites ou reports decouverts.
9. Creer un commit numerote et descriptif.
10. Ne passer a l'etape suivante qu'apres succes de tous les controles requis.

Format des commits fonctionnels :

```text
feat(coordinator-step-N): description courte
```

Une correction indispensable decouverte pendant une etape reste dans cette etape
si elle est necessaire a son objectif. Une correction independante recoit son
propre commit et ne doit pas etre melangee au coordinateur.

## 4. Etape 1 - Transitions terminales

### Objectif

Faire traiter par Firebase les phases `BOUDE`, `PARTIE_END`, `MANCHE_END` et la
fermeture `MATCH_END`, sans dependre du createur de la salle ni d'un acting host.

### Comportement cible

- Une entree dans une phase terminale cree une intention de transition unique.
- Le coordinateur relit l'etat officiel et valide son empreinte.
- Le resultat est calcule par les moteurs purs partages avec le mobile.
- Une seule transition est appliquee, meme en cas de retry du trigger.
- Les clients conservent localement le resultat pendant au plus trois secondes.
- `MATCH_END` finalise la salle sans creer une nouvelle donne.

### Validation

- Deconnexion de l'hote avant et pendant chaque phase.
- Retries et livraisons multiples du trigger Firebase.
- Modes Score, Manche et Cochon.
- Aucun double score, double melange ou double increment.
- Reconnexion apres transition.

### Commit attendu

```text
feat(coordinator-step-1): own terminal game transitions
```

## 5. Etape 2 - Bots, absences et delais

### Objectif

Faire executer par Firebase les coups des bots, les remplacements temporaires des
joueurs deconnectes, les passages automatiques et les expirations de tour.

### Comportement cible

- Chaque tour possede une echeance serveur associee a `turnId`.
- Une tache ancienne est ignoree si le tour ou la version a change.
- Le retour d'un joueur annule logiquement le coup de remplacement non execute.
- Aucun telephone n'est requis pour faire jouer un bot.

### Validation

- Deconnexion du joueur actif et non actif.
- Reconnexion juste avant l'echeance.
- Trois clients absents pendant un tour de bot.
- Aucun double coup et aucun timeout applique au mauvais tour.

### Commit attendu

```text
feat(coordinator-step-2): own automated turns and deadlines
```

## 6. Etape 3 - Actions humaines validees par le serveur

### Objectif

Remplacer l'envoi d'un nouvel etat calcule par le client par des commandes
minimales validees et executees cote serveur.

### Comportement cible

- Le client envoie l'action, le domino, le cote et la version attendue.
- Firebase verifie l'identite, le tour, la main et la legalite du placement.
- Le serveur calcule puis persiste l'etat resultant.
- Une commande rejouee ou perimee est sans effet.

### Validation

- Coups valides pour chaque cote.
- Domino absent de la main, mauvais joueur et mauvais tour rejetes.
- Commandes concurrentes et retries reseau.
- Parite entre moteurs mobile et serveur.

### Commit attendu

```text
feat(coordinator-step-3): validate human actions server-side
```

## 7. Etape 4 - Economie et cycle de salle atomiques

### Objectif

Rendre atomiques la finalisation du match, les statistiques, les recompenses, la
reconnexion, les revanches et la fermeture des salles abandonnees.

### Comportement cible

- Un `finalizationId` interdit toute double recompense.
- Les statistiques et l'economie sont derivees du resultat officiel.
- Les `activeRoomId` sont nettoyes avec la fermeture de la salle.
- Une revanche ne depend pas du createur original.
- Le nettoyage serveur traite les salles orphelines de facon complete.

### Validation

- Retry de finalisation et fermeture concurrente.
- Gagnant, perdants et joueur ayant abandonne.
- Reconnexion sur salle terminee.
- Revanche avec createur deconnecte.

### Commit attendu

```text
feat(coordinator-step-4): finalize matches and rooms atomically
```

## 8. Etape 5 - Suppression de l'autorite hote en jeu

### Objectif

Retirer les gardes et fallbacks devenus inutiles. L'hote ne reste proprietaire
que du salon avant le lancement de la partie.

### Comportement cible

- Suppression de l'election d'acting host pendant `PLAYING`.
- Suppression de `isLocalHost` dans les chemins d'action du jeu.
- `createdBy`, `hostId`, `players[0]` et `isHost` ne pilotent plus le match.
- Les anciennes minuteries concurrentes sont retirees.
- Les regles Firestore interdisent aux clients de remplacer `gameState`.

### Validation

- Audit par recherche de toutes les references d'autorite.
- Creation et lancement du salon toujours fonctionnels.
- Match complet avec deconnexion successive des trois positions.
- Verification des regles Firestore et App Check selon l'environnement.

### Commit attendu

```text
refactor(coordinator-step-5): remove in-game host authority
```

## 9. Test general final

La campagne finale est executee apres l'etape 5 et avant de declarer le systeme
termine. Elle comprend au minimum :

- un match complet pour Score, Manche et Cochon ;
- une partie avec bots ;
- deconnexion et reconnexion de chaque position ;
- deconnexion des trois joueurs puis reprise ;
- concurrence de commandes et simulation de retries Firebase ;
- verification des scores, recompenses et statistiques ;
- verification du nettoyage des salles ;
- tests unitaires mobile et Functions ;
- tests d'integration avec Firebase Emulator ;
- TypeScript, ESLint et build des Functions ;
- verification web Expo hors ligne ;
- verification Android locale si l'environnement Android est disponible.

Le rapport final doit indiquer clairement les controles executes, leurs resultats,
les controles impossibles dans l'environnement et les risques residuels.

## 10. Conditions d'arret

Le travail s'arrete avant l'etape suivante si :

- un test requis echoue ;
- la parite entre logique mobile et serveur n'est pas prouvee ;
- une migration de donnees non prevue devient necessaire ;
- les regles Firestore devraient etre affaiblies pour continuer ;
- un service payant ou une configuration Firebase externe doit etre active ;
- des changements utilisateur concurrents rendent le perimetre ambigu.

Dans ces cas, l'etape courante reste non terminee et le blocage est documente.
