/**
 * BugMultiBlocked.regression.test.ts
 *
 * Tests de régression d'intégration pour BUG-MULTI-BLOCKED.
 *
 * Ces tests utilisent les vraies fonctions du LogicEngine pour vérifier :
 *   - que passTurn détecte correctement les parties bloquées
 *   - que resolveBoude sort bien de la phase BOUDE vers PARTIE_END ou MANCHE_END
 *   - que computeNextRoundState produit un état en phase PLAYING (jamais bloqué)
 *   - que des séquences de passes consécutives (tous les joueurs boudés) déclenchent
 *     bien la phase BOUDE et ne restent pas coincées en PLAYING
 *
 * Ces tests constituent le filet de sécurité pour toute évolution future de la
 * logique de blocage et de résolution.
 */

import { passTurn, resolveBoude, computeNextRoundState } from '../core/LogicEngine';
import { GameState, Player, Domino } from '../core/types';

// ---------------------------------------------------------------------------
// Helpers de construction d'état
// ---------------------------------------------------------------------------

const makeDomino = (left: number, right: number): Domino => ({
    id: `d${left}${right}`,
    left,
    right,
    sum: left + right,
    isDouble: left === right,
});

const makePlayer = (id: string, hand: Domino[], status: 'HUMAN' | 'BOT' = 'HUMAN'): Player => ({
    id,
    name: `Player ${id}`,
    hand,
    handSize: hand.length,
    currentMancheStars: 0,
    mancheWins: 0,
    totalRoundWins: 0,
    totalPoints: 0,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    wins: 0,
    status,
});

const makeBlockedState = (currentPlayerId: string, passHistory: string[]): GameState => {
    // État où toutes les mains contiennent uniquement des dominos injouables
    // face au plateau (leftValue=3, rightValue=3) : les joueurs ont [5|5], [6|6], [4|4]
    const players = [
        makePlayer('p1', [makeDomino(5, 5)]),
        makePlayer('p2', [makeDomino(6, 6)]),
        makePlayer('p3', [makeDomino(4, 4)]),
    ];

    const history = passHistory.map(pid => ({
        playerId: pid,
        action: 'PASS' as const,
        timestamp: Date.now(),
    }));

    return {
        gameId: 'test-game',
        players,
        talonMort: [],
        table: {
            sequence: [makeDomino(3, 3)],
            leftValue: 3,
            rightValue: 3,
        },
        currentPlayerId,
        phase: 'PLAYING',
        firstPlayerOfRound: 'p1',
        history,
        winningCondition: 3,
        gameMode: 'MANCHE',
        mancheResult: null,
        turnDuration: 30,
        lastActionTimestamp: Date.now(),
        turnId: passHistory.length,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7,
    };
};

