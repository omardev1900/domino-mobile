import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStripePortalForm } from './premiumStripePortal';

describe('Stripe customer portal form', () => {
    it('uses the server-owned Stripe customer and a safe return URL', () => {
        const form = buildStripePortalForm('cus_123');
        assert.equal(form.get('customer'), 'cus_123');
        assert.equal(form.get('return_url'), 'https://www.domino-martinique.online/premium');
    });
});
