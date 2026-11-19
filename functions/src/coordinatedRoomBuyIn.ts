import * as admin from 'firebase-admin';
import { resolveMatchBuyIn } from './matchBuyInPolicy';
import { operationKey } from './multiplayerBuyIn';

export async function prepareRoomBuyIn(
    db: admin.firestore.Firestore,
    tx: admin.firestore.Transaction,
    roomId: string,
    sessionId: string,
    playerIds: string[],
    amount: number,
    action: 'debit' | 'refund',
    now: number,
    adoptLegacyDebit = false,
    premiumIds: readonly string[] = [],
): Promise<{ blocked: boolean; apply: () => void }> {
    const operations = await Promise.all(playerIds.map(async uid => {
        const user = db.collection('users').doc(uid);
        const entries = db.collection('coin_wallets').doc(uid).collection('entries');
        const entry = entries.doc(operationKey('match_' + action, sessionId, uid));
        const [account, legacyDebit, legacyRefund, sessionDebit, sessionRefund] = await Promise.all([
            tx.get(user),
            adoptLegacyDebit || action === 'refund' ? tx.get(entries.doc(operationKey('room_buyin', roomId, uid))) : null,
            adoptLegacyDebit || action === 'refund' ? tx.get(entries.doc(operationKey('room_refund', roomId, uid))) : null,
            action === 'refund' ? tx.get(entries.doc(operationKey('match_debit', sessionId, uid))) : null,
            action === 'refund' ? tx.get(entry) : null,
        ]);
        const alreadyPaid = legacyDebit?.data()?.amount === -amount && !legacyRefund?.exists;
        const balance = account.data()?.economy?.coins;
        const clearActiveRoom = action === 'refund' && account.get('activeRoomId') === roomId;
        if (action === 'debit') {
            const buyIn = alreadyPaid ? { balanceAfter: balance, paidAmount: amount }
                : resolveMatchBuyIn(balance, amount, premiumIds.includes(uid));
            return { user, entry, balance, buyIn, clearActiveRoom, record: true };
        }

        const recordedAmount = sessionDebit?.get('paidAmount');
        // Les sessions antérieures au journal des mises offertes n'enregistraient
        // aucun débit de session quand la mise historique avait été reprise.
        const paidAmount = recordedAmount ?? (sessionDebit?.get('amount') === -amount || alreadyPaid ? amount : 0);
        const record = !sessionRefund?.exists && paidAmount > 0;
        const balanceAfter = (record ? balance + paidAmount : balance);
        const buyIn = record && (!Number.isSafeInteger(balance) || balance < 0 || paidAmount !== amount
            || !Number.isSafeInteger(balanceAfter)) ? null : { balanceAfter, paidAmount };
        return { user, entry, balance, buyIn, clearActiveRoom, record };
    }));
    const blocked = operations.some(({ buyIn }) => !buyIn);
    return {
        blocked,
        apply: () => operations.forEach(({ user, entry, balance, buyIn, clearActiveRoom, record }) => {
            if (!buyIn) return;
            const { balanceAfter, paidAmount } = buyIn;
            const balanceChanged = balanceAfter !== balance;
            if (balanceChanged || clearActiveRoom) {
                tx.update(user, {
                    ...(balanceChanged ? { 'economy.coins': balanceAfter } : {}),
                    ...(clearActiveRoom ? { activeRoomId: null } : {}),
                });
            }
            if (!record) return;
            tx.create(entry, {
                amount: balanceAfter - balance,
                paidAmount,
                balanceAfter,
                reason: action === 'debit' ? 'MULTIPLAYER_BUY_IN' : 'MULTIPLAYER_BUY_IN_REFUND',
                createdAt: now,
            });
        }),
    };
}
