import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { deleteReplaySlot, saveReplaySlot } from './replaySlots';

describe('slots de replay avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'replay-slots-test';
    const now = 1_700_000_000_000;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-slots-integration');
        db = app.firestore();
        const library = db.collection('replay_libraries').doc(uid);
        await Promise.all([
            library.set({ savedCount: 9 }),
            db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            ...['first', 'second'].flatMap(id => [
                db.collection('replay_candidates').doc(uid).collection('matches').doc(id).set({ frames: [id] }),
                library.collection('opening_receipts').doc(`request-${id}`).set({ replayId: id, source: 'candidate' }),
            ]),
        ]);
    });
    after(async () => app.delete());

    it('ne dépasse pas 10 slots lorsque deux sauvegardes sont simultanées', async () => {
        const attempts = await Promise.allSettled(['first', 'second'].map(id => saveReplaySlot(db, uid, { replayId: id, requestId: `request-${id}` }, now)));
        assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
        const library = db.collection('replay_libraries').doc(uid);
        assert.equal((await library.get()).data()?.savedCount, 10);
        assert.equal((await library.collection('slots').get()).size, 1);
    });

    it('libère le slot puis permet une nouvelle sauvegarde gratuite', async () => {
        const library = db.collection('replay_libraries').doc(uid);
        const saved = (await library.collection('slots').get()).docs[0].id;
        const next = saved === 'first' ? 'second' : 'first';
        assert.equal((await deleteReplaySlot(db, uid, { replayId: saved }, now)).savedCount, 9);
        assert.equal((await saveReplaySlot(db, uid, { replayId: next, requestId: `request-${next}` }, now)).savedCount, 10);
        assert.equal((await saveReplaySlot(db, uid, { replayId: next, requestId: `request-${next}` }, now)).savedCount, 10);
    });

    it('conserve les replays et refuse leur suppression après expiration Premium', async () => {
        const slot = (await db.collection('replay_libraries').doc(uid).collection('slots').get()).docs[0];
        await assert.rejects(deleteReplaySlot(db, uid, { replayId: slot.id }, now + 10001), /Premium/);
        assert.equal((await slot.ref.get()).exists, true);
    });
});
