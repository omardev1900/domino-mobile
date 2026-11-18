import { GamePhase } from '../types';

export function shouldOfferMatchAdReward(
    platform: string,
    isSoloMode: boolean,
    phase: GamePhase | null
): boolean {
    return platform !== 'web' && isSoloMode && phase === 'MATCH_END';
}

export function shouldShowMancheInterstitial(
    platform: string,
    isSoloMode: boolean,
    phase: GamePhase | null,
    mancheNumber: number | null | undefined,
    hasPremium: boolean,
    isAdLoaded: boolean,
    allMultiplayerPlayersFree: boolean
): boolean {
    return platform !== 'web'
        && phase === 'MANCHE_END'
        && typeof mancheNumber === 'number'
        && mancheNumber > 0
        && mancheNumber % 3 === 0
        && !hasPremium
        && isAdLoaded
        && (isSoloMode || allMultiplayerPlayersFree);
}

export function shouldShowSoloInterstitial(
    platform: string,
    phase: GamePhase | null,
    hasPremium: boolean,
    isAdLoaded: boolean
): boolean {
    return platform !== 'web'
        && (phase === 'MANCHE_END' || phase === 'MATCH_END')
        && !hasPremium
        && isAdLoaded;
}
