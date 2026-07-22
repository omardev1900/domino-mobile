# Domino Martiniquais

Jeu de domino martiniquais (règles créoles, 3 joueurs). App mobile React Native/Expo avec dashboard admin et landing page.

## Structure du projet

| Dossier | Rôle |
|---|---|
| `mobile/` | App principale React Native + Expo |
| `admin/` | Dashboard admin Next.js |
| `LP/` | Landing page React + Vite (tourne sur Replit) |
| `functions/` | Cloud Functions Firebase (Node.js/TypeScript) |
| `docs/` | Specs, pilotage, feedback, roadmap |

## Comment lancer (sur Replit)

Seule la **landing page** tourne directement ici :

```bash
cd LP && pnpm run dev
```

Le workflow "Start application" est configuré pour ça — port 5000.

## Stack

- Mobile : React Native + Expo
- Backend temps réel : Firebase Firestore
- Auth : Firebase Authentication
- Cloud Functions : Node.js TypeScript
- Dashboard Admin : Next.js
- Landing page : React + Vite + Tailwind CSS

## User preferences

- Langue de communication : français
