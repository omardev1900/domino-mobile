import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useGameSync } from '../useGameSync';
import { GameState, GameRoom, Player, RoomStatus } from '../../../core/types';
import { onSnapshot, runTransaction } from 'firebase/firestore';
import { createBaseGameState } from './testUtils';

// Mock Firebase dependencies
jest.mock('../../../core/services/firebase', () => ({
    db: {}
}));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    onSnapshot: jest.fn().mockReturnValue(() => {}),
    runTransaction: jest.fn((db, cb) => cb({
        get: jest.fn(),
        update: jest.fn(),
        set: jest.fn()
    }))
}));

const mockGameState: GameState = createBaseGameState({
    gameId: 'test-room-1',
    phase: 'PLAYING',
    players: [
        { id: 'p1', name: 'Player 1', status: 'HUMAN', hand: [] } as unknown as Player,
        { id: 'p2', name: 'Player 2', status: 'HUMAN', hand: [] } as unknown as Player
    ],
    currentPlayerId: 'p1',
    lastActionTimestamp: 1000,
});

const mockRoomData: GameRoom = {
    roomId: 'test-room-1',
    status: RoomStatus.PLAYING,
    players: [
        { uid: 'p1', displayName: 'Player 1', gamesPlayed: 0, gamesWon: 0 },
        { uid: 'p2', displayName: 'Player 2', gamesPlayed: 0, gamesWon: 0 }
    ],
    createdBy: 'p1',
    createdAt: 0,
    lastActivity: 0,
    isPrivate: false,
    gameState: mockGameState,
};

describe('useGameSync Hook', () => {
    jest.setTimeout(30000);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns initial empty state correctly', () => {
        const { result } = renderHook(() => useGameSync({
            gameId: undefined,
            localPlayerId: 'p1',
            isSoloMode: true,
            signalPlayerOnline: jest.fn().mockResolvedValue(true)
        }));

        expect(result.current.gameState).toBeNull();
        expect(result.current.roomData).toBeNull();
        expect(result.current.isStarting).toBe(false);
    });

    it('subscribes to onSnapshot and updates state when doc exists', () => {
        let snapshotCallback: any;

        (onSnapshot as jest.Mock).mockImplementation((ref, callback) => {
            snapshotCallback = callback;
            return jest.fn(); // unsubscribe mock
        });

        (runTransaction as jest.Mock).mockResolvedValue(true);

        const { result } = renderHook(() => useGameSync({
            gameId: 'test-room-1',
            localPlayerId: 'p1',
            isSoloMode: false,
            signalPlayerOnline: jest.fn().mockResolvedValue(true)
        }));

        act(() => {
            snapshotCallback({
                exists: () => true,
                data: () => mockRoomData
            });
        });

        expect(result.current.roomData).toEqual(mockRoomData);
        expect(result.current.gameState).toEqual(mockGameState);
    });

    it('runs safeUpdateGameState and rejects older states', async () => {
        const mockTransaction = {
            get: jest.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({ ...mockRoomData, gameState: { ...mockGameState, mancheNumber: 1, roundNumber: 2, turnId: 5 } })
            }),
            update: jest.fn()
        };

        (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
            return await callback(mockTransaction);
        });

        const signalPlayerOnline = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useGameSync({
            gameId: 'test-room-1',
            localPlayerId: 'p1',
            isSoloMode: false,
            signalPlayerOnline
        }));

        // Nettoyage après montage
        await act(async () => {});
        mockTransaction.update.mockClear();

        const staleState = {
            ...mockGameState,
            mancheNumber: 1, roundNumber: 2, turnId: 4
        };

        await act(async () => {
            await result.current.safeUpdateGameState('test-room-1', staleState);
        });

        expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('runs safeUpdateGameState and allows newer states', async () => {
        const mockTransaction = {
            get: jest.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({ ...mockRoomData, gameState: { ...mockGameState, mancheNumber: 1, roundNumber: 2, turnId: 5 } })
            }),
            update: jest.fn()
        };

        (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
            return await callback(mockTransaction);
        });

        const signalPlayerOnline = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useGameSync({
            gameId: 'test-room-1',
            localPlayerId: 'p1',
            isSoloMode: false,
            signalPlayerOnline
        }));

        await act(async () => {});
        mockTransaction.update.mockClear();

        const freshState = {
            ...mockGameState,
            mancheNumber: 1, roundNumber: 2, turnId: 6
        };

        await act(async () => {
            await result.current.safeUpdateGameState('test-room-1', freshState);
        });

        expect(mockTransaction.update).toHaveBeenCalled();
        const updateArg = mockTransaction.update.mock.calls[0][1];
        expect(updateArg.gameState.turnId).toBe(6);
    });
});