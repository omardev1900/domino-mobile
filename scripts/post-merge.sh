#!/bin/bash
# Post-merge setup — exécuté automatiquement après chaque merge de tâche.
# Idempotent, non-interactif, fail-fast.
set -e

echo "==> Post-merge setup"

# Landing page (tourne sur Replit — toujours installer)
echo "==> LP: pnpm install"
cd LP && pnpm install --frozen-lockfile=false && cd ..

# Mobile (construit en local — installer les deps pour la cohérence du monorepo)
echo "==> mobile: pnpm install"
cd mobile && pnpm install --frozen-lockfile=false && cd ..

echo "==> Done"
