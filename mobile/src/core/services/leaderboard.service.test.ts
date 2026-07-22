import { getStartOfCurrentMonthUtc } from './leaderboard.time';

describe('leaderboard.service UTC month boundary', () => {
    test('uses the first day of the current UTC month', () => {
        const now = new Date('2026-05-15T14:30:00.000Z');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
    });

    test('ignores a positive local timezone that is already in the next local month', () => {
        const now = new Date('2026-05-01T00:30:00+02:00');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-04-01T00:00:00.000Z'));
    });

    test('ignores a negative local timezone that is still in the previous local month', () => {
        const now = new Date('2026-04-30T23:30:00-02:00');

        expect(getStartOfCurrentMonthUtc(now)).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
    });
});
