import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { derivePaidRechargeCode } from './premiumSalesFulfillment';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const premiumCodeSecret = defineSecret('PREMIUM_CODE_SECRET');
const WEB_APP_ORIGIN = 'https://www.domino-martinique.online';
const LOCAL_WEB_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function applyCors(req: functions.https.Request, res: functions.Response<any>): boolean {
    const origin = req.headers.origin;
    if (origin === WEB_APP_ORIGIN || (origin !== undefined && LOCAL_WEB_ORIGIN.test(origin))) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
    return false;
}

export function isStripeCheckoutSessionId(value: unknown): value is string {
    return typeof value === 'string' && /^cs_(test|live)_[A-Za-z0-9]+$/.test(value);
}

type StripeCheckoutSession = { id?: string; payment_status?: string; metadata?: { saleId?: string } };

export const createPremiumRechargeCodeReader = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').runWith({ timeoutSeconds: 30, secrets: [stripeSecretKey, premiumCodeSecret] })
        .https.onRequest(async (req, res) => {
            if (applyCors(req, res)) return;
            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Méthode non autorisée.' });
                return;
            }
            const sessionId = req.body?.sessionId;
            if (!isStripeCheckoutSessionId(sessionId)) {
                res.status(400).json({ error: 'Session de paiement invalide.' });
                return;
            }
            const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
                headers: { Authorization: `Bearer ${stripeSecretKey.value()}` },
            });
            if (!response.ok) { res.status(404).json({ error: 'Session Stripe introuvable.' }); return; }
            const session = await response.json() as StripeCheckoutSession;
            const saleId = session.metadata?.saleId;
            if (session.payment_status !== 'paid' || !saleId) { res.status(202).json({ pending: true }); return; }
            const saleSnapshot = await db.collection('premium_sales').doc(saleId).get();
            const sale = saleSnapshot.data() as { kind?: string; status?: string; stripeCheckoutSessionId?: string; productId?: string } | undefined;
            if (!sale || sale.kind !== 'RECHARGE' || sale.status !== 'PAID' || sale.stripeCheckoutSessionId !== session.id || !sale.productId) {
                res.status(202).json({ pending: true });
                return;
            }
            res.status(200).json({ code: derivePaidRechargeCode(saleId, premiumCodeSecret.value()), productId: sale.productId });
        });
