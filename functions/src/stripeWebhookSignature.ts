import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } | null {
    const values = header.split(',').map(part => part.trim().split('='));
    const timestamp = Number(values.find(([key]) => key === 't')?.[1]);
    const signatures = values.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean);
    if (!Number.isSafeInteger(timestamp) || signatures.length === 0) return null;
    return { timestamp, signatures };
}

export function verifyStripeWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secret: string,
    now = Date.now(),
): boolean {
    if (!signatureHeader || !secret) return false;
    const parsed = parseStripeSignature(signatureHeader);
    if (!parsed || Math.abs(now - parsed.timestamp * 1_000) > MAX_WEBHOOK_AGE_SECONDS * 1_000) return false;
    const expected = createHmac('sha256', secret).update(`${parsed.timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    return parsed.signatures.some(signature => {
        const received = Buffer.from(signature, 'utf8');
        const computed = Buffer.from(expected, 'utf8');
        return received.length === computed.length && timingSafeEqual(received, computed);
    });
}
