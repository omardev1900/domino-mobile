import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z, ZodError } from 'zod';

import { getMatchParticipantIds } from './matchFinalizer';
import { GameRoom } from './gameCore/types';

const roomRequestSchema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
}).strict();

export interface RematchResult {
    reset: boolean;
    votes: string[];
}

export const requestCoordinatedRematch = async (
    db: admin.firestore.Firestore,
    uid: string,
    rawInput: unknown
): Promise<RematchResult> => {
    const { roomId } = roomRequestSchema.parse(rawInput);
    const roomRef = db.collection('rooms').doc(roomId);

    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Salle introuvable.');
        }
        const room = snapshot.data() as GameRoom;
        if (room.coordinatorVersion !== 1 || room.finalization?.status !== 'COMPLETED' || !room.gameState) {
            throw new functions.https.HttpsError('failed-precondition', 'Match non finalise.');
        }

        const participants = getMatchParticipantIds(room);
        if (!participants.includes(uid)) {
            throw new functions.https.HttpsError('permission-denied', 'Joueur absent du match.');
        }

        const votes = [...new Set([...(room.rematchVotes ?? []), uid])]
            .filter(voter => participants.includes(voter));
        const activeHumans = room.gameState.players
            .filter(player => player.status === 'HUMAN' && participants.includes(player.id))
            .map(player => player.id);
        const requiredVoters = [...new Set([...activeHumans, uid])];
        const shouldReset = requiredVoters.every(voter => votes.includes(voter));
        if (!shouldReset) {
            transaction.update(roomRef, { rematchVotes: votes, lastActivity: Date.now() });
            return { reset: false, votes };
        }

        const profiles = room.participantProfiles ?? room.players;
        const botProfiles = profiles.filter(profile => profile.status === 'BOT');
        const humanProfiles = profiles.filter(profile => votes.includes(profile.uid));
        const selectedProfiles = [...humanProfiles, ...botProfiles].slice(0, 3).map((profile, index) => ({
            ...profile,
            isHost: index === 0,
            status: profile.status === 'BOT' ? 'BOT' as const : 'HUMAN' as const,
        }));
        const nextHost = selectedProfiles.find(profile => profile.status !== 'BOT')?.uid ?? uid;
        const userRefs = votes.map(voter => db.collection('users').doc(voter));
        await Promise.all(userRefs.map(ref => transaction.get(ref)));

        userRefs.forEach(ref => transaction.set(ref, { activeRoomId: roomId }, { merge: true }));
        transaction.update(roomRef, {
            status: 'WAITING',
            gameState: null,
            players: selectedProfiles,
            playerIds: votes,
            participantIds: votes,
            participantProfiles: selectedProfiles,
            createdBy: nextHost,
            hostId: nextHost,
            rematchVotes: [],
            finalization: null,
            lastActivity: Date.now(),
        });
        return { reset: true, votes };
    });
};

export const closeRoomAndClearUsers = async (
    db: admin.firestore.Firestore,
    roomId: string,
    deleteFinishedRoom = false
): Promise<boolean> => {
    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists) return false;
        const room = snapshot.data() as GameRoom;
        const participantIds = getMatchParticipantIds(room);
        const userRefs = participantIds.map(uid => db.collection('users').doc(uid));
        const userSnapshots = await Promise.all(userRefs.map(ref => transaction.get(ref)));

        userSnapshots.forEach((userSnapshot, index) => {
            if (userSnapshot.exists && userSnapshot.data()?.activeRoomId === roomId) {
                transaction.set(userRefs[index], { activeRoomId: null }, { merge: true });
            }
        });
        if (deleteFinishedRoom && room.status === 'FINISHED') {
            transaction.delete(roomRef);
        } else {
            transaction.update(roomRef, {
                status: 'FINISHED',
                playerIds: [],
                closure: { reason: 'INACTIVE', closedAt: admin.firestore.FieldValue.serverTimestamp() },
                lastActivity: Date.now(),
            });
        }
        return true;
    });
};

export const createRequestRematch = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 60 })
        .https.onCall(async (data: unknown, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        }
        try {
            return await requestCoordinatedRematch(db, context.auth.uid, data);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new functions.https.HttpsError('invalid-argument', 'Requete invalide.');
            }
            throw error;
        }
    });
