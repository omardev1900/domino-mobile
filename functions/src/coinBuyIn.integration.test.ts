import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { settleMatchBuyIn } from './coinBuyIn';

describe('mises et remboursements serveur', () => {
    let app: admin.app.App; let db: admin.firestore.Firestore;
    const uid = 'buyin-server-test'; const now = 1700000000000;
    before(async () => { app = admin.initializeApp({ projectId: 'demo-domino' }, 'buyin-server-test'); db = app.firestore(); await db.collection('users').doc(uid).set({ economy: { coins: 200 } }); });
    after(async () => app.delete());
    it('applique une mise concurrente une seule fois et respecte la réserve', async () => {
        const results = await Promise.all([settleMatchBuyIn(db, uid, 'match1', 'debit', now), settleMatchBuyIn(db, uid, 'match1', 'debit', now)]);
        assert.equal(results.every(result => result.ok), true);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 100);
        assert.deepEqual(await settleMatchBuyIn(db, uid, 'match2', 'debit', now), { ok: false, reason: 'INSUFFICIENT_COINS' });
    });
    it('ne rembourse qu’une mise existante et une seule fois', async () => {
        assert.deepEqual(await settleMatchBuyIn(db, uid, 'unknown', 'refund', now), { ok: false, reason: 'BUY_IN_NOT_FOUND' });
        const results = await Promise.all([settleMatchBuyIn(db, uid, 'match1', 'refund', now), settleMatchBuyIn(db, uid, 'match1', 'refund', now)]);
        assert.equal(results.every(result => result.ok), true);
        assert.equal((await db.collection('users').doc(uid).get()).data()?.economy.coins, 200);
        assert.deepEqual(await settleMatchBuyIn(db, uid, 'match1', 'debit', now), { ok: false, reason: 'ALREADY_REFUNDED' });
        assert.equal((await db.collection('coin_wallets').doc(uid).collection('entries').get()).size, 2);
    });

    it('maintient la réserve Premium en solo et rembourse seulement les mises payées', async () => {
        const premium = 'solo-premium-reserve';
        const user = db.collection('users').doc(premium);
        await user.set({ economy: { coins: 0 } });
        await db.collection('premium_entitlements').doc(premium).set({
            expiresAt: admin.firestore.Timestamp.fromMillis(now + 10_000),
        });
        await Promise.all(['premium-1', 'premium-2'].map(id => settleMatchBuyIn(db, premium, id, 'debit', now)));
        assert.equal((await user.get()).get('economy.coins'), 100);
        await settleMatchBuyIn(db, premium, 'premium-1', 'refund', now);
        assert.equal((await user.get()).get('economy.coins'), 100);

        for (const balance of [100, 199, 200]) {
            await user.update({ 'economy.coins': balance });
            const id = `premium-balance-${balance}`;
            const debit = await settleMatchBuyIn(db, premium, id, 'debit', now);
            assert.ok(debit.ok && 'paidAmount' in debit);
            assert.equal(debit.paidAmount, balance === 200 ? 100 : 0);
            assert.equal((await user.get()).get('economy.coins'), balance === 200 ? 100 : balance);
            await settleMatchBuyIn(db, premium, id, 'refund', now);
            assert.equal((await user.get()).get('economy.coins'), balance);
        }

        await user.update({ 'economy.coins': 100 });
        assert.deepEqual(await settleMatchBuyIn(db, premium, 'expired', 'debit', now + 10_000), {
            ok: false, reason: 'INSUFFICIENT_COINS',
        });
    });
});
