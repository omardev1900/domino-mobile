import { act, renderHook } from '@testing-library/react-native';
import { useStableNetworkStatus } from '../useStableNetworkStatus';

let listener: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | undefined;

jest.mock('@react-native-community/netinfo', () => ({
    __esModule: true,
    default: {
        addEventListener: jest.fn((callback) => {
            listener = callback;
            return jest.fn();
        }),
        fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    },
}));

describe('useStableNetworkStatus', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        listener = undefined;
    });

    afterEach(() => jest.useRealTimers());

    it('ignores a short offline flap before it becomes user-visible', async () => {
        const { result } = renderHook(() => useStableNetworkStatus());
        await act(async () => { await Promise.resolve(); });
        await act(async () => { jest.advanceTimersByTime(800); });
        expect(result.current.status).toBe('online');

        act(() => listener?.({ isConnected: false, isInternetReachable: false }));
        await act(async () => { jest.advanceTimersByTime(1_000); });
        expect(result.current.status).toBe('online');

        act(() => listener?.({ isConnected: true, isInternetReachable: true }));
        await act(async () => { jest.advanceTimersByTime(800); });
        expect(result.current.status).toBe('online');
    });

    it('confirms a lasting outage after the hysteresis delay', async () => {
        const { result } = renderHook(() => useStableNetworkStatus());
        act(() => listener?.({ isConnected: false, isInternetReachable: false }));
        await act(async () => { jest.advanceTimersByTime(1_500); });
        expect(result.current.status).toBe('offline');
    });
});
