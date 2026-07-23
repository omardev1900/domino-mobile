import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { ZodError } from 'zod';

import { GameRoom } from './gameCore/types';
import {
    computeHumanGameAction,
    getHumanActionId,
    HumanGameActionError,
    humanGameActionInputSchema,
} from './humanGameAction';

export type SubmitGameActionResult = {
    applied: boolean;
    reason?: 'ALREADY_APPLIED' | 'STALE';
    stateVersion: number;
    turnId: number;
    phase: string;
};

const removeUndefinedValues = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(removeUndefinedValues);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, child]) => child !== undefined)
                .map(([key, child]) => [key, removeUndefinedValues(child)])
        );
    }
    return value;
};

export const submitGameActionTransaction = async (
    db: admin.firestore.Firestore,
    uid: string,
    rawInput: unknown
): Promise<SubmitGameActionResult> => {
    const input = humanGameActionInputSchema.parse(rawInput);
    const actionId = getHumanActionId(uid, input);
    const roomRef = db.collection('rooms').doc(input.roomId);

    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) {
            throw new HumanGameActionError('failed-precondition', 'Salle introuvable.');
        }

        const room = snapshot.data() as GameRoom;
        if (room.coordinatorVersion !== 1 || !room.gameState) {
            throw new HumanGameActionError('failed-precondition', 'Salle non coordonnee.');
        }
        if (!room.playerIds?.includes(uid) || !room.gameState.players.some(player => player.id === uid)) {
            throw new HumanGameActionError('permission-denied', 'Joueur absent de la salle.');
        }

        const state = room.gameState;
        const resultBase = {
            stateVersion: state.stateVersion ?? 0,
            turnId: state.turnId ?? 0,
            phase: state.phase,
        };
        if (room.coordinator?.lastHumanActionId === actionId) {
            return { applied: false, reason: 'ALREADY_APPLIED', ...resultBase };
        }
        if (
            resultBase.stateVersion !== input.expectedStateVersion
            || resultBase.turnId !== input.expectedTurnId
            || state.phase !== 'PLAYING'
        ) {
            return { applied: false, reason: 'STALE', ...resultBase };
        }

        const applied = computeHumanGameAction(state, uid, input);
        const nextState = applied.nextState;
        transaction.update(roomRef, {
            gameState: removeUndefinedValues(nextState),
            coordinator: {
                ...(room.coordinator ?? { version: 1 }),
                version: 1,
                lastHumanActionId: applied.actionId,
                lastHumanActionAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            applied: true,
            stateVersion: nextState.stateVersion ?? 0,
            turnId: nextState.turnId ?? 0,
            phase: nextState.phase,
        };
    });
};

export const createSubmitGameAction = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        }

        try {
            return await submitGameActionTransaction(db, context.auth.uid, data);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new functions.https.HttpsError('invalid-argument', 'Commande invalide.');
            }
            if (error instanceof HumanGameActionError) {
                throw new functions.https.HttpsError(error.code, error.message);
            }
            throw error;
        }
    });
