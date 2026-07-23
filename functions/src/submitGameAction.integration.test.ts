import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { submitGameActionTransaction } from './submitGameAction';
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

const gameState = (): GameState => ({
    gameId: 'human-action-integration',
    players: [
        player('p1', [domino('p1-6-5', 6, 5), domino('p1-1-2', 1, 2)]),
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
    turnId: 8,
    mancheHistory: [],
    roundNumber: 2,
    mancheNumber: 1,
    startingHandSize: 7,
    stateVersion: 12,
});

describe('submitGameAction avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'human-action-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('rend le rejeu inoffensif et rejette une autre commande devenue obsolete', async () => {
        const roomRef = db.collection('rooms').doc('human-action-integration');
        await roomRef.set({
            coordinatorVersion: 1,
            coordinator: { version: 1 },
            playerIds: ['p1', 'p2', 'p3'],
            status: 'PLAYING',
            gameState: gameState(),
            lastActivity: 1000,
        });
        const input = {
            roomId: roomRef.id,
            expectedStateVersion: 12,
            expectedTurnId: 8,
            action: { type: 'PLAY_TILE' as const, dominoId: 'p1-6-5', side: 'right' as const },
        };

        const results = await Promise.all([
            submitGameActionTransaction(db, 'p1', input),
            submitGameActionTransaction(db, 'p1', input),
        ]);

        assert.equal(results.filter(result => result.applied).length, 1);
        assert.equal(results.some(result => result.reason === 'ALREADY_APPLIED'), true);
        const stale = await submitGameActionTransaction(db, 'p1', {
            ...input,
            action: { ...input.action, side: 'left' as const },
        });
        assert.equal(stale.applied, false);
        assert.equal(stale.reason, 'STALE');

        const room = (await roomRef.get()).data();
        assert.equal(room?.gameState.currentPlayerId, 'p2');
        assert.equal(room?.gameState.stateVersion, 13);
        assert.equal(room?.coordinator.lastHumanActionId.includes(':p1:PLAY_TILE:'), true);
    });
});
