import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { settleMatchBuyIn } from './coinBuyIn';
import { creditCoins } from './coinCredits';
import { NEW_PLAYER_COINS } from './core/economy.constants';

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

    it('initialise le solde du nouveau joueur une seule fois', async () => {
        const newUid = 'welcome-new-player';
        const user = db.collection('users').doc(newUid);
        await user.set({ displayName: 'Nouveau', stats: { gamesPlayed: 0 }, economy: { xp: 0, welcomeGiftClaimed: false } });
        const responses = await Promise.all([
            creditCoins(db, newUid, { operationId: 'welcome-first', kind: 'WELCOME' }, now),
            creditCoins(db, newUid, { operationId: 'welcome-second', kind: 'WELCOME' }, now),
        ]);
        assert.deepEqual(responses.map(result => result.credited).sort(), [0, NEW_PLAYER_COINS]);
        assert.deepEqual((await user.get()).data()?.economy, { xp: 0, coins: NEW_PLAYER_COINS, welcomeGiftClaimed: true });
        const ledger = db.collection('coin_wallets').doc(newUid).collection('entries');
        assert.equal((await ledger.get()).size, 1);

        const firstMatch = await settleMatchBuyIn(db, newUid, 'solo_welcome_first_match', 'debit', now);
        assert.deepEqual(firstMatch, { ok: true, balance: 200, paidAmount: 100, duplicate: false });
    });

    it('conserve le solde si le joueur était déjà crédité', async () => {
        const existingUid = 'welcome-existing-player';
        const user = db.collection('users').doc(existingUid);
        await user.set({ economy: { coins: 42 } });
        const result = await creditCoins(db, existingUid, { operationId: 'welcome-existing', kind: 'WELCOME' }, now);
        assert.equal(result.credited, 0);
        assert.deepEqual((await user.get()).data()?.economy, { coins: 42, welcomeGiftClaimed: true });
    });

    it('ne recharge pas un compte déjà crédité dont le solde est retombé à zéro', async () => {
        const uid = 'welcome-spent';
        const user = db.collection('users').doc(uid);
        const economy = { coins: 0, welcomeGiftClaimed: true };
        await user.set({ economy });
        const result = await creditCoins(db, uid, { operationId: 'welcome-spent', kind: 'WELCOME' }, now);
        assert.deepEqual(result, { credited: 0, balance: 0, duplicate: true });
        assert.deepEqual((await user.get()).data()?.economy, economy);
    });

    it('signale un reçu de bienvenue dont le solde est manquant', async () => {
        const uid = 'welcome-missing-balance';
        const user = db.collection('users').doc(uid);
        await user.set({ economy: { welcomeGiftClaimed: true } });
        await db.collection('coin_wallets').doc(uid).collection('entries').doc(`welcome_${uid}`).set({
            amount: NEW_PLAYER_COINS, reason: 'COIN_CREDIT_WELCOME', balanceAfter: NEW_PLAYER_COINS,
        });
        await assert.rejects(
            creditCoins(db, uid, { operationId: 'welcome-missing', kind: 'WELCOME' }, now),
            { code: 'failed-precondition' }
        );
        assert.deepEqual((await user.get()).data()?.economy, { welcomeGiftClaimed: true });
    });
});
