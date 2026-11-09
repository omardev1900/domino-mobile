import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';

export const EXTRA_SLOT_COST = 3000;
export const SLOT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const requestSchema = z.object({ requestId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), acceptedCost: z.literal(EXTRA_SLOT_COST) }).strict();

export async function buyReplaySlot(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()) {
    const { requestId } = requestSchema.parse(raw);
    const lib = db.collection('replay_libraries').doc(uid);
    const slots = lib.collection('extra_slots');
    const receipt = lib.collection('slot_purchase_receipts').doc(requestId);
    const premium = db.collection('premium_entitlements').doc(uid);
    const user = db.collection('users').doc(uid);
    const ledger = db.collection('coin_wallets').doc(uid).collection('entries').doc(`slot_${requestId}`);
    return db.runTransaction(async tx => {
        const [libSnap, receiptSnap, premiumSnap, userSnap, slotSnaps] = await Promise.all([tx.get(lib), tx.get(receipt), tx.get(premium), tx.get(user), tx.get(slots)]);
        if (!isActivePremiumEntitlement(premiumSnap.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        if (receiptSnap.exists) return receiptSnap.data()!;
        const active = slotSnaps.docs.filter(doc => typeof doc.data().expiresAt === 'number' && doc.data().expiresAt > now);
        if (active.length >= 9) throw new functions.https.HttpsError('resource-exhausted', 'Tu as atteint la limite de 10 emplacements.');
        const coins: unknown = userSnap.data()?.economy?.coins;
        if (typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) throw new functions.https.HttpsError('failed-precondition', 'Solde indisponible.');
        if (coins < EXTRA_SLOT_COST) throw new functions.https.HttpsError('failed-precondition', 'Solde insuffisant : 3 000 coins sont nécessaires.');
        const slot = slots.doc(requestId);
        const result = { slotId: slot.id, expiresAt: now + SLOT_PERIOD_MS, remainingCoins: coins - EXTRA_SLOT_COST, capacity: 2 + active.length };
        tx.update(user, { 'economy.coins': result.remainingCoins });
        tx.create(slot, { purchasedAt: now, expiresAt: result.expiresAt, status: 'active' });
        tx.create(receipt, result);
        tx.create(ledger, { amount: -EXTRA_SLOT_COST, reason: 'REPLAY_SLOT_PURCHASE', slotId: slot.id, createdAt: now });
        tx.set(lib, { slotRevision: (typeof libSnap.data()?.slotRevision === 'number' ? libSnap.data()!.slotRevision : 0) + 1 }, { merge: true });
        return result;
    });
}

export async function getReplayCapacity(db: admin.firestore.Firestore, uid: string, now = Date.now()) {
    const [premium, slots] = await Promise.all([db.collection('premium_entitlements').doc(uid).get(), db.collection('replay_libraries').doc(uid).collection('extra_slots').get()]);
    if (!isActivePremiumEntitlement(premium.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
    const active = slots.docs.filter(doc => typeof doc.data().expiresAt === 'number' && doc.data().expiresAt > now);
    return { capacity: Math.min(10, 1 + active.length), expiresAt: active.map(doc => doc.data().expiresAt as number).sort((a, b) => a - b) };
}
const callable = (fn: (db: admin.firestore.Firestore, uid: string, raw: unknown) => Promise<unknown>, db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await fn(db, context.auth.uid, data); } catch (error) { if (error instanceof z.ZodError) throw new functions.https.HttpsError('invalid-argument', 'Demande invalide.'); throw error; }
});
export const createBuyReplaySlot = (db: admin.firestore.Firestore) => callable(buyReplaySlot, db);
export const createGetReplayCapacity = (db: admin.firestore.Firestore) => callable((database, uid) => getReplayCapacity(database, uid), db);
