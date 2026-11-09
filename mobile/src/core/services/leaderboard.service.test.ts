import { getStartOfCurrentMonthUtc } from './leaderboard.time';

describe('leaderboard.service — frontière mensuelle Martinique', () => {
    test('uses midnight Martinique for the current month', () => {
        const now = new Date('2026-05-15T14:30:00.000Z');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-05-01T04:00:00.000Z'));
    });

    test('uses the Martinique month even when the device timezone is positive', () => {
        const now = new Date('2026-05-01T00:30:00+02:00');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-04-01T04:00:00.000Z'));
    });

    test('uses the Martinique month when the device timezone is negative', () => {
        const now = new Date('2026-04-30T23:30:00-02:00');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-04-01T04:00:00.000Z'));
    });

    test('changes month exactly at midnight Martinique', () => {
        expect(getStartOfCurrentMonthUtc(new Date('2026-05-01T03:59:59.999Z')))
            .toBe(Date.parse('2026-04-01T04:00:00.000Z'));
        expect(getStartOfCurrentMonthUtc(new Date('2026-05-01T04:00:00.000Z')))
            .toBe(Date.parse('2026-05-01T04:00:00.000Z'));
    });
});
