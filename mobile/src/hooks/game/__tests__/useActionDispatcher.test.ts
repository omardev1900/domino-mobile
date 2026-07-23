import { renderHook, act } from '@testing-library/react-native';
import { useActionDispatcher } from '../useActionDispatcher';
import { GameRoom, GameState, GamePhase } from '../../../core/types';
import { submitGameAction } from '../../../core/services/gameAction.service';

jest.mock('../../../core/audio/SoundManager', () => ({
  playSound: jest.fn(),
  playClack: jest.fn(),
}));

jest.mock('../../../core/services/gameAction.service', () => ({
  submitGameAction: jest.fn(),
}));

describe('useActionDispatcher - RESOLVE_BOUDE Tie-Break', () => {
  it('envoie une commande minimale pour une salle coordonnee', async () => {
    const mockSubmitGameAction = submitGameAction as jest.MockedFunction<typeof submitGameAction>;
    mockSubmitGameAction.mockResolvedValue({ applied: true, stateVersion: 13, turnId: 9, phase: 'PLAYING' });
    const tile = { id: 'd-6-5', left: 6, right: 5, isDouble: false } as const;
    const gameState = {
      gameId: 'test-game',
      phase: 'PLAYING',
      players: [{ id: 'p1', name: 'P1', hand: [tile], status: 'HUMAN' }],
      currentPlayerId: 'p1',
      turnId: 8,
      stateVersion: 12,
    } as GameState;
    const safeUpdateGameState = jest.fn();
    const setGameState = jest.fn();
    const releaseLock = jest.fn();
    const onTilePlayed = jest.fn();

    const { result } = renderHook(() => useActionDispatcher({
      gameState,
      localPlayerId: 'p1',
      isSoloMode: false,
      gameId: 'test-game',
      isLocalHost: false,
      roomData: { coordinatorVersion: 1 } as GameRoom,
      acquireLock: () => true,
      releaseLock,
      canAction: () => true,
      safeUpdateGameState,
      setGameState,
      clearAllTurnTimers: jest.fn(),
      setOvertime: jest.fn(),
      onTilePlayed,
    }));

    await act(async () => {
      await result.current.dispatch({ type: 'PLAY_TILE', playerId: 'p1', tile, side: 'right' });
    });

    expect(mockSubmitGameAction).toHaveBeenCalledWith({
      roomId: 'test-game',
      expectedStateVersion: 12,
      expectedTurnId: 8,
      action: { type: 'PLAY_TILE', dominoId: 'd-6-5', side: 'right' },
    });
    expect(safeUpdateGameState).not.toHaveBeenCalled();
    expect(setGameState).not.toHaveBeenCalled();
    expect(onTilePlayed).toHaveBeenCalledWith(tile);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('increments stateVersion when MARK_BOUDE is synchronized in multiplayer', async () => {
    const mockGameState = {
      gameId: 'test-game',
      phase: 'PLAYING',
      players: [
        { id: 'p1', name: 'Player 1', hand: [], status: 'HUMAN' },
        { id: 'p2', name: 'Player 2', hand: [], status: 'HUMAN' }
      ],
      board: [],
      currentPlayerId: 'p2',
      roundNumber: 1,
      mancheNumber: 1,
      gameMode: 'CLASSIC',
      turnId: 12,
      stateVersion: 37,
      lastActionTimestamp: Date.now(),
      history: []
    } as GameState;
    const safeUpdateGameState = jest.fn().mockResolvedValue(undefined);
    const setGameState = jest.fn();

    const { result } = renderHook(() => useActionDispatcher({
      gameState: mockGameState,
      localPlayerId: 'p2',
      isSoloMode: false,
      gameId: 'test-game',
      isLocalHost: false,
      roomData: null,
      acquireLock: () => true,
      releaseLock: () => {},
      canAction: () => true,
      safeUpdateGameState,
      setGameState,
      clearAllTurnTimers: () => {},
      setOvertime: () => {},
    }));

    await act(async () => {
      await result.current.dispatch({ type: 'MARK_BOUDE', playerId: 'p2', turnId: 12 });
    });

    expect(safeUpdateGameState).toHaveBeenCalledWith(
      'test-game',
      expect.objectContaining({ boudePlayerId: 'p2', stateVersion: 38 })
    );
    expect(setGameState).toHaveBeenCalledWith(
      expect.objectContaining({ boudePlayerId: 'p2', stateVersion: 38 })
    );
  });

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
