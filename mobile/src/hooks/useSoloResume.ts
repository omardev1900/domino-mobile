/**
 * useSoloResume
 *
 * Détecte si une partie solo est en attente (AsyncStorage) et expose un état
 * que l'UI peut consommer pour afficher un modal de reprise.
 *
 * - Vérifie au montage (app ouverte normalement ou retour depuis solo.tsx).
 * - Re-vérifie à chaque fois que l'app repasse en foreground (AppState → active).
 * - Ne s'active jamais si le joueur est déjà dans une partie (/game/...).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../core/services/auth.service';
import { LogService } from '../core/services/LogService';

export type SoloResumeInfo = {
    gameId: string;
    mancheNumber: number;
    roundNumber: number;
    gameMode: string;
};

export function useSoloResume(currentPath: string) {
    const [resumeInfo, setResumeInfo] = useState<SoloResumeInfo | null>(null);
    const isCheckingRef = useRef(false);

    const check = useCallback(async () => {
        // Ne pas déclencher si on est déjà en jeu
        if (currentPath.startsWith('/game')) {
            setResumeInfo(null);
            return;
        }
        // Éviter les appels simultanés
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
            const user = await authService.getCurrentUser();
            if (!user?.uid || user.uid.startsWith('guest_')) {
                setResumeInfo(null);
                return;
            }

            const soloGameId = `solo-${user.uid}`;
            const savedStr = await AsyncStorage.getItem(`@solo_game_state:${soloGameId}`);
            if (!savedStr) { setResumeInfo(null); return; }

            const saved = JSON.parse(savedStr);
            if (saved?.players?.length > 0 && saved.phase !== 'MATCH_END') {
                setResumeInfo({
                    gameId: soloGameId,
                    mancheNumber: saved.mancheNumber ?? 1,
                    roundNumber: saved.roundNumber ?? 1,
                    gameMode: saved.gameMode ?? 'MANCHE',
                });
            } else {
                // Partie terminée ou corrompue → purge silencieuse
                await AsyncStorage.removeItem(`@solo_game_state:${soloGameId}`).catch(() => {});
                setResumeInfo(null);
            }
        } catch (err) {
            LogService.warn('useSoloResume', 'Error checking solo state', err);
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

    const abandon = useCallback(async () => {
        try {
            const user = await authService.getCurrentUser();
            if (user?.uid) {
                await AsyncStorage.removeItem(`@solo_game_state:solo-${user.uid}`);
            }
        } catch { /* non-critique */ }
        setResumeInfo(null);
    }, []);

    return { resumeInfo, dismiss, abandon };
}
