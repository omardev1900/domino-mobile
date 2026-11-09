import { getMonthlyCochonsFromHistory } from '../leagueProgress';

describe('leagueProgress — source mensuelle depuis matchHistory', () => {
    it('ignore les cochons des mois précédents', () => {
        const now = new Date('2026-07-23T12:00:00.000Z');
        expect(getMonthlyCochonsFromHistory([
            { timestamp: Date.UTC(2026, 5, 30, 23, 59), cochons: 7 },
            { timestamp: Date.UTC(2026, 6, 1, 4, 0), cochons: 3 },
        ], now)).toBe(3);
    });

    it('devient la valeur transmise au calcul de récompense côté mobile', () => {
        const now = new Date('2026-07-23T12:00:00.000Z');
        expect(getMonthlyCochonsFromHistory([
            { timestamp: Date.UTC(2026, 6, 10), cochons: 9 },
        ], now)).toBe(9);
    });
});
