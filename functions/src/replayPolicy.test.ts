import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canSaveReplay, decideReplayOpening } from './replayPolicy';

describe('replay policy', () => {
    it('charges 2000 coins per opening and accepts the exact balance', () => {
        assert.deepEqual(decideReplayOpening(true, 2000), { allowed: true, remainingCoins: 0 });
        assert.deepEqual(decideReplayOpening(true, 2500), { allowed: true, remainingCoins: 500 });
        assert.deepEqual(decideReplayOpening(true, 1999), { allowed: false, reason: 'INSUFFICIENT_COINS' });
    });
    it('refuses non-premium users and invalid balances', () => {
        assert.deepEqual(decideReplayOpening(false, 5000), { allowed: false, reason: 'PREMIUM_REQUIRED' });
        for (const coins of [-1, 1.5, NaN, undefined, '1000']) {
            assert.deepEqual(decideReplayOpening(true, coins), { allowed: false, reason: 'INVALID_BALANCE' });
        }
    });
    it('allows free saving into the first two slots only while Premium is active', () => {
        assert.equal(canSaveReplay(true, 0), true);
        assert.equal(canSaveReplay(true, 1), true);
        assert.equal(canSaveReplay(true, 2), false);
        assert.equal(canSaveReplay(false, 1), false);
        assert.equal(canSaveReplay(true, -1), false);
    });
});
