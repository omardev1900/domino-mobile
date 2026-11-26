jest.unmock('../firebase');

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => ({ id: 'ABC123' })),
    getFirestore: jest.fn(),
    initializeFirestore: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => 'server-heartbeat'),
}));

jest.mock('firebase/database', () => ({
    getDatabase: jest.fn(),
}));

import { runTransaction } from 'firebase/firestore';
import { joinRoom } from '../firebase';

const guest = { uid: 'guest', displayName: 'Invité', gamesPlayed: 0, gamesWon: 0 };
const host = { uid: 'host', displayName: 'Hôte', gamesPlayed: 0, gamesWon: 0 };
const permissionDenied = Object.assign(new Error('Refusée'), { code: 'permission-denied' });
const transaction = jest.mocked(runTransaction);
const update = jest.fn();

beforeEach(() => {
    transaction.mockReset();
    update.mockClear();
});

function evaluateJoin(): void {
    transaction.mockImplementationOnce((_db, write) => write({
        get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ status: 'WAITING', players: [host], playerIds: [host.uid] }),
        }),
        update,
    } as unknown as Parameters<typeof write>[0]));
}

it('envoie la présence dans la jointure quand les règles la permettent', async () => {
    evaluateJoin();

    await joinRoom('ABC123', guest);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        playerIds: ['host', 'guest'],
        'heartbeats.guest': 'server-heartbeat',
    }));
});

it('rejoue la jointure sans le signal si les règles refusent l’écriture combinée', async () => {
    transaction.mockRejectedValueOnce(permissionDenied);
    evaluateJoin();

    await joinRoom('ABC123', guest);

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][1]).toMatchObject({ playerIds: ['host', 'guest'] });
    expect(update.mock.calls[0][1]).not.toHaveProperty(['heartbeats.guest']);
});

it('laisse remonter un vrai refus de jointure', async () => {
    transaction.mockRejectedValue(permissionDenied);

    await expect(joinRoom('ABC123', guest)).rejects.toBe(permissionDenied);

    expect(transaction).toHaveBeenCalledTimes(2);
});
