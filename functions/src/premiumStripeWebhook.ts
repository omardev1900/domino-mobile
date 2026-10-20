import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { fulfillPaidRecharge } from './premiumSalesFulfillment';
import { verifyStripeWebhookSignature } from './stripeWebhookSignature';

const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const premiumCodeSecret = defineSecret('PREMIUM_CODE_SECRET');

type StripeEvent = {
    id?: string;
    type?: string;
    data?: { object?: { client_reference_id?: string; metadata?: { saleId?: string }; payment_status?: string } };
};

export function getPaidRechargeSaleId(event: StripeEvent): string | null {
    if (event.type !== 'checkout.session.completed' || event.data?.object?.payment_status !== 'paid') return null;
    const saleId = event.data.object.metadata?.saleId ?? event.data.object.client_reference_id;
    return typeof saleId === 'string' && saleId.length > 0 ? saleId : null;
}

export const createStripeWebhook = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30, secrets: [stripeWebhookSecret, premiumCodeSecret] })
        .https.onRequest(async (req, res) => {
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return;
            }
            const rawBody = req.rawBody;
            const signature = req.header('stripe-signature');
            if (!verifyStripeWebhookSignature(rawBody, signature, stripeWebhookSecret.value())) {
                res.status(400).send('Invalid Stripe signature');
                return;
            }

            let event: StripeEvent;
            try {
                event = JSON.parse(rawBody.toString('utf8')) as StripeEvent;
            } catch {
                res.status(400).send('Invalid event payload');
                return;
            }
            const saleId = getPaidRechargeSaleId(event);
            if (!saleId || !event.id) {
                res.status(200).send('Event ignored');
                return;
            }

            try {
                const saleSnapshot = await db.collection('premium_sales').doc(saleId).get();
                if (saleSnapshot.data()?.kind !== 'RECHARGE') {
                    res.status(200).send('Subscription event recorded separately');
                    return;
                }
                await fulfillPaidRecharge(db, saleId, event.id, premiumCodeSecret.value());
                res.status(200).send('Recharge fulfilled');
            } catch (error) {
                functions.logger.error('Impossible de traiter le webhook Stripe.', { eventId: event.id, saleId, error });
                res.status(500).send('Webhook processing failed');
            }
        });
