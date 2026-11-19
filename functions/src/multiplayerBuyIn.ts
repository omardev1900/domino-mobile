import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MINIMUM_COIN_RESERVE } from './core/economy.constants';
import { applyCoinOperation, applyCoinOperationInTransaction } from './coinLedger';

export const operationKey = (prefix: string, ...parts: string[]) =>
    `${prefix}_${createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 48)}`;

export async function settleRoomBuyIn(db: admin.firestore.Firestore, uid: string, roomId: string, action: 'debit' | 'refund', now = Date.now()) {
    return db.runTransaction(async tx => {
        const roomSnap = await tx.get(db.collection('rooms').doc(roomId));
        if (!roomSnap.exists) return { ok: false as const, reason: 'ROOM_NOT_FOUND' as const };
        const room = roomSnap.data() ?? {};
        const participant = Array.isArray(room.players)
            ? room.players.find((player: any) => player.uid === uid)
            : null;
        if (typeof room.managedBuyIn === 'number') {
            if (action === 'refund') return { ok: false as const, reason: 'REFUND_NOT_ELIGIBLE' as const };
            if (!participant) return { ok: false as const, reason: 'NOT_A_PARTICIPANT' as const };
            const account = await tx.get(db.collection('users').doc(uid));
            return { ok: true as const, balance: Number(account.data()?.economy?.coins ?? 0), duplicate: true };
        }
        if (!participant) return { ok: false as const, reason: 'NOT_A_PARTICIPANT' as const };
        const amount = room.buyIn ?? 100;
        if (!Number.isSafeInteger(amount) || amount < 0) return { ok: false as const, reason: 'INVALID_BUY_IN' as const };

        if (action === 'refund') {
            if (room.status !== 'WAITING') return { ok: false as const, reason: 'REFUND_NOT_ELIGIBLE' as const };
            const debitId = operationKey('room_buyin', roomId, uid);
            const debit = await tx.get(db.collection('coin_wallets').doc(uid).collection('entries').doc(debitId));
            if (!debit.exists) return { ok: false as const, reason: 'BUY_IN_NOT_FOUND' as const };
            if (debit.data()?.amount !== -amount) return { ok: false as const, reason: 'INVALID_BUY_IN' as const };
            return applyCoinOperationInTransaction(db, tx, {
                uid,
                operationId: operationKey('room_refund', roomId, uid),
                amount,
                reason: 'MULTIPLAYER_BUY_IN_REFUND',
                now,
            });
        }

        return applyCoinOperationInTransaction(db, tx, {
            uid,
            operationId: operationKey('room_buyin', roomId, uid),
            amount: -amount,
            reason: 'MULTIPLAYER_BUY_IN',
            minimumBalance: MINIMUM_COIN_RESERVE,
            now,
        });
    });
}

export const createSettleMultiplayerBuyIn = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const parsed = z.object({ roomId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), action: z.enum(['debit', 'refund']) }).strict().safeParse(raw);
    if (!parsed.success) throw new functions.https.HttpsError('invalid-argument', 'Mise multijoueur invalide.');
    const result = await settleRoomBuyIn(db, context.auth.uid, parsed.data.roomId, parsed.data.action);
    if (!result.ok) throw new functions.https.HttpsError('failed-precondition', result.reason === 'INSUFFICIENT_COINS' ? 'Coins insuffisants pour cette table.' : 'Opération de mise indisponible.');
    return result;
});

export async function settleTournamentBuyIn(db: admin.firestore.Firestore, uid: string, tournamentId: string, action: 'debit' | 'refund', now = Date.now()) {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) return { ok: false as const, reason: 'TOURNAMENT_NOT_FOUND' as const };
    const amount = tournamentSnap.data()?.entryFeeCoins ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0) return { ok: false as const, reason: 'INVALID_BUY_IN' as const };
    if (action === 'refund' && tournamentSnap.data()?.status === 'ACTIVE') return { ok: false as const, reason: 'REFUND_NOT_ELIGIBLE' as const };
    return applyCoinOperation(db, {
        uid,
        operationId: operationKey(action === 'debit' ? 'tournament_buyin' : 'tournament_refund', tournamentId, uid),
        amount: action === 'debit' ? -amount : amount,
        reason: action === 'debit' ? 'TOURNAMENT_BUY_IN' : 'TOURNAMENT_BUY_IN_REFUND',
        minimumBalance: action === 'debit' ? MINIMUM_COIN_RESERVE : 0,
        now,
    });
}

export const createSettleTournamentBuyIn = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const parsed = z.object({ tournamentId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), action: z.enum(['debit', 'refund']) }).strict().safeParse(raw);
    if (!parsed.success) throw new functions.https.HttpsError('invalid-argument', 'Inscription tournoi invalide.');
    const result = await settleTournamentBuyIn(db, context.auth.uid, parsed.data.tournamentId, parsed.data.action);
    if (!result.ok) throw new functions.https.HttpsError('failed-precondition', 'Opération tournoi indisponible.');
    return result;
});
