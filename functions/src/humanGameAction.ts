import { z } from 'zod';

import { handleTurn, passTurn, surrenderPlayer } from './gameCore/LogicEngine';
import { GameState } from './gameCore/types';

const playTileActionSchema = z.object({
    type: z.literal('PLAY_TILE'),
    dominoId: z.string().min(1).max(80),
    side: z.enum(['start', 'left', 'right']).optional(),
}).strict();

const passTurnActionSchema = z.object({
    type: z.literal('PASS_TURN'),
}).strict();

const surrenderActionSchema = z.object({
    type: z.literal('SURRENDER'),
}).strict();

export const humanGameActionInputSchema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    expectedStateVersion: z.number().int().nonnegative(),
    expectedTurnId: z.number().int().nonnegative(),
    action: z.discriminatedUnion('type', [
        playTileActionSchema,
        passTurnActionSchema,
        surrenderActionSchema,
    ]),
}).strict();

export type HumanGameActionInput = z.infer<typeof humanGameActionInputSchema>;

export class HumanGameActionError extends Error {
    constructor(
        public readonly code: 'failed-precondition' | 'invalid-argument' | 'permission-denied',
        message: string
    ) {
        super(message);
        this.name = 'HumanGameActionError';
    }
}

export interface AppliedHumanGameAction {
    actionId: string;
    nextState: GameState;
}

export const getHumanActionId = (uid: string, input: HumanGameActionInput): string => {
    const detail = input.action.type === 'PLAY_TILE'
        ? `${input.action.dominoId}:${input.action.side ?? 'auto'}`
        : input.action.type === 'PASS_TURN' ? 'pass' : 'surrender';
    return [
        input.roomId,
        input.expectedStateVersion,
        input.expectedTurnId,
        uid,
        input.action.type,
        detail,
    ].join(':');
};

export const computeHumanGameAction = (
    state: GameState,
    uid: string,
    input: HumanGameActionInput
): AppliedHumanGameAction => {
    if (input.action.type === 'SURRENDER') {
        return {
            actionId: getHumanActionId(uid, input),
            nextState: surrenderPlayer(state, uid),
        };
    }
    if (state.phase !== 'PLAYING') {
        throw new HumanGameActionError('failed-precondition', 'La partie n est pas jouable.');
    }
    if (state.currentPlayerId !== uid) {
        throw new HumanGameActionError('permission-denied', 'Ce n est pas votre tour.');
    }

    const player = state.players.find(candidate => candidate.id === uid);
    if (!player || player.status !== 'HUMAN') {
        throw new HumanGameActionError('permission-denied', 'Joueur humain actif introuvable.');
    }

    try {
        const action = input.action;
        if (action.type === 'PASS_TURN') {
            return {
                actionId: getHumanActionId(uid, input),
                nextState: passTurn(state, uid),
            };
        }

        const domino = player.hand.find(tile => tile.id === action.dominoId);
        if (!domino) {
            throw new HumanGameActionError('invalid-argument', 'Domino absent de la main.');
        }
        return {
            actionId: getHumanActionId(uid, input),
            nextState: handleTurn(
                state,
                uid,
                domino,
                action.side === 'start' ? undefined : action.side
            ),
        };
    } catch (error) {
        if (error instanceof HumanGameActionError) throw error;
        const message = error instanceof Error ? error.message : 'Action invalide.';
        throw new HumanGameActionError('invalid-argument', message);
    }
};
