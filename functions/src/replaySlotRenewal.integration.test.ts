import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { renewReplaySlot } from './replaySlotRenewal';
import { SLOT_PERIOD_MS } from './replaySlotPurchase';

describe('renouvellement des emplacements', () => {
    let app: admin.app.App; let db: admin.firestore.Firestore;
    const uid = 'replay-renewal-test', now = 1700000000000;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-renewal-test'); db = app.firestore();
        await Promise.all([
            db.collection('users').doc(uid).set({ economy: { coins: 7000 } }),
            db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + SLOT_PERIOD_MS * 2) }),
            db.collection('replay_libraries').doc(uid).collection('extra_slots').doc('slot1').set({ status: 'active', expiresAt: now }),
        ]);
    });
    after(async () => app.delete());
    it('ne prélève pas tant que le solde serveur ne fait pas autorité', async () => {
        assert.equal((await renewReplaySlot(db, uid, 'slot1', now)).result, 'authority_required');
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 7000);
    });
    it('ne prélève qu’une fois pour deux traitements concurrents', async () => {
        await db.collection('users').doc(uid).update({ coinAuthority: 'server' });
        const result = await Promise.all([renewReplaySlot(db, uid, 'slot1', now), renewReplaySlot(db, uid, 'slot1', now)]);
        assert.equal(result.filter(item => item.result === 'renewed').length, 1);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 4000);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').get()).size, 1);
    });
    it('conserve la date de perte si le solde est insuffisant', async () => {
        await db.collection('users').doc(uid).update({ 'economy.coins': 1000 });
        await db.collection('replay_libraries').doc(uid).collection('extra_slots').doc('slot2').set({ status: 'active', expiresAt: now });
        assert.equal((await renewReplaySlot(db, uid, 'slot2', now)).result, 'insufficient');
        assert.equal((await db.collection('replay_libraries').doc(uid).collection('extra_slots').doc('slot2').get()).data()?.lossAt, now);
    });
});
