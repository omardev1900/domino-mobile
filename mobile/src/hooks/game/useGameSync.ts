import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, GameRoom } from '../../core/types';
import { db } from '../../core/services/firebase';
import { doc, onSnapshot, runTransaction, getDoc } from 'firebase/firestore';
import { LogService } from '../../core/services/LogService';

export interface UseGameSyncProps {
    gameId: string | undefined;
    localPlayerId: string;
    isSoloMode: boolean;
    signalPlayerOnline: () => Promise<void>;
}

export interface UseGameSyncResult {
    gameState: GameState | null;
    roomData: GameRoom | null;
    isStarting: boolean;
    connectionError: string | null;
    safeUpdateGameState: (gameId: string, newState: GameState) => Promise<void>;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
    setIsStarting: React.Dispatch<React.SetStateAction<boolean>>;
    setRoomData: React.Dispatch<React.SetStateAction<GameRoom | null>>;
}

export const useGameSync = ({
    gameId,
    localPlayerId,
    isSoloMode,
    signalPlayerOnline
}: UseGameSyncProps): UseGameSyncResult => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [roomData, setRoomData] = useState<GameRoom | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Store latest state for safety
    const gameStateRef = useRef<GameState | null>(null);

    useEffect(() => {
        gameStateRef.current = gameState;
        if (isSoloMode && gameId && gameState) {
            AsyncStorage.setItem(`@solo_game_state:${gameId}`, JSON.stringify(gameState))
                .catch(err => LogService.error('useGameSync', 'Error saving solo state', err));
        }
    }, [gameState, isSoloMode, gameId]);

    // Real-time synchronization
    useEffect(() => {
        if (isSoloMode || !gameId) {
            return;
        }

        setIsStarting(true);


        const roomRef = doc(db, 'rooms', gameId);

        // First, explicitly declare we are online
        signalPlayerOnline().then(() => setIsStarting(false));

        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as GameRoom;
                setConnectionError(null); // Clear error on successful snapshot
                setRoomData(data);

                if (data.gameState) {
                    // Check if it's actually an update from someone else (or just our own reflected)
                    if (gameStateRef.current && (
                        gameStateRef.current.turnId !== data.gameState.turnId ||
                        gameStateRef.current.phase !== data.gameState.phase
                    )) {
                        LogService.info('GameSync', `[SYNC] 📥 Incoming State: Phase=${data.gameState.phase}, TurnId=${data.gameState.turnId}`);
                    }

                    // FIX-MULTI-P1: Filtre de fraîcheur
                    const currentVersion = gameStateRef.current?.stateVersion ?? 0;
                    const incomingVersion = data.gameState.stateVersion ?? 0;
                    
                    // FIX-REGRESSION: filtre STRICT (<) et non large (<=).
                    // Avec <= , le snapshot réfléchi après mise à jour locale optimiste (même version)
                    // était bloqué, empêchant les non-hosts de recevoir des mises à jour légitimes
                    // dans certains cas de concurrence. On ignore uniquement les snapshots PLUS ANCIENS.
                    if (gameStateRef.current && incomingVersion < currentVersion && incomingVersion !== 0) {
                        LogService.warn('GameSync', `[SYNC] 🛑 Ignoring stale snapshot: ${incomingVersion} < ${currentVersion}`);
                        return;
                    }

                    setGameState(data.gameState);

                    // FIX-CRITIQUE-SAFETY-NET: Si on reçoit un snapshot qui nous montre
                    // comme DISCONNECTED alors qu'on est bien connecté (on reçoit ce snapshot !),
                    // se ré-annoncer immédiatement sans attendre le prochain heartbeat (10s) ou
                    // le retour en foreground. Couvre tous les cas non gérés par l'AppState listener
                    // (web, crash OS, reconnexion réseau silencieuse, etc.).
                    // FIX-BOUCLE-400: n'agir que pendant la phase PLAYING. Pendant les
                    // transitions de round (MANCHE_END/PARTIE_END/MATCH_END), les snapshots
                    // intermédiaires peuvent nous montrer DISCONNECTED de façon transitoire ;
                    // se ré-annoncer alors provoque des conflits de transaction en boucle.
                    const myPlayer = data.gameState.players?.find(p => p.id === localPlayerId);
                    if (myPlayer?.status === 'DISCONNECTED' && data.gameState.phase === 'PLAYING') {
                        LogService.warn('GameSync', '[SYNC] ⚠️ Self detected as DISCONNECTED while receiving snapshots — re-signaling online');
                        signalPlayerOnline().catch(e =>
                            LogService.error('useGameSync', 'Error in self-reconnect signal', e)
                        );
                    }
                } else {

                }
            } else {
                LogService.warn('GameSync', '[SYNC] 🗑️ Room document deleted or does not exist');
                // Handle room destruction
            }
        }, (error: any) => {
            LogService.error('useGameSync', 'onSnapshot Error:', error);
            setIsStarting(false);
            if (error.code === 'not-found') {
                setConnectionError('Cette partie n\'existe plus. Elle a peut-être expiré.');
            } else {
                setConnectionError('Connexion perdue. Tentative de reconnexion...');
            }
        });

        return () => {

            unsubscribe();
            // Note: In React Native, running async cleanup here on simple unmount can be tricky,
            // so we rely on beforeunload for actual hard closes.
        };
    }, [gameId, isSoloMode, signalPlayerOnline]);



    // Safe update method preventing stale data overwrites
    // retries: nombre de tentatives restantes en cas de conflit Firestore (pattern recommandé par Firebase)
    const safeUpdateGameState = useCallback(async (targetGameId: string, newState: GameState, retries = 2) => {
        if (!targetGameId || isSoloMode) {
            setGameState(newState);
            return;
        }

        const roomRef = doc(db, 'rooms', targetGameId);

        try {
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) {
                    throw new Error("Room doesn't exist");
                }

                const currentData = roomDoc.data() as GameRoom;
                const currentState = currentData.gameState;

                const cleanUndefineds = (obj: any): any => {
                    if (obj === undefined) return null;
                    if (typeof obj === 'number' && !isFinite(obj)) return null; // NaN, Infinity, -Infinity → rejetés par Firestore
                    if (obj === null || typeof obj !== 'object') return obj;
                    if (Array.isArray(obj)) return obj.map(cleanUndefineds);
                    const result: any = {};
                    for (const key of Object.keys(obj)) {
                        if (obj[key] !== undefined) {
                            result[key] = cleanUndefineds(obj[key]);
                        }
                    }
                    return result;
                };

                const cleanState = cleanUndefineds(newState);

                if (!currentState) {
                    transaction.update(roomRef, { gameState: cleanState });
                    return;
                }

                // Compare progression to avoid split-brain rewrites and clock sync issues
                let isValidUpdate = false;
                const newVersion = newState.stateVersion ?? 0;
                const currentVersion = currentState.stateVersion ?? 0;

                if (newVersion > currentVersion) {
                    isValidUpdate = true; // FIX-MULTI-P1: Validation forte par stateVersion
                } else if (newVersion === 0) {
                    // Fallback rétrocompatibilité pour les clients non mis à jour
                    if ((newState.mancheNumber ?? 1) > (currentState.mancheNumber ?? 1)) {
                        isValidUpdate = true;
                    } else if ((newState.mancheNumber ?? 1) === (currentState.mancheNumber ?? 1) && (newState.roundNumber ?? 1) > (currentState.roundNumber ?? 1)) {
                        isValidUpdate = true;
                    } else if ((newState.mancheNumber ?? 1) === (currentState.mancheNumber ?? 1) && (newState.roundNumber ?? 1) === (currentState.roundNumber ?? 1)) {
                        if ((newState.turnId ?? 0) > (currentState.turnId ?? 0)) {
                            isValidUpdate = true;
                        } else if ((newState.turnId ?? 0) === (currentState.turnId ?? 0)) {
                            if (newState.phase !== currentState.phase) {
                                isValidUpdate = true;
                            } else if (newState.boudePlayerId && !currentState.boudePlayerId) {
                                isValidUpdate = true; // MARK_BOUDE
                            }
                        }
                    }
                    
                    if (newState.phase === 'MATCH_END' && currentState.phase !== 'MATCH_END') {
                        isValidUpdate = true;
                    }
                }

                if (!isValidUpdate) {
                    // Silencieux : cas normal quand le fallback non-hôte tente NEXT_ROUND
                    // alors que l'hôte l'a déjà écrit — le stateVersion plus récent gagne.
                    LogService.debug('useGameSync', 'Skipping stale state update (already superseded)', {
                        newVersion,
                        currentVersion,
                        newPhase: newState.phase,
                        currentPhase: currentState.phase
                    });
                    return; // Skip update — state déjà plus récent sur Firebase
                }

                transaction.update(roomRef, { gameState: cleanState });
            });
        } catch (error: any) {
            // ✅ FIX: Retry automatique sur les conflits de concurrence Firestore
            // 'failed-precondition' et 'aborted' sont des erreurs transitoires lors d'écritures simultanées.
            const isRetriable = error?.code === 'failed-precondition' || error?.code === 'aborted';
            if (isRetriable && retries > 0) {
                // Backoff progressif : 150ms → 350ms → 550ms pour espacer les conflits
                const backoff = 150 + (2 - retries) * 200;
                await new Promise(r => setTimeout(r, backoff));
                return safeUpdateGameState(targetGameId, newState, retries - 1);
            }
            // FIX-400: Logger le code d'erreur exact pour confirmer FAILED_PRECONDITION vs INVALID_ARGUMENT
            LogService.error('useGameSync', `safeUpdateGameState FATAL — code=${error?.code ?? 'unknown'} msg=${error?.message ?? error}`);
            // Resync forcé depuis le serveur : le client adopte l'état Firestore actuel au lieu
            // de rester figé sur son état local (qui ne sera jamais confirmé).
            try {
                const snap = await getDoc(roomRef);
                if (snap.exists()) {
                    const serverRoom = snap.data() as GameRoom;
                    if (serverRoom.gameState) {
                        LogService.warn('useGameSync', '[RESYNC] Adopting server state after fatal write failure');
                        setGameState(serverRoom.gameState);
                    }
                }
            } catch (resyncErr) {
                LogService.error('useGameSync', '[RESYNC] forceResync failed:', resyncErr);
            }
            throw error;
        }
    }, [isSoloMode]);


    return {
        gameState,
        roomData,
        isStarting,
        connectionError,
        safeUpdateGameState,
        setGameState,
        setIsStarting,
        setRoomData
    };
};
