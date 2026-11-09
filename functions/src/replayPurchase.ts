import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { isActivePremiumEntitlement } from './premiumAccess';
import { decideReplayOpening, REPLAY_OPEN_COST, REPLAY_SLOT_LIMIT } from './replayPolicy';

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,161}$/);
const purchaseSchema = z.object({ source: z.enum(['current', 'multiplayer']), sourceId: identifier, requestId: identifier, localPlayerId: z.string().min(1).max(128), acceptedCost: z.literal(REPLAY_OPEN_COST), replaceReplayId: identifier.optional(), frames: z.array(z.record(z.string(), z.unknown())).max(1000).optional() }).strict();
const replayIdFor = (source: string, id: string) => createHash('sha256').update(`${source}:${id}`).digest('hex');
function decodeFrames(data: admin.firestore.DocumentData): admin.firestore.DocumentData[] {
    try {
        const frames: unknown = typeof data.framesGzip === 'string' ? JSON.parse(gunzipSync(Buffer.from(data.framesGzip, 'base64'), { maxOutputLength: 8_000_000 }).toString('utf8')) : data.frames;
        if (!Array.isArray(frames)) throw new Error('invalid frames');
        return frames as admin.firestore.DocumentData[];
    } catch { throw new functions.https.HttpsError('failed-precondition', 'Replay sauvegardé illisible.'); }
}

