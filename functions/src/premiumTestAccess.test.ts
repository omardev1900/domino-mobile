import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPremiumTestToken, passwordMatches, verifyPremiumTestToken } from './premiumTestAccess';

describe('premium test access', () => {
    it('checks the password without exposing it and issues an expiring token', () => {
        assert.equal(passwordMatches('correct', 'correct'), true);
        assert.equal(passwordMatches('incorrect', 'correct'), false);
        const token = createPremiumTestToken('signing-secret', 1_700_000_000_000);
        assert.equal(verifyPremiumTestToken(token, 'signing-secret', 1_700_000_000_001), true);
        assert.equal(verifyPremiumTestToken(token, 'wrong-secret', 1_700_000_000_001), false);
        assert.equal(verifyPremiumTestToken(token, 'signing-secret', 1_700_003_600_001), false);
    });
});
