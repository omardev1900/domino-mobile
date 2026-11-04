import { resolveHostHandSizeIndex, resolveStartingHandSize } from '../startingHandSize';
import { dealGame } from '../LogicEngine';

describe('resolveStartingHandSize', () => {
    it.each([1, 3, 5, 7])('autorise %i dominos en développement', size => {
        expect(resolveStartingHandSize(size, true)).toBe(size);
    });

    it('utilise 3 par défaut en développement', () => {
        expect(resolveStartingHandSize(undefined, true)).toBe(3);
        expect(resolveStartingHandSize(9, true)).toBe(3);
    });

    it.each([undefined, 1, 3, 5, 7, 9])(
        'force 7 dominos en production pour %s',
        size => {
            expect(resolveStartingHandSize(size, false)).toBe(7);
        }
    );

    it.each([1, 3, 5, 7])('distribue réellement %i dominos par joueur', size => {
        const state = dealGame(['p1', 'p2', 'p3'], size);

        expect(state.players).toHaveLength(3);
        expect(state.players?.every(player => player.hand.length === size)).toBe(true);
        expect(state.talonMort).toHaveLength(28 - (3 * size));
        expect(state.startingHandSize).toBe(size);
    });
});


describe('distribution multijoueur de développement', () => {
    const players = [{ uid: 'invite' }, { uid: 'hote' }, { uid: 'autre' }];
    it('applique la taille sélectionnée à l’hôte même s’il est en deuxième position', () => {
        const index = resolveHostHandSizeIndex(true, 'hote', players, true);
        const dealt = dealGame(['Invité', 'Hôte', 'Autre'], 3, index);
        expect(dealt.players?.map(player => player.hand.length)).toEqual([7, 3, 7]);
        expect(dealt.talonMort).toHaveLength(11);
    });
    it('utilise la distribution normale si le réglage est désactivé, si l’hôte manque ou en production', () => {
        expect(resolveHostHandSizeIndex(false, 'hote', players, true)).toBeUndefined();
        expect(resolveHostHandSizeIndex(true, 'absent', players, true)).toBeUndefined();
        expect(resolveHostHandSizeIndex(true, 'hote', players, false)).toBeUndefined();
    });
});
