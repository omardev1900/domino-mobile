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
        assert.equal(results.every(result => result?.success === true), true);
        const economy = (await db.collection('users').doc('store-player').get()).data()?.economy;
        assert.equal(economy.coins, 1600);
        assert.equal(economy.diamonds, 10);
        assert.equal((await db.collection('coin_wallets').doc('store-player').collection('entries').where('reason', '==', 'STORE_PURCHASE').get()).size, 1);
    });
});
