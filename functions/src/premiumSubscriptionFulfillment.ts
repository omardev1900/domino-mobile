import * as admin from 'firebase-admin';
import { getPremiumSaleProduct } from './premiumSalesCatalog';

type SubscriptionSale = { kind?: string; productId?: string; accountUid?: string | null };
type StoredSubscription = { saleId?: string; productId?: string; accountUid?: string; currentPeriodEnd?: admin.firestore.Timestamp };
type Entitlement = { expiresAt?: admin.firestore.Timestamp; trialUsedAt?: admin.firestore.Timestamp };
type Economy = { coins?: number };

export type PaidSubscriptionPeriod = {
    saleId: string;
    subscriptionId: string;
    customerId?: string;
    invoiceId: string;
    eventId: string;
    periodEnd: number;
};

const toMillis = (value: admin.firestore.Timestamp | undefined): number => value?.toMillis() ?? 0;

/**
 * Crédite une période Stripe déjà payée. Le document de période constitue une
 * seconde barrière d'idempotence : un Checkout et sa facture initiale ne
 * peuvent jamais attribuer deux fois les coins.
 */
export async function fulfillPaidSubscriptionPeriod(
    db: admin.firestore.Firestore,
    payment: PaidSubscriptionPeriod,
): Promise<{ alreadyFulfilled: boolean }> {
    const saleRef = db.collection('premium_sales').doc(payment.saleId);
    const subscriptionRef = db.collection('premium_subscriptions').doc(payment.subscriptionId);
    const periodRef = db.collection('premium_subscription_periods').doc(`${payment.subscriptionId}_${payment.periodEnd}`);
    const invoiceRef = db.collection('premium_subscription_invoices').doc(payment.invoiceId);
    const eventRef = db.collection('premium_payment_events').doc(payment.eventId);

    return db.runTransaction(async transaction => {
        const [saleSnapshot, subscriptionSnapshot, periodSnapshot, invoiceSnapshot, eventSnapshot] = await Promise.all([
            transaction.get(saleRef), transaction.get(subscriptionRef), transaction.get(periodRef), transaction.get(invoiceRef), transaction.get(eventRef),
        ]);
        const sale = saleSnapshot.exists ? saleSnapshot.data() as SubscriptionSale : undefined;
        const stored = subscriptionSnapshot.exists ? subscriptionSnapshot.data() as StoredSubscription : undefined;
        if (!sale || sale.kind !== 'SUBSCRIPTION' || !sale.productId || !sale.accountUid) {
            throw new Error('Vente d’abonnement introuvable ou non liée à un compte.');
        }
        if (stored && (stored.saleId !== payment.saleId || stored.accountUid !== sale.accountUid || stored.productId !== sale.productId)) {
            throw new Error('Abonnement Stripe incohérent.');
        }
        const product = getPremiumSaleProduct(sale.productId);
        if (product.kind !== 'SUBSCRIPTION') throw new Error('Le produit de la vente ne correspond pas à un abonnement.');

        const entitlementRef = db.collection('premium_entitlements').doc(sale.accountUid);
        const userRef = db.collection('users').doc(sale.accountUid);
        const [entitlementSnapshot, userSnapshot] = await Promise.all([
            transaction.get(entitlementRef), transaction.get(userRef),
        ]);
        const entitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() as Entitlement : undefined;
        const economy = (userSnapshot.data()?.economy ?? {}) as Economy;
        const alreadyFulfilled = periodSnapshot.exists || invoiceSnapshot.exists;

        transaction.set(eventRef, {
            provider: 'STRIPE', type: 'SUBSCRIPTION_PAYMENT', saleId: payment.saleId, subscriptionId: payment.subscriptionId,
            invoiceId: payment.invoiceId, processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(subscriptionRef, {
            saleId: payment.saleId, productId: product.id, accountUid: sale.accountUid, stripeCustomerId: payment.customerId ?? null,
            status: 'ACTIVE', currentPeriodEnd: admin.firestore.Timestamp.fromMillis(payment.periodEnd),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.update(saleRef, {
            stripeSubscriptionId: payment.subscriptionId, status: 'SUBSCRIPTION_ACTIVE',
            currentPeriodEnd: admin.firestore.Timestamp.fromMillis(payment.periodEnd), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(invoiceRef, {
            saleId: payment.saleId, subscriptionId: payment.subscriptionId, periodEnd: payment.periodEnd,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        if (alreadyFulfilled) return { alreadyFulfilled: true };

        transaction.set(periodRef, {
            saleId: payment.saleId, subscriptionId: payment.subscriptionId, invoiceId: payment.invoiceId,
            periodEnd: admin.firestore.Timestamp.fromMillis(payment.periodEnd), coins: product.coins,
            fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(entitlementRef, {
            source: 'SUBSCRIPTION',
            startsAt: admin.firestore.Timestamp.fromMillis(Date.now()),
            expiresAt: admin.firestore.Timestamp.fromMillis(Math.max(toMillis(entitlement?.expiresAt), payment.periodEnd)),
            ...(entitlement?.trialUsedAt ? { trialUsedAt: entitlement.trialUsedAt } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(userRef, {
            economy: { ...economy, coins: (typeof economy.coins === 'number' ? economy.coins : 0) + product.coins },
        }, { merge: true });
        return { alreadyFulfilled: false };
    });
}

export async function recordSubscriptionStatus(
    db: admin.firestore.Firestore,
    subscriptionId: string,
    status: string,
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean,
): Promise<void> {
    const ref = db.collection('premium_subscriptions').doc(subscriptionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return;
    await ref.set({
        status,
        ...(currentPeriodEnd ? { currentPeriodEnd: admin.firestore.Timestamp.fromMillis(currentPeriodEnd) } : {}),
        ...(cancelAtPeriodEnd === undefined ? {} : { cancelAtPeriodEnd }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
