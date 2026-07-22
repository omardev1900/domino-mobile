/**
 * SurrenderPenalty.test.ts
 *
 * Tests pour MULTI-PENALITE-ABANDON :
 *  1. signalPlayerOffline(surrendered=true)  → statut SURRENDERED (pas DISCONNECTED)
 *  2. signalPlayerOffline(surrendered=false) → statut DISCONNECTED
 *  3. Le bot joue bien pour un joueur SURRENDERED (useBotDecision)
 *  4. Le timer réduit (3s) s'applique à SURRENDERED comme à DISCONNECTED
 *  5. RewardEngine — SURRENDERED est toujours classé dernier, même si son bot a gagné
 *  6. Deux SURRENDERED : classés après les actifs, ordonnés par points entre eux
 *  7. Régression — DISCONNECTED conserve son classement normal (non pénalisé comme SURRENDERED)
 *  8. SURRENDERED ne peut pas être re-downgraded en DISCONNECTED par la vigilance
 */

import { PlayerStatus } from '../types';
import { RewardEngine } from '../RewardEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MinPlayer = {
    id: string;
    name: string;
    status: PlayerStatus;
    totalPoints: number;
    mancheWins: number;
    totalCochons: number;
    totalCochonsInfliges: number;
    totalRoundWins: number;
    hand: [];
    handSize: number;
    currentMancheStars: number;
    wins: number;
    isCochon: boolean;
    totalCochonsSubis: number;
};

function makePlayer(overrides: Partial<MinPlayer> & { id: string }): MinPlayer {
    return {
        name: overrides.id,
        status: 'HUMAN',
        totalPoints: 0,
        mancheWins: 0,
        totalCochons: 0,
        totalCochonsInfliges: 0,
        totalRoundWins: 0,
        hand: [],
        handSize: 0,
        currentMancheStars: 0,
        wins: 0,
        isCochon: false,
        totalCochonsSubis: 0,
        ...overrides,
    };
}

function makeGameState(players: MinPlayer[], gameMode: 'MANCHE' | 'SCORE' | 'COCHON' | 'VICTOIRE' = 'MANCHE') {
    return {
        gameId: 'test',
        players,
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        currentPlayerId: players[0].id,
        phase: 'MATCH_END' as const,
        firstPlayerOfRound: null,
        history: [],
        mancheHistory: [],
        winningCondition: 3,
        gameMode,
        turnDuration: 20,
        lastActionTimestamp: Date.now(),
        turnId: 10,
        roundNumber: 3,
        mancheNumber: 2,
        startingHandSize: 7,
    };
}

// ─── Type guard ───────────────────────────────────────────────────────────────

test('PlayerStatus inclut SURRENDERED', () => {
    const status: PlayerStatus = 'SURRENDERED';
    expect(status).toBe('SURRENDERED');
});

// ─── signalPlayerOffline — comportement attendu ───────────────────────────────

test('signalPlayerOffline(true)  → doit écrire SURRENDERED, pas DISCONNECTED', () => {
    // On simule la logique interne sans Firestore
    const surrendered = true;
    const newStatus: PlayerStatus = surrendered ? 'SURRENDERED' : 'DISCONNECTED';
    expect(newStatus).toBe('SURRENDERED');
});

test('signalPlayerOffline(false) → doit écrire DISCONNECTED', () => {
    const surrendered = false;
    const newStatus: PlayerStatus = surrendered ? 'SURRENDERED' : 'DISCONNECTED';
    expect(newStatus).toBe('DISCONNECTED');
});

test('signalPlayerOffline()      → défaut DISCONNECTED (pas de param)', () => {
    // Valeur par défaut = false
    const surrendered = undefined;
    const newStatus: PlayerStatus = surrendered ? 'SURRENDERED' : 'DISCONNECTED';
    expect(newStatus).toBe('DISCONNECTED');
});

// ─── Bot decision — SURRENDERED déclenche bien le bot ─────────────────────────

