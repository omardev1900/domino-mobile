/**
 * navigation.config.ts
 *
 * Feature flag et configuration de la navigation globale.
 * Basculer USE_NEW_SIDEBAR à false restaure instantanément l'ancienne navigation.
 */

/** Feature flag — sidebar gauche permanente */
export const USE_NEW_SIDEBAR = true;

/** Routes où la sidebar est MASQUÉE (plein écran ou avant auth) */
export const SIDEBAR_HIDDEN_ROUTES: string[] = [
    '/',
    '/index',
    '/login',
    '/lobby',
    '/game-modes',
    '/modal',
];

/** Préfixes de routes où la sidebar est MASQUÉE */
export const SIDEBAR_HIDDEN_PREFIXES: string[] = [
    '/game/',
    '/join/',
    '/news/',
];

/** Largeur de la sidebar en pixels */
export const SIDEBAR_WIDTH = 76;
