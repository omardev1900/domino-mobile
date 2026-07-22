
import { dealGame, checkValidMove, determineFirstPlayer, determineWinnerOnBoudé, calculateHandPoints, passTurn, handleTurn, getForcedOpeningDominoId, getForcedTieBreakDominoId } from '../LogicEngine';
import { Domino, Player, DominoSide, GameState } from '../types';
import { determineTieBreakStarter, computeNextRoundState, resolveBoude } from '../LogicEngine';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

describe('LogicEngine', () => {
    describe('dealGame', () => {
        it('should deal 7 dominos to 3 players', () => {
            const game = dealGame(['Alice', 'Bob', 'Charlie']);
            expect(game.players).toHaveLength(3);
            game.players!.forEach(player => {
                expect(player.hand).toHaveLength(7);
            });
            expect(game.talonMort).toHaveLength(7);
        });
    });

    describe('checkValidMove', () => {
        const domino66: Domino = { id: 'd1', left: 6, right: 6, isDouble: true };
        const domino61: Domino = { id: 'd2', left: 6, right: 1, isDouble: false };
        const domino00: Domino = { id: 'd3', left: 0, right: 0, isDouble: true };

        it('should allow any move on empty table', () => {
            const result = checkValidMove(domino66, null, null);
            expect(result.canPlay).toBe(true);
        });

        it('should allow matching left', () => {
            // Table: 6 ... 4
            const result = checkValidMove(domino61, 6, 4);
            // 6 matches 6
            expect(result.canPlay).toBe(true);
            expect(result.side).toBe('left');
        });

        it('should allow matching right', () => {
            // Table: 4 ... 1
            const result = checkValidMove(domino61, 4, 1);
            // 1 matches 1
            expect(result.canPlay).toBe(true);
            expect(result.side).toBe('right');
        });

        it('should reject non-matching domino', () => {
            // Table: 5 ... 2
            const result = checkValidMove(domino61, 5, 2);
            expect(result.canPlay).toBe(false);
        });
    });

    describe('determineFirstPlayer', () => {
        it('should pick player with highest double', () => {
            const p1 = { id: 'p1', hand: [{ left: 6, right: 6, isDouble: true }] } as Player;
            const p2 = { id: 'p2', hand: [{ left: 5, right: 5, isDouble: true }] } as Player;
            const p3 = { id: 'p3', hand: [{ left: 1, right: 2, isDouble: false }] } as Player;

            const winner = determineFirstPlayer([p1, p2, p3]);
            expect(winner).toBe('p1');
        });

        it('should pick player with highest sum if no doubles', () => {
            const p1 = { id: 'p1', hand: [{ left: 0, right: 1, isDouble: false }] } as Player;
            const p2 = { id: 'p2', hand: [{ left: 3, right: 4, isDouble: false }] } as Player; // Highest sum
            const p3 = { id: 'p3', hand: [{ left: 1, right: 2, isDouble: false }] } as Player;

            const winner = determineFirstPlayer([p1, p2, p3]);
            expect(winner).toBe('p2');
        });
    });

    describe('determineWinnerOnBoudé', () => {
        it('should pick player with lowest points', () => {
            const p1 = { id: 'p1', hand: [{ left: 6, right: 6 }] } as any;
            const p2 = { id: 'p2', hand: [{ left: 0, right: 0 }] } as any; // Winner
            const p3 = { id: 'p3', hand: [{ left: 1, right: 1 }] } as any;

            const result = determineWinnerOnBoudé([p1, p2, p3]);
            expect(result).toBe('p2');
        });

        it('should return TIE if equal lowest', () => {
            const p1 = { id: 'p1', hand: [{ left: 1, right: 0 }] } as any;
            const p2 = { id: 'p2', hand: [{ left: 0, right: 1 }] } as any; // Tie
            const p3 = { id: 'p3', hand: [{ left: 6, right: 6 }] } as any;

            const result = determineWinnerOnBoudé([p1, p2, p3]);
            expect(result).toBe('TIE');
        });
    });
});


