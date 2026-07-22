/**
 * LogService — stub pour le contexte Cloud Functions.
 * RewardEngine.ts importe ce module ; dans la Cloud Function on redirige vers console.*.
 * Ce fichier n'est PAS copié depuis mobile/src/core — il est propre au backend.
 */
export const LogService = {
    debug: (tag: string, message: string, ...args: any[]) => console.log(`[${tag}] ${message}`, ...args),
    info:  (tag: string, message: string, ...args: any[]) => console.log(`[${tag}] ${message}`, ...args),
    warn:  (tag: string, message: string, ...args: any[]) => console.warn(`[${tag}] ${message}`, ...args),
    error: (tag: string, message: string, ...args: any[]) => console.error(`[${tag}] ${message}`, ...args),
};
