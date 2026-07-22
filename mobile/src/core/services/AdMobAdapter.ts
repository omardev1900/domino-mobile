import mobileAds, { useRewardedAd as _useRewardedAd, useInterstitialAd as _useInterstitialAd, useAppOpenAd as _useAppOpenAd, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const isDev = __DEV__; // Utilisez false si vous testez en build dev signé

export const AdMobIds = {
    INTERSTITIAL_LIGUE: isDev ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_LIGUE_ID || TestIds.INTERSTITIAL),
    INTERSTITIAL_FIN_PARTIE: isDev ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_FIN_ID || TestIds.INTERSTITIAL),
    REWARDED_FIN_PARTIE: isDev ? TestIds.REWARDED : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_FIN_ID || TestIds.REWARDED),
    APP_OPEN: isDev ? TestIds.APP_OPEN : (process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_ID || TestIds.APP_OPEN),
};

export const initializeAdMob = async () => {
    if (Platform.OS === 'web') return Promise.resolve();
    return mobileAds().initialize();
};

export const useAppOpenAd = (adUnitId: string) => {
    if (Platform.OS === 'web' || typeof _useAppOpenAd !== 'function') {
        return { isLoaded: false, isClosed: false, load: () => {}, show: () => {} };
    }
    return _useAppOpenAd(adUnitId);
};

export const useInterstitialAd = (adUnitId: string) => {
    if (Platform.OS === 'web' || typeof _useInterstitialAd !== 'function') {
        return { isLoaded: false, isClosed: false, load: () => {}, show: () => {} };
    }
    return _useInterstitialAd(adUnitId);
};

export const useRewardedAd = (adUnitId: string) => {
    if (Platform.OS === 'web' || typeof _useRewardedAd !== 'function') {
        return { isLoaded: false, isClosed: false, isEarnedReward: false, load: () => {}, show: () => {} };
    }
    return _useRewardedAd(adUnitId);
};

export { TestIds };
