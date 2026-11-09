import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { creditCoins } from './coinCredits';

describe('crédits hors match via ledger', () => {
    let app: admin.app.App; let db: admin.firestore.Firestore;
    const uid = 'credit-test'; const now = 1700000000000;
    before(async () => { app = admin.initializeApp({ projectId: 'demo-domino' }, 'coin-credits-test'); db = app.firestore(); await db.collection('users').doc(uid).set({ economy: { coins: 100 } }); });
    after(async () => app.delete());
    it('crédite le quotidien une fois malgré deux demandes concurrentes', async () => {
        const results = await Promise.all([
            creditCoins(db, uid, { operationId: 'daily-one', kind: 'DAILY' }, now),
            creditCoins(db, uid, { operationId: 'daily-one', kind: 'DAILY' }, now),
        ]);
        assert.equal(results.filter(result => result.credited > 0).length, 1);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 300);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').where('reason', '==', 'COIN_CREDIT_DAILY').get()).size, 1);
    });
});
