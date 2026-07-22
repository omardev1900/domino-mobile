import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';
import { useActionDispatcher } from '../hooks/game/useActionDispatcher';
import { useBotDecision } from '../hooks/game/useBotDecision';
import { useAutoPass } from '../hooks/game/useAutoPass';
import { RoundEndFlow } from '../components/game/RoundEndFlow';
import { GameState } from '../core/types';

// ==========================================
// MOCKS
// ==========================================
jest.mock('../core/audio/SoundManager', () => ({
    playSound: jest.fn(),
    playClack: jest.fn(),
    safePlayPlayer: jest.fn().mockResolvedValue(true),
}));

jest.mock('../core/services/LogService', () => ({
    LogService: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        transition: jest.fn(),
    }
}));

jest.mock('../core/LogicEngine', () => ({
    handleTurn: jest.fn().mockReturnValue({ phase: 'PLAYING' }), // fake state return
    passTurn: jest.fn().mockReturnValue({ phase: 'PLAYING' }),
    handleTimeout: jest.fn().mockReturnValue({ phase: 'PLAYING' }),
    computeNextRoundState: jest.fn().mockReturnValue({ phase: 'PLAYING' }),
    resolveBoude: jest.fn().mockReturnValue({ newState: { phase: 'PLAYING' }, isTie: false }),
}));

jest.mock('../core/DominoEngine', () => ({
    getValidMoves: jest.fn().mockReturnValue([]), // No valid moves to force auto-pass/boudé
}));

jest.mock('../core/BotEngine', () => ({
    computeBotDecision: jest.fn().mockReturnValue({ action: 'PLAY', domino: { left: 1, right: 1 }, side: 'left' }),
    computeEmergencyBotDecision: jest.fn().mockReturnValue({ action: 'PLAY', domino: { left: 1, right: 1 }, side: 'left' }),
}));

jest.mock('../core/MeytKayaliEngine', () => ({
    getMeytKayaliMove: jest.fn().mockReturnValue({ action: 'PLAY', domino: { left: 1, right: 1 }, side: 'left' }),
}));


// Mock timer functions needed for animations
jest.spyOn(global, 'setTimeout');

// ==========================================
// SCENARIO 1: Anti-Rollback & Turn Lock (P1)
// ==========================================
describe('Scénario 1 : Anti-Rollback et File FIFO (P1)', () => {
    it('rejects subsequent rapid actions if the lock is not acquired', async () => {
        let lockAcquired = false;
        
        const acquireLock = jest.fn().mockImplementation(() => {
            if (!lockAcquired) {
                lockAcquired = true;
                return true;
            }
            return false;
        });

        const releaseLock = jest.fn().mockImplementation(() => {
            lockAcquired = false;
        });

        const safeUpdateGameState = jest.fn().mockResolvedValue(undefined);

        const mockGameState: GameState = {
            gameId: 'test-game',
            phase: 'PLAYING',
            players: [
                { id: 'p1', status: 'HUMAN', hand: [{ id: 'd1', left: 1, right: 1, isDouble: true }] }
            ],
            currentPlayerId: 'p1',
            turnId: 1,
            history: [],
            board: [],
        } as any;

        const { result } = renderHook(() => useActionDispatcher({
            gameState: mockGameState,
            localPlayerId: 'p1',
            isSoloMode: false,
            gameId: 'test-game',
            isLocalHost: true,
            roomData: {} as any,
            acquireLock,
            releaseLock,
            canAction: () => true,
            safeUpdateGameState,
            setGameState: jest.fn(),
            clearAllTurnTimers: jest.fn(),
            setOvertime: jest.fn(),
        }));

        // Fire 3 actions rapidly
        await act(async () => {
            const p1 = result.current.dispatch({ type: 'PLAY_TILE', playerId: 'p1', tile: { id: 'd1', left: 1, right: 1, isDouble: true } as any });
            const p2 = result.current.dispatch({ type: 'PLAY_TILE', playerId: 'p1', tile: { id: 'd2', left: 2, right: 2, isDouble: true } as any });
            const p3 = result.current.dispatch({ type: 'PLAY_TILE', playerId: 'p1', tile: { id: 'd3', left: 3, right: 3, isDouble: true } as any });
            await Promise.all([p1, p2, p3]);
        });

        // acquireLock should have been called 3 times, but safeUpdateGameState only once
        expect(acquireLock).toHaveBeenCalledTimes(3);
        expect(safeUpdateGameState).toHaveBeenCalledTimes(1);
        expect(releaseLock).toHaveBeenCalledTimes(1);
    });
});

// ==========================================
// SCENARIO 2: Coupure Réseau & Timeout (P2)
// ==========================================
describe('Scénario 2 : Coupure Réseau et Watchdog (P2)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('cancels safeUpdateGameState after 8 seconds and clears the lock', async () => {
        const acquireLock = jest.fn().mockReturnValue(true);
        const releaseLock = jest.fn();
        
        // Mock a hanging firebase call
        const safeUpdateGameState = jest.fn().mockImplementation(() => {
            return new Promise(() => {}); // never resolves
        });

        const mockGameState: GameState = {
            gameId: 'test-game',
            phase: 'PLAYING',
            players: [{ id: 'p1', status: 'HUMAN', hand: [] }],
            currentPlayerId: 'p1',
            turnId: 1,
            history: [],
        } as any;

        const { result } = renderHook(() => useActionDispatcher({
            gameState: mockGameState,
            localPlayerId: 'p1',
            isSoloMode: false,
            gameId: 'test-game',
            isLocalHost: true,
            roomData: {} as any,
            acquireLock,
            releaseLock,
            canAction: () => true,
            safeUpdateGameState,
            setGameState: jest.fn(),
            clearAllTurnTimers: jest.fn(),
            setOvertime: jest.fn(),
        }));

        let dispatchPromise: any;
        act(() => {
            dispatchPromise = result.current.dispatch({ type: 'PASS_TURN', playerId: 'p1' });
        });

        // Fast-forward 8 seconds
        await act(async () => {
            jest.advanceTimersByTime(8000);
        });

        await act(async () => {
            await dispatchPromise; // Wait for the race to reject
        });

        // The lock must be released even if Firebase times out
        expect(releaseLock).toHaveBeenCalled();
    });
});

