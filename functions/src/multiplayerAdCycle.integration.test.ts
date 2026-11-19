import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import { startCoordinatedRoom } from './coordinatedRoomStart';
import { prepareRoomBuyIn } from './coordinatedRoomBuyIn';
import { settleRoomBuyIn } from './multiplayerBuyIn';
import { advanceAdCycle } from './multiplayerAdCycle';
import { getTransitionFingerprint } from './gameCoordinator';
import { applyTerminalTransition } from './terminalGameCoordinator';
import { GameRoom } from './gameCore/types';

describe('Multiplayer ad coordination on Firestore', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'multiplayer-ads');
        db = app.firestore();
    });
    after(async () => app.delete());

    async function lobby(roomId: string, options: { premiumSeat?: number; oldSeat?: number; poorSeat?: number } = {}) {
        const ids = [0, 1, 2].map(seat => `${roomId}-${seat}`);
        const ref = db.collection('rooms').doc(roomId);
        const batch = db.batch();
        ids.forEach((uid, seat) => {
            batch.set(db.collection('users').doc(uid), {
                activeRoomId: roomId,
                economy: { coins: options.poorSeat === seat ? 0 : 1000 },
            });
            if (options.premiumSeat === seat) {
                batch.set(db.collection('premium_entitlements').doc(uid), {
                    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60_000),
                });
            }
        });
        batch.set(ref, {
            roomId,
            createdBy: ids[0],
            status: 'WAITING',
            buyIn: 100,
            gameState: null,
            players: ids.map((uid, seat) => ({
                uid, displayName: uid, gamesPlayed: 0, gamesWon: 0,
                ...(options.oldSeat === seat ? {} : { multiplayerAdVersion: 1 }),
            })),
            playerIds: ids,
            heartbeats: Object.fromEntries(ids.map(id => [id, admin.firestore.FieldValue.serverTimestamp()])),
        });
        await batch.commit();
        return {
            ids,
            ref,
            read: async () => (await ref.get()).data() as GameRoom,
            coins: async () => (await db.getAll(...ids.map(id => db.collection('users').doc(id))))
                .map(snap => snap.get('economy.coins')),
            start: () => startCoordinatedRoom(db, ids[0], { roomId, previousSession: null }, true),
        };
    }

    it('debits once, waits for three confirmations and ignores old cycles', async () => {
        const room = await lobby('ads-three-free');
        await Promise.all([room.start(), room.start()]);
        assert.deepEqual(await room.coins(), [900, 900, 900]);
        const initial = await room.read();
        const cycle = initial.adCycle!;
        assert.equal(cycle.kind, 'START');
        assert.equal(initial.gameState?.phase, 'DEALING');
        await Promise.all([
            advanceAdCycle(db, room.ref.id, cycle.id, room.ids[0]),
            advanceAdCycle(db, room.ref.id, cycle.id, room.ids[0]),
            advanceAdCycle(db, room.ref.id, cycle.id, room.ids[1]),
        ]);
        assert.equal((await room.read()).gameState?.phase, 'DEALING');
        await advanceAdCycle(db, room.ref.id, cycle.id, room.ids[2]);
        assert.equal((await room.read()).gameState?.phase, 'PLAYING');

        await room.ref.update({ 'gameState.phase': 'MANCHE_END', 'gameState.mancheNumber': 3 });
        const ended = (await room.read()).gameState!;
        const fingerprint = getTransitionFingerprint(ended);
        assert.equal(await applyTerminalTransition(db, room.ref.id, fingerprint, 'previous-session'), false);
        await Promise.all([
            applyTerminalTransition(db, room.ref.id, fingerprint),
            applyTerminalTransition(db, room.ref.id, fingerprint),
        ]);
        const intermission = (await room.read()).adCycle!;
        assert.equal(intermission.kind, 'INTERMISSION');
        await advanceAdCycle(db, room.ref.id, cycle.id, room.ids[0]);
        assert.deepEqual((await room.read()).adCycle?.confirmedPlayerIds, []);
        assert.equal((await room.read()).gameState?.phase, 'MANCHE_END');
        for (const uid of room.ids) await advanceAdCycle(db, room.ref.id, intermission.id, uid);
        assert.equal((await room.read()).gameState?.mancheNumber, 4);

        await room.ref.update({ 'gameState.phase': 'MATCH_END', 'gameState.mancheNumber': 6 });
        await applyTerminalTransition(db, room.ref.id, getTransitionFingerprint((await room.read()).gameState!));
        const final = await room.read();
        assert.equal(final.finalization?.status, 'COMPLETED');
        assert.equal(final.adCycle?.kind, 'FINAL');
        await advanceAdCycle(db, room.ref.id, final.adCycle!.id, undefined, () => final.adCycle!.deadline);
        assert.equal((await room.read()).adCycle, null);
        assert.equal((await room.read()).finalization?.id, final.finalization?.id);
    });

    it('preserves the Premium reserve and refunds only paid stakes in a mixed room', async () => {
        const room = await lobby('premium-low-coins', { premiumSeat: 1, poorSeat: 1 });
        await Promise.all([room.start(), room.start()]);
        assert.deepEqual(await room.coins(), [900, 100, 900]);
        const started = await room.read();
        assert.equal(started.adPolicy, 'NONE');

        const refund = () => db.runTransaction(async tx => {
            const result = await prepareRoomBuyIn(db, tx, room.ref.id, started.replaySessionId!, room.ids, 100, 'refund', Date.now());
            assert.equal(result.blocked, false);
            result.apply();
        });
        await Promise.all([refund(), refund()]);
        assert.deepEqual(await room.coins(), [1000, 100, 1000]);
    });

    it('freezes the no-ad policy for a Premium host or guest and keeps mixed versions compatible', async () => {
        for (const seat of [0, 1, 2]) {
            const room = await lobby(`ads-premium-${seat}`, { premiumSeat: seat });
            await room.start();
            const started = await room.read();
            assert.equal(started.adPolicy, 'NONE');
            assert.equal(started.adCycle, null);
            assert.equal(started.gameState?.phase, 'PLAYING');
        }
        const mixed = await lobby('ads-old-client', { oldSeat: 2 });
        await mixed.start();
        assert.equal((await mixed.read()).adPolicy, null);
        await settleRoomBuyIn(db, mixed.ids[2], mixed.ref.id, 'debit');
        assert.deepEqual(await mixed.coins(), [900, 900, 900]);
    });

    it('publishes a failed launch, retries after funding and refunds an expired barrier once', async () => {
        const room = await lobby('ads-launch-retry', { poorSeat: 2 });
        assert.equal((await room.start()).started, false);
        assert.ok((await room.read()).launchError);
        assert.deepEqual(await room.coins(), [1000, 1000, 0]);
        await db.collection('users').doc(room.ids[2]).update({ 'economy.coins': 1000 });
        await room.start();
        const cycle = (await room.read()).adCycle!;
        await advanceAdCycle(db, room.ref.id, cycle.id, undefined, () => cycle.deadline);
        const reconnect = (await room.read()).adCycle!;
        assert.equal(reconnect.reconnecting, true);
        assert.equal((await room.read()).gameState?.phase, 'DEALING');
        const expire = () => advanceAdCycle(db, room.ref.id, cycle.id, undefined, () => reconnect.deadline);
        await Promise.all([expire(), expire()]);
        assert.deepEqual(await room.coins(), [1000, 1000, 1000]);
        assert.equal((await room.read()).adCancelled, true);
    });

    it('resumes the same cycle when the missing player reconnects', async () => {
        const room = await lobby('ads-connection-recovery');
        await room.start();
        const cycle = (await room.read()).adCycle!;
        for (const uid of room.ids.slice(0, 2)) await advanceAdCycle(db, room.ref.id, cycle.id, uid);
        await advanceAdCycle(db, room.ref.id, cycle.id, undefined, () => cycle.deadline);
        const recoveryTime = cycle.deadline + 5000;
        await room.ref.update({
            heartbeats: Object.fromEntries(room.ids.map(uid => [uid, admin.firestore.Timestamp.fromMillis(recoveryTime)])),
        });
        await advanceAdCycle(db, room.ref.id, cycle.id, room.ids[2], () => recoveryTime);
        assert.equal((await room.read()).gameState?.phase, 'PLAYING');
        assert.equal((await room.read()).adCycle, null);
        assert.deepEqual(await room.coins(), [900, 900, 900]);
    });

    it('charges a new attempt after a legacy refund', async () => {
        const room = await lobby('ads-legacy-refund');
        await settleRoomBuyIn(db, room.ids[0], room.ref.id, 'debit');
        await settleRoomBuyIn(db, room.ids[0], room.ref.id, 'refund');
        assert.equal((await room.start()).started, true);
        assert.deepEqual(await room.coins(), [900, 900, 900]);
    });
});
