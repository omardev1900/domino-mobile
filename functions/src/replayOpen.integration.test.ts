import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { chargeCurrentReplay, openReplay } from './replayOpen';

describe('ouverture de replay avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'replay-open-test';
    const now = 1_700_000_000_000;

    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-open-integration');
        db = app.firestore();
        await Promise.all([
            db.collection('users').doc(uid).set({ economy: { coins: 4000, xp: 42 } }),
            db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            db.collection('replay_libraries').doc(uid).collection('slots').doc('match').set({ frames: ['initial', 'final'] }),
        ]);
    });
    after(async () => app.delete());

    it('refuse un ancien prix sans débiter le joueur', async () => {
        await assert.rejects(chargeCurrentReplay(db, uid, { matchId: 'solo-match', requestId: 'old-price', acceptedCost: 1000 }, now), /prix du replay a changé/);
        await assert.rejects(chargeCurrentReplay(db, uid, { matchId: 'solo-match', requestId: 'old-client' }, now), /prix du replay a changé/);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 4000);
    });

    it('débite une seule fois pour deux tentatives concurrentes de la même ouverture', async () => {
        const input = { replayId: 'match', requestId: 'attempt-one', acceptedCost: 2000 };
        const result = await Promise.all([openReplay(db, uid, input, now), openReplay(db, uid, input, now)]);
        assert.deepEqual(result[0], result[1]);
        assert.equal(result[0].remainingCoins, 2000);
        assert.deepEqual(result[0].replay.frames, ['initial', 'final']);
        const user = (await db.collection('users').doc(uid).get()).data();
        assert.equal(user?.economy.coins, 2000);
        assert.equal(user?.economy.xp, 42);
    });

    it('débite à nouveau pour une nouvelle ouverture et refuse un solde insuffisant', async () => {
        const result = await openReplay(db, uid, { replayId: 'match', requestId: 'attempt-two', acceptedCost: 2000 }, now);
        assert.equal(result.remainingCoins, 0);
        await assert.rejects(openReplay(db, uid, { replayId: 'match', requestId: 'attempt-three', acceptedCost: 2000 }, now), /Solde insuffisant/);
    });

    it('refuse les accès sans Premium et après expiration, même pour une ancienne demande', async () => {
        await assert.rejects(openReplay(db, uid, { replayId: 'match', requestId: 'attempt-one', acceptedCost: 2000 }, now + 10001), /Premium/);
        await assert.rejects(openReplay(db, 'not-premium', { replayId: 'match', requestId: 'attempt-four' }, now), /Premium/);
    });

    it('débite le replay de fin de partie une seule fois en cas de nouvelle tentative', async () => {
        await db.collection('users').doc(uid).update({ 'economy.coins': 2500 });
        const request = { matchId: 'solo-match', requestId: 'current-attempt', acceptedCost: 2000 };
        const results = await Promise.all([chargeCurrentReplay(db, uid, request, now), chargeCurrentReplay(db, uid, request, now)]);
        assert.deepEqual(results, [{ remainingCoins: 500 }, { remainingCoins: 500 }]);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 500);
        await assert.rejects(chargeCurrentReplay(db, uid, { ...request, requestId: 'another-opening' }, now), /Solde insuffisant/);
    });
});
