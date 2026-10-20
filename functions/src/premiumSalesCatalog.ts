/**
 * Catalogue public et immuable des ventes Premium.
 *
 * Les prix sont exprimés en centimes pour ne jamais dépendre d'un arrondi côté
 * client. Les identifiants sont ceux persistés par les ventes et les webhooks.
 */
export type PremiumSaleProductId =
    | 'premium_recharge_3d'
    | 'premium_recharge_7d'
    | 'premium_recharge_30d'
    | 'premium_subscription_monthly'
    | 'premium_subscription_yearly';

export type PremiumSaleProduct = Readonly<{
    id: PremiumSaleProductId;
    kind: 'RECHARGE' | 'SUBSCRIPTION';
    label: string;
    durationDays: number;
    priceCents: number;
    currency: 'EUR';
    coins: number;
}>;

export const PREMIUM_SALE_CATALOG: Readonly<Record<PremiumSaleProductId, PremiumSaleProduct>> = Object.freeze({
    premium_recharge_3d: {
        id: 'premium_recharge_3d',
        kind: 'RECHARGE',
        label: 'Recharge Premium 3 jours',
        durationDays: 3,
        priceCents: 199,
        currency: 'EUR',
        coins: 300,
    },
    premium_recharge_7d: {
        id: 'premium_recharge_7d',
        kind: 'RECHARGE',
        label: 'Recharge Premium 7 jours',
        durationDays: 7,
        priceCents: 399,
        currency: 'EUR',
        coins: 700,
    },
    premium_recharge_30d: {
        id: 'premium_recharge_30d',
        kind: 'RECHARGE',
        label: 'Recharge Premium 30 jours',
        durationDays: 30,
        priceCents: 799,
        currency: 'EUR',
        coins: 1_000,
    },
    premium_subscription_monthly: {
        id: 'premium_subscription_monthly',
        kind: 'SUBSCRIPTION',
        label: 'Premium mensuel',
        durationDays: 31,
        priceCents: 599,
        currency: 'EUR',
        coins: 2_000,
    },
    premium_subscription_yearly: {
        id: 'premium_subscription_yearly',
        kind: 'SUBSCRIPTION',
        label: 'Premium annuel',
        durationDays: 366,
        priceCents: 5_999,
        currency: 'EUR',
        coins: 30_000,
    },
});

export const PREMIUM_SALE_PRODUCTS = Object.freeze(Object.values(PREMIUM_SALE_CATALOG));

export function isPremiumSaleProductId(value: string): value is PremiumSaleProductId {
    return Object.prototype.hasOwnProperty.call(PREMIUM_SALE_CATALOG, value);
}

export function getPremiumSaleProduct(productId: string): PremiumSaleProduct {
    if (!isPremiumSaleProductId(productId)) {
        throw new Error(`Produit Premium inconnu : ${productId}`);
    }
    return PREMIUM_SALE_CATALOG[productId];
}
