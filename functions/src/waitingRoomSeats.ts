import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { getLobbyHostId } from './gameCore/lobbyPresence';
import { GameRoom, PlayerProfile } from './gameCore/types';
import { isFreshPresenceLease } from './presenceCoordinator';
import { isActivePremiumEntitlement } from './premiumAccess';

const schema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    playerId: z.string().min(1).max(128).optional(),
    action: z.literal('EJECT').optional(),
}).strict();

export async function releaseWaitingRoomSeat(
    db: admin.firestore.Firestore,
    uid: string,
    { roomId, playerId = uid, action }: z.infer<typeof schema>,
): Promise<void> {
    const roomRef = db.collection('rooms').doc(roomId);
    await db.runTransaction(async tx => {
        const snapshot = await tx.get(roomRef);
        const room = snapshot.data() as GameRoom | undefined;
        if (!room) return;
        if (room.status !== 'WAITING' || room.gameState) {
            throw new functions.https.HttpsError('failed-precondition', 'La partie a déjà démarré.');
        }
        const hostId = getLobbyHostId(room);
        const now = Date.now();
        const successor = room.players.find(seat =>
            seat.uid !== hostId && seat.status !== 'BOT' && isFreshPresenceLease(room, seat.uid, now),
        )?.uid;
        const takingOver = playerId === hostId && uid === successor;
        if (playerId !== uid && hostId !== uid && !takingOver) {
            throw new functions.https.HttpsError('permission-denied', 'Tu n’as pas accès à cette place.');
        }

        if (action === 'EJECT' && (room.lobbyCreatorId !== uid || hostId !== uid || playerId === uid)) {
            throw new functions.https.HttpsError('permission-denied', 'Seul le créateur de la table peut exclure un invité.');
        }

        const player = room.players.find(seat => seat.uid === playerId);
        if (!player) return;
        if (action === 'EJECT') {
            if (player.status === 'BOT') {
                throw new functions.https.HttpsError('invalid-argument', 'Cette action est réservée aux joueurs.');
            }
            const entitlement = await tx.get(db.collection('premium_entitlements').doc(uid));
            if (!isActivePremiumEntitlement(entitlement.data(), Date.now())) {
                throw new functions.https.HttpsError('permission-denied', 'Un accès Premium actif est nécessaire.');
            }
        } else if (playerId !== uid && player.status !== 'BOT' && isFreshPresenceLease(room, playerId, now)) {
            throw new functions.https.HttpsError('failed-precondition', 'Ce joueur est de nouveau connecté.');
        }

        const accountRef = db.collection('users').doc(playerId);
        if (player.status !== 'BOT') {
            const account = await tx.get(accountRef);
            if (account.get('activeRoomId') === roomId) tx.update(accountRef, { activeRoomId: null });
        }

        const players = room.players.filter(seat => seat.uid !== playerId);
        const nextHost = playerId === hostId && successor ? successor : getLobbyHostId({ ...room, players });
        if (!nextHost) {
            tx.delete(roomRef);
            return;
        }

        const heartbeats = { ...room.heartbeats };
        delete heartbeats[playerId];
        const playerIds = (room.playerIds ?? room.players.filter(seat => seat.status !== 'BOT').map(seat => seat.uid))
            .filter(id => id !== playerId);
        tx.update(roomRef, {
            players: players.map(seat => ({ ...seat, isHost: seat.uid === nextHost })),
            playerIds,
            createdBy: nextHost,
            hostId: nextHost,
            heartbeats,
            launchError: null,
            lastActivity: now,
        });
    });
}

export const createReleaseWaitingRoomSeat = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        const input = schema.safeParse(raw);
        if (!input.success) throw new functions.https.HttpsError('invalid-argument', 'Joueur ou table invalide.');
        await releaseWaitingRoomSeat(db, context.auth.uid, input.data);
        return { released: true };
    });

const botOptions = {
    TI_MANMAY: [['Ti-Sonson', 'avatar_bot_01'], ['Man-Yaya', 'avatar_bot_02']],
    MAPIPI: [['Dédé', 'avatar_bot_03'], ['Maxime', 'avatar_bot_04']],
    GRAN_MOUN: [['Tonton-Léon', 'avatar_bot_05'], ['Eudorge', 'avatar_bot_06']],
    METKAYALI: [['Man-Diab', 'avatar_bot_07'], ['Papa-Zombi', 'avatar_bot_08']],
} as const;

const botSchema = schema.pick({ roomId: true }).extend({
    difficulty: z.enum(['TI_MANMAY', 'MAPIPI', 'GRAN_MOUN', 'METKAYALI']),
});

export async function addWaitingRoomBot(
    db: admin.firestore.Firestore,
    uid: string,
    { roomId, difficulty }: z.infer<typeof botSchema>,
): Promise<void> {
    const roomRef = db.collection('rooms').doc(roomId);
    const botId = `bot_${db.collection('rooms').doc().id}`;
    await db.runTransaction(async tx => {
        const snapshot = await tx.get(roomRef);
        const room = snapshot.data() as GameRoom | undefined;
        if (!room) throw new functions.https.HttpsError('not-found', 'Salle introuvable.');
        if (room.status !== 'WAITING' || room.gameState || room.players.length >= 3) {
            throw new functions.https.HttpsError('failed-precondition', 'La table n’a plus de place libre.');
        }
        if (getLobbyHostId(room) !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Seul l’hôte peut ajouter un bot.');
        }
        const [firstOption, secondOption] = botOptions[difficulty];
        const firstUsed = room.players.some(player => player.status === 'BOT' && player.displayName === firstOption[0]);
        const [displayName, avatarId] = firstUsed ? secondOption : firstOption;
        const bot: PlayerProfile = {
            uid: botId,
            displayName,
            avatarId,
            status: 'BOT',
            difficulty,
            isHost: false,
            gamesPlayed: 0,
            gamesWon: 0,
            hasBeenDebited: true,
        };
        tx.update(roomRef, {
            players: [...room.players, bot],
            launchError: null,
            lastActivity: Date.now(),
        });
    });
}

export const createAddWaitingRoomBot = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        const input = botSchema.safeParse(raw);
        if (!input.success) throw new functions.https.HttpsError('invalid-argument', 'Table ou difficulté invalide.');
        await addWaitingRoomBot(db, context.auth.uid, input.data);
        return { added: true };
    });
