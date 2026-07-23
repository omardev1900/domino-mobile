import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import {
    computeCoordinatorDecision,
    getTransitionFingerprint,
    hasTransitionFingerprint,
} from './gameCoordinator';
import { GameRoom } from './gameCore/types';
import { finalizeCoordinatedMatch } from './matchFinalizer';

export const TERMINAL_TRANSITION_DELAY_MS = 3000;

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
    onDocumentUpdated(
        {
            document: 'rooms/{roomId}',
            region: 'europe-west1',
            retry: true,
            timeoutSeconds: 60,
        },
        async event => {
            const change = event.data;
            if (!change) return;
            const afterRoom = change.after.data() as GameRoom;
            if (afterRoom.coordinatorVersion !== 1) return;

            const expected = afterRoom.gameState
                ? getTransitionFingerprint(afterRoom.gameState)
                : null;

            if (!expected) return;

            await wait(TERMINAL_TRANSITION_DELAY_MS);

            await applyTerminalTransition(db, event.params.roomId, expected);
        }
    );
