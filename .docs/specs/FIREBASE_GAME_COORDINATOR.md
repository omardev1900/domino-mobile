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

### Rapport d'implementation

Statut : realise et deploye le 2026-07-23.

- Function `coordinateTerminalGamePhases` deployee sur `domino-martinique-v1`.
- Runtime Node.js 22, generation v1, region `europe-west1`.
- Delai serveur de trois secondes et politique de retry idempotente.
- Activation explicite par salle avec `coordinatorVersion: 1`.
- Les anciennes salles sans version conservent le parcours client historique.
- Les salles coordonnees n'envoient plus de transition depuis leurs overlays.
- Le moteur serveur est genere depuis les sources pures du mobile au build.

Controles valides :

- 8 tests unitaires du coordinateur Functions.
- Transaction concurrente validee avec Firestore Emulator : une seule ecriture.
- 2 tests `GameScreen` propres aux salles coordonnees.
- 17 tests de logique multijoueur, Cochon et `MancheEndFlow`.
- Build TypeScript des Functions.
- ESLint mobile sans nouvelle erreur et `git diff --check`.
- Presence de la Function confirmee avec `firebase functions:list`.

Limites connues :

- L'emulateur Functions local ne s'arrete pas correctement sur cette machine ;
  la transaction est testee avec Firestore Emulator et le trigger est compile,
  puis sa presence reelle est verifiee apres deploiement.
- La suite complete `GameScreen.gradeUp.test.tsx` conserve son echec historique
  sur le snapshot `PARTIE_END` attendu en `MANCHE_END`. Les deux nouveaux tests
  coordonnes passent et cette assertion n'a pas ete masquee dans cette etape.

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

### Rapport d'implementation

Implementation retenue :

- Function `coordinateActiveGameTurns` en `europe-west1`, activee uniquement
  pour `coordinatorVersion: 1` et la phase `PLAYING`.
- Empreinte idempotente composee du jeu, de `stateVersion`, de `turnId`, du
  joueur courant, de son statut et de `boudePlayerId`.
- Relecture transactionnelle obligatoire avant chaque action : un retour
  `DISCONNECTED -> HUMAN` invalide donc le remplacement encore en attente.
- Delais serveur : bot 1,25 s, absent 2,5 s, badge boude 2 s ou 3,5 s pour un
  joueur deconnecte, humain 60 s maximum plus 3 s de grace.
- `MARK_BOUDE`, passage, coup de bot et timeout utilisent les moteurs purs
  generes depuis `mobile/src/core` ; aucun telephone ni hote ne les pilote.
- Les automatismes historiques `useBotDecision`, `useAutoPass` et l'ecriture
  de timeout sont suspendus uniquement dans les salles coordonnees.
- Le dernier identifiant et le type d'action serveur sont conserves dans
  `room.coordinator` pour faciliter le diagnostic.

Controles valides :

- 9 tests unitaires de tours actifs et 8 tests des phases terminales.
- Transaction concurrente validee avec Firestore Emulator : une seule decision.
- Reconnexion avant echeance, bot, timeout, boudes humain et deconnecte testes.
- 5 tests `useGameEngine`, dont la suspension des automatismes client.
- 2 tests `GameScreen` pour les salles coordonnees.
- 4 scenarios de regression reseau, reconnexion et boude.
- Build TypeScript Functions, ESLint mobile sans erreur et `git diff --check`.
- Function deployee et confirmee en v1, Firestore `document.update`,
  `europe-west1`, Node.js 22.

Limites connues :

- La version 1 attend dans la Function jusqu'a l'echeance. C'est simple et
  robuste pour ce palier, mais consomme du temps d'execution ; une migration
  future vers Cloud Tasks pourra reduire ce cout sans changer l'empreinte.
- Le test historique `SprintValidation` qui exige encore un bouton `Continuer`
  en fin de manche est obsolete depuis le passage automatique demande. Les
  quatre scenarios de ce fichier lies a cette etape passent ; l'assertion
  obsolete reste visible et n'est pas masquee dans ce commit.

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