// ---------------------------------------------------------------------------
// SECTION 1 — passTurn : détection de blocage (phase BOUDE)
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — Régression LogicEngine.passTurn', () => {

    test('Un seul pass ne déclenche pas BOUDE (jeu continue)', () => {
        // p1 passe, p2 et p3 n'ont pas encore passé
        const state = makeBlockedState('p1', []);
        const result = passTurn(state, 'p1');

        expect(result.phase).toBe('PLAYING');
        expect(result.currentPlayerId).toBe('p2'); // Passage au joueur suivant
    });

    test('Deux passes consécutifs ne déclenchent pas BOUDE (jeu continue)', () => {
        const stateAfterP1Pass = makeBlockedState('p2', ['p1']);
        const result = passTurn(stateAfterP1Pass, 'p2');

        expect(result.phase).toBe('PLAYING');
        expect(result.currentPlayerId).toBe('p3');
    });

    test('Trois passes consécutifs (tous les joueurs) → phase BOUDE', () => {
        // Historique : p1 et p2 ont déjà passé → c'est au tour de p3
        const stateBeforeP3Pass = makeBlockedState('p3', ['p1', 'p2']);
        const result = passTurn(stateBeforeP3Pass, 'p3');

        expect(result.phase).toBe('BOUDE');
        // Le tour ne doit PAS avoir avancé (on reste sur p3 comme dernier à passer)
    });

    test('BOUDE déclenché même avec une longue histoire de jeu avant les 3 passes', () => {
        // On construit une histoire avec des PLAY avant les 3 passes
        const players = [
            makePlayer('p1', [makeDomino(5, 5)]),
            makePlayer('p2', [makeDomino(6, 6)]),
            makePlayer('p3', [makeDomino(4, 4)]),
        ];

        const longHistory = [
            { playerId: 'p1', action: 'PLAY' as const, timestamp: Date.now() },
            { playerId: 'p2', action: 'PLAY' as const, timestamp: Date.now() },
            { playerId: 'p3', action: 'PLAY' as const, timestamp: Date.now() },
            { playerId: 'p1', action: 'PASS' as const, timestamp: Date.now() }, // Début des passes
            { playerId: 'p2', action: 'PASS' as const, timestamp: Date.now() },
            // p3 va passer → déclenche BOUDE
        ];

        const state: GameState = {
            gameId: 'test',
            players,
            talonMort: [],
            table: { sequence: [makeDomino(3, 3)], leftValue: 3, rightValue: 3 },
            currentPlayerId: 'p3',
            phase: 'PLAYING',
            firstPlayerOfRound: 'p1',
            history: longHistory,
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 30,
            lastActionTimestamp: Date.now(),
            turnId: longHistory.length,
            mancheHistory: [],
            roundNumber: 1,
            mancheNumber: 1,
            startingHandSize: 7,
        };

        const result = passTurn(state, 'p3');
        expect(result.phase).toBe('BOUDE');
    });

    test('passTurn lève une erreur si le joueur n\'est pas le joueur courant', () => {
        const state = makeBlockedState('p1', []);
        expect(() => passTurn(state, 'p2')).toThrow('Not your turn');
    });

    test('passTurn lève une erreur si le joueur a des coups valides', () => {
        const players = [
            makePlayer('p1', [makeDomino(3, 5)]), // Jouable sur leftValue=3
            makePlayer('p2', [makeDomino(6, 6)]),
            makePlayer('p3', [makeDomino(4, 4)]),
        ];

        const state: GameState = {
            gameId: 'test',
            players,
            talonMort: [],
            table: { sequence: [makeDomino(3, 3)], leftValue: 3, rightValue: 3 },
            currentPlayerId: 'p1',
            phase: 'PLAYING',
            firstPlayerOfRound: 'p1',
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 30,
            lastActionTimestamp: Date.now(),
            turnId: 0,
            mancheHistory: [],
            roundNumber: 1,
            mancheNumber: 1,
            startingHandSize: 7,
        };

        expect(() => passTurn(state, 'p1')).toThrow('Player has valid moves, cannot pass');
    });
});

