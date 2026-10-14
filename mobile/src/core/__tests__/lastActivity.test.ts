import { formatLastActivity, shouldRecordLastActivity, toActivityMillis } from '../lastActivity';

describe('last activity', () => {
    const now = new Date('2026-10-14T12:00:00.000Z').getTime();

    it('records activity only when the configured interval has elapsed', () => {
        expect(shouldRecordLastActivity(null, now, 6 * 60 * 60 * 1000)).toBe(true);
        expect(shouldRecordLastActivity(now - 60 * 60 * 1000, now, 6 * 60 * 60 * 1000)).toBe(false);
        expect(shouldRecordLastActivity(now - 6 * 60 * 60 * 1000, now, 6 * 60 * 60 * 1000)).toBe(true);
    });

    it('formats activity with player-friendly relative labels', () => {
        expect(formatLastActivity(now - 10 * 60 * 1000, now)).toBe('Actif récemment');
        expect(formatLastActivity(now - 2 * 60 * 60 * 1000, now)).toBe('Vu il y a 2 h');
        expect(formatLastActivity(now - 24 * 60 * 60 * 1000, now)).toBe('Vu hier');
    });

    it('reads Firestore-like timestamps safely', () => {
        expect(toActivityMillis({ toMillis: () => now })).toBe(now);
        expect(toActivityMillis(now)).toBe(now);
        expect(toActivityMillis(undefined)).toBeNull();
    });
});
