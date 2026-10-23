/**
 * LogService - Service de gestion des logs pour le projet Domino Martinique.
 * Il permet d'étouffer les logs de routine en production (SEC-6).
 * 
 * @usage LogService.info('MonTag', 'Message', data);
 */

// Utilisation de __DEV__ (global dans React Native) pour détecter l'environnement.
// En environnement de test (Jest), __DEV__ est généralement défini, sinon on fallback sur true.
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

// Mesures de performance : visibles en DEV, ou dans un build de diagnostic
// lancé avec EXPO_PUBLIC_PERF_LOG=1. Jamais actives en production normale.
// Accès direct obligatoire, sinon Expo n'inline pas la variable.
const perfFlag = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_PERF_LOG : undefined;
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
const isPerfEnabled = !isTest && (isDev || perfFlag === '1');

export const LogService = {
  /**
   * Logs d'information généraux (Visible uniquement en DEV)
   */
  info: (tag: string, message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[${tag}] ${message}`, ...args);
    }
  },

  /**
   * Logs de debug verbeux (Visible uniquement en DEV)
   */
  debug: (tag: string, message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`🔍 [DEBUG][${tag}] ${message}`, ...args);
    }
  },

  /**
   * Avertissements (Visible uniquement en DEV)
   */
  warn: (tag: string, message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`⚠️ [WARN][${tag}] ${message}`, ...args);
    }
  },

  /**
   * Erreurs critiques (TOUJOURS visible, même en production)
   */
  error: (tag: string, message: string, ...args: any[]) => {
    console.error(`❌ [ERROR][${tag}] ${message}`, ...args);
  },

  /**
   * Log générique (pour compatibilité avec logger.ts)
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Tracer une transition d'état majeure (ex: phase de jeu)
   */
  transition: (tag: string, fromState: string, toState: string, ...args: any[]) => {
    if (isDev) {
      console.log(`🔄 [TRANSITION][${tag}] ${fromState} ➔ ${toState}`, ...args);
    }
  },

  /**
   * Tracer un événement ponctuel important (ex: ouverture/fermeture modale, timer)
   */
  event: (tag: string, eventName: string, ...args: any[]) => {
    if (isDev) {
      console.log(`⚡ [EVENT][${tag}] ${eventName}`, ...args);
    }
  },

  /**
   * Mesures de performance (voir `perf.ts`). Format parsable en une ligne :
   * `[PERF] since=1234ms evt=store.load.catalog ms=842 ok=true`
   */
  perf: (event: string, fields: Record<string, string | number | boolean | null | undefined> = {}) => {
    if (!isPerfEnabled) return;
    const details = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    console.log(`[PERF] evt=${event}${details ? ` ${details}` : ''}`);
  }
};
