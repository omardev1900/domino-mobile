import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { rtdb } from '../core/services/firebase';
import { LogService } from '../core/services/LogService';

const createConnectionId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type MatchmakingAvailability = {
    availableCount: number | null;
    isLoading: boolean;
};

/**
 * Publie une présence éphémère limitée au parcours multijoueur.
 * Les identifiants restent privés : l'interface ne lit que le compteur agrégé.
 */
export const useMatchmakingPresence = (
    userId: string | undefined,
    enabled: boolean,
): MatchmakingAvailability => {
    const [availableCount, setAvailableCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const connectionIdRef = useRef<string | null>(null);
    const rtdbConnectedRef = useRef(false);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        if (!enabled || !userId) {
            setAvailableCount(null);
            setIsLoading(false);
            return;
        }

        let disposed = false;
        const countRef = ref(rtdb, 'matchmakingAvailability/public/availableCount');
        const rtdbConnectionRef = ref(rtdb, '.info/connected');

        const deactivate = () => {
            const connectionId = connectionIdRef.current;
            connectionIdRef.current = null;
            if (!connectionId) return;
            remove(ref(rtdb, `matchmakingAvailability/connections/${userId}/${connectionId}`))
                .catch(error => LogService.warn('MatchmakingPresence', 'Suppression de présence impossible', error));
        };

        const activate = async () => {
            if (
                disposed
                || !rtdbConnectedRef.current
                || appStateRef.current !== 'active'
                || connectionIdRef.current
            ) return;

            const connectionId = createConnectionId();
            const connectionRef = ref(
                rtdb,
                `matchmakingAvailability/connections/${userId}/${connectionId}`,
            );
            connectionIdRef.current = connectionId;

            try {
                await onDisconnect(connectionRef).remove();
                await set(connectionRef, { t: serverTimestamp() });
            } catch (error) {
                if (connectionIdRef.current === connectionId) {
                    connectionIdRef.current = null;
                }
                LogService.warn('MatchmakingPresence', 'Publication de présence impossible', error);
            }
        };

        const unsubscribeCount = onValue(
            countRef,
            snapshot => {
                const value = snapshot.val();
                setAvailableCount(typeof value === 'number' && value >= 0 ? value : 0);
                setIsLoading(false);
            },
            error => {
                setAvailableCount(null);
                setIsLoading(false);
                LogService.warn('MatchmakingPresence', 'Lecture du compteur impossible', error);
            },
        );
        const unsubscribeRtdb = onValue(rtdbConnectionRef, snapshot => {
            rtdbConnectedRef.current = snapshot.val() === true;
            if (rtdbConnectedRef.current) {
                void activate();
            } else {
                connectionIdRef.current = null;
            }
        });
        const appStateSubscription = AppState.addEventListener('change', nextState => {
            appStateRef.current = nextState;
            if (nextState === 'active') {
                void activate();
            } else {
                deactivate();
            }
        });

        return () => {
            disposed = true;
            unsubscribeCount();
            unsubscribeRtdb();
            appStateSubscription.remove();
            deactivate();
        };
    }, [enabled, userId]);

    return { availableCount, isLoading };
};