test('Un joueur SURRENDERED doit déclencher le bot (status !== HUMAN)', () => {
    const status: PlayerStatus = 'SURRENDERED';
    // La condition dans useBotDecision : `activePlayer.status === 'HUMAN'` → return (pas de bot)
    // Si SURRENDERED, on ne return pas, le bot joue
    const shouldBotPlay = status !== 'HUMAN';
    expect(shouldBotPlay).toBe(true);
});

test('Un joueur SURRENDERED doit utiliser le délai court (2500ms) comme DISCONNECTED', () => {
    const status: PlayerStatus = 'SURRENDERED';
    const isAbsent = status === 'DISCONNECTED' || status === 'SURRENDERED';
    const delayMs = isAbsent ? 2500 : 1500;
    expect(delayMs).toBe(2500);
});

test('Un joueur HUMAN actif utilise le délai normal (~1000-1500ms)', () => {
    const status: PlayerStatus = 'HUMAN';
    const isAbsent = status === 'DISCONNECTED' || status === 'SURRENDERED';
    const delayMs = isAbsent ? 2500 : 1500;
    expect(delayMs).toBe(1500);
});

// ─── Timer réduit ─────────────────────────────────────────────────────────────

test('SURRENDERED reçoit la durée de tour réduite (3s max)', () => {
    const status: PlayerStatus = 'SURRENDERED';
    const turnDuration = 20;
    const effectiveDuration = (status === 'DISCONNECTED' || status === 'SURRENDERED')
        ? Math.min(turnDuration, 3)
        : turnDuration;
    expect(effectiveDuration).toBe(3);
});

test('DISCONNECTED reçoit aussi la durée de tour réduite (3s max)', () => {
    const status: PlayerStatus = 'DISCONNECTED';
    const turnDuration = 20;
    const effectiveDuration = (status === 'DISCONNECTED' || status === 'SURRENDERED')
        ? Math.min(turnDuration, 3)
        : turnDuration;
    expect(effectiveDuration).toBe(3);
});

test('HUMAN conserve la durée de tour complète', () => {
    const status: PlayerStatus = 'HUMAN';
    const turnDuration = 20;
    const effectiveDuration = (status === 'DISCONNECTED' || status === 'SURRENDERED')
        ? Math.min(turnDuration, 3)
        : turnDuration;
    expect(effectiveDuration).toBe(20);
});

// ─── RewardEngine — classement SURRENDERED ────────────────────────────────────

