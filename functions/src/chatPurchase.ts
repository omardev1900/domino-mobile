import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';

const requestSchema = z.object({
    itemId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
}).strict();

type ChatInventory = Record<string, { remaining: number }>;

export async function purchaseChatItem(
    db: admin.firestore.Firestore,
    uid: string,
    raw: unknown,
    now = Date.now(),
) {
    const { itemId, requestId } = requestSchema.parse(raw);
    const itemRef = db.collection('chat_messages').doc(itemId);
    const userRef = db.collection('users').doc(uid);
    const receiptRef = db.collection('chat_purchase_receipts').doc(uid).collection('requests').doc(requestId);
    const ledgerRef = db.collection('coin_wallets').doc(uid).collection('entries').doc(`chat_${requestId}`);
    const entitlementRef = db.collection('premium_entitlements').doc(uid);

    return db.runTransaction(async tx => {
        const [itemSnap, userSnap, receiptSnap, entitlementSnap] = await Promise.all([
            tx.get(itemRef),
            tx.get(userRef),
            tx.get(receiptRef),
            tx.get(entitlementRef),
        ]);

        if (receiptSnap.exists) return receiptSnap.data();
        if (!itemSnap.exists || itemSnap.data()?.enabled !== true || itemSnap.data()?.costType !== 'coins') {
            throw new functions.https.HttpsError('failed-precondition', 'Article de tchat indisponible.');
        }

        const item = itemSnap.data() ?? {};
        if (item.access === 'PREMIUM_ONLY' && !isActivePremiumEntitlement(entitlementSnap.data(), now)) {
            throw new functions.https.HttpsError('permission-denied', 'Article réservé aux abonnés Premium.');
        }

        const cost = item.costAmount;
        const usages = item.usagesPerPurchase ?? 0;
        if (!Number.isSafeInteger(cost) || cost < 0 || !Number.isSafeInteger(usages) || usages < 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Tarif de tchat invalide.');
        }

        const economy = userSnap.data()?.economy ?? {};
        const coins = economy.coins;
        if (!Number.isSafeInteger(coins) || coins < cost) {
            throw new functions.https.HttpsError('failed-precondition', 'Coins insuffisants.');
        }

        const unlockedChatItems = Array.isArray(economy.unlockedChatItems)
            ? [...new Set(economy.unlockedChatItems.filter((value: unknown): value is string => typeof value === 'string'))]
            : [];
        const chatInventory: ChatInventory = economy.chatInventory && typeof economy.chatInventory === 'object'
            ? { ...economy.chatInventory }
            : {};
        const nextCoins = coins - cost;

        if (usages === 0) {
            if (unlockedChatItems.includes(itemId)) {
                throw new functions.https.HttpsError('already-exists', 'Article déjà débloqué.');
            }
            unlockedChatItems.push(itemId);
        } else {
            const current = chatInventory[itemId]?.remaining;
            chatInventory[itemId] = { remaining: (Number.isSafeInteger(current) ? current : 0) + usages };
        }

        const result = {
            balance: nextCoins,
            unlockedChatItems,
            chatInventory,
            itemId,
            alreadyPurchased: false,
        };
        tx.update(userRef, {
            'economy.coins': nextCoins,
            'economy.unlockedChatItems': unlockedChatItems,
            'economy.chatInventory': chatInventory,
        });
        tx.create(receiptRef, { ...result, createdAt: now });
        tx.create(ledgerRef, {
            amount: -cost,
            reason: 'CHAT_PURCHASE',
            itemId,
            balanceAfter: nextCoins,
            createdAt: now,
        });
        return result;
    });
}

export const createPurchaseChatItem = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        try {
            return await purchaseChatItem(db, context.auth.uid, data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new functions.https.HttpsError('invalid-argument', 'Achat de tchat invalide.');
            }
            throw error;
        }
    });
