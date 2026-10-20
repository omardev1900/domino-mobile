import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPaidRechargeSaleId } from './premiumStripeWebhook';

describe('Stripe recharge event selection', () => {
    it('accepts only a paid Checkout completion with its server sale identifier', () => {
        assert.equal(getPaidRechargeSaleId({
            id: 'evt_1',
            type: 'checkout.session.completed',
            data: { object: { payment_status: 'paid', metadata: { saleId: 'sale_123' } } },
        }), 'sale_123');
    });

    it('ignores unpaid, unrelated, and malformed events', () => {
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'invoice.paid' }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
    });
});
