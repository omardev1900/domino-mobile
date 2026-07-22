# Domino Martiniquais

> Application mobile React Native (Expo) de Domino martiniquais (règles créoles, 3 joueurs). Disponible sur Android + iOS.

**Dernière mise à jour :** 21 mai 2026
**Version app :** 2.5.6
**Lead Dev :** Omatrice
**github :** omardev1900
---

## 1. Objectif produit

- Jouer en **solo** contre une IA (3 niveaux : TI_MANMAY, MAPIPI, GRAN_MOUN ; un 4ᵉ MÈTKAYALI planifié)
- Jouer en **multijoueur temps réel** (tables publiques ou privées, 3 joueurs)
- Système de **comptes, classement, Ligue des Cochons (8 paliers), boutique**
- Générer des **revenus** via publicités + premium

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Mobile | React Native + Expo |
| Backend temps réel | Firebase Firestore |
| Auth | Firebase Authentication |
| Cloud Functions | Node.js (TypeScript) — `processMatchReward` |
| Admin Dashboard | Next.js (séparé) |
| Tests | Jest (127 tests unitaires) |

---

## 3. État actuel

### ✅ Livré (blocs 1-9 + sprint tests fermés)
- Sécurité Firestore + rotation des clés
- Moteur de jeu complet (127+ tests, 0% failure)
- UI/UX complète (paysage, animations, audio)
- Mode Solo + Mode Multijoueur
- Modes de jeu : Manche, Score, Cochon
- Ligue des Cochons (8 paliers) — grades harmonisés sur tous les écrans
- Système économique (Coins, XP, Diamonds, niveaux)
- Boutique & cosmétiques — tchat consommable à l'unité
- Dashboard Admin (Next.js) — logs, bots, tchat, boutique, pubs
- Sidebar navigation + partage social (victoire + grade)
- Publicité admin-managed (6 emplacements) + cadeau quotidien conditionné pub
- Notifications push Android (FCM)
- Sentry monitoring (crashs + erreurs JS)
- IA MÈTKAYALI Niveau 4 (Monte-Carlo) + bots adaptatifs au grade
- Suppression de compte (exigence Google Play)
- Landing page + Politique de confidentialité

### 🔄 Avant lancement officiel
5 tâches → voir `docs/pilotage/TASKS.md` (sprint "Pré-Lancement Officiel")

### 📋 À venir (post-lancement officiel, priorité décroissante)
1. AdMob automatique (impressions/clics)
2. Bloc 11 — Tournois
3. Paiements in-app Android (Google Pay)
4. Notifications push Web (PWA)
5. Fallback audio Safari iOS

---

## 4. Démarrer en dev

```bash
# Mobile
cd mobile
npm install
npx expo start

# Admin dashboard
cd admin
npm install
npm run dev

# Cloud Functions
cd functions
npm install
npm run serve
```

---

## 5. Où chercher quoi ?

- **Tâches en cours** → `docs/pilotage/TASKS.md`
- **Backlog** → `docs/pilotage/BACKLOG.md`
- **Archive tâches** → `docs/pilotage/DONE.md`
- **Règles du jeu** → `docs/specs/GAME_RULES.md`
- **Architecture technique** → `docs/specs/ARCHITECTURE.md`
- **Autres specs** (ads, économie, ligue, bot) → `docs/specs/`
- **Retours client** → `docs/feedback/CLIENT.md`
- **Changelog** → `docs/feedback/CHANGELOG.md`
- **Roadmap** → `docs/ROADMAP.md`
- **Organisation de la doc** → `docs/STRUCTURE.md`

---

## 6. Hors scope (ne pas implémenter)

- Système d'amis — retiré définitivement
- Graphismes 3D
- IA experte probabiliste (à ne pas confondre avec MÈTKAYALI, qui est planifié)
- Chat texte libre
- Saisons / classements périodiques complexes
- Cash-prize dans les tournois
- **Mode hors-ligne** — connexion internet obligatoire, même en solo
- **Mode invité** — supprimé définitivement, ne pas réintroduire

---

## 7. Règles d'accès (décisions produit définitives)

> Détail technique dans `docs/specs/ARCHITECTURE.md` § 7.

| Règle | Comportement |
|---|---|
| **Authentification obligatoire** | Seul l'écran login est accessible sans compte. Tout le reste est bloqué. |
| **Connexion internet obligatoire** | Si pas de réseau : écran bloquant + bouton "Réessayer". Pas d'accès au jeu. |
| **Mode invité** | Supprimé définitivement (v2.2). Ne pas réintroduire. |
| **Mode offline** | Supprimé définitivement (ticket ONLINE-ONLY, mai 2026). |
