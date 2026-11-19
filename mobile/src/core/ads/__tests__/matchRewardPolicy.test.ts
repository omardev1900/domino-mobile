import { shouldOfferMatchAdReward, shouldShowMancheInterstitial, shouldShowLocalMatchEndInterstitial } from '../matchRewardPolicy';

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

describe('shouldShowMancheInterstitial', () => {
    it('autorise une pub solo à chaque troisième manche pour un joueur gratuit', () => {
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 3, false, true, false)).toBe(true);
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 6, false, true, false)).toBe(true);
    });

    it('n affiche pas de pub solo aux autres manches', () => {
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 2, false, true, false)).toBe(false);
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 4, false, true, false)).toBe(false);
    });

    it('exclut le Premium, le web et une pub non chargee', () => {
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 3, true, true, false)).toBe(false);
        expect(shouldShowMancheInterstitial('web', true, 'MANCHE_END', 3, false, true, false)).toBe(false);
        expect(shouldShowMancheInterstitial('android', true, 'MANCHE_END', 3, false, false, false)).toBe(false);
    });

    it('exige que tous les humains soient gratuits en multijoueur', () => {
        expect(shouldShowMancheInterstitial('android', false, 'MANCHE_END', 3, false, true, true)).toBe(true);
        expect(shouldShowMancheInterstitial('android', false, 'MANCHE_END', 3, false, true, false)).toBe(false);
    });
});

describe('shouldShowLocalMatchEndInterstitial', () => {
    it('autorise une pub avant les resultats finaux du solo gratuit', () => {
        expect(shouldShowLocalMatchEndInterstitial('android', 'MATCH_END', false, true)).toBe(true);
    });

    it('exclut Premium, le web et une pub non chargee', () => {
        expect(shouldShowLocalMatchEndInterstitial('android', 'MATCH_END', true, true)).toBe(false);
        expect(shouldShowLocalMatchEndInterstitial('web', 'MATCH_END', false, true)).toBe(false);
        expect(shouldShowLocalMatchEndInterstitial('android', 'MATCH_END', false, false)).toBe(false);
    });
});
