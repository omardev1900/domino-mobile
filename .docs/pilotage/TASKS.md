# Taches actives

- [ ] `PREMIUM-LOBBY-MODERATION-01` Prêt — Publier la version mobile qui inclut la modération du lobby validée. Les fonctions et les règles Firestore sont en production.

- [ ] `BUG-MULTI-START-01` Prêt — Publier la version mobile qui inclut les correctifs validés du lobby. Les fonctions de démarrage et de gestion des places sont en production.

- [ ] [Trello #145](https://trello.com/c/Ek7ZEsCJ) En cours — Le correctif est validé en préproduction et les Cloud Functions sont déployées. Il reste à publier la 2.5.4, à activer les publicités synchronisées en production et à vérifier un match gratuit et un match mixte.

- [ ] `BUG-MULTI-TIMER-01` En cours — Marge serveur réduite de 3 s à 1 s après expiration du timer ; validation appareil et publication à réaliser.
- [ ] `BUG-MULTI-JOIN-01` En cours — Jointure atomique autorisée dans les tables coordonnées en attente ; règles Firestore à publier et validation appareil à réaliser.

- [ ] `REPLAY-PURCHASE-01` En cours — Achat unique à 2 000 coins, sauvegarde atomique, pré-vérification des emplacements et lecture gratuite ; fonction optimisée déployée, nouvelle interface à valider sur appareil.
- [ ] `REPLAY-REPLACE-01` En cours — Choix et confirmation du remplacement, protégés par transaction ; validation sur appareil et déploiement à réaliser.
- [ ] `COINS-WALLET-01` Prêt — Historique des débits et crédits de coins accessible au joueur ; étudier l’autorité du solde pour garantir sa cohérence.

- [ ] `LEAGUE-SYNC-01` En cours — Comparer en lecture seule les compteurs mensuels, les historiques et les chemins de récompense ; préparer une simulation et présenter les écarts avant toute bascule en production.

- [ ] `REPLAY-02` En cours — Achat unique à 2 000 coins, sauvegarde automatique, remplacement parmi les deux replays inclus et lecture gratuite ; conserver les anciens replays, valider le parcours final sur appareil.
- [ ] `COINS-SERVER` En cours — Migrer les opérations de coins vers l’autorité serveur et protéger les anciennes écritures. Base transactionnelle et simulations concurrentes préparées ; mises, achats, récompenses, crédits publicitaires et règles Firestore à migrer avant activation.
- [ ] `COINS-BUYIN-01` En cours — Mise solo raccordée localement au serveur avec identité persistante et sans remboursement en cas de départ ; valider sur appareil, migrer multi et tournois et gérer les anciennes versions avant activation.

- [ ] `DEV-MULTI-HAND-01` Prêt pour validation multijoueur - Distribution de test personnalisée pour tous les joueurs ou uniquement l’hôte ; nécessite le coordinateur serveur actualisé.


- [ ] `INFO-CAMPAIGNS-02` Prêt pour validation visuelle Android - Corriger la mise en page paysage des popups de campagne et prévoir un message si leur image ne charge pas.


- [ ] `WEB-PREMIUM-SALES-01` En cours - Carte Trello « [Web] Vente de recharges et abonnements Premium » : parcours de paiement web, confirmation serveur, codes et abonnements securises.
- [ ] `UI-IN-GAME-SKINS-01` En cours - Carte Trello « Modifier skin du jeu lors
  d'une partie » : separer les reglages en onglets Sons et Skins, lister les
  skins possedes et les equiper immediatement pendant une partie.
- [ ] `UI-DEVELOPER-CONTACT-01` En cours - Carte Trello « Contact développeur » :
  remplacer le bloc infos/contact de la popup logo par un bouton e-mail vers
  cmm.saghir@gmail.com, avec l'objet pre-rempli du jeu.
- [ ] `UI-MULTI-LOBBY-01` Pret pour validation visuelle Android - Layout
  scrollable respectant les safe areas, sections sans superposition, statut
  d'attente passif et suppression integree au bloc TABLE.