### Rapport d'implementation

Implementation retenue :

- Callable Function authentifiee `submitGameAction` en `europe-west1`.
- Commande Zod stricte : salle, `stateVersion`, `turnId`, type d'action,
  identifiant du domino et cote ; aucun `gameState` client n'est accepte.
- L'UID vient exclusivement du contexte Firebase Auth, jamais de la commande.
- La transaction verifie l'appartenance a la salle, le statut `HUMAN`, le tour,
  la version, la possession du domino et la legalite du placement.
- `LogicEngine.handleTurn` et `passTurn` calculent seuls l'etat resultant.
- Un identifiant stable rend un rejeu inoffensif ; une commande concurrente
  differente devient `STALE` et ne modifie rien.
- Le dispatcher mobile utilise la callable uniquement pour `PLAY_TILE` et
  `PASS_TURN` dans les salles coordonnees. Solo et anciennes salles restent
  compatibles avec le parcours historique.

Controles valides :

- 7 tests unitaires d'actions humaines, 9 de tours actifs et 8 terminaux.
- Zod, mauvais joueur, joueur absent, mauvais cote, domino absent et passage
  illegal couverts.
- Rejeu identique et commande concurrente testes avec Firestore Emulator.
- Test mobile confirmant l'envoi minimal et l'absence d'ecriture directe de
  `gameState` par le dispatcher coordonne.
- Tests coordonnes `GameScreen` et suspension des automatismes client.
- Build TypeScript strict des Functions, ESLint cible sans erreur et
  `git diff --check`.
- Callable deployee et confirmee en v1, `europe-west1`, Node.js 22.

Limites connues :

- Jusqu'a l'etape 5, les regles Firestore historiques autorisent encore un
  ancien client membre a ecrire directement `gameState`. Le nouveau client ne
  le fait plus, mais la fermeture de ce contournement attend volontairement la
  suppression complete des fallbacks hote.
- App Check n'est pas impose dans cette etape ; Firebase Auth, l'appartenance a
  la salle et la transaction serveur sont obligatoires.
- Le `tsc --noEmit` mobile global expose une dette TypeScript anterieure dans
  plusieurs ecrans et tests sans lien avec cette etape. Les fichiers modifies
  sont couverts par Jest et ESLint cible, et les Functions compilent en strict.

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

### Rapport d'implementation

Implementation retenue :

- `MATCH_END` delegue a une transaction Firestore unique qui relit l'etat
  officiel, calcule les recompenses avec `RewardEngine`, met a jour economie,
  statistiques, historique et classement mensuel, puis ferme la salle.
- Un `finalizationId` deterministe est conserve dans la salle. Un retry, un
  second evenement Firestore ou deux invocations concurrentes ne peuvent donc
  crediter les participants qu'une seule fois.
- La liste des participants est photographiee au lancement du match afin de
  conserver dans le bilan un joueur deconnecte ou ayant abandonne, sans jamais
  inclure les bots.
- Les recompenses officielles sont publiees dans `room.finalization.rewards`.
  Chaque client affiche sa recompense puis resynchronise ses caches economie et
  statistiques en lecture seule ; aucun credit n'est recalcule sur le telephone.
- La callable authentifiee `requestRematch` enregistre les votes et remet la
  salle en attente lorsque tous les participants encore actifs ont vote. Le
  createur original n'est pas requis et tous les clients reviennent au lobby.
- `cleanupGhostRoomsCron` ferme les salles `WAITING` ou `PLAYING` inactives
  depuis 15 minutes, efface les `activeRoomId` encore lies a ces salles, puis
  supprime les salles `FINISHED` agees de plus de 24 heures.
- Les timestamps `lastActivity` des nouveaux chemins coordonnes restent des
  nombres en millisecondes, conformement au contrat mobile existant.

Controles valides :

