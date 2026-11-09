import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { applyCoinOperation } from './coinLedger';

describe('opérations de coins atomiques', () => {
    let app: admin.app.App; let db: admin.firestore.Firestore;
    const uid = 'coin-ledger-simulation'; const now = 1700000000000;
    before(async () => { app = admin.initializeApp({ projectId: 'demo-domino' }, 'coin-ledger-simulation'); db = app.firestore(); await db.collection('users').doc(uid).set({ economy: { coins: 5000 } }); });
    after(async () => app.delete());
    it('applique simultanément une récompense et un débit sans perdre de mouvement', async () => {
        const [debit, credit] = await Promise.all([
            applyCoinOperation(db, { uid, operationId: 'replay', amount: -2000, reason: 'REPLAY_PURCHASE', now }),
            applyCoinOperation(db, { uid, operationId: 'reward', amount: 250, reason: 'MATCH_REWARD', now }),
        ]);
        assert.equal(debit.ok, true); assert.equal(credit.ok, true);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 3250);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').get()).size, 2);
    });
    it('ne double pas un débit répété après une réponse perdue', async () => {
        const op = { uid, operationId: 'slot', amount: -3000, reason: 'SLOT_PURCHASE', now };
        const [a, b] = await Promise.all([applyCoinOperation(db, op), applyCoinOperation(db, op)]);
        assert.equal(a.ok && b.ok, true);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 250);
        assert.equal((await applyCoinOperation(db, { ...op, amount: -1000 })).ok, false);
    });
    it('refuse les découverts et ne crée aucune écriture', async () => {
        assert.deepEqual(await applyCoinOperation(db, { uid, operationId: 'insufficient', amount: -300, reason: 'BUY_IN', now }), { ok: false, reason: 'INSUFFICIENT_COINS' });
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').doc('insufficient').get()).exists, false);
    });
    it('démontre que les anciennes écritures de solde doivent encore être bloquées', async () => {
        const legacyUid = 'coin-ledger-legacy-simulation';
        const ref = db.collection('users').doc(legacyUid);
        await ref.set({ economy: { coins: 5000 } });
        await applyCoinOperation(db, { uid: legacyUid, operationId: 'debit', amount: -3000, reason: 'SLOT_RENEWAL', now });
        await ref.update({ 'economy.coins': 5000 });
        assert.equal((await ref.get()).data()?.economy.coins, 5000);
    });
});
