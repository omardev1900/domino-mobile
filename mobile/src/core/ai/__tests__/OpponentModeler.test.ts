import { getExposurePenalty, OpponentProfiles } from '../OpponentModeler';

function makeProfiles(): OpponentProfiles {
    return new Map([
        ['critical', {
            playerId: 'critical',
            excludedValues: new Set<number>([1]),
            likelyTiles: ['2-6', '3-6', '5-5'],
            handSize: 1,
            playsDoubleFirst: false,
            playsHeavyFirst: false,
            dangerLevel: 'CRITICAL',
            movesObserved: 4,
        }],
        ['safe', {
            playerId: 'safe',
            excludedValues: new Set<number>([4, 6]),
            likelyTiles: ['0-1', '1-3'],
            handSize: 5,
            playsDoubleFirst: false,
            playsHeavyFirst: false,
            dangerLevel: 'LOW',
            movesObserved: 3,
        }],
    ]);
}

describe('OpponentModeler', () => {
    it('augmente fortement la penalite quand une sortie probable est offerte a un adversaire critique', () => {
        const profiles = makeProfiles();

        const risky = getExposurePenalty(profiles, 6, 4);
        const safer = getExposurePenalty(profiles, 1, 4);

        expect(risky).toBeGreaterThan(0.15);
        expect(safer).toBeLessThanOrEqual(risky);
    });
});
