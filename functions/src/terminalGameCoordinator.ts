import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import {
    computeCoordinatorDecision,
    getTransitionFingerprint,
    hasTransitionFingerprint,
} from './gameCoordinator';
import { GameRoom } from './gameCore/types';
import { recordReplayTransition } from './replayCapture';
import { makeAdCycle, needsIntermission, advanceAdCycle } from './multiplayerAdCycle';
import { finalizeCoordinatedMatch } from './matchFinalizer';

// L'animation client révèle le vainqueur après son entrée. Six secondes lui
// laissent une durée de lecture réelle avant la distribution suivante.
export const TERMINAL_TRANSITION_DELAY_MS = 6000;

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
    expected: ReturnType<typeof getTransitionFingerprint>,
    expectedSession?: string,
): Promise<boolean> => {
    if (!expected) return false;

    if (expected.phase === 'MATCH_END') {
        return finalizeCoordinatedMatch(db, roomId, expected, expectedSession);
    }

    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const currentSnapshot = await transaction.get(roomRef);
        if (!currentSnapshot.exists) return false;

        const currentRoom = currentSnapshot.data() as GameRoom;
        const currentState = currentRoom.gameState;
        if (
            currentRoom.coordinatorVersion !== 1
            || (expectedSession !== undefined && currentRoom.replaySessionId !== expectedSession)
            || !currentState
            || !hasTransitionFingerprint(currentState, expected)
        ) return false;

        if (needsIntermission(currentRoom) && currentRoom.replaySessionId) {
            if (currentRoom.adCycle) return false;
            const now = Date.now();
            transaction.update(roomRef, {
                adCycle: makeAdCycle(currentRoom.replaySessionId, 'INTERMISSION', currentState, now),
                lastActivity: now,
            });
            return true;
        }

        const decision = computeCoordinatorDecision(currentState);
        if (!decision) return false;

        const coordinator = {
            lastTransitionId: decision.transitionId,
            lastTransitionAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
        };

        if (decision.kind === 'FINALIZE_MATCH') return false;

        recordReplayTransition(db, transaction, roomId, currentRoom, currentState, decision.nextState);
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
            if (afterRoom.adCycle) {
                const beforeRoom = change.before.data() as GameRoom;
                const cycle = afterRoom.adCycle;
                if (cycle.kind !== 'FINAL' && cycle.id === beforeRoom.adCycle?.id
                    && (afterRoom.participantIds?.every(id => cycle.confirmedPlayerIds.includes(id))
                        || afterRoom.gameState?.players.some(player => player.status === 'SURRENDERED'))) {
                    await advanceAdCycle(db, event.params.roomId, cycle.id);
                }
                return;
            }
            if (afterRoom.finalization?.status === 'COMPLETED') return;

            const expected = afterRoom.gameState
                ? getTransitionFingerprint(afterRoom.gameState)
                : null;

            if (!expected) return;

            await wait(TERMINAL_TRANSITION_DELAY_MS);

            await applyTerminalTransition(db, event.params.roomId, expected, afterRoom.replaySessionId);
        }
    );
