import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { applyCoordinatedTurn } from './activeTurnCoordinator';
import { getTurnFingerprint } from './turnCoordinator';
import { Domino, GameState, Player } from './gameCore/types';

const domino = (id: string, left: Domino['left'], right: Domino['right']): Domino => ({
    id,
    left,
    right,
    isDouble: left === right,
});

const player = (id: string, hand: Domino[]): Player => ({
    id,
    name: id,
    hand,
    handSize: hand.length,
    currentMancheStars: 0,
    wins: 0,
    mancheWins: 0,
    totalRoundWins: 0,
    totalPoints: 0,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status: 'HUMAN',
});

const blockedState = (): GameState => ({
    gameId: 'active-turn-room',
    players: [
        player('p1', [domino('p1-1-2', 1, 2)]),
        player('p2', [domino('p2-4-4', 4, 4)]),
        player('p3', [domino('p3-3-3', 3, 3)]),
    ],
    talonMort: [],
    table: {
        sequence: [{ domino: domino('table-6-6', 6, 6), sideAtTable: 'left', isReversed: false }],
        leftValue: 6,
        rightValue: 6,
    },
    currentPlayerId: 'p1',
    phase: 'PLAYING',
    firstPlayerOfRound: 'p2',
    history: [],
    winningCondition: 100,
    gameMode: 'SCORE',
    turnDuration: 15,
    lastActionTimestamp: 1000,
    turnId: 4,
    mancheHistory: [],
    roundNumber: 2,
    mancheNumber: 1,
    startingHandSize: 7,
    stateVersion: 9,
});

describe('activeTurnCoordinator avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'active-turn-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('applique une seule decision pour deux appels concurrents', async () => {
        const initialState = blockedState();
        const roomRef = db.collection('rooms').doc('active-turn-room');
        await roomRef.set({
            coordinatorVersion: 1,
            status: 'PLAYING',
            gameState: initialState,
            lastActivity: 1000,
        });

        const expected = getTurnFingerprint(initialState);
        assert.ok(expected);
        const results = await Promise.all([
            applyCoordinatedTurn(db, roomRef.id, expected),
            applyCoordinatedTurn(db, roomRef.id, expected),
        ]);

        assert.equal(results.filter(Boolean).length, 1);
        const finalRoom = (await roomRef.get()).data();
        assert.equal(finalRoom?.gameState.boudePlayerId, 'p1');
        assert.equal(finalRoom?.gameState.stateVersion, 10);
        assert.equal(finalRoom?.coordinator.lastTurnActionKind, 'MARK_BOUDE');
    });
});
