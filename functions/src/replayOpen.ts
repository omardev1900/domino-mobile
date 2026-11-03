import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { decideReplayOpening, REPLAY_OPEN_COST } from './replayPolicy';
import { ZodError } from 'zod';
import { gunzipSync } from 'node:zlib';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const inputSchema = z.object({ replayId: idSchema, requestId: idSchema, source: z.enum(['candidate', 'saved']).default('saved'), acceptedCost: z.number().optional() }).strict();
const currentSchema = z.object({ matchId: idSchema, requestId: idSchema, acceptedCost: z.number().optional() }).strict();

export async function chargeCurrentReplay(db: admin.firestore.Firestore, uid: string, rawInput: unknown, now = Date.now()): Promise<{ remainingCoins: number }> {
    const { matchId, requestId, acceptedCost } = currentSchema.parse(rawInput);
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
        if (acceptedCost !== REPLAY_OPEN_COST) throw new functions.https.HttpsError('failed-precondition', 'Le prix du replay a changé. Mets à jour l’application avant de réessayer.');
        const decision = decideReplayOpening(true, user.data()?.economy?.coins);
        if (!decision.allowed) throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS' ? 'Solde insuffisant : 2 000 coins sont nécessaires.' : 'Solde indisponible.');
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
    const { replayId, requestId, source, acceptedCost } = inputSchema.parse(rawInput);
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
        const data = replay.data()!;
        let replayData: admin.firestore.DocumentData = data;
        if (typeof data.framesGzip === 'string') {
            try {
                const frames: unknown = JSON.parse(gunzipSync(Buffer.from(data.framesGzip, 'base64'), { maxOutputLength: 8_000_000 }).toString('utf8'));
                if (!Array.isArray(frames)) throw new Error('invalid replay');
                const { framesGzip: _compressed, ...rest } = data;
                replayData = { ...rest, frames };
            } catch {
                throw new functions.https.HttpsError('failed-precondition', 'Replay sauvegardé illisible.');
            }
        }
        if (receipt.exists) {
            if (receipt.data()?.replayId !== replayId || receipt.data()?.source !== source) {
                throw new functions.https.HttpsError('already-exists', 'Identifiant de demande déjà utilisé.');
            }
            return { replay: replayData, remainingCoins: receipt.data()!.remainingCoins as number };
        }
        if (acceptedCost !== REPLAY_OPEN_COST) throw new functions.https.HttpsError('failed-precondition', 'Le prix du replay a changé. Mets à jour l’application avant de réessayer.');
        const decision = decideReplayOpening(true, user.data()?.economy?.coins);
        if (!decision.allowed) {
            throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS'
                ? 'Solde insuffisant : 2 000 coins sont nécessaires.' : 'Solde indisponible.');
        }
        transaction.update(userRef, { 'economy.coins': decision.remainingCoins });
        transaction.create(receiptRef, {
            replayId,
            source,
            remainingCoins: decision.remainingCoins,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { replay: replayData, remainingCoins: decision.remainingCoins };
    });
}
