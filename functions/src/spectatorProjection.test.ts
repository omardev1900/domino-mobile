import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GameRoom, RoomStatus } from './gameCore/types';
import { makePublicRoomDirectory, makeSpectatorView } from './spectatorProjection';

const room = (): GameRoom => ({
    roomId: 'PUBLIC1',
    createdAt: 1,
    lastActivity: 1,
    status: RoomStatus.PLAYING,
    createdBy: 'p1',
    isPrivate: false,
    players: [],
    playerIds: ['p1', 'p2', 'p3'],
    gameState: {
        gameId: 'PUBLIC1',
        phase: 'PLAYING',
        gameMode: 'SCORE',
        winningCondition: 15,
        turnDuration: 15,
        table: { sequence: [], leftValue: null, rightValue: null },
        talonMort: [],
        players: ['p1', 'p2', 'p3'].map((id, index) => ({
            id,
            name: `Joueur ${index + 1}`,
            hand: [{ id: `${id}-secret`, left: 1, right: 2, isDouble: false }],
            handSize: 1,
            currentMancheStars: 0,
            wins: 0,
            mancheWins: 0,
            totalRoundWins: 0,
            totalPoints: 0,
            isCochon: false,
            totalCochons: 0,
            totalCochonsInfliges: 0,
            totalCochonsSubis: 0,
            status: 'HUMAN' as const,
        })),
        currentPlayerId: 'p2',
        firstPlayerOfRound: 'p1',
        history: [],
        lastActionTimestamp: 1,
        turnId: 1,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7,
    },
});

describe('spectator projection', () => {
    it('publie le plateau et les compteurs sans aucune main ou identifiant prive', () => {
        const view = makeSpectatorView(room(), 100);
        assert.ok(view);
        assert.equal(view.players[0].handSize, 1);
        assert.equal('hand' in view.players[0], false);
        assert.equal(JSON.stringify(view).includes('p1-secret'), false);
        assert.equal(JSON.stringify(view).includes('"p1"'), false);
        assert.equal(view.currentPlayerSeat, 1);
    });

    it('retire les projections des salles privees ou fermees', () => {
        assert.equal(makePublicRoomDirectory({ ...room(), isPrivate: true }), null);
        assert.equal(makeSpectatorView({ ...room(), status: RoomStatus.FINISHED }), null);
    });
});
