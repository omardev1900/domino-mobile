import { economyService } from '../economy.service';

jest.mock('../firebase', () => ({ auth: {}, db: {} }));
jest.mock('../LogService', () => ({
    LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('EconomyService — réserve minimale de coins', () => {
    beforeEach(async () => {
        await economyService.useStorageScope('reserve-test-user');
    });

    it('autorise une mise qui laisse exactement 100 coins', async () => {
        await economyService.setEconomy({ coins: 200 });

        await expect(economyService.deductBuyIn(100)).resolves.toBe(true);
        await expect(economyService.getEconomy()).resolves.toMatchObject({ coins: 100 });
    });

    it('refuse une mise qui ferait passer le solde sous 100 coins', async () => {
        await economyService.setEconomy({ coins: 199 });

        await expect(economyService.deductBuyIn(100)).resolves.toBe(false);
        await expect(economyService.getEconomy()).resolves.toMatchObject({ coins: 199 });
    });
});
