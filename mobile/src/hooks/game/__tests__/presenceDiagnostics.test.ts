import { LogService } from '../../../core/services/LogService';
import {
    buildPresenceDiagnosticRecord,
    createPresenceConnectionId,
    logPresenceDiagnostic,
    presenceErrorCode,
    setPresenceServerTimeOffset,
} from '../presenceDiagnostics';

jest.mock('../../../core/services/LogService', () => ({
    LogService: { info: jest.fn() },
}));

type LegacyPresenceStatus = 'online' | 'offline';

interface LegacyPresenceWrite {
    actor: 'new_session' | 'observer' | 'old_session';
    status: LegacyPresenceStatus;
    triggeredAtMs: number;
    payloadTimestampMs: number;
}

const replayLegacySinglePathPresence = (writes: LegacyPresenceWrite[]): LegacyPresenceWrite | undefined =>
    [...writes].sort((left, right) => left.triggeredAtMs - right.triggeredAtMs).at(-1);

describe('presenceDiagnostics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setPresenceServerTimeOffset(0);
    });

    it('produit des identifiants corrélables sans exposer les identifiants Firebase', () => {
        setPresenceServerTimeOffset(275);
        const record = buildPresenceDiagnosticRecord({
            event: 'status_transition_started',
            source: 'firestore_heartbeat',
            roomId: 'room-sensitive-id',
            playerId: 'firebase-user-sensitive-id',
            connectionId: 'connection-test',
            heartbeatAgeMs: 26_000,
            statusFrom: 'HUMAN',
            statusTo: 'DISCONNECTED',
        }, 10_000);

        expect(record).toMatchObject({
            clientAtMs: 10_000,
            estimatedServerAtMs: 10_275,
            serverTimeOffsetMs: 275,
            connectionId: 'connection-test',
            heartbeatAgeMs: 26_000,
        });
        expect(record.room).toMatch(/^room_[a-z0-9]+$/);
        expect(record.player).toMatch(/^player_[a-z0-9]+$/);
        expect(JSON.stringify(record)).not.toContain('room-sensitive-id');
        expect(JSON.stringify(record)).not.toContain('firebase-user-sensitive-id');
    });

    it('émet un événement structuré via LogService', () => {
        const record = logPresenceDiagnostic({
            event: 'rtdb_connection_changed',
            source: 'rtdb_connection',
            roomId: 'room-1',
            playerId: 'player-1',
            rtdbConnected: true,
        });

        expect(LogService.info).toHaveBeenCalledWith(
            'PresenceDiagnostics',
            'rtdb_connection_changed',
            record
        );
    });

    it('génère un identifiant de connexion déterministe avec des entrées contrôlées', () => {
        expect(createPresenceConnectionId(1_700_000_000_000, 0.5))
            .toBe('connection_loyw3v28_4zsow');
    });

    it('ne conserve que le code ou le nom technique d’une erreur', () => {
        expect(presenceErrorCode({ code: 'permission-denied', message: 'private payload' }))
            .toBe('permission-denied');
        expect(presenceErrorCode(new TypeError('private payload'))).toBe('TypeError');
        expect(presenceErrorCode('private payload')).toBe('unknown_error');
    });

    it('reproduit la course où un ancien onDisconnect écrase une session reconnectée', () => {
        const finalPresence = replayLegacySinglePathPresence([
            { actor: 'old_session', status: 'online', triggeredAtMs: 100, payloadTimestampMs: 100 },
            { actor: 'new_session', status: 'online', triggeredAtMs: 200, payloadTimestampMs: 200 },
            // Le payload offline a été armé par l’ancienne session à t=100, mais Firebase
            // l’exécute après que la nouvelle session s’est déjà déclarée en ligne.
            { actor: 'old_session', status: 'offline', triggeredAtMs: 300, payloadTimestampMs: 100 },
        ]);

        expect(finalPresence).toEqual({
            actor: 'old_session',
            status: 'offline',
            triggeredAtMs: 300,
            payloadTimestampMs: 100,
        });
        expect(finalPresence?.status).toBe('offline');
        // Un troisième client observateur lance alors la grâce RTDB et peut marquer
        // le joueur DISCONNECTED, même si sa nouvelle session est toujours connectée.
    });
});
