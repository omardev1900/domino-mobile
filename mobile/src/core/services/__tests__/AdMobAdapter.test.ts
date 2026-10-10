import mobileAds, {
    useAppOpenAd as nativeUseAppOpenAd,
    useInterstitialAd as nativeUseInterstitialAd,
    useRewardedAd as nativeUseRewardedAd,
} from 'react-native-google-mobile-ads';

import {
    initializeAdMob,
    isAdMobEnabled,
    useAppOpenAd,
    useInterstitialAd,
    useRewardedAd,
} from '../AdMobAdapter';

describe('AdMobAdapter en développement', () => {
    beforeEach(() => jest.clearAllMocks());

    it('n’initialise pas le SDK publicitaire', async () => {
        expect(isAdMobEnabled).toBe(false);
        await initializeAdMob();
        expect(mobileAds).not.toHaveBeenCalled();
    });

    it.each([
        ['app-open', useAppOpenAd, nativeUseAppOpenAd],
        ['interstitielle', useInterstitialAd, nativeUseInterstitialAd],
        ['récompensée', useRewardedAd, nativeUseRewardedAd],
    ] as const)('neutralise la publicité %s tout en conservant un appel de hook stable', (_name, useAd, nativeHook) => {
        const state = useAd('test-unit-id');

        expect(nativeHook).toHaveBeenCalledWith('test-unit-id');
        expect(state.isLoaded).toBe(false);
        state.load();
        state.show();
        expect(nativeHook).toHaveBeenCalledTimes(1);
    });
});
