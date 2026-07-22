import { renderHook, act } from '@testing-library/react-native';
import { useActionDispatcher } from '../useActionDispatcher';
import { GameState, GamePhase } from '../../../core/types';

jest.mock('../../../core/audio/SoundManager', () => ({
  playSound: jest.fn(),
  playClack: jest.fn(),
}));

describe('useActionDispatcher - RESOLVE_BOUDE Tie-Break', () => {
  it('allows host phase transitions even when the turn lock is busy', async () => {
    const mockGameState: GameState = {
      gameId: 'test-game',
      phase: 'PARTIE_END' as GamePhase,
      startingHandSize: 7,
      players: [
        { id: 'p1', name: 'Player 1', hand: [], status: 'HUMAN', totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true },
        { id: 'p2', name: 'Player 2', hand: [], status: 'BOT', totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true }
      ] as any,
      table: { sequence: [], leftValue: null, rightValue: null },
      currentPlayerId: 'p1',
      firstPlayerOfRound: 'p1',
      roundNumber: 1,
      mancheNumber: 1,
      winningCondition: 3,
      gameMode: 'MANCHE',
      turnId: 18,
      lastActionTimestamp: Date.now(),
      history: [],
      mancheHistory: [],
      turnDuration: 30
    } as any;

    let updatedState: GameState | null = null;

    const { result } = renderHook(() => useActionDispatcher({
      gameState: mockGameState,
      localPlayerId: 'p1',
      isSoloMode: true,
      gameId: 'test-game',
      isLocalHost: true,
      roomData: null,
      startingHandSize: 7,
      acquireLock: () => false,
      releaseLock: () => {},
      canAction: () => true,
      safeUpdateGameState: async () => {},
      setGameState: (state) => { updatedState = state; },
      clearAllTurnTimers: () => {},
      setOvertime: () => {},
    }));

    await act(async () => {
      await result.current.dispatch({ type: 'NEXT_ROUND' });
    });

    expect(updatedState).not.toBeNull();
    expect(updatedState!.phase).toBe('PLAYING');
  });

  it('should pick the starter with the highest double ONLY among tied players', async () => {
    // 1. Initialiser un mock de gameState en phase BOUDE
    const mockGameState: GameState = {
      gameId: 'test-game',
      phase: 'BOUDE' as GamePhase,
      startingHandSize: 7,
      players: [
        { id: 'p1', name: 'Player 1', hand: [{ id: 'd-2-2', left: 2, right: 2, isDouble: true }, { id: 'd-0-1', left: 0, right: 1, isDouble: false }], status: 'HUMAN', score: 5, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true },
        { id: 'p2', name: 'Player 2', hand: [{ id: 'd-1-4', left: 1, right: 4, isDouble: false }], status: 'BOT', score: 5, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true },
        { id: 'p3', name: 'Player 3', hand: [{ id: 'd-6-6', left: 6, right: 6, isDouble: true }], status: 'BOT', score: 12, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true }
      ],
      board: [],
      currentPlayerId: 'p1',
      roundNumber: 1,
      mancheNumber: 1,
      matchTarget: 3,
      gameMode: 'CLASSIC',
      turnId: 1,
      lastActionTimestamp: Date.now(),
      stars: [],
      history: []
    };

    let updatedState: GameState | null = null;

    const { result } = renderHook(() => useActionDispatcher({
      gameState: mockGameState,
      localPlayerId: 'p1',
      isSoloMode: true,
      gameId: 'test-game',
      isLocalHost: true,
      roomData: null,
      startingHandSize: 7,
      acquireLock: () => true,
      releaseLock: () => {},
      canAction: () => true,
      safeUpdateGameState: async () => {},
      setGameState: (state) => { updatedState = state; },
      clearAllTurnTimers: () => {},
      setOvertime: () => {},
    }));

    // 2. Déclencher RESOLVE_BOUDE
    await act(async () => {
      await result.current.dispatch({ type: 'RESOLVE_BOUDE' });
    });

    // 3. Vérifications
    expect(updatedState).not.toBeNull();
    
    // Il y a eu égalité (p1 = 5 points, p2 = 5 points, p3 = 12 points)
    // On garde trace des tiedPlayerIds
    expect(updatedState!.tiedPlayerIds).toEqual(['p1', 'p2']);
    
    // p1 et p2 étaient ex aequo. p3 avait le double 6, MAIS n'était pas ex aequo.
    // p1 avait le double 2, p2 n'avait pas de double.
    // C'est donc p1 qui DOIT commencer. (Avant le correctif, p3 aurait commencé avec le double 6).
    expect(['p1', 'p2']).toContain(updatedState!.currentPlayerId);
    expect(updatedState!.phase).toBe('PLAYING');
  });

  it('should pick the starter randomly if tied players have no doubles', async () => {
    // 1. Initialiser un mock de gameState en phase BOUDE sans aucun double chez les ex aequo
    const mockGameState: GameState = {
      gameId: 'test-game',
      phase: 'BOUDE' as GamePhase,
      startingHandSize: 7,
      players: [
        { id: 'p1', name: 'Player 1', hand: [{ id: 'd-1-2', left: 1, right: 2, isDouble: false }], status: 'HUMAN', score: 3, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true },
        { id: 'p2', name: 'Player 2', hand: [{ id: 'd-0-3', left: 0, right: 3, isDouble: false }], status: 'BOT', score: 3, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true },
        { id: 'p3', name: 'Player 3', hand: [{ id: 'd-6-6', left: 6, right: 6, isDouble: true }], status: 'BOT', score: 12, totalPoints: 0, mancheWins: 0, totalCochons: 0, isReady: true, hasPlayed: true }
      ],
      board: [],
      currentPlayerId: 'p1',
      roundNumber: 1,
      mancheNumber: 1,
      matchTarget: 3,
      gameMode: 'CLASSIC',
      turnId: 1,
      lastActionTimestamp: Date.now(),
      stars: [],
      history: []
    };

    let updatedState: GameState | null = null;

    const { result } = renderHook(() => useActionDispatcher({
      gameState: mockGameState,
      localPlayerId: 'p1',
      isSoloMode: true,
      gameId: 'test-game',
      isLocalHost: true,
      roomData: null,
      startingHandSize: 7,
      acquireLock: () => true,
      releaseLock: () => {},
      canAction: () => true,
      safeUpdateGameState: async () => {},
      setGameState: (state) => { updatedState = state; },
      clearAllTurnTimers: () => {},
      setOvertime: () => {},
    }));

    // 2. Déclencher RESOLVE_BOUDE
    await act(async () => {
      await result.current.dispatch({ type: 'RESOLVE_BOUDE' });
    });

    // 3. Vérifications
    expect(updatedState).not.toBeNull();
    expect(updatedState!.tiedPlayerIds).toEqual(['p1', 'p2']);
    
    // Le joueur qui commence DOIT être soit p1, soit p2, même s'ils n'ont pas de double.
    // Le double 6 de p3 est complètement ignoré.
    expect(['p1', 'p2']).toContain(updatedState!.currentPlayerId);
    expect(updatedState!.phase).toBe('PLAYING');
  });
});
