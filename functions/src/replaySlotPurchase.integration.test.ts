import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { buyReplaySlot, getReplayCapacity, SLOT_PERIOD_MS } from './replaySlotPurchase';
import { purchaseReplay } from './replayPurchase';

describe('achat des emplacements replay', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'slot-purchase-test';
    const now = 1700000000000;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'slot-purchase-test'); db = app.firestore();
        await Promise.all([db.collection('users').doc(uid).set({ economy: { coins: 40000 } }), db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + SLOT_PERIOD_MS * 2) })]);
    });
    after(async () => app.delete());
    it('débite une fois, augmente la capacité et garde la date de fin', async () => {
        const input = { requestId: 'one', acceptedCost: 3000 };
        const [a, b] = await Promise.all([buyReplaySlot(db, uid, input, now), buyReplaySlot(db, uid, input, now)]);
        assert.deepEqual(a, b);
        assert.equal(a.expiresAt, now + SLOT_PERIOD_MS);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 37000);
        assert.equal((await getReplayCapacity(db, uid, now)).capacity, 2);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').get()).size, 1);
    });
    it.skip('utilise la place achetée pour sauvegarder un second replay (emplacements mensuels reportés)', async () => {
        const frames = [{ phase: 'PLAYING', players: [{ id: 'local', name: 'Moi' }] }, { phase: 'MATCH_END', players: [{ id: 'local', name: 'Moi' }] }];
        const input = { source: 'current', sourceId: 'first', requestId: 'first', localPlayerId: 'local', acceptedCost: 2000, frames };
        await purchaseReplay(db, uid, input, now);
        await purchaseReplay(db, uid, { ...input, sourceId: 'second', requestId: 'second' }, now);
        await assert.rejects(purchaseReplay(db, uid, { ...input, sourceId: 'third', requestId: 'third' }, now), /occupés/);
    });
    it('limite à dix emplacements même pour des achats concurrents', async () => {
        for (let i = 0; i < 7; i++) await buyReplaySlot(db, uid, { requestId: `extra${i}`, acceptedCost: 3000 }, now);
        const results = await Promise.allSettled(['last1', 'last2'].map(requestId => buyReplaySlot(db, uid, { requestId, acceptedCost: 3000 }, now)));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await getReplayCapacity(db, uid, now)).capacity, 10);
    });
});
