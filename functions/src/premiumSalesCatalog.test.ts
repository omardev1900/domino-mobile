import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPremiumSaleProduct,
    isPremiumSaleProductId,
    PREMIUM_SALE_PRODUCTS,
} from './premiumSalesCatalog';

describe('premium sales catalog', () => {
    it('contains the five published offers with their exact prices and bonuses', () => {
        assert.deepEqual(
            PREMIUM_SALE_PRODUCTS.map(product => [product.id, product.priceCents, product.coins]),
            [
                ['premium_recharge_3d', 199, 300],
                ['premium_recharge_7d', 399, 700],
                ['premium_recharge_30d', 799, 1_000],
                ['premium_subscription_monthly', 599, 2_000],
                ['premium_subscription_yearly', 5_999, 30_000],
            ],
        );
    });

    it('distinguishes a single-use recharge from a recurring subscription', () => {
        assert.equal(getPremiumSaleProduct('premium_recharge_7d').kind, 'RECHARGE');
        assert.equal(getPremiumSaleProduct('premium_subscription_monthly').kind, 'SUBSCRIPTION');
    });

    it('rejects unlisted product identifiers', () => {
        assert.equal(isPremiumSaleProductId('premium_recharge_14d'), false);
        assert.throws(() => getPremiumSaleProduct('free_premium'));
    });
});
