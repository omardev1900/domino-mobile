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
import {
    enforceCallableRateLimit,
    SUBMIT_GAME_ACTION_LIMIT,
} from './callableRateLimit';

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
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) {
            throw new HumanGameActionError('failed-precondition', 'Salle introuvable.');
        }

        const room = snapshot.data() as GameRoom;
        const isSurrender = input.action.type === 'SURRENDER';
        const userSnapshot = isSurrender ? await transaction.get(userRef) : null;
        if (room.coordinatorVersion !== 1 || !room.gameState) {
            throw new HumanGameActionError('failed-precondition', 'Salle non coordonnee.');
        }
        const gamePlayer = room.gameState.players.find(player => player.id === uid);
        if (
            !gamePlayer
            || (!isSurrender && !room.playerIds?.includes(uid))
            || (
                isSurrender
                && !room.participantIds?.includes(uid)
                && !room.playerIds?.includes(uid)
            )
        ) {
            throw new HumanGameActionError('permission-denied', 'Joueur absent de la salle.');
        }

        const state = room.gameState;
        const resultBase = {
            stateVersion: state.stateVersion ?? 0,
            turnId: state.turnId ?? 0,
            phase: state.phase,
        };
        if (isSurrender && gamePlayer.status === 'SURRENDERED') {
            if (userSnapshot?.exists && userSnapshot.data()?.activeRoomId === input.roomId) {
                transaction.set(userRef, { activeRoomId: null }, { merge: true });
            }
            return { applied: false, reason: 'ALREADY_APPLIED', ...resultBase };
        }
        if (room.coordinator?.lastHumanActionId === actionId) {
            return { applied: false, reason: 'ALREADY_APPLIED', ...resultBase };
        }
        if (!isSurrender && (
            resultBase.stateVersion !== input.expectedStateVersion
            || resultBase.turnId !== input.expectedTurnId
            || state.phase !== 'PLAYING'
        )) {
            return { applied: false, reason: 'STALE', ...resultBase };
        }

        const applied = computeHumanGameAction(state, uid, input);
        const nextState = applied.nextState;
        const roomUpdate: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
            gameState: removeUndefinedValues(nextState),
            coordinator: {
                ...(room.coordinator ?? { version: 1 }),
                version: 1,
                lastHumanActionId: applied.actionId,
                lastHumanActionAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            lastActivity: Date.now(),
        };
        if (isSurrender) {
            const remainingProfiles = room.players
                .filter(profile => profile.uid !== uid)
                .map((profile, index) => ({ ...profile, isHost: index === 0 }));
            roomUpdate.players = remainingProfiles;
            roomUpdate.playerIds = (room.playerIds ?? []).filter(playerId => playerId !== uid);
            if (remainingProfiles[0]) {
                roomUpdate.hostId = remainingProfiles[0].uid;
                roomUpdate.createdBy = remainingProfiles[0].uid;
            }
            if (userSnapshot?.exists && userSnapshot.data()?.activeRoomId === input.roomId) {
                transaction.set(userRef, { activeRoomId: null }, { merge: true });
            }
        }
        transaction.update(roomRef, roomUpdate);

        return {
            applied: true,
            stateVersion: nextState.stateVersion ?? 0,
            turnId: nextState.turnId ?? 0,
            phase: nextState.phase,
        };
    });
};

export const createSubmitGameAction = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 60 })
        .https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        }

        try {
            await enforceCallableRateLimit(
                db,
                context.auth.uid,
                'submitGameAction',
                SUBMIT_GAME_ACTION_LIMIT
            );
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
