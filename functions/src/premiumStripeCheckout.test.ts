import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPremiumSaleProduct } from './premiumSalesCatalog';
import {
    buildStripeCheckoutForm,
    isAllowedCorsOrigin,
    requireSubscriptionEmail,
} from './premiumStripeCheckout';

describe('Stripe Checkout CORS', () => {
    it('allows both production web origins and local development origins', () => {
        assert.equal(isAllowedCorsOrigin('https://domino-martinique.online'), true);
        assert.equal(isAllowedCorsOrigin('https://www.domino-martinique.online'), true);
        assert.equal(isAllowedCorsOrigin('http://localhost:5173'), true);
        assert.equal(isAllowedCorsOrigin('http://127.0.0.1:5000'), true);
    });

    it('rejects wildcard and untrusted origins', () => {
        assert.equal(isAllowedCorsOrigin('*'), false);
        assert.equal(isAllowedCorsOrigin('https://evil.example'), false);
        assert.equal(isAllowedCorsOrigin('https://domino-martinique.online.evil.example'), false);
        assert.equal(isAllowedCorsOrigin(undefined), false);
    });
});

describe('Stripe Checkout form', () => {
    it('uses server-side prices for a recharge and never a client-provided amount', () => {
        const form = buildStripeCheckoutForm(getPremiumSaleProduct('premium_recharge_7d'), 'sale_123', {});
        assert.equal(form.get('mode'), 'payment');
        assert.equal(form.get('allow_promotion_codes'), 'true');
        assert.equal(form.get('line_items[0][price_data][unit_amount]'), '399');
        assert.equal(form.get('metadata[saleId]'), 'sale_123');
        assert.equal(form.get('line_items[0][price_data][recurring][interval]'), null);
    });

    it('creates a yearly subscription with the verified account email', () => {
        const form = buildStripeCheckoutForm(
            getPremiumSaleProduct('premium_subscription_yearly'),
            'sale_456',
            { email: 'joueur@example.com' },
        );
        assert.equal(form.get('mode'), 'subscription');
        assert.equal(form.get('allow_promotion_codes'), 'true');
        assert.equal(form.get('line_items[0][price_data][recurring][interval]'), 'year');
        assert.equal(form.get('customer_email'), 'joueur@example.com');
    });

    it('requires an account email before an abonnement can start', () => {
        assert.throws(() => requireSubscriptionEmail(getPremiumSaleProduct('premium_subscription_monthly'), undefined));
        assert.equal(
            requireSubscriptionEmail(getPremiumSaleProduct('premium_subscription_monthly'), 'joueur@example.com'),
            'joueur@example.com',
        );
        assert.equal(requireSubscriptionEmail(getPremiumSaleProduct('premium_recharge_3d'), undefined), undefined);
    });
});
