import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { purchaseReplay, readPurchasedReplay } from './replayPurchase';

describe('achat et sauvegarde atomiques du replay', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'replay-purchase-atomic';
    const now = 1700000000000;
    const frames = [{ phase: 'PLAYING', players: [{ id: 'local', name: 'Moi' }, { id: 'bot', name: 'Bot' }] }, { phase: 'MATCH_END', players: [{ id: 'local', name: 'Moi' }, { id: 'bot', name: 'Bot' }] }];
    const input = { source: 'current', sourceId: 'match', requestId: 'request', localPlayerId: 'local', acceptedCost: 2000, frames };
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-purchase-atomic'); db = app.firestore();
        await Promise.all([db.collection('users').doc(uid).set({ economy: { coins: 5000 } }), db.collection('premium_entitlements').doc(uid).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) })]);
    });
    after(async () => app.delete());
    it('débite une fois et sauvegarde même après une demande simultanée', async () => {
        const [a, b] = await Promise.all([purchaseReplay(db, uid, input, now), purchaseReplay(db, uid, input, now)]);
        assert.equal(a.replayId, b.replayId);
        assert.deepEqual(a.frames, frames);
        assert.deepEqual(b.frames, frames);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 3000);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').get()).size, 1);
        assert.deepEqual((await readPurchasedReplay(db, uid, { replayId: a.replayId }, now)).replay.frames, frames);
        assert.equal((await db.collection('replay_libraries').doc(uid).collection('slots').doc(a.replayId).get()).data()?.metadata.sourceId, 'match');
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 3000);
    });
    it('sauvegarde un deuxième replay, puis refuse un troisième sans débit', async () => {
        const second = await purchaseReplay(db, uid, { ...input, sourceId: 'second', requestId: 'second' }, now);
        assert.equal((await readPurchasedReplay(db, uid, { replayId: second.replayId }, now)).replay.frames.length, 2);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 1000);
        await assert.rejects(purchaseReplay(db, uid, { ...input, sourceId: 'other', requestId: 'other' }, now), /occupé/);
        await assert.rejects(purchaseReplay(db, uid, { ...input, sourceId: 'broken', requestId: 'broken', frames: [frames[0]] }, now), /complet/);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 1000);
        assert.equal((await db.collection('replay_libraries').doc(uid).collection('slots').get()).size, 2);
    });
    it('conserve le replay précédent si le remplacement échoue et le remplace seulement après paiement', async () => {
        const old = (await db.collection('replay_libraries').doc(uid).collection('slots').get()).docs[0];
        const replacement = { ...input, sourceId: 'new-match', requestId: 'new-request', replaceReplayId: old.id };
        await db.collection('users').doc(uid).update({ 'economy.coins': 1000 });
        await assert.rejects(purchaseReplay(db, uid, replacement, now), /Solde insuffisant/);
        assert.equal((await old.ref.get()).exists, true);
        await db.collection('users').doc(uid).update({ 'economy.coins': 3000 });
        const purchased = await purchaseReplay(db, uid, replacement, now);
        assert.equal((await old.ref.get()).exists, false);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 1000);
        assert.equal((await db.collection('replay_libraries').doc(uid).collection('slots').doc(purchased.replayId).get()).exists, true);
    });
    it('refuse la lecture lorsque Premium expire sans supprimer le replay', async () => {
        const replay = (await db.collection('replay_libraries').doc(uid).collection('slots').get()).docs[0];
        await assert.rejects(readPurchasedReplay(db, uid, { replayId: replay.id }, now + 10001), /Premium/);
        assert.equal((await replay.ref.get()).exists, true);
    });
    it('sauvegarde un replay multijoueur uniquement pour un participant', async () => {
        const member = 'replay-multi-member';
        const session = db.collection('replay_sessions').doc('purchase-test-room');
        const multiFrames = frames.map((frame, index) => ({ ...frame, stateVersion: index + 1, players: [{ id: member, name: 'Moi' }, { id: 'bot', name: 'Bot' }] }));
        await Promise.all([
            db.collection('users').doc(member).set({ economy: { coins: 3000 } }),
            db.collection('premium_entitlements').doc(member).set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            db.collection('premium_entitlements').doc('intruder').set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000) }),
            session.set({ status: 'COMPLETED', participants: [member] }),
            ...multiFrames.map((state, index) => session.collection('frames').doc(String(index)).set({ version: index + 1, state })),
        ]);
        const request = { source: 'multiplayer', sourceId: 'purchase-test-room', requestId: 'multi-request', localPlayerId: member, acceptedCost: 2000 };
        await assert.rejects(purchaseReplay(db, 'intruder', request, now), /inaccessible/);
        const purchased = await purchaseReplay(db, member, request, now);
        assert.equal((await db.collection('users').doc(member).get()).data()?.economy.coins, 1000);
        assert.deepEqual((await readPurchasedReplay(db, member, { replayId: purchased.replayId }, now)).replay.frames, multiFrames);
        await assert.rejects(readPurchasedReplay(db, uid, { replayId: purchased.replayId }, now), /introuvable/);
    });
});