describe('passTurn', () => {
    const p1: Player = { id: 'p1', name: 'P1', hand: [{ id: 'd1', left: 6, right: 6, isDouble: true } as Domino], handSize: 1, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'HUMAN' };
    const p2: Player = { id: 'p2', name: 'P2', hand: [{ id: 'd2', left: 0, right: 0, isDouble: true } as Domino], handSize: 1, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'HUMAN' };
    const p3: Player = { id: 'p3', name: 'P3', hand: [{ id: 'd3', left: 2, right: 2, isDouble: true } as Domino], handSize: 1, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'HUMAN' };

    let state: GameState = createBaseGameState({
        players: [p1, p2, p3],
        table: { sequence: [], leftValue: 6, rightValue: 6 }, // Table matches 6
        history: [],
        currentPlayerId: 'p2', // P2 has 0-0, cannot play on 6-6
        firstPlayerOfRound: 'p1',
    });

    it('should throw if player has a valid move', () => {
        // P1 has 6-6 and table is 6-6, so P1 can play.
        const stateCanPlay = { ...state, currentPlayerId: 'p1' };
        expect(() => passTurn(stateCanPlay, 'p1')).toThrow("Player has valid moves");
    });

    it('should allow pass if no valid move', () => {
        // P2 has 0-0, table is 6-6. P2 cannot play.
        const newState = passTurn(state, 'p2');
        expect(newState.history).toHaveLength(1);
        expect(newState.history[0].action).toBe('PASS');
        expect(newState.currentPlayerId).toBe('p3'); // Rotated
    });

    it('should detect blocked game (Boudé) after 3 passes', () => {
        // Simulate 2 previous passes
        state.history = [
            { playerId: 'p3', action: 'PASS', timestamp: 0 },
            { playerId: 'p1', action: 'PASS', timestamp: 0 }
        ];
        state.currentPlayerId = 'p2'; // P2 is about to pass (3rd pass)

        const newState = passTurn(state, 'p2');

        // Should enter BOUDE phase for UI to show popup
        expect(newState.phase).toBe('BOUDE');
    });
});

describe('handleTurn', () => {
    const p1: Player = { id: 'p1', name: 'P1', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, totalCochons: 0, isCochon: false, status: 'HUMAN' };

    let state: GameState = createBaseGameState({
        players: [p1],
        table: { sequence: [], leftValue: 6, rightValue: 6 },
        history: [],
        currentPlayerId: 'p1',
        firstPlayerOfRound: 'p1',
    });

    // Re-initialize p1's hand for each test
    beforeEach(() => {
        const d1: Domino = { id: 'd1', left: 6, right: 6, isDouble: true };
        p1.hand = [d1];
    });

    it('should throw if player tries to play a tile not in their hand', () => {
        const foreignTile: Domino = { id: 'foreign', left: 6, right: 0, isDouble: false };
        // We expect LogicEngine to throw "Player does not have this domino"
        expect(() => handleTurn(state, 'p1', foreignTile)).toThrow("Player does not have this domino");
    });
});

describe('Opening rule (round 1 / manche 1)', () => {
    const d66: Domino = { id: 'd66', left: 6, right: 6, isDouble: true };
    const d65: Domino = { id: 'd65', left: 6, right: 5, isDouble: false };
    const d55: Domino = { id: 'd55', left: 5, right: 5, isDouble: true };

    const createState = (roundNumber: number = 1, mancheNumber: number = 1): GameState => createBaseGameState({
        players: [
            {
                id: 'p1',
                name: 'P1',
                hand: [d66, d65],
                handSize: 2,
                wins: 0,
                mancheWins: 0,
                currentMancheStars: 0,
                totalRoundWins: 0,
                totalPoints: 0,
                totalCochons: 0,
                isCochon: false,
                status: 'HUMAN'
            },
            {
                id: 'p2',
                name: 'P2',
                hand: [d55],
                handSize: 1,
                wins: 0,
                mancheWins: 0,
                currentMancheStars: 0,
                totalRoundWins: 0,
                totalPoints: 0,
                totalCochons: 0,
                isCochon: false,
                status: 'HUMAN'
            }
        ],
        currentPlayerId: 'p1',
        roundNumber,
        mancheNumber,
    });

    it('should expose forced opening domino only for the starter with highest double', () => {
        const state = createState();
        expect(getForcedOpeningDominoId(state, 'p1')).toBe('d66');
        expect(getForcedOpeningDominoId(state, 'p2')).toBeNull();
    });

    it('should reject non-double opening move for the starter on first round/manche', () => {
        const state = createState();
        expect(() => handleTurn(state, 'p1', d65)).toThrow("Opening rule: highest double must be played on round 1 / manche 1.");
    });

    it('should allow highest double opening move on first round/manche', () => {
        const state = createState();
        const newState = handleTurn(state, 'p1', d66);
        expect(newState.table.sequence).toHaveLength(1);
        expect(newState.table.sequence[0].domino.id).toBe('d66');
    });

    it('should allow any opening domino from round 2 onward', () => {
        const state = createState(2, 1);
        const newState = handleTurn(state, 'p1', d65);
        expect(newState.table.sequence).toHaveLength(1);
        expect(newState.table.sequence[0].domino.id).toBe('d65');
    });
});

