import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPaidRechargeSaleId, getStartedSubscription } from './premiumStripeWebhook';

describe('Stripe recharge event selection', () => {
    it('accepts only a paid Checkout completion with its server sale identifier', () => {
        assert.equal(getPaidRechargeSaleId({
            id: 'evt_1',
            type: 'checkout.session.completed',
            data: { object: { payment_status: 'paid', metadata: { saleId: 'sale_123' } } },
        }), 'sale_123');
    });

    it('extracts the Stripe subscription only from a paid Checkout completion', () => {
        assert.deepEqual(getStartedSubscription({
            type: 'checkout.session.completed',
            data: { object: { payment_status: 'paid', client_reference_id: 'sale_sub', subscription: 'sub_123' } },
        }), { saleId: 'sale_sub', subscriptionId: 'sub_123' });
        assert.equal(getStartedSubscription({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
    });

    it('ignores unpaid, unrelated, and malformed events', () => {
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'invoice.paid' }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
    });
});
