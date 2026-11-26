import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { purchaseStoreItem } from './storePurchase';

describe('achats boutique serveur', () => {
    let app: admin.app.App; let db: admin.firestore.Firestore;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'store-purchase-test'); db = app.firestore();
        await db.collection('store_catalog').doc('pack_test').set({ type: 'CURRENCY_PACK', priceDiamonds: 10, rewards: { coins: 1500 } });
        await db.collection('users').doc('store-player').set({ economy: { coins: 100, diamonds: 20 } });
    });
    after(async () => app.delete());
    it('débite les diamants et crédite les coins une seule fois', async () => {
        const results = await Promise.all([
            purchaseStoreItem(db, 'store-player', { itemId: 'pack_test', requestId: 'purchase-one' }),
            purchaseStoreItem(db, 'store-player', { itemId: 'pack_test', requestId: 'purchase-one' }),
        ]);
        assert.deepEqual(results, [
            { success: true, itemId: 'pack_test', coins: 1600, diamonds: 10 },
            { success: true, itemId: 'pack_test', coins: 1600, diamonds: 10 },
        ]);
        const economy = (await db.collection('users').doc('store-player').get()).data()?.economy;
        assert.equal(economy.coins, 1600);
        assert.equal(economy.diamonds, 10);
        assert.equal((await db.collection('coin_wallets').doc('store-player').collection('entries').where('reason', '==', 'STORE_PURCHASE').get()).size, 1);
    });

    for (const [uid, itemId, requestId] of [
        ['avatar-buyer', 'avatar_Le Stratège des Vents', 'store_1795700000000_test'],
        ['legacy-avatar-buyer', "avatar_L'Ancien", "store_avatar_L'Ancien_1795700000000_test"],
    ]) {
        it(`achète ${itemId} et traite un nouvel envoi sans deuxième débit`, async () => {
            const user = db.collection('users').doc(uid);
            await db.collection('store_catalog').doc(itemId).set({ type: 'AVATAR', priceCoins: 50 });
            await user.set({ economy: { coins: 100 } });

            const result = await purchaseStoreItem(db, uid, { itemId, requestId });
            const retry = await purchaseStoreItem(db, uid, { itemId, requestId });
            const player = (await user.get()).data();

            assert.equal(result?.success, true);
            assert.deepEqual(retry, result);
            assert.equal(player?.economy.coins, 50);
            assert.deepEqual(player?.inventory.ownedItems, [itemId]);
        });
    }

    it('refuse les chemins Firestore à la place des identifiants', async () => {
        await assert.rejects(purchaseStoreItem(db, 'store-player', {
            itemId: 'avatar/nested/item', requestId: 'valid-request',
        }), { name: 'ZodError' });
    });
});
