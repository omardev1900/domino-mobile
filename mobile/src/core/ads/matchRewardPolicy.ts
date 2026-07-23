import { GamePhase } from '../types';

export function shouldOfferMatchAdReward(
    platform: string,
    isSoloMode: boolean,
    phase: GamePhase | null
): boolean {
    return platform !== 'web' && isSoloMode && phase === 'MATCH_END';
}
