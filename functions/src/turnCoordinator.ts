import { computeBotDecision, computeEmergencyBotDecision } from './gameCore/BotEngine';
import { getValidMoves } from './gameCore/DominoEngine';
import { handleTimeout, handleTurn, passTurn } from './gameCore/LogicEngine';
import { GameState, PlayerStatus } from './gameCore/types';

export const BOT_TURN_DELAY_MS = 1250;
export const ABSENT_PLAYER_DELAY_MS = 2500;
export const BOUDE_DISPLAY_MS = 2000;
export const DISCONNECTED_BOUDE_DISPLAY_MS = 3500;
export const TURN_TIMEOUT_GRACE_MS = 3000;

export interface TurnFingerprint {
    gameId: string;
    stateVersion: number;
    turnId: number;
    currentPlayerId: string;
    playerStatus: PlayerStatus;
    boudePlayerId: string | null;
}

export type TurnDecision =
    | { kind: 'MARK_BOUDE'; actionId: string; nextState: GameState }
    | { kind: 'PASS'; actionId: string; nextState: GameState }
    | { kind: 'PLAY'; actionId: string; nextState: GameState }
    | { kind: 'TIMEOUT'; actionId: string; nextState: GameState };

export const getTurnFingerprint = (state: GameState): TurnFingerprint | null => {
    if (state.phase !== 'PLAYING') return null;
    const player = state.players.find(candidate => candidate.id === state.currentPlayerId);
    if (!player) return null;

    return {
        gameId: state.gameId,
        stateVersion: state.stateVersion ?? 0,
        turnId: state.turnId ?? 0,
        currentPlayerId: state.currentPlayerId,
        playerStatus: player.status ?? 'HUMAN',
        boudePlayerId: state.boudePlayerId ?? null,
    };
};

export const serializeTurnFingerprint = (fingerprint: TurnFingerprint): string =>
    [
        fingerprint.gameId,
        fingerprint.stateVersion,
        fingerprint.turnId,
        fingerprint.currentPlayerId,
        fingerprint.playerStatus,
        fingerprint.boudePlayerId ?? '-',
    ].join(':');

export const hasTurnFingerprint = (state: GameState, expected: TurnFingerprint): boolean => {
    const current = getTurnFingerprint(state);
    return current !== null
        && serializeTurnFingerprint(current) === serializeTurnFingerprint(expected);
};

const activePlayerHasValidMove = (state: GameState): boolean => {
    const player = state.players.find(candidate => candidate.id === state.currentPlayerId);
    if (!player) return false;
    return getValidMoves(player.hand, {
        left: state.table.leftValue,
        right: state.table.rightValue,
    }).length > 0;
};

export const getCoordinatedTurnDelayMs = (state: GameState): number | null => {
    const fingerprint = getTurnFingerprint(state);
    if (!fingerprint) return null;

    if (!activePlayerHasValidMove(state)) {
        if (state.boudePlayerId !== state.currentPlayerId) return 0;
        return fingerprint.playerStatus === 'DISCONNECTED'
            ? DISCONNECTED_BOUDE_DISPLAY_MS
            : BOUDE_DISPLAY_MS;
    }

    if (fingerprint.playerStatus === 'HUMAN') {
        const boundedTurnDuration = Math.min(Math.max(0, state.turnDuration), 60);
        return boundedTurnDuration * 1000 + TURN_TIMEOUT_GRACE_MS;
    }
    if (fingerprint.playerStatus === 'BOT') return BOT_TURN_DELAY_MS;
    return ABSENT_PLAYER_DELAY_MS;
};

export const computeTurnDecision = (state: GameState): TurnDecision | null => {
    const fingerprint = getTurnFingerprint(state);
    if (!fingerprint) return null;
    const actionId = serializeTurnFingerprint(fingerprint);

    if (!activePlayerHasValidMove(state)) {
        if (state.boudePlayerId !== state.currentPlayerId) {
            return {
                kind: 'MARK_BOUDE',
                actionId,
                nextState: {
                    ...state,
                    boudePlayerId: state.currentPlayerId,
                    lastActionTimestamp: Date.now(),
                    stateVersion: (state.stateVersion ?? 0) + 1,
                },
            };
        }
        return {
            kind: 'PASS',
            actionId,
            nextState: passTurn(state, state.currentPlayerId),
        };
    }

    if (fingerprint.playerStatus === 'HUMAN') {
        return {
            kind: 'TIMEOUT',
            actionId,
            nextState: handleTimeout(state, state.currentPlayerId),
        };
    }

    let decision: ReturnType<typeof computeBotDecision> = null;
    try {
        decision = computeBotDecision(state, state.currentPlayerId);
    } catch (_error) {
        try {
            decision = computeEmergencyBotDecision(state, state.currentPlayerId);
        } catch (_fallbackError) {
            decision = null;
        }
    }

    if (!decision) {
        return {
            kind: 'PLAY',
            actionId,
            nextState: handleTimeout(state, state.currentPlayerId),
        };
    }

    return {
        kind: 'PLAY',
        actionId,
        nextState: handleTurn(
            state,
            state.currentPlayerId,
            decision.tile,
            decision.side === 'start' ? undefined : decision.side
        ),
    };
};
