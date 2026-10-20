import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { derivePaidRechargeCode, paidRechargeExpiryAt } from './premiumSalesFulfillment';

describe('paid recharge fulfillment', () => {
    it('derives one stable code per sale without persisting the plaintext code', () => {
        const first = derivePaidRechargeCode('sale_123', 'secret');
        assert.equal(first, derivePaidRechargeCode('sale_123', 'secret'));
        assert.notEqual(first, derivePaidRechargeCode('sale_456', 'secret'));
        assert.match(first, /^DM-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('sets the activation deadline three months after a paid recharge', () => {
        const now = 1_700_000_000_000;
        assert.equal(paidRechargeExpiryAt(now), now + 90 * 24 * 60 * 60 * 1_000);
    });
});
