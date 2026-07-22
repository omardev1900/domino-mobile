import { useEffect, useRef } from 'react';
import { GameState } from '../../core/types';
import { getValidMoves } from '../../core/DominoEngine';
import SoundManager from '../../core/audio/SoundManager';
import { ActionCommand } from './useActionDispatcher';

// R2-M1 : Délai d'affichage du Boudé avant passage au joueur suivant.
// Laisse le temps à tous les clients de voir l'animation via Firestore.
const BOUDE_DISPLAY_MS = 2000;

export interface UseAutoPassProps {
    gameState: GameState | null;
    localPlayerId: string;
    isLocalHost: boolean;
    isPaused: boolean;
    dispatch: (command: ActionCommand) => Promise<void>;
}

export const useAutoPass = ({
    gameState,
    localPlayerId,
    isLocalHost,
    isPaused,
    dispatch
}: UseAutoPassProps) => {
    // Garder une ref du dispatch et de l'état pour les timeouts
    const dispatchRef = useRef(dispatch);
    useEffect(() => { dispatchRef.current = dispatch; });

    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    useEffect(() => {
        if (!gameState || gameState.phase !== 'PLAYING' || isPaused) {
            return;
        }

        const currentPlayerId = gameState.currentPlayerId;
        const activePlayer = gameState.players?.find(p => p.id === currentPlayerId);

        if (!activePlayer) return;

        // 1. Détecter si le joueur n'a aucun coup possible
        const validMoves = getValidMoves(activePlayer.hand, {
            left: gameState.table.leftValue,
            right: gameState.table.rightValue
        });

        if (validMoves.length > 0) return;

        // 2. Déterminer si cette instance doit piloter l'auto-pass
        // Cas A : C'est le tour physique du joueur local (Humain)
        const isLocalTurn = currentPlayerId === localPlayerId;

        // Cas B : C'est un Bot ou un Déconnecté, et nous sommes le Host
        const isBotOrDisco = activePlayer.status !== 'HUMAN';
        const shouldIDispatch = isLocalTurn || (isBotOrDisco && isLocalHost);

        if (!shouldIDispatch) return;

        const capturedTurnId = gameState.turnId;

        // 3. Marquer le joueur boudé dans le state partagé (Firestore) pour que tous les clients voient l'anim
        dispatchRef.current({
            type: 'MARK_BOUDE',
            playerId: currentPlayerId,
            turnId: capturedTurnId
        });
        // Le son est maintenant joué par useActionDispatcher lors du MARK_BOUDE

        const delay = activePlayer.status === 'DISCONNECTED' ? 3500 : BOUDE_DISPLAY_MS;

        const timer = setTimeout(() => {
            const freshState = gameStateRef.current;
            if (freshState && freshState.turnId === capturedTurnId) {
                dispatchRef.current({
                    type: 'PASS_TURN',
                    playerId: currentPlayerId
                });
            }
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [gameState?.turnId, isPaused, localPlayerId, isLocalHost]);

    // --- WATCHDOG ANTI-BOUCLE BOUDÉ (FIX-MULTI-01) ---
    // Si l'état boudé reste coincé plus de 5 secondes, on force la résolution du tour
    useEffect(() => {
        if (!gameState?.boudePlayerId || gameState.phase !== 'PLAYING') return;

        // Seul l'hôte (ou le joueur local en solo) a le droit de forcer le passage pour éviter les conflits
        if (!isLocalHost) return;

        const capturedTurnId = gameState.turnId;
        const capturedPlayerId = gameState.boudePlayerId;

        const watchdogTimer = setTimeout(() => {
            const freshState = gameStateRef.current;
            // Si on est toujours sur le même tour boudé après 5 secondes, c'est un blocage
            if (freshState && freshState.turnId === capturedTurnId && freshState.boudePlayerId === capturedPlayerId) {
                console.warn(`[Watchdog] Blocage boudé détecté pour ${capturedPlayerId} au tour ${capturedTurnId}. Forçage PASS_TURN.`);
                dispatchRef.current({
                    type: 'PASS_TURN',
                    playerId: capturedPlayerId
                });
            }
        }, 6500); // 6.5 secondes = largement le temps de voir l'animation + délai DISCONNECTED + latence réseau

        return () => clearTimeout(watchdogTimer);
    }, [gameState?.boudePlayerId, gameState?.turnId, gameState?.phase, isLocalHost]);
};
