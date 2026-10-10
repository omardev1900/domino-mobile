import {
    HEARTBEAT_INITIAL_GRACE_MS,
    HEARTBEAT_TIMEOUT_MS,
    getHeartbeatExpiryDecision,
    heartbeatToServerMillis,
} from '../heartbeatPolicy';

const serverTimestamp = (value: number) => ({ toMillis: () => value });

describe('heartbeatPolicy', () => {
    it('n’utilise pas les nombres historiques issus de l’horloge client', () => {
        expect(heartbeatToServerMillis(Date.now() + 300_000)).toBeUndefined();
    });

    it('ne décide rien tant que l’horloge serveur RTDB est indisponible', () => {
        expect(getHeartbeatExpiryDecision({
            heartbeat: serverTimestamp(1),
            firstObservedAtMs: 1,
            serverNowMs: undefined,
        }).expires).toBe(false);
    });

    it('résiste à un décalage de plusieurs minutes de l’horloge du téléphone', () => {
        const serverNowMs = 1_000_000;
        const decision = getHeartbeatExpiryDecision({
            heartbeat: serverTimestamp(serverNowMs - 5_000),
            firstObservedAtMs: undefined,
            serverNowMs,
        });

        expect(decision).toMatchObject({ expires: false, heartbeatAgeMs: 5_000 });
    });

    it('accorde une grâce définie avant le premier heartbeat serveur', () => {
        const firstObservedAtMs = 1_000;
        expect(getHeartbeatExpiryDecision({
            heartbeat: undefined,
            firstObservedAtMs,
            serverNowMs: firstObservedAtMs + HEARTBEAT_INITIAL_GRACE_MS,
        }).expires).toBe(false);
        expect(getHeartbeatExpiryDecision({
            heartbeat: undefined,
            firstObservedAtMs,
            serverNowMs: firstObservedAtMs + HEARTBEAT_INITIAL_GRACE_MS + 1,
        }).expires).toBe(true);
    });

    it('expire un heartbeat serveur sans renouvellement', () => {
        const decision = getHeartbeatExpiryDecision({
            heartbeat: serverTimestamp(10_000),
            firstObservedAtMs: undefined,
            serverNowMs: 10_000 + HEARTBEAT_TIMEOUT_MS + 1,
        });

        expect(decision).toMatchObject({ expires: true, heartbeatAgeMs: HEARTBEAT_TIMEOUT_MS + 1 });
    });
});
