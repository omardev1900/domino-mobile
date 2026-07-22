import { useCallback } from 'react';
import { GameState, Domino, PlayerId, GameRoom, GamePhase } from '../../core/types';
import { handleTurn, passTurn, resolveBoude, handleTimeout, computeNextRoundState } from '../../core/LogicEngine';
import SoundManager from '../../core/audio/SoundManager';
import { LogService } from '../../core/services/LogService';

export type ActionCommand =
    | { type: 'PLAY_TILE'; playerId: PlayerId; tile: Domino; side?: 'start' | 'left' | 'right' }
    | { type: 'PASS_TURN'; playerId: PlayerId }
    | { type: 'TIMEOUT'; playerId: PlayerId; turnId?: number }
    | { type: 'NEXT_ROUND'; stateOverride?: GameState }
    | { type: 'RESOLVE_BOUDE' }
    | { type: 'MARK_BOUDE'; playerId: PlayerId; turnId: number };

export interface UseActionDispatcherProps {
    gameState: GameState | null;
    localPlayerId: string;
    isSoloMode: boolean;
    gameId: string | undefined;
    isLocalHost: boolean;
    roomData: GameRoom | null;
    startingHandSize?: number;
    acquireLock: () => boolean;
    releaseLock: () => void;
    canAction: (playerId: string, options?: { isAuto?: boolean; minAgeMs?: number }) => boolean;
    safeUpdateGameState: (gameId: string, newState: GameState) => Promise<void>;
    setGameState: (state: GameState) => void;
    clearAllTurnTimers: () => void;
    setOvertime: React.Dispatch<React.SetStateAction<number | null>>;
    onTilePlayed?: (tile: Domino) => void;
}

