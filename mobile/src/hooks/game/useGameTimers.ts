import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState } from '../../core/types';
import SoundManager from '../../core/audio/SoundManager';

export interface UseGameTimersProps {
    gameState: GameState | null;
    isPaused: boolean;
    localPlayerId: string;
    onTimeout: (playerId: string, turnIdFromTimer: number) => void;
}

export interface UseGameTimersResult {
    timeLeft: number | null;
    setTimeLeft: React.Dispatch<React.SetStateAction<number | null>>;
    overtime: number | null;
    setOvertime: React.Dispatch<React.SetStateAction<number | null>>;
    clearAllTurnTimers: () => void;
    getTurnAgeMs: () => number;
}

export const useGameTimers = ({
    gameState,
    isPaused,
    localPlayerId,
    onTimeout
}: UseGameTimersProps): UseGameTimersResult => {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [overtime, setOvertime] = useState<number | null>(null);

    const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const overtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ref qui stocke le turnId capturé AU MOMENT où le chrono démarre.
    const capturedTurnIdRef = useRef<number>(0);
    const watchdogRetriesRef = useRef<number>(0);

    const getTurnAgeMs = useCallback(() => {
        return 0; // Deprecated, kept for interface compatibility if needed
    }, []);

    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    });

    const clearAllTurnTimers = useCallback(() => {
        if (turnTimerRef.current) clearInterval(turnTimerRef.current);
        if (overtimeTimerRef.current) clearTimeout(overtimeTimerRef.current);
        turnTimerRef.current = null;
        overtimeTimerRef.current = null;
    }, []);

    // ✅ RADICAL FIX: Quand un joueur se déconnecte en plein tour,
    // turnId et phase ne changent pas. Ce flag dérivé force le redémarrage
    // avec la durée réduite (5s).
    const activePlayer = gameState?.players?.find(p => p.id === gameState?.currentPlayerId);
    const activePlayerIsDisconnected = !!(activePlayer?.status === 'DISCONNECTED');

    // Tour principal (PURE LOCAL CLOCK)
    useEffect(() => {
        clearAllTurnTimers();
        setOvertime(null);

        if (!gameState || isPaused) return;

        // Arreter le timer des que le tour n'est plus jouable. BOUDE est une
        // phase de resolution UI/host, pas un tour chronometre.
        if (gameState.phase !== 'PLAYING') {
            setTimeLeft(null);
            return;
        }

        const activeId = gameState.currentPlayerId;
        const player = gameState.players?.find(p => p.id === activeId);

        // Pas de timer visuel pour les bots PURS (IA de base).
        // Les joueurs déconnectés DOIVENT garder un timer.
        if (!player || player.status === 'BOT') {
            setTimeLeft(null);
            return;
        }

        const turnDuration = gameState.turnDuration;
        if (!turnDuration || turnDuration <= 0) {
            setTimeLeft(null);
            return;
        }

        // Durée réduite pour les joueurs déconnectés ou ayant abandonné (3s max)
        const effectiveDuration = (player.status === 'DISCONNECTED' || player.status === 'SURRENDERED')
            ? Math.min(turnDuration, 3)
            : turnDuration;

        const currentTurnId = gameState.turnId ?? 0;
        capturedTurnIdRef.current = currentTurnId;
        watchdogRetriesRef.current = 0;

        setTimeLeft(effectiveDuration);

        const localStartTimeMs = Date.now();
        const durationMs = effectiveDuration * 1000;

        turnTimerRef.current = setInterval(() => {
            if (isPaused) return;

            const elapsed = Date.now() - localStartTimeMs;
            const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

            if (remaining === 5 && elapsed > 1000) {
                // Ensure we only play it once when remaining hits exactly 5
                // elapsed > 1000 ensures it doesn't play immediately if the turn duration is very short (e.g., 5 seconds or less)
                SoundManager.playSound('timer');
            }

            setTimeLeft(remaining);

            if (remaining === 0) {
                if (turnTimerRef.current) clearInterval(turnTimerRef.current);
                turnTimerRef.current = null;

                setOvertime(5);
                SoundManager.playSound('end_time');
            }
        }, 500); // ✅ PERF: 500ms suffit pour une précision à la seconde (divise par 5 les re-renders)


        return clearAllTurnTimers;
    }, [gameState?.turnId, gameState?.phase, isPaused, clearAllTurnTimers, activePlayerIsDisconnected]);

    useEffect(() => {
        if (overtime === null || isPaused) return;

        // Si la phase a changé pendant l'overtime, annuler immédiatement
        if (gameState?.phase !== 'PLAYING') {
            setOvertime(null);
            return;
        }

        if (overtime > 0) {
            overtimeTimerRef.current = setTimeout(() => {
                setOvertime(prev => (prev !== null && prev > 0 ? prev - 1 : null));
            }, 1000);
        } else if (overtime === 0) {
            const currentPlayerId = gameState?.currentPlayerId;
            const turnIdToSend = capturedTurnIdRef.current;


            // ✅ RADICAL FIX: Le timer ne verrouille PLUS l'interface.
            // Il se contente d'émettre le signal onTimeout. 
            // L'interface est pilotée par isMyTurn + phase.
            if (currentPlayerId) {
                onTimeoutRef.current(currentPlayerId, turnIdToSend);
                
                watchdogRetriesRef.current += 1;
                if (watchdogRetriesRef.current <= 3) {
                    setOvertime(2); // Watchdog loop: try again in 2 seconds
                } else {
                    console.error(`[Watchdog] Max retries (3) reached for timeout on turn ${turnIdToSend}. Stopping timer to prevent zombie loop.`);
                    setOvertime(null);
                }
            }
        }

        return () => {
            if (overtimeTimerRef.current) clearTimeout(overtimeTimerRef.current);
        };
    }, [overtime, isPaused, gameState?.currentPlayerId, gameState?.phase]);

    return {
        timeLeft,
        setTimeLeft,
        overtime,
        setOvertime,
        clearAllTurnTimers,
        getTurnAgeMs
    };
};
