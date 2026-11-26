import { LogService } from './core/services/LogService';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { GameRoom, GameState, Player } from './gameCore/types';
import { dealGame, determineFirstPlayer } from './gameCore/LogicEngine';
import { HAND_SIZE } from './gameCore/constants';
import { isFreshPresenceLease } from './presenceCoordinator';
import { isActivePremiumEntitlement } from './premiumAccess';
import { prepareRoomBuyIn } from './coordinatedRoomBuyIn';
import { makeAdCycle } from './multiplayerAdCycle';
import { getLobbyHostId } from './gameCore/lobbyPresence';

const schema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    previousSession: z.string().max(80).nullable(),
}).strict();

function initialState(roomId: string, room: GameRoom, premiumIds: string[], paused: boolean, now: number): GameState {
    const size = [1, 3, 5, 7].includes(room.startingHandSize ?? 0) ? room.startingHandSize! : HAND_SIZE;
    const hostIndex = room.handSizeForHostOnly ? room.players.findIndex(p => p.uid === room.createdBy) : undefined;
    const deal = dealGame(room.players.map(player => player.displayName), size, hostIndex);
    const players: Player[] = deal.players!.map((player, index) => {
        const profile = room.players[index];
        const status = profile.status === 'BOT' ? 'BOT' : 'HUMAN';
        return {
            ...player,
            id: profile.uid,
            avatarId: profile.avatarId || 'avatar_default',
            ...(profile.leagueGrade ? { leagueGrade: profile.leagueGrade } : {}),
            ...(profile.activeFrame ? { activeFrame: profile.activeFrame } : {}),
            ...(status === 'BOT' ? { difficulty: profile.difficulty ?? room.difficulty ?? 'MAPIPI' } : {}),
            premiumActive: premiumIds.includes(profile.uid),
            status,
        };
    });
    return {
        ...deal,
        gameId: roomId,
        players,
        gameMode: room.gameMode ?? 'MANCHE',
        winningCondition: room.winningCondition ?? 3,
        turnDuration: room.turnDuration || 15,
        currentPlayerId: determineFirstPlayer(players),
        phase: paused ? 'DEALING' : 'PLAYING',
        lastActionTimestamp: now,
        roundNumber: 1,
        mancheNumber: 1,
        mancheHistory: [],
        history: [],
        firstPlayerOfRound: null,
        mancheResult: null,
        ...(hostIndex !== undefined ? { startingHandPlayerId: room.createdBy } : {}),
    } as GameState;
}

export async function startCoordinatedRoom(
    db: admin.firestore.Firestore,
    uid: string,
    input: z.infer<typeof schema>,
    synchronizeAds: boolean,
): Promise<{ started: boolean; error?: string }> {
    const { roomId, previousSession } = input;
    const ref = db.collection('rooms').doc(roomId);
    const sessionId = db.collection('replay_sessions').doc().id;
    return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const room = snapshot.data() as GameRoom | undefined;
        if (!room) throw new functions.https.HttpsError('not-found', 'Salle introuvable.');
        const hostId = room.status === 'WAITING' ? getLobbyHostId(room) : room.createdBy;
        if (hostId !== uid) throw new functions.https.HttpsError('permission-denied', 'Seul l’hôte peut démarrer.');
        if (room.status === 'PLAYING') return { started: true };
        if (room.status !== 'WAITING' || (room.replaySessionId ?? null) !== previousSession) return { started: false };
        const fail = (error: string) => {
            tx.update(ref, { launchError: error });
            return { started: false, error };
        };
        const now = Date.now();
        const participantProfiles = room.players.filter(player => player.status !== 'BOT');
        const participantIds = participantProfiles.map(player => player.uid);
        if (room.players.length !== 3 || new Set(room.players.map(player => player.uid)).size !== 3
            || !participantIds.includes(uid) || participantIds.some(id => !isFreshPresenceLease(room, id, now))) {
            return fail('Un joueur n’est plus connecté. Réessaie quand toute la table est de retour.');
        }
        const amount = room.buyIn ?? 100;
        if (!Number.isSafeInteger(amount) || amount < 0) return fail('La mise de cette table est invalide.');

        const entitlements = await tx.getAll(...participantIds.map(id => db.collection('premium_entitlements').doc(id)));
        const premiumIds = participantIds.filter((_, index) => isActivePremiumEntitlement(entitlements[index].data(), now));
        const compatible = participantProfiles.every(player => player.multiplayerAdVersion === 1);
        const adPolicy = synchronizeAds && compatible ? (premiumIds.length ? 'NONE' : 'SYNCHRONIZED') : null;
        const paused = adPolicy === 'SYNCHRONIZED';
        const gameState = initialState(roomId, { ...room, createdBy: uid }, premiumIds, paused, now);
        const buyIn = await prepareRoomBuyIn(db, tx, roomId, sessionId, participantIds, amount, 'debit', now, !previousSession, premiumIds);
        if (buyIn.blocked) return fail('Au moins un joueur n’a pas assez de coins pour la mise.');
        buyIn.apply();
        tx.update(ref, {
            status: 'PLAYING',
            createdBy: uid,
            hostId: uid,
            gameState,
            launchError: null,
            coordinatorVersion: 1,
            participantIds,
            participantProfiles: room.players,
            finalization: null,
            replaySessionId: sessionId,
            managedBuyIn: amount,
            adPolicy,
            adCycle: paused ? makeAdCycle(sessionId, 'START', gameState, now) : null,
            adCancelled: false,
            lastActivity: now,
        });
        return { started: true };
    });
}

export const createStartCoordinatedRoom = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall((raw: unknown, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        const input = schema.safeParse(raw);
        if (!input.success) throw new functions.https.HttpsError('invalid-argument', 'Lancement invalide.');
        return startCoordinatedRoom(db, context.auth.uid, input.data, process.env.MULTIPLAYER_AD_SYNC_ENABLED === 'true')
            .then(result => {
                if (!result.started) LogService.warn('CoordinatedRoomStart', 'Multiplayer launch refused.', {
                    roomId: input.data.roomId,
                    reason: result.error,
                });
                return result;
            });
    });
