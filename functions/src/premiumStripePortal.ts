import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const WEB_APP_ORIGIN = 'https://www.domino-martinique.online';

export function buildStripePortalForm(customerId: string): URLSearchParams {
    return new URLSearchParams({ customer: customerId, return_url: `${WEB_APP_ORIGIN}/premium` });
}

export const createStripeCustomerPortal = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').runWith({ timeoutSeconds: 30, secrets: [stripeSecretKey] })
        .https.onCall(async (_data, context) => {
            if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
            const subscriptions = await db.collection('premium_subscriptions')
                .where('accountUid', '==', context.auth.uid).limit(10).get();
            const customerId = subscriptions.docs
                .map(document => document.data().stripeCustomerId)
                .find((value): value is string => typeof value === 'string' && value.length > 0);
            if (!customerId) throw new functions.https.HttpsError('failed-precondition', 'Aucun abonnement Stripe actif pour ce compte.');
            const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${stripeSecretKey.value()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: buildStripePortalForm(customerId).toString(),
            });
            const portal = await response.json() as { url?: string };
            if (!response.ok || !portal.url) throw new functions.https.HttpsError('internal', 'Portail Stripe indisponible.');
            return { url: portal.url };
        });
