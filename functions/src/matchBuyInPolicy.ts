import { MINIMUM_COIN_RESERVE } from './core/economy.constants';

export function resolveMatchBuyIn(balance: number, amount: number, isPremium: boolean) {
    if (!Number.isSafeInteger(balance) || balance < 0) return null;
    if (amount === 0 || balance - amount >= MINIMUM_COIN_RESERVE) {
        return { balanceAfter: balance - amount, paidAmount: amount };
    }
    if (!isPremium) return null;
    return { balanceAfter: Math.max(balance, MINIMUM_COIN_RESERVE), paidAmount: 0 };
}
