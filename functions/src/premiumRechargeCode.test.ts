import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStripeCheckoutSessionId } from './premiumRechargeCode';

describe('Stripe Checkout session identifier', () => {
    it('accepts valid test and live Checkout session identifiers only', () => {
        assert.equal(isStripeCheckoutSessionId('cs_test_A1b2C3'), true);
        assert.equal(isStripeCheckoutSessionId('cs_live_A1b2C3'), true);
        assert.equal(isStripeCheckoutSessionId('pi_test_A1b2C3'), false);
        assert.equal(isStripeCheckoutSessionId('../../secret'), false);
    });
});
