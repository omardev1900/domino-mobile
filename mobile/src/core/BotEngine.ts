import { Domino, DominoSide, GameState } from './types';
import { getBotMove as getEngineBotMove, ValidMove } from './DominoEngine';
import { getForcedOpeningDominoId, getForcedTieBreakDominoId } from './LogicEngine';
import { LogService } from './services/LogService';
import { getMeytKayaliMove, initMeytKayali } from './MeytKayaliEngine';

/**
 * Interface pour le retour du Bot
 */
export interface BotDecision {
    tile: Domino;
    side: 'left' | 'right' | 'start';
}

export const computeEmergencyBotDecision = (gameState: GameState, playerId: string): BotDecision | null => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    const forcedOpeningId = getForcedOpeningDominoId(gameState, playerId) ?? getForcedTieBreakDominoId(gameState, playerId);
    if (forcedOpeningId) {
        const forcedTile = player.hand.find(t => t.id === forcedOpeningId);
        if (forcedTile) {
            return { tile: forcedTile, side: 'start' };
        }
    }

    return getBotMove(
        player.hand,
        gameState.table.leftValue,
        gameState.table.rightValue,
        'GRAN_MOUN'
    );
};

/**
 * Point d'entrée pour obtenir le coup d'un bot.
 * Utilise le nouveau DominoEngine pour calculer la meilleure stratégie.
 */
export const getBotMove = (
    hand: Domino[],
    leftValue: DominoSide | null,
    rightValue: DominoSide | null,
    difficulty: 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN' | 'METKAYALI' = 'MAPIPI',
    playedTiles?: Domino[],
    opponentPassedValues?: number[]
): BotDecision | null => {
    // SECURITY: Ensure we are passing actual values or null, not an object
    if (typeof leftValue === 'object' && leftValue !== null) {
        LogService.error('BotEngine', 'leftValue is an object! Check call site.');
        return null;
    }

    // Safety for opening turns: if the table is empty and the bot has doubles,
    // start with the highest double to stay compatible with strict opening rules.
    if (leftValue === null && rightValue === null) {
        const highestDouble = hand
            .filter(tile => tile.isDouble || tile.left === tile.right)
            .sort((a, b) => (b.left + b.right) - (a.left + a.right))[0];

        if (highestDouble) {
            return {
                tile: highestDouble,
                side: 'start'
            };
        }
    }

    // MÈTKAYALI utilise getMeytKayaliMove() via computeBotDecision() avec le gameState complet
    // Ce fallback GRAN_MOUN ne doit pas être atteint pour METKAYALI en conditions normales
    if (difficulty === 'METKAYALI') {
        LogService.error('BotEngine', 'METKAYALI requires full gameState and must be resolved via computeBotDecision.');
        return null;
    }
    const decision = getEngineBotMove(hand, { left: leftValue, right: rightValue }, difficulty, playedTiles, opponentPassedValues);

    if (!decision) return null;

    // Map the internal decision to the expected return type
    return {
        tile: decision.tile,
        side: decision.side as 'left' | 'right' | 'start'
    };
};

/**
 * Calcule purement la décision d'un joueur (bot ou déconnecté).
 * Prend en charge l'obligation de rejouer le plus gros double au 1er tour.
 */
export const computeBotDecision = (gameState: GameState, playerId: string): BotDecision | null => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    const forcedOpeningId = getForcedOpeningDominoId(gameState, playerId) ?? getForcedTieBreakDominoId(gameState, playerId);
    if (forcedOpeningId) {
        const forcedTile = player.hand.find(t => t.id === forcedOpeningId);
        if (forcedTile) {
            return { tile: forcedTile, side: 'start' };
        }
    }

    if (player.difficulty === 'METKAYALI') {
        const opponentIds = gameState.players
            .filter(p => p.id !== playerId)
            .map(p => p.id);
        const mkState = initMeytKayali(player.hand, opponentIds, gameState.startingHandSize || 7);
        const { decision } = getMeytKayaliMove(mkState, gameState, playerId);
        return decision
            ? { tile: decision.tile, side: decision.side }
            : null;
    }

    // Extract context from GameState for smarter GRAN_MOUN decisions
    const playedTiles: Domino[] = gameState.history
        .filter(h => h.action === 'PLAY' && h.domino != null)
        .map(h => h.domino as Domino);

    const opponentPassedValues: number[] = [];
    const opponentIds = gameState.players
        .filter(p => p.id !== playerId)
        .map(p => p.id);

    if (gameState.history.length > 0) {
        // Build a lookup: domino ID → sequence metadata (side and orientation)
        const seqByDominoId = new Map<string, { sideAtTable: 'left' | 'right'; isReversed: boolean }>();
        for (const se of gameState.table.sequence) {
            seqByDominoId.set(se.domino.id, { sideAtTable: se.sideAtTable, isReversed: se.isReversed });
        }

        let currentLeft: number | null = null;
        let currentRight: number | null = null;
        let isFirstPlay = true;

        for (const entry of gameState.history) {
            if (entry.action === 'PLAY' && entry.domino) {
                if (isFirstPlay) {
                    currentLeft = entry.domino.left;
                    currentRight = entry.domino.right;
                    isFirstPlay = false;
                } else {
                    const se = seqByDominoId.get(entry.domino.id);
                    if (se) {
                        if (se.sideAtTable === 'left') {
                            currentLeft = se.isReversed ? entry.domino.right : entry.domino.left;
                        } else {
                            currentRight = se.isReversed ? entry.domino.left : entry.domino.right;
                        }
                    }
                }
            } else if (entry.action === 'PASS' && opponentIds.includes(entry.playerId)) {
                if (currentLeft !== null) opponentPassedValues.push(currentLeft);
                if (currentRight !== null && currentRight !== currentLeft) {
                    opponentPassedValues.push(currentRight);
                }
            }
        }
    }

    return getBotMove(
        player.hand,
        gameState.table.leftValue,
        gameState.table.rightValue,
        (player.difficulty as any) || 'MAPIPI',
        playedTiles,
        opponentPassedValues
    );
};