describe('getForcedTieBreakDominoId — R2-B2', () => {
    const d66: Domino = { id: 'dtie66', left: 6, right: 6, isDouble: true };
    const d33: Domino = { id: 'dtie33', left: 3, right: 3, isDouble: true };
    const d52: Domino = { id: 'dtie52', left: 5, right: 2, isDouble: false };

    const tiedState: GameState = {
        gameId: 'g1',
        players: [
            { id: 'p1', name: 'A', hand: [d66, d52], handSize: 2, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
            { id: 'p2', name: 'B', hand: [d33, d52], handSize: 2, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
            { id: 'p3', name: 'C', hand: [d52],      handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
        ],
        talonMort: [], table: { sequence: [], leftValue: null, rightValue: null },
        currentPlayerId: 'p1', phase: 'PLAYING', firstPlayerOfRound: null, history: [],
        winningCondition: 3, gameMode: 'MANCHE', mancheResult: null, turnDuration: 30,
        lastActionTimestamp: 0, turnId: 0, mancheHistory: [], roundNumber: 2, mancheNumber: 1,
        startingHandSize: 7,
        tiedPlayerIds: ['p1', 'p2'], // p3 n'est pas à égalité
    };

    it('retourne le plus grand double pour le joueur à égalité qui le possède', () => {
        expect(getForcedTieBreakDominoId(tiedState, 'p1')).toBe('dtie66');
    });

    it('retourne null pour un joueur à égalité qui ne possède pas le plus grand double', () => {
        expect(getForcedTieBreakDominoId(tiedState, 'p2')).toBeNull();
    });

    it('retourne null pour un joueur NON à égalité', () => {
        expect(getForcedTieBreakDominoId(tiedState, 'p3')).toBeNull();
    });

    it('retourne null quand la table n\'est plus vide (contrainte levée après le 1er coup)', () => {
        const stateAfterFirstPlay: GameState = {
            ...tiedState,
            table: { sequence: [{ domino: d66, side: 'right' as any }], leftValue: 6, rightValue: 6 },
        };
        expect(getForcedTieBreakDominoId(stateAfterFirstPlay, 'p1')).toBeNull();
    });

    it('retourne null quand tiedPlayerIds est absent', () => {
        const noTieState: GameState = { ...tiedState, tiedPlayerIds: undefined };
        expect(getForcedTieBreakDominoId(noTieState, 'p1')).toBeNull();
    });

    it('handleTurn rejette un domino non-forcé pour un joueur à égalité', () => {
        expect(() => handleTurn(tiedState, 'p1', d52)).toThrow("Tie-break rule:");
    });

    it('handleTurn accepte le plus grand double pour le joueur à égalité', () => {
        const newState = handleTurn(tiedState, 'p1', d66);
        expect(newState.table.sequence[0].domino.id).toBe('dtie66');
    });

    it('determineTieBreakStarter exclut le 3e joueur non ex aequo meme avec un plus grand double', () => {
        const outsiderDouble: Domino = { id: 'dtie77', left: 6, right: 6, isDouble: true };
        const stateWithStrongerOutsider: GameState = {
            ...tiedState,
            players: [
                { ...tiedState.players[0], hand: [d33, d52] },
                { ...tiedState.players[1], hand: [d52] },
                { ...tiedState.players[2], hand: [outsiderDouble] },
            ],
        };

        expect(determineTieBreakStarter(stateWithStrongerOutsider.players, stateWithStrongerOutsider.tiedPlayerIds)).toBe('p1');
    });

    it('computeNextRoundState choisit le starter de redonne parmi les joueurs a egalite uniquement', () => {
        const baseHand: Domino = { id: 'base', left: 0, right: 1, isDouble: false };
        const tieRedealState: GameState = {
            ...tiedState,
            phase: 'PARTIE_END',
            firstPlayerOfRound: null,
            currentPlayerId: 'p3',
            players: [
                { ...tiedState.players[0], hand: [baseHand], handSize: 1 },
                { ...tiedState.players[1], hand: [baseHand], handSize: 1 },
                { ...tiedState.players[2], hand: [baseHand], handSize: 1 },
            ],
            roundNumber: 6,
            mancheNumber: 5,
            startingHandSize: 7,
            tiedPlayerIds: ['p1', 'p2'],
        };

        const nextState = computeNextRoundState(tieRedealState);
        expect(['p1', 'p2']).toContain(nextState.currentPlayerId);
    });

    it('computeNextRoundState exclut toujours le perdant non ex aequo apres une redonne BOUDE', () => {
        const tieRedealState: GameState = {
            ...tiedState,
            phase: 'PARTIE_END',
            firstPlayerOfRound: null,
            currentPlayerId: 'p3',
            roundNumber: 3,
            mancheNumber: 1,
            startingHandSize: 7,
            tiedPlayerIds: ['p1', 'p2'],
        };

        for (let i = 0; i < 25; i++) {
            const nextState = computeNextRoundState(tieRedealState);
            expect(nextState.currentPlayerId).not.toBe('p3');
            expect(['p1', 'p2']).toContain(nextState.currentPlayerId);
        }
    });
});

describe('resolveBoude + redonne tie-break integration', () => {
    const mkPlayer = (id: string, hand: Domino[]): Player => ({
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

    const mkState = (players: Player[]): GameState => ({
        gameId: 'tie-test',
        players,
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        currentPlayerId: players[0].id,
        phase: 'BOUDE',
        firstPlayerOfRound: null,
        history: [],
        winningCondition: 3,
        gameMode: 'COCHON',
        mancheResult: null,
        turnDuration: 30,
        lastActionTimestamp: 0,
        turnId: 0,
        mancheHistory: [],
        roundNumber: 6,
        mancheNumber: 5,
        startingHandSize: 7,
        reDealCount: 0,
        boudePlayerId: null,
    });

    it('egalite a 2 joueurs: resolveBoude marque uniquement les 2 ex aequo', () => {
        const d11: Domino = { id: 'd11', left: 1, right: 1, isDouble: true };
        const d20: Domino = { id: 'd20', left: 2, right: 0, isDouble: false };
        const d66: Domino = { id: 'd66', left: 6, right: 6, isDouble: true };
        const state = mkState([
            mkPlayer('p1', [d11]),
            mkPlayer('p2', [d20]),
            mkPlayer('p3', [d66]),
        ]);

        const result = resolveBoude(state);
        expect(result.isTie).toBe(true);
        expect(result.tiedPlayerIds).toEqual(['p1', 'p2']);
    });

    it('egalite a 2 joueurs: le starter de redonne est choisi parmi les 2 ex aequo seulement', () => {
        const tiedStarter: Domino = { id: 'tied-55', left: 5, right: 5, isDouble: true };
        const tiedOther: Domino = { id: 'tied-33', left: 3, right: 3, isDouble: true };
        const outsiderStronger: Domino = { id: 'outsider-66', left: 6, right: 6, isDouble: true };

        const starter = determineTieBreakStarter(
            [
                mkPlayer('p1', [tiedStarter]),
                mkPlayer('p2', [tiedOther]),
                mkPlayer('p3', [outsiderStronger]),
            ],
            ['p1', 'p2']
        );

        expect(starter).toBe('p1');
    });

    it('egalite a 3 joueurs: resolveBoude conserve les 3 joueurs dans tiedPlayerIds', () => {
        const d11: Domino = { id: 'd11', left: 1, right: 1, isDouble: true };
        const d20: Domino = { id: 'd20', left: 2, right: 0, isDouble: false };
        const d20b: Domino = { id: 'd20b', left: 2, right: 0, isDouble: false };
        const state = mkState([
            mkPlayer('p1', [d11]),
            mkPlayer('p2', [d20]),
            mkPlayer('p3', [d20b]),
        ]);

        const result = resolveBoude(state);
        expect(result.isTie).toBe(true);
        expect(result.tiedPlayerIds).toEqual(['p1', 'p2', 'p3']);
    });

    it('egalite a 3 joueurs: le starter devient le plus grand double parmi les 3 ex aequo', () => {
        const d11: Domino = { id: 'd11', left: 1, right: 1, isDouble: true };
        const d33: Domino = { id: 'd33', left: 3, right: 3, isDouble: true };
        const d22: Domino = { id: 'd22', left: 2, right: 2, isDouble: true };

        const starter = determineTieBreakStarter(
            [
                mkPlayer('p1', [d11]),
                mkPlayer('p2', [d33]),
                mkPlayer('p3', [d22]),
            ],
            ['p1', 'p2', 'p3']
        );

        expect(starter).toBe('p2');
    });

    it('egalite a 3 joueurs: le premier coup est force au starter retenu', () => {
        const d11: Domino = { id: 'd11', left: 1, right: 1, isDouble: true };
        const d33: Domino = { id: 'd33', left: 3, right: 3, isDouble: true };
        const d22: Domino = { id: 'd22', left: 2, right: 2, isDouble: true };
        const playState = mkState([
            mkPlayer('p1', [d11]),
            mkPlayer('p2', [d33]),
            mkPlayer('p3', [d22]),
        ]);
        playState.phase = 'PLAYING';
        playState.currentPlayerId = 'p2';
        playState.tiedPlayerIds = ['p1', 'p2', 'p3'];

        expect(() => handleTurn(playState, 'p2', d11)).toThrow('Tie-break rule:');

        const nextState = handleTurn(playState, 'p2', d33);
        expect(nextState.table.sequence[0].domino.id).toBe('d33');
    });
});

import * as LogicEngineModule from '../LogicEngine';

describe('computeNextRoundState - Nouvelle Manche (BUG-DOUBLE6-MANCHE)', () => {
    it('doit ignorer tiedPlayerIds et faire commencer le joueur avec le plus gros double lors d\'une nouvelle manche', () => {
        // Arrange
        const oldPlayers = [
            { id: 'p1', name: 'A', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
            { id: 'p2', name: 'B', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
            { id: 'p3', name: 'C', hand: [], handSize: 0, wins: 0, mancheWins: 0, currentMancheStars: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
        ];

        const state: GameState = {
            gameId: 'g1',
            players: oldPlayers as Player[],
            talonMort: [],
            table: { sequence: [], leftValue: null, rightValue: null },
            currentPlayerId: 'p1',
            phase: 'MANCHE_END', // <- C'est une fin de manche
            firstPlayerOfRound: null,
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 30,
            lastActionTimestamp: 0,
            turnId: 0,
            mancheHistory: [],
            roundNumber: 6, // Fin du round 6
            mancheNumber: 1, // Fin de la manche 1
            startingHandSize: 7,
            tiedPlayerIds: ['p1', 'p2'], // Simule une égalité précédente entre p1 et p2 (p3 est exclu de l'égalité)
            boudePlayerId: null
        };

        // Act & Assert
        let p3StartedAtLeastOnce = false;

        for (let i = 0; i < 50; i++) {
            const nextState = LogicEngineModule.computeNextRoundState(state);
            const expectedStarter = LogicEngineModule.determineFirstPlayer(nextState.players);
            
            // Le joueur qui commence doit toujours être celui qui a le plus gros double globalement,
            // et non restreint à p1 ou p2.
            expect(nextState.currentPlayerId).toBe(expectedStarter);
            
            if (nextState.currentPlayerId === 'p3') {
                p3StartedAtLeastOnce = true;
            }
        }

        // On vérifie que p3 a bien pu commencer au moins une fois, prouvant qu'il n'est plus ignoré.
        expect(p3StartedAtLeastOnce).toBe(true);
    });
});

