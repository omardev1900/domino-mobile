import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLeagueMonthKey, getPreviousLeagueMonthKey, getStartOfLeagueMonth } from './leagueTime';

describe('leagueTime — fuseau Martinique', () => {
    it('bascule de mois à minuit en Martinique', () => {
        assert.equal(getLeagueMonthKey(Date.parse('2026-12-01T03:59:59.999Z')), '2026-11');
        assert.equal(getLeagueMonthKey(Date.parse('2026-12-01T04:00:00.000Z')), '2026-12');
        assert.equal(getStartOfLeagueMonth(Date.parse('2026-12-01T04:00:00.000Z')), Date.parse('2026-12-01T04:00:00.000Z'));
    });

    it('calcule le mois précédent dans le même fuseau métier', () => {
        assert.equal(getPreviousLeagueMonthKey(Date.parse('2026-01-15T12:00:00.000Z')), '2025-12');
        assert.equal(getPreviousLeagueMonthKey(Date.parse('2026-12-15T12:00:00.000Z')), '2026-11');
    });
});
