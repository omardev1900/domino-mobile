/**
 * perf.ts
 *
 * Instrumentation légère pour diagnostiquer les lenteurs d'affichage
 * (boutique, Premium, Ligue des Cochons, classements).
 *
 * • Active uniquement en DEV, ou dans un build de diagnostic lancé avec
 *   `EXPO_PUBLIC_PERF_LOG=1`.
 * • N'altère aucun comportement : les helpers se contentent de mesurer.
 * • Format de log parsable, une ligne par événement :
 *
 *   [PERF] since=1234ms evt=store.load.catalog ms=842 ok=true
 *
 * `since` = millisecondes depuis le chargement du bundle, ce qui permet de
 * comparer un cold start (lecture 1) et un retour sur écran (lecture 2).
 *
 * Convention de nommage des événements :
 *   `.dataReady` / `.dataReceived` = données disponibles côté JS
 *   `.contentLaidOut`              = mise en page native effectuée (onLayout / onContentSizeChange)
 *   `.framePresented`              = jalon JS après commit + 2 frames (mesure de secours)
 *   `.payload`                     = poids estimé du modèle client (voir `perfJsonSize`),
 *                                    avec `delayMs` et `jsonSizeMs`
 */

import { LogService } from './LogService';

// Expo n'inline `process.env.EXPO_PUBLIC_*` qu'en accès direct (pas d'optional
// chaining) : la forme `process.env?.EXPO_PUBLIC_PERF_LOG` reste une lecture
// runtime et ne fonctionne pas dans un build release.
const perfFlag = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_PERF_LOG : undefined;
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const isPerfEnabled =
    !isTest && ((typeof __DEV__ !== 'undefined' && __DEV__) || perfFlag === '1');

const sessionStartedAt = Date.now();

type PerfFields = Record<string, string | number | boolean | null | undefined>;

export const perfEnabled = (): boolean => isPerfEnabled;

/** Horodatage de départ à passer à `perfEnd`. */
export const perfStart = (): number => Date.now();

/** Événement ponctuel (premier affichage, état atteint, etc.). */
export const perfMark = (event: string, fields: PerfFields = {}): void => {
    if (!isPerfEnabled) return;
    LogService.perf(event, { since: Date.now() - sessionStartedAt, ...fields });
};

/** Mesure une durée depuis `startedAt` et journalise le résultat. */
export const perfEnd = (event: string, startedAt: number, fields: PerfFields = {}): number => {
    const elapsed = Date.now() - startedAt;
    if (!isPerfEnabled) return elapsed;
    LogService.perf(event, { since: Date.now() - sessionStartedAt, ms: elapsed, ...fields });
    return elapsed;
};

/**
 * Exécute une lecture asynchrone en mesurant sa durée, y compris son échec.
 * Retourne directement le résultat pour rester transparent dans un `Promise.all`.
 * `fields` permet d'attacher le contexte de l'appelant (ex: identifiant de run).
 */
export const perfTime = async <T>(
    event: string,
    read: () => Promise<T>,
    fields: PerfFields = {}
): Promise<T> => {
    if (!isPerfEnabled) return read();

    const startedAt = Date.now();
    try {
        const result = await read();
        perfEnd(event, startedAt, { ...fields, ok: true });
        return result;
    } catch (error) {
        perfEnd(event, startedAt, {
            ...fields,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
};

/**
 * Taille approximative du modèle client d'un document Firestore, exprimée en
 * caractères JSON (`jsonBytes`).
 *
 * ⚠️ Ce n'est PAS le volume transféré sur le réseau :
 *   • Firestore encode ses propres types (Timestamp, GeoPoint, références) ;
 *   • le protocole et les métadonnées ne sont pas comptés ;
 *   • une lecture peut provenir du cache local (voir `snapshot.metadata.fromCache`).
 *
 * Utile uniquement comme indicateur relatif de surpoids entre deux écrans.
 */
export const perfJsonSize = (data: unknown): number => {
    if (!isPerfEnabled) return 0;
    try {
        return JSON.stringify(data)?.length ?? 0;
    } catch {
        return 0;
    }
};

/**
 * Mesure coûteuse (ex: sérialisation d'un gros snapshot) planifiée après la
 * frame courante, puis hors du cycle de rendu immédiat.
 *
 * ⚠️ Ce n'est PAS une garantie d'inactivité : la mesure peut encore tomber
 * pendant que React Native travaille. C'est pourquoi on journalise :
 *   • `delayMs`    : temps entre la planification et le début réel de la mesure,
 *   • `jsonSizeMs` : coût de la sérialisation elle-même.
 * Ces deux champs permettent de vérifier a posteriori si la mesure a atterri
 * après le jalon de contenu (`since` comparables).
 */
export const perfDefer = (event: string, measure: () => PerfFields): void => {
    if (!isPerfEnabled) return;

    const scheduledAt = Date.now();
    const run = () => {
        const startedAt = Date.now();
        const fields = measure();
        perfMark(event, {
            delayMs: startedAt - scheduledAt,
            jsonSizeMs: Date.now() - startedAt,
            ...fields,
        });
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(run, 0));
    } else {
        setTimeout(run, 0);
    }
};

/** Signale un échec de lecture sans changer le comportement de l'appelant. */
export const perfError = (event: string, error: unknown, fields: PerfFields = {}): void => {
    if (!isPerfEnabled) return;
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    LogService.perf(event, {
        since: Date.now() - sessionStartedAt,
        code,
        error: error instanceof Error ? error.message : String(error),
        ...fields,
    });
};
