import { createHmac } from 'node:crypto';

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
