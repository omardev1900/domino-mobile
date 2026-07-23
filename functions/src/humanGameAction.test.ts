import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    computeHumanGameAction,
    getHumanActionId,
    HumanGameActionError,
    humanGameActionInputSchema,
    HumanGameActionInput,
} from './humanGameAction';
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
});

const state = (): GameState => ({
    gameId: 'human-action-room',
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

const playInput = (overrides: Partial<HumanGameActionInput> = {}): HumanGameActionInput => ({
    roomId: 'human-action-room',
    expectedStateVersion: 12,
    expectedTurnId: 8,
    action: { type: 'PLAY_TILE', dominoId: 'p1-6-5', side: 'right' },
    ...overrides,
});

const assertActionError = (callback: () => unknown, code: HumanGameActionError['code']) => {
    assert.throws(callback, error => error instanceof HumanGameActionError && error.code === code);
};

describe('humanGameAction', () => {
    it('rejette les champs inconnus et les identifiants invalides avec Zod', () => {
        assert.equal(humanGameActionInputSchema.safeParse({ ...playInput(), injected: true }).success, false);
        assert.equal(humanGameActionInputSchema.safeParse({ ...playInput(), roomId: '../room' }).success, false);
    });

    it('applique un domino possede sur le cote demande', () => {
        const result = computeHumanGameAction(state(), 'p1', playInput());

        assert.equal(result.nextState.currentPlayerId, 'p2');
        assert.equal(result.nextState.players[0].handSize, 1);
        assert.equal(result.nextState.turnId, 9);
        assert.equal(result.nextState.stateVersion, 13);
    });

    it('refuse un domino absent de la main', () => {
        assertActionError(
            () => computeHumanGameAction(state(), 'p1', playInput({
                action: { type: 'PLAY_TILE', dominoId: 'p2-4-4', side: 'right' },
            })),
            'invalid-argument'
        );
    });

    it('refuse le mauvais joueur et un joueur non humain', () => {
        assertActionError(() => computeHumanGameAction(state(), 'p2', playInput()), 'permission-denied');
        const disconnected = state();
        disconnected.players[0].status = 'DISCONNECTED';
        assertActionError(
            () => computeHumanGameAction(disconnected, 'p1', playInput()),
            'permission-denied'
        );
    });

    it('refuse un placement illegal', () => {
        assertActionError(
            () => computeHumanGameAction(state(), 'p1', playInput({
                action: { type: 'PLAY_TILE', dominoId: 'p1-1-2', side: 'left' },
            })),
            'invalid-argument'
        );
    });

    it('autorise le passage seulement sans coup valide', () => {
        const blocked = state();
        blocked.players[0].hand = [domino('p1-1-2', 1, 2)];
        blocked.players[0].handSize = 1;
        const passInput = playInput({ action: { type: 'PASS_TURN' } });

        const result = computeHumanGameAction(blocked, 'p1', passInput);
        assert.equal(result.nextState.currentPlayerId, 'p2');
        assertActionError(
            () => computeHumanGameAction(state(), 'p1', passInput),
            'invalid-argument'
        );
    });

    it('autorise un abandon hors de son tour et hors de la phase PLAYING', () => {
        const terminalState = state();
        terminalState.phase = 'PARTIE_END';
        terminalState.currentPlayerId = 'p1';
        const input = playInput({
            expectedStateVersion: 1,
            expectedTurnId: 0,
            action: { type: 'SURRENDER' },
        });

        const result = computeHumanGameAction(terminalState, 'p2', input);

        assert.equal(result.nextState.players[1].status, 'SURRENDERED');
        assert.equal(result.nextState.stateVersion, 13);
    });

    it('produit un identifiant idempotent stable et specifique au cote', () => {
        const right = getHumanActionId('p1', playInput());
        const left = getHumanActionId('p1', playInput({
            action: { type: 'PLAY_TILE', dominoId: 'p1-6-5', side: 'left' },
        }));
        assert.equal(right, getHumanActionId('p1', playInput()));
        assert.notEqual(right, left);
    });
});
