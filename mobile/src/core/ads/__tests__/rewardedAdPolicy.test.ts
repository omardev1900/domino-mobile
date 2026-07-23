import { classifyRewardedAdError } from '../rewardedAdPolicy';

describe('classifyRewardedAdError', () => {
    it.each([
        'googleMobileAds/no-fill',
        'googleMobileAds/mediation-no-fill',
        'googleMobileAds/error-code-no-fill',
    ])('reconnait le no-fill AdMob %s', code => {
        expect(classifyRewardedAdError({ code })).toBe('NO_FILL');
    });

    it('ne confond pas une panne reseau avec un no-fill', () => {
        expect(classifyRewardedAdError({ code: 'googleMobileAds/network-error' })).toBe('NETWORK');
    });

    it('signale une configuration invalide', () => {
        expect(classifyRewardedAdError({ code: 'googleMobileAds/invalid-request' })).toBe('CONFIGURATION');
    });

    it('conserve une categorie neutre pour une erreur inconnue', () => {
        expect(classifyRewardedAdError(new Error('unexpected'))).toBe('UNKNOWN');
    });
});
