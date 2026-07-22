
import { finalizeRound } from '../ScoringEngine';
import { GameState, Player, GameMode } from '../types';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

// Mock Constants if needed, but we rely on imported ones. 
// Assuming MANCHE_WIN_THRESHOLD is 3.

const createMockState = (playersData: { id: string, stars: number, totalPoints: number }[], gameMode: GameMode = 'SCORE', winningCondition: number = 30): GameState => createBaseGameState({
    players: playersData.map(p => ({
        id: p.id,
        name: p.id,
        currentMancheStars: p.stars,
        totalPoints: p.totalPoints,
        mancheWins: 0,
        totalRoundWins: 0,
        totalCochons: 0,
        totalCochonsInfliges: 0,
        totalCochonsSubis: 0,
        isCochon: false,
        status: 'HUMAN',
        hand: [],
        handSize: 0,
    } as unknown as Player)),
    currentPlayerId: playersData[0].id,
    gameMode,
    winningCondition,
});

describe('Scoring Verification', () => {
    // Helper to log clear results
    const logResult = (title: string, result: GameState, expected: any) => {
        console.error(`\n--- ${title} ---`);
        result.players.forEach(p => {
            console.error(`Player ${p.id}: Stars=${p.currentMancheStars}, TotalPts=${p.totalPoints}, IsCochon=${p.isCochon}`);
        });
        console.error(`Phase: ${result.phase}, MancheResult: ${result.mancheResult}`);
    };

    test('1. Test Chirée', () => {
        // A=2, B=1, C=0. C wins round.
        // Expect: All stars reset to 0.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 2 },
            { id: 'B', stars: 1, totalPoints: 1 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ]);

        const newState = finalizeRound(state, 'C');
        logResult('Test 1: Chirée (C wins)', newState, {});

        // Les étoiles ne sont plus remises à 0 à ce stade ! C'est UI (GameScreen) qui fera le reset.
        // A avait 2, B avait 1, C vient de gagner donc il passe de 0 à 1.
        expect(newState.players.find(p => p.id === 'A')?.currentMancheStars).toBe(2);
        expect(newState.players.find(p => p.id === 'B')?.currentMancheStars).toBe(1);
        expect(newState.players.find(p => p.id === 'C')?.currentMancheStars).toBe(1);

        expect(newState.mancheResult).toBe('CHIRE');

        // Vérifier l'historique
        expect(newState.mancheHistory.length).toBe(1);
        expect(newState.mancheHistory[0].points['A']).toBe(2);
        expect(newState.mancheHistory[0].points['C']).toBe(1);
    });

    test('2. Test Double Cochon', () => {
        // A=2, B=0, C=0. A wins round.
        // Expect: A finishes with +5 points (3 stars + 2 cochons). Losers -1.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 2 },
            { id: 'B', stars: 0, totalPoints: 0 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ]);

        const newState = finalizeRound(state, 'A');
        logResult('Test 2: Double Cochon (A wins)', newState, {});

        const playerA = newState.players.find(p => p.id === 'A');
        const playerB = newState.players.find(p => p.id === 'B');
        const playerC = newState.players.find(p => p.id === 'C');

        expect(playerA?.currentMancheStars).toBe(3); 
        expect(newState.phase).toBe('MANCHE_END');
        
        // Bug C1 REPAIRED: Player A gets exactly 5 points (3 stars + 2 cochons) at the end of the Manche
        expect(playerA?.totalPoints).toBe(5);
        expect(playerB?.totalPoints).toBe(-1); // Les cochons perdent 1 point
        expect(playerC?.totalPoints).toBe(-1); 
    });

    test('3. Test Simple Cochon', () => {
        // A=2, B=1, C=0. A wins round.
        // Expect: A finishes with +4 points. C -1.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 2 },
            { id: 'B', stars: 1, totalPoints: 1 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ]);

        const newState = finalizeRound(state, 'A');
        logResult('Test 3: Simple Cochon (A wins)', newState, {});

        const playerA = newState.players.find(p => p.id === 'A');
        expect(playerA?.currentMancheStars).toBe(3);
        // A Points: 3 (stars) + 1 (Cochon) = 4.
        expect(playerA?.totalPoints).toBe(4);
    });

    test('9. Bug C1: Double Attribution (Round win gives NO match points)', () => {
        // A=0, B=0, C=0.
        // A wins the first round.
        // Expect: A gets 1 star, but 0 totalPoints.
        const state = createMockState([
            { id: 'A', stars: 0, totalPoints: 0 },
            { id: 'B', stars: 0, totalPoints: 0 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ]);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');
        
        expect(playerA?.currentMancheStars).toBe(1);
        expect(playerA?.totalRoundWins).toBe(1);
        expect(playerA?.totalPoints).toBe(1); // 1 point pour le round gagné !
    });

    test('4. SCORE — Le seuil atteint en plein round reste PARTIE_END jusqu\'à la fin de manche', () => {
        // A=0 étoile, 29 pts. Objectif=30. A gagne le round → totalPoints = 30,
        // mais la manche n'est pas terminée: le match doit continuer.
        const state = createMockState([
            { id: 'A', stars: 0, totalPoints: 29 },
            { id: 'B', stars: 0, totalPoints: 10 },
            { id: 'C', stars: 0, totalPoints: 10 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        logResult('Test 4: Round atteint objectif Score → PARTIE_END', newState, {});

        const playerA = newState.players.find(p => p.id === 'A');
        expect(playerA?.totalPoints).toBe(30);
        expect(newState.phase).toBe('PARTIE_END');
    });

    test('4b. SCORE — Round sans atteinte de l\'objectif reste PARTIE_END', () => {
        // A=0 étoile, 5 pts. Objectif=30. A gagne le round → totalPoints = 6 → PARTIE_END.
        const state = createMockState([
            { id: 'A', stars: 0, totalPoints: 5 },
            { id: 'B', stars: 0, totalPoints: 10 },
            { id: 'C', stars: 0, totalPoints: 10 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');
        expect(playerA?.totalPoints).toBe(6);
        expect(newState.phase).toBe('PARTIE_END');
    });

    // ─── Tests de régression pour les bugs identifiés ───────────────────────────

    test('Bug B1 — SCORE : Chiré déclenche MATCH_END si le seuil est atteint avec leader unique', () => {
        // A=2 étoiles, 29 pts. B=1 étoile, 5 pts. C=0 étoile, 5 pts.
        // C gagne le round → tous ont ≥1 étoile → CHIRÉ.
        // A reste seul leader à 29 pts >=? No, C gagne +1 et passe à 6; on veut A à 30 via son étoile déjà acquise ? Non.
        // Ici le seuil doit être évalué sur les totaux de fin de manche chirée; A est déjà à 29, on fixe l'objectif à 29.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 29 },
            { id: 'B', stars: 1, totalPoints: 5 },
            { id: 'C', stars: 0, totalPoints: 5 }
        ], 'SCORE', 29);

        const result = finalizeRound(state, 'C'); // C gagne → tout le monde ≥1 étoile → CHIRÉ
        logResult('Bug B1: Chiré doit provoquer MATCH_END si le leader est unique', result, {});

        expect(result.mancheResult).toBe('CHIRE');
        expect(result.phase).toBe('MATCH_END');
    });

    test('Bug B2 — COCHON : MATCH_END déclenché quand le vainqueur atteint le quota de cochons infligés', () => {
        // A a déjà 1 cochon infligé. En gagnant une manche simple cochon, il atteint 2.
        const state: any = createMockState([
            { id: 'A', stars: 2, totalPoints: 4 },
            { id: 'B', stars: 0, totalPoints: -1 },
            { id: 'C', stars: 0, totalPoints: -1 }
        ], 'COCHON', 2);
        state.players[0].totalCochons = 1;
        state.players[0].totalCochonsInfliges = 1;

        const result = finalizeRound(state, 'A');
        logResult('Bug B2: COCHON — MATCH_END au 2e cochon infligé', result, {});

        expect(result.phase).toBe('MATCH_END');
        expect(result.mancheResult).toBe('COCHON');
        const playerA = result.players.find((p: any) => p.id === 'A');
        const playerB = result.players.find((p: any) => p.id === 'B');
        expect(playerA?.totalCochonsInfliges).toBe(3);
        expect(playerB?.totalCochons).toBe(0);
    });

    test('Bug B5 — VICTOIRE : isolation complète, pas de MANCHE_END', () => {
        // Mode VICTOIRE : winner = premier à atteindre winningCondition totalRoundWins.
        // A a déjà 2 victoires. Objectif = 3. A gagne un round → totalRoundWins = 3 → MATCH_END.
        const state: any = createMockState([
            { id: 'A', stars: 0, totalPoints: 2 },
            { id: 'B', stars: 0, totalPoints: 1 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ], 'VICTOIRE', 3);
        state.players[0].totalRoundWins = 2;
        state.players[1].totalRoundWins = 1;

        const result = finalizeRound(state, 'A');
        logResult('Bug B5: VICTOIRE — MATCH_END au 3e round gagné', result, {});

        expect(result.phase).toBe('MATCH_END');
        expect(result.mancheResult).toBeNull(); // Pas de mancheResult en mode VICTOIRE
        const playerA = result.players.find((p: any) => p.id === 'A');
        expect(playerA?.totalRoundWins).toBe(3);
    });

    test('5. Test Match Over at Manche End', () => {

        // A=2 Stars, 29 Points. Goal=30. A wins round.
        // Result: A gets +1 Star (3 Stars => Manche Win) AND +1 Point (30 Pts => Match Win).
        // Since it's end of Manche, Match Win is triggered.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 29 },
            { id: 'B', stars: 0, totalPoints: 10 },
            { id: 'C', stars: 0, totalPoints: 10 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        logResult('Test 5: Match Over at Manche End', newState, {});

        const playerA = newState.players.find(p => p.id === 'A');
        expect(playerA?.totalPoints).toBe(32); // 29 + 1 (round) + 2 (cochon bonus) = 32. (Les 2 stars d'avant étaient déjà à 29)
        expect(newState.phase).toBe('MATCH_END');
    });

    test('5b. SCORE — égalité au meilleur score en fin de manche prolonge le match', () => {
        // A atteint 31 points en gagnant la manche, et B est déjà à 31.
        // Le seuil est atteint, sans leader unique: on reste en fin de manche pour tie-break.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 29 },
            { id: 'B', stars: 1, totalPoints: 31 },
            { id: 'C', stars: 0, totalPoints: 10 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');

        expect(playerA?.totalPoints).toBe(31);
        expect(newState.phase).toBe('MANCHE_END');
    });

    test('6. Test Manche History Recording', () => {
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 10 },
            { id: 'B', stars: 0, totalPoints: 5 },
            { id: 'C', stars: 0, totalPoints: 5 }
        ], 'SCORE', 100);

        const newState = finalizeRound(state, 'A');

        expect(newState.mancheHistory).toBeDefined();
        expect(newState.mancheHistory.length).toBe(1);
        expect(newState.mancheHistory[0].winnerId).toBe('A');
        expect(newState.mancheHistory[0].points['A']).toBe(5); // 3 (stars) + 2 (cochons)
    });

    test('7. Test Tie-Breaker at Threshold (End of Manche)', () => {
        // A and B both hit threshold at the end of a manche.
        // A wins the round and the manche.
        // A: 27 pts + 3 bonus = 30 pts.
        // B: 30 pts.
        // Both >= 30, but it's a tie for the lead.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 28 }, 
            { id: 'B', stars: 1, totalPoints: 30 }, 
            { id: 'C', stars: 0, totalPoints: 10 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        logResult('Test 7: Tie-Breaker (A and B at 30)', newState, {});

        const playerA = newState.players.find(p => p.id === 'A');
        const playerB = newState.players.find(p => p.id === 'B');

        expect(playerA?.totalPoints).toBe(30);
        expect(playerB?.totalPoints).toBe(30);

        // Match should NOT be over because of the tie
        expect(newState.phase).toBe('MANCHE_END');
    });

    test('8. Test resolveBoude with Cochon scoring', () => {
        // A=2 Stars, B=0, C=0.
        // It's a Boudé. We must resolve it.
        // A's hand = 5 points. B's hand = 20 points. C's hand = 30 points.
        // A has the lowest score, so A wins.
        // Because B and C have 0 stars, it's a Double Cochon.
        let state = createMockState([
            { id: 'A', stars: 2, totalPoints: 0 },
            { id: 'B', stars: 0, totalPoints: 0 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ]);

        state.phase = 'BOUDE';
        state.players[0].hand = [{ id: '1', left: 2, right: 3 } as any]; // 5 pts
        state.players[1].hand = [{ id: '2', left: 10, right: 10 } as any]; // 20 pts
        state.players[2].hand = [{ id: '3', left: 15, right: 15 } as any]; // 30 pts

        const { resolveBoude } = require('../LogicEngine');
        const { newState, isTie } = resolveBoude(state);

        logResult('Test 8: Boudé resolved (A wins, Double Cochon)', newState, {});

        expect(isTie).toBe(false);
        // A should get 1 (win) + 2 (cochons) = 3 total points.
        const playerA = newState.players.find((p: Player) => p.id === 'A');
        expect(playerA?.totalPoints).toBe(3);
        // Phase should be MATCH_END if winningCondition is 3 ? Wait, default winningCondition is 30.
        // It should be MANCHE_END because A reaches 3 stars.
        expect(newState.phase).toBe('MANCHE_END');
        expect(newState.mancheResult).toBe('COCHON');
    });

    // ─── Tests de couverture R3-B1 (fix Mode Score) ─────────────────────────────

    test('R3-B1-A : SCORE — Égalité exacte au seuil via round → partie continue', () => {
        // A=9pts, B=10pts déjà. Objectif=10. A gagne le round → A=10, B=10 → 2 leaders → pas de fin.
        // Le match doit continuer jusqu'à ce qu'un joueur soit seul en tête.
        const state = createMockState([
            { id: 'A', stars: 0, totalPoints: 9 },
            { id: 'B', stars: 0, totalPoints: 10 },
            { id: 'C', stars: 0, totalPoints: 5 }
        ], 'SCORE', 10);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');
        const playerB = newState.players.find(p => p.id === 'B');

        expect(playerA?.totalPoints).toBe(10);
        expect(playerB?.totalPoints).toBe(10);
        // Deux joueurs à égalité au seuil → le match ne se termine PAS
        expect(newState.phase).toBe('PARTIE_END');
    });

    test('R3-B1-B : SCORE — Seuil atteint via bonus de manche (cochon) → MATCH_END', () => {
        // A=7pts, 2 étoiles. B=0 étoile. C=0 étoile. Objectif=10.
        // A gagne le round → 3 étoiles (mancheWinner) → +1 round + 2 bonus cochon = 10pts → MATCH_END.
        // Vérifie que le chemin "manche + bonus" fonctionne toujours après le refactor.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 7 },
            { id: 'B', stars: 0, totalPoints: 3 },
            { id: 'C', stars: 0, totalPoints: 3 }
        ], 'SCORE', 10);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');

        // A : 7 + 1 (round) + 2 (double cochon) = 10 ≥ objectif → MATCH_END
        expect(playerA?.totalPoints).toBe(10);
        expect(newState.mancheResult).toBe('COCHON');
        expect(newState.phase).toBe('MATCH_END');
    });

    test('R3-B1-B2 : SCORE — Chiré avec leader unique au seuil → MATCH_END', () => {
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 8 },
            { id: 'B', stars: 1, totalPoints: 4 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ], 'SCORE', 7);

        const newState = finalizeRound(state, 'C');

        expect(newState.mancheResult).toBe('CHIRE');
        expect(newState.phase).toBe('MATCH_END');
    });

    test('R3-B1-C : MANCHE — Round ordinaire ne déclenche pas MATCH_END même si totalPoints élevé', () => {
        // En mode MANCHE, la fin de match dépend du nombre de manches jouées, PAS des totalPoints.
        // Régression : s'assurer que le fix Score n'affecte pas le mode MANCHE.
        const state = createMockState([
            { id: 'A', stars: 0, totalPoints: 99 },
            { id: 'B', stars: 0, totalPoints: 50 },
            { id: 'C', stars: 0, totalPoints: 50 }
        ], 'MANCHE', 3); // Objectif = 3 manches

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');

        expect(playerA?.totalPoints).toBe(100);
        // Pas de mancheWinner (0 étoile → 1 étoile, pas 3) → PARTIE_END
        expect(newState.phase).toBe('PARTIE_END');
    });

    test('R3-B1-D : COCHON — Round ordinaire ne déclenche pas MATCH_END', () => {
        // En mode COCHON, seul un mancheWinner avec totalCochons >= seuil déclenche la fin.
        // Régression : s'assurer que le fix Score n'affecte pas le mode COCHON.
        const state: any = createMockState([
            { id: 'A', stars: 0, totalPoints: 5 },
            { id: 'B', stars: 0, totalPoints: 2 },
            { id: 'C', stars: 0, totalPoints: 2 }
        ], 'COCHON', 3);
        state.players[0].totalCochons = 2;
        state.players[0].totalCochonsInfliges = 2; // A a déjà 2 cochons infligés, seuil = 3

        const newState = finalizeRound(state, 'A');

        // Pas de mancheWinner (1 étoile seulement) → PARTIE_END, pas MATCH_END
        expect(newState.phase).toBe('PARTIE_END');
    });

    test('R3-B1-D2 : COCHON — Chiré déclenche MATCH_END si le seuil cochons est déjà atteint', () => {
        const state: any = createMockState([
            { id: 'A', stars: 2, totalPoints: 3 },
            { id: 'B', stars: 1, totalPoints: 2 },
            { id: 'C', stars: 0, totalPoints: 1 }
        ], 'COCHON', 2);
        state.players[0].totalCochons = 2;
        state.players[0].totalCochonsInfliges = 2;
        state.players[1].totalCochons = 1;
        state.players[1].totalCochonsInfliges = 1;
        state.players[2].totalCochons = 0;
        state.players[2].totalCochonsInfliges = 0;

        const newState = finalizeRound(state, 'C');

        expect(newState.mancheResult).toBe('CHIRE');
        expect(newState.phase).toBe('MATCH_END');
    });

    test('R3-B1-D3 : MANCHE — Chiré sur la manche décisive déclenche MATCH_END si le leader est unique', () => {
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 8 },
            { id: 'B', stars: 1, totalPoints: 4 },
            { id: 'C', stars: 0, totalPoints: 0 }
        ], 'MANCHE', 3);
        state.mancheHistory = [{}, {}] as any;

        const newState = finalizeRound(state, 'C');

        expect(newState.mancheResult).toBe('CHIRE');
        expect(newState.mancheHistory.length).toBe(3);
        expect(newState.phase).toBe('MATCH_END');
    });

    test('R3-B1-E : SCORE — Dépassement du seuil (saut) via round déclenche MATCH_END', () => {
        // A=28pts, objectif=30. A gagne un round avec bonus (2 cochons) → 28+1+2=31 > 30 → MATCH_END.
        // Vérifie que le dépassement (>= et pas seulement ==) est bien géré.
        const state = createMockState([
            { id: 'A', stars: 2, totalPoints: 28 },
            { id: 'B', stars: 0, totalPoints: 5 },
            { id: 'C', stars: 0, totalPoints: 5 }
        ], 'SCORE', 30);

        const newState = finalizeRound(state, 'A');
        const playerA = newState.players.find(p => p.id === 'A');

        // 28 + 1 (round) + 2 (double cochon bonus) = 31 ≥ 30 → MATCH_END
        expect(playerA?.totalPoints).toBe(31);
        expect(newState.phase).toBe('MATCH_END');
    });
});
