import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { openMultiplayerReplay } from './replayMultiplayer';

describe('replay multijoueur avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;
    const now = 1_700_000_000_000;
    before(async () => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'replay-multi-integration');
        db = app.firestore();
        const session = db.collection('replay_sessions').doc('room-session');
        await Promise.all([
            session.set({ status: 'COMPLETED', participants: ['member'] }),
            session.collection('frames').doc('000000000001').set({ version: 1, state: { stateVersion: 1, phase: 'PLAYING' } }),
            session.collection('frames').doc('000000000002').set({ version: 2, state: { stateVersion: 2, phase: 'MATCH_END' } }),
            db.collection('users').doc('member').set({ economy: { coins: 2000 } }),
            db.collection('premium_entitlements').doc('member').set({ expiresAt: admin.firestore.Timestamp.fromMillis(now + 1000) }),
        ]);
    });
    after(async () => app.delete());
    it('fournit les étapes ordonnées après débit et refuse un tiers', async () => {
        const input = { sessionId: 'room-session', requestId: 'attempt' };
        await assert.rejects(openMultiplayerReplay(db, 'outsider', input, now), /inaccessible/);
        const result = await openMultiplayerReplay(db, 'member', input, now);
        assert.deepEqual(result.frames.map(frame => frame.stateVersion), [1, 2]);
        assert.equal(result.remainingCoins, 1000);
        assert.equal((await openMultiplayerReplay(db, 'member', input, now)).remainingCoins, 1000);
        assert.equal((await db.collection('users').doc('member').get()).data()?.economy.coins, 1000);
    });
    it('ne débite pas pour un replay incomplet', async () => {
        await db.collection('replay_sessions').doc('incomplete').collection('frames').doc('1').set({ version: 1, state: { stateVersion: 1, phase: 'PLAYING' } });
        await assert.rejects(openMultiplayerReplay(db, 'member', { sessionId: 'incomplete', requestId: 'second' }, now), /indisponible/);
        assert.equal((await db.collection('users').doc('member').get()).data()?.economy.coins, 1000);
    });
});
