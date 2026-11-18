import { GameRoom } from './types';

// The lobby heartbeat is emitted every 10 seconds. This margin tolerates a
// short scheduling/network delay without allowing a stale player to start.
export const LOBBY_HEARTBEAT_MAX_AGE_MS = 20_000;

export const heartbeatToMillis = (value: unknown): number | undefined => {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        const millis = (value as { toMillis: () => unknown }).toMillis();
        return typeof millis === 'number' && Number.isFinite(millis) ? millis : undefined;
    }
    return undefined;
};

export const getMissingLobbyPresencePlayerIds = (
    room: GameRoom,
    nowMs = Date.now(),
): string[] => room.players
    .filter(player => player.status !== 'BOT')
    .filter(player => {
        const heartbeatAtMs = heartbeatToMillis(room.heartbeats?.[player.uid]);
        return heartbeatAtMs === undefined || heartbeatAtMs + LOBBY_HEARTBEAT_MAX_AGE_MS <= nowMs;
    })
    .map(player => player.uid);
