import { useState, useEffect } from 'react';
import { GameState, Domino, GameRoom } from '../../core/types';
import { useTurnManager } from './useTurnManager';
import { useActionDispatcher } from './useActionDispatcher';
import { useBotDecision } from './useBotDecision';
import { useAutoPass } from './useAutoPass';
import { getValidMoves } from '../../core/DominoEngine';
import SoundManager from '../../core/audio/SoundManager';
import HapticManager from '../../core/audio/HapticManager';

export interface UseGameEngineProps {
    gameState: GameState | null;
    localPlayerId: string;
    isSoloMode: boolean;
    gameId: string | undefined;
    isPaused: boolean;
    isLocalHost: boolean;
    roomData?: GameRoom | null;
    userId?: string;
    startingHandSize?: number;
    safeUpdateGameState: (gameId: string, newState: GameState) => Promise<void>;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
    clearAllTurnTimers: () => void;
    setOvertime: React.Dispatch<React.SetStateAction<number | null>>;
    setTimeLeft: React.Dispatch<React.SetStateAction<number | null>>;
    onTilePlayed?: (tile: Domino) => void;
    onRestartMatch?: () => void;
    onReplay?: () => void;
}

export const useGameEngine = ({
    gameState,
    localPlayerId,
    isSoloMode,
    gameId,
    isPaused,
    isLocalHost,
    roomData,
    startingHandSize,
    safeUpdateGameState,
    setGameState,
    clearAllTurnTimers,
    setOvertime,
    setTimeLeft,
    onTilePlayed,
    onRestartMatch,
    onReplay
}: UseGameEngineProps) => {
    const [pendingDomino, setPendingDomino] = useState<Domino | null>(null);

    // 1. Initialiser le TurnManager pour le contrôle des verrous
    const turnManager = useTurnManager({ gameState });

    // Nettoyage automatique : annule le choix de côté si le tour ou la phase de jeu change
    // (ex: le joueur met trop de temps, le bot joue à sa place)
    useEffect(() => {
        setPendingDomino(null);
    }, [gameState?.currentPlayerId, gameState?.phase]);

    // 2. Initialiser le Dispatcher pour canaliser les mutations
    const { dispatch } = useActionDispatcher({
        gameState,
        localPlayerId,
        isSoloMode,
        gameId,
        isLocalHost,
        roomData: roomData || null,
        startingHandSize,
        acquireLock: turnManager.acquireLock,
        releaseLock: turnManager.releaseLock,
        canAction: turnManager.canAction,
        safeUpdateGameState,
        setGameState: setGameState as any,
        clearAllTurnTimers,
        setOvertime,
        onTilePlayed
    });

    // 3. Activer la réflexion autonome des bots
    useBotDecision({
        gameState,
        roomData: roomData || null,
        localPlayerId,
        isSoloMode,
        isPaused,
        isLocalHost,
        canAction: turnManager.canAction,
        dispatch
    });

    // 4. Gérer l'auto-pass (Boudé) — l'état visuel vit dans gameState.boudePlayerId
    useAutoPass({
        gameState,
        localPlayerId,
        isLocalHost,
        isPaused,
        dispatch
    });

    // 5. Vibration au début du tour du joueur
    useEffect(() => {
        if (!gameState || gameState.phase !== 'PLAYING') return;
        if (gameState.currentPlayerId === localPlayerId) {
            HapticManager.triggerImpact();
        }
    }, [gameState?.currentPlayerId, gameState?.turnId, localPlayerId]);

    const handlePlayDomino = async (domino: Domino) => {
        if (!gameState || isPaused) return;

        const player = gameState.players.find(p => p.id === localPlayerId);
        if (!player) return;

        // Board vide (1er domino) : pas besoin de choisir un côté, on pose directement
        const isBoardEmpty = gameState.table.leftValue === null && gameState.table.rightValue === null;
        if (isBoardEmpty) {
            setTimeLeft(null);
            setOvertime(null);
            clearAllTurnTimers();
            dispatch({ type: 'PLAY_TILE', playerId: localPlayerId, tile: domino });
            return;
        }

        // Auto-sélection du côté si un seul coup valide est disponible
        const validMoves = getValidMoves([domino], {
            left: gameState.table.leftValue,
            right: gameState.table.rightValue
        });

        if (validMoves.length === 0) return;

        // Si les deux bouts de la chaîne sont identiques, le choix de côté est sans intérêt → droite par défaut
        const bothEndsEqual = gameState.table.leftValue === gameState.table.rightValue;

        if (validMoves.length > 1 && !bothEndsEqual) {
            try {
                if ((SoundManager as any).playSound) (SoundManager as any).playSound('notify');
            } catch (e) { }
            setPendingDomino(domino);
        } else {
            setTimeLeft(null);
            setOvertime(null);
            clearAllTurnTimers();
            // Quand les deux bouts sont égaux, on choisit 'right' par défaut (getValidMoves retourne 'left' en premier)
            let side: 'left' | 'right' | undefined;
            if (bothEndsEqual && validMoves.length > 1) {
                side = 'right';
            } else {
                side = (validMoves[0].side === 'start' ? undefined : validMoves[0].side) as "left" | "right" | undefined;
            }
            dispatch({ type: 'PLAY_TILE', playerId: localPlayerId, tile: domino, side });
        }
    };

    const confirmSidePlay = (side: 'left' | 'right') => {
        if (!pendingDomino || !gameState) return;
        setTimeLeft(null);
        setOvertime(null);
        clearAllTurnTimers();
        dispatch({ type: 'PLAY_TILE', playerId: localPlayerId, tile: pendingDomino, side });
        setPendingDomino(null);
    };

    const handlePassTurn = (forcedPlayerId?: string) => {
        if (!gameState) return;
        const targetId = forcedPlayerId || localPlayerId;
        
        // Bloquer si le joueur a des coups valides
        const player = gameState.players.find(p => p.id === targetId);
        if (player) {
            const validMoves = getValidMoves(player.hand, {
                left: gameState.table.leftValue,
                right: gameState.table.rightValue
            });
            if (validMoves.length > 0) {
                console.error(`[ActionDispatcher] Erreur durant l'action: Error: Player has valid moves, cannot pass`);
                return;
            }
        }

        setTimeLeft(null);
        setOvertime(null);
        clearAllTurnTimers();
        dispatch({ type: 'PASS_TURN', playerId: targetId });
    };

    const handleTimeout = (playerId?: string, turnId?: number) => {
        if (!gameState) return;
        const targetId = playerId || gameState.currentPlayerId;
        if (!targetId) return;
        dispatch({ type: 'TIMEOUT', playerId: targetId, turnId });
    };

    const handleNextRound = () => {
        dispatch({ type: 'NEXT_ROUND' });
    };

    const handleOverlayContinue = () => {
        if (!gameState) return;

        if (gameState.phase === 'MATCH_END') {
            if (isSoloMode) {
                if (onRestartMatch) onRestartMatch();
            } else {
                if (onReplay) onReplay();
            }
        } else if (gameState.phase === 'BOUDE') {
            dispatch({ type: 'RESOLVE_BOUDE' });
        } else {
            dispatch({ type: 'NEXT_ROUND' });
        }
    };

    return {
        dispatch,
        handlePlayDomino,
        confirmSidePlay,
        handlePassTurn,
        handleTimeout,
        handleOverlayContinue,
        handleNextRound,
        pendingDomino,
        setPendingDomino,
        isProcessingMove: turnManager.isProcessingMove.current,
        turnManager
    };
};
