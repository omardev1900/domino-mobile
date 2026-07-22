import { useEffect, useRef } from 'react';
import { GameState, GameRoom } from '../../core/types';
import { computeBotDecision, computeEmergencyBotDecision } from '../../core/BotEngine';
import { ActionCommand } from './useActionDispatcher';
import { LogService } from '../../core/services/LogService';
import { getMeytKayaliMove } from '../../core/MeytKayaliEngine';

export interface UseBotDecisionProps {
    gameState: GameState | null;
    roomData: GameRoom | null;
    localPlayerId: string;
    isSoloMode: boolean;
    isPaused: boolean;
    isLocalHost: boolean;
    canAction: (playerId: string, options?: { isAuto?: boolean; minAgeMs?: number }) => boolean;
    dispatch: (command: ActionCommand) => Promise<void>;
}

export const useBotDecision = ({
    gameState,
    roomData,
    localPlayerId,
    isSoloMode,
    isPaused,
    isLocalHost,
    canAction,
    dispatch
}: UseBotDecisionProps) => {

    const dispatchRef = useRef(dispatch);
    useEffect(() => { dispatchRef.current = dispatch; });

    const canActionRef = useRef(canAction);
    useEffect(() => { canActionRef.current = canAction; });

    // Garder le state frais
    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    const logBotTurn = (message: string, data?: Record<string, unknown>) => {
        LogService.info('useBotDecision', message, data);
    };

    // Initialiser / réinitialiser le moteur MÈTKAYALI quand une nouvelle partie commence
    const lastGameIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!gameState || gameState.phase === 'LOBBY') return;
        if (gameState.gameId === lastGameIdRef.current) return;
        lastGameIdRef.current = gameState.gameId;
    }, [gameState?.gameId]);

    useEffect(() => {
        if (!gameState || gameState.phase !== 'PLAYING' || isPaused) {
            return;
        }

        const currentPlayerId = gameState.currentPlayerId;
        if (!currentPlayerId) return;

        const activePlayer = gameState.players?.find(p => p.id === currentPlayerId);

        // Uniquement pour les bots / déconnectés
        if (!activePlayer || activePlayer.status === 'HUMAN') {
            return;
        }

        // Anti-split-brain en multi : Seul le host calcule et envoie le coup du bot
        if (!isSoloMode && !isLocalHost) {
            return;
        }

        const capturedTurnId = gameState.turnId;

        // Délai de réflexion : court pour un joueur subitement déco, naturel pour un bot
        // FIX-REGRESSION: 100ms était trop court — un onSnapshot Firebase met 200-500ms à propager
        // la reconnexion (DISCONNECTED → HUMAN). Le bot se déclenchait avant que le statut frais
        // n'arrive, jouant à la place du joueur qui venait juste de se reconnecter.
        const isAbsent = activePlayer.status === 'DISCONNECTED' || activePlayer.status === 'SURRENDERED';
        const delayMs = isAbsent
            ? 2500
            : Math.floor(Math.random() * 500) + 1000;

        let isCancelled = false;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const maxAttempts = isAbsent ? 12 : 18;

        const schedule = (delay: number, callback: () => void) => {
            const id = setTimeout(() => {
                timers.delete(id);
                callback();
            }, delay);
            timers.add(id);
        };

        const retryLater = (attempt: number, reason: string, data?: Record<string, unknown>) => {
            if (attempt >= maxAttempts) {
                LogService.error('useBotDecision', `Bot turn retry limit reached: ${reason}`, {
                    playerId: currentPlayerId,
                    turnId: capturedTurnId,
                    attempt,
                    ...data,
                });
                return;
            }

            logBotTurn(`Bot turn retry: ${reason}`, {
                playerId: currentPlayerId,
                turnId: capturedTurnId,
                nextAttempt: attempt + 1,
                ...data,
            });
            schedule(250, () => {
                void runAttempt(attempt + 1);
            });
        };

        const runAttempt = async (attempt: number) => {
            if (isCancelled) return;

            const freshState = gameStateRef.current;
            if (!freshState) return;

            // 1. A-t-on changé de tour pendant le délai ?
            if (freshState.turnId !== capturedTurnId) {
                logBotTurn('Bot turn cancelled: stale turn.', {
                    playerId: currentPlayerId,
                    capturedTurnId,
                    freshTurnId: freshState.turnId,
                    attempt,
                });
                return;
            }

            const freshPlayer = freshState.players?.find(p => p.id === currentPlayerId);
            if (freshState.phase !== 'PLAYING' || freshState.currentPlayerId !== currentPlayerId || freshPlayer?.status === 'HUMAN') {
                logBotTurn('Bot turn cancelled: state moved on or player became HUMAN.', {
                    playerId: currentPlayerId,
                    phase: freshState.phase,
                    currentPlayerId: freshState.currentPlayerId,
                    playerStatus: freshPlayer?.status,
                    attempt,
                });
                return;
            }

            // 2. Le Dispatcher autorise-t-il l'action ?
            // Les bots ne subissent pas l'immunité timeout car c'est une action organique
            if (!canActionRef.current(currentPlayerId, { isAuto: false })) {
                retryLater(attempt, 'canAction=false before decision');
                return;
            }

            // Calcul de la décision
            let tileToPlay = null;
            let sideToPlay: 'left' | 'right' | 'start' = 'start';
            try {
                if (activePlayer.difficulty === 'METKAYALI') {
                    // Moteur Monte-Carlo MÈTKAYALI
                    const dummyState = { tracker: { tileStates: new Map(), excludedValues: new Map(), handSizes: new Map() }, probabilities: new Map(), confidence: 0 };
                    const { decision: mkDecision } = getMeytKayaliMove(dummyState as any, freshState, currentPlayerId);

                    if (mkDecision) {
                        tileToPlay = mkDecision.tile;
                        sideToPlay = mkDecision.side;
                    }
                } else {
                    // Moteur classique (TI_MANMAY / MAPIPI / GRAN_MOUN)
                    const decision = computeBotDecision(freshState, currentPlayerId);
                    if (decision) {
                        tileToPlay = decision.tile;
                        sideToPlay = decision.side as 'left' | 'right' | 'start';
                    }
                }
            } catch (error) {
                LogService.error('useBotDecision', 'Bot decision failed; using emergency fallback.', error);
                const fallbackDecision = computeEmergencyBotDecision(freshState, currentPlayerId);
                if (fallbackDecision) {
                    tileToPlay = fallbackDecision.tile;
                    sideToPlay = fallbackDecision.side as 'left' | 'right' | 'start';
                }
            }

            const command: ActionCommand = tileToPlay
                ? {
                    type: 'PLAY_TILE',
                    playerId: currentPlayerId,
                    tile: tileToPlay,
                    side: sideToPlay
                }
                : {
                    type: 'PASS_TURN',
                    playerId: currentPlayerId
                };

            logBotTurn('Bot dispatch attempt.', {
                playerId: currentPlayerId,
                turnId: capturedTurnId,
                attempt,
                commandType: command.type,
                tileId: tileToPlay?.id,
                side: tileToPlay ? sideToPlay : undefined,
            });

            if (tileToPlay) {
                await dispatchRef.current(command).catch(error => {
                    LogService.error('useBotDecision', 'Bot PLAY_TILE dispatch failed.', error);
                });
            } else {
                await dispatchRef.current(command).catch(error => {
                    LogService.error('useBotDecision', 'Bot PASS_TURN dispatch failed.', error);
                });
            }

            schedule(500, () => {
                if (isCancelled) return;
                const stateAfterDispatch = gameStateRef.current;
                if (
                    stateAfterDispatch?.phase === 'PLAYING'
                    && stateAfterDispatch.currentPlayerId === currentPlayerId
                    && stateAfterDispatch.turnId === capturedTurnId
                ) {
                    retryLater(attempt, 'dispatch did not advance turn', {
                        commandType: command.type,
                    });
                }
            });
        };

        logBotTurn('Bot turn scheduled.', {
            playerId: currentPlayerId,
            turnId: capturedTurnId,
            delayMs,
            difficulty: activePlayer.difficulty,
            status: activePlayer.status,
            isSoloMode,
        });
        schedule(delayMs, () => {
            void runAttempt(1);
        });

        return () => {
            isCancelled = true;
            timers.forEach(clearTimeout);
            timers.clear();
        };

    }, [
        gameState?.turnId,
        gameState?.currentPlayerId,
        gameState?.phase,
        // FIX-CRITIQUE-2: valeur primitive dérivée hors du tableau.
        // Sans cette dépendance, si un joueur repassait DISCONNECTED → HUMAN sur le même
        // tour (même turnId/phase), l'effet ne se relançait pas → isCancelled restait false
        // → le bot jouait quand même après son délai de 2500ms alors que le joueur était
        // revenu. Avec ce selector, le cleanup (isCancelled = true) est déclenché immédiatement
        // dès que le statut change, annulant proprement le compte à rebours.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        gameState?.players?.find(p => p.id === gameState?.currentPlayerId)?.status,
        isPaused,
        localPlayerId,
        isSoloMode,
        isLocalHost,
        roomData?.createdBy
    ]);
};
