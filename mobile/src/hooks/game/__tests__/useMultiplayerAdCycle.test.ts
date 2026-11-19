import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { GameRoom, RoomStatus } from '../../../core/types';
import { createMultiplayerInterstitial } from '../../../core/services/multiplayerInterstitial';
import { useMultiplayerAdCycle } from '../useMultiplayerAdCycle';

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../../../core/services/firebase', () => ({ gameFunctions: {} }));
jest.mock('../../../core/services/multiplayerInterstitial', () => ({ createMultiplayerInterstitial: jest.fn() }));
jest.mock('../presenceDiagnostics', () => ({ getEstimatedPresenceServerNow: () => undefined }));
jest.mock('../../../core/services/LogService', () => ({ LogService: { warn: jest.fn() } }));

const room: GameRoom = {
    roomId: 'ROOM01',
    createdAt: 1,
    lastActivity: 1,
    status: RoomStatus.PLAYING,
    playerIds: ['player'],
    participantIds: ['player'],
    players: [{ uid: 'player', displayName: 'Player', gamesPlayed: 0, gamesWon: 0, multiplayerAdVersion: 1 }],
    gameState: null,
    createdBy: 'player',
    isPrivate: true,
    adCycle: { kind: 'START', id: 'cycle-one', confirmedPlayerIds: [], reconnecting: false, deadline: Infinity },
};

describe('useMultiplayerAdCycle', () => {
    let confirm: jest.Mock;
    let events: Parameters<NonNullable<ReturnType<typeof createMultiplayerInterstitial>>['subscribe']>[0];

    beforeEach(() => {
        AppState.currentState = 'active';
        confirm = jest.fn().mockResolvedValue({ data: { received: true } });
        (httpsCallable as jest.Mock).mockReturnValue(confirm);
        (createMultiplayerInterstitial as jest.Mock).mockReturnValue({
            loaded: true,
            load: jest.fn(),
            show: jest.fn().mockResolvedValue(undefined),
            subscribe: (callbacks: typeof events) => {
                events = callbacks;
                return jest.fn();
            },
        });
    });

    it('confirms only after native close once the ad has opened', async () => {
        renderHook(() => useMultiplayerAdCycle(room, 'player', false));
        await act(async () => {
            events.opened();
            events.error(new Error('An open ad is not a completed ad'));
        });
        expect(confirm).not.toHaveBeenCalled();
        await act(async () => { events.closed(); });
        expect(confirm).toHaveBeenCalledWith({ roomId: 'ROOM01', cycleId: 'cycle-one' });
    });

    it('confirms when the native SDK cannot open the ad', async () => {
        renderHook(() => useMultiplayerAdCycle(room, 'player', false));
        await act(async () => { events.error(new Error('Failed to show')); });
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('confirms without displaying an ad during reconnection', async () => {
        const ad = (createMultiplayerInterstitial as jest.Mock)();
        const reconnecting = { ...room, adCycle: { ...room.adCycle!, reconnecting: true } };
        renderHook(() => useMultiplayerAdCycle(reconnecting, 'player', false));
        expect(ad.show).not.toHaveBeenCalled();
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('libère les résultats locaux même si un autre joueur attend encore', async () => {
        const final = {
            ...room,
            participantIds: ['player', 'other-player'],
            adCycle: { ...room.adCycle!, kind: 'FINAL' as const },
        };
        const { result } = renderHook(() => useMultiplayerAdCycle(final, 'player', true));

        expect(result.current).toBe(true);
        await act(async () => { events.closed(); });
        expect(result.current).toBe(false);
        expect(final.adCycle.confirmedPlayerIds).toEqual([]);
        expect(confirm).toHaveBeenCalledWith({ roomId: 'ROOM01', cycleId: 'cycle-one' });
    });
});
