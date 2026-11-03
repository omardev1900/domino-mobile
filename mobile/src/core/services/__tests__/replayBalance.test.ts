import { doc, getDocFromServer, waitForPendingWrites } from 'firebase/firestore';
import { readConfirmedReplayBalance } from '../replayBalance';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => 'user-ref'),
    waitForPendingWrites: jest.fn(),
    getDocFromServer: jest.fn(),
}));

it('attend les écritures en attente avant de lire le solde serveur', async () => {
    let release!: () => void;
    jest.mocked(waitForPendingWrites).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    jest.mocked(getDocFromServer).mockResolvedValueOnce({ exists: () => true, data: () => ({ economy: { coins: 1500 } }) } as never);
    const result = readConfirmedReplayBalance('player');
    expect(doc).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
    release();
    await expect(result).resolves.toBe(1500);
    expect(getDocFromServer).toHaveBeenCalledWith('user-ref');
});

it('refuse un solde absent ou invalide', async () => {
    jest.mocked(waitForPendingWrites).mockResolvedValueOnce();
    jest.mocked(getDocFromServer).mockResolvedValueOnce({ exists: () => true, data: () => ({ economy: { coins: -1 } }) } as never);
    await expect(readConfirmedReplayBalance('player')).rejects.toThrow('Impossible de confirmer le solde');
});
