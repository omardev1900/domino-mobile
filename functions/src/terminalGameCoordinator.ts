import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {
    computeCoordinatorDecision,
    getTransitionFingerprint,
    hasTransitionFingerprint,
    serializeTransitionFingerprint,
} from './gameCoordinator';
import { GameRoom } from './gameCore/types';
import { finalizeCoordinatedMatch } from './matchFinalizer';

const TRANSITION_DELAY_MS = 3000;

const wait = (delayMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, delayMs));

const removeUndefinedValues = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(removeUndefinedValues);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, child]) => child !== undefined)
                .map(([key, child]) => [key, removeUndefinedValues(child)])
        );
    }
    return value;
};

export const applyTerminalTransition = async (
    db: admin.firestore.Firestore,
    roomId: string,
    expected: ReturnType<typeof getTransitionFingerprint>
): Promise<boolean> => {
    if (!expected) return false;

    if (expected.phase === 'MATCH_END') {
        return finalizeCoordinatedMatch(db, roomId, expected);
    }

    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const currentSnapshot = await transaction.get(roomRef);
        if (!currentSnapshot.exists) return false;

        const currentRoom = currentSnapshot.data() as GameRoom;
        const currentState = currentRoom.gameState;
        if (
            currentRoom.coordinatorVersion !== 1
            || !currentState
            || !hasTransitionFingerprint(currentState, expected)
        ) return false;

        const decision = computeCoordinatorDecision(currentState);
        if (!decision) return false;

        const coordinator = {
            lastTransitionId: decision.transitionId,
            lastTransitionAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
        };

        if (decision.kind === 'FINALIZE_MATCH') return false;

        transaction.update(roomRef, {
            gameState: removeUndefinedValues(decision.nextState),
            coordinator,
            lastActivity: Date.now(),
        });
        return true;
    });
};

export const createTerminalGameCoordinator = (
    db: admin.firestore.Firestore
) =>
    functions
        .region('europe-west1')
        .runWith({ failurePolicy: true, timeoutSeconds: 60 })
        .firestore.document('rooms/{roomId}')
        .onUpdate(async (change, context) => {
            const beforeRoom = change.before.data() as GameRoom;
            const afterRoom = change.after.data() as GameRoom;
            if (afterRoom.coordinatorVersion !== 1) return;

            const expected = afterRoom.gameState
                ? getTransitionFingerprint(afterRoom.gameState)
                : null;

            if (!expected) return;

            const beforeFingerprint = beforeRoom.gameState
                ? getTransitionFingerprint(beforeRoom.gameState)
                : null;
            if (
                beforeFingerprint
                && serializeTransitionFingerprint(beforeFingerprint)
                    === serializeTransitionFingerprint(expected)
            ) {
                return;
            }

            await wait(TRANSITION_DELAY_MS);

            await applyTerminalTransition(db, context.params.roomId, expected);
        });
