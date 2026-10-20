import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import {
    canActivatePremiumTrial,
    hashPremiumCode,
    isActivePremiumEntitlement,
    normalizePremiumCode,
    PREMIUM_ACTIVATION_COINS,
    PREMIUM_TRIAL_DURATION_MS,
} from './premiumAccess';

const now = 1_700_000_000_000;

describe('premium access policy', () => {
    it('allows a first trial for a non-premium player', () => {
        assert.equal(canActivatePremiumTrial(undefined, now), true);
    });

    it('prevents a second trial even after the first one expires', () => {
        const expiredTrial = {
            expiresAt: admin.firestore.Timestamp.fromMillis(now - 1),
            trialUsedAt: admin.firestore.Timestamp.fromMillis(now - PREMIUM_TRIAL_DURATION_MS),
        };
        assert.equal(isActivePremiumEntitlement(expiredTrial, now), false);
        assert.equal(canActivatePremiumTrial(expiredTrial, now), false);
    });

    it('prevents a trial while another Premium access is active', () => {
        const activeGrant = {
            expiresAt: admin.firestore.Timestamp.fromMillis(now + 1),
        };
        assert.equal(isActivePremiumEntitlement(activeGrant, now), true);
        assert.equal(canActivatePremiumTrial(activeGrant, now), false);
    });
});

describe('premium code policy', () => {
    it('awards 1,000 coins for each code activation or renewal', () => {
        assert.equal(PREMIUM_ACTIVATION_COINS, 1_000);
    });

    it('normalizes a code before persisting its identifier', () => {
        assert.equal(normalizePremiumCode(' dm-ab12-cd34 '), 'DMAB12CD34');
        assert.equal(hashPremiumCode('dm-ab12-cd34'), hashPremiumCode('DMAB12CD34'));
    });
});
