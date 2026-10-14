const RECENT_ACTIVITY_MS = 15 * 60 * 1000;

export function shouldRecordLastActivity(lastRecordedAt: number | null, now: number, intervalMs: number): boolean {
    return lastRecordedAt === null || now - lastRecordedAt >= intervalMs;
}

export function formatLastActivity(lastActiveAt: number | null, now: number = Date.now()): string {
    if (lastActiveAt === null) return 'Activité inconnue';

    const elapsedMs = Math.max(0, now - lastActiveAt);
    if (elapsedMs < RECENT_ACTIVITY_MS) return 'Actif récemment';

    const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1000));
    if (elapsedHours < 24) return `Vu il y a ${elapsedHours} h`;

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return 'Vu hier';
    if (elapsedDays < 7) return `Vu il y a ${elapsedDays} jours`;

    return `Vu le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(lastActiveAt)}`;
}

export function toActivityMillis(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && value !== null && 'toMillis' in value) {
        const toMillis = (value as { toMillis?: unknown }).toMillis;
        if (typeof toMillis === 'function') {
            const timestamp = toMillis.call(value);
            return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
        }
    }
    return null;
}