- 4 tests unitaires de finalisation, plus les 24 tests des etapes precedentes.
- Firestore Emulator : finalisation concurrente et idempotente, gagnant,
  perdant, abandon, revanche avec createur absent et fermeture concurrente.
- Tests mobile : recompense serveur sans double credit, rafraichissement des
  caches, bouton de revanche pour un non-hote et retour collectif au lobby.
- Build TypeScript strict des Functions et ESLint cible sans erreur.
- `coordinateTerminalGamePhases` et `requestRematch` confirmees en v1,
  `europe-west1`, Node.js 22 ; `cleanupGhostRoomsCron` confirmee en v1 dans sa
  region historique `us-central1`, Node.js 22.

Limites connues :

- La revanche remet volontairement la salle au lobby ; un joueur doit relancer
  la distribution avec les parametres visibles avant le nouveau match.
- Le callable historique `processMatchReward` reste necessaire au mode solo et
  aux anciennes salles. Le parcours multijoueur coordonne ne l'appelle plus,
  mais son durcissement global pourra faire l'objet d'un chantier de securite
  distinct.
- Les salles fermees restent consultables 24 heures pour le resultat et le
  diagnostic avant suppression definitive.

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

### Rapport d'implementation

Implementation retenue :

- L'election d'`acting host` a ete supprimee de `GameScreen`. Dans une salle
  `coordinatorVersion: 1`, aucun telephone ne recoit d'autorite de match quand
  le createur se deconnecte.
- Les anciens automatismes client restent disponibles uniquement pour une salle
  legacy non coordonnee sous le nom explicite `hasLegacyHostAuthority`. Cette
  valeur est toujours `false` dans le nouveau systeme.
- Les timers BOUDE, bot, auto-pass, timeout et transition ne soumettent aucune
  mutation dans une salle coordonnee. Les overlays restent des vues locales et
  adoptent les phases diffusees par Firebase.
- `safeUpdateGameState` refuse desormais explicitement tout remplacement client
  pour une salle coordonnee, en plus de la protection serveur.
- Les regles Firestore refusent le remplacement complet de `gameState` et la
  modification directe du tour pendant un match coordonne.
- Les seules mutations client encore admises dans `gameState` sont les statuts
  de presence bornes : chacun gere son propre retour/abandon ; un membre peut
  seulement signaler un pair `HUMAN -> DISCONNECTED`, jamais l'abandonner ou le
  transformer en bot.
- Au lobby, les reglages restent collaboratifs comme auparavant, mais seul le
  createur peut effectuer la transition `WAITING -> PLAYING`. Cette autorite
  s'arrete des que le match commence.
- La commande `test:multi` cible maintenant reellement la suite de regles et
  s'execute en serie avec Firestore Emulator.

Controles valides :

- 4 scenarios de regles : compatibilite legacy, synchronisation, refus des
  ecritures coordonnees, presence autorisee et lancement de revanche par le
  createur uniquement.
- 33 tests des hooks de jeu, dispatcher, bots, synchronisation et overlays.
- 4 tests `GameScreen` propres au parcours coordonne.
- 29 tests unitaires Functions et build TypeScript strict.
- ESLint cible sans erreur et `git diff --check` sans anomalie.
- Regles compilees et publiees avec succes sur `domino-martinique-v1`.

Limites connues :

- App Check n'est pas impose : l'application web et les environnements locaux
  actuels ne disposent pas encore tous d'un jeton configure. Firebase Auth, les
  regles et les validations transactionnelles serveur restent obligatoires.
- Les chemins legacy sont conserves pour laisser finir les anciennes salles ;
  ils ne sont jamais selectionnes par une nouvelle partie, qui fixe
  `coordinatorVersion: 1` au lancement.
- Le test historique de snapshot `PARTIE_END/MANCHE_END` reste instable et
  expose une attente anterieure contradictoire. Les tests coordonnes concernes
  passent et cet ecart n'est pas masque dans la campagne finale.

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
