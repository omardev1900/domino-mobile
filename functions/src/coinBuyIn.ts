import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { MINIMUM_COIN_RESERVE, TABLE_CONFIGS } from './core/economy.constants';
import * as functions from 'firebase-functions';
import { z } from 'zod';

/** Internal operation. Caller must establish match identity and authorize eligibility. */
const SOLO_TABLE_TIERS = ['DEBUTANT', 'EXPERT', 'LEGENDE'] as const;
type SoloTableTier = typeof SOLO_TABLE_TIERS[number];

export async function settleMatchBuyIn(db: admin.firestore.Firestore, uid: string, matchId: string, action: 'debit' | 'refund', now = Date.now(), tableTier: SoloTableTier = 'DEBUTANT') {
    if (!uid || !matchId || matchId.length > 200) throw new Error('Invalid match identity');
    const key = createHash('sha256').update(matchId).digest('hex');
    const user = db.collection('users').doc(uid);
    const wallet = db.collection('coin_wallets').doc(uid).collection('entries');
    const debit = wallet.doc(`buyin_${key}`);
    const refund = wallet.doc(`refund_${key}`);
    const amount = TABLE_CONFIGS[tableTier].buyIn;
    return db.runTransaction(async tx => {
        const [userSnap, debitSnap, refundSnap] = await Promise.all([tx.get(user), tx.get(debit), tx.get(refund)]);
        const balance: unknown = userSnap.data()?.economy?.coins;
        if (typeof balance !== 'number' || !Number.isSafeInteger(balance) || balance < 0) return { ok: false as const, reason: 'INVALID_BALANCE' as const };
        if (action === 'debit') {
            if (refundSnap.exists) return { ok: false as const, reason: 'ALREADY_REFUNDED' as const };
            if (debitSnap.exists) return { ok: true as const, balance, duplicate: true };
            if (balance - amount < MINIMUM_COIN_RESERVE) return { ok: false as const, reason: 'INSUFFICIENT_COINS' as const };
            tx.update(user, { 'economy.coins': balance - amount });
            tx.create(debit, { amount: -amount, reason: 'MATCH_BUY_IN', matchId, balanceAfter: balance - amount, createdAt: now });
            return { ok: true as const, balance: balance - amount, duplicate: false };
        }
        if (!debitSnap.exists) return { ok: false as const, reason: 'BUY_IN_NOT_FOUND' as const };
        if (refundSnap.exists) return { ok: true as const, balance, duplicate: true };
        const charged = debitSnap.data()?.amount;
        if (charged !== -amount || !Number.isSafeInteger(balance + amount)) return { ok: false as const, reason: 'INVALID_BUY_IN' as const };
        tx.update(user, { 'economy.coins': balance + amount });
        tx.create(refund, { amount, reason: 'MATCH_BUY_IN_REFUND', matchId, balanceAfter: balance + amount, createdAt: now });
        return { ok: true as const, balance: balance + amount, duplicate: false };
    });
}

/** The client can only purchase a solo entry; the server owns the amount. */
export const createDebitSoloBuyIn = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const parsed = z.object({
        matchId: z.string().regex(/^solo_[A-Za-z0-9_]{1,140}$/),
        tableTier: z.enum(SOLO_TABLE_TIERS).default('DEBUTANT'),
    }).strict().safeParse(raw);
    if (!parsed.success) throw new functions.https.HttpsError('invalid-argument', 'Demande de mise invalide.');
    const result = await settleMatchBuyIn(db, context.auth.uid, parsed.data.matchId, 'debit', Date.now(), parsed.data.tableTier);
    if (!result.ok) throw new functions.https.HttpsError('failed-precondition', result.reason === 'INSUFFICIENT_COINS' ? 'Coins insuffisants pour cette mise.' : 'Mise indisponible.');
    return result;
});

/** Refund only the authenticated caller's own, previously debited solo attempt. */
export const createRefundSoloBuyIn = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const parsed = z.object({
        matchId: z.string().regex(/^solo_[A-Za-z0-9_]{1,140}$/),
        tableTier: z.enum(SOLO_TABLE_TIERS).default('DEBUTANT'),
    }).strict().safeParse(raw);
    if (!parsed.success) throw new functions.https.HttpsError('invalid-argument', 'Demande de remboursement invalide.');
    const result = await settleMatchBuyIn(db, context.auth.uid, parsed.data.matchId, 'refund', Date.now(), parsed.data.tableTier);
    if (!result.ok) {
        const message = result.reason === 'BUY_IN_NOT_FOUND'
            ? 'Aucune mise solo à rembourser.'
            : 'Remboursement indisponible.';
        throw new functions.https.HttpsError('failed-precondition', message);
    }
    return result;
});
