import { resolveStartingHandSize } from '../startingHandSize';
import { dealGame } from '../LogicEngine';

describe('resolveStartingHandSize', () => {
    it.each([3, 5, 7])('autorise %i dominos en développement', size => {
        expect(resolveStartingHandSize(size, true)).toBe(size);
    });

    it('utilise 3 par défaut en développement', () => {
        expect(resolveStartingHandSize(undefined, true)).toBe(3);
        expect(resolveStartingHandSize(9, true)).toBe(3);
    });

    it.each([undefined, 3, 5, 7, 9])(
        'force 7 dominos en production pour %s',
        size => {
            expect(resolveStartingHandSize(size, false)).toBe(7);
        }
    );

    it.each([3, 5, 7])('distribue réellement %i dominos par joueur', size => {
        const state = dealGame(['p1', 'p2', 'p3'], size);

        expect(state.players).toHaveLength(3);
        expect(state.players?.every(player => player.hand.length === size)).toBe(true);
        expect(state.talonMort).toHaveLength(28 - (3 * size));
        expect(state.startingHandSize).toBe(size);
    });
});
