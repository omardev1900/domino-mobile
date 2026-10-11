import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { GameRoom } from './core/types';

/** A client renews its lease every ten seconds; expiry deliberately tolerates two missed pings. */
export const PRESENCE_LEASE_MS = 25_000;

export interface PresenceLeaseFingerprint {
    playerId: string;
    heartbeatAtMs: number;
}

const wait = (delayMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, delayMs));

export const timestampToMillis = (value: unknown): number | undefined => {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        const millis = (value as { toMillis: () => unknown }).toMillis();
        return typeof millis === 'number' && Number.isFinite(millis) ? millis : undefined;
    }
    return undefined;
};

export const getChangedHeartbeatPlayerIds = (
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined
): string[] => {
    const playerIds = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    return [...playerIds].filter(playerId =>
        timestampToMillis(before?.[playerId]) !== timestampToMillis(after?.[playerId])
    );
};

export const isFreshPresenceLease = (
    room: GameRoom,
    playerId: string,
    nowMs: number
): boolean => {
    const heartbeatAtMs = timestampToMillis(room.heartbeats?.[playerId]);
    return heartbeatAtMs !== undefined && heartbeatAtMs + PRESENCE_LEASE_MS > nowMs;
};

const updatePlayerStatus = (
    room: GameRoom,
    playerId: string,
    status: 'HUMAN' | 'DISCONNECTED'
) => {
    if (!room.gameState) return undefined;
    let changed = false;
    const players = room.gameState.players.map(player => {
        if (player.id !== playerId || player.status === status) return player;
        if (status === 'DISCONNECTED' && player.status !== 'HUMAN') return player;
        if (status === 'HUMAN' && player.status !== 'DISCONNECTED') return player;
        changed = true;
        return { ...player, status };
    });
    return changed ? players : undefined;
};

/** Restores a player only after a fresh, server-timestamped heartbeat has been observed. */
export const restorePresenceFromLease = async (
    db: admin.firestore.Firestore,
    roomId: string,
    expected: PresenceLeaseFingerprint
): Promise<boolean> => {
    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) return false;

        const room = snapshot.data() as GameRoom;
        const heartbeatAtMs = timestampToMillis(room.heartbeats?.[expected.playerId]);
        if (
            room.coordinatorVersion !== 1
            || !room.gameState
            || heartbeatAtMs === undefined
            || heartbeatAtMs < expected.heartbeatAtMs
        ) return false;

        const players = updatePlayerStatus(room, expected.playerId, 'HUMAN');
        if (!players) return false;
        transaction.update(roomRef, {
            'gameState.players': players,
            'coordinator.lastPresenceAction': 'RESTORED',
            'coordinator.lastPresenceActionAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    });
};

/** Applies expiry only if no newer lease has been written since this trigger was received. */
export const expirePresenceLease = async (
    db: admin.firestore.Firestore,
    roomId: string,
    expected: PresenceLeaseFingerprint,
    nowMs = Date.now()
): Promise<boolean> => {
    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) return false;

        const room = snapshot.data() as GameRoom;
        const heartbeatAtMs = timestampToMillis(room.heartbeats?.[expected.playerId]);
        if (
            room.coordinatorVersion !== 1
            || !room.gameState
            || heartbeatAtMs === undefined
            || heartbeatAtMs !== expected.heartbeatAtMs
            || heartbeatAtMs + PRESENCE_LEASE_MS > nowMs
        ) return false;

        const players = updatePlayerStatus(room, expected.playerId, 'DISCONNECTED');
        if (!players) return false;
        transaction.update(roomRef, {
            'gameState.players': players,
            'coordinator.lastPresenceAction': 'EXPIRED',
            'coordinator.lastPresenceActionAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    });
};

export const createPresenceCoordinator = (db: admin.firestore.Firestore) =>
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
            const beforeRoom = change.before.data() as GameRoom;
            const afterRoom = change.after.data() as GameRoom;
            if (afterRoom.coordinatorVersion !== 1 || !afterRoom.gameState) return;

            const changedPlayerIds = getChangedHeartbeatPlayerIds(
                beforeRoom.heartbeats,
                afterRoom.heartbeats
            );
            await Promise.all(changedPlayerIds.map(async playerId => {
                const heartbeatAtMs = timestampToMillis(afterRoom.heartbeats?.[playerId]);
                if (heartbeatAtMs === undefined) return;

                const expected = { playerId, heartbeatAtMs };
                await restorePresenceFromLease(db, event.params.roomId, expected);
                await wait(Math.max(0, heartbeatAtMs + PRESENCE_LEASE_MS - Date.now()));
                await expirePresenceLease(db, event.params.roomId, expected);
            }));
        }
    );
