import { shouldRecordPlatform, toTrackedPlatform } from '../platformTracking.service';

describe('platform tracking write policy', () => {
    const now = 2_000_000_000_000;

    it('records a platform that has never been seen', () => {
        expect(shouldRecordPlatform(null, now)).toBe(true);
    });

    it('does not rewrite during the same 24 hour window', () => {
        expect(shouldRecordPlatform(now - 23 * 60 * 60 * 1_000, now)).toBe(false);
    });

    it('refreshes the platform after 24 hours', () => {
        expect(shouldRecordPlatform(now - 24 * 60 * 60 * 1_000, now)).toBe(true);
    });
});

describe('tracked platform resolution', () => {
    it('accepts the three supported platforms', () => {
        expect(toTrackedPlatform('android')).toBe('android');
        expect(toTrackedPlatform('ios')).toBe('ios');
        expect(toTrackedPlatform('web')).toBe('web');
    });

    it('ignores every other runtime', () => {
        expect(toTrackedPlatform('windows')).toBeNull();
        expect(toTrackedPlatform('macos')).toBeNull();
        expect(toTrackedPlatform('')).toBeNull();
    });
});
