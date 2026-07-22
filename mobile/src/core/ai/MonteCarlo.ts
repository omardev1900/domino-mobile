import { Domino, DominoSide } from '../types';
import { TileTracker } from './TileTracker';
import { getValidMoves, calculateHandPoints, getGranMounMove } from '../DominoEngine';
import { handBoudeSafetyScore } from './EndgameAnalyzer';

export interface MCResult {
    winRate: number;
    boudeSafetyScore: number;
    simulations: number;
}

interface SimPlayer {
    id: string;
    hand: Domino[];
}

interface SimState {
    players: SimPlayer[];
    leftValue: DominoSide | null;
    rightValue: DominoSide | null;
    currentIdx: number;
    passCount: number;
}

/**
 * Simule N parties pour évaluer un coup candidat.
 * Retourne win_rate et boudeSafetyScore entre 0 et 1.
 */
export function simulateCoup(
    myHand: Domino[],              // Main du bot APRÈS avoir joué la tuile candidate
    candidateTile: Domino,         // Tuile que le bot envisage de jouer
    candidateSide: 'left' | 'right' | 'start',
    leftValue: DominoSide | null,  // Nouvelle extrémité gauche après le coup
    rightValue: DominoSide | null, // Nouvelle extrémité droite après le coup
    tracker: TileTracker,
    opponentIds: string[],
    N = 500,
    timeBudgetMs = 80
): MCResult {
    const start = Date.now();
    let wins = 0;
    let boudeSafetyTotal = 0;
    let simsDone = 0;

    // Tuiles inconnues (non jouées, non dans ma main)
    const unknownTiles = getUnknownTiles(tracker);

    for (let i = 0; i < N; i++) {
        if (Date.now() - start > timeBudgetMs) break;

        // Distribuer aléatoirement les tuiles inconnues aux adversaires
        const distributed = distributeUnknowns(unknownTiles, opponentIds, tracker);

        const simState: SimState = {
            players: [
                { id: 'bot', hand: [...myHand] },
                ...opponentIds.map(pid => ({ id: pid, hand: distributed.get(pid) ?? [] })),
            ],
            leftValue,
            rightValue,
            currentIdx: 1, // Les adversaires jouent d'abord après le coup du bot
            passCount: 0,
        };

        const result = runSimulation(simState, 'bot');
        if (result.winner === 'bot') wins++;
        boudeSafetyTotal += result.boudeSafety;
        simsDone++;
    }

    return {
        winRate: simsDone > 0 ? wins / simsDone : 0,
        boudeSafetyScore: simsDone > 0 ? boudeSafetyTotal / simsDone : 0,
        simulations: simsDone,
    };
}

// ─── Internals ────────────────────────────────────────────────────────────────

import { ALL_DOMINOS } from '../constants';

function getUnknownTiles(tracker: TileTracker): Domino[] {
    const result: Domino[] = [];
    for (const [id, state] of tracker.tileStates.entries()) {
        if (state.status === 'UNKNOWN') {
            const idx = parseInt(id.replace('d-', ''), 10);
            if (isNaN(idx)) continue;
            const { left: lo, right: hi } = ALL_DOMINOS[idx];
            result.push({
                id,
                left: lo as DominoSide,
                right: hi as DominoSide,
                isDouble: lo === hi,
            });
        }
    }
    return result;
}

function distributeUnknowns(
    unknowns: Domino[],
    opponentIds: string[],
    tracker: TileTracker
): Map<string, Domino[]> {
    const result = new Map<string, Domino[]>();
    for (const pid of opponentIds) result.set(pid, []);

    const remainingSlots = new Map<string, number>();
    for (const pid of opponentIds) {
        remainingSlots.set(pid, tracker.handSizes.get(pid) ?? 7);
    }

    const shuffled = [...unknowns].sort(() => Math.random() - 0.5);

    for (const tile of shuffled) {
        const state = tracker.tileStates.get(tile.id);
        if (!state || state.status !== 'UNKNOWN') continue;

        const candidates: { id: string; weight: number }[] = [];
        for (const pid of opponentIds) {
            const slotsLeft = remainingSlots.get(pid) ?? 0;
            const weight = state.probabilities.get(pid) ?? 0;
            if (slotsLeft > 0 && weight > 0) {
                candidates.push({ id: pid, weight });
            }
        }

        const chosen = pickWeightedCandidate(candidates);
        if (!chosen) continue;

        result.get(chosen)!.push(tile);
        remainingSlots.set(chosen, (remainingSlots.get(chosen) ?? 1) - 1);
    }

    return result;
}

interface SimResult {
    winner: string | 'boude';
    boudeSafety: number;
}

function runSimulation(state: SimState, botId: string): SimResult {
    const MAX_TURNS = 100;
    let turns = 0;
    const s = deepCloneSim(state);

    while (turns < MAX_TURNS) {
        turns++;
        const player = s.players[s.currentIdx % s.players.length];

        if (player.hand.length === 0) {
            return {
                winner: player.id,
                boudeSafety: player.id === botId ? 1 : 0,
            };
        }

        const moves = getValidMoves(player.hand, { left: s.leftValue, right: s.rightValue });

        if (moves.length === 0) {
            s.passCount++;
            if (s.passCount >= s.players.length) {
                // Partie bloquée : gagnant = main la plus légère
                const sorted = [...s.players].sort(
                    (a, b) => calculateHandPoints(a.hand) - calculateHandPoints(b.hand)
                );
                const winner = sorted[0].id;
                const botHand = s.players.find(p => p.id === botId)?.hand ?? [];
                return {
                    winner,
                    boudeSafety: handBoudeSafetyScore(botHand),
                };
            }
        } else {
            s.passCount = 0;
            // Heuristique GRAN_MOUN simplifiée pour les simulations
            const move = getGranMounMove(player.hand, { left: s.leftValue, right: s.rightValue }) ?? moves[0];
            player.hand = player.hand.filter(t => t.id !== move.tile.id);

            if (move.side === 'left') {
                s.leftValue = move.isReversed ? move.tile.right : move.tile.left;
            } else if (move.side === 'right') {
                s.rightValue = move.isReversed ? move.tile.left : move.tile.right;
            } else {
                s.leftValue = move.tile.left;
                s.rightValue = move.tile.right;
            }
        }

        s.currentIdx = (s.currentIdx + 1) % s.players.length;
    }

    // Timeout de sécurité : considérer comme nul
    const botHand = s.players.find(p => p.id === botId)?.hand ?? [];
    return { winner: 'boude', boudeSafety: handBoudeSafetyScore(botHand) };
}

function deepCloneSim(state: SimState): SimState {
    return {
        players: state.players.map(p => ({ id: p.id, hand: [...p.hand] })),
        leftValue: state.leftValue,
        rightValue: state.rightValue,
        currentIdx: state.currentIdx,
        passCount: state.passCount,
    };
}

function pickWeightedCandidate(candidates: { id: string; weight: number }[]): string | null {
    if (candidates.length === 0) return null;

    const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    if (total <= 0) {
        return candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    let cursor = Math.random() * total;
    for (const candidate of candidates) {
        cursor -= candidate.weight;
        if (cursor <= 0) return candidate.id;
    }

    return candidates[candidates.length - 1].id;
}
