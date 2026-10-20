import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { derivePaidRechargeCode } from './premiumSalesFulfillment';
import { getPremiumSaleProduct } from './premiumSalesCatalog';

const brevoApiKey = defineSecret('BREVO_API_KEY');
const premiumCodeSecret = defineSecret('PREMIUM_CODE_SECRET');
const SENDER = { email: 'contact@domino-martinique.online', name: 'Domino Martinique' };

type RechargeOutbox = { email?: string; productId?: string };

export function buildBrevoRechargeEmail(email: string, code: string, productId: string) {
    const product = getPremiumSaleProduct(productId);
    return {
        sender: SENDER,
        to: [{ email }],
        subject: 'Votre code Premium Domino Martinique',
        htmlContent: `<h1>Votre code Premium</h1><p>Merci pour votre achat de <strong>${product.label}</strong>.</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${code}</p><p>Ce code est utilisable une seule fois pendant 3 mois. Ouvrez l’application Domino Martinique puis activez-le dans Premium.</p>`,
        textContent: `Votre code Premium Domino Martinique : ${code}. Il donne ${product.durationDays} jours Premium et ${product.coins} coins. Utilisable une seule fois pendant 3 mois.`,
    };
}

export const createRechargeCodeEmailSender = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30, secrets: [brevoApiKey, premiumCodeSecret] })
        .firestore.document('premium_outbox/{saleId}')
        .onCreate(async (snapshot, context) => {
            const outbox = snapshot.data() as RechargeOutbox;
            const saleId = context.params.saleId;
            if (!outbox.email || !outbox.productId) {
                await snapshot.ref.update({ status: 'INVALID', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                return;
            }
            const code = derivePaidRechargeCode(saleId, premiumCodeSecret.value());
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'api-key': brevoApiKey.value(), 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(buildBrevoRechargeEmail(outbox.email, code, outbox.productId)),
            });
            if (!response.ok) {
                const detail = await response.text();
                functions.logger.error('Brevo a refusé l’e-mail de recharge.', { saleId, status: response.status, detail });
                await snapshot.ref.update({ status: 'ERROR', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                throw new Error('Envoi Brevo impossible.');
            }
            await snapshot.ref.update({ status: 'SENT', sentAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
