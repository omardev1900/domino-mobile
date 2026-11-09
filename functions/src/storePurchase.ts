import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';

const schema = z.object({ itemId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), requestId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/) }).strict();

export async function purchaseStoreItem(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()) {
    const { itemId, requestId } = schema.parse(raw);
    const userRef = db.collection('users').doc(uid);
    const itemRef = db.collection('store_catalog').doc(itemId);
    const receiptRef = db.collection('store_purchase_receipts').doc(`${uid}_${requestId}`);
    const ledgerRef = db.collection('coin_wallets').doc(uid).collection('entries').doc(`store_${requestId}`);
    const entitlementRef = db.collection('premium_entitlements').doc(uid);
    return db.runTransaction(async tx => {
        const [itemSnap, userSnap, receiptSnap, entitlementSnap] = await Promise.all([tx.get(itemRef), tx.get(userRef), tx.get(receiptRef), tx.get(entitlementRef)]);
        if (receiptSnap.exists) return receiptSnap.data();
        if (!itemSnap.exists) throw new functions.https.HttpsError('not-found', 'Article introuvable.');
        const item = itemSnap.data() ?? {};
        if (item.isPremium === true && !isActivePremiumEntitlement(entitlementSnap.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Article réservé au Premium.');
        const economy = userSnap.data()?.economy ?? {};
        const coins = typeof economy.coins === 'number' ? economy.coins : 0;
        const diamonds = typeof economy.diamonds === 'number' ? economy.diamonds : 0;
        const priceCoins = Number.isSafeInteger(item.priceCoins) ? item.priceCoins : 0;
        const priceDiamonds = Number.isSafeInteger(item.priceDiamonds) ? item.priceDiamonds : 0;
        const rewardCoins = Number.isSafeInteger(item.rewards?.coins) ? item.rewards.coins : 0;
        const rewardDiamonds = Number.isSafeInteger(item.rewards?.diamonds) ? item.rewards.diamonds : 0;
        if (coins < priceCoins || diamonds < priceDiamonds) throw new functions.https.HttpsError('failed-precondition', 'Fonds insuffisants.');
        const nextCoins = coins - priceCoins + rewardCoins;
        const nextDiamonds = diamonds - priceDiamonds + rewardDiamonds;
        const inventory = userSnap.data()?.inventory ?? { ownedItems: [], equipped: { avatar: 'avatar_classic', skin: 'skin_classic' } };
        const ownedItems = Array.isArray(inventory.ownedItems) ? inventory.ownedItems : [];
        if (item.type !== 'CURRENCY_PACK' && ownedItems.includes(itemId)) throw new functions.https.HttpsError('already-exists', 'Article déjà possédé.');
        const nextInventory = item.type === 'CURRENCY_PACK' ? inventory : { ...inventory, ownedItems: [...new Set([...ownedItems, itemId])] };
        tx.set(userRef, { economy: { ...economy, coins: nextCoins, diamonds: nextDiamonds }, inventory: nextInventory }, { merge: true });
        tx.create(receiptRef, { success: true, itemId, balanceAfter: nextCoins, diamondsAfter: nextDiamonds, createdAt: now });
        if (priceCoins || rewardCoins) tx.create(ledgerRef, { amount: rewardCoins - priceCoins, reason: 'STORE_PURCHASE', itemId, balanceAfter: nextCoins, createdAt: now });
        return { success: true, coins: nextCoins, diamonds: nextDiamonds, itemId };
    });
}

export const createPurchaseStoreItem = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await purchaseStoreItem(db, context.auth.uid, raw); }
    catch (error) { if (error instanceof z.ZodError) throw new functions.https.HttpsError('invalid-argument', 'Achat invalide.'); throw error; }
});
