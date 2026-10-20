import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { verifyStripeWebhookSignature } from './stripeWebhookSignature';

const now = 1_700_000_000_000;
const rawBody = Buffer.from('{"id":"evt_123","type":"checkout.session.completed"}');
const secret = 'whsec_test_secret';
const timestamp = Math.floor(now / 1_000);
const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');

describe('Stripe webhook signature', () => {
    it('accepts a current Stripe-compatible v1 signature', () => {
        assert.equal(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, secret, now), true);
    });

    it('rejects altered payloads, expired timestamps and unknown signatures', () => {
        assert.equal(verifyStripeWebhookSignature(Buffer.from('{}'), `t=${timestamp},v1=${signature}`, secret, now), false);
        assert.equal(verifyStripeWebhookSignature(rawBody, `t=${timestamp - 301},v1=${signature}`, secret, now), false);
        assert.equal(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=bad`, secret, now), false);
    });
});
