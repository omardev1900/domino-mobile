import mobileAds, { useRewardedAd as _useRewardedAd, useInterstitialAd as _useInterstitialAd, useAppOpenAd as _useAppOpenAd, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const isDev = __DEV__;

// Les publicités, même de test, ne doivent pas interrompre les parcours de
// développement. Elles restent actives dans les builds de production natives.
export const isAdMobEnabled = !isDev && Platform.OS !== 'web';

const createDisabledAdState = () => ({
    isLoaded: false, isOpened: false, isClosed: false, isClicked: false,
    isShowing: false, isEarnedReward: false, error: undefined,
    reward: undefined, revenue: undefined, load: () => {}, show: () => {},
});

export const AdMobIds = {
    INTERSTITIAL_LIGUE: isDev ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_LIGUE_ID || TestIds.INTERSTITIAL),
    INTERSTITIAL_FIN_PARTIE: isDev ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_FIN_ID || TestIds.INTERSTITIAL),
    REWARDED_FIN_PARTIE: isDev ? TestIds.REWARDED : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_FIN_ID || TestIds.REWARDED),
    APP_OPEN: isDev ? TestIds.APP_OPEN : (process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_ID || TestIds.APP_OPEN),
};

export const initializeAdMob = async () => {
    if (!isAdMobEnabled) return Promise.resolve();
    return mobileAds().initialize();
};

export const useAppOpenAd = (adUnitId: string) => {
    const ad = _useAppOpenAd(adUnitId);
    return isAdMobEnabled ? ad : createDisabledAdState();
};

export const useInterstitialAd = (adUnitId: string) => {
    const ad = _useInterstitialAd(adUnitId);
    return isAdMobEnabled ? ad : createDisabledAdState();
};

export const useRewardedAd = (adUnitId: string) => {
    const ad = _useRewardedAd(adUnitId);
    return isAdMobEnabled ? ad : createDisabledAdState();
};

export { TestIds };
