import { act, renderHook } from '@testing-library/react-native';
import { useConnectionStatus } from '../useConnectionStatus';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';

jest.mock('../../../core/services/firebase', () => ({ db: {}, rtdb: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    runTransaction: jest.fn(),
    updateDoc: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../usePresenceDiagnosticSession', () => ({
    usePresenceDiagnosticSession: () => ({
        connectionId: 'diagnostic-connection',
        log: jest.fn(),
    }),
}));
jest.mock('../presenceDiagnostics', () => ({
    createPresenceConnectionId: jest
        .fn()
        .mockReturnValueOnce('old-connection')
        .mockReturnValueOnce('new-connection'),
    presenceErrorCode: jest.fn(() => 'test-error'),
}));
jest.mock('firebase/database', () => ({
    ref: jest.fn((_database, path: string) => ({ path })),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    onValue: jest.fn(),
    onDisconnect: jest.fn(() => ({ remove: jest.fn().mockResolvedValue(undefined) })),
}));

describe('useConnectionStatus — présence RTDB par connexion', () => {
    beforeEach(() => jest.clearAllMocks());

    it('crée un nœud par reconnexion et arme une suppression limitée à ce nœud', async () => {
        let onConnected: ((snapshot: { val: () => unknown }) => void) | undefined;
        (onValue as jest.Mock).mockImplementation((_reference, callback) => {
            onConnected = callback;
            return jest.fn();
        });

        const { unmount } = renderHook(() => useConnectionStatus({
            gameId: 'room-1',
            localPlayerId: 'player-1',
            isSoloMode: false,
        }));

        await act(async () => {
            onConnected?.({ val: () => true });
            await Promise.resolve();
        });
        await act(async () => {
            onConnected?.({ val: () => true });
            await Promise.resolve();
        });

        const onDisconnectPaths = (onDisconnect as jest.Mock).mock.calls
            .map(([reference]) => reference.path);
        expect(onDisconnectPaths).toEqual([
            'presence/room-1/player-1/connections/old-connection',
            'presence/room-1/player-1/connections/new-connection',
        ]);
        expect((set as jest.Mock).mock.calls.map(([reference]) => reference.path)).toEqual([
            'presence/room-1/player-1/connections/old-connection',
            'presence/room-1/player-1/connections/new-connection',
        ]);

        unmount();

        expect((remove as jest.Mock).mock.calls.map(([reference]) => reference.path)).toEqual([
            'presence/room-1/player-1/connections/new-connection',
        ]);
        expect(ref).toHaveBeenCalledWith(expect.anything(), '.info/connected');
    });
});
