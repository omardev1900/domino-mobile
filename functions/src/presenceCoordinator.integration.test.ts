import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import {
    expirePresenceLease,
    PRESENCE_LEASE_MS,
    restorePresenceFromLease,
} from './presenceCoordinator';
import { GameState, Player } from './gameCore/types';

const player = (id: string, status: Player['status']): Player => ({
    id,
    name: id,
    hand: [],
    handSize: 0,
    currentMancheStars: 0,
    wins: 0,
    mancheWins: 0,
    totalRoundWins: 0,
    totalPoints: 0,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status,
});

const state = (): GameState => ({
    gameId: 'presence-room',
    players: [player('p1', 'HUMAN')],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'p1',
    phase: 'PLAYING',
    firstPlayerOfRound: 'p1',
    history: [],
    winningCondition: 10,
    gameMode: 'SCORE',
    turnDuration: 15,
    lastActionTimestamp: 0,
    turnId: 1,
    mancheHistory: [],
    roundNumber: 1,
    mancheNumber: 1,
    startingHandSize: 7,
    stateVersion: 1,
});

describe('presenceCoordinator avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'presence-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('expire atomiquement puis restaure seulement avec un lease plus recent', async () => {
        const roomRef = db.collection('rooms').doc('presence-room');
        const expiredAt = 1_000_000;
        await roomRef.set({
            coordinatorVersion: 1,
            gameState: state(),
            heartbeats: { p1: admin.firestore.Timestamp.fromMillis(expiredAt) },
        });

        assert.equal(
            await expirePresenceLease(db, roomRef.id, { playerId: 'p1', heartbeatAtMs: expiredAt }, expiredAt + PRESENCE_LEASE_MS),
            true
        );
        assert.equal((await roomRef.get()).data()?.gameState.players[0].status, 'DISCONNECTED');

        const reconnectedAt = expiredAt + PRESENCE_LEASE_MS + 10;
        await roomRef.update({ 'heartbeats.p1': admin.firestore.Timestamp.fromMillis(reconnectedAt) });
        assert.equal(
            await restorePresenceFromLease(db, roomRef.id, { playerId: 'p1', heartbeatAtMs: reconnectedAt }),
            true
        );
        assert.equal((await roomRef.get()).data()?.gameState.players[0].status, 'HUMAN');
    });
});
