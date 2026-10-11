import { withoutUndefined } from '../withoutUndefined';

describe('withoutUndefined', () => {
    it('removes undefined profile properties without removing false, zero, or nested values', () => {
        const profile = {
            uid: 'player-2',
            leagueGrade: undefined,
            activeFrame: undefined,
            gamesPlayed: 0,
            isHost: false,
            inventory: {
                selected: undefined,
                frames: ['gold'],
            },
        };

        expect(withoutUndefined(profile)).toEqual({
            uid: 'player-2',
            gamesPlayed: 0,
            isHost: false,
            inventory: {
                frames: ['gold', undefined],
            },
        });
    });
});