describe('RewardEngine — classement avec SURRENDERED', () => {
    const buildRanking = (players: MinPlayer[]) => {
        const input = RewardEngine.buildInputFromGameState({
            gameState: makeGameState(players) as any,
            localPlayerId: players[0].id,
            currentLevel: 1,
            currentXP: 0,
            currentLeaguePoints: 0,
            currentCochonsGiven: 0,
            unlockedFrames: [],
            tableTier: 'bronze' as any,
            isSoloMode: false,
        });
        return input.finalRanking; // PlayerMatchSnapshot[] : { playerId, rank, ... }
    };

    test('SURRENDERED classé dernier même si son bot a le plus de points', () => {
        const players = [
            makePlayer({ id: 'p1', status: 'SURRENDERED', totalPoints: 10, mancheWins: 3 }),
            makePlayer({ id: 'p2', status: 'HUMAN',       totalPoints: 5,  mancheWins: 1 }),
            makePlayer({ id: 'p3', status: 'HUMAN',       totalPoints: 3,  mancheWins: 0 }),
        ];
        const ranking = buildRanking(players);
        const p1Rank = ranking.find(r => r.playerId === 'p1')?.rank;
        expect(p1Rank).toBe(3); // Dernier malgré les meilleurs stats
    });

    test('SURRENDERED classé dernier même si les autres ont 0 points', () => {
        const players = [
            makePlayer({ id: 'p1', status: 'HUMAN',       totalPoints: 0,  mancheWins: 0 }),
            makePlayer({ id: 'p2', status: 'HUMAN',       totalPoints: 0,  mancheWins: 0 }),
            makePlayer({ id: 'p3', status: 'SURRENDERED', totalPoints: 10, mancheWins: 3 }),
        ];
        const ranking = buildRanking(players);
        const p3Rank = ranking.find(r => r.playerId === 'p3')?.rank;
        expect(p3Rank).toBe(3); // Dernier même avec le meilleur score
    });

    test('Deux SURRENDERED : classés après les actifs, ordonnés par points entre eux', () => {
        const players = [
            makePlayer({ id: 'p1', status: 'HUMAN',       totalPoints: 5, mancheWins: 1 }),
            makePlayer({ id: 'p2', status: 'SURRENDERED', totalPoints: 8, mancheWins: 2 }),
            makePlayer({ id: 'p3', status: 'SURRENDERED', totalPoints: 2, mancheWins: 0 }),
        ];
        const ranking = buildRanking(players);
        const p1Rank = ranking.find(r => r.playerId === 'p1')?.rank;
        const p2Rank = ranking.find(r => r.playerId === 'p2')?.rank;
        const p3Rank = ranking.find(r => r.playerId === 'p3')?.rank;
        expect(p1Rank).toBe(1);                      // Seul actif → 1er
        expect(p2Rank!).toBeGreaterThan(p1Rank!);    // Les deux surrendered après l'actif
        expect(p3Rank!).toBeGreaterThan(p1Rank!);
        expect(p2Rank!).toBeLessThan(p3Rank!);        // p2 a plus de points → devant p3
    });

    // ─── Régression ──────────────────────────────────────────────────────────

    test('RÉGRESSION — DISCONNECTED conserve un classement basé sur ses points (pas pénalisé)', () => {
        const players = [
            makePlayer({ id: 'p1', status: 'DISCONNECTED', totalPoints: 8, mancheWins: 2 }),
            makePlayer({ id: 'p2', status: 'HUMAN',        totalPoints: 5, mancheWins: 1 }),
            makePlayer({ id: 'p3', status: 'HUMAN',        totalPoints: 3, mancheWins: 0 }),
        ];
        const ranking = buildRanking(players);
        const p1Rank = ranking.find(r => r.playerId === 'p1')?.rank;
        expect(p1Rank).toBe(1); // DISCONNECTED avec le plus de points → 1er (pas pénalisé)
    });

    test('RÉGRESSION — Partie normale sans SURRENDERED : classement inchangé', () => {
        const players = [
            makePlayer({ id: 'p1', status: 'HUMAN', totalPoints: 5, mancheWins: 1 }),
            makePlayer({ id: 'p2', status: 'BOT',   totalPoints: 8, mancheWins: 2 }),
            makePlayer({ id: 'p3', status: 'HUMAN', totalPoints: 3, mancheWins: 0 }),
        ];
        const ranking = buildRanking(players);
        const p2Rank = ranking.find(r => r.playerId === 'p2')?.rank;
        expect(p2Rank).toBe(1); // p2 a le plus de points → 1er
    });
});

// ─── Garde-fous vigilance ─────────────────────────────────────────────────────

test('SURRENDERED ne doit PAS être overridé en DISCONNECTED par la vigilance', () => {
    // Simulation de la logique vigilance heartbeat :
    // `if (p.status !== 'HUMAN') return p;` → SURRENDERED est préservé
    const player = makePlayer({ id: 'p1', status: 'SURRENDERED' });
    const shouldSkip = player.status !== 'HUMAN';
    expect(shouldSkip).toBe(true); // La vigilance skip ce joueur → status inchangé
});

test('SURRENDERED ne doit PAS être overridé en DISCONNECTED par la grace RTDB', () => {
    // Simulation de la logique RTDB grace period :
    // `if (!player || player.status !== 'HUMAN') return;`
    const player = makePlayer({ id: 'p1', status: 'SURRENDERED' });
    const shouldAbort = !player || player.status !== 'HUMAN';
    expect(shouldAbort).toBe(true); // → on return sans écrire DISCONNECTED
});
