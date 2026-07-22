import { useState, useCallback, useRef } from 'react';
import { GameState, Domino, Player, PlayerId } from '../core/types';
import {
    dealGameSolo,
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

export const useSoloGame = (userId: string, difficulty: 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN' | 'METKAYALI' = 'MAPIPI') => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [localPlayerId] = useState<PlayerId>(userId);

    // Ref to prevent stale closures
    const gameStateRef = useRef<GameState | null>(null);
    const botTimerRef = useRef<any>(null);

    // Update ref whenever state changes
    const updateGameState = useCallback((newState: GameState) => {
        gameStateRef.current = newState;
        setGameState(newState);
    }, []);



    // Initialize Solo Game
    const startSoloGame = useCallback(() => {
        const partialState = dealGameSolo(localPlayerId, 'Me', difficulty);
        const players = partialState.players as Player[];
        const firstPlayerId = determineFirstPlayer(players);

        const fullState: GameState = {
            gameId: 'solo-' + Date.now(),
            players: players,
            talonMort: partialState.talonMort as Domino[],
            table: partialState.table!,
            currentPlayerId: firstPlayerId,
            phase: 'PLAYING',
            firstPlayerOfRound: null,
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            turnDuration: 15,
            lastActionTimestamp: Date.now(),
            turnId: 0,
            mancheHistory: [],
            roundNumber: 1,
            mancheNumber: 1,
            startingHandSize: 7
        };

        SoundManager.playSound('shuffle');
        updateGameState(fullState);
    }, [localPlayerId, difficulty, updateGameState]);

    const handleNextRound = useCallback(() => {
        const currentState = gameStateRef.current;
        if (!currentState) return;

        const partialState = dealGameSolo(localPlayerId, 'Me', difficulty);
        const nextPlayers = currentState.players.map((p, i) => {
            const newP = partialState.players![i];
            return {
                ...p,
                hand: newP.hand,
                handSize: newP.handSize
            };
        });

        const firstPlayerId = determineFirstPlayer(nextPlayers);

        const nextState: GameState = {
            ...currentState,
            players: nextPlayers,
            talonMort: partialState.talonMort as Domino[],
            table: partialState.table!,
            currentPlayerId: firstPlayerId,
            phase: 'PLAYING',
            turnDuration: 15,
            firstPlayerOfRound: null,
            history: [],
            lastActionTimestamp: Date.now()
        };

        updateGameState(nextState);
    }, [localPlayerId, difficulty, updateGameState]);

    return {
        gameState,
        startSoloGame,
        handleNextRound,
        setGameState: updateGameState
    };
};
