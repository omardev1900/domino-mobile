import { Domino, DominoSide, GameState } from './types';
import { getValidMoves, ValidMove } from './DominoEngine';
import { getForcedOpeningDominoId, getForcedTieBreakDominoId } from './LogicEngine';
import {
    TileTracker,
    initTileTracker,
    onOpponentPlayed,
    onOpponentPassed,
    onTilePlayed,
} from './ai/TileTracker';
import {
    OpponentProfiles,
    initOpponentProfiles,
    updateOnPlay,
    updateOnPass,
    getExposurePenalty,
} from './ai/OpponentModeler';
import {
    calculateBoudeRisk,
    getStrategyMode,
    getMCWeights,
    StrategyMode,
} from './ai/EndgameAnalyzer';
import { simulateCoup } from './ai/MonteCarlo';

export interface MeytKayaliDecision {
    tile: Domino;
    side: 'left' | 'right' | 'start';
    isReversed: boolean;
}

export interface MeytKayaliState {
    tracker: TileTracker;
    profiles: OpponentProfiles;
}

export function initMeytKayali(myHand: Domino[], opponentIds: string[], initialHandSize = 7): MeytKayaliState {
    return {
        tracker: initTileTracker(myHand, opponentIds, initialHandSize),
        profiles: initOpponentProfiles(opponentIds, initialHandSize),
    };
}

export function updateAfterOpponentPlay(
    state: MeytKayaliState,
    playerId: string,
    tile: Domino
): MeytKayaliState {
    const tracker = onOpponentPlayed(state.tracker, playerId, tile);
    const profiles = updateOnPlay(state.profiles, tracker, playerId, tile);
    return { tracker, profiles };
}

export function updateAfterOpponentPass(
    state: MeytKayaliState,
    playerId: string,
    leftValue: DominoSide | null,
    rightValue: DominoSide | null
): MeytKayaliState {
    const tracker = onOpponentPassed(state.tracker, playerId, leftValue, rightValue);
    const profiles = updateOnPass(state.profiles, tracker, playerId, leftValue, rightValue);
    return { tracker, profiles };
}

