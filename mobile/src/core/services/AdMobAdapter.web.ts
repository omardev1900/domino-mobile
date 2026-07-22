export const initializeAdMob = async () => {
    return Promise.resolve();
};

export const useRewardedAd = (id: string) => ({
    isLoaded: false,
    isClosed: false,
    isEarnedReward: false,
    load: () => {},
    show: () => {}
});

export const useInterstitialAd = (id: string) => ({
    isLoaded: false,
    isClosed: false,
    load: () => {},
    show: () => {}
});

export const useAppOpenAd = (id: string) => ({
    isLoaded: false,
    isClosed: false,
    load: () => {},
    show: () => {}
});

export const TestIds = {
    REWARDED: 'web-rewarded',
    INTERSTITIAL: 'web-interstitial',
    APP_OPEN: 'web-app-open'
};

export const AdMobIds = {
    INTERSTITIAL_LIGUE: TestIds.INTERSTITIAL,
    INTERSTITIAL_FIN_PARTIE: TestIds.INTERSTITIAL,
    REWARDED_FIN_PARTIE: TestIds.REWARDED,
    APP_OPEN: TestIds.APP_OPEN,
};
