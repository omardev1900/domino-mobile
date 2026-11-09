import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';

const creditSchema = z.object({
    operationId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    kind: z.enum(['DAILY', 'AD_MATCH', 'AD_STORE', 'WELCOME']),
}).strict();

const amounts = { DAILY: 200, AD_MATCH: 100, AD_STORE: 100, WELCOME: 0 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function creditCoins(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()) {
    const { operationId, kind } = creditSchema.parse(raw);
    const userRef = db.collection('users').doc(uid);
    const receiptRef = db.collection('coin_wallets').doc(uid).collection('entries').doc(operationId);
    return db.runTransaction(async tx => {
        const [userSnap, receiptSnap] = await Promise.all([tx.get(userRef), tx.get(receiptRef)]);
        const economy = userSnap.data()?.economy ?? {};
        if (receiptSnap.exists) return { credited: 0, balance: economy.coins ?? 0, duplicate: true };
        const coins = economy.coins;
        if (typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) throw new functions.https.HttpsError('failed-precondition', 'Solde indisponible.');
        if (kind === 'WELCOME' && economy.welcomeGiftClaimed) return { credited: 0, balance: coins, duplicate: true };
        if (kind === 'DAILY' && typeof economy.lastDailyRewardTimestamp === 'number' && now - economy.lastDailyRewardTimestamp < DAY_MS) {
            throw new functions.https.HttpsError('failed-precondition', 'Récompense quotidienne déjà réclamée.');
        }
        if (kind === 'AD_STORE' && typeof economy.lastStoreAdTimestamp === 'number' && now - economy.lastStoreAdTimestamp < DAY_MS) {
            throw new functions.https.HttpsError('failed-precondition', 'Bonus boutique déjà réclamé récemment.');
        }
        const credited = amounts[kind];
        const balance = coins + credited;
        const economyUpdate: Record<string, unknown> = { 'economy.coins': balance };
        if (kind === 'WELCOME') economyUpdate['economy.welcomeGiftClaimed'] = true;
        if (kind === 'DAILY') economyUpdate['economy.lastDailyRewardTimestamp'] = now;
        if (kind === 'AD_STORE') economyUpdate['economy.lastStoreAdTimestamp'] = now;
        tx.update(userRef, economyUpdate);
        tx.create(receiptRef, { amount: credited, reason: `COIN_CREDIT_${kind}`, balanceAfter: balance, createdAt: now });
        return { credited, balance, duplicate: false };
    });
}

export const createCreditCoins = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await creditCoins(db, context.auth.uid, raw); }
    catch (error) { if (error instanceof z.ZodError) throw new functions.https.HttpsError('invalid-argument', 'Crédit invalide.'); throw error; }
});
