import { dealGame, handleTurn, passTurn, checkValidMove, determineFirstPlayer, computeNextRoundState, resolveBoude } from '../LogicEngine';
import { getBotMove } from '../BotEngine';
import { GameState, PlayerId, GamePhase } from '../types';
import { WINS_TO_WIN_MATCH, MAX_PLAYERS } from '../constants';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

const MAX_TURNS = 200; // Fail-safe to prevent infinite loops

describe('GameIntegration - Full Game Simulation', () => {
    let state: GameState;

    const playFullRound = () => {
        let turns = 0;

        // 1. Determine who starts
        if (state.firstPlayerOfRound) {
            state.currentPlayerId = state.firstPlayerOfRound;
        } else {
            state.currentPlayerId = determineFirstPlayer(state.players);
        }

        while (state.phase === 'PLAYING' && turns < MAX_TURNS) {
            turns++;
            const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
            if (!currentPlayer) {
                console.error(`ERROR: currentPlayerId ${state.currentPlayerId} not found in [${state.players.map(p => p.id).join(', ')}]`);
                throw new Error("currentPlayer is undefined");
            }
            // AI Logic
            const move = getBotMove(
                currentPlayer.hand,
                state.table.leftValue,
                state.table.rightValue
            );

            if (move) {
                // Play
                const forcedSide = move.side === 'start' ? undefined : move.side;
                state = handleTurn(state, currentPlayer.id, move.tile, forcedSide);
            } else {
                // Pass (using the LogicEngine passTurn directly)
                // We must catch errors because passTurn throws if player can actually play
                // But getBotMove should align with checkValidMove.
                // However, let's verify if passTurn works here.
                try {
                    state = passTurn(state, currentPlayer.id);
                } catch (e: any) {
                    // This shouldn't happen if getBotMove is correct, 
                    // unless getBotMove missed a valid move.
                    throw new Error(`Bot ${currentPlayer.id} tried to pass but had valid moves! Error: ${e.message}`);
                }
            }
        }

        if (turns >= MAX_TURNS) {
            throw new Error("Game loop exceeded max turns - infinite loop detected?");
        }
    };

    it('should simulate a full match between 3 bots without crashing', () => {
        // Init
        const partial = dealGame(['Bot1', 'Bot2', 'Bot3']);
        state = createBaseGameState({
            gameId: 'integration-test',
            players: partial.players as any,
            talonMort: partial.talonMort as any,
            table: partial.table!,
            currentPlayerId: partial.players![0].id,
            firstPlayerOfRound: partial.players![0].id,
            winningCondition: WINS_TO_WIN_MATCH,
        });

        // Mark all as bots (optional, mostly for our generic logic if we used it)
        state.players.forEach(p => p.status = 'BOT');

        // Loop until Match End
        let rounds = 0;
        const MAX_ROUNDS = 50; // Should finish before 50 rounds if win cond is 2

        while (state.phase !== 'MATCH_END' && rounds < MAX_ROUNDS) {
            rounds++;

            // Verify we are starting a round or continuing?
            // If previous phase was PARTIE_END or MANCHE_END, we need to re-deal
            if (state.phase === 'PARTIE_END' || state.phase === 'MANCHE_END' || state.phase === 'BOUDE') {
                state = computeNextRoundState(state);
            }

            playFullRound();

            // Assert round ended correctly
            expect(['PARTIE_END', 'MANCHE_END', 'MATCH_END', 'BOUDE']).toContain(state.phase);
        }

        const winner = state.players.find(p => p.totalPoints >= WINS_TO_WIN_MATCH);

        // Assertions
        expect(state.phase).toBe('MATCH_END');
        expect(winner).toBeDefined();
        // Check no pig (isCochon) logic if needed, but basic check passes.
    });

    it('should resolve a two-player BOUDE tie into a redeal with a forced opening for the correct tied player', () => {
        const d11 = { id: 'd11', left: 1, right: 1, isDouble: true };
        const d20 = { id: 'd20', left: 2, right: 0, isDouble: false };
        const d66 = { id: 'd66', left: 6, right: 6, isDouble: true };

        const boudeState = createBaseGameState({
            gameId: 'integration-boude-tie-2p',
            phase: 'BOUDE',
            gameMode: 'COCHON',
            roundNumber: 6,
            mancheNumber: 5,
            firstPlayerOfRound: null,
            currentPlayerId: 'p1',
            table: { sequence: [], leftValue: null, rightValue: null },
            history: [],
            players: [
                { id: 'p1', name: 'P1', hand: [d11 as any], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
                { id: 'p2', name: 'P2', hand: [d20 as any], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
                { id: 'p3', name: 'P3', hand: [d66 as any], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
            ],
        } as any);

        const { newState, isTie, tiedPlayerIds } = resolveBoude(boudeState);
        expect(isTie).toBe(true);
        expect(tiedPlayerIds).toEqual(['p1', 'p2']);

        const redealState = {
            ...computeNextRoundState({
            ...newState,
            phase: 'PARTIE_END',
            reDealCount: 1,
            tiedPlayerIds,
            }),
            tiedPlayerIds,
        };

        expect(redealState.phase).toBe('PLAYING');
        expect(redealState.roundNumber).toBe(7);
        expect(tiedPlayerIds).toContain(redealState.currentPlayerId);

        const forcedStarterId = redealState.currentPlayerId;
        const forcedStarter = redealState.players.find(p => p.id === forcedStarterId);
        const otherTiedId = tiedPlayerIds?.find(id => id !== forcedStarterId)!;
        const otherTiedPlayer = redealState.players.find(p => p.id === otherTiedId)!;

        forcedStarter!.hand = [
            { id: 'starter-55', left: 5, right: 5, isDouble: true } as any,
            { id: 'starter-11', left: 1, right: 1, isDouble: true } as any,
        ];
        otherTiedPlayer.hand = [{ id: 'other-33', left: 3, right: 3, isDouble: true } as any];

        expect(() => handleTurn(redealState, forcedStarterId, forcedStarter!.hand[1])).toThrow('Tie-break rule:');

        const afterOpening = handleTurn(redealState, forcedStarterId, forcedStarter!.hand[0]);
        expect(afterOpening.table.sequence).toHaveLength(1);
        expect(afterOpening.table.sequence[0].domino.id).toBe('starter-55');
    });
});
