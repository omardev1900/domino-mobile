import * as admin from 'firebase-admin';
import { createHmac } from 'node:crypto';
import { hashPremiumCode } from './premiumAccess';
import { getPremiumSaleProduct } from './premiumSalesCatalog';

const RECHARGE_CODE_EXPIRY_DAYS = 90;

/**
 * Recrée de manière déterministe le code d'une vente depuis son identifiant.
 * La valeur n'est jamais persistée en clair et une relivraison de webhook ne
 * peut donc pas créer un deuxième code.
 */
export function derivePaidRechargeCode(saleId: string, codeSecret: string): string {
    const value = createHmac('sha256', codeSecret).update(saleId).digest('hex').slice(0, 12).toUpperCase();
    return `DM-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

export function paidRechargeExpiryAt(now = Date.now()): number {
    return now + RECHARGE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1_000;
}

type SaleData = { kind?: string; productId?: string; status?: string; email?: string | null };

export async function fulfillPaidRecharge(
    db: admin.firestore.Firestore,
    saleId: string,
    stripeEventId: string,
    codeSecret: string,
    now = Date.now(),
): Promise<{ code: string; alreadyFulfilled: boolean }> {
    const saleRef = db.collection('premium_sales').doc(saleId);
    const eventRef = db.collection('premium_payment_events').doc(stripeEventId);
    const code = derivePaidRechargeCode(saleId, codeSecret);
    const codeRef = db.collection('premium_codes').doc(hashPremiumCode(code));

    return db.runTransaction(async transaction => {
        const [saleSnapshot, eventSnapshot] = await Promise.all([
            transaction.get(saleRef),
            transaction.get(eventRef),
        ]);
        const sale = saleSnapshot.exists ? saleSnapshot.data() as SaleData : undefined;
        if (!sale || sale.kind !== 'RECHARGE' || !sale.productId) {
            throw new Error('Vente de recharge introuvable.');
        }
        if (eventSnapshot.exists || sale.status === 'PAID') {
            return { code, alreadyFulfilled: true };
        }
        const product = getPremiumSaleProduct(sale.productId);
        if (product.kind !== 'RECHARGE') {
            throw new Error('Le produit de la vente ne correspond pas à une recharge.');
        }

        transaction.set(codeRef, {
            active: true,
            durationDays: product.durationDays,
            bonusCoins: product.coins,
            expiresAt: admin.firestore.Timestamp.fromMillis(paidRechargeExpiryAt(now)),
            maxRedemptions: 1,
            redemptionCount: 0,
            source: 'STRIPE',
            saleId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(eventRef, {
            saleId,
            provider: 'STRIPE',
            type: 'RECHARGE_PAID',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (sale.email) {
            transaction.set(db.collection('premium_outbox').doc(saleId), {
                email: sale.email,
                productId: product.id,
                status: 'PENDING',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: false });
        }
        transaction.update(saleRef, {
            status: 'PAID',
            stripeEventId,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { code, alreadyFulfilled: false };
    });
}
