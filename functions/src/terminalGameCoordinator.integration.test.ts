import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { getTransitionFingerprint } from './gameCoordinator';
import { GameState, Player } from './gameCore/types';
import { applyTerminalTransition } from './terminalGameCoordinator';

const player = (id: string): Player => ({
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
    status: 'HUMAN',
});

const terminalState = (): GameState => ({
    gameId: 'coordinator-room',
    players: [player('p1'), player('p2'), player('p3')],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'p1',
    phase: 'PARTIE_END',
    firstPlayerOfRound: 'p1',
    history: [],
    winningCondition: 100,
    gameMode: 'SCORE',
    mancheResult: null,
    turnDuration: 15,
    lastActionTimestamp: 1000,
    turnId: 4,
    mancheHistory: [],
    roundNumber: 1,
    mancheNumber: 1,
    startingHandSize: 7,
    stateVersion: 9,
});

describe('terminalGameCoordinator avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'coordinator-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('applique une seule transition pour deux appels concurrents', async () => {
        const initialState = terminalState();
        const roomRef = db.collection('rooms').doc('coordinator-room');
        await roomRef.set({
            coordinatorVersion: 1,
            status: 'PLAYING',
            gameState: initialState,
            lastActivity: 1000,
        });

        const expected = getTransitionFingerprint(initialState);
        assert.ok(expected);

        const results = await Promise.all([
            applyTerminalTransition(db, roomRef.id, expected),
            applyTerminalTransition(db, roomRef.id, expected),
        ]);

        assert.equal(results.filter(Boolean).length, 1);
        const finalRoom = (await roomRef.get()).data();
        assert.equal(finalRoom?.gameState.phase, 'PLAYING');
        assert.equal(finalRoom?.gameState.roundNumber, 2);
        assert.equal(finalRoom?.gameState.stateVersion, 10);
        assert.equal(finalRoom?.coordinator.lastTransitionId, 'coordinator-room:PARTIE_END:9:1:1:4');
    });

});
