import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { z, ZodError } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { canSaveReplay } from './replayPolicy';
import { deleteReplaySlot } from './replaySlots';
import { openReplay } from './replayOpen';

const requestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const saveSchema = z.object({ requestId: requestIdSchema, localPlayerId: z.string().min(1).max(128), frames: z.array(z.record(z.string(), z.unknown())).max(1000).optional() }).strict();

export async function savePurchasedReplay(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()): Promise<{ replayId: string; savedCount: number }> {
    const input = saveSchema.parse(raw);
    const library = db.collection('replay_libraries').doc(uid);
    const receiptRef = library.collection('opening_receipts').doc(input.requestId);
    const receipt = await receiptRef.get();
    const source = receipt.data()?.source;
    const sourceId = receipt.data()?.replayId;
    if (!receipt.exists || !['current', 'multiplayer'].includes(source) || typeof sourceId !== 'string') throw new functions.https.HttpsError('failed-precondition', 'Ouvre le replay avant de le sauvegarder.');
    let frames: admin.firestore.DocumentData[];
    let session: admin.firestore.DocumentReference | undefined;
    if (source === 'multiplayer') {
        session = db.collection('replay_sessions').doc(sourceId);
        const docs = await session.collection('frames').orderBy('version').get();
        frames = docs.docs.map(item => item.data().state as admin.firestore.DocumentData);
    } else {
        frames = input.frames ?? [];
    }
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (frames.length < 2 || !first || !last || last.phase !== 'MATCH_END' || !Array.isArray(first.players) || !Array.isArray(last.players) || !last.players.some((p: { id?: unknown }) => p.id === input.localPlayerId)) {
        throw new functions.https.HttpsError('failed-precondition', 'Replay complet indisponible.');
    }
    const serialized = JSON.stringify(frames);
    if (frames.length > 1000 || Buffer.byteLength(serialized, 'utf8') > 8_000_000) throw new functions.https.HttpsError('resource-exhausted', 'Ce replay est trop volumineux pour être sauvegardé.');
    const framesGzip = gzipSync(Buffer.from(serialized)).toString('base64');
    if (Buffer.byteLength(framesGzip, 'utf8') > 800_000) throw new functions.https.HttpsError('resource-exhausted', 'Ce replay est trop volumineux pour être sauvegardé.');
    const replayId = createHash('sha256').update(`${source}:${sourceId}`).digest('hex');
    const slot = library.collection('slots').doc(replayId);
    const entitlement = db.collection('premium_entitlements').doc(uid);
    const metadata = {
        endedAt: now, mode: source === 'current' ? 'SOLO' : 'MULTIPLAYER',
        gameMode: typeof last.gameMode === 'string' ? last.gameMode : '', winningCondition: typeof last.winningCondition === 'number' ? last.winningCondition : 0,
        opponents: last.players.filter((p: { id: string }) => p.id !== input.localPlayerId).map((p: { name: string }) => p.name || 'Joueur'),
    };
    return db.runTransaction(async transaction => {
        const refs = [library, slot, entitlement, receiptRef, ...(session ? [session] : [])];
        const [libSnap, slotSnap, entitlementSnap, receiptSnap, sessionSnap] = await Promise.all(refs.map(ref => transaction.get(ref)));
        if (!isActivePremiumEntitlement(entitlementSnap.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        if (receiptSnap.data()?.source !== source || receiptSnap.data()?.replayId !== sourceId) throw new functions.https.HttpsError('failed-precondition', 'Ouverture de replay invalide.');
        if (session && (sessionSnap?.data()?.status !== 'COMPLETED' || !sessionSnap?.data()?.participants?.includes(uid) || input.localPlayerId !== uid)) throw new functions.https.HttpsError('permission-denied', 'Replay inaccessible.');
        const count: unknown = libSnap.data()?.savedCount ?? 0;
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 10) throw new functions.https.HttpsError('failed-precondition', 'Bibliothèque invalide.');
        if (slotSnap.exists) return { replayId, savedCount: count };
        if (!canSaveReplay(true, count)) throw new functions.https.HttpsError('resource-exhausted', 'Les 2 emplacements sont occupés. Supprime un replay pour libérer une place.');
        transaction.create(slot, { framesGzip, localPlayerId: input.localPlayerId, metadata });
        transaction.set(library, { savedCount: count + 1 }, { merge: true });
        return { replayId, savedCount: count + 1 };
    });
}

export async function listReplayLibrary(db: admin.firestore.Firestore, uid: string, now = Date.now()): Promise<{ replays: { id: string; metadata: admin.firestore.DocumentData }[] }> {
    const entitlement = await db.collection('premium_entitlements').doc(uid).get();
    if (!isActivePremiumEntitlement(entitlement.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
    const slots = await db.collection('replay_libraries').doc(uid).collection('slots').limit(10).get();
    const replays = slots.docs.map(doc => ({ id: doc.id, metadata: doc.data().metadata ?? {} }));
    replays.sort((a, b) => Number(b.metadata.endedAt ?? 0) - Number(a.metadata.endedAt ?? 0));
    return { replays };
}

const callable = (fn: (db: admin.firestore.Firestore, uid: string, data: unknown) => Promise<unknown>, db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (data: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await fn(db, context.auth.uid, data); }
    catch (error) { if (error instanceof ZodError) throw new functions.https.HttpsError('invalid-argument', 'Demande invalide.'); throw error; }
});
export const createSavePurchasedReplay = (db: admin.firestore.Firestore) => callable(savePurchasedReplay, db);
export const createDeleteReplaySlot = (db: admin.firestore.Firestore) => callable(deleteReplaySlot, db);
export const createOpenSavedReplay = (db: admin.firestore.Firestore) => callable(openReplay, db);
export const createListReplayLibrary = (db: admin.firestore.Firestore) => callable((database, uid) => listReplayLibrary(database, uid), db);
