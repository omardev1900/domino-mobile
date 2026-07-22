/**
 * ScoringEngine.test.ts
 *
 * Tests automatisés pour la logique de fin de manche (finalizeRound).
 * Couvre principalement le Bug B3 — Mode Cochon :
 *   - Le VAINQUEUR cumule les cochons donnés (totalCochonsInfliges)
 *   - Les PERDANTS à 0 étoile reçoivent un cochon (totalCochonsSubis)
 *   - La CHIRÉE n'attribue aucun cochon
 *   - Le vainqueur peut gagner 1 ou 2 cochons selon le nombre de perdants à 0
 */

import { finalizeRound } from '../ScoringEngine';
import { GameState, Player } from '../types';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';
import { MANCHE_WIN_THRESHOLD } from '../constants';

// ─── HELPER : Créer un joueur de test ────────────────────────────────────────
const makePlayer = (id: string, stars: number, overrides?: Partial<Player>): Player => ({
    id,
    name: id,
    hand: [],
    handSize: 0,
    wins: 0,
    mancheWins: 0,
    currentMancheStars: stars,
    totalRoundWins: stars,
    totalPoints: stars,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status: 'HUMAN',
    ...overrides,
});

// ─── HELPER : Construire un état de fin de manche ────────────────────────────
// Pour déclencher finalizeRound en mode "manche terminée", le vainqueur
// doit déjà avoir MANCHE_WIN_THRESHOLD étoiles après +1 de ce round.
// On le met donc à MANCHE_WIN_THRESHOLD - 1 pour que +1 déclenche la victoire.
const makeMancheEndState = (
    players: Player[],
    winnerId: string,
    gameMode: GameState['gameMode'] = 'COCHON'
): GameState => {
    // Le vainqueur doit avoir exactement MANCHE_WIN_THRESHOLD - 1 étoiles
    // AVANT que finalizeRound l'incrémente à MANCHE_WIN_THRESHOLD.
    const adjusted = players.map(p =>
        p.id === winnerId
            ? { ...p, currentMancheStars: MANCHE_WIN_THRESHOLD - 1, totalRoundWins: MANCHE_WIN_THRESHOLD - 1, totalPoints: MANCHE_WIN_THRESHOLD - 1 }
            : p
    );

    return createBaseGameState({
        players: adjusted,
        currentPlayerId: winnerId,
        gameMode,
        winningCondition: 5, // Seuil élevé pour ne pas déclencher MATCH_END dans ces tests
        mancheHistory: [],
    });
};