export function getMeytKayaliMove(
    engineState: MeytKayaliState,
    gameState: GameState,
    botId: string,
    simCount = 650
): { decision: MeytKayaliDecision | null; updatedState: MeytKayaliState } {
    const botPlayer = gameState.players.find(p => p.id === botId);
    if (!botPlayer) return { decision: null, updatedState: engineState };

    const liveState = rebuildStateFromGame(gameState, botId);
    const hand = botPlayer.hand;
    const leftValue = gameState.table.leftValue;
    const rightValue = gameState.table.rightValue;

    const forcedOpeningId = getForcedOpeningDominoId(gameState, botId);
    if (forcedOpeningId) {
        const forcedMove = hand
            .filter(tile => tile.id === forcedOpeningId)
            .flatMap(tile => getValidMoves([tile], { left: leftValue, right: rightValue }))
            [0];

        if (forcedMove) {
            return {
                decision: moveToDecision(forcedMove),
                updatedState: liveState,
            };
        }
    }

    const forcedTieBreakId = getForcedTieBreakDominoId(gameState, botId);
    if (forcedTieBreakId) {
        const forcedMove = hand
            .filter(tile => tile.id === forcedTieBreakId)
            .flatMap(tile => getValidMoves([tile], { left: leftValue, right: rightValue }))
            [0];

        if (forcedMove) {
            return {
                decision: moveToDecision(forcedMove),
                updatedState: liveState,
            };
        }
    }

    const validMoves = getValidMoves(hand, { left: leftValue, right: rightValue });
    if (validMoves.length === 0) return { decision: null, updatedState: liveState };
    if (validMoves.length === 1) {
        return {
            decision: moveToDecision(validMoves[0]),
            updatedState: liveState,
        };
    }

    const opponentIds = gameState.players
        .filter(p => p.id !== botId && p.status !== 'DISCONNECTED')
        .map(p => p.id);

    const boudeRisk = calculateBoudeRisk(gameState, liveState.tracker);
    const mode = getStrategyMode(boudeRisk);
    const weights = getMCWeights(mode);
    const { simulations, timeBudgetMs, pressureLevel } = getAdaptiveBudget(gameState, botId, validMoves.length, simCount);

    let bestMove: ValidMove | null = null;
    let bestScore = -Infinity;

    for (const move of validMoves) {
        const handAfter = hand.filter(t => t.id !== move.tile.id);
        const { newLeft, newRight } = getNextEnds(move, leftValue, rightValue);

        const mc = simulateCoup(
            handAfter,
            move.tile,
            move.side,
            newLeft,
            newRight,
            liveState.tracker,
            opponentIds,
            simulations,
            timeBudgetMs
        );

        const exposurePenalty = getExposurePenalty(liveState.profiles, newLeft ?? 0, newRight ?? 0);
        const tacticalBonus = evaluateTacticalMove(
            handAfter,
            move.tile,
            newLeft,
            newRight,
            liveState.profiles,
            mode,
            boudeRisk
        );

        let score = weights.winRate * mc.winRate + weights.boudeSafety * mc.boudeSafetyScore;
        score += tacticalBonus;
        score -= exposurePenalty * getExposureWeight(pressureLevel, mode);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    if (!bestMove) bestMove = validMoves[0];

    const updatedTracker = onTilePlayed(liveState.tracker, bestMove.tile);

    return {
        decision: moveToDecision(bestMove),
        updatedState: { ...liveState, tracker: updatedTracker },
    };
}

function moveToDecision(move: ValidMove): MeytKayaliDecision {
    return { tile: move.tile, side: move.side, isReversed: move.isReversed };
}

function rebuildStateFromGame(gameState: GameState, botId: string): MeytKayaliState {
    const botPlayer = gameState.players.find(p => p.id === botId);
    if (!botPlayer) {
        return initMeytKayali([], []);
    }

    const opponentIds = gameState.players
        .filter(p => p.id !== botId)
        .map(p => p.id);

    let state = initMeytKayali(botPlayer.hand, opponentIds, gameState.startingHandSize || 7);

    const seqByDominoId = new Map<string, { sideAtTable: 'left' | 'right'; isReversed: boolean }>();
    for (const se of gameState.table.sequence) {
        seqByDominoId.set(se.domino.id, { sideAtTable: se.sideAtTable, isReversed: se.isReversed });
    }

    let currentLeft: number | null = null;
    let currentRight: number | null = null;
    let isFirstPlay = true;

    for (const entry of gameState.history) {
        if (entry.action === 'PLAY' && entry.domino) {
            if (entry.playerId === botId) {
                state = { ...state, tracker: onTilePlayed(state.tracker, entry.domino) };
            } else {
                state = updateAfterOpponentPlay(state, entry.playerId, entry.domino);
            }

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
        } else if (entry.action === 'PASS' && entry.playerId !== botId) {
            state = updateAfterOpponentPass(state, entry.playerId, currentLeft, currentRight);
        }
    }

    return state;
}

function getNextEnds(
    move: ValidMove,
    leftValue: DominoSide | null,
    rightValue: DominoSide | null
): { newLeft: DominoSide | null; newRight: DominoSide | null } {
    let newLeft = leftValue;
    let newRight = rightValue;

    if (move.side === 'left') {
        newLeft = move.isReversed ? move.tile.right : move.tile.left;
    } else if (move.side === 'right') {
        newRight = move.isReversed ? move.tile.left : move.tile.right;
    } else {
        newLeft = move.tile.left;
        newRight = move.tile.right;
    }

    return { newLeft, newRight };
}

function getAdaptiveBudget(
    gameState: GameState,
    botId: string,
    validMoveCount: number,
    baseSimCount: number
): { simulations: number; timeBudgetMs: number; pressureLevel: 'normal' | 'high' | 'critical' } {
    const opponents = gameState.players.filter(p => p.id !== botId && p.status !== 'DISCONNECTED');
    const minOpponentHand = opponents.reduce((min, player) => Math.min(min, player.hand.length), 7);
    const avgOpponentHand = opponents.reduce((sum, player) => sum + player.hand.length, 0) / Math.max(opponents.length, 1);

    let pressureLevel: 'normal' | 'high' | 'critical' = 'normal';
    if (minOpponentHand <= 2 || avgOpponentHand <= 3) pressureLevel = 'critical';
    else if (minOpponentHand <= 3 || validMoveCount >= 5) pressureLevel = 'high';

    if (pressureLevel === 'critical') {
        return {
            simulations: Math.max(baseSimCount, 1100),
            timeBudgetMs: 150,
            pressureLevel,
        };
    }

    if (pressureLevel === 'high') {
        return {
            simulations: Math.max(baseSimCount, 850),
            timeBudgetMs: 110,
            pressureLevel,
        };
    }

    return {
        simulations: baseSimCount,
        timeBudgetMs: 85,
        pressureLevel,
    };
}

function evaluateTacticalMove(
    handAfter: Domino[],
    playedTile: Domino,
    newLeft: DominoSide | null,
    newRight: DominoSide | null,
    profiles: OpponentProfiles,
    mode: StrategyMode,
    boudeRisk: number
): number {
    if (handAfter.length === 0) return 0.5;

    const continuity = getContinuityScore(handAfter, newLeft, newRight);
    const dominance = getDominanceScore(handAfter, newLeft, newRight);
    const blockBonus = getBlockBonus(profiles, newLeft, newRight);
    const heavyBonus = ((playedTile.left + playedTile.right) / 12) * Math.max(0, boudeRisk - 0.25);
    const selfTrapPenalty = continuity === 0 ? 0.24 : 0;

    if (mode === 'SCORE_MIN') {
        return (continuity * 0.12) + (dominance * 0.08) + (blockBonus * 0.1) + (heavyBonus * 0.22) - selfTrapPenalty;
    }

    return (continuity * 0.18) + (dominance * 0.16) + (blockBonus * 0.14) + (heavyBonus * 0.08) - selfTrapPenalty;
}

function getContinuityScore(
    handAfter: Domino[],
    newLeft: DominoSide | null,
    newRight: DominoSide | null
): number {
    if (handAfter.length === 0) return 1;

    let playableFollowUps = 0;
    for (const tile of handAfter) {
        if (
            (newLeft !== null && (tile.left === newLeft || tile.right === newLeft))
            || (newRight !== null && (tile.left === newRight || tile.right === newRight))
        ) {
            playableFollowUps++;
        }
    }

    return playableFollowUps / handAfter.length;
}

function getDominanceScore(
    handAfter: Domino[],
    newLeft: DominoSide | null,
    newRight: DominoSide | null
): number {
    const counts = new Map<number, number>();
    for (const tile of handAfter) {
        counts.set(tile.left, (counts.get(tile.left) ?? 0) + 1);
        counts.set(tile.right, (counts.get(tile.right) ?? 0) + 1);
    }

    const leftCount = newLeft !== null ? counts.get(newLeft) ?? 0 : 0;
    const rightCount = newRight !== null ? counts.get(newRight) ?? 0 : 0;
    return Math.min(1, Math.max(leftCount, rightCount) / Math.max(handAfter.length, 1));
}

function getBlockBonus(
    profiles: OpponentProfiles,
    newLeft: DominoSide | null,
    newRight: DominoSide | null
): number {
    if (newLeft === null || newRight === null) return 0;

    let blockedWeight = 0;
    let totalWeight = 0;
    for (const profile of profiles.values()) {
        const risk = getProfilePressureWeight(profile.handSize);
        totalWeight += risk;
        const blocksLeft = profile.excludedValues.has(newLeft);
        const blocksRight = profile.excludedValues.has(newRight);
        if (blocksLeft && blocksRight) blockedWeight += risk;
        else if (blocksLeft || blocksRight) blockedWeight += risk * 0.45;
    }

    if (totalWeight === 0) return 0;
    return blockedWeight / totalWeight;
}

function getProfilePressureWeight(handSize: number): number {
    if (handSize <= 1) return 1.2;
    if (handSize <= 2) return 1;
    if (handSize <= 4) return 0.7;
    return 0.35;
}

function getExposureWeight(
    pressureLevel: 'normal' | 'high' | 'critical',
    mode: StrategyMode
): number {
    if (pressureLevel === 'critical') return mode === 'SCORE_MIN' ? 0.55 : 0.75;
    if (pressureLevel === 'high') return mode === 'SCORE_MIN' ? 0.45 : 0.62;
    return mode === 'SCORE_MIN' ? 0.35 : 0.5;
}
