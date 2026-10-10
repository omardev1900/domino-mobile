import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { onValue, ref } from 'firebase/database';

import { rtdb } from '../../core/services/firebase';
import {
    createPresenceConnectionId,
    logPresenceDiagnostic,
    PresenceDiagnosticInput,
    PresenceDiagnosticRecord,
    setPresenceServerTimeOffset,
} from './presenceDiagnostics';

export type PresenceDiagnosticDetails = Omit<
    PresenceDiagnosticInput,
    'appState' | 'connectionId' | 'playerId' | 'roomId'
> & {
    appState?: string;
    playerId?: string;
};

interface UsePresenceDiagnosticSessionProps {
    gameId: string | undefined;
    isSoloMode: boolean;
    localPlayerId: string;
}

interface PresenceDiagnosticSession {
    connectionId: string;
    log: (details: PresenceDiagnosticDetails) => PresenceDiagnosticRecord | undefined;
}

export const usePresenceDiagnosticSession = ({
    gameId,
    isSoloMode,
    localPlayerId,
}: UsePresenceDiagnosticSessionProps): PresenceDiagnosticSession => {
    const connectionIdRef = useRef(createPresenceConnectionId());
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    const log = useCallback((details: PresenceDiagnosticDetails) => {
        if (!gameId || isSoloMode || !localPlayerId) return undefined;
        const { appState, playerId, ...eventDetails } = details;
        return logPresenceDiagnostic({
            ...eventDetails,
            roomId: gameId,
            playerId: playerId ?? localPlayerId,
            connectionId: connectionIdRef.current,
            appState: appState ?? appStateRef.current,
        });
    }, [gameId, isSoloMode, localPlayerId]);

    useEffect(() => {
        if (!gameId || isSoloMode || !localPlayerId) return;

        const serverOffsetRef = ref(rtdb, '.info/serverTimeOffset');
        const unsubscribeServerOffset = onValue(serverOffsetRef, snapshot => {
            const offsetMs = Number(snapshot.val());
            if (!Number.isFinite(offsetMs)) return;
            setPresenceServerTimeOffset(offsetMs);
            log({
                event: 'server_time_offset_updated',
                source: 'rtdb_connection',
            });
        });
        const appStateSubscription = AppState.addEventListener('change', nextState => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;
            log({
                event: 'app_state_changed',
                source: 'app_state',
                appState: nextState,
                decision: `${previousState}->${nextState}`,
            });
        });

        return () => {
            unsubscribeServerOffset();
            appStateSubscription.remove();
        };
    }, [gameId, isSoloMode, localPlayerId, log]);

    return { connectionId: connectionIdRef.current, log };
};
