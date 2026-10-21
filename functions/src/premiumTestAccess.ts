import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const premiumTestAccessPassword = defineSecret('PREMIUM_TEST_ACCESS_PASSWORD');
export const premiumTestAccessSecret = defineSecret('PREMIUM_TEST_ACCESS_SECRET');
const WEB_APP_ORIGIN = 'https://www.domino-martinique.online';
const LOCAL_WEB_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function applyCors(req: functions.https.Request, res: functions.Response<any>): boolean {
    const origin = req.headers.origin;
    if (origin === WEB_APP_ORIGIN || (origin !== undefined && LOCAL_WEB_ORIGIN.test(origin))) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
    return false;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function passwordMatches(candidate: string, expected: string): boolean {
    const actualDigest = digest(candidate);
    const expectedDigest = digest(expected);
    return timingSafeEqual(actualDigest, expectedDigest);
}

export function createPremiumTestToken(secret: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ exp: now + 60 * 60 * 1_000 })).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

export function verifyPremiumTestToken(token: string | undefined, secret: string, now = Date.now()): boolean {
    if (!token) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
        return typeof decoded.exp === 'number' && decoded.exp > now;
    } catch { return false; }
}

export const createPremiumTestAccess = () =>
    functions.region('europe-west1').runWith({ timeoutSeconds: 30, secrets: [premiumTestAccessPassword, premiumTestAccessSecret] })
        .https.onRequest((req, res) => {
            if (applyCors(req, res)) return;
            if (req.method !== 'POST' || typeof req.body?.password !== 'string' || !passwordMatches(req.body.password, premiumTestAccessPassword.value())) {
                res.status(401).json({ error: 'Mot de passe invalide.' });
                return;
            }
            res.status(200).json({ token: createPremiumTestToken(premiumTestAccessSecret.value()) });
        });