// ---------------------------------------------------------------------------
// SECTION 2 — resolveBoude : sortie de la phase BOUDE
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — Régression LogicEngine.resolveBoude', () => {

    const makeGameStateInBoude = (playerHands: Array<{ id: string; hand: Domino[] }>): GameState => {
        const players = playerHands.map(p => makePlayer(p.id, p.hand));
        return {
            gameId: 'test',
            players,
            talonMort: [],
            table: { sequence: [], leftValue: 3, rightValue: 3 },
            currentPlayerId: 'p1',
            phase: 'BOUDE',
            firstPlayerOfRound: 'p1',
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 30,
            lastActionTimestamp: Date.now(),
            turnId: 3,
            mancheHistory: [],
            roundNumber: 2,
            mancheNumber: 1,
            startingHandSize: 7,
            reDealCount: 0,
        };
    };

    test('resolveBoude avec gagnant clair → phase PARTIE_END (pas BOUDE)', () => {
        const state = makeGameStateInBoude([
            { id: 'p1', hand: [makeDomino(1, 1)] },   // 2 points (gagnant)
            { id: 'p2', hand: [makeDomino(5, 6)] },   // 11 points
            { id: 'p3', hand: [makeDomino(4, 5)] },   // 9 points
        ]);

        const { newState, isTie } = resolveBoude(state);

        expect(isTie).toBe(false);
        // La phase doit avancer (PARTIE_END ou MANCHE_END selon la condition de victoire)
        expect(newState.phase).not.toBe('BOUDE');
        expect(newState.phase).not.toBe('PLAYING');
    });

    test('resolveBoude avec égalité → isTie=true et newState reste exploitable', () => {
        const state = makeGameStateInBoude([
            { id: 'p1', hand: [makeDomino(1, 1)] }, // 2 points
            { id: 'p2', hand: [makeDomino(1, 1)] }, // 2 points (égalité)
            { id: 'p3', hand: [makeDomino(5, 5)] }, // 10 points
        ]);

        const { newState, isTie, tiedPlayerIds } = resolveBoude(state);

        expect(isTie).toBe(true);
        expect(tiedPlayerIds).toContain('p1');
        expect(tiedPlayerIds).toContain('p2');
        // newState doit rester intègre pour être utilisé par computeNextRoundState
        expect(newState.players).toHaveLength(3);
    });

    test('Garde-fou anti-boucle C5 : après 2 égalités, un gagnant est forcé', () => {
        const state = makeGameStateInBoude([
            { id: 'p1', hand: [makeDomino(1, 1)] }, // 2 points
            { id: 'p2', hand: [makeDomino(1, 1)] }, // 2 points (égalité)
            { id: 'p3', hand: [makeDomino(5, 5)] }, // 10 points
        ]);

        // Simuler 2 redonnés précédents
        state.reDealCount = 2;

        const { newState, isTie } = resolveBoude(state);

        // Après 2 égalités, le garde-fou force une décision → isTie=false
        expect(isTie).toBe(false);
        expect(newState.phase).not.toBe('BOUDE');
    });
});

