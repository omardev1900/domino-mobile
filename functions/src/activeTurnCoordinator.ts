import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { GameRoom } from './gameCore/types';
import {
    computeTurnDecision,
    getCoordinatedTurnDelayMs,
    getTurnFingerprint,
    hasTurnFingerprint,
    serializeTurnFingerprint,
    TurnFingerprint,
} from './turnCoordinator';

const wait = (delayMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, delayMs));

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

export const applyCoordinatedTurn = async (
    db: admin.firestore.Firestore,
    roomId: string,
    expected: TurnFingerprint
): Promise<boolean> => {
    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) return false;

        const room = snapshot.data() as GameRoom;
        if (
            room.coordinatorVersion !== 1
            || !room.gameState
            || !hasTurnFingerprint(room.gameState, expected)
        ) return false;

        const decision = computeTurnDecision(room.gameState);
        if (!decision) return false;

        transaction.update(roomRef, {
            gameState: removeUndefinedValues(decision.nextState),
            coordinator: {
                ...(room.coordinator ?? { version: 1 }),
                version: 1,
                lastTurnActionId: decision.actionId,
                lastTurnActionKind: decision.kind,
                lastTurnActionAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    });
};

export const createActiveTurnCoordinator = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ failurePolicy: true, timeoutSeconds: 120 })
        .firestore.document('rooms/{roomId}')
        .onUpdate(async (change, context) => {
            const beforeRoom = change.before.data() as GameRoom;
            const afterRoom = change.after.data() as GameRoom;
            if (afterRoom.coordinatorVersion !== 1 || !afterRoom.gameState) return;

            const expected = getTurnFingerprint(afterRoom.gameState);
            if (!expected) return;

            const beforeFingerprint = beforeRoom.gameState
                ? getTurnFingerprint(beforeRoom.gameState)
                : null;
            if (
                beforeFingerprint
                && serializeTurnFingerprint(beforeFingerprint) === serializeTurnFingerprint(expected)
            ) return;

            const delayMs = getCoordinatedTurnDelayMs(afterRoom.gameState);
            if (delayMs === null) return;
            await wait(delayMs);
            await applyCoordinatedTurn(db, context.params.roomId, expected);
        });
