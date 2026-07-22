import { GameState, Player, Domino } from '../../core/types';
import { dealGameSolo, handleTurn, passTurn, resolveBoude, computeNextRoundState, determineFirstPlayer } from '../../core/LogicEngine';
import { computeBotDecision } from '../../core/BotEngine';
import { LogService } from '../../core/services/LogService';

// Désactiver les logs console pendant les tests de stress pour éviter le spam, sauf en cas d'erreur
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    LogService.info = jest.fn();
    LogService.warn = jest.fn();
    LogService.error = jest.fn();
    LogService.transition = jest.fn();
    LogService.event = jest.fn();
});

afterAll(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
});

const simulateMatch = (mode: 'VICTOIRE' | 'SCORE' | 'MANCHE' | 'COCHON', condition: number) => {
    // Initialiser une partie Solo (1 humain, 2 bots par défaut)
    const partialState = dealGameSolo('p1', 'Player 1', 'avatar1', 'MAPIPI');
    const players = (partialState.players as Player[]).map(p => ({ 
        ...p, 
        status: 'DISCONNECTED' as const, 
        difficulty: 'MAPIPI' as const 
    }));
    const firstPlayerId = determineFirstPlayer(players);

    let state: GameState = {
        gameId: 'stress-' + Date.now(),
        players: players,
        talonMort: partialState.talonMort as Domino[],
        table: partialState.table!,
        currentPlayerId: firstPlayerId,
        phase: 'PLAYING',
        firstPlayerOfRound: null,
        history: [],
        winningCondition: condition,
        gameMode: mode,
        turnDuration: 15,
        lastActionTimestamp: Date.now(),
        turnId: 0,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7
    };

    let turnsCount = 0;
    const MAX_TURNS = 2000;

    while (state.phase !== 'MATCH_END' && turnsCount < MAX_TURNS) {
        turnsCount++;
        
        if (state.phase === 'PLAYING') {
            const currentPlayerId = state.currentPlayerId;
            if (!currentPlayerId) throw new Error("PLAYING phase but no currentPlayerId");

            const decision = computeBotDecision(state, currentPlayerId);

            if (decision) {
                state = handleTurn(state, currentPlayerId, decision.tile, decision.side === 'start' ? undefined : decision.side);
            } else {
                state = passTurn(state, currentPlayerId);
            }
        } else if (state.phase === 'BOUDE') {
            const { newState, isTie, tiedPlayerIds } = resolveBoude(state);
            if (isTie) {
                const nextTieCount = (newState.reDealCount || 0) + 1;
                const stateForRedeal = {
                    ...newState,
                    phase: 'PARTIE_END' as const,
                    reDealCount: nextTieCount,
                    tiedPlayerIds
                };
                state = { ...computeNextRoundState(stateForRedeal, 7), tiedPlayerIds };
            } else {
                state = newState;
            }
        } else if (state.phase === 'PARTIE_END' || state.phase === 'MANCHE_END') {
            state = computeNextRoundState(state, 7);
        } else {
            throw new Error(`Unhandled phase: ${state.phase}`);
        }
    }

    return { finalState: state, turnsCount };
};

describe('SYS-STRESS-TESTS : Simulation Mathématique de la Boucle de Jeu', () => {

    const testConfigs = [
        { mode: 'VICTOIRE', condition: 1 },
        { mode: 'VICTOIRE', condition: 3 },
        { mode: 'SCORE', condition: 5 },
        { mode: 'SCORE', condition: 10 },
        { mode: 'MANCHE', condition: 1 },
        { mode: 'MANCHE', condition: 3 },
        { mode: 'COCHON', condition: 1 },
        { mode: 'COCHON', condition: 3 },
    ] as const;

    const MATCHES_PER_CONFIG = 50;

    testConfigs.forEach(config => {
        test(`Simule ${MATCHES_PER_CONFIG} matchs sans blocage - Mode: ${config.mode}, Objectif: ${config.condition}`, () => {
            for (let i = 0; i < MATCHES_PER_CONFIG; i++) {
                const { finalState, turnsCount } = simulateMatch(config.mode, config.condition);
                
                // Si la boucle s'est arrêtée au MAX_TURNS, c'est une boucle infinie ou un blocage
                if (turnsCount >= 2000) {
                    originalError(`BLOCAGE DETECTE: Match #${i} en mode ${config.mode} (condition: ${config.condition})`);
                    originalError(`Phase finale: ${finalState.phase}`);
                    originalError(JSON.stringify(finalState, null, 2));
                }

                expect(turnsCount).toBeLessThan(2000);
                expect(finalState.phase).toBe('MATCH_END');
            }
        });
    });
});
