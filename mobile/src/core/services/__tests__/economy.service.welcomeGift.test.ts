import { httpsCallable } from 'firebase/functions';
import { NEW_PLAYER_COINS } from '../../economy.constants';
import { economyService } from '../economy.service';
import { userDocumentService } from '../userDocument.service';

jest.mock('../firebase', () => ({ auth: { currentUser: { uid: 'welcome-test' } }, db: {}, gameFunctions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../LogService', () => ({
    LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const uid = 'welcome-test';
const call = Object.assign(jest.fn(), { stream: jest.fn() });

beforeEach(async () => {
    jest.clearAllMocks();
    call.mockReset();
    jest.mocked(httpsCallable).mockReturnValue(call);
    await economyService.useStorageScope(null);
    await economyService.useStorageScope(uid);
});

afterEach(() => jest.restoreAllMocks());

it('reconnaît un profil incomplet malgré les stats et le cache de la version précédente', async () => {
    await economyService.setEconomy({ coins: NEW_PLAYER_COINS, welcomeGiftClaimed: true });
    jest.spyOn(userDocumentService, 'get').mockResolvedValue({
        exists: () => true,
        data: () => ({ economy: { xp: 0 }, stats: { gamesPlayed: 0, coins: 0 } }),
        metadata: { fromCache: false },
    } as unknown as Awaited<ReturnType<typeof userDocumentService.get>>);

    await economyService.syncFromFirebase(uid, { force: true });

    await expect(economyService.hasClaimedWelcomeGift()).resolves.toBe(false);
    await expect(economyService.getEconomy()).resolves.toMatchObject({ coins: 0 });
});

it('permet de réessayer avec la même opération après un échec réseau', async () => {
    call.mockRejectedValueOnce(new Error('Délai dépassé')).mockResolvedValueOnce({
        data: { credited: NEW_PLAYER_COINS, balance: NEW_PLAYER_COINS },
    });

    await expect(economyService.claimWelcomeGift(uid)).rejects.toThrow('Délai dépassé');
    await expect(economyService.getEconomy()).resolves.toMatchObject({ coins: 0, welcomeGiftClaimed: false });
    await expect(economyService.claimWelcomeGift(uid)).resolves.toBe(NEW_PLAYER_COINS);
    expect(call.mock.calls).toEqual([
        [{ operationId: 'welcome_welcome-test', kind: 'WELCOME' }],
        [{ operationId: 'welcome_welcome-test', kind: 'WELCOME' }],
    ]);
    await expect(economyService.getEconomy()).resolves.toMatchObject({ coins: NEW_PLAYER_COINS, welcomeGiftClaimed: true });
});
