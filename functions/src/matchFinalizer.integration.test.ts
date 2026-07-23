import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { getTransitionFingerprint } from './gameCoordinator';
import { finalizeCoordinatedMatch } from './matchFinalizer';
import { finalRoom } from './matchFinalizer.testUtils';

describe('matchFinalizer avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'match-finalizer-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('finalise tous les humains exactement une fois sous concurrence', async () => {
        const room = finalRoom();
        const roomRef = db.collection('rooms').doc(room.roomId);
        await roomRef.set(room);
        await Promise.all(['p1', 'p2'].map(uid => db.collection('users').doc(uid).set({
            activeRoomId: room.roomId,
            economy: { coins: 100, xp: 0, level: 1, diamonds: 0, leaguePoints: 0 },
            stats: { gamesPlayed: 0, gamesWon: 0, matchHistory: [] },
        })));

        const expected = getTransitionFingerprint(room.gameState!);
        assert.ok(expected);
        const results = await Promise.all([
            finalizeCoordinatedMatch(db, room.roomId, expected),
            finalizeCoordinatedMatch(db, room.roomId, expected),
        ]);

        assert.equal(results.filter(Boolean).length, 1);
        const finalRoomData = (await roomRef.get()).data();
        assert.equal(finalRoomData?.status, 'FINISHED');
        assert.equal(finalRoomData?.finalization.status, 'COMPLETED');
        assert.ok(finalRoomData?.finalization.rewards.p1);
        assert.ok(finalRoomData?.finalization.rewards.p2);

        const p1 = (await db.collection('users').doc('p1').get()).data();
        const p2 = (await db.collection('users').doc('p2').get()).data();
        assert.equal(p1?.activeRoomId, null);
        assert.equal(p2?.activeRoomId, null);
        assert.equal(p1?.stats.gamesPlayed, 1);
        assert.equal(p2?.stats.gamesPlayed, 1);
        assert.equal(p1?.stats.gamesWon, 1);
        assert.equal(p2?.stats.gamesWon, 0);
        assert.equal(p1?.stats.matchHistory.length, 1);

        const monthly = await db.collection('users_monthly_stats')
            .where('userId', 'in', ['p1', 'p2'])
            .get();
        assert.equal(monthly.size, 2);
    });
});
