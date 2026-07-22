import { Player } from '../../../core/types';
import { runTransaction } from 'firebase/firestore';
import { markPlayersDisconnected, withDisconnectedPlayers } from '../playerPresence';

jest.mock('../../../core/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => ({ id: 'room-1' })),
    runTransaction: jest.fn(),
}));

const player = (id: string, status: Player['status']): Player => ({
    id,
    name: id,
    hand: [],
    handSize: 0,
    currentMancheStars: 0,
    wins: 0,
    totalRoundWins: 0,
    status,
    totalPoints: 0,
    mancheWins: 0,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
});

describe('withDisconnectedPlayers', () => {
    it('modifie uniquement la cible à partir de la liste la plus récente', () => {
        const latestPlayers = [
            player('p1', 'HUMAN'),
            player('p2', 'HUMAN'),
            player('p3', 'DISCONNECTED'),
        ];

        const result = withDisconnectedPlayers(latestPlayers, ['p2']);

        expect(result.changedPlayerIds).toEqual(['p2']);
        expect(result.players.map(({ id, status }) => ({ id, status }))).toEqual([
            { id: 'p1', status: 'HUMAN' },
            { id: 'p2', status: 'DISCONNECTED' },
            { id: 'p3', status: 'DISCONNECTED' },
        ]);
    });

    it.each(['DISCONNECTED', 'SURRENDERED', 'BOT'] as const)(
        'ne remplace pas un statut %s',
        status => {
            const currentPlayer = player('p2', status);
            const result = withDisconnectedPlayers([currentPlayer], ['p2']);

            expect(result.changedPlayerIds).toEqual([]);
            expect(result.players[0]).toBe(currentPlayer);
        }
    );
});

describe('markPlayersDisconnected', () => {
    it('revalide le heartbeat dans la transaction avant de déconnecter', async () => {
        const update = jest.fn();
        (runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => callback({
            get: jest.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({
                    heartbeats: { p2: 9_500 },
                    gameState: { players: [player('p1', 'HUMAN'), player('p2', 'HUMAN')] },
                }),
            }),
            update,
        }));

        const changed = await markPlayersDisconnected('room-1', ['p2'], 9_000);

        expect(changed).toEqual([]);
        expect(update).not.toHaveBeenCalled();
    });

    it('préserve les autres statuts en écrivant depuis le snapshot transactionnel', async () => {
        const update = jest.fn();
        (runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => callback({
            get: jest.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({
                    heartbeats: { p2: 1_000 },
                    gameState: {
                        players: [
                            player('p1', 'HUMAN'),
                            player('p2', 'HUMAN'),
                            player('p3', 'SURRENDERED'),
                        ],
                    },
                }),
            }),
            update,
        }));

        const changed = await markPlayersDisconnected('room-1', ['p2'], 9_000);

        expect(changed).toEqual(['p2']);
        expect(update).toHaveBeenCalledWith(
            { id: 'room-1' },
            {
                'gameState.players': [
                    expect.objectContaining({ id: 'p1', status: 'HUMAN' }),
                    expect.objectContaining({ id: 'p2', status: 'DISCONNECTED' }),
                    expect.objectContaining({ id: 'p3', status: 'SURRENDERED' }),
                ],
            }
        );
    });
});
