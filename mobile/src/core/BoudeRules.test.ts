
import { determineWinnerOnBoudé } from './LogicEngine';
import { Player } from './types';

const createMockPlayer = (id: string, name: string, score: number): Player => ({
    id,
    name,
    hand: Array(score).fill({ left: 1, right: 0, isDouble: false, id: 'd' }), // Mock hand with total 'score' points
    handSize: score,
    wins: 0,
    mancheWins: 0,
    totalPoints: 0,
    isCochon: false,
    totalCochons: 0,
    status: 'HUMAN',
    currentMancheStars: 0,
    totalRoundWins: 0
});

describe('Boudé Resolution Rules', () => {
    test('Case 1: Equality between 3 players (10, 10, 10) => TIE', () => {
        const players = [
            createMockPlayer('p1', 'P1', 10),
            createMockPlayer('p2', 'P2', 10),
            createMockPlayer('p3', 'P3', 10),
        ];
        expect(determineWinnerOnBoudé(players)).toBe('TIE');
    });

    test('Case 2: Equality between 2 low players + 1 high (10, 10, 25) => TIE', () => {
        const players = [
            createMockPlayer('p1', 'P1', 10),
            createMockPlayer('p2', 'P2', 10),
            createMockPlayer('p3', 'P3', 25),
        ];
        expect(determineWinnerOnBoudé(players)).toBe('TIE');
    });

    test('Case 3: Equality between 2 high players + 1 low (20, 20, 5) => Low Wins', () => {
        const players = [
            createMockPlayer('p1', 'P1', 20),
            createMockPlayer('p2', 'P2', 20),
            createMockPlayer('p3', 'P3', 5),
        ];
        expect(determineWinnerOnBoudé(players)).toBe('p3');
    });
});
