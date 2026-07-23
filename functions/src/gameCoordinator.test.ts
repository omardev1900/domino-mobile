import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    computeCoordinatorDecision,
    getTransitionFingerprint,
    hasTransitionFingerprint,
} from './gameCoordinator';
import { Domino, GamePhase, GameState, Player } from './gameCore/types';

const domino = (id: string, left: Domino['left'], right: Domino['right']): Domino => ({
    id,
    left,
    right,
    isDouble: left === right,
});

const player = (id: string, hand: Domino[], stars = 0): Player => ({
    id,
    name: id,
    hand,
    handSize: hand.length,
    currentMancheStars: stars,
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

const state = (phase: GamePhase): GameState => ({
    gameId: 'game-1',
    players: [
        player('p1', [domino('p1-0', 0, 0)]),
        player('p2', [domino('p2-6', 6, 6)]),
        player('p3', [domino('p3-5', 5, 5)]),
    ],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'p1',
    phase,
    firstPlayerOfRound: 'p1',
    history: [],
    winningCondition: 100,
    gameMode: 'SCORE',
    mancheResult: null,
    turnDuration: 15,
    lastActionTimestamp: 1000,
    turnId: 8,
    mancheHistory: [],
    roundNumber: 2,
    mancheNumber: 4,
    startingHandSize: 7,
    stateVersion: 12,
});

describe('gameCoordinator', () => {
    it('ignore les phases qui ne sont pas terminales', () => {
        assert.equal(computeCoordinatorDecision(state('PLAYING')), null);
        assert.equal(getTransitionFingerprint(state('PLAYING')), null);
    });

    it('avance PARTIE_END vers le round suivant', () => {
        const decision = computeCoordinatorDecision(state('PARTIE_END'));

        assert.equal(decision?.kind, 'ADVANCE');
        if (!decision || decision.kind !== 'ADVANCE') return;
        assert.equal(decision.nextState.phase, 'PLAYING');
        assert.equal(decision.nextState.roundNumber, 3);
        assert.equal(decision.nextState.mancheNumber, 4);
        assert.equal(decision.nextState.stateVersion, 13);
    });

    it('avance MANCHE_END vers la manche suivante', () => {
        const decision = computeCoordinatorDecision(state('MANCHE_END'));

        assert.equal(decision?.kind, 'ADVANCE');
        if (!decision || decision.kind !== 'ADVANCE') return;
        assert.equal(decision.nextState.phase, 'PLAYING');
        assert.equal(decision.nextState.roundNumber, 1);
        assert.equal(decision.nextState.mancheNumber, 5);
    });

    it('resout BOUDE et saute PARTIE_END comme le parcours mobile', () => {
        const decision = computeCoordinatorDecision(state('BOUDE'));

        assert.equal(decision?.kind, 'ADVANCE');
        if (!decision || decision.kind !== 'ADVANCE') return;
        assert.equal(decision.nextState.phase, 'PLAYING');
        assert.equal(decision.nextState.firstPlayerOfRound, null);
        assert.equal(decision.nextState.roundNumber, 3);
    });

    it('redonne une seule fois apres une egalite BOUDE', () => {
        const tiedState = state('BOUDE');
        tiedState.players[0].hand = [domino('p1-1', 1, 2)];
        tiedState.players[1].hand = [domino('p2-1', 0, 3)];
        tiedState.players[2].hand = [domino('p3-6', 6, 6)];

        const decision = computeCoordinatorDecision(tiedState);

        assert.equal(decision?.kind, 'ADVANCE');
        if (!decision || decision.kind !== 'ADVANCE') return;
        assert.equal(decision.nextState.phase, 'PLAYING');
        assert.equal(decision.nextState.reDealCount, 1);
        assert.deepEqual(decision.nextState.tiedPlayerIds, ['p1', 'p2']);
    });

    it('conserve MANCHE_END apres un BOUDE Cochon pour afficher son resultat', () => {
        const cochonState = state('BOUDE');
        cochonState.gameMode = 'COCHON';
        cochonState.winningCondition = 99;
        cochonState.players[0].currentMancheStars = 2;
        cochonState.players[1].currentMancheStars = 0;
        cochonState.players[2].currentMancheStars = 0;

        const decision = computeCoordinatorDecision(cochonState);

        assert.equal(decision?.kind, 'ADVANCE');
        if (!decision || decision.kind !== 'ADVANCE') return;
        assert.equal(decision.nextState.phase, 'MANCHE_END');
        assert.equal(decision.nextState.mancheResult, 'COCHON');
    });

    it('finalise MATCH_END sans distribuer une nouvelle main', () => {
        const decision = computeCoordinatorDecision(state('MATCH_END'));

        assert.equal(decision?.kind, 'FINALIZE_MATCH');
        assert.equal(decision?.transitionId, 'game-1:MATCH_END:12:4:2:8');
    });

    it('rejette une empreinte devenue obsolete', () => {
        const terminalState = state('PARTIE_END');
        const fingerprint = getTransitionFingerprint(terminalState);
        assert.ok(fingerprint);
        assert.equal(hasTransitionFingerprint(terminalState, fingerprint), true);
        assert.equal(
            hasTransitionFingerprint({ ...terminalState, stateVersion: 13 }, fingerprint),
            false
        );
    });
});