// ==========================================
// SCENARIO 3: Reconnexion et Vol de Tour par Bot (P2)
// ==========================================
describe('Scénario 3 : Reconnexion et Vol de Tour par les Bots (P2)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not auto-play if HUMAN reconnects (status changes from DISCONNECTED to HUMAN)', async () => {
        const mockDispatch = jest.fn().mockResolvedValue(undefined);

        let mockGameState: GameState = {
            phase: 'PLAYING',
            currentPlayerId: 'p2', // It's p2's turn
            turnId: 1,
            players: [
                { id: 'p1', status: 'HUMAN' },
                { id: 'p2', status: 'DISCONNECTED' } // Disconnected human
            ]
        } as any;

        const { rerender } = renderHook((state) => useBotDecision({
            gameState: state,
            isLocalHost: true,
            roomData: {} as any,
            dispatch: mockDispatch,
            localPlayerId: 'p1',
            isSoloMode: false,
            isPaused: false,
            canAction: () => true, // FIXED missing prop
        }), { initialProps: mockGameState });

        // Bot waits 100ms if disconnected. Advance 50ms safely.
        act(() => {
            jest.advanceTimersByTime(50);
        });

        // Player reconnects
        mockGameState = {
            ...mockGameState,
            players: [
                { id: 'p1', status: 'HUMAN' },
                { id: 'p2', status: 'HUMAN' } // Back to human
            ]
        } as any;

        rerender(mockGameState);

        // Advance past the bot timeout
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        // The bot should NOT have played because the player is human again
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});

// ==========================================
// SCENARIO 4: Délai de Grâce et "Boudé" (P3)
// ==========================================
describe('Scénario 4 : Délai de Grâce et "Boudé" (P3)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('triggers auto-pass for DISCONNECTED player after 3.5s and sets watchdog at 6.5s', () => {
        const mockDispatch = jest.fn().mockResolvedValue(undefined);

        const mockGameState: GameState = {
            phase: 'PLAYING',
            currentPlayerId: 'p1',
            turnId: 1,
            table: { sequence: [] },
            players: [
                { id: 'p1', status: 'DISCONNECTED', hand: [{id: 'd1', left: 1, right: 1}] }
            ]
        } as any;

        const { rerender } = renderHook((state) => useAutoPass({
            gameState: state,
            dispatch: mockDispatch,
            isLocalHost: true,
            localPlayerId: 'p2',
            isPaused: false,
        }), { initialProps: mockGameState });

        // 1. Immediately, it dispatches MARK_BOUDE
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'MARK_BOUDE', playerId: 'p1', turnId: 1 });

        // Simulate state updating to reflect MARK_BOUDE
        const mockGameStateWithBoude = {
            ...mockGameState,
            boudePlayerId: 'p1',
        };
        rerender(mockGameStateWithBoude as any);

        act(() => {
            jest.advanceTimersByTime(3499);
        });
        // We shouldn't see PASS_TURN yet
        expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'PASS_TURN', playerId: 'p1' });

        // Cross the 3.5s threshold
        act(() => {
            jest.advanceTimersByTime(1);
        });
        
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'PASS_TURN', playerId: 'p1' });

        // Advance further to trigger watchdog (6.5s after boudePlayerId update)
        act(() => {
            jest.advanceTimersByTime(6500);
        });

        // Watchdog fires the fallback
        // It's called twice with PASS_TURN (once by regular timer, once by watchdog)
        const passTurnCalls = mockDispatch.mock.calls.filter(call => call[0].type === 'PASS_TURN');
        expect(passTurnCalls.length).toBe(2);
    });
});

// ==========================================
// SCENARIO 5: UI Fin de Manche et Bouton Continuer (P3)
// ==========================================
describe('Scénario 5 : UI Fin de Manche et Bouton "Continuer" (P3)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const mockOpponents = [{ id: 'p2', name: 'Bot', avatarId: '1', hand: [], status: 'BOT', isReady: true, hasPlayed: true }];
    const mockGameState: any = {
        players: [
            { id: 'p1', name: 'Me', hand: [] },
            { id: 'p2', hand: [] }
        ],
        mancheWins: 1
    };

    it('skips counting and shows Continue button ONLY to the host', () => {
        const { getByText, queryByText, rerender } = render(
            <RoundEndFlow
                gameState={mockGameState}
                visible={true}
                onDismiss={jest.fn()}
                localPlayerId="p1"
                opponents={mockOpponents as any}
                isHost={false}
            />
        );

        act(() => {
            jest.advanceTimersByTime(2000); // Advance past all timeouts
        });

        // Since it's not the host, there should be NO "Continuer" button
        expect(queryByText('Continuer')).toBeNull();

        // Rerender as host
        rerender(
            <RoundEndFlow
                gameState={mockGameState}
                visible={true}
                onDismiss={jest.fn()}
                localPlayerId="p1"
                opponents={mockOpponents as any}
                isHost={true}
            />
        );

        // Advance any remaining effects
        act(() => {
            jest.runAllTimers();
        });

        // Now the host should see the "Continuer" button
        expect(getByText('Continuer')).toBeTruthy();
    });
});
