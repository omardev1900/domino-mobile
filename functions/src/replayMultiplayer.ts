import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { decideReplayOpening, REPLAY_OPEN_COST } from './replayPolicy';

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,161}$/);
const inputSchema = z.object({ sessionId: identifier, requestId: identifier, acceptedCost: z.number().optional() }).strict();

/** Returns only a complete, finished replay to its Premium participant. */
export async function openMultiplayerReplay(db: admin.firestore.Firestore, uid: string, rawInput: unknown, now = Date.now()): Promise<{ frames: admin.firestore.DocumentData[]; remainingCoins: number }> {
    const { sessionId, requestId, acceptedCost } = inputSchema.parse(rawInput);
    const session = db.collection('replay_sessions').doc(sessionId);
    const framesSnapshot = await session.collection('frames').orderBy('version').get();
    const frames = framesSnapshot.docs.map(frame => frame.data().state as admin.firestore.DocumentData);
    if (frames.length < 2 || frames[0].stateVersion !== 1 || frames[frames.length - 1].phase !== 'MATCH_END') {
        throw new functions.https.HttpsError('failed-precondition', 'Le replay complet est indisponible.');
    }
    const entitlement = db.collection('premium_entitlements').doc(uid);
    const user = db.collection('users').doc(uid);
    const receipt = db.collection('replay_libraries').doc(uid).collection('opening_receipts').doc(requestId);
    const remainingCoins = await db.runTransaction(async transaction => {
        const [sessionSnap, entitlementSnap, userSnap, receiptSnap] = await Promise.all([
            transaction.get(session), transaction.get(entitlement), transaction.get(user), transaction.get(receipt),
        ]);
        if (sessionSnap.data()?.status !== 'COMPLETED' || !Array.isArray(sessionSnap.data()?.participants) || !sessionSnap.data()!.participants.includes(uid)) {
            throw new functions.https.HttpsError('permission-denied', 'Replay inaccessible.');
        }
        if (!isActivePremiumEntitlement(entitlementSnap.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        if (receiptSnap.exists) {
            if (receiptSnap.data()?.replayId !== sessionId || receiptSnap.data()?.source !== 'multiplayer') throw new functions.https.HttpsError('already-exists', 'Identifiant de demande déjà utilisé.');
            return receiptSnap.data()!.remainingCoins as number;
        }
        if (acceptedCost !== REPLAY_OPEN_COST) throw new functions.https.HttpsError('failed-precondition', 'Le prix du replay a changé. Mets à jour l’application avant de réessayer.');
        const decision = decideReplayOpening(true, userSnap.data()?.economy?.coins);
        if (!decision.allowed) throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS' ? 'Solde insuffisant : 2 000 coins sont nécessaires.' : 'Solde indisponible.');
        transaction.update(user, { 'economy.coins': decision.remainingCoins });
        transaction.create(receipt, { replayId: sessionId, source: 'multiplayer', remainingCoins: decision.remainingCoins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        return decision.remainingCoins;
    });
    return { frames, remainingCoins };
}

export const createOpenMultiplayerReplay = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (data: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await openMultiplayerReplay(db, context.auth.uid, data); }
    catch (error) {
        if (error instanceof z.ZodError) throw new functions.https.HttpsError('invalid-argument', 'Demande de replay invalide.');
        throw error;
    }
});
