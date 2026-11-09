import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { settleRoomBuyIn } from './multiplayerBuyIn';

describe('mises multijoueur serveur', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'multiplayer-buyin-test');
        db = app.firestore();
        await db.collection('users').doc('multi-player').set({ economy: { coins: 300 } });
        await db.collection('rooms').doc('room-1').set({ status: 'WAITING', buyIn: 100, players: [{ uid: 'multi-player' }] });
    });
    after(async () => app.delete());

    it('ne débite qu’une fois sous concurrence et rembourse une seule fois', async () => {
        const results = await Promise.all([
            settleRoomBuyIn(db, 'multi-player', 'room-1', 'debit', 1700000000000),
            settleRoomBuyIn(db, 'multi-player', 'room-1', 'debit', 1700000000000),
        ]);
        assert.equal(results.every(result => result.ok), true);
        assert.equal((await db.collection('users').doc('multi-player').get()).data()?.economy.coins, 200);

        const refunds = await Promise.all([
            settleRoomBuyIn(db, 'multi-player', 'room-1', 'refund', 1700000000000),
            settleRoomBuyIn(db, 'multi-player', 'room-1', 'refund', 1700000000000),
        ]);
        assert.equal(refunds.every(result => result.ok), true);
        assert.equal((await db.collection('users').doc('multi-player').get()).data()?.economy.coins, 300);
    });
});
