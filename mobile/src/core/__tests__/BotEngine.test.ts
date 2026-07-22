import { getBotMove } from '../BotEngine';
import { handleTurn } from '../LogicEngine';
import { Domino, Player, GameState, DominoSide } from '../types';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

describe('BotEngine', () => {
    it('should return a valid move if one exists', () => {
        const hand: Domino[] = [
            { id: '1', left: 1, right: 2, isDouble: false } as Domino,
            { id: '2', left: 5, right: 5, isDouble: true } as Domino
        ];
        // Table matches 1 or 6
        const move = getBotMove(hand, 1, 6);
        expect(move).not.toBeNull();
        expect(move?.tile.id).toBe('1');
    });

    it('should return null if no moves', () => {
        const hand: Domino[] = [
            { id: '1', left: 3, right: 3, isDouble: true } as Domino
        ];
        // Table matches 1 or 6
        const move = getBotMove(hand, 1, 6);
        expect(move).toBeNull();
    });
});

describe('LogicEngine Advanced', () => {
    it('handleTurn should update table and current player', () => {
        const p1: Player = {
            id: 'p1', name: 'Player 1', hand: [
                { id: 'd1', left: 6, right: 6, isDouble: true } as Domino,
                { id: 'd2', left: 1, right: 1, isDouble: true } as Domino
            ], handSize: 2, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'HUMAN'
        };
        const p2: Player = { id: 'p2', name: 'Player 2', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'BOT' };
        const p3: Player = { id: 'p3', name: 'Player 3', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'BOT' };

        let state: GameState = createBaseGameState({
            gameId: 'g1',
            players: [p1, p2, p3],
            history: [],
            currentPlayerId: 'p1',
            firstPlayerOfRound: 'p1',
            lastActionTimestamp: 0,
        });

        const domino = p1.hand[0];
        const newState = handleTurn(state, 'p1', domino);

        expect(newState.table.sequence).toHaveLength(1);
        expect(newState.table.leftValue).toBe(6);
        expect(newState.table.rightValue).toBe(6);
        expect(newState.currentPlayerId).toBe('p2'); // Rotated
        expect(newState.players[0].hand).toHaveLength(1); // One card removed, one remains
        expect(newState.lastActionTimestamp).toBeGreaterThan(0);
    });
});
