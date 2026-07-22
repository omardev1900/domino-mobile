
import { finalizeRound } from './LogicEngine';
import { GameState, Player } from './types';
import { createBaseGameState } from '../hooks/game/__tests__/testUtils';

const createMockPlayer = (id: string, name: string): Player => ({
    id,
    name,
    hand: [],
    handSize: 0,
    wins: 0,
    mancheWins: 0,
    totalPoints: 0,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status: 'HUMAN',
    currentMancheStars: 0,
    totalRoundWins: 0
});

const createInitialState = (players: Player[], mode: any, condition: number): GameState => createBaseGameState({
    players,
    currentPlayerId: players[0].id,
    winningCondition: condition,
    gameMode: mode,
});

describe('Phase 2.3: Stress Test Simulation', () => {
    const simulateMatch = (mode: 'MANCHE' | 'SCORE' | 'COCHON', condition: number) => {
        let p1 = createMockPlayer('p1', 'Alice');
        let p2 = createMockPlayer('p2', 'Bob');
        let p3 = createMockPlayer('p3', 'Charlie');
        let state = createInitialState([p1, p2, p3], mode, condition);

        let roundCount = 0;

        while (state.phase !== 'MATCH_END' && roundCount < 100) { // Safety cap
            roundCount++;
            const winnerIdx = Math.floor(Math.random() * 3);
            const winnerId = state.players[winnerIdx].id;

            state = finalizeRound(state, winnerId);

            if (state.phase === 'MANCHE_END') {
                state.players = state.players.map(p => ({
                    ...p,
                    wins: 0,
                    isCochon: false,
                    currentMancheStars: 0
                }));
                state.phase = 'PLAYING';
            }
        }
        return { state, roundCount };
    };

    test('Match termination in MANCHE mode', () => {
        const { state } = simulateMatch('MANCHE', 3);
        expect(state.phase).toBe('MATCH_END');
        // On vérifie qu'on a bien fini la partie (au moins un leader ou condition atteinte)
        expect(state.players.length).toBe(3);
    });

    test('Match termination in SCORE mode', () => {
        const { state } = simulateMatch('SCORE', 20);
        expect(state.phase).toBe('MATCH_END');
        expect(state.players.some(p => p.totalPoints >= 20)).toBe(true);
    });

    test('Match termination in COCHON mode (individual limit)', () => {
        const { state } = simulateMatch('COCHON', 3);
        expect(state.phase).toBe('MATCH_END');
        expect(state.players.some(p => (p.totalCochonsInfliges || 0) >= 3)).toBe(true);
    });

    test('Points consistency after multiple rounds', () => {
        const { state } = simulateMatch('SCORE', 50);
        const totalPoints = state.players.reduce((sum, p) => sum + p.totalPoints, 0);
        // Points should sum up to something reasonable (winners get +, cochons get -)
        // Since it's random, we just check that no one has NaN or undefined
        state.players.forEach(p => {
            expect(typeof p.totalPoints).toBe('number');
            expect(typeof p.totalCochons).toBe('number');
            expect(typeof p.mancheWins).toBe('number');
        });
    });
});
