/**
 * Borne canonique du mois courant en UTC.
 * Tous les clients partagent ainsi la même fenêtre mensuelle,
 * indépendamment du fuseau horaire local du device.
 */
export const getStartOfCurrentMonthUtc = (now: Date = new Date()): number =>
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

export const getYearMonthUtcString = (now: Date = new Date()): string => {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

