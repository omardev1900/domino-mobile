import { shouldOfferMatchAdReward } from '../matchRewardPolicy';

describe('shouldOfferMatchAdReward', () => {
    it('autorise la recompense apres un match solo Android', () => {
        expect(shouldOfferMatchAdReward('android', true, 'MATCH_END')).toBe(true);
    });

    it('interdit toute recompense publicitaire sur le web', () => {
        expect(shouldOfferMatchAdReward('web', true, 'MATCH_END')).toBe(false);
    });

    it('ne cumule pas la recompense avec l interstitielle multijoueur', () => {
        expect(shouldOfferMatchAdReward('android', false, 'MATCH_END')).toBe(false);
    });
});
