import { LogService } from '../../core/services/LogService';

export type PresenceDiagnosticSource =
    | 'app_state'
    | 'coordinator'
    | 'firestore_heartbeat'
    | 'manual_leave'
    | 'reconnect'
    | 'rtdb_connection'
    | 'rtdb_presence';

export type PresenceDiagnosticEvent =
    | 'app_state_changed'
    | 'coordinator_action_observed'
    | 'heartbeat_skipped'
    | 'heartbeat_write_failed'
    | 'heartbeat_write_succeeded'
    | 'rtdb_connection_changed'
    | 'rtdb_grace_cancelled'
    | 'rtdb_grace_expired'
    | 'rtdb_grace_started'
    | 'rtdb_on_disconnect_armed'
    | 'rtdb_presence_write_failed'
    | 'rtdb_presence_written'
    | 'server_time_offset_updated'
    | 'status_transition_applied'
    | 'status_transition_failed'
    | 'status_transition_skipped'
    | 'status_transition_started';

export interface PresenceDiagnosticInput {
    event: PresenceDiagnosticEvent;
    source: PresenceDiagnosticSource;
    roomId: string;
    playerId: string;
    connectionId?: string;
    actionId?: string;
    appState?: string;
    decision?: string;
    errorCode?: string;
    graceMs?: number;
    heartbeatAgeMs?: number;
    heartbeatAtMs?: number;
    phase?: string;
    presenceAtMs?: number;
    rtdbConnected?: boolean;
    statusFrom?: string;
    statusTo?: string;
}

export interface PresenceDiagnosticRecord extends Omit<PresenceDiagnosticInput, 'roomId' | 'playerId' | 'actionId'> {
    schemaVersion: 1;
    clientAtMs: number;
    estimatedServerAtMs: number;
    serverTimeOffsetMs: number;
    room: string;
    player: string;
    action?: string;
}

let serverTimeOffsetMs = 0;
let hasServerTimeOffset = false;

const hashIdentifier = (value: string): string => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36).padStart(7, '0');
};

export const presenceCorrelationToken = (kind: 'action' | 'player' | 'room', value: string): string =>
    `${kind}_${hashIdentifier(value)}`;

export const createPresenceConnectionId = (
    nowMs = Date.now(),
    randomValue = Math.random()
): string => `connection_${nowMs.toString(36)}_${Math.floor(randomValue * 0x1000000).toString(36).padStart(5, '0')}`;

export const setPresenceServerTimeOffset = (offsetMs: number): void => {
    if (!Number.isFinite(offsetMs)) return;
    serverTimeOffsetMs = offsetMs;
    hasServerTimeOffset = true;
};

/**
 * La RTDB fournit l'écart entre l'horloge Firebase et celle du périphérique.
 * Sans cet écart, le client ne prend aucune décision d'expiration afin qu'une
 * horloge locale fausse ne puisse jamais évincer un adversaire.
 */
export const getEstimatedPresenceServerNow = (clientNowMs = Date.now()): number | undefined =>
    hasServerTimeOffset ? clientNowMs + serverTimeOffsetMs : undefined;

export const presenceErrorCode = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
        const candidate = error as { code?: unknown; name?: unknown };
        if (typeof candidate.code === 'string') return candidate.code;
        if (typeof candidate.name === 'string') return candidate.name;
    }
    return 'unknown_error';
};

export const buildPresenceDiagnosticRecord = (
    input: PresenceDiagnosticInput,
    clientAtMs = Date.now()
): PresenceDiagnosticRecord => {
    const { roomId, playerId, actionId, ...safeInput } = input;
    return {
        schemaVersion: 1,
        clientAtMs,
        estimatedServerAtMs: clientAtMs + serverTimeOffsetMs,
        serverTimeOffsetMs,
        room: presenceCorrelationToken('room', roomId),
        player: presenceCorrelationToken('player', playerId),
        ...(actionId ? { action: presenceCorrelationToken('action', actionId) } : {}),
        ...safeInput,
    };
};

export const logPresenceDiagnostic = (input: PresenceDiagnosticInput): PresenceDiagnosticRecord => {
    const record = buildPresenceDiagnosticRecord(input);
    LogService.info('PresenceDiagnostics', input.event, record);
    return record;
};
