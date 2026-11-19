import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { AdMobIds, isAdMobEnabled, multiplayerTestAdsEnabled } from './AdMobAdapter';

let interstitial: InterstitialAd | undefined;

export function createMultiplayerInterstitial() {
    if (!isAdMobEnabled && !multiplayerTestAdsEnabled) return null;
    const ad = interstitial ??= InterstitialAd.createForAdRequest(
        multiplayerTestAdsEnabled ? TestIds.INTERSTITIAL : AdMobIds.INTERSTITIAL_FIN_PARTIE,
    );
    return {
        get loaded() { return ad.loaded; },
        load: () => ad.load(),
        show: () => ad.show(),
        subscribe(events: { opened: () => void; closed: () => void; error: (error: unknown) => void }) {
            const subscriptions = [
                ad.addAdEventListener(AdEventType.OPENED, events.opened),
                ad.addAdEventListener(AdEventType.CLOSED, events.closed),
                ad.addAdEventListener(AdEventType.ERROR, events.error),
            ];
            return () => subscriptions.forEach(unsubscribe => unsubscribe());
        },
    };
}