export const useActionDispatcher = ({
    gameState,
    localPlayerId,
    isSoloMode,
    gameId,
    isLocalHost,
    roomData,
    startingHandSize,
    acquireLock,
    releaseLock,
    canAction,
    safeUpdateGameState,
    setGameState,
    clearAllTurnTimers,
    setOvertime,
    onTilePlayed
}: UseActionDispatcherProps) => {

    const dispatch = useCallback(async (command: ActionCommand) => {
        if (!gameState) return;

        LogService.info('ActionDispatcher', `[DISPATCH] ➔ ${command.type}`, 'playerId' in command ? command.playerId : '');

        // Autorité de l'Hôte pour le TIMEOUT
        // FIX-HOST-TIMEOUT: Utiliser isLocalHost (suit l'élection dynamique) au lieu de
        // roomData.createdBy (statique). Si le créateur déconnecte, l'hôte élu peut
        // continuer à exécuter les timeouts pour les bots/joueurs déconnectés.
        if (command.type === 'TIMEOUT') {
            const player = gameState.players.find(p => p.id === command.playerId);
            const isBotOrDisconnected = player?.status !== 'HUMAN';
            if (isBotOrDisconnected && !isSoloMode && !isLocalHost) {
                return;
            }
        }

        // Vérification globale canAction (C'est son tour ? Verrou libre ? Immunité (timeouts/auto-pass) ?)
        if (command.type === 'PLAY_TILE' || command.type === 'PASS_TURN' || command.type === 'TIMEOUT') {
            const isAuto = command.type === 'TIMEOUT' || command.type === 'PASS_TURN';
            // On distingue l'immunité :
            // - Les pass auto (boudé) ont besoin d'être fluides (1.5s de délai total d'animation, donc 1s d'immunité suffit).
            // - Les Timeouts (fin de chrono) sont des sécurités critiques (5s anti-cascade).
            const minAgeMs = command.type === 'TIMEOUT' ? (__DEV__ ? 1000 : 5000) : 1000;

            if (!canAction(command.playerId, { isAuto, minAgeMs })) {
                LogService.info('ActionDispatcher', 'Action rejected by canAction.', {
                    type: command.type,
                    playerId: command.playerId,
                    currentPlayerId: gameState.currentPlayerId,
                    turnId: gameState.turnId,
                    phase: gameState.phase,
                    isAuto,
                    minAgeMs,
                });
                return;
            }
        }

        // MARK_BOUDE : vérifs minimales (tour du joueur, turnId, phase, non déjà marqué)
        if (command.type === 'MARK_BOUDE') {
            if (gameState.phase !== 'PLAYING') return;
            if (gameState.currentPlayerId !== command.playerId) return;
            if (gameState.turnId !== command.turnId) return;
            if (gameState.boudePlayerId === command.playerId) return;
        }

        // Tente d'acquérir le verrou
        const usesTurnLock = command.type !== 'NEXT_ROUND' && command.type !== 'RESOLVE_BOUDE' && command.type !== 'MARK_BOUDE';

        if (usesTurnLock && !acquireLock()) {
            LogService.info('ActionDispatcher', 'Action rejected because lock is already held.', {
                type: command.type,
                playerId: 'playerId' in command ? command.playerId : undefined,
                currentPlayerId: gameState.currentPlayerId,
                turnId: gameState.turnId,
                phase: gameState.phase,
            });
            return;
        }



        try {
            let newState: GameState | null = null;
            let tilePlayed: Domino | null = null;

            switch (command.type) {
                case 'PLAY_TILE': {
                    if (gameState.phase !== 'PLAYING') break;
                    newState = handleTurn(gameState, command.playerId, command.tile, command.side === 'start' ? undefined : command.side);
                    tilePlayed = command.tile;
                    break;
                }
                case 'PASS_TURN': {
                    if (gameState.phase !== 'PLAYING') break;
                    newState = passTurn(gameState, command.playerId);
                    break;
                }
                case 'TIMEOUT': {
                    if (gameState.phase !== 'PLAYING') break;
                    
                    // Reject stale timeouts
                    if (command.turnId !== undefined && command.turnId !== gameState.turnId) {
                        LogService.info('ActionDispatcher', `Ignored stale timeout: command.turnId=${command.turnId}, gameState.turnId=${gameState.turnId}`);
                        break;
                    }

                    // LogicEngine.ts contains handleTimeout to do exactly this logic purely
                    newState = handleTimeout(gameState, command.playerId);
                    // Determine if a tile was actually played during timeout by checking history
                    const latestAction = newState.history?.[newState.history.length - 1];
                    if (latestAction?.action === 'PLAY' && latestAction.domino) {
                        tilePlayed = latestAction.domino;
                    }
                    break;
                }
                case 'NEXT_ROUND': {
                    if (!isLocalHost) break; // Seul l'hôte pilote la transition
                    const activeState = command.stateOverride || gameState;
                    newState = computeNextRoundState(activeState, startingHandSize);

                    // Override gameId specifically for solo mode local ID generation if needed
                    if (isSoloMode || !activeState.gameId) {
                        newState.gameId = activeState.gameId || gameId || 'local-' + Date.now();
                    }
                    break;
                }
                case 'RESOLVE_BOUDE': {
                    if (!isLocalHost) break; // Seul l'hôte pilote la transition
                    if (gameState.phase !== 'BOUDE') break;
                    const { newState: resolvedState, isTie, tiedPlayerIds } = resolveBoude(gameState);
                    if (isTie) {
                        // TIE = même manche, étoiles inchangées, nouveau round (nouvelle donne)
                        // On incrémente le compteur pour le garde-fou C5
                        const nextTieCount = (gameState.reDealCount || 0) + 1;
                        const stateForRedeal = {
                            ...resolvedState,
                            phase: 'PARTIE_END' as GamePhase,
                            reDealCount: nextTieCount,
                            tiedPlayerIds // FIX: Passer tiedPlayerIds pour que computeNextRoundState le voit !
                        };
                        // R2-B2 : re-injecter tiedPlayerIds après le redeal pour forcer le plus grand double
                        newState = { ...computeNextRoundState(stateForRedeal, startingHandSize), tiedPlayerIds };
                    } else {
                        newState = resolvedState;
                    }
                    break;
                }
                case 'MARK_BOUDE': {
                    // R2-B1 : on marque le joueur boudé dans le state partagé (Firestore) pour que
                    // tous les clients voient l'animation, pas seulement le joueur concerné.
                    newState = { ...gameState, boudePlayerId: command.playerId };
                    break;
                }
            }

            if (newState) {
                // Toujours mettre à jour le timestamp pour forcer Firebase
                newState.lastActionTimestamp = Date.now();

                // Effets sonores
                try {
                    if (command.type === 'NEXT_ROUND') {
                        if ((SoundManager as any).playSound) (SoundManager as any).playSound('shuffle');
                    } else if (tilePlayed) {
                        if (onTilePlayed) onTilePlayed(tilePlayed);
                    } else if (command.type === 'MARK_BOUDE') {
                        if ((SoundManager as any).playSound) (SoundManager as any).playSound('toktok');
                    }
                } catch (e) {
                    console.error('[ActionDispatcher] Sound error:', e);
                }

                // Clear timer on MARK_BOUDE aussi — le timer ne doit pas expirer
                // pendant que le badge Boudé est affiché et que Firestore propage l'état.
                if (command.type !== 'NEXT_ROUND' && command.type !== 'RESOLVE_BOUDE') {
                    setOvertime(null);
                    clearAllTurnTimers();
                }

                if (isSoloMode || !gameId) {
                    setGameState(newState);
                } else {
                    const cleanState = JSON.parse(JSON.stringify(newState));
                    try {
                        let timeoutId: ReturnType<typeof setTimeout>;
                        const timeoutPromise = new Promise<void>((_, reject) => {
                            timeoutId = setTimeout(() => reject(new Error('timeout')), 8000);
                        });
                        try {
                            await Promise.race([
                                safeUpdateGameState(gameId, cleanState),
                                timeoutPromise
                            ]);
                            // FIX-REGRESSION: Mise à jour locale immédiate après confirmation Firebase.
                            // Sans ça, l'UI de l'hôte reste figée jusqu'à l'arrivée du onSnapshot
                            // (200-500ms). Pendant ce délai, timers et autopass calculent sur l'ancien
                            // état et peuvent déclencher des actions dupliquées ou hors-tour.
                            // Le filtre onSnapshot (< strictement) absorbe le snapshot réfléchi
                            // sans déclencher un double re-render.
                            setGameState(cleanState);
                            LogService.info('ActionDispatcher', `[SYNC] Firebase update SUCCESS for ${command.type}`);
                        } finally {
                            clearTimeout(timeoutId!);
                        }
                    } catch (syncError: any) {
                        // Échec définitif — on ne met PAS à jour localement pour éviter la divergence.
                        // L'état local reste sur l'ancien état confirmé ; le prochain snapshot valide
                        // remettra le jeu en cohérence.
                        LogService.error('ActionDispatcher', `[SYNC] Firebase sync failed definitively: ${syncError?.code || syncError?.message || syncError}`);
                    }
                }
            } else {

            }
        } catch (e) {
            LogService.error('ActionDispatcher', 'Erreur durant l\'action:', e);
        } finally {
            // Toujours libérer le verrou à la fin de l'action, qu'elle réussisse ou échoue !
            if (usesTurnLock) {
                releaseLock();
            }
        }

    }, [
        gameState,
        localPlayerId,
        isSoloMode,
        gameId,
        isLocalHost,
        startingHandSize,
        acquireLock,
        releaseLock,
        canAction,
        safeUpdateGameState,
        setGameState,
        clearAllTurnTimers,
        setOvertime,
        onTilePlayed
    ]);

    return { dispatch };
};
