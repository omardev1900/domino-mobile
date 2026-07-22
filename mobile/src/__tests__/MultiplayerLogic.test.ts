import { handleEndOfRound, determineWinnerOnBoudé } from '../core/LogicEngine';
import { GameState, Player, GameMode, Domino } from '../core/types';
import { createBaseGameState } from '../hooks/game/__tests__/testUtils';

// Mock helper to create a basic state
const createMockState = (mode: GameMode, condition: number): GameState => {
    return createBaseGameState({
        players: [
            { id: 'p1', name: 'Player 1', hand: [], handSize: 0, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 },
            { id: 'p2', name: 'Player 2', hand: [], handSize: 0, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 },
            { id: 'p3', name: 'Player 3', hand: [], handSize: 0, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 }
        ],
        currentPlayerId: 'p1',
        firstPlayerOfRound: 'p1',
        gameMode: mode,
        winningCondition: condition,
    });
};

describe('Multiplayer Game Logic & Rules Verification', () => {

    describe('Scoring & Game Modes', () => {

        test('Mode MANCHE: Match ends at correct winningCondition (mancheWins)', () => {
            const state = createMockState('MANCHE', 3);
            state.players[0].mancheWins = 2; // P1 needs 1 more manche
            state.players[0].currentMancheStars = 2;       // P1 needs 1 more round win to finish the manche
            state.mancheHistory = [{}, {}] as any; // Trigger MATCH_END after 3rd manche is recorded

            // P1 wins the final round of the manche
            const newState = handleEndOfRound(state, 'p1');

            expect(newState.players[0].mancheWins).toBe(3);
            expect(newState.phase).toBe('MATCH_END');
            expect(newState.mancheResult).toBe('COCHON'); // Assuming others had 0 wins (default in mock)
        });

        test('Mode SCORE: Points accumulate and trigger Match End', () => {
            const state = createMockState('SCORE', 100);
            state.players[0].totalPoints = 98; // 96 + 2 stars from before
            state.players[0].currentMancheStars = 2;
            // P2 and P3 have 0 stars, so P1 will get 1 pt (round) + 2 pts (cochon bonus) = 3 total points gained.
            // 98 + 3 = 101.

            const newState = handleEndOfRound(state, 'p1');

            expect(newState.players[0].totalPoints).toBe(101);
            expect(newState.phase).toBe('MATCH_END');
        });

        test('Mode COCHON: only winner infliges cochons and triggers Match End', () => {
            const state = createMockState('COCHON', 2);
            state.players[0].totalCochonsInfliges = 1; // P1 already inflicted 1 cochon
            state.players[0].totalCochons = 1; // Legacy alias kept aligned for old screens
            state.players[0].currentMancheStars = 2;
            state.players[1].currentMancheStars = 0; // P2 about to be cochon again
            state.players[2].currentMancheStars = 1;

            const newState = handleEndOfRound(state, 'p1');

            expect(newState.players[0].totalCochonsInfliges).toBe(2);
            expect(newState.players[1].totalCochons).toBe(0);
            expect(newState.players[1].totalCochonsSubis).toBe(1);
            expect(newState.phase).toBe('MATCH_END');
        });

    });

    describe('Martinique Rules (Chiré, Cochon, 3-Round Rule)', () => {

        test('CHIRE: Occurs when everyone has at least one win', () => {
            const state = createMockState('MANCHE', 3);
            state.players[0].currentMancheStars = 2;
            state.players[1].currentMancheStars = 1;
            state.players[2].currentMancheStars = 1;

            // P1 wins, triggering end of manche (reaches 3)
            const newState = handleEndOfRound(state, 'p1');

            expect(newState.mancheResult).toBe('CHIRE');
            expect(newState.players[0].totalPoints).toBe(1); // 0 + 1 point for the chire-triggering round win
            expect(newState.phase).toBe('MANCHE_END');
        });

        test('COCHON Rule: Only applies if total rounds >= 3', () => {
            const state = createMockState('MANCHE', 3);
            state.players[0].currentMancheStars = 2;
            state.players[0].totalPoints = 2;
            state.players[1].currentMancheStars = 0;
            state.players[2].currentMancheStars = 0;

            // P1 wins, reaching 3 round wins. Total wins = 3.
            const newState = handleEndOfRound(state, 'p1');

            expect(newState.mancheResult).toBe('COCHON');
            expect(newState.players[0].totalPoints).toBe(5); // 2 cochons = 5 points
            expect(newState.players[1].isCochon).toBe(true);
            expect(newState.players[2].isCochon).toBe(true);
        });

        test('COCHON Rule: Does NOT apply if total rounds < 3', () => {
            const state = createMockState('MANCHE', 3);
            state.players[0].currentMancheStars = 5; // Simulating logic jump if threshold was higher
            state.players[1].currentMancheStars = 0;
            state.players[2].currentMancheStars = 0;

            // Wait, if wins=3 it triggers. Let's test a case where manche ends by "force" or different threshold.
            // If total wins is 2, it shouldn't be COCHON yet.
            const state2 = createMockState('MANCHE', 3);
            state2.players[0].currentMancheStars = 1;
            state2.players[1].currentMancheStars = 0;
            state2.players[2].currentMancheStars = 0;

            // P1 wins, total wins becomes 2. Manche threshold is 3, so manche doesn't end.
            const newState = handleEndOfRound(state2, 'p1');
            expect(newState.phase).toBe('PARTIE_END');
            expect(newState.mancheResult).toBeNull(); // Should be null as per my fix
        });

        test('Cochon Points: 1 Cochon = 4 points, 2 Cochons = 5 points', () => {
            // Case 1: 1 Cochon
            const state1 = createMockState('SCORE', 100);
            state1.players[0].currentMancheStars = 2;
            state1.players[0].totalPoints = 2;
            state1.players[1].currentMancheStars = 1; // Not cochon
            state1.players[2].currentMancheStars = 0; // Cochon
            state1.players[1].totalPoints = 1;
            const ns1 = handleEndOfRound(state1, 'p1');
            expect(ns1.players[0].totalPoints).toBe(4);

            // Case 2: 2 Cochons
            const state2 = createMockState('SCORE', 100);
            state2.players[0].currentMancheStars = 2;
            state2.players[0].totalPoints = 2;
            state2.players[1].currentMancheStars = 0; // Cochon
            state2.players[2].currentMancheStars = 0; // Cochon
            const ns2 = handleEndOfRound(state2, 'p1');
            expect(ns2.players[0].totalPoints).toBe(5);
        });

    });

    describe('Blocking & Tie Scenarios (Boudé)', () => {

        test('BOUDE: Enters phase when TIE is reported', () => {
            const state = createMockState('MANCHE', 3);
            const newState = handleEndOfRound(state, 'TIE');

            expect(newState.phase).toBe('BOUDE');
        });

        test('BOUDE Result: Winner is player with minimum points in hand', () => {
            const players: Player[] = [
                { id: 'p1', name: '', hand: [{ id: '1', left: 1, right: 1, sum: 2, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 },
                { id: 'p2', name: '', hand: [{ id: '2', left: 6, right: 6, sum: 12, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 },
                { id: 'p3', name: '', hand: [{ id: '3', left: 5, right: 5, sum: 10, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 }
            ];

            const winnerId = determineWinnerOnBoudé(players);
            expect(winnerId).toBe('p1');
        });

        test('BOUDE Result: TIE occurs if two players have same minimum points', () => {
            const players: Player[] = [
                { id: 'p1', name: '', hand: [{ id: '1', left: 1, right: 1, sum: 2, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 },
                { id: 'p2', name: '', hand: [{ id: '2', left: 1, right: 1, sum: 2, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 }, // Same as p1
                { id: 'p3', name: '', hand: [{ id: '3', left: 6, right: 6, sum: 12, isDouble: true }], wins: 0, handSize: 1, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0 }
            ];

            const winnerId = determineWinnerOnBoudé(players);
            expect(winnerId).toBe('TIE');
        });

    });

    describe('Firebase Sync Readiness (No undefined fields)', () => {

        test('GameState should never contain undefined even after round transitions', () => {
            const state = createMockState('MANCHE', 3);

            // Round win
            const ns1 = handleEndOfRound(state, 'p1');
            expect(ns1.mancheResult).not.toBeUndefined();

            // If we manually stringify/parse (like LogicEngine does for deep copy) it should remain clean
            const stringified = JSON.stringify(ns1);
            expect(stringified).not.toContain('undefined');
            expect(stringified).toContain('"mancheResult":null');
        });

    });

});
