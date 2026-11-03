import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { savePurchasedReplay, listReplayLibrary } from './replayLibrary';
import { openReplay } from './replayOpen';
import { deleteReplaySlot } from './replaySlots';

describe('bibliothèque de replay avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'library-test-user';
    const now = 1_700_000_000_000;
    const frames = [
        { phase: 'PLAYING', stateVersion: 1, players: [{ id: 'local', name: 'Moi' }, { id: 'bot', name: 'Adversaire' }], gameMode: 'SCORE', winningCondition: 10 },
        { phase: 'MATCH_END', stateVersion: 2, players: [{ id: 'local', name: 'Moi' }, { id: 'bot', name: 'Adversaire' }], gameMode: 'SCORE', winningCondition: 10 },
    ];
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-library-test'); db = app.firestore();
        await Promise.all([
            db.collection('users').doc(uid).set({ economy: { coins: 2000 } }),
            db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            db.collection('replay_libraries').doc(uid).collection('opening_receipts').doc('paid').set({ source: 'current', replayId: 'match' }),
        ]);
    });
    after(async () => app.delete());
    it('sauvegarde gratuitement un replay ouvert et ne liste que ses métadonnées', async () => {
        const result = await savePurchasedReplay(db, uid, { requestId: 'paid', localPlayerId: 'local', frames }, now);
        assert.equal(result.savedCount, 1);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 2000);
        const listing = await listReplayLibrary(db, uid, now);
        assert.equal(listing.replays[0].id, result.replayId);
        assert.deepEqual(listing.replays[0].metadata.opponents, ['Adversaire']);
        assert.equal('frames' in listing.replays[0], false);
        assert.equal((await savePurchasedReplay(db, uid, { requestId: 'paid', localPlayerId: 'local', frames }, now)).savedCount, 1);
    });
    it('facture la nouvelle ouverture et autorise la suppression', async () => {
        const id = (await listReplayLibrary(db, uid, now)).replays[0].id;
        const opened = await openReplay(db, uid, { replayId: id, requestId: 'open-saved', acceptedCost: 2000 }, now);
        assert.equal(opened.remainingCoins, 0); assert.deepEqual(opened.replay.frames, frames);
        assert.equal((await deleteReplaySlot(db, uid, { replayId: id }, now)).savedCount, 0);
    });
    it('refuse un replay non acheté et un accès Premium expiré', async () => {
        await assert.rejects(savePurchasedReplay(db, uid, { requestId: 'unknown', localPlayerId: 'local', frames }, now), /avant de le sauvegarder/);
        await assert.rejects(listReplayLibrary(db, uid, now + 10001), /Premium/);
    });
    it('sauvegarde les données multijoueur du serveur uniquement pour un participant', async () => {
        const session = db.collection('replay_sessions').doc('library-room-session');
        await Promise.all([
            session.set({ status: 'COMPLETED', participants: [uid] }),
            session.collection('frames').doc('1').set({ version: 1, state: { ...frames[0], players: [{ id: uid, name: 'Moi' }, { id: 'bot', name: 'Adversaire' }] } }),
            session.collection('frames').doc('2').set({ version: 2, state: { ...frames[1], players: [{ id: uid, name: 'Moi' }, { id: 'bot', name: 'Adversaire' }] } }),
            db.collection('replay_libraries').doc(uid).collection('opening_receipts').doc('multi-paid').set({ source: 'multiplayer', replayId: 'library-room-session' }),
        ]);
        await assert.rejects(savePurchasedReplay(db, uid, { requestId: 'multi-paid', localPlayerId: 'bot' }, now), /inaccessible/);
        const result = await savePurchasedReplay(db, uid, { requestId: 'multi-paid', localPlayerId: uid }, now);
        const slot = await db.collection('replay_libraries').doc(uid).collection('slots').doc(result.replayId).get();
        assert.equal(slot.data()?.metadata.mode, 'MULTIPLAYER');
        assert.equal(typeof slot.data()?.framesGzip, 'string');
    });
    it('ne facture pas un replay corrompu', async () => {
        const library = db.collection('replay_libraries').doc(uid);
        await library.collection('slots').doc('corrupt').set({ framesGzip: 'pas-un-replay' });
        const before = (await db.collection('users').doc(uid).get()).data()?.economy.coins;
        await assert.rejects(openReplay(db, uid, { replayId: 'corrupt', requestId: 'bad-open' }, now), /illisible/);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, before);
    });
    it('refuse les sauvegardes concurrentes au-delà de dix emplacements', async () => {
        const otherUid = 'library-concurrency-test';
        const library = db.collection('replay_libraries').doc(otherUid);
        await Promise.all([
            library.set({ savedCount: 9 }),
            db.collection('premium_entitlements').doc(otherUid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            library.collection('opening_receipts').doc('first').set({ source: 'current', replayId: 'first-match' }),
            library.collection('opening_receipts').doc('second').set({ source: 'current', replayId: 'second-match' }),
        ]);
        const results = await Promise.allSettled(['first', 'second'].map(requestId => savePurchasedReplay(db, otherUid, { requestId, localPlayerId: 'local', frames }, now)));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
        assert.equal((await library.get()).data()?.savedCount, 10);
    });
});
