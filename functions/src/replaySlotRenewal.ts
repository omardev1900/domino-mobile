import * as admin from 'firebase-admin';
import { isActivePremiumEntitlement } from './premiumAccess';
import { EXTRA_SLOT_COST, SLOT_PERIOD_MS } from './replaySlotPurchase';

/** Transactional worker; intentionally not scheduled until legacy client coin writes are migrated. */
export async function renewReplaySlot(db: admin.firestore.Firestore, uid: string, slotId: string, now = Date.now()) {
    const library = db.collection('replay_libraries').doc(uid);
    const slot = library.collection('extra_slots').doc(slotId);
    const user = db.collection('users').doc(uid);
    const premium = db.collection('premium_entitlements').doc(uid);
    return db.runTransaction(async tx => {
        const [slotSnap, userSnap, premiumSnap] = await Promise.all([tx.get(slot), tx.get(user), tx.get(premium)]);
        const data = slotSnap.data();
        if (!data || data.status !== 'active' || typeof data.expiresAt !== 'number' || data.expiresAt > now) return { result: 'not_due' as const };
        if (!isActivePremiumEntitlement(premiumSnap.data(), now)) return { result: 'premium_inactive' as const };
        // This worker cannot be activated until Firestore rules and every supported
        // client enforce this server-owned balance; a local cache is insufficient.
        if (userSnap.data()?.coinAuthority !== 'server') return { result: 'authority_required' as const };
        const coins: unknown = userSnap.data()?.economy?.coins;
        if (typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) return { result: 'balance_invalid' as const };
        if (coins < EXTRA_SLOT_COST) {
            tx.update(slot, { status: 'retained', lossAt: data.expiresAt });
            return { result: 'insufficient' as const };
        }
        // At most one renewal is charged for a delayed worker execution; a fresh
        // 30-day period starts at the later of the scheduled time and execution.
        const expiresAt = Math.max(data.expiresAt, now) + SLOT_PERIOD_MS;
        const ledger = db.collection('coin_wallets').doc(uid).collection('entries').doc(`renew_${slotId}_${data.expiresAt}`);
        tx.update(user, { 'economy.coins': coins - EXTRA_SLOT_COST });
        tx.update(slot, { expiresAt, renewedAt: now });
        tx.create(ledger, { amount: -EXTRA_SLOT_COST, reason: 'REPLAY_SLOT_RENEWAL', slotId, createdAt: now, balanceAfter: coins - EXTRA_SLOT_COST });
        return { result: 'renewed' as const, expiresAt, remainingCoins: coins - EXTRA_SLOT_COST };
    });
}
