import * as admin from 'firebase-admin';

export type SystemLogLevel = 'info' | 'warn' | 'error';

export type SystemLogEvent =
    | 'match_reward'
    | 'tournament_score_update'
    | 'tournament_closed'
    | 'account_deleted'
    | 'cochons_migrated'
    | 'monthly_league_reset'
    | 'function_error';

export interface SystemLogEntry {
    event: SystemLogEvent;
    level: SystemLogLevel;
    functionName: string;
    uid?: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
}

/**
 * Écrit un événement système dans la collection `system_logs`.
 * Les erreurs d'écriture sont silencieuses pour ne jamais casser la CF appelante.
 */
export async function logSystemEvent(entry: Omit<SystemLogEntry, 'timestamp'>): Promise<void> {
    try {
        const db = admin.firestore();
        await db.collection('system_logs').add({
            ...entry,
            timestamp: Date.now(),
        });
    } catch (err) {
        console.warn('[systemLog] Failed to write log:', err);
    }
}
