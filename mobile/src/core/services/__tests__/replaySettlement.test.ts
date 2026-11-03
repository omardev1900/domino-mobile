import { confirmReplaySettlement } from '../replaySettlement';
import { economyService } from '../economy.service';
import { readConfirmedReplayBalance } from '../replayBalance';

jest.mock('../economy.service', () => ({ economyService: { applyConfirmedReplayBalance: jest.fn() } }));
jest.mock('../replayBalance', () => ({ readConfirmedReplayBalance: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it('accepte le solde serveur même si une ancienne copie locale aurait une autre valeur', async () => {
    jest.mocked(readConfirmedReplayBalance).mockResolvedValue(2400);
    await confirmReplaySettlement(Promise.resolve(), 'player');
    expect(economyService.applyConfirmedReplayBalance).toHaveBeenCalledWith(2400);
});

it('attend la récompense avant de lire le solde', async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const confirmation = confirmReplaySettlement(pending, 'player');
    expect(readConfirmedReplayBalance).not.toHaveBeenCalled();
    finish();
    await confirmation;
    expect(readConfirmedReplayBalance).toHaveBeenCalledWith('player');
});

it('ne masque pas un véritable échec de finalisation', async () => {
    await expect(confirmReplaySettlement(Promise.reject(new Error('reward failed')), 'player')).rejects.toThrow('reward failed');
    expect(readConfirmedReplayBalance).not.toHaveBeenCalled();
});

it('permet de retenter une lecture serveur sans rejouer la récompense', async () => {
    const settlement = Promise.resolve();
    jest.mocked(readConfirmedReplayBalance).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(2400);
    await expect(confirmReplaySettlement(settlement, 'player')).rejects.toThrow('offline');
    await confirmReplaySettlement(settlement, 'player');
    expect(economyService.applyConfirmedReplayBalance).toHaveBeenCalledTimes(1);
});