// ---------------------------------------------------------------------------
// SECTION 3 — computeNextRoundState : toujours PLAYING à la sortie
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — Régression LogicEngine.computeNextRoundState', () => {

    const makeStateForNextRound = (phase: 'PARTIE_END' | 'MANCHE_END'): GameState => {
        const players = [
            makePlayer('p1', [makeDomino(1, 1)]),
            makePlayer('p2', [makeDomino(5, 6)]),
            makePlayer('p3', [makeDomino(4, 5)]),
        ];

        return {
            gameId: 'test',
            players,
            talonMort: [],
            table: { sequence: [], leftValue: null, rightValue: null },
            currentPlayerId: 'p1',
            phase,
            firstPlayerOfRound: 'p1',
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 30,
            lastActionTimestamp: Date.now(),
            turnId: 8,
            mancheHistory: [],
            roundNumber: 2,
            mancheNumber: 1,
            startingHandSize: 7,
        };
    };

    test('computeNextRoundState depuis PARTIE_END → phase PLAYING', () => {
        const state = makeStateForNextRound('PARTIE_END');
        const nextState = computeNextRoundState(state);

        expect(nextState.phase).toBe('PLAYING');
    });

    test('computeNextRoundState depuis MANCHE_END → phase PLAYING', () => {
        const state = makeStateForNextRound('MANCHE_END');
        const nextState = computeNextRoundState(state);

        expect(nextState.phase).toBe('PLAYING');
    });

    test('computeNextRoundState réinitialise history à []', () => {
        const state = makeStateForNextRound('PARTIE_END');
        state.history = [
            { playerId: 'p1', action: 'PASS', timestamp: Date.now() },
            { playerId: 'p2', action: 'PASS', timestamp: Date.now() },
        ];
        const nextState = computeNextRoundState(state);

        expect(nextState.history).toEqual([]);
    });

    test('computeNextRoundState réinitialise boudePlayerId à null', () => {
        const state = makeStateForNextRound('PARTIE_END');
        (state as any).boudePlayerId = 'p2';

        const nextState = computeNextRoundState(state);
        expect(nextState.boudePlayerId).toBeNull();
    });

    test('computeNextRoundState distribue de nouvelles mains (7 dominos par joueur)', () => {
        const state = makeStateForNextRound('PARTIE_END');
        const nextState = computeNextRoundState(state);

        nextState.players.forEach(player => {
            expect(player.hand).toHaveLength(state.startingHandSize);
        });
    });

    test('computeNextRoundState pour PARTIE_END incrémente roundNumber', () => {
        const state = makeStateForNextRound('PARTIE_END');
        state.roundNumber = 2;
        const nextState = computeNextRoundState(state);

        expect(nextState.roundNumber).toBe(3);
    });

    test('computeNextRoundState pour MANCHE_END incrémente mancheNumber et reset roundNumber à 1', () => {
        const state = makeStateForNextRound('MANCHE_END');
        state.mancheNumber = 1;
        state.roundNumber = 4;
        const nextState = computeNextRoundState(state);

        expect(nextState.mancheNumber).toBe(2);
        expect(nextState.roundNumber).toBe(1);
    });

    test('computeNextRoundState reset turnId à 0', () => {
        const state = makeStateForNextRound('PARTIE_END');
        state.turnId = 99;
        const nextState = computeNextRoundState(state);

        expect(nextState.turnId).toBe(0);
    });

    test('computeNextRoundState réinitialise tiedPlayerIds à null', () => {
        const state = makeStateForNextRound('MANCHE_END');
        (state as any).tiedPlayerIds = ['p1', 'p2'];
        const nextState = computeNextRoundState(state);

        expect(nextState.tiedPlayerIds).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// SECTION 4 — Scénario de bout en bout simulant le blocage
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — Scénario de bout en bout : partie bloquée → résolution', () => {

    test('Séquence complète : 3 joueurs passent → BOUDE → résolution → PLAYING', () => {
        // État initial : tous les joueurs ont des dominos injouables
        let state = makeBlockedState('p1', []);

        // Tour 1 : p1 passe
        state = passTurn(state, 'p1');
        expect(state.phase).toBe('PLAYING');
        expect(state.currentPlayerId).toBe('p2');

        // Tour 2 : p2 passe
        state = passTurn(state, 'p2');
        expect(state.phase).toBe('PLAYING');
        expect(state.currentPlayerId).toBe('p3');

        // Tour 3 : p3 passe → BOUDE déclenché
        state = passTurn(state, 'p3');
        expect(state.phase).toBe('BOUDE');

        // Résolution du Boudé
        const { newState: resolvedState, isTie } = resolveBoude(state);

        if (isTie) {
            // En cas d'égalité : re-deal
            const redealtState = computeNextRoundState({ ...resolvedState, phase: 'PARTIE_END' });
            expect(redealtState.phase).toBe('PLAYING');
            expect(redealtState.history).toEqual([]);
            expect(redealtState.boudePlayerId ?? null).toBeNull();
        } else {
            // Gagnant identifié → PARTIE_END ou MANCHE_END
            expect(resolvedState.phase).not.toBe('BOUDE');

            // Si c'est PARTIE_END, on peut passer au round suivant
            if (resolvedState.phase === 'PARTIE_END' || resolvedState.phase === 'MANCHE_END') {
                const nextState = computeNextRoundState(resolvedState);
                expect(nextState.phase).toBe('PLAYING');
                expect(nextState.history).toEqual([]);
                expect(nextState.boudePlayerId ?? null).toBeNull();
            }
        }
    });

    test('Aucun doublon d\'historique : chaque passe ajoute exactement 1 entrée', () => {
        let state = makeBlockedState('p1', []);

        state = passTurn(state, 'p1');
        expect(state.history.length).toBe(1);

        state = passTurn(state, 'p2');
        expect(state.history.length).toBe(2);

        state = passTurn(state, 'p3');
        expect(state.history.length).toBe(3);
        expect(state.phase).toBe('BOUDE');
    });
});
