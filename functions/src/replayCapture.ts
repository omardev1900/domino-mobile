import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { GameRoom, GameState } from './gameCore/types';

type ReplayRoom = GameRoom & { replaySessionId?: string };

const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
    return value;
};

export function getReplaySessionId(roomId: string, room: ReplayRoom): string | null {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(roomId) || !room.replaySessionId || !/^[A-Za-z0-9_-]{1,80}$/.test(room.replaySessionId)) return null;
    return `${roomId}_${room.replaySessionId}`;
}

/** Records both sides of a committed game transition in the same transaction. */
export function recordReplayTransition(db: admin.firestore.Firestore, transaction: admin.firestore.Transaction, roomId: string, room: ReplayRoom, before: GameState, after: GameState): void {
    const id = getReplaySessionId(roomId, room);
    if (!id) return;
    const beforeVersion = before.stateVersion;
    const afterVersion = after.stateVersion;
    if (!Number.isSafeInteger(beforeVersion) || !Number.isSafeInteger(afterVersion) || afterVersion! <= beforeVersion!) return;
    const session = db.collection('replay_sessions').doc(id);
    const frame = (version: number) => session.collection('frames').doc(String(version).padStart(12, '0'));
    transaction.set(session, { roomId, participants: room.participantIds ?? room.playerIds ?? [], status: 'IN_PROGRESS' }, { merge: true });
    transaction.set(frame(beforeVersion!), { version: beforeVersion, state: clean(before) });
    transaction.set(frame(afterVersion!), { version: afterVersion, state: clean(after) });
}

export function finishReplayCapture(db: admin.firestore.Firestore, transaction: admin.firestore.Transaction, roomId: string, room: ReplayRoom): void {
    const id = getReplaySessionId(roomId, room);
    if (!id) return;
    transaction.set(db.collection('replay_sessions').doc(id), { status: 'COMPLETED', completedAt: FieldValue.serverTimestamp() }, { merge: true });
}
