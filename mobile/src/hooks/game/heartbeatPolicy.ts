export const HEARTBEAT_TIMEOUT_MS = 25_000;
export const HEARTBEAT_INITIAL_GRACE_MS = 45_000;

export interface FirestoreTimestampLike {
    toMillis: () => number;
}

export interface HeartbeatExpiryInput {
    heartbeat: unknown;
    firstObservedAtMs: number | undefined;
    serverNowMs: number | undefined;
}

export interface HeartbeatExpiryDecision {
    heartbeatAtMs: number | undefined;
    heartbeatAgeMs: number | undefined;
    expires: boolean;
    firstObservedAtMs: number | undefined;
}

export const heartbeatToServerMillis = (heartbeat: unknown): number | undefined => {
    if (typeof heartbeat !== 'object' || heartbeat === null) return undefined;
    const candidate = heartbeat as Partial<FirestoreTimestampLike>;
    if (typeof candidate.toMillis !== 'function') return undefined;

    const value = candidate.toMillis();
    return Number.isFinite(value) ? value : undefined;
};

/**
 * Les anciens heartbeats numériques sont volontairement ignorés : ils ont été
 * produits par l'horloge du téléphone. Le premier heartbeat serveur bénéficie
 * d'une grâce, puis l'absence de renouvellement devient expirée.
 */
export const getHeartbeatExpiryDecision = ({
    heartbeat,
    firstObservedAtMs,
    serverNowMs,
}: HeartbeatExpiryInput): HeartbeatExpiryDecision => {
    if (serverNowMs === undefined) {
        return {
            heartbeatAtMs: undefined,
            heartbeatAgeMs: undefined,
            expires: false,
            firstObservedAtMs,
        };
    }

    const heartbeatAtMs = heartbeatToServerMillis(heartbeat);
    if (heartbeatAtMs !== undefined) {
        const heartbeatAgeMs = Math.max(0, serverNowMs - heartbeatAtMs);
        return {
            heartbeatAtMs,
            heartbeatAgeMs,
            expires: heartbeatAgeMs > HEARTBEAT_TIMEOUT_MS,
            firstObservedAtMs: undefined,
        };
    }

    const observedAtMs = firstObservedAtMs ?? serverNowMs;
    return {
        heartbeatAtMs: undefined,
        heartbeatAgeMs: undefined,
        expires: serverNowMs - observedAtMs > HEARTBEAT_INITIAL_GRACE_MS,
        firstObservedAtMs: observedAtMs,
    };
};
