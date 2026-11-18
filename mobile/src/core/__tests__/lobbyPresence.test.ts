import { getMissingLobbyPresencePlayerIds, LOBBY_HEARTBEAT_MAX_AGE_MS } from '../lobbyPresence';
import { GameRoom, RoomStatus } from '../types';

const room = (heartbeats: Record<string, unknown>): GameRoom => ({
    roomId: 'room-1',
    createdAt: 1,
    lastActivity: 1,
    status: RoomStatus.WAITING,
    createdBy: 'p1',
    isPrivate: true,
    gameState: null,
    players: [
        { uid: 'p1', displayName: 'P1', gamesPlayed: 0, gamesWon: 0 },
        { uid: 'p2', displayName: 'P2', gamesPlayed: 0, gamesWon: 0 },
        { uid: 'bot-2', displayName: 'Bot', gamesPlayed: 0, gamesWon: 0, status: 'BOT' },
    ],
    heartbeats,
});

const timestamp = (millis: number) => ({ toMillis: () => millis });

describe('lobby presence', () => {
    it('accepts recent human heartbeats and ignores bots', () => {
        const now = 100_000;
        expect(getMissingLobbyPresencePlayerIds(room({
            p1: timestamp(now - 1_000),
            p2: timestamp(now - LOBBY_HEARTBEAT_MAX_AGE_MS + 1),
        }), now)).toEqual([]);
    });

    it('rejects a human with no recent heartbeat', () => {
        const now = 100_000;
        expect(getMissingLobbyPresencePlayerIds(room({
            p1: timestamp(now - 1_000),
            p2: timestamp(now - LOBBY_HEARTBEAT_MAX_AGE_MS - 1),
        }), now)).toEqual(['p2']);
    });

    it('rejects a human with no heartbeat at all', () => {
        expect(getMissingLobbyPresencePlayerIds(room({
            p1: timestamp(99_000),
        }), 100_000)).toEqual(['p2']);
    });
});
