import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { fulfillPaidRecharge } from './premiumSalesFulfillment';
import { fulfillPaidSubscriptionPeriod, recordSubscriptionStatus } from './premiumSubscriptionFulfillment';
import { verifyStripeWebhookSignature } from './stripeWebhookSignature';

const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const premiumCodeSecret = defineSecret('PREMIUM_CODE_SECRET');

type StripeObject = { id?: string; client_reference_id?: string; metadata?: { saleId?: string }; payment_status?: string; subscription?: string; customer?: string; status?: string; current_period_end?: number; cancel_at_period_end?: boolean; lines?: { data?: Array<{ period?: { end?: number } }> } };
type StripeEvent = { id?: string; type?: string; data?: { object?: StripeObject } };
const nonEmpty = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;

export function getPaidRechargeSaleId(event: StripeEvent): string | null {
    if (event.type !== 'checkout.session.completed' || event.data?.object?.payment_status !== 'paid') return null;
    return nonEmpty(event.data.object.metadata?.saleId) ?? nonEmpty(event.data.object.client_reference_id);
}

export function getStartedSubscription(event: StripeEvent): { saleId: string; subscriptionId: string; sessionId: string; customerId?: string } | null {
    if (event.type !== 'checkout.session.completed' || event.data?.object?.payment_status !== 'paid') return null;
    const saleId = nonEmpty(event.data.object.metadata?.saleId) ?? nonEmpty(event.data.object.client_reference_id);
    const subscriptionId = nonEmpty(event.data.object.subscription);
    const sessionId = nonEmpty(event.data.object.id);
    if (!saleId || !subscriptionId || !sessionId) return null;
    return { saleId, subscriptionId, sessionId, ...(nonEmpty(event.data.object.customer) ? { customerId: event.data.object.customer } : {}) };
}

export function getPaidSubscriptionInvoice(event: StripeEvent): { invoiceId: string; subscriptionId: string; customerId?: string; periodEnd?: number } | null {
    if (event.type !== 'invoice.paid') return null;
    const invoiceId = nonEmpty(event.data?.object?.id);
    const subscriptionId = nonEmpty(event.data?.object?.subscription);
    if (!invoiceId || !subscriptionId) return null;
    const seconds = event.data?.object?.lines?.data?.find(line => typeof line.period?.end === 'number')?.period?.end;
    return { invoiceId, subscriptionId, ...(nonEmpty(event.data?.object?.customer) ? { customerId: event.data?.object?.customer } : {}), ...(seconds ? { periodEnd: seconds * 1_000 } : {}) };
}

export function getFailedSubscriptionInvoice(event: StripeEvent): { subscriptionId: string } | null {
    if (event.type !== 'invoice.payment_failed') return null;
    const subscriptionId = nonEmpty(event.data?.object?.subscription);
    return subscriptionId ? { subscriptionId } : null;
}

export function getSubscriptionLifecycle(event: StripeEvent): { subscriptionId: string; status: string; currentPeriodEnd?: number; cancelAtPeriodEnd?: boolean } | null {
    if (event.type !== 'customer.subscription.updated' && event.type !== 'customer.subscription.deleted') return null;
    const subscriptionId = nonEmpty(event.data?.object?.id);
    const status = nonEmpty(event.data?.object?.status);
    if (!subscriptionId || !status) return null;
    const seconds = event.data?.object?.current_period_end;
    return { subscriptionId, status, ...(typeof seconds === 'number' ? { currentPeriodEnd: seconds * 1_000 } : {}), ...(typeof event.data?.object?.cancel_at_period_end === 'boolean' ? { cancelAtPeriodEnd: event.data.object.cancel_at_period_end } : {}) };
}

type StripeSubscription = { customer?: string; current_period_end?: number; metadata?: { saleId?: string } };
async function fetchStripeSubscription(subscriptionId: string): Promise<StripeSubscription> {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { headers: { Authorization: `Bearer ${stripeSecretKey.value()}` } });
    if (!response.ok) throw new Error('Abonnement Stripe introuvable.');
    return response.json() as Promise<StripeSubscription>;
}

export const createStripeWebhook = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').runWith({ timeoutSeconds: 30, secrets: [stripeWebhookSecret, stripeSecretKey, premiumCodeSecret] })
        .https.onRequest(async (req, res) => {
            if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
            if (!verifyStripeWebhookSignature(req.rawBody, req.header('stripe-signature'), stripeWebhookSecret.value())) { res.status(400).send('Invalid Stripe signature'); return; }
            let event: StripeEvent;
            try { event = JSON.parse(req.rawBody.toString('utf8')) as StripeEvent; } catch { res.status(400).send('Invalid event payload'); return; }
            if (!event.id) { res.status(200).send('Event ignored'); return; }
            try {
                const rechargeSaleId = getPaidRechargeSaleId(event);
                if (rechargeSaleId) {
                    const sale = await db.collection('premium_sales').doc(rechargeSaleId).get();
                    if (sale.data()?.kind === 'RECHARGE') { await fulfillPaidRecharge(db, rechargeSaleId, event.id, premiumCodeSecret.value()); res.status(200).send('Recharge fulfilled'); return; }
                }
                const started = getStartedSubscription(event);
                if (started) {
                    const subscription = await fetchStripeSubscription(started.subscriptionId);
                    const periodEnd = subscription.current_period_end ? subscription.current_period_end * 1_000 : undefined;
                    if (!periodEnd) throw new Error('Période Stripe manquante.');
                    await fulfillPaidSubscriptionPeriod(db, { saleId: started.saleId, subscriptionId: started.subscriptionId, customerId: started.customerId ?? subscription.customer, invoiceId: `checkout_${started.sessionId}`, eventId: event.id, periodEnd });
                    res.status(200).send('Subscription started'); return;
                }
                const invoice = getPaidSubscriptionInvoice(event);
                if (invoice) {
                    const subscription = await fetchStripeSubscription(invoice.subscriptionId);
                    const saleId = nonEmpty(subscription.metadata?.saleId);
                    const periodEnd = invoice.periodEnd ?? (subscription.current_period_end ? subscription.current_period_end * 1_000 : undefined);
                    if (!saleId || !periodEnd) throw new Error('Données de renouvellement Stripe manquantes.');
                    await fulfillPaidSubscriptionPeriod(db, { saleId, subscriptionId: invoice.subscriptionId, customerId: invoice.customerId ?? subscription.customer, invoiceId: invoice.invoiceId, eventId: event.id, periodEnd });
                    res.status(200).send('Subscription renewed'); return;
                }
                const lifecycle = getSubscriptionLifecycle(event);
                if (lifecycle) { await recordSubscriptionStatus(db, lifecycle.subscriptionId, lifecycle.status, lifecycle.currentPeriodEnd, lifecycle.cancelAtPeriodEnd); res.status(200).send('Subscription lifecycle recorded'); return; }
                const failedInvoice = getFailedSubscriptionInvoice(event);
                if (failedInvoice) { await recordSubscriptionStatus(db, failedInvoice.subscriptionId, 'PAYMENT_FAILED'); res.status(200).send('Subscription payment failure recorded'); return; }
                res.status(200).send('Event ignored');
            } catch (error) {
                functions.logger.error('Impossible de traiter le webhook Stripe.', { eventId: event.id, error });
                res.status(500).send('Webhook processing failed');
            }
        });
