/** Shared server-side decisions for replay access and saved slots. */
export const REPLAY_OPEN_COST = 2_000;
export const REPLAY_SLOT_LIMIT = 10;

export type ReplayAccessDecision =
    | { allowed: true; remainingCoins: number }
    | { allowed: false; reason: 'PREMIUM_REQUIRED' | 'INSUFFICIENT_COINS' | 'INVALID_BALANCE' };

export function decideReplayOpening(hasPremium: boolean, coins: unknown): ReplayAccessDecision {
    if (!hasPremium) return { allowed: false, reason: 'PREMIUM_REQUIRED' };
    if (typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) {
        return { allowed: false, reason: 'INVALID_BALANCE' };
    }
    if (coins < REPLAY_OPEN_COST) return { allowed: false, reason: 'INSUFFICIENT_COINS' };
    return { allowed: true, remainingCoins: coins - REPLAY_OPEN_COST };
}

export function canSaveReplay(hasPremium: boolean, savedCount: number): boolean {
    return hasPremium && Number.isSafeInteger(savedCount) && savedCount >= 0 && savedCount < REPLAY_SLOT_LIMIT;
}
