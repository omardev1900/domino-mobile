import { useState, useEffect, useCallback } from 'react';
import { GameState, GameRoom, Domino, PlayerId, Player } from '../core/types';
import {
    subscribeToRoom,
    updateGameState,
    startGame
} from '../core/services/firebase';
import {
    dealGame,
    determineFirstPlayer,
    handleTurn,
    passTurn,
    checkValidMove,
    resolveBoude,
    getForcedOpeningDominoId
} from '../core/LogicEngine';
import { computeBotDecision } from '../core/BotEngine';
import SoundManager from '../core/audio/SoundManager';
import HapticManager from '../core/audio/HapticManager';
import { Alert } from 'react-native';

export const useMultiplayerGame = (gameId: string | undefined, userId: string | undefined) => {
    const [roomData, setRoomData] = useState<GameRoom | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [localPlayerId] = useState<PlayerId>(userId || '');

    // Subscribe to Room
    useEffect(() => {
        if (!gameId) return;

        const unsubscribe = subscribeToRoom(gameId, (data) => {
            setRoomData(data);
            if (data.gameState) {
                setGameState(data.gameState);
                setIsStarting(false);
            }
        });

        return () => unsubscribe();
    }, [gameId]);

    // Start Game (Host Only)
    const handleStartGame = useCallback(async () => {
        if (!roomData || !gameId) return;

        setIsStarting(true);
        const realPlayers = roomData.players;
        const playerNames = realPlayers.map(p => p.displayName);

        // Fill with Bots if < 3
        while (playerNames.length < 3) {
            playerNames.push(`Bot ${playerNames.length + 1}`);
        }

        try {
            const partialState = dealGame(playerNames, roomData.startingHandSize || 7);
            const players = partialState.players as Player[];

            // Map real players to slots
            const finalPlayers = players.map((p, i) => {
                if (i < realPlayers.length) {
                    return {
                        ...p,
                        id: realPlayers[i].uid,
                        name: realPlayers[i].displayName,
                        avatarId: realPlayers[i].avatarId,
                        status: 'HUMAN' as const
                    };
                } else {
                    return { ...p, id: `bot-${i}`, name: `Bot ${i}`, status: 'BOT' as const, avatarId: i === 1 ? 'Spark_2' : i === 2 ? 'Atlas_3' : 'Zenith_4' };
                }
            });

            const firstPlayerId = determineFirstPlayer(finalPlayers);

            const initialState: GameState = {
                gameId: gameId,
                players: finalPlayers,
                talonMort: partialState.talonMort as Domino[],
                table: partialState.table!,
                currentPlayerId: firstPlayerId,
                phase: 'PLAYING',
                firstPlayerOfRound: null,
                history: [],
                winningCondition: roomData.winningCondition || 3,
                gameMode: roomData.gameMode || 'MANCHE',
                turnDuration: roomData.turnDuration || 15,
                startingHandSize: roomData.startingHandSize || 7,
                lastActionTimestamp: Date.now(),
                turnId: 0,
                mancheHistory: [],
                roundNumber: 1,
                mancheNumber: 1,
            };

            // Sanitize undefined
            const cleanState = JSON.parse(JSON.stringify(initialState, (k, v) => v === undefined ? null : v));

            await startGame(gameId, cleanState);
        } catch (e: any) {
            Alert.alert("Error", "Failed to start game: " + e.message);
            setIsStarting(false);
        }
    }, [roomData, gameId]);

    // Handle Human Move
    const handleHumanMove = useCallback(async (domino: Domino) => {
        if (!gameState || !gameId) return;
        if (gameState.currentPlayerId !== localPlayerId) return;

        try {
            const newState = handleTurn(gameState, localPlayerId, domino);
            HapticManager.triggerImpact();
            await updateGameState(gameId, newState);
        } catch (e) {
            console.log("Invalid move", e);
        }
    }, [gameState, gameId, localPlayerId]);

    // Handle Human Pass
    const handleHumanPass = useCallback(async () => {
        if (!gameState || !gameId) return;

        const player = gameState.players.find(p => p.id === localPlayerId);
        const canPlay = player?.hand.some(d =>
            checkValidMove(d, gameState.table.leftValue, gameState.table.rightValue).canPlay
        );

        if (canPlay) {
            throw new Error("Vous avez des dominos jouables.");
        }

        const newState = passTurn(gameState, localPlayerId);
        await updateGameState(gameId, newState);
    }, [gameState, gameId, localPlayerId]);

    // Bot Execution (Host Only)
    useEffect(() => {
        if (!gameState || !gameId || !roomData) return;

        const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
        const isHost = roomData.players[0].uid === localPlayerId;

        if (currentPlayer?.status === 'BOT' && gameState.phase === 'PLAYING' && isHost) {
            const timer = setTimeout(async () => {
                const forcedOpeningId = getForcedOpeningDominoId(gameState, currentPlayer.id);
                const forcedOpeningTile = forcedOpeningId
                    ? currentPlayer.hand.find(tile => tile.id === forcedOpeningId) || null
                    : null;

                const move = forcedOpeningTile
                    ? { tile: forcedOpeningTile, side: 'start' as const }
                    : computeBotDecision(gameState, currentPlayer.id);

                try {
                    let newState;
                    if (move) {
                        // Fix: getBotMove returns { tile, side }, but handleTurn expects a Domino
                        newState = handleTurn(gameState, currentPlayer.id, move.tile, move.side === 'start' ? undefined : move.side);
                    } else {
                        newState = passTurn(gameState, currentPlayer.id);
                        SoundManager.playSound('notify');
                    }
                    await updateGameState(gameId, newState);
                } catch (error) {
                    console.error("Bot Error", error);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [gameState, gameId, roomData, localPlayerId]);

    // Boudé Resolution (Host Only)
    useEffect(() => {
        if (gameState?.phase === 'BOUDE' && gameId && roomData) {
            const isHost = roomData.players[0].uid === localPlayerId;
            if (!isHost) return;

            const timer = setTimeout(async () => {
                const { newState, isTie } = resolveBoude(gameState);
                if (isTie) {
                    // Tie Logic needed - Restart Round
                    // For now just update state, but ideally trigger restart
                    // We can't restart easily inside simple hook without exposing restart function
                    // Let's assume restart is handled by updating phase to 'ROUND_END' in a specific way or calling a separate function
                    // For MVP: Treat Tie as End of Round with no winner?
                    // LogicEngine's handleEndOfRound handles TIE by setting phase to BOUDE, so we need to break loop.
                    // Let's force a re-deal or round restart.
                    // Implementation Detail: handleNextRound logic is complex.
                    // We might need to expose handleNextRound or similar.
                    // For now, let's just push the state.
                }
                await updateGameState(gameId, newState);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [gameState?.phase, gameId, roomData, localPlayerId]);

    // Handle Timeout (Auto-Play)
    const handleTimeout = useCallback(async (playerId: PlayerId) => {
        if (!gameState || !gameId) return;
        if (gameState.currentPlayerId !== playerId) return;
        if (playerId !== localPlayerId) return; // Only handle own timeout

        const player = gameState.players.find(p => p.id === playerId);
        const forcedOpeningId = getForcedOpeningDominoId(gameState, playerId);
        if (forcedOpeningId) {
            const forcedOpeningTile = player?.hand.find(tile => tile.id === forcedOpeningId);
            if (forcedOpeningTile) {
                await handleHumanMove(forcedOpeningTile);
                return;
            }
        }

        const validMove = player?.hand.find(d =>
            checkValidMove(d, gameState.table.leftValue, gameState.table.rightValue).canPlay
        );

        if (validMove) {
            await handleHumanMove(validMove);
        } else {
            await handleHumanPass();
        }
    }, [gameState, gameId, localPlayerId, handleHumanMove, handleHumanPass]);

    // Handle Next Round (Host Only)
    const handleNextRound = useCallback(async () => {
        if (!gameState || !gameId || !roomData) return;

        // Host check
        if (roomData.players[0].uid !== localPlayerId) return;

        const playerNames = gameState.players.map(p => p.name);
        const partialState = dealGame(playerNames, gameState.startingHandSize);

        const nextPlayers = gameState.players.map((p, i) => {
            const newP = partialState.players![i];
            return {
                ...p,
                hand: newP.hand,
                handSize: newP.handSize
            };
        });

        const firstPlayerId = determineFirstPlayer(nextPlayers);

        const nextState: GameState = {
            ...gameState,
            players: nextPlayers,
            talonMort: partialState.talonMort as Domino[],
            table: partialState.table!,
            currentPlayerId: firstPlayerId,
            phase: 'PLAYING',
            history: [],
            lastActionTimestamp: Date.now()
        };

        const cleanState = JSON.parse(JSON.stringify(nextState, (k, v) => v === undefined ? null : v));
        await updateGameState(gameId, cleanState);

    }, [gameState, gameId, roomData, localPlayerId]);

    return {
        roomData,
        gameState,
        isStarting,
        handleStartGame,
        handleHumanMove,
        handleHumanPass,
        handleTimeout,
        handleNextRound
    };
};
