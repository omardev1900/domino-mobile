import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBrevoRechargeEmail } from './premiumBrevoEmail';

describe('Brevo recharge email', () => {
    it('contains the deterministic code and the purchased offer details', () => {
        const email = buildBrevoRechargeEmail('joueur@example.com', 'DM-ABCD-EF12-3456', 'premium_recharge_7d');
        assert.equal(email.to[0].email, 'joueur@example.com');
        assert.match(email.htmlContent, /DM-ABCD-EF12-3456/);
        assert.match(email.textContent, /7 jours Premium et 700 coins/);
    });
});
