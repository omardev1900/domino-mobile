import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { GameRoom } from './core/types';
import {
    getChangedHeartbeatPlayerIds,
    isFreshPresenceLease,
    PRESENCE_LEASE_MS,
    timestampToMillis,
} from './presenceCoordinator';

const timestamp = (millis: number) => admin.firestore.Timestamp.fromMillis(millis);

describe('presenceCoordinator', () => {
    it('identifie seulement les leases qui ont reellement change', () => {
        const changed = getChangedHeartbeatPlayerIds(
            { p1: timestamp(100), p2: timestamp(200) },
            { p1: timestamp(100), p2: timestamp(300), p3: timestamp(400) }
        );

        assert.deepEqual(changed.sort(), ['p2', 'p3']);
    });

    it('n accepte qu un lease strictement dans sa fenetre serveur', () => {
        const nowMs = 1_000_000;
        const room = {
            heartbeats: { p1: timestamp(nowMs - PRESENCE_LEASE_MS + 1) },
        } as unknown as GameRoom;

        assert.equal(isFreshPresenceLease(room, 'p1', nowMs), true);
        room.heartbeats = { p1: timestamp(nowMs - PRESENCE_LEASE_MS) };
        assert.equal(isFreshPresenceLease(room, 'p1', nowMs), false);
    });

    it('ignore les valeurs qui ne sont pas des timestamps Firestore', () => {
        assert.equal(timestampToMillis(Date.now()), undefined);
        assert.equal(timestampToMillis({ toMillis: () => Number.NaN }), undefined);
    });
});
