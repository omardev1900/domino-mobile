import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useTurnManager } from '../useTurnManager';
import { useActionDispatcher } from '../useActionDispatcher';
import { useBotDecision } from '../useBotDecision';
import { createBaseGameState } from './testUtils';
import { GameState } from '../../../core/types';

// Mock du LogicEngine pour le scénario 1 et éviter la vraie logique complexe pendant les tests de Lock
jest.mock('../../../core/LogicEngine', () => {
    const original = jest.requireActual('../../../core/LogicEngine');
    return {
        ...original,
        handleTurn: jest.fn((state, playerId) => ({
            ...state,
            history: [],
            currentPlayerId: 'p2',
            turnId: state.turnId + 1
        })),
    };
});

describe('Integration Architecture', () => {
    let mockSafeUpdateGameState: jest.Mock;

    beforeEach(() => {
        mockSafeUpdateGameState = jest.fn().mockResolvedValue(undefined);
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const createIntegrationHook = (initialState: GameState) => {
        return renderHook(() => {
            const [gameState, setGameState] = useState<GameState | null>(initialState);

            // 1. Turn Manager
            const turnManager = useTurnManager({ gameState });

            // 2. Action Dispatcher
            const { dispatch } = useActionDispatcher({
                gameState,
                localPlayerId: 'p1',
                isSoloMode: false,
                gameId: 'game-123',
                isLocalHost: true,
                roomData: { createdBy: 'p1' } as any,
                startingHandSize: 7,
                acquireLock: turnManager.acquireLock,
                releaseLock: turnManager.releaseLock,
                canAction: turnManager.canAction,
                safeUpdateGameState: mockSafeUpdateGameState,
                setGameState,
                clearAllTurnTimers: jest.fn(),
                setOvertime: jest.fn(),
                onTilePlayed: jest.fn()
            });

            // 3. Bot Decision
            useBotDecision({
                gameState,
                roomData: { createdBy: 'p1' } as any,
                localPlayerId: 'p1', // local = l'hôte p1, c'est lui qui héberge le bot
                isSoloMode: false,
                isPaused: false,
                isLocalHost: true,
                canAction: turnManager.canAction,
                dispatch
            });

            return { gameState, setGameState, turnManager, dispatch };
        });
    };

    it('Scenario 1: Le Cycle du Verrou (Lock Cycle)', async () => {
        const initialState = createBaseGameState({
            currentPlayerId: 'p1',
            players: [{ id: 'p1', hand: [{ id: 'd-1', left: 1, right: 1 }] }] as any
        });

        const { result } = createIntegrationHook(initialState);

        // Simule un update asynchrone lent pour Firebase (safeUpdateGameState)
        let resolveUpdate: any;
        mockSafeUpdateGameState.mockImplementationOnce(() => new Promise(r => { resolveUpdate = r; }));

        expect(result.current.turnManager.isProcessingMove.current).toBe(false);

        // Appel direct du Dispatcher
        await act(async () => {
            const dispatchPromise = result.current.dispatch({
                type: 'PLAY_TILE',
                playerId: 'p1',
                tile: { id: 'd-1', left: 1, right: 1 } as any,
                side: 'start'
            });

            // PENDANT L'AWAIT Firebase, le verrou DOIT être actif
            expect(result.current.turnManager.isProcessingMove.current).toBe(true);

            // On débloque Firebase
            resolveUpdate();
            await dispatchPromise;
        });

        // APRES le update, le verrou DOIT être relâché (grâce au finally)
        expect(result.current.turnManager.isProcessingMove.current).toBe(false);
    });

    it('Scenario 2: Immunité Anti-Cascade', () => {
        const initialState = createBaseGameState({ turnId: 1, currentPlayerId: 'p2' });
        const { result } = createIntegrationHook(initialState);

        // Tout de suite après le montage, le state n'a pas 5 secondes
        const canTimeoutNow = result.current.turnManager.canAction('p2', true); // isTimeoutAction = true
        expect(canTimeoutNow).toBe(false); // Bloqué par TURN_IMMUNITY_MS (5000)

        // On avance le temps de 4.9 secondes
        act(() => {
            jest.advanceTimersByTime(4900);
        });
        expect(result.current.turnManager.canAction('p2', true)).toBe(false);

        // On avance à 5.1 secondes => l'immunité lève l'interdiction de timeout
        act(() => {
            jest.advanceTimersByTime(200);
        });
        expect(result.current.turnManager.canAction('p2', true)).toBe(true);
    });

    it('Scenario 3: Le Réveil du Bot (Bot Awakening)', () => {
        const initialState = createBaseGameState({
            currentPlayerId: 'bot-1', // C'est au bot de jouer
            turnId: 42,
            players: [
                { id: 'p1', status: 'HUMAN', hand: [] },
                { id: 'bot-1', status: 'BOT', difficulty: 'medium', hand: [] }
            ] as any
        });

        const { result } = createIntegrationHook(initialState);

        // On mock le timeout ou getBotMove (dispatch sera appelé). 
        // L'useBotDecision a un timeout aléatoire (généralement entre 100 et 1500) quand TURN_IMMUNITY_MS ou isBotDelay est écoulé.
        // Puisque canAction pour les bots utilise canAction normal + l'appel BotAction ne demande pas isTimeout.

        // useBotDecision lance un timer autonome (setTimeout -> handleDecision) 
        // On donne jusqu'à 2000ms au "réveil du bot" standard
        act(() => {
            jest.advanceTimersByTime(2000);
        });

        // Comme dispatch appelle safeUpdateGameState, on vérifie cet appel 
        // (plus robuste qu'un spyDispatch qui a pu rater la référence capturée dans useBotDecision)
        expect(mockSafeUpdateGameState).toHaveBeenCalled();
        
        // On peut même vérifier qu'il s'agit bien d'une action PASS_TURN (puisque la main est vide)
        // en vérifiant l'état qui a été sauvegardé.
    });
});
