import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { purchaseChatItem } from './chatPurchase';

describe('achats de tchat serveur', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const uid = 'chat-purchase-test';
    const now = 1_700_000_000_000;

    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'chat-purchase-test');
        db = app.firestore();
        await Promise.all([
            db.collection('users').doc(uid).set({ economy: { coins: 500, unlockedChatItems: [], chatInventory: {} } }),
            db.collection('chat_messages').doc('lifetime').set({ enabled: true, costType: 'coins', costAmount: 100, usagesPerPurchase: 0 }),
            db.collection('chat_messages').doc('consumable').set({ enabled: true, costType: 'coins', costAmount: 50, usagesPerPurchase: 3 }),
        ]);
    });

    after(async () => app.delete());

    it('débite une seule fois un achat à vie concurrent', async () => {
        const results = await Promise.all([
            purchaseChatItem(db, uid, { itemId: 'lifetime', requestId: 'purchase-one' }, now),
            purchaseChatItem(db, uid, { itemId: 'lifetime', requestId: 'purchase-one' }, now),
        ]);
        assert.equal(results[0]!.balance, 400);
        assert.equal(results[1]!.balance, 400);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 400);
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').where('reason', '==', 'CHAT_PURCHASE').get()).size, 1);
    });

    it('crédite les usages consommables côté serveur', async () => {
        const result = await purchaseChatItem(db, uid, { itemId: 'consumable', requestId: 'purchase-two' }, now);
        assert.equal(result!.balance, 350);
        assert.equal(result!.chatInventory.consumable.remaining, 3);
        assert.deepEqual((await db.collection('users').doc(uid).get()).data()?.economy.chatInventory, { consumable: { remaining: 3 } });
    });
});
