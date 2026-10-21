import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPaidRechargeSaleId, getPaidSubscriptionInvoice, getStartedSubscription, getSubscriptionLifecycle } from './premiumStripeWebhook';

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
            data: { object: { id: 'cs_123', payment_status: 'paid', client_reference_id: 'sale_sub', subscription: 'sub_123', customer: 'cus_123' } },
        }), { saleId: 'sale_sub', subscriptionId: 'sub_123', sessionId: 'cs_123', customerId: 'cus_123' });
        assert.equal(getStartedSubscription({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
    });

    it('extracts a paid renewal period and converts Stripe seconds to milliseconds', () => {
        assert.deepEqual(getPaidSubscriptionInvoice({
            type: 'invoice.paid', data: { object: { id: 'in_123', subscription: 'sub_123', customer: 'cus_123', lines: { data: [{ period: { end: 1_800_000_000 } }] } } },
        }), { invoiceId: 'in_123', subscriptionId: 'sub_123', customerId: 'cus_123', periodEnd: 1_800_000_000_000 });
    });

    it('records cancellation and deletion lifecycle without granting a period', () => {
        assert.deepEqual(getSubscriptionLifecycle({
            type: 'customer.subscription.updated', data: { object: { id: 'sub_123', status: 'active', current_period_end: 1_800_000_000, cancel_at_period_end: true } },
        }), { subscriptionId: 'sub_123', status: 'active', currentPeriodEnd: 1_800_000_000_000, cancelAtPeriodEnd: true });
    });

    it('ignores unpaid, unrelated, and malformed events', () => {
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'invoice.paid' }), null);
        assert.equal(getPaidRechargeSaleId({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
    });
});
