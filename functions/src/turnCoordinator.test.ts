import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    ABSENT_PLAYER_DELAY_MS,
    BOT_TURN_DELAY_MS,
    BOUDE_DISPLAY_MS,
    computeTurnDecision,
    DISCONNECTED_BOUDE_DISPLAY_MS,
    getCoordinatedTurnDelayMs,
    getTurnFingerprint,
    hasTurnFingerprint,
    TURN_TIMEOUT_GRACE_MS,
} from './turnCoordinator';
import { Domino, GameState, Player, PlayerStatus } from './gameCore/types';

const domino = (id: string, left: Domino['left'], right: Domino['right']): Domino => ({
    id,
    left,
    right,
    isDouble: left === right,
});

const player = (id: string, hand: Domino[], status: PlayerStatus = 'HUMAN'): Player => ({
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
    status,
    difficulty: 'MAPIPI',
});

const state = (
    status: PlayerStatus = 'HUMAN',
    activeHand: Domino[] = [domino('p1-6-5', 6, 5), domino('p1-1-2', 1, 2)]
): GameState => ({
    gameId: 'turn-game',
    players: [
        player('p1', activeHand, status),
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
    history: [{ playerId: 'p2', action: 'PLAY', domino: domino('table-6-6', 6, 6), timestamp: 1 }],
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

describe('turnCoordinator', () => {
    it('ignore les phases non jouables', () => {
        const terminal = state();
        terminal.phase = 'PARTIE_END';
        assert.equal(getTurnFingerprint(terminal), null);
        assert.equal(getCoordinatedTurnDelayMs(terminal), null);
        assert.equal(computeTurnDecision(terminal), null);
    });

    it('programme le timeout humain avec le delai de grace', () => {
        assert.equal(getCoordinatedTurnDelayMs(state()), 15_000 + TURN_TIMEOUT_GRACE_MS);
        const invalidDuration = state();
        invalidDuration.turnDuration = 600;
        assert.equal(getCoordinatedTurnDelayMs(invalidDuration), 60_000 + TURN_TIMEOUT_GRACE_MS);
    });

    it('applique des delais courts aux bots et joueurs absents', () => {
        assert.equal(getCoordinatedTurnDelayMs(state('BOT')), BOT_TURN_DELAY_MS);
        assert.equal(getCoordinatedTurnDelayMs(state('DISCONNECTED')), ABSENT_PLAYER_DELAY_MS);
        assert.equal(getCoordinatedTurnDelayMs(state('SURRENDERED')), ABSENT_PLAYER_DELAY_MS);
    });

    it('marque immediatement un joueur sans coup puis conserve le delai visuel', () => {
        const blocked = state('HUMAN', [domino('p1-1-2', 1, 2)]);
        assert.equal(getCoordinatedTurnDelayMs(blocked), 0);

        const mark = computeTurnDecision(blocked);
        assert.equal(mark?.kind, 'MARK_BOUDE');
        assert.equal(mark?.nextState.boudePlayerId, 'p1');
        assert.equal(mark?.nextState.stateVersion, 13);
        assert.equal(getCoordinatedTurnDelayMs(mark!.nextState), BOUDE_DISPLAY_MS);
    });

    it('laisse plus de temps au badge boude d un joueur deconnecte', () => {
        const blocked = state('DISCONNECTED', [domino('p1-1-2', 1, 2)]);
        blocked.boudePlayerId = 'p1';
        assert.equal(getCoordinatedTurnDelayMs(blocked), DISCONNECTED_BOUDE_DISPLAY_MS);
    });

    it('passe le tour marque boude une seule fois', () => {
        const blocked = state('HUMAN', [domino('p1-1-2', 1, 2)]);
        blocked.boudePlayerId = 'p1';
        const pass = computeTurnDecision(blocked);

        assert.equal(pass?.kind, 'PASS');
        assert.equal(pass?.nextState.currentPlayerId, 'p2');
        assert.equal(pass?.nextState.turnId, 9);
        assert.equal(pass?.nextState.boudePlayerId, null);
    });

    it('joue le tour d un bot avec le moteur metier', () => {
        const decision = computeTurnDecision(state('BOT'));

        assert.equal(decision?.kind, 'PLAY');
        assert.equal(decision?.nextState.currentPlayerId, 'p2');
        assert.equal(decision?.nextState.players[0].handSize, 1);
    });

    it('joue automatiquement le meilleur coup au timeout humain', () => {
        const decision = computeTurnDecision(state('HUMAN'));

        assert.equal(decision?.kind, 'TIMEOUT');
        assert.equal(decision?.nextState.currentPlayerId, 'p2');
        assert.equal(decision?.nextState.players[0].handSize, 1);
    });

    it('invalide une action absente quand le joueur redevient humain', () => {
        const disconnected = state('DISCONNECTED');
        const expected = getTurnFingerprint(disconnected);
        assert.ok(expected);

        const reconnected = structuredClone(disconnected);
        reconnected.players[0].status = 'HUMAN';
        assert.equal(hasTurnFingerprint(reconnected, expected), false);
    });
});
