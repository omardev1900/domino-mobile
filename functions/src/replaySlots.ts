import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { canSaveReplay } from './replayPolicy';

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const saveSchema = z.object({ replayId: identifier, requestId: identifier }).strict();
const deleteSchema = z.object({ replayId: identifier }).strict();

/** The candidate and receipt must be written by trusted server code before saving. */
export async function saveReplaySlot(db: admin.firestore.Firestore, uid: string, input: unknown, now = Date.now()): Promise<{ savedCount: number }> {
    const { replayId, requestId } = saveSchema.parse(input);
    const library = db.collection('replay_libraries').doc(uid);
    const slot = library.collection('slots').doc(replayId);
    const candidate = db.collection('replay_candidates').doc(uid).collection('matches').doc(replayId);
    const receipt = library.collection('opening_receipts').doc(requestId);
    const entitlement = db.collection('premium_entitlements').doc(uid);
    return db.runTransaction(async transaction => {
        const [librarySnap, slotSnap, candidateSnap, receiptSnap, entitlementSnap] = await Promise.all([
            transaction.get(library), transaction.get(slot), transaction.get(candidate), transaction.get(receipt), transaction.get(entitlement),
        ]);
        if (!isActivePremiumEntitlement(entitlementSnap.data(), now)) {
            throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        }
        const count: unknown = librarySnap.data()?.savedCount ?? 0;
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 10) {
            throw new functions.https.HttpsError('failed-precondition', 'Bibliothèque de replays invalide.');
        }
        if (slotSnap.exists) return { savedCount: count };
        if (!canSaveReplay(true, count)) throw new functions.https.HttpsError('resource-exhausted', 'Les 2 emplacements sont occupés.');
        if (!candidateSnap.exists || !receiptSnap.exists || receiptSnap.data()?.replayId !== replayId || receiptSnap.data()?.source !== 'candidate') {
            throw new functions.https.HttpsError('failed-precondition', 'Replay non disponible ou non ouvert.');
        }
        transaction.create(slot, candidateSnap.data()!);
        transaction.set(library, { savedCount: count + 1 }, { merge: true });
        return { savedCount: count + 1 };
    });
}

export async function deleteReplaySlot(db: admin.firestore.Firestore, uid: string, input: unknown, now = Date.now()): Promise<{ savedCount: number }> {
    const { replayId } = deleteSchema.parse(input);
    const library = db.collection('replay_libraries').doc(uid);
    const slot = library.collection('slots').doc(replayId);
    const entitlement = db.collection('premium_entitlements').doc(uid);
    return db.runTransaction(async transaction => {
        const [librarySnap, slotSnap, entitlementSnap] = await Promise.all([
            transaction.get(library), transaction.get(slot), transaction.get(entitlement),
        ]);
        if (!isActivePremiumEntitlement(entitlementSnap.data(), now)) {
            throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        }
        const count: unknown = librarySnap.data()?.savedCount ?? 0;
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 10 || (slotSnap.exists && count === 0)) {
            throw new functions.https.HttpsError('failed-precondition', 'Bibliothèque de replays invalide.');
        }
        if (!slotSnap.exists) return { savedCount: count };
        transaction.delete(slot);
        transaction.set(library, { savedCount: count - 1 }, { merge: true });
        return { savedCount: count - 1 };
    });
}
