import { useRef, useEffect, useCallback } from 'react';
import { GameState } from '../../core/types';

export interface UseTurnManagerProps {
    gameState: GameState | null;
}

export interface UseTurnManagerResult {
    isProcessingMove: React.MutableRefObject<boolean>;
    acquireLock: () => boolean;
    releaseLock: () => void;
    canAction: (playerId: string, optionsOrAuto?: boolean | { isAuto?: boolean; minAgeMs?: number }) => boolean;
}

export const useTurnManager = ({ gameState }: UseTurnManagerProps): UseTurnManagerResult => {
    // ✅ RÈGLE DE SÉCURITÉ GLOBALE : Ce hook possède le verrou central.
    // Personne d'autre ne doit déclarer un `isProcessingMove`.
    const isProcessingMove = useRef<boolean>(false);

    // ✅ NOUVEAU : Référence de temps locale pour l'immunité du tour (C4/P1)
    const turnMountedAtRef = useRef<number>(Date.now());

    // Auto-release du verrou quand le tour ou la phase change. En multi,
    // Firestore peut livrer PARTIE_END avant la fin de l'await d'un PASS_TURN.
    useEffect(() => {
        if (gameState?.turnId !== undefined) {
            isProcessingMove.current = false;
            turnMountedAtRef.current = Date.now(); // On resette l'horloge locale au changement de tour
        }
    }, [gameState?.turnId, gameState?.phase]);

    const acquireLock = useCallback((): boolean => {
        if (isProcessingMove.current) {
            return false; // Verrou déjà pris
        }
        isProcessingMove.current = true;
        return true;
    }, []);

    const releaseLock = useCallback(() => {
        isProcessingMove.current = false;
    }, []);

    const canAction = useCallback((playerId: string, optionsOrAuto: boolean | { isAuto?: boolean; minAgeMs?: number } = false): boolean => {
        if (!gameState) return false;
        
        // Supporter à la fois le format boolean (rétro-compatibilité tests) et object (nouveau)
        // Note: true (boolean) correspond historiquement à un Timeout avec 5s d'immunité.
        const options = typeof optionsOrAuto === 'boolean' 
            ? { isAuto: optionsOrAuto, minAgeMs: optionsOrAuto ? 5000 : 0 } 
            : optionsOrAuto;

        // 1. C'est bien son tour ?
        if (gameState.currentPlayerId !== playerId) {
            return false;
        }

        // 2. Le verrou est-il libre ?
        if (isProcessingMove.current) {
            return false;
        }

        // 3. Immunité de tour locale (C4/P1)
        const turnAgeMs = Date.now() - turnMountedAtRef.current;
        if (options?.isAuto) {
            // Si c'est un timeout PUR (5s) ou un auto-pass plus fluide (1s)
            const minAge = options.minAgeMs ?? 1000;
            if (turnAgeMs < minAge) {
                return false;
            }
        }

        return true;
    }, [gameState]);

    return {
        isProcessingMove,
        acquireLock,
        releaseLock,
        canAction
    };
};
