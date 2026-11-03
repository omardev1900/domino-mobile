import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { decideReplayOpening } from './replayPolicy';
import { ZodError } from 'zod';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const inputSchema = z.object({ replayId: idSchema, requestId: idSchema, source: z.enum(['candidate', 'saved']).default('saved') }).strict();
const currentSchema = z.object({ matchId: idSchema, requestId: idSchema }).strict();

export async function chargeCurrentReplay(db: admin.firestore.Firestore, uid: string, rawInput: unknown, now = Date.now()): Promise<{ remainingCoins: number }> {
    const { matchId, requestId } = currentSchema.parse(rawInput);
    const entitlementRef = db.collection('premium_entitlements').doc(uid);
    const userRef = db.collection('users').doc(uid);
    const receiptRef = db.collection('replay_libraries').doc(uid).collection('opening_receipts').doc(requestId);
    return db.runTransaction(async transaction => {
        const [entitlement, user, receipt] = await Promise.all([
            transaction.get(entitlementRef), transaction.get(userRef), transaction.get(receiptRef),
        ]);
        if (!isActivePremiumEntitlement(entitlement.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        if (receipt.exists) {
            if (receipt.data()?.replayId !== matchId || receipt.data()?.source !== 'current') throw new functions.https.HttpsError('already-exists', 'Identifiant de demande déjà utilisé.');
            return { remainingCoins: receipt.data()!.remainingCoins as number };
        }
        const decision = decideReplayOpening(true, user.data()?.economy?.coins);
        if (!decision.allowed) throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS' ? 'Solde insuffisant : 1 000 coins sont nécessaires.' : 'Solde indisponible.');
        transaction.update(userRef, { 'economy.coins': decision.remainingCoins });
        transaction.create(receiptRef, { replayId: matchId, source: 'current', remainingCoins: decision.remainingCoins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        return { remainingCoins: decision.remainingCoins };
    });
}

export const createChargeCurrentReplay = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (data: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try {
        return await chargeCurrentReplay(db, context.auth.uid, data);
    } catch (error) {
        if (error instanceof ZodError) throw new functions.https.HttpsError('invalid-argument', 'Demande de replay invalide.');
        throw error;
    }
});

/** Transactional building block; not exposed until replay capture and storage are integrated. */
export async function openReplay(
    db: admin.firestore.Firestore,
    uid: string,
    rawInput: unknown,
    now = Date.now(),
): Promise<{ replay: admin.firestore.DocumentData; remainingCoins: number }> {
    const { replayId, requestId, source } = inputSchema.parse(rawInput);
    const entitlementRef = db.collection('premium_entitlements').doc(uid);
    const userRef = db.collection('users').doc(uid);
    const replayRef = source === 'saved'
        ? db.collection('replay_libraries').doc(uid).collection('slots').doc(replayId)
        : db.collection('replay_candidates').doc(uid).collection('matches').doc(replayId);
    const receiptRef = db.collection('replay_libraries').doc(uid).collection('opening_receipts').doc(requestId);

    return db.runTransaction(async transaction => {
        const [entitlement, user, replay, receipt] = await Promise.all([
            transaction.get(entitlementRef), transaction.get(userRef),
            transaction.get(replayRef), transaction.get(receiptRef),
        ]);
        if (!isActivePremiumEntitlement(entitlement.data(), now)) {
            throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        }
        if (!replay.exists) throw new functions.https.HttpsError('not-found', 'Replay introuvable.');
        if (receipt.exists) {
            if (receipt.data()?.replayId !== replayId || receipt.data()?.source !== source) {
                throw new functions.https.HttpsError('already-exists', 'Identifiant de demande déjà utilisé.');
            }
            return { replay: replay.data()!, remainingCoins: receipt.data()!.remainingCoins as number };
        }
        const decision = decideReplayOpening(true, user.data()?.economy?.coins);
        if (!decision.allowed) {
            throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS'
                ? 'Solde insuffisant : 1 000 coins sont nécessaires.' : 'Solde indisponible.');
        }
        transaction.update(userRef, { 'economy.coins': decision.remainingCoins });
        transaction.create(receiptRef, {
            replayId,
            source,
            remainingCoins: decision.remainingCoins,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { replay: replay.data()!, remainingCoins: decision.remainingCoins };
    });
}
