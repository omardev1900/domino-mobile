import { handleTurn } from '../LogicEngine';
import { Domino, GameState } from '../types';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

describe('prototype de replay solo', () => {
    it('reconstruit les coups et permet de revenir à un état précédent', () => {
        const opening: Domino = { id: '6-6', left: 6, right: 6, isDouble: true };
        const next: Domino = { id: '6-3', left: 6, right: 3, isDouble: false };
        const base = createBaseGameState({ lastActionTimestamp: 0 });
        const initial: GameState = {
            ...base,
            players: [
                { ...base.players[0], hand: [opening, { id: '1-1', left: 1, right: 1, isDouble: true }], handSize: 2 },
                { ...base.players[1], hand: [next, { id: '2-2', left: 2, right: 2, isDouble: true }], handSize: 2 },
            ],
        };
        const events = [
            { playerId: 'player1', domino: opening, side: undefined, timestamp: 100 },
            { playerId: 'bot1', domino: next, side: 'right' as const, timestamp: 200 },
        ];
        const now = jest.spyOn(Date, 'now');
        try {
            const reconstruct = (count: number) => events.slice(0, count).reduce((state, event) => {
                now.mockReturnValue(event.timestamp);
                return handleTurn(state, event.playerId, event.domino, event.side);
            }, initial);

            const afterFirst = reconstruct(1);
            const afterSecond = reconstruct(2);
            expect(afterFirst.table.sequence.map(item => item.domino.id)).toEqual(['6-6']);
            expect(afterSecond.table.sequence.map(item => item.domino.id)).toEqual(['6-6', '6-3']);
            expect(afterSecond.table.rightValue).toBe(3);
            expect(afterSecond.players.map(player => player.handSize)).toEqual([1, 1]);
            expect(reconstruct(1)).toEqual(afterFirst);
            expect(initial.table.sequence).toEqual([]);
            expect(initial.players.map(player => player.handSize)).toEqual([2, 2]);
        } finally {
            now.mockRestore();
        }
    });
});
