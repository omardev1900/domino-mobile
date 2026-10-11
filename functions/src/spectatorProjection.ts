import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { GameRoom, GameState, Player, PlayerProfile } from './gameCore/types';

export interface PublicRoomPlayer {
    seat: number;
    displayName: string;
    avatarId?: string;
    activeFrame?: string;
    leagueGrade?: string;
    status?: string;
}

export interface PublicRoomDirectory {
    roomId: string;
    status: 'WAITING' | 'PLAYING';
    roomName?: string;
    players: PublicRoomPlayer[];
    playerCount: number;
    gameMode?: string;
    winningCondition?: number;
    turnDuration?: number;
    isSpectatable: boolean;
    updatedAt: number;
}

export interface SpectatorPlayer extends PublicRoomPlayer {
    handSize: number;
    currentMancheStars: number;
    wins: number;
    mancheWins: number;
    totalRoundWins: number;
    totalPoints: number;
    isCochon: boolean;
    totalCochons: number;
    totalCochonsInfliges: number;
    totalCochonsSubis: number;
}

export interface SpectatorView {
    roomId: string;
    phase: GameState['phase'];
    gameMode: GameState['gameMode'];
    winningCondition: number;
    turnDuration: number;
    table: GameState['table'];
    players: SpectatorPlayer[];
    currentPlayerSeat: number | null;
    firstPlayerSeat: number | null;
    boudePlayerSeat: number | null;
    history: Array<{
        playerSeat: number;
        action: 'PLAY' | 'PASS';
        domino?: GameState['history'][number]['domino'];
        timestamp: number;
    }>;
    mancheHistory: Array<{
        mancheNumber: number;
        points: Record<string, number>;
        winnerSeat: number | 'TIE';
        resultType: string;
        cochonCount?: number;
    }>;
    roundNumber: number;
    mancheNumber: number;
    updatedAt: number;
}

const publicProfile = (profile: PlayerProfile, seat: number): PublicRoomPlayer => ({
    seat,
    displayName: profile.displayName,
    avatarId: profile.avatarId,
    activeFrame: profile.activeFrame,
    leagueGrade: profile.leagueGrade,
    status: profile.status,
});

const publicPlayer = (player: Player, seat: number): SpectatorPlayer => ({
    seat,
    displayName: player.name,
    avatarId: player.avatarId,
    activeFrame: player.activeFrame,
    leagueGrade: player.leagueGrade,
    status: player.status,
    handSize: player.handSize,
    currentMancheStars: player.currentMancheStars,
    wins: player.wins,
    mancheWins: player.mancheWins,
    totalRoundWins: player.totalRoundWins,
    totalPoints: player.totalPoints,
    isCochon: player.isCochon,
    totalCochons: player.totalCochons,
    totalCochonsInfliges: player.totalCochonsInfliges,
    totalCochonsSubis: player.totalCochonsSubis,
});

const seatFor = (playerIds: string[], playerId: string | null | undefined): number | null => {
    if (!playerId) return null;
    const seat = playerIds.indexOf(playerId);
    return seat < 0 ? null : seat;
};

export const makePublicRoomDirectory = (room: GameRoom, now = Date.now()): PublicRoomDirectory | null => {
    if (room.isPrivate === true || (room.status !== 'WAITING' && room.status !== 'PLAYING')) return null;
    const players = (room.gameState?.players ?? room.players ?? []).map((player, seat) =>
        'id' in player ? publicPlayer(player, seat) : publicProfile(player, seat)
    );
    return {
        roomId: room.roomId,
        status: room.status,
        roomName: room.roomName,
        players,
        playerCount: players.length,
        gameMode: room.gameMode ?? room.gameState?.gameMode,
        winningCondition: room.winningCondition ?? room.gameState?.winningCondition,
        turnDuration: room.turnDuration ?? room.gameState?.turnDuration,
        isSpectatable: room.status === 'PLAYING' && room.gameState !== null,
        updatedAt: now,
    };
};

export const makeSpectatorView = (room: GameRoom, now = Date.now()): SpectatorView | null => {
    const state = room.gameState;
    if (room.isPrivate === true || room.status !== 'PLAYING' || !state) return null;
    const playerIds = state.players.map(player => player.id);
    return {
        roomId: room.roomId,
        phase: state.phase,
        gameMode: state.gameMode,
        winningCondition: state.winningCondition,
        turnDuration: state.turnDuration,
        table: state.table,
        players: state.players.map(publicPlayer),
        currentPlayerSeat: seatFor(playerIds, state.currentPlayerId),
        firstPlayerSeat: seatFor(playerIds, state.firstPlayerOfRound),
        boudePlayerSeat: seatFor(playerIds, state.boudePlayerId),
        history: state.history.map(entry => ({
            playerSeat: seatFor(playerIds, entry.playerId) ?? -1,
            action: entry.action,
            domino: entry.domino,
            timestamp: entry.timestamp,
        })),
        mancheHistory: state.mancheHistory.map(entry => ({
            mancheNumber: entry.mancheNumber,
            points: Object.fromEntries(Object.entries(entry.points).map(([id, points]) => [
                String(seatFor(playerIds, id)), points,
            ])),
            winnerSeat: entry.winnerId === 'TIE' ? 'TIE' : (seatFor(playerIds, entry.winnerId) ?? -1),
            resultType: entry.resultType,
            cochonCount: entry.cochonCount,
        })),
        roundNumber: state.roundNumber,
        mancheNumber: state.mancheNumber,
        updatedAt: now,
    };
};

export const syncPublicRoomProjection = async (
    db: admin.firestore.Firestore,
    roomId: string,
    room: GameRoom | undefined,
    now = Date.now()
): Promise<void> => {
    const directoryRef = db.collection('publicRooms').doc(roomId);
    const spectatorRef = db.collection('roomSpectatorViews').doc(roomId);
    // Creation historique en deux ecritures : le premier snapshot peut ne pas
    // encore contenir `roomId`. L'identifiant du document reste la source de
    // verite pour la projection publique.
    const roomWithId = room ? { ...room, roomId } : undefined;
    const directory = roomWithId ? makePublicRoomDirectory(roomWithId, now) : null;
    const spectator = roomWithId ? makeSpectatorView(roomWithId, now) : null;
    const batch = db.batch();
    if (directory) batch.set(directoryRef, directory);
    else batch.delete(directoryRef);
    if (spectator) batch.set(spectatorRef, spectator);
    else batch.delete(spectatorRef);
    await batch.commit();
};

export const createPublicRoomProjection = (db: admin.firestore.Firestore) =>
    onDocumentWritten(
        { document: 'rooms/{roomId}', region: 'europe-west1' },
        async event => syncPublicRoomProjection(
            db,
            event.params.roomId,
            event.data?.after.exists ? event.data.after.data() as GameRoom : undefined
        )
    );
