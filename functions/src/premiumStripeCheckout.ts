import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { z, ZodError } from 'zod';
import { getPremiumSaleProduct, PremiumSaleProduct } from './premiumSalesCatalog';
import { premiumTestAccessSecret, verifyPremiumTestToken } from './premiumTestAccess';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const WEB_APP_ORIGIN = 'https://www.domino-martinique.online';
const LOCAL_WEB_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const checkoutInputSchema = z.object({
    productId: z.string().min(1).max(80),
    email: z.string().trim().email().max(320).optional(),
}).strict();

type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export function buildStripeCheckoutForm(
    product: PremiumSaleProduct,
    saleId: string,
    input: Pick<CheckoutInput, 'email'>,
): URLSearchParams {
    const form = new URLSearchParams({
        mode: product.kind === 'SUBSCRIPTION' ? 'subscription' : 'payment',
        success_url: `${WEB_APP_ORIGIN}/premium/succes?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${WEB_APP_ORIGIN}/premium/annule`,
        client_reference_id: saleId,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': product.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(product.priceCents),
        'line_items[0][price_data][product_data][name]': product.label,
        'metadata[saleId]': saleId,
        'metadata[productId]': product.id,
    });
    if (product.kind === 'SUBSCRIPTION') {
        form.set('line_items[0][price_data][recurring][interval]', product.id.endsWith('yearly') ? 'year' : 'month');
        form.set('subscription_data[metadata][saleId]', saleId);
        form.set('subscription_data[metadata][productId]', product.id);
    }
    if (input.email) {
        form.set('customer_email', input.email);
    }
    return form;
}

export function requireSubscriptionEmail(product: PremiumSaleProduct, email: string | undefined): string | undefined {
    if (product.kind === 'SUBSCRIPTION' && !email) {
        throw new Error('Un e-mail de compte Domino est requis pour un abonnement.');
    }
    return email;
}

function applyCors(req: functions.https.Request, res: functions.Response<any>): boolean {
    const origin = req.headers.origin;
    if (origin === WEB_APP_ORIGIN || (origin !== undefined && LOCAL_WEB_ORIGIN.test(origin))) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}

export const createStripeCheckout = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30, secrets: [stripeSecretKey, premiumTestAccessSecret] })
        .https.onRequest(async (req, res) => {
            if (applyCors(req, res)) return;
            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Méthode non autorisée.' });
                return;
            }
            const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
            if (!verifyPremiumTestToken(token, premiumTestAccessSecret.value())) {
                res.status(401).json({ error: 'Accès Premium de test requis.' });
                return;
            }

            let input: CheckoutInput;
            let product: PremiumSaleProduct;
            let accountUid: string | null = null;
            try {
                input = checkoutInputSchema.parse(req.body);
                product = getPremiumSaleProduct(input.productId);
                const email = requireSubscriptionEmail(product, input.email);
                if (product.kind === 'SUBSCRIPTION' && email) {
                    accountUid = (await admin.auth().getUserByEmail(email)).uid;
                }
            } catch (error) {
                const message = error instanceof ZodError || error instanceof Error
                    ? 'Offre ou e-mail invalide.'
                    : 'Demande invalide.';
                res.status(400).json({ error: message });
                return;
            }

            const saleRef = db.collection('premium_sales').doc();
            await saleRef.set({
                productId: product.id,
                kind: product.kind,
                durationDays: product.durationDays,
                priceCents: product.priceCents,
                currency: product.currency,
                coins: product.coins,
                provider: 'STRIPE',
                email: input.email ?? null,
                accountUid,
                status: 'CHECKOUT_CREATED',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            try {
                const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${stripeSecretKey.value()}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: buildStripeCheckoutForm(product, saleRef.id, input).toString(),
                });
                const stripePayload = await stripeResponse.json() as { id?: string; url?: string };
                if (!stripeResponse.ok || !stripePayload.id || !stripePayload.url) {
                    throw new Error('Stripe n’a pas créé de session de paiement.');
                }
                await saleRef.update({
                    stripeCheckoutSessionId: stripePayload.id,
                    status: 'CHECKOUT_OPEN',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                res.status(201).json({ checkoutUrl: stripePayload.url });
            } catch (error) {
                await saleRef.update({
                    status: 'CHECKOUT_ERROR',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.error('Impossible de créer une session Stripe Checkout.', { saleId: saleRef.id, error });
                res.status(502).json({ error: 'Le paiement est indisponible. Réessayez plus tard.' });
            }
        });
