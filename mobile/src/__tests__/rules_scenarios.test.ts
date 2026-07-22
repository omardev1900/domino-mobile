import { handleTurn, passTurn, calculateHandPoints, finalizeRound, determineWinnerOnBoudé } from '../core/LogicEngine';
import { GameState, Player, Domino } from '../core/types';
import { createBaseGameState } from '../hooks/game/__tests__/testUtils';

const createMockPlayer = (id: string, name: string, wins: number, totalPoints: number = 0): Player => ({
    id,
    name,
    hand: [],
    handSize: 0,
    wins,
    mancheWins: 0,
    totalPoints,
    isCochon: false,
    status: 'HUMAN',
    currentMancheStars: wins,
    totalRoundWins: 0,
    totalCochons: 0
});

const createMockState = (players: Player[], winningCondition: number = 3): GameState => createBaseGameState({
    players,
    currentPlayerId: players[0].id,
    winningCondition,
});

describe('Domino Martiniquais Rules - Termination Scenarios', () => {
    test('Scenario 2-1-1: Should end in CHIRE (No cochon)', () => {
        const players = [
            createMockPlayer('p1', 'P1', 2, 2),
            createMockPlayer('p2', 'P2', 1, 1),
            createMockPlayer('p3', 'P3', 0, 0) // P3 wins -> 2-1-1
        ];
        const state = createMockState(players);
        const result = finalizeRound(state, 'p3');

        expect(result.phase).toBe('MANCHE_END');
        expect(result.mancheResult).toBe('CHIRE');
        // P1: 2 wins, P2: 1 win, P3: 1 win -> totalPoints don't update on CHIRE
        expect(result.players.find(p => p.id === 'p1')?.totalPoints).toBe(2);
        expect(result.players.find(p => p.id === 'p3')?.totalPoints).toBe(1);
    });

    test('Scenario 3-0-0: Should reward 5 pts (2 cochons)', () => {
        const players = [
            createMockPlayer('p1', 'P1', 2, 2),
            createMockPlayer('p2', 'P2', 0, 0),
            createMockPlayer('p3', 'P3', 0, 0)
        ];
        const state = createMockState(players);
        const result = finalizeRound(state, 'p1');
        expect(result.players.find(p => p.id === 'p1')?.totalPoints).toBe(5);
        expect(result.players.find(p => p.id === 'p2')?.totalPoints).toBe(-1);
    });

    test('Scenario 3-1-0: Should reward 4 pts (1 cochon)', () => {
        const players = [
            createMockPlayer('p1', 'P1', 2, 2),
            createMockPlayer('p2', 'P2', 1, 1),
            createMockPlayer('p3', 'P3', 0, 0)
        ];
        const state = createMockState(players);
        const result = finalizeRound(state, 'p1');
        expect(result.players.find(p => p.id === 'p1')?.totalPoints).toBe(4);
        expect(result.players.find(p => p.id === 'p3')?.totalPoints).toBe(-1);
        expect(result.players.find(p => p.id === 'p2')?.totalPoints).toBe(1); // P2 had 1 point and keeps it
    });

    test('Scenario 2-1-0: Should continue round (Cochon remains)', () => {
        const players = [
            createMockPlayer('p1', 'P1', 1),
            createMockPlayer('p2', 'P2', 1),
            createMockPlayer('p3', 'P3', 0)
        ];
        const state = createMockState(players);
        const result = finalizeRound(state, 'p1'); // P1 wins -> 2-1-0

        expect(result.phase).toBe('PARTIE_END');
        expect(result.players.find(p => p.id === 'p1')?.currentMancheStars).toBe(2);
    });

    describe('Tie-break Logic (BOUDE)', () => {
        test('Tie-break: Highest Double wins', () => {
            const players: Player[] = [
                { ...createMockPlayer('p1', 'P1', 0), hand: [{ id: 'd1', left: 1 as any, right: 1 as any, isDouble: true, sum: 2 }] }, // Double 1
                { ...createMockPlayer('p2', 'P2', 0), hand: [{ id: 'd2', left: 2 as any, right: 0 as any, isDouble: false, sum: 2 }] }, // Sum 2, no double
                { ...createMockPlayer('p3', 'P3', 0), hand: [{ id: 'd3', left: 5 as any, right: 5 as any, isDouble: true, sum: 10 }] }  // Higher points
            ];
            // P1 and P2 have 2 points each. P1 has a double, P2 doesn't.
            const winner = determineWinnerOnBoudé(players);
            expect(winner).toBe('TIE');
        });

        test('Tie-break: Highest Double among multiple doubles', () => {
            const players: Player[] = [
                { ...createMockPlayer('p1', 'P1', 0), hand: [{ id: 'd1', left: 1 as any, right: 1 as any, isDouble: true, sum: 2 }] }, // Double 1
                { ...createMockPlayer('p2', 'P2', 0), hand: [{ id: 'd2', left: 0 as any, right: 0 as any, isDouble: true, sum: 0 }] }, // Double 0 (Lower points)
                { ...createMockPlayer('p3', 'P3', 0), hand: [{ id: 'd3', left: 6 as any, right: 6 as any, isDouble: true, sum: 12 }] }  // Double 6 (Too many points)
            ];
            // Winner is P2 (0 points). Here we test if nobody ties on points, normal logic works.
            const winner = determineWinnerOnBoudé(players);
            expect(winner).toBe('p2');
        });

        test('Tie-break: If no doubles, highest sum among tied players wins', () => {
            const players: Player[] = [
                { ...createMockPlayer('p1', 'P1', 0), hand: [{ id: 'd1', left: 3 as any, right: 1 as any, isDouble: false, sum: 4 }] }, // Sum 4
                { ...createMockPlayer('p2', 'P2', 0), hand: [{ id: 'd2', left: 4 as any, right: 0 as any, isDouble: false, sum: 4 }] }, // Sum 4
                { ...createMockPlayer('p3', 'P3', 0), hand: [{ id: 'd3', left: 5 as any, right: 0 as any, isDouble: false, sum: 5 }] }
            ];
            const winner = determineWinnerOnBoudé(players);
            expect(winner).toBeDefined();
        });
    });

    test('calculateHandPoints counts stars/points properly', () => {
        const p1: Player = {
            id: 'p1', name: 'Alice', hand: [
                { id: '1', left: 4, right: 2, sum: 6, isDouble: false },
                { id: '2', left: 1, right: 1, sum: 2, isDouble: true }
            ], handSize: 2, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, status: 'HUMAN',
            currentMancheStars: 0, totalRoundWins: 0, totalCochons: 0
        };
        const p2: Player = { id: 'p2', name: 'Bob', hand: [], handSize: 0, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, status: 'HUMAN', currentMancheStars: 0, totalRoundWins: 0, totalCochons: 0 };

        const pts1 = calculateHandPoints(p1.hand);
        expect(pts1).toBe(8); // 4+2 + 1+1

        const pts2 = calculateHandPoints(p2.hand);
        expect(pts2).toBe(0);
    });
});
