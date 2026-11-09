import * as admin from 'firebase-admin';

/** Trusted server code only: callers must validate the business operation before invoking. */
export interface CoinOperation {
    uid: string;
    operationId: string;
    amount: number;
    reason: string;
    now: number;
    minimumBalance?: number;
}

export type CoinOperationResult =
    | { ok: true; balance: number; duplicate: boolean }
    | { ok: false; reason: 'INVALID_BALANCE' | 'INSUFFICIENT_COINS' | 'CONFLICT' };

export async function applyCoinOperation(db: admin.firestore.Firestore, op: CoinOperation): Promise<CoinOperationResult> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(op.operationId) || !op.uid || !op.reason || !Number.isSafeInteger(op.amount) || op.amount === 0 || !Number.isFinite(op.now) || !Number.isSafeInteger(op.minimumBalance ?? 0) || (op.minimumBalance ?? 0) < 0) throw new Error('Invalid coin operation');
    const user = db.collection('users').doc(op.uid);
    const entry = db.collection('coin_wallets').doc(op.uid).collection('entries').doc(op.operationId);
    return db.runTransaction(async tx => {
        const [userSnap, entrySnap] = await Promise.all([tx.get(user), tx.get(entry)]);
        if (entrySnap.exists) {
            const prior = entrySnap.data()!;
            if (prior.amount !== op.amount || prior.reason !== op.reason) return { ok: false as const, reason: 'CONFLICT' as const };
            return { ok: true as const, balance: prior.balanceAfter as number, duplicate: true };
        }
        const balance: unknown = userSnap.data()?.economy?.coins;
        if (typeof balance !== 'number' || !Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + op.amount)) return { ok: false as const, reason: 'INVALID_BALANCE' as const };
        const next = balance + op.amount;
        if (next < (op.minimumBalance ?? 0)) return { ok: false as const, reason: 'INSUFFICIENT_COINS' as const };
        tx.update(user, { 'economy.coins': next });
        tx.create(entry, { amount: op.amount, reason: op.reason, balanceAfter: next, createdAt: op.now });
        return { ok: true as const, balance: next, duplicate: false };
    });
}