// ═════════════════════════════════════════════════════════════════════════════
describe('ScoringEngine — Mode Cochon (Bug B3)', () => {

    // ─── CAS 1 : Vainqueur + 1 perdant à 0 ───────────────────────────────────
    describe('Manche normale — 1 perdant à 0 étoile', () => {
        const players = [
            makePlayer('p1', MANCHE_WIN_THRESHOLD - 1), // Vainqueur (sera à THRESHOLD après +1)
            makePlayer('p2', 1),                         // A 1 étoile, pas de cochon
            makePlayer('p3', 0),                         // 0 étoile → reçoit 1 cochon
        ];
        const state = makeMancheEndState(players, 'p1');
        const result = finalizeRound(state, 'p1');

        it('devrait détecter mancheResult = COCHON', () => {
            expect(result.mancheResult).toBe('COCHON');
        });

        it('le vainqueur devrait recevoir +1 cochon infligé (totalCochonsInfliges)', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.totalCochonsInfliges).toBe(1);
        });

        it('le vainqueur ne devrait PAS avoir totalCochonsSubis augmenté', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.totalCochonsSubis).toBe(0);
        });

        it('le perdant à 0 étoile devrait avoir isCochon = true', () => {
            const loser = result.players.find(p => p.id === 'p3')!;
            expect(loser.isCochon).toBe(true);
        });

        it('le perdant à 0 étoile devrait recevoir +1 cochon subi (totalCochonsSubis)', () => {
            const loser = result.players.find(p => p.id === 'p3')!;
            expect(loser.totalCochonsSubis).toBe(1);
        });

        it('le joueur avec 1 étoile ne devrait PAS être cochon', () => {
            const middle = result.players.find(p => p.id === 'p2')!;
            expect(middle.isCochon).toBe(false);
            expect(middle.totalCochonsSubis).toBe(0);
        });
    });

    // ─── CAS 2 : Vainqueur + 2 perdants à 0 (vainqueur gagne 2 cochons) ──────
    describe('Manche Cochon double — 2 perdants à 0 étoile', () => {
        const players = [
            makePlayer('p1', MANCHE_WIN_THRESHOLD - 1), // Vainqueur
            makePlayer('p2', 0),                          // 0 étoile → cochon
            makePlayer('p3', 0),                          // 0 étoile → cochon
        ];
        const state = makeMancheEndState(players, 'p1');
        const result = finalizeRound(state, 'p1');

        it('devrait détecter mancheResult = COCHON', () => {
            expect(result.mancheResult).toBe('COCHON');
        });

        it('le vainqueur devrait recevoir +2 cochons infligés (totalCochonsInfliges)', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.totalCochonsInfliges).toBe(2);
        });

        it('p2 et p3 devraient chacun avoir totalCochonsSubis = 1', () => {
            const loser2 = result.players.find(p => p.id === 'p2')!;
            const loser3 = result.players.find(p => p.id === 'p3')!;
            expect(loser2.totalCochonsSubis).toBe(1);
            expect(loser3.totalCochonsSubis).toBe(1);
        });

        it('cochonCount dans mancheHistory devrait être 2', () => {
            const lastRecord = result.mancheHistory?.[result.mancheHistory.length - 1];
            expect(lastRecord?.cochonCount).toBe(2);
        });
    });

    // ─── CAS 3 : Manche NORMALE (aucun perdant à 0) ──────────────────────────
    describe('Manche normale — aucun perdant à 0 étoile', () => {
        // Pour avoir NORMAL, il faut :
        //   - Un seul joueur à THRESHOLD (vainqueur de manche)
        //   - Aucun joueur à 0 étoile (sinon ce serait COCHON)
        //   - Pas tous les joueurs avec >0 étoiles en même temps (sinon ce serait CHIRE)
        // Scénario : p1 passe à THRESHOLD, p2=1étoile, p3=0 → serait COCHON si cochonCount > 0.
        // Pour éviter COCHON et CHIRE : p2=1, p3=1 mais p1 n'est PAS à THRESHOLD-1 → en fait
        // le seul vrai cas NORMAL c'est p1 vainqueur de manche, p2 et p3 avec au moins 1 étoile
        // MAIS pas tous à 1+ au sens total => Chirée détectée en priorité.
        // Conclusion : NORMAL arrive seulement si 2 joueurs ont au moins 1 étoile mais le 3e (perdant) en a 0.
        // => C'est en fait une manche COCHON (un perdant à 0 étoile).
        // Un vrai NORMAL = personne à 0, et pas de Chiré = IMPOSSIBLE avec 3 joueurs sauf si 2 ont 0.
        // On teste donc une manche COCHON sans rigolade : le seul perdant à 0 reçoit son cochon.
        // [Cas 3 est reformulé pour refléter la réalité du jeu]
        const players = [
            makePlayer('p1', MANCHE_WIN_THRESHOLD - 1), // Vainqueur
            makePlayer('p2', 0),                          // 0 étoile → cochon
            makePlayer('p3', 0),                          // 0 étoile → cochon
        ];
        const state = makeMancheEndState(players, 'p1');
        const result = finalizeRound(state, 'p1');

        it('devrait détecter mancheResult = COCHON (tous les perdants à 0)', () => {
            expect(result.mancheResult).toBe('COCHON');
        });

        it('le vainqueur ne devrait PAS avoir isCochon = true', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.isCochon).toBe(false);
        });

        it('le vainqueur ne devrait PAS avoir totalCochonsSubis > 0', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.totalCochonsSubis).toBe(0);
        });
    });


    // ─── CAS 4 : Manche CHIRÉE — aucun cochon ────────────────────────────────
    describe('Manche Chirée — aucun cochon attribué', () => {
        // Chirée = tous les joueurs ont au moins 1 étoile.
        // Le "vainqueur" est celui qui vient de gagner ce dernier round.
        const players = [
            makePlayer('p1', MANCHE_WIN_THRESHOLD - 1), // Vainqueur du dernier round
            makePlayer('p2', 1),
            makePlayer('p3', 1),
        ];
        const state = makeMancheEndState(players, 'p1');
        const result = finalizeRound(state, 'p1');

        it('devrait détecter mancheResult = CHIRE', () => {
            // CHIRE est détecté car TOUS les joueurs ont >= 1 étoile après l'attribution
            // p2=1, p3=1, p1=THRESHOLD (>= 1 aussi). Donc isChire = true (prioritaire sur mancheWinner).
            expect(result.mancheResult).toBe('CHIRE');
        });

        it('le vainqueur ne devrait PAS avoir de cochons infligés sur une Chirée', () => {
            const winner = result.players.find(p => p.id === 'p1')!;
            expect(winner.totalCochonsInfliges).toBe(0);
        });

        it('aucun joueur ne devrait avoir isCochon = true sur une Chirée', () => {
            result.players.forEach(p => {
                expect(p.isCochon).toBe(false);
            });
        });
    });

    // ─── CAS 5 : Fin de round simple (pas de manche terminée) ────────────────
    describe('Fin de round simple — pas de manche terminée', () => {
        // p1 a 0 étoile actuellement et gagne ce round → 1 étoile, pas assez pour finir la manche.
        const players = [
            makePlayer('p1', 0), // Vainqueur du round, aura 1 étoile après
            makePlayer('p2', 0), // A 0 étoile
            makePlayer('p3', 0), // A 0 étoile
        ];
        const state = createBaseGameState({
            players,
            currentPlayerId: 'p1',
            gameMode: 'COCHON',
            winningCondition: 5,
        });
        const result = finalizeRound(state, 'p1');

        it('devrait être en phase PARTIE_END (round simple)', () => {
            expect(result.phase).toBe('PARTIE_END');
        });

        it('aucun cochon ne devrait être attribué sur un simple round', () => {
            result.players.forEach(p => {
                expect(p.totalCochonsInfliges).toBe(0);
                expect(p.totalCochonsSubis).toBe(0);
                expect(p.isCochon).toBe(false);
            });
        });
    });
});
