import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { closeRoomAndClearUsers, requestCoordinatedRematch } from './roomLifecycle';
import { finalRoom } from './matchFinalizer.testUtils';

describe('roomLifecycle avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'room-lifecycle-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('relance apres les votes sans dependre du createur original', async () => {
        const room = finalRoom();
        room.roomId = 'rematch-room';
        room.gameState!.gameId = room.roomId;
        room.status = 'FINISHED' as typeof room.status;
        room.finalization = {
            id: 'match:rematch-room:30:1:3',
            status: 'COMPLETED',
            rewards: {},
        };
        room.gameState!.players[0].status = 'HUMAN';
        room.gameState!.players[1].status = 'HUMAN';
        const roomRef = db.collection('rooms').doc(room.roomId);
        await roomRef.set(room);
        await Promise.all(['p1', 'p2'].map(uid => db.collection('users').doc(uid).set({ activeRoomId: null })));

        const firstVote = await requestCoordinatedRematch(db, 'p1', { roomId: room.roomId });
        assert.equal(firstVote.reset, false);
        const secondVote = await requestCoordinatedRematch(db, 'p2', { roomId: room.roomId });
        assert.equal(secondVote.reset, true);

        const resetRoom = (await roomRef.get()).data();
        assert.equal(resetRoom?.status, 'WAITING');
        assert.equal(resetRoom?.gameState, null);
        assert.equal(resetRoom?.createdBy, 'p1');
        assert.deepEqual(resetRoom?.playerIds.sort(), ['p1', 'p2']);
        assert.equal((await db.collection('users').doc('p2').get()).data()?.activeRoomId, room.roomId);
    });

    it('permet au joueur restant de relancer si l ancien hote est deconnecte', async () => {
        const room = finalRoom();
        room.roomId = 'hostless-rematch-room';
        room.gameState!.gameId = room.roomId;
        room.status = 'FINISHED' as typeof room.status;
        room.createdBy = 'p1';
        room.finalization = {
            id: 'match:hostless-rematch-room:30:1:3',
            status: 'COMPLETED',
            rewards: {},
        };
        room.gameState!.players[0].status = 'DISCONNECTED';
        room.gameState!.players[1].status = 'HUMAN';
        const roomRef = db.collection('rooms').doc(room.roomId);
        await roomRef.set(room);
        await db.collection('users').doc('p2').set({ activeRoomId: null });

        const result = await requestCoordinatedRematch(db, 'p2', { roomId: room.roomId });
        const resetRoom = (await roomRef.get()).data();
        assert.equal(result.reset, true);
        assert.equal(resetRoom?.createdBy, 'p2');
        assert.equal(resetRoom?.players[0].uid, 'p2');
        assert.equal(resetRoom?.players[0].isHost, true);
    });

    it('ferme une salle inactive et libere seulement ses participants', async () => {
        const room = finalRoom();
        room.roomId = 'stale-room';
        room.gameState!.gameId = room.roomId;
        const roomRef = db.collection('rooms').doc(room.roomId);
        await roomRef.set(room);
        await db.collection('users').doc('p1').set({ activeRoomId: room.roomId });
        await db.collection('users').doc('p2').set({ activeRoomId: 'newer-room' });

        assert.equal(await closeRoomAndClearUsers(db, room.roomId), true);
        assert.equal((await roomRef.get()).data()?.status, 'FINISHED');
        assert.equal((await db.collection('users').doc('p1').get()).data()?.activeRoomId, null);
        assert.equal((await db.collection('users').doc('p2').get()).data()?.activeRoomId, 'newer-room');
    });

    it('libere les joueurs d un lobby abandonne avant le premier match', async () => {
        const room = finalRoom();
        room.roomId = 'stale-waiting-room';
        room.status = 'WAITING' as typeof room.status;
        room.gameState = null;
        delete room.participantIds;
        const roomRef = db.collection('rooms').doc(room.roomId);
        await roomRef.set(room);
        await db.collection('users').doc('p1').set({ activeRoomId: room.roomId });

        assert.equal(await closeRoomAndClearUsers(db, room.roomId), true);
        assert.equal((await db.collection('users').doc('p1').get()).data()?.activeRoomId, null);
    });
});