export async function purchaseReplay(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()) {
    const input = purchaseSchema.parse(raw);
    const session = input.source === 'multiplayer' ? db.collection('replay_sessions').doc(input.sourceId) : undefined;
    const frames = session ? (await session.collection('frames').orderBy('version').get()).docs.map(d => d.data().state as admin.firestore.DocumentData) : (input.frames ?? []);
    const first = frames[0], last = frames[frames.length - 1];
    if (frames.length < 2 || !first || !last || last.phase !== 'MATCH_END' || !Array.isArray(first.players) || !Array.isArray(last.players) || !last.players.some((p: { id?: unknown }) => p.id === input.localPlayerId)) throw new functions.https.HttpsError('failed-precondition', 'Replay complet indisponible.');
    const rawFrames = JSON.stringify(frames);
    if (Buffer.byteLength(rawFrames) > 8_000_000) throw new functions.https.HttpsError('resource-exhausted', 'Replay trop volumineux.');
    const framesGzip = gzipSync(Buffer.from(rawFrames)).toString('base64');
    if (Buffer.byteLength(framesGzip) > 800_000) throw new functions.https.HttpsError('resource-exhausted', 'Replay trop volumineux.');
    const library = db.collection('replay_libraries').doc(uid);
    const slot = library.collection('slots').doc(replayIdFor(input.source, input.sourceId));
    const receipt = library.collection('purchase_receipts').doc(input.requestId);
    const entitlement = db.collection('premium_entitlements').doc(uid);
    const user = db.collection('users').doc(uid);
    const ledger = db.collection('coin_wallets').doc(uid).collection('entries').doc(`replay_${input.requestId}`);
    const replaced = input.replaceReplayId ? library.collection('slots').doc(input.replaceReplayId) : undefined;
    return db.runTransaction(async tx => {
        const [libSnap, slotSnap, receiptSnap, premiumSnap, userSnap, sessionSnap, replacedSnap] = await Promise.all([tx.get(library), tx.get(slot), tx.get(receipt), tx.get(entitlement), tx.get(user), session ? tx.get(session) : Promise.resolve(undefined), replaced ? tx.get(replaced) : Promise.resolve(undefined)]);
        if (!isActivePremiumEntitlement(premiumSnap.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
        if (session && (sessionSnap?.data()?.status !== 'COMPLETED' || !sessionSnap?.data()?.participants?.includes(uid) || input.localPlayerId !== uid)) throw new functions.https.HttpsError('permission-denied', 'Replay inaccessible.');
        if (receiptSnap.exists) {
            if (receiptSnap.data()?.replayId !== slot.id) throw new functions.https.HttpsError('already-exists', 'Identifiant de demande déjà utilisé.');
            if (!slotSnap.exists) throw new functions.https.HttpsError('not-found', 'Replay sauvegardé introuvable.');
            return { replayId: slot.id, remainingCoins: receiptSnap.data()!.remainingCoins as number, alreadyOwned: true, frames: decodeFrames(slotSnap.data()!) };
        }
        if (slotSnap.exists) return { replayId: slot.id, remainingCoins: userSnap.data()?.economy?.coins as number, alreadyOwned: true, frames: decodeFrames(slotSnap.data()!) };
        const count = libSnap.data()?.savedCount ?? 0;
        if (!Number.isSafeInteger(count) || count < 0 || count > 10) throw new functions.https.HttpsError('failed-precondition', 'Bibliothèque invalide.');
        if (count >= REPLAY_SLOT_LIMIT && !replaced) throw new functions.https.HttpsError('resource-exhausted', 'Tes emplacements replay sont occupés.', { reason: 'REPLAY_SLOT_FULL' });
        if (replaced && (!replacedSnap?.exists || count < 1)) throw new functions.https.HttpsError('failed-precondition', 'Le replay à remplacer est introuvable. Actualise la liste.');
        const decision = decideReplayOpening(true, userSnap.data()?.economy?.coins);
        if (!decision.allowed) throw new functions.https.HttpsError('failed-precondition', decision.reason === 'INSUFFICIENT_COINS' ? 'Solde insuffisant : 2 000 coins sont nécessaires.' : 'Solde indisponible.');
        const metadata = { endedAt: now, mode: input.source === 'current' ? 'SOLO' : 'MULTIPLAYER', sourceId: input.sourceId, gameMode: typeof last.gameMode === 'string' ? last.gameMode : '', winningCondition: typeof last.winningCondition === 'number' ? last.winningCondition : 0, opponents: last.players.filter((p: { id: string }) => p.id !== input.localPlayerId).map((p: { name: string }) => p.name || 'Joueur') };
        tx.update(user, { 'economy.coins': decision.remainingCoins });
        if (replaced) tx.delete(replaced);
        tx.create(slot, { framesGzip, localPlayerId: input.localPlayerId, metadata });
        tx.set(library, { savedCount: count + (replaced ? 0 : 1) }, { merge: true });
        tx.create(receipt, { replayId: slot.id, remainingCoins: decision.remainingCoins, createdAt: now });
        tx.create(ledger, { amount: -REPLAY_OPEN_COST, reason: 'REPLAY_PURCHASE', replayId: slot.id, createdAt: now });
        return { replayId: slot.id, remainingCoins: decision.remainingCoins, alreadyOwned: false, frames };
    });
}

export async function readPurchasedReplay(db: admin.firestore.Firestore, uid: string, raw: unknown, now = Date.now()) {
    const { replayId } = z.object({ replayId: identifier }).strict().parse(raw);
    const [premium, slot] = await Promise.all([db.collection('premium_entitlements').doc(uid).get(), db.collection('replay_libraries').doc(uid).collection('slots').doc(replayId).get()]);
    if (!isActivePremiumEntitlement(premium.data(), now)) throw new functions.https.HttpsError('permission-denied', 'Un abonnement Premium actif est requis.');
    if (!slot.exists) throw new functions.https.HttpsError('not-found', 'Replay introuvable.');
    const data = slot.data()!;
    return { replay: { frames: decodeFrames(data), localPlayerId: data.localPlayerId, metadata: data.metadata } };
}

const callable = (fn: (db: admin.firestore.Firestore, uid: string, raw: unknown) => Promise<unknown>, db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    try { return await fn(db, context.auth.uid, data); } catch (error) { if (error instanceof z.ZodError) throw new functions.https.HttpsError('invalid-argument', 'Demande de replay invalide.'); throw error; }
});
export const createPurchaseReplay = (db: admin.firestore.Firestore) => callable(purchaseReplay, db);
export const createReadPurchasedReplay = (db: admin.firestore.Firestore) => callable(readPurchasedReplay, db);
