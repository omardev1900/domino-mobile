import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';

export type StableNetworkStatus = 'online' | 'offline' | 'checking';

const OFFLINE_CONFIRMATION_MS = 1_500;
const ONLINE_CONFIRMATION_MS = 750;

const isReachable = (state: NetInfoState): boolean =>
    state.isConnected !== false && state.isInternetReachable !== false;

/**
 * Absorbs short NetInfo flaps. A confirmed outage is visible to the user but
 * never owns the game UI or prevents the Firebase SDK from reconnecting.
 */
export const useStableNetworkStatus = (): {
    status: StableNetworkStatus;
    retry: () => Promise<void>;
} => {
    const [status, setStatus] = useState<StableNetworkStatus>('checking');
    const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearConfirmation = useCallback(() => {
        if (!confirmationTimerRef.current) return;
        clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
    }, []);

    const confirm = useCallback((nextState: NetInfoState) => {
        clearConfirmation();
        const nextStatus: StableNetworkStatus = isReachable(nextState) ? 'online' : 'offline';
        const delay = nextStatus === 'online' ? ONLINE_CONFIRMATION_MS : OFFLINE_CONFIRMATION_MS;
        confirmationTimerRef.current = setTimeout(() => {
            confirmationTimerRef.current = null;
            setStatus(nextStatus);
        }, delay);
    }, [clearConfirmation]);

    const retry = useCallback(async () => {
        setStatus('checking');
        try {
            confirm(await NetInfo.fetch());
        } catch {
            confirm({ isConnected: false, isInternetReachable: false } as NetInfoState);
        }
    }, [confirm]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(confirm);
        void retry();
        const appStateSubscription = AppState.addEventListener('change', (appState: AppStateStatus) => {
            if (appState === 'active') void retry();
        });
        return () => {
            clearConfirmation();
            unsubscribe();
            appStateSubscription.remove();
        };
    }, [clearConfirmation, confirm, retry]);

    return { status, retry };
};
