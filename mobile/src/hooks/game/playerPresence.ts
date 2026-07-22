import { doc, runTransaction } from 'firebase/firestore';

import { GameRoom, Player } from '../../core/types';
import { db } from '../../core/services/firebase';

const pendingDisconnectWrites = new Map<string, Promise<string[]>>();

export const withDisconnectedPlayers = (
    players: Player[],
    playerIds: readonly string[]
): { players: Player[]; changedPlayerIds: string[] } => {
    const targetIds = new Set(playerIds);
    const changedPlayerIds: string[] = [];
    const updatedPlayers = players.map(player => {
        if (!targetIds.has(player.id) || player.status !== 'HUMAN') return player;

        changedPlayerIds.push(player.id);
        return { ...player, status: 'DISCONNECTED' as const };
    });

    return { players: updatedPlayers, changedPlayerIds };
};

export const markPlayersDisconnected = async (
    roomId: string,
    playerIds: readonly string[],
    heartbeatCutoff?: number
): Promise<string[]> => {
    const uniquePlayerIds = [...new Set(playerIds)].sort();
    if (!roomId || uniquePlayerIds.length === 0) return [];

    const writeKey = `${roomId}:${uniquePlayerIds.join(',')}:${heartbeatCutoff ?? 'rtdb'}`;
    const pendingWrite = pendingDisconnectWrites.get(writeKey);
    if (pendingWrite) return pendingWrite;

    const roomRef = doc(db, 'rooms', roomId);
    const write = runTransaction(db, async transaction => {
        const roomSnapshot = await transaction.get(roomRef);
        if (!roomSnapshot.exists()) return [];

        const room = roomSnapshot.data() as GameRoom;
        const currentPlayers = room.gameState?.players;
        if (!currentPlayers) return [];

        const eligiblePlayerIds = heartbeatCutoff === undefined
            ? uniquePlayerIds
            : uniquePlayerIds.filter(playerId =>
                (room.heartbeats?.[playerId] ?? 0) < heartbeatCutoff
            );
        const result = withDisconnectedPlayers(currentPlayers, eligiblePlayerIds);
        if (result.changedPlayerIds.length === 0) return [];

        transaction.update(roomRef, { 'gameState.players': result.players });
        return result.changedPlayerIds;
    });

    pendingDisconnectWrites.set(writeKey, write);
    try {
        return await write;
    } finally {
        if (pendingDisconnectWrites.get(writeKey) === write) {
            pendingDisconnectWrites.delete(writeKey);
        }
    }
};
