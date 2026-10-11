import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db, findActiveRoomForUser, setUserActiveRoom, leaveRoom } from '../core/services/firebase';
import { authService } from '../core/services/auth.service';
import { LogService } from '../core/services/LogService';
import { GameRoom } from '../core/types';
import { submitGameAction } from '../core/services/gameAction.service';

export type MultiResumeInfo = {
    roomId: string;
    status: string;
};

export function useMultiResume(currentPath: string) {
    const [resumeInfo, setResumeInfo] = useState<MultiResumeInfo | null>(null);
    const isCheckingRef = useRef(false);

    const check = useCallback(async () => {
        // Ne pas déclencher si on est déjà en jeu
        if (currentPath.startsWith('/game') || currentPath.startsWith('/join')) {
            setResumeInfo(null);
            return;
        }
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
            const user = await authService.getCurrentUser();
            if (!user?.uid || user.uid.startsWith('guest_')) {
                setResumeInfo(null);
                return;
            }

            let activeRoomId = await AsyncStorage.getItem('active_roomId');
            
            // Si pas en cache, on cherche dans la base
            if (!activeRoomId) {
                activeRoomId = await findActiveRoomForUser(user.uid);
                if (activeRoomId) {
                    await AsyncStorage.setItem('active_roomId', activeRoomId);
                }
            }

            if (!activeRoomId) {
                setResumeInfo(null);
                return;
            }

            const roomRef = doc(db, 'rooms', activeRoomId);
            const roomSnap = await getDoc(roomRef);
            
            if (roomSnap.exists()) {
                const roomData = roomSnap.data();
                if (roomData && (roomData.status === 'PLAYING' || roomData.status === 'WAITING')) {
                    setResumeInfo({
                        roomId: activeRoomId,
                        status: roomData.status,
                    });
                } else {
                    // La table n'est plus active (MATCH_END ou autre)
                    await AsyncStorage.removeItem('active_roomId');
                    await setUserActiveRoom(user.uid, null);
                    setResumeInfo(null);
                }
            } else {
                await AsyncStorage.removeItem('active_roomId');
                await setUserActiveRoom(user.uid, null);
                setResumeInfo(null);
            }
        } catch (err) {
            LogService.warn('useMultiResume', 'Error checking multi state', err);
            setResumeInfo(null);
        } finally {
            isCheckingRef.current = false;
        }
    }, [currentPath]);

    // Vérification initiale
    useEffect(() => {
        check();
    }, [check]);

    // Vérification au retour en foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                check();
            }
        });
        return () => subscription.remove();
    }, [check]);

    const dismiss = useCallback(() => setResumeInfo(null), []);

    const abandon = useCallback(async (): Promise<boolean> => {
        try {
            const user = await authService.getCurrentUser();
            if (!user?.uid) return false;

            const activeRoomId = await AsyncStorage.getItem('active_roomId');
            if (!activeRoomId) {
                setResumeInfo(null);
                return true;
            }

            const roomRef = doc(db, 'rooms', activeRoomId);
            const roomSnapshot = await getDoc(roomRef);
            if (!roomSnapshot.exists()) {
                await AsyncStorage.removeItem('active_roomId');
                await setUserActiveRoom(user.uid, null);
                setResumeInfo(null);
                return true;
            }

            const room = roomSnapshot.data() as GameRoom;
            const state = room.gameState;
            const isCoordinatedPlayingRoom = room.status === 'PLAYING'
                && room.coordinatorVersion === 1
                && state !== null;

            if (isCoordinatedPlayingRoom) {
                // La Function applique SURRENDER, retire playerIds et nettoie
                // activeRoomId dans la meme transaction. Un abandon local est
                // interdit pour une salle coordonnee et ne doit jamais etre masque.
                await submitGameAction({
                    roomId: activeRoomId,
                    expectedStateVersion: state.stateVersion ?? 0,
                    expectedTurnId: state.turnId ?? 0,
                    action: { type: 'SURRENDER' },
                });
            } else {
                await leaveRoom(activeRoomId, user.uid);
                await setUserActiveRoom(user.uid, null);
            }

            await AsyncStorage.removeItem('active_roomId');
            setResumeInfo(null);
            return true;
        } catch (error) {
            LogService.error('useMultiResume', 'Unable to abandon resumed multiplayer room', error);
            return false;
        }
    }, []);

    return { resumeInfo, dismiss, abandon };
}
