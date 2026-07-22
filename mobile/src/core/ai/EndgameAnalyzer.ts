import { GameState, DominoSide } from '../types';
import { TileTracker } from './TileTracker';

export type BoudeRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type StrategyMode = 'CONTROL' | 'SCORE_MIN';

/**
 * Calcule le risque de partie bloquée (Boudé) entre 0 et 1.
 */
import { ALL_DOMINOS } from '../constants';

export function calculateBoudeRisk(gameState: GameState, tracker: TileTracker): number {
    let risk = 0;

    // 1. Valeurs "mortes" : 7 tuiles connues pour cette valeur = personne ne peut jouer cette face
    for (let v = 0; v <= 6; v++) {
        let knownCount = 0;
        for (const [id, state] of tracker.tileStates.entries()) {
            if (state.status === 'PLAYED' || state.status === 'MINE') {
                const idx = parseInt(id.replace('d-', ''), 10);
                if (isNaN(idx)) continue;
                const { left: lo, right: hi } = ALL_DOMINOS[idx];
                if (lo === v || hi === v) knownCount++;
            }
        }
        if (knownCount >= 7) risk += 0.15;
        else if (knownCount >= 6) risk += 0.08;
    }

    // 2. Passes récentes dans l'historique
    const recentPasses = gameState.history.slice(-6).filter(h => h.action === 'PASS').length;
    risk += recentPasses * 0.08;

    // 3. Peu de tuiles restantes en moyenne
    const avgHandSize = gameState.players.reduce((s, p) => s + p.hand.length, 0) / gameState.players.length;
    if (avgHandSize <= 3) risk += 0.10;
    if (avgHandSize <= 2) risk += 0.10;

    return Math.min(risk, 1.0);
}

/**
 * Détermine le mode stratégique selon le risque de Boudé.
 */
export function getStrategyMode(boudeRisk: number): StrategyMode {
    return boudeRisk > 0.5 ? 'SCORE_MIN' : 'CONTROL';
}

/**
 * Retourne les pondérations Monte-Carlo selon le mode.
 */
export function getMCWeights(mode: StrategyMode): { winRate: number; boudeSafety: number } {
    if (mode === 'SCORE_MIN') return { winRate: 0.4, boudeSafety: 0.6 };
    return { winRate: 0.7, boudeSafety: 0.3 };
}

/**
 * Score la "sécurité Boudé" d'une main (plus le score de main est bas, mieux c'est).
 * Retourne une valeur entre 0 et 1 (1 = main très légère).
 */
export function handBoudeSafetyScore(hand: { left: number; right: number }[]): number {
    if (hand.length === 0) return 1;
    const totalPoints = hand.reduce((s, t) => s + t.left + t.right, 0);
    const maxPossible = hand.length * 12; // max = double-6 répété
    return 1 - totalPoints / maxPossible;
}

/**
 * Identifie les tuiles "lourdes" à jouer en priorité en mode SCORE_MIN.
 */
export function heavyTilesFirst(
    hand: { id: string; left: number; right: number; isDouble: boolean }[]
): typeof hand {
    return [...hand].sort((a, b) => (b.left + b.right) - (a.left + a.right));
}
