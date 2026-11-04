import { selectCampaign } from '../campaignPolicy';

const now = new Date(2026, 10, 2, 12).getTime();
const base = {
    title: 'Offre', message: '', imageUrl: 'https://example.com/image.png', buttonLabel: 'Découvrir',
    destination: { type: 'PREMIUM' }, active: true, startsAt: now - 1000, endsAt: now + 1000,
    audience: 'FREE', placements: ['HOME'], frequency: 'DAY', priority: 1,
};
const options = { placement: 'HOME' as const, premium: false, now, sessionHasCampaign: false, history: {} };
const doc = (id: string, values = {}) => ({ id, data: { ...base, ...values } });

describe('campagnes', () => {
    it('choisit la campagne admissible ayant la priorité la plus élevée', () => {
        expect(selectCampaign([doc('a'), doc('b', { priority: 5 })], options)?.id).toBe('b');
    });
    it('respecte le public, le placement, les dates et les données invalides', () => {
        for (const values of [{ audience: 'PREMIUM' }, { placements: ['STORE'] }, { active: false },
            { endsAt: now }, { startsAt: now + 1 }, { imageUrl: 'http://example.com/a' },
            { destination: { type: 'EXTERNAL', url: 'javascript:alert(1)' } }]) {
            expect(selectCampaign([doc('a', values)], options)).toBeNull();
        }
    });
    it('cible la page Premium et les comptes gratuits', () => {
        const premiumPage = { ...options, placement: 'PREMIUM' as const };
        const campaign = doc('premium', { placements: ['PREMIUM'] });
        expect(selectCampaign([campaign], premiumPage)?.id).toBe('premium');
        expect(selectCampaign([campaign], { ...premiumPage, premium: true })).toBeNull();
        expect(selectCampaign([campaign], options)).toBeNull();
    });
    it('respecte la limite de session et la fréquence par jour ou campagne', () => {
        expect(selectCampaign([doc('a')], { ...options, sessionHasCampaign: true })).toBeNull();
        expect(selectCampaign([doc('a')], { ...options, history: { a: { shownAt: now - 1000, shownThisSession: false } } })).toBeNull();
        expect(selectCampaign([doc('a', { frequency: 'ONCE' })], { ...options, history: { a: { shownAt: now - 86400000, shownThisSession: false } } })).toBeNull();
        expect(selectCampaign([doc('a')], { ...options, history: { a: { shownAt: now - 86400000, shownThisSession: false } } })?.id).toBe('a');
    });
});
