import { GameRoom } from './types';

// The heartbeat is emitted every ten seconds. Allow two missed renewals.
export const LOBBY_HEARTBEAT_MAX_AGE_MS = 25_000;

export const getLobbyHostId = (room: GameRoom): string | undefined => {
    const humans = room.players.filter(player => player.status !== 'BOT');
    // Older rooms could transfer the seat without updating createdBy.
    return humans.find(player => player.uid === room.createdBy)?.uid ?? humans[0]?.uid;
};

export const heartbeatToMillis = (value: unknown): number | undefined => {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        const millis = (value as { toMillis: () => unknown }).toMillis();
        return typeof millis === 'number' && Number.isFinite(millis) ? millis : undefined;
    }
    return undefined;
};

export const getMissingLobbyPresencePlayerIds = (
    room: GameRoom,
    nowMs: number | null = Date.now(),
): string[] => room.players
    .filter(player => player.status !== 'BOT')
    .filter(player => {
        const heartbeatAtMs = heartbeatToMillis(room.heartbeats?.[player.uid]);
        return heartbeatAtMs === undefined || (nowMs !== null && heartbeatAtMs + LOBBY_HEARTBEAT_MAX_AGE_MS <= nowMs);
    })
    .map(player => player.uid);
